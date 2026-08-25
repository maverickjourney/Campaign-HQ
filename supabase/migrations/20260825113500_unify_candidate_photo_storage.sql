begin;

-- ============================================================
-- CAMPAIGN SEAT
-- CANONICAL CANDIDATE PHOTO STORAGE
--
-- One persisted photo source:
--   Onboarding
--   Profile Settings
--   Candidate Profile
--   Campaign HQ
--   Shared workspace shell
--
-- Existing campaign-files candidate photos remain supported
-- by the frontend as a legacy read fallback.
-- ============================================================


-- ------------------------------------------------------------
-- PRIVATE CANDIDATE PHOTO BUCKET
-- ------------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit
)
values (
  'candidate-photos',
  'candidate-photos',
  false,
  5242880
)
on conflict (id)
do update set
  public =
    excluded.public,
  file_size_limit =
    excluded.file_size_limit;


-- ------------------------------------------------------------
-- READ AUTHORIZATION
--
-- Before Activation:
--   uploader can read their own photo.
--
-- After Activation:
--   any active member of a workspace referencing the photo can
--   read it.
-- ------------------------------------------------------------

create or replace function
public.can_read_candidate_photo(
  target_path text
)
returns boolean
language sql
stable
security definer
set search_path =
  public,
  private,
  pg_temp
as $candidate_photo_read$
  select
    auth.uid() is not null
    and (
      split_part(
        coalesce(
          target_path,
          ''
        ),
        '/',
        1
      ) =
        auth.uid()::text

      or exists (
        select 1
        from public.workspaces
          as workspace
        join public.workspace_members
          as member
          on member.workspace_id =
            workspace.id
        where
          workspace.candidate_photo_path =
            target_path

          and member.user_id =
            auth.uid()

          and member.status =
            'active'

          and member.membership_state =
            'active'
      )
    );
$candidate_photo_read$;


revoke all
on function
public.can_read_candidate_photo(text)
from
  public,
  anon;

grant execute
on function
public.can_read_candidate_photo(text)
to authenticated;


drop policy if exists
  "Candidate photo owners and workspace members can read"
on storage.objects;

create policy
  "Candidate photo owners and workspace members can read"
on storage.objects
for select
to authenticated
using (
  bucket_id =
    'candidate-photos'

  and public.can_read_candidate_photo(
    storage.objects.name
  )
);


drop policy if exists
  "Candidate photo owners can upload"
on storage.objects;

create policy
  "Candidate photo owners can upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id =
    'candidate-photos'

  and split_part(
    storage.objects.name,
    '/',
    1
  ) =
    auth.uid()::text
);


drop policy if exists
  "Candidate photo owners can delete"
on storage.objects;

create policy
  "Candidate photo owners can delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id =
    'candidate-photos'

  and split_part(
    storage.objects.name,
    '/',
    1
  ) =
    auth.uid()::text
);


-- ------------------------------------------------------------
-- EXISTING WORKSPACE — PHOTO-ONLY SAVE
-- ------------------------------------------------------------

create or replace function
public.set_workspace_candidate_photo(
  target_workspace_id uuid,
  target_candidate_photo_path text
)
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $candidate_photo_save$
declare
  actor_user_id uuid :=
    auth.uid();

  actor_role_key text;

  clean_path text :=
    nullif(
      btrim(
        coalesce(
          target_candidate_photo_path,
          ''
        )
      ),
      ''
    );
begin

  perform public.require_aal2();


  if actor_user_id is null then
    raise exception
      'A signed-in Campaign Seat session is required.'
      using errcode = '42501';
  end if;


  select
    member.role_key
  into
    actor_role_key
  from public.workspace_members
    as member
  where
    member.workspace_id =
      target_workspace_id

    and member.user_id =
      actor_user_id

    and member.status =
      'active'

    and member.membership_state =
      'active'
  limit 1;


  if actor_role_key is null then
    raise exception
      'You do not have active access to this campaign workspace.'
      using errcode = '42501';
  end if;


  if actor_role_key not in (
    'campaign_owner',
    'candidate',
    'campaign_consultant',
    'campaign_manager',
    'campaign_administrator'
  ) then
    raise exception
      'Your campaign role cannot change the candidate photo.'
      using errcode = '42501';
  end if;


  if clean_path is not null then

    if split_part(
      clean_path,
      '/',
      1
    ) <> actor_user_id::text then
      raise exception
        'The candidate photo does not belong to this signed-in account.'
        using errcode = '42501';
    end if;


    if not exists (
      select 1
      from storage.objects
      where
        bucket_id =
          'candidate-photos'

        and name =
          clean_path
    ) then
      raise exception
        'The candidate photo upload could not be verified.';
    end if;

  end if;


  update public.workspaces
  set
    candidate_photo_path =
      clean_path
  where id =
    target_workspace_id;


  if not found then
    raise exception
      'The selected campaign workspace was not found.';
  end if;


  insert into public.activity_log (
    workspace_id,
    actor_user_id,
    activity_type,
    title,
    detail,
    entity_type,
    entity_id,
    route,
    metadata,
    occurred_at
  )
  values (
    target_workspace_id,
    actor_user_id,
    'candidate_photo_updated',
    'Candidate photo updated',
    case
      when clean_path is null
        then 'Candidate photo removed'
      else 'Candidate photo saved'
    end,
    'workspace',
    target_workspace_id,
    '/settings?tab=profile',
    jsonb_build_object(
      'managed_by_role',
      actor_role_key,
      'photo_present',
      clean_path is not null
    ),
    now()
  );


  return jsonb_build_object(
    'ok',
    true,
    'workspace_id',
    target_workspace_id,
    'candidate_photo_path',
    clean_path
  );
end;
$candidate_photo_save$;


revoke all
on function
public.set_workspace_candidate_photo(
  uuid,
  text
)
from
  public,
  anon;

grant execute
on function
public.set_workspace_candidate_photo(
  uuid,
  text
)
to authenticated;


-- ------------------------------------------------------------
-- ONBOARDING — SAVE PHOTO PATH ON THE CAMPAIGN PROFILE STEP
--
-- This is intentionally available before the Security/MFA step,
-- but requires the authenticated onboarding owner and verifies
-- that the uploaded object is in that user's private folder.
-- ------------------------------------------------------------

create or replace function
public.save_my_seat_candidate_photo_path(
  target_candidate_photo_path text
)
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $seat_candidate_photo$
declare
  actor_user_id uuid :=
    auth.uid();

  onboarding_record record;

  clean_path text :=
    nullif(
      btrim(
        coalesce(
          target_candidate_photo_path,
          ''
        )
      ),
      ''
    );
begin

  if actor_user_id is null then
    raise exception
      'Sign in to continue onboarding.'
      using errcode = '42501';
  end if;


  select
    onboarding.id
      as onboarding_run_id

  into onboarding_record

  from public.seat_customer_contacts
    as contact

  join public.seat_product_accounts
    as account
    on account.primary_contact_id =
      contact.id

  join public.seat_products
    as product
    on product.id =
      account.product_id

  join public.seat_onboarding_runs
    as onboarding
    on onboarding.product_account_id =
      account.id

  where
    contact.user_id =
      actor_user_id

    and contact.status =
      'active'

    and product.product_key =
      'campaign'

    and onboarding.status =
      'in_progress'

  order by
    onboarding.created_at desc

  limit 1;


  if onboarding_record.onboarding_run_id
    is null
  then
    raise exception
      'An active Campaign Seat onboarding run was not found.'
      using errcode = '42501';
  end if;


  if clean_path is not null then

    if split_part(
      clean_path,
      '/',
      1
    ) <> actor_user_id::text then
      raise exception
        'The onboarding candidate photo does not belong to this account.'
        using errcode = '42501';
    end if;


    if not exists (
      select 1
      from storage.objects
      where
        bucket_id =
          'candidate-photos'

        and name =
          clean_path
    ) then
      raise exception
        'The onboarding candidate photo upload could not be verified.';
    end if;

  end if;


  update public.seat_onboarding_run_steps
  set
    step_data =
      case
        when clean_path is null
        then
          coalesce(
            step_data,
            '{}'::jsonb
          ) - 'candidate_photo_path'

        else
          jsonb_set(
            coalesce(
              step_data,
              '{}'::jsonb
            ),
            '{candidate_photo_path}',
            to_jsonb(
              clean_path
            ),
            true
          )
      end,

    updated_at =
      now()

  where
    onboarding_run_id =
      onboarding_record.onboarding_run_id

    and step_key =
      'product_profile';


  if not found then
    raise exception
      'The Campaign Profile onboarding step was not found.';
  end if;


  return jsonb_build_object(
    'ok',
    true,
    'candidate_photo_path',
    clean_path
  );
end;
$seat_candidate_photo$;


revoke all
on function
public.save_my_seat_candidate_photo_path(text)
from
  public,
  anon;

grant execute
on function
public.save_my_seat_candidate_photo_path(text)
to authenticated;


-- ------------------------------------------------------------
-- ACTIVATION BRIDGE
--
-- The existing Activation RPC already writes
-- setup_metadata.seat_onboarding_run_id onto the new workspace.
-- We use that reference to copy the saved onboarding photo path
-- into the canonical workspace candidate_photo_path.
-- ------------------------------------------------------------

create or replace function
private.apply_onboarding_candidate_photo_to_workspace()
returns trigger
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $apply_seat_candidate_photo$
declare
  onboarding_run_id uuid;
  onboarding_photo_path text;
begin

  if new.candidate_photo_path
    is not null
  then
    return new;
  end if;


  begin
    onboarding_run_id :=
      nullif(
        new.setup_metadata
          ->> 'seat_onboarding_run_id',
        ''
      )::uuid;
  exception
    when others then
      onboarding_run_id :=
        null;
  end;


  if onboarding_run_id is null then
    return new;
  end if;


  select
    nullif(
      btrim(
        coalesce(
          step.step_data
            ->> 'candidate_photo_path',
          ''
        )
      ),
      ''
    )

  into onboarding_photo_path

  from public.seat_onboarding_run_steps
    as step

  where
    step.onboarding_run_id =
      onboarding_run_id

    and step.step_key =
      'product_profile'

  limit 1;


  if onboarding_photo_path is null then
    return new;
  end if;


  if not exists (
    select 1
    from storage.objects
    where
      bucket_id =
        'candidate-photos'

      and name =
        onboarding_photo_path
  ) then
    return new;
  end if;


  update public.workspaces
  set
    candidate_photo_path =
      onboarding_photo_path
  where
    id =
      new.id

    and candidate_photo_path
      is null;


  return new;
end;
$apply_seat_candidate_photo$;


drop trigger if exists
  apply_onboarding_candidate_photo_to_workspace
on public.workspaces;


create trigger
  apply_onboarding_candidate_photo_to_workspace
after insert
on public.workspaces
for each row
execute function
  private.apply_onboarding_candidate_photo_to_workspace();


notify pgrst, 'reload schema';

commit;

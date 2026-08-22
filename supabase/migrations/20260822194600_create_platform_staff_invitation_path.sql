-- ============================================================
-- SEAT PLATFORM
-- SECURE PLATFORM STAFF INVITATION PATH
--
-- Keeps Campaign Seat invitation-only account creation intact.
--
-- New users may be created only when they have:
--   A. a valid workspace invitation
--      OR
--   B. a valid Seat Platform staff invitation
--
-- Platform staff invitations:
--   * are server-side/private
--   * are email-bound
--   * expire
--   * are single-use
--   * automatically create the authorized platform_staff record
--   * do NOT create workspace membership
--   * still require MFA/AAL2 before Admin access
--
-- No passwords, MFA secrets or OAuth credentials are stored.
-- ============================================================

begin;


-- ============================================================
-- EXISTING FOUNDATION ASSERTIONS
-- ============================================================

do $seat_platform_staff_preflight$
begin
  if to_regclass(
    'public.platform_staff'
  ) is null then
    raise exception
      'Required public.platform_staff table is missing.';
  end if;

  if to_regclass(
    'public.workspace_invitations'
  ) is null then
    raise exception
      'Required public.workspace_invitations table is missing.';
  end if;

  if to_regclass(
    'private.seat_security_events'
  ) is null then
    raise exception
      'Required private.seat_security_events table is missing.';
  end if;

  if to_regprocedure(
    'public.seat_platform_admin_authorized()'
  ) is null then
    raise exception
      'Seat Platform Admin authorization helper is missing.';
  end if;
end
$seat_platform_staff_preflight$;


-- ============================================================
-- PRIVATE PLATFORM STAFF INVITATIONS
-- ============================================================

create table
private.platform_staff_invitations (
  id uuid primary key
    default gen_random_uuid(),

  email text not null,

  platform_role text not null,

  title text,

  status text not null
    default 'pending',

  expires_at timestamptz not null,

  invited_by uuid
    references auth.users(id)
    on delete set null,

  accepted_by uuid
    references auth.users(id)
    on delete set null,

  accepted_at timestamptz,

  cancelled_at timestamptz,

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint
    platform_staff_invitation_email_check
  check (
    btrim(email) <> ''
    and position('@' in email) > 1
  ),

  constraint
    platform_staff_invitation_role_check
  check (
    platform_role in (
      'platform_owner',
      'platform_admin',
      'developer',
      'platform_support'
    )
  ),

  constraint
    platform_staff_invitation_status_check
  check (
    status in (
      'pending',
      'accepted',
      'cancelled',
      'expired'
    )
  ),

  constraint
    platform_staff_invitation_metadata_check
  check (
    jsonb_typeof(metadata) =
      'object'
  ),

  constraint
    platform_staff_invitation_acceptance_check
  check (
    (
      status <> 'accepted'
    )
    or (
      accepted_by is not null
      and accepted_at is not null
    )
  )
);


create unique index
platform_staff_pending_email_unique
on private.platform_staff_invitations (
  lower(
    btrim(email)
  )
)
where status = 'pending';


create index
platform_staff_invitation_expiry_idx
on private.platform_staff_invitations (
  status,
  expires_at
);


-- ============================================================
-- PRIVATE ACCESS
-- ============================================================

alter table
private.platform_staff_invitations
enable row level security;

revoke all
on table
private.platform_staff_invitations
from public, anon, authenticated;

grant
  select,
  insert,
  update,
  delete
on table
private.platform_staff_invitations
to service_role;


-- Supabase Auth must be able to inspect pending invitations
-- while executing the Before User Created hook.

grant usage
on schema private
to supabase_auth_admin;

grant select
on table
private.platform_staff_invitations
to supabase_auth_admin;


create policy
"Auth hook may inspect platform staff invitations"
on private.platform_staff_invitations
for select
to supabase_auth_admin
using (true);


-- ============================================================
-- UPDATED-AT TRIGGER
-- ============================================================

create trigger
platform_staff_invitations_set_updated_at
before update
on private.platform_staff_invitations
for each row
execute function
public.set_campaign_updated_at();


-- ============================================================
-- AUTH HOOK
--
-- IMPORTANT:
-- We preserve the same hook name already configured in Supabase.
-- No Dashboard/Auth configuration change is required.
-- ============================================================

create or replace function
public.hook_require_workspace_invitation(
  event jsonb
)
returns jsonb
language plpgsql
stable
set search_path =
  public,
  private,
  pg_temp
as $seat_invitation_hook$
declare
  candidate_email text :=
    lower(
      btrim(
        coalesce(
          event
            -> 'user'
            ->> 'email',
          ''
        )
      )
    );

  signup_provider text :=
    lower(
      coalesce(
        event
          -> 'user'
          -> 'app_metadata'
          ->> 'provider',
        ''
      )
    );

  valid_workspace_invitation boolean :=
    false;

  valid_platform_invitation boolean :=
    false;
begin

  if signup_provider <> 'email' then
    return jsonb_build_object(
      'error',
      jsonb_build_object(
        'http_code',
        403,

        'message',
        'Seat accounts can only be created through an authorized email invitation.'
      )
    );
  end if;


  if candidate_email = '' then
    return jsonb_build_object(
      'error',
      jsonb_build_object(
        'http_code',
        400,

        'message',
        'A valid invited email address is required.'
      )
    );
  end if;


  -- ----------------------------------------------------------
  -- CLIENT / WORKSPACE INVITATION
  -- ----------------------------------------------------------

  select exists (
    select 1
    from public.workspace_invitations
      as invitation
    where
      lower(
        btrim(
          invitation.email
        )
      ) =
        candidate_email

      and invitation.status =
        'pending'

      and invitation.expires_at >
        now()

      and invitation.accepted_at
        is null

      and invitation.cancelled_at
        is null
  )
  into
    valid_workspace_invitation;


  -- ----------------------------------------------------------
  -- PLATFORM STAFF INVITATION
  -- ----------------------------------------------------------

  select exists (
    select 1
    from private.platform_staff_invitations
      as invitation
    where
      lower(
        btrim(
          invitation.email
        )
      ) =
        candidate_email

      and invitation.status =
        'pending'

      and invitation.expires_at >
        now()

      and invitation.accepted_at
        is null

      and invitation.cancelled_at
        is null
  )
  into
    valid_platform_invitation;


  if not (
    valid_workspace_invitation
    or valid_platform_invitation
  ) then
    return jsonb_build_object(
      'error',
      jsonb_build_object(
        'http_code',
        403,

        'message',
        'A valid pending Seat invitation is required to create this account.'
      )
    );
  end if;


  return '{}'::jsonb;
end;
$seat_invitation_hook$;


revoke all
on function
public.hook_require_workspace_invitation(
  jsonb
)
from
  public,
  anon,
  authenticated;

grant execute
on function
public.hook_require_workspace_invitation(
  jsonb
)
to supabase_auth_admin;


comment on function
public.hook_require_workspace_invitation(
  jsonb
)
is
  'Supabase Before User Created hook allowing account creation only for a valid workspace invitation or Seat Platform staff invitation.';


-- ============================================================
-- AUTOMATIC PLATFORM STAFF ACTIVATION
--
-- This trigger runs only after Supabase Auth has successfully
-- created the invited user.
-- ============================================================

create or replace function
private.activate_platform_staff_invitation()
returns trigger
language plpgsql
security definer
set search_path =
  public,
  private,
  auth,
  pg_temp
as $seat_platform_activation$
declare
  candidate_email text :=
    lower(
      btrim(
        coalesce(
          new.email,
          ''
        )
      )
    );

  invitation_record
    private.platform_staff_invitations%rowtype;
begin

  if candidate_email = '' then
    return new;
  end if;


  select
    invitation.*
  into
    invitation_record
  from private.platform_staff_invitations
    as invitation
  where
    lower(
      btrim(
        invitation.email
      )
    ) =
      candidate_email

    and invitation.status =
      'pending'

    and invitation.expires_at >
      now()

    and invitation.accepted_at
      is null

    and invitation.cancelled_at
      is null

  order by
    invitation.created_at desc

  limit 1

  for update;


  if not found then
    return new;
  end if;


  if exists (
    select 1
    from public.platform_staff
      as existing_staff
    where
      existing_staff.user_id =
        new.id
  ) then

    update public.platform_staff
    set
      platform_role =
        invitation_record.platform_role,

      title =
        invitation_record.title,

      status =
        'active',

      updated_at =
        now()
    where
      user_id =
        new.id;

  else

    insert into public.platform_staff (
      user_id,
      platform_role,
      title,
      status,
      created_at,
      updated_at
    )
    values (
      new.id,
      invitation_record.platform_role,
      invitation_record.title,
      'active',
      now(),
      now()
    );

  end if;


  update
  private.platform_staff_invitations
  set
    status =
      'accepted',

    accepted_by =
      new.id,

    accepted_at =
      now(),

    updated_at =
      now()
  where
    id =
      invitation_record.id;


  insert into
  private.seat_security_events (
    actor_user_id,
    event_type,
    severity,
    resource_type,
    resource_id,
    metadata,
    occurred_at
  )
  values (
    new.id,
    'platform_staff_invitation_accepted',
    'notice',
    'platform_staff',
    new.id::text,
    jsonb_build_object(
      'platform_role',
      invitation_record.platform_role,

      'invitation_id',
      invitation_record.id
    ),
    now()
  );


  return new;
end;
$seat_platform_activation$;


revoke all
on function
private.activate_platform_staff_invitation()
from
  public,
  anon,
  authenticated,
  supabase_auth_admin;


drop trigger if exists
seat_activate_platform_staff_invitation
on auth.users;

create trigger
seat_activate_platform_staff_invitation
after insert
on auth.users
for each row
execute function
private.activate_platform_staff_invitation();


-- ============================================================
-- FUTURE ADMIN RPC
--
-- Once the first Platform Owner exists, Platform Owners/Admins
-- can create future staff invitations without direct table
-- access.
-- ============================================================

create or replace function
public.create_platform_staff_invitation(
  target_email text,
  target_platform_role text,
  target_title text default null,
  expires_in_hours integer default 72
)
returns table (
  invitation_id uuid,
  invitation_email text,
  platform_role text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $seat_create_staff_invitation$
declare
  normalized_email text :=
    lower(
      btrim(
        coalesce(
          target_email,
          ''
        )
      )
    );

  new_invitation_id uuid;

  new_expiration timestamptz;
begin

  if not
    public.seat_platform_admin_authorized()
  then
    raise exception
      'Platform Owner or Platform Admin MFA authorization is required.'
      using
        errcode = '42501';
  end if;


  if normalized_email = ''
    or position(
      '@' in normalized_email
    ) <= 1
  then
    raise exception
      'A valid email address is required.';
  end if;


  if target_platform_role not in (
    'platform_owner',
    'platform_admin',
    'developer',
    'platform_support'
  ) then
    raise exception
      'Invalid Seat Platform staff role.';
  end if;


  if expires_in_hours < 1
    or expires_in_hours > 168
  then
    raise exception
      'Staff invitations must expire between 1 and 168 hours.';
  end if;


  if exists (
    select 1
    from auth.users
      as existing_user
    where
      lower(
        btrim(
          existing_user.email
        )
      ) =
        normalized_email
  ) then
    raise exception
      'An Auth account already exists for this email.';
  end if;


  update
  private.platform_staff_invitations
  set
    status =
      'cancelled',

    cancelled_at =
      now(),

    updated_at =
      now()
  where
    lower(
      btrim(
        email
      )
    ) =
      normalized_email

    and status =
      'pending';


  new_expiration :=
    now()
    + make_interval(
        hours =>
          expires_in_hours
      );


  insert into
  private.platform_staff_invitations (
    email,
    platform_role,
    title,
    status,
    expires_at,
    invited_by,
    metadata
  )
  values (
    normalized_email,
    target_platform_role,
    nullif(
      btrim(
        coalesce(
          target_title,
          ''
        )
      ),
      ''
    ),
    'pending',
    new_expiration,
    auth.uid(),
    jsonb_build_object(
      'source',
      'seat_platform_admin'
    )
  )
  returning id
  into new_invitation_id;


  insert into
  private.seat_security_events (
    actor_user_id,
    event_type,
    severity,
    resource_type,
    resource_id,
    metadata,
    occurred_at
  )
  values (
    auth.uid(),
    'platform_staff_invitation_created',
    'notice',
    'platform_staff_invitation',
    new_invitation_id::text,
    jsonb_build_object(
      'platform_role',
      target_platform_role,

      'expires_at',
      new_expiration
    ),
    now()
  );


  return query
  select
    new_invitation_id,
    normalized_email,
    target_platform_role,
    new_expiration;
end;
$seat_create_staff_invitation$;


revoke all
on function
public.create_platform_staff_invitation(
  text,
  text,
  text,
  integer
)
from
  public,
  anon;

grant execute
on function
public.create_platform_staff_invitation(
  text,
  text,
  text,
  integer
)
to authenticated;


-- ============================================================
-- VERIFICATION
-- ============================================================

do $seat_platform_staff_verify$
declare
  result jsonb;
begin

  if to_regclass(
    'private.platform_staff_invitations'
  ) is null then
    raise exception
      'Platform staff invitation table verification failed.';
  end if;


  if to_regprocedure(
    'private.activate_platform_staff_invitation()'
  ) is null then
    raise exception
      'Platform staff activation trigger function verification failed.';
  end if;


  if to_regprocedure(
    'public.create_platform_staff_invitation(text,text,text,integer)'
  ) is null then
    raise exception
      'Platform staff invitation RPC verification failed.';
  end if;


  -- Uninvited email must STILL be rejected.

  result :=
    public.hook_require_workspace_invitation(
      jsonb_build_object(
        'user',
        jsonb_build_object(
          'email',
          'uninvited-seat-verification@example.invalid',

          'app_metadata',
          jsonb_build_object(
            'provider',
            'email'
          )
        )
      )
    );


  if result
    -> 'error'
    ->> 'http_code'
    is distinct from
      '403'
  then
    raise exception
      'Seat invitation-only Auth protection verification failed.';
  end if;
end
$seat_platform_staff_verify$;


notify pgrst, 'reload schema';

commit;

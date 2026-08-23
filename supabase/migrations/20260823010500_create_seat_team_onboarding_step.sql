begin;

-- ============================================================
-- CAMPAIGN SEAT
-- CLIENT ONBOARDING — TEAM & ACCESS PLAN
--
-- IMPORTANT:
-- This step DOES NOT:
--   * create a workspace
--   * create workspace_members
--   * send workspace invitations
--
-- It records the authorized launch team.
-- Actual memberships/invitations are created during Activation.
-- ============================================================


create or replace function
public.get_my_seat_team_setup()
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $seat_team_lookup$
declare
  actor_user_id uuid :=
    auth.uid();

  onboarding_record record;

  roles_data jsonb;

  existing_team_data jsonb;
begin

  if actor_user_id is null then
    raise exception
      'Sign in to continue onboarding.'
      using errcode = '42501';
  end if;


  select
    contact.full_name,

    contact.email,

    account.id
      as product_account_id,

    subscription.included_user_seats,

    onboarding.id
      as onboarding_run_id,

    onboarding.current_step_key,

    team_step.step_data

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

  join public.seat_subscriptions
    as subscription
    on subscription.product_account_id =
      account.id

  join public.seat_onboarding_runs
    as onboarding
    on onboarding.product_account_id =
      account.id

  join public.seat_onboarding_run_steps
    as team_step
    on team_step.onboarding_run_id =
      onboarding.id
    and team_step.step_key =
      'team'

  where
    contact.user_id =
      actor_user_id

    and contact.status =
      'active'

    and product.product_key =
      'campaign'

    and account.status in (
      'pending_onboarding',
      'onboarding'
    )

    and onboarding.status =
      'in_progress'

  order by
    onboarding.created_at desc

  limit 1;


  if onboarding_record.onboarding_run_id
    is null
  then
    return jsonb_build_object(
      'found',
      false
    );
  end if;


  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'role_key',
          role.key,

          'name',
          role.name,

          'description',
          role.description,

          'dashboard_type',
          role.dashboard_type,

          'seat_type',
          role.seat_type,

          'authority_rank',
          role.authority_rank
        )
        order by
          role.authority_rank,
          role.name
      ),
      '[]'::jsonb
    )

  into roles_data

  from public.campaign_roles
    as role

  where
    role.is_active =
      true

    and role.key <>
      'campaign_owner';


  existing_team_data :=
    coalesce(
      onboarding_record.step_data
        -> 'planned_members',
      '[]'::jsonb
    );


  return jsonb_build_object(
    'found',
    true,

    'current_step_key',
    onboarding_record.current_step_key,

    'primary_member',
    jsonb_build_object(
      'full_name',
      onboarding_record.full_name,

      'email',
      onboarding_record.email,

      'role_key',
      'campaign_owner',

      'display_title',
      'Candidate'
    ),

    'included_user_seats',
    coalesce(
      onboarding_record.included_user_seats,
      1
    ),

    'maximum_additional_members',
    greatest(
      coalesce(
        onboarding_record.included_user_seats,
        1
      ) - 1,
      0
    ),

    'roles',
    roles_data,

    'planned_members',
    existing_team_data
  );
end;
$seat_team_lookup$;


revoke all
on function
public.get_my_seat_team_setup()
from
  public,
  anon;


grant execute
on function
public.get_my_seat_team_setup()
to authenticated;



create or replace function
public.save_my_seat_team_setup(
  team_members jsonb
)
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  auth,
  pg_temp
as $seat_team_save$
declare
  actor_user_id uuid :=
    auth.uid();

  onboarding_record record;

  normalized_members jsonb :=
    '[]'::jsonb;

  member_record jsonb;

  member_name text;
  member_email text;
  member_role_key text;
  member_title text;

  member_count integer :=
    0;

  max_additional integer :=
    0;

  duplicate_count integer :=
    0;
begin

  if actor_user_id is null then
    raise exception
      'Sign in to continue onboarding.'
      using errcode = '42501';
  end if;


  perform public.require_aal2();


  if
    team_members is null
    or jsonb_typeof(team_members) <>
      'array'
  then
    raise exception
      'Team members must be provided as a list.';
  end if;


  select
    contact.customer_id,

    lower(
      btrim(
        contact.email
      )
    ) as primary_email,

    account.id
      as product_account_id,

    subscription.included_user_seats,

    onboarding.id
      as onboarding_run_id,

    onboarding.current_step_key

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

  join public.seat_subscriptions
    as subscription
    on subscription.product_account_id =
      account.id

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

    and account.status in (
      'pending_onboarding',
      'onboarding'
    )

    and onboarding.status =
      'in_progress'

  order by
    onboarding.created_at desc

  limit 1

  for update of onboarding;


  if onboarding_record.onboarding_run_id
    is null
  then
    raise exception
      'An active Campaign Seat onboarding run was not found.'
      using errcode = '42501';
  end if;


  if onboarding_record.current_step_key <>
    'team'
  then
    raise exception
      'Team & access is not the current onboarding step.';
  end if;


  max_additional :=
    greatest(
      coalesce(
        onboarding_record.included_user_seats,
        1
      ) - 1,
      0
    );


  member_count :=
    jsonb_array_length(
      team_members
    );


  if member_count >
    max_additional
  then
    raise exception
      'This Campaign Seat package includes % total users. You may add up to % additional team members during onboarding.',
      coalesce(
        onboarding_record.included_user_seats,
        1
      ),
      max_additional;
  end if;


  for member_record in
    select value
    from jsonb_array_elements(
      team_members
    )
  loop

    if jsonb_typeof(
      member_record
    ) <> 'object'
    then
      raise exception
        'Each team member must be a valid object.';
    end if;


    member_name :=
      btrim(
        coalesce(
          member_record
            ->> 'full_name',
          ''
        )
      );


    member_email :=
      lower(
        btrim(
          coalesce(
            member_record
              ->> 'email',
            ''
          )
        )
      );


    member_role_key :=
      lower(
        btrim(
          coalesce(
            member_record
              ->> 'role_key',
            ''
          )
        )
      );


    member_title :=
      btrim(
        coalesce(
          member_record
            ->> 'display_title',
          ''
        )
      );


    if member_name = '' then
      raise exception
        'Every planned team member needs a name.';
    end if;


    if
      member_email = ''
      or position(
        '@' in member_email
      ) <= 1
    then
      raise exception
        'Every planned team member needs a valid email address.';
    end if;


    if member_email =
      onboarding_record.primary_email
    then
      raise exception
        'The primary Campaign Owner is already included and should not be added again.';
    end if;


    if not exists (
      select 1

      from public.campaign_roles
        as role

      where
        role.key =
          member_role_key

        and role.is_active =
          true

        and role.key <>
          'campaign_owner'
    )
    then
      raise exception
        'The selected campaign role is invalid: %',
        member_role_key;
    end if;


    normalized_members :=
      normalized_members ||
      jsonb_build_array(
        jsonb_build_object(
          'full_name',
          member_name,

          'email',
          member_email,

          'role_key',
          member_role_key,

          'display_title',
          nullif(
            member_title,
            ''
          )
        )
      );

  end loop;


  select count(*)
  into duplicate_count

  from (
    select
      lower(
        value ->> 'email'
      ) as email

    from jsonb_array_elements(
      normalized_members
    )

    group by
      lower(
        value ->> 'email'
      )

    having count(*) > 1
  ) duplicates;


  if duplicate_count > 0 then
    raise exception
      'Each planned team member must use a unique email address.';
  end if;


  update public.seat_onboarding_run_steps
  set
    status =
      'complete',

    step_data =
      jsonb_build_object(
        'primary_member',
        jsonb_build_object(
          'user_id',
          actor_user_id,

          'email',
          onboarding_record.primary_email,

          'role_key',
          'campaign_owner',

          'display_title',
          'Candidate'
        ),

        'planned_members',
        normalized_members,

        'planned_member_count',
        member_count,

        'included_user_seats',
        coalesce(
          onboarding_record.included_user_seats,
          1
        ),

        'invitations_deferred_until_activation',
        true
      ),

    completed_at =
      now(),

    completed_by_user_id =
      actor_user_id,

    updated_at =
      now()

  where
    onboarding_run_id =
      onboarding_record.onboarding_run_id

    and step_key =
      'team';


  update public.seat_onboarding_run_steps
  set
    status =
      'in_progress',

    started_at =
      coalesce(
        started_at,
        now()
      ),

    updated_at =
      now()

  where
    onboarding_run_id =
      onboarding_record.onboarding_run_id

    and step_key =
      'review'

    and status =
      'pending';


  update public.seat_onboarding_runs
  set
    current_step_key =
      'review',

    updated_at =
      now()

  where id =
    onboarding_record.onboarding_run_id;


  insert into
  private.seat_security_events (
    actor_user_id,
    event_type,
    severity,
    customer_id,
    resource_type,
    resource_id,
    metadata,
    occurred_at
  )
  values (
    actor_user_id,
    'seat_team_plan_completed',
    'notice',
    onboarding_record.customer_id,
    'seat_product_account',
    onboarding_record.product_account_id::text,

    jsonb_build_object(
      'onboarding_run_id',
      onboarding_record.onboarding_run_id,

      'planned_member_count',
      member_count,

      'included_user_seats',
      onboarding_record.included_user_seats
    ),

    now()
  );


  return jsonb_build_object(
    'ok',
    true,

    'current_step_key',
    'review',

    'planned_member_count',
    member_count
  );
end;
$seat_team_save$;


revoke all
on function
public.save_my_seat_team_setup(
  jsonb
)
from
  public,
  anon;


grant execute
on function
public.save_my_seat_team_setup(
  jsonb
)
to authenticated;


notify pgrst, 'reload schema';

commit;

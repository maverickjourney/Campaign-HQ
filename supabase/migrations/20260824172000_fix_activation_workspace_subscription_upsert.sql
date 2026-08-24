begin;

-- ============================================================
-- CAMPAIGN SEAT
-- FIX ACTIVATION WORKSPACE SUBSCRIPTION COLLISION
--
-- New workspaces already receive a default workspace_subscriptions
-- row from seed_campaign_intelligence_foundation().
--
-- Activation therefore UPSERTS the real Campaign Seat billing
-- lifecycle into that seeded row instead of inserting a duplicate.
--
-- No workspace is created by this migration.
-- No trial dates are changed by this migration.
-- No payment is processed.
-- ============================================================

create or replace function
public.activate_my_campaign_seat()
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  extensions,
  auth,
  pg_temp
as $seat_activate_campaign$
declare
  actor_user_id uuid :=
    auth.uid();

  activation_record record;

  profile_data jsonb :=
    '{}'::jsonb;

  team_data jsonb :=
    '{}'::jsonb;

  enabled_modules jsonb :=
    '[]'::jsonb;

  existing_workspace_id uuid;

  created_workspace_id uuid;

  workspace_name text;

  workspace_description text;

  workspace_location text;

  owner_role record;

  review_status text;

  activation_status text;

  incomplete_step text;

  pending_connection_count integer :=
    0;

  planned_member_count integer :=
    0;

  included_user_seats integer;

  member_record jsonb;

  member_name text;

  member_email text;

  member_role_key text;

  member_display_title text;

  invitation_role record;

  raw_token text;

  stored_hash text;

  invitation_id uuid;

  invitation_expires_at timestamptz;

  team_invitations jsonb :=
    '[]'::jsonb;
begin

  if actor_user_id is null then
    raise exception
      'Sign in to activate Campaign Seat.'
      using errcode = '42501';
  end if;


  perform public.require_aal2();


  select
    customer.id
      as customer_id,

    contact.id
      as contact_id,

    lower(
      btrim(
        contact.email
      )
    ) as contact_email,

    account.id
      as product_account_id,

    account.proposal_id,

    account.account_name,

    account.status
      as account_status,

    subscription.id
      as subscription_id,

    subscription.package_name_snapshot,

    subscription.billing_provider,

    subscription.status
      as subscription_status,

    subscription.included_user_seats,

    subscription.external_customer_id,

    subscription.external_subscription_id,

    subscription.trial_ends_at,

    onboarding.id
      as onboarding_run_id,

    onboarding.status
      as onboarding_run_status,

    onboarding.current_step_key

  into activation_record

  from public.seat_customer_contacts
    as contact

  join public.seat_customers
    as customer
    on customer.id =
      contact.customer_id

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
      'onboarding',
      'active'
    )

    and onboarding.status in (
      'in_progress',
      'complete'
    )

  order by
    onboarding.created_at desc

  limit 1

  for update of
    account,
    subscription,
    onboarding;


  if activation_record.product_account_id
    is null
  then
    raise exception
      'An activatable Campaign Seat account was not found.'
      using errcode = 'P0002';
  end if;


  select binding.workspace_id

  into existing_workspace_id

  from public.seat_workspace_bindings
    as binding

  where
    binding.product_account_id =
      activation_record.product_account_id

    and binding.relationship_type =
      'primary'

    and binding.status =
      'active'

  order by
    binding.created_at

  limit 1;


  -- ----------------------------------------------------------
  -- Idempotency:
  -- never create a second workspace for the same active binding.
  -- ----------------------------------------------------------

  if existing_workspace_id is not null then
    return jsonb_build_object(
      'ok',
      true,

      'already_active',
      true,

      'workspace_id',
      existing_workspace_id,

      'workspace_name',
      activation_record.account_name,

      'team_invitations',
      '[]'::jsonb
    );
  end if;


  if activation_record.account_status <>
    'onboarding'
  then
    raise exception
      'This Campaign Seat Product Account is not awaiting Activation.';
  end if;


  if activation_record.onboarding_run_status <>
    'in_progress'
  then
    raise exception
      'This onboarding run is not awaiting Activation.';
  end if;


  if activation_record.current_step_key <>
    'activation'
  then
    raise exception
      'Activation is not the current onboarding step.';
  end if;


  select status
  into review_status

  from public.seat_onboarding_run_steps

  where
    onboarding_run_id =
      activation_record.onboarding_run_id

    and step_key =
      'review';


  select status
  into activation_status

  from public.seat_onboarding_run_steps

  where
    onboarding_run_id =
      activation_record.onboarding_run_id

    and step_key =
      'activation';


  if review_status <>
    'complete'
  then
    raise exception
      'Complete and confirm Review before Activation.';
  end if;


  if activation_status <>
    'in_progress'
  then
    raise exception
      'Activation is not ready to run.';
  end if;


  select step_key
  into incomplete_step

  from public.seat_onboarding_run_steps

  where
    onboarding_run_id =
      activation_record.onboarding_run_id

    and step_key <>
      'activation'

    and is_required =
      true

    and status <>
      'complete'

  order by sort_order

  limit 1;


  if incomplete_step is not null then
    raise exception
      'Complete the % onboarding step before Activation.',
      incomplete_step;
  end if;


  -- ----------------------------------------------------------
  -- REAL BILLING GATE
  -- ----------------------------------------------------------

  if activation_record.billing_provider not in (
    'stripe',
    'manual'
  )
  or activation_record.subscription_status not in (
    'trial',
    'active'
  )
  then
    raise exception
      'Campaign Seat billing must be active before workspace Activation.';
  end if;


  -- ----------------------------------------------------------
  -- REAL OAUTH / PROVIDER GATE
  -- ----------------------------------------------------------

  select count(*)

  into pending_connection_count

  from public.seat_product_account_integrations
    as connection

  where
    connection.product_account_id =
      activation_record.product_account_id

    and coalesce(
      connection.connection_metadata
        ->> 'onboarding_selected',
      'false'
    ) = 'true'

    and connection.status <>
      'connected';


  if pending_connection_count > 0 then
    raise exception
      '% selected provider connection(s) still require authorization before Activation.',
      pending_connection_count;
  end if;


  -- ----------------------------------------------------------
  -- LOAD SAVED ONBOARDING SOURCE OF TRUTH
  -- ----------------------------------------------------------

  select step_data

  into profile_data

  from public.seat_onboarding_run_steps

  where
    onboarding_run_id =
      activation_record.onboarding_run_id

    and step_key =
      'product_profile'

  limit 1;


  select step_data

  into team_data

  from public.seat_onboarding_run_steps

  where
    onboarding_run_id =
      activation_record.onboarding_run_id

    and step_key =
      'team'

  limit 1;


  if
    profile_data is null
    or jsonb_typeof(
      profile_data
    ) <>
      'object'
  then
    raise exception
      'The saved Campaign Profile is unavailable.';
  end if;


  workspace_name :=
    btrim(
      coalesce(
        profile_data
          ->> 'campaign_name',
        activation_record.account_name,
        ''
      )
    );


  if workspace_name = '' then
    raise exception
      'The campaign workspace name is required.';
  end if;


  workspace_description :=
    nullif(
      concat_ws(
        ' · ',
        nullif(
          btrim(
            coalesce(
              profile_data
                ->> 'office_sought',
              ''
            )
          ),
          ''
        ),
        nullif(
          btrim(
            coalesce(
              profile_data
                ->> 'district_label',
              ''
            )
          ),
          ''
        )
      ),
      ''
    );


  workspace_location :=
    nullif(
      concat_ws(
        ', ',
        nullif(
          btrim(
            coalesce(
              profile_data
                ->> 'jurisdiction_name',
              ''
            )
          ),
          ''
        ),
        nullif(
          btrim(
            coalesce(
              profile_data
                ->> 'state_region',
              ''
            )
          ),
          ''
        )
      ),
      ''
    );


  -- ----------------------------------------------------------
  -- APPLY PRODUCT ENTITLEMENTS TO THE REAL WORKSPACE
  -- ----------------------------------------------------------

  select
    coalesce(
      jsonb_agg(
        module.module_key
        order by
          module.default_sort_order,
          module.module_key
      ),
      '[]'::jsonb
    )

  into enabled_modules

  from public.seat_entitlements
    as entitlement

  join public.seat_modules
    as module
    on module.id =
      entitlement.module_id

  where
    entitlement.product_account_id =
      activation_record.product_account_id

    and entitlement.enabled =
      true

    and (
      entitlement.expires_at
        is null

      or entitlement.expires_at >
        now()
    );


  if
    jsonb_array_length(
      enabled_modules
    ) = 0
  then
    raise exception
      'Campaign Seat module entitlements are unavailable.';
  end if;


  -- ----------------------------------------------------------
  -- CREATE REAL CAMPAIGN WORKSPACE
  -- ----------------------------------------------------------

  insert into public.workspaces (
    name,
    description,
    location,
    election_date,
    status,
    political_party,
    campaign_type,
    candidate_name,
    legal_committee_name,
    office_sought,
    office_level,
    district_label,
    jurisdiction_name,
    jurisdiction_type,
    primary_election_date,
    general_election_date,
    timezone,
    campaign_email,
    campaign_phone,
    website_url,
    campaign_address,
    disclaimer_text,
    onboarding_status,
    onboarding_current_step,
    onboarding_started_at,
    onboarding_completed_at,
    enabled_modules,
    setup_metadata,
    country_code,
    state_region,
    county_name,
    municipality_name,
    postal_code
  )
  values (
    workspace_name,

    workspace_description,

    workspace_location,

    nullif(
      profile_data
        ->> 'next_election_date',
      ''
    )::date,

    'active',

    coalesce(
      nullif(
        profile_data
          ->> 'political_party',
        ''
      ),
      'nonpartisan'
    ),

    coalesce(
      nullif(
        profile_data
          ->> 'campaign_type',
        ''
      ),
      'candidate_campaign'
    ),

    nullif(
      profile_data
        ->> 'candidate_name',
      ''
    ),

    nullif(
      profile_data
        ->> 'legal_committee_name',
      ''
    ),

    nullif(
      profile_data
        ->> 'office_sought',
      ''
    ),

    nullif(
      profile_data
        ->> 'office_level',
      ''
    ),

    nullif(
      profile_data
        ->> 'district_label',
      ''
    ),

    nullif(
      profile_data
        ->> 'jurisdiction_name',
      ''
    ),

    nullif(
      profile_data
        ->> 'jurisdiction_type',
      ''
    ),

    nullif(
      profile_data
        ->> 'primary_election_date',
      ''
    )::date,

    nullif(
      profile_data
        ->> 'general_election_date',
      ''
    )::date,

    nullif(
      profile_data
        ->> 'timezone',
      ''
    ),

    nullif(
      profile_data
        ->> 'campaign_email',
      ''
    ),

    nullif(
      profile_data
        ->> 'campaign_phone',
      ''
    ),

    nullif(
      profile_data
        ->> 'website_url',
      ''
    ),

    coalesce(
      profile_data
        -> 'campaign_address',
      '{}'::jsonb
    ),

    nullif(
      profile_data
        ->> 'disclaimer_text',
      ''
    ),

    'active',

    null,

    now(),

    now(),

    enabled_modules,

    jsonb_build_object(
      'seat_product_account_id',
      activation_record.product_account_id,

      'seat_onboarding_run_id',
      activation_record.onboarding_run_id,

      'seat_proposal_id',
      activation_record.proposal_id,

      'activated_by',
      actor_user_id,

      'activated_at',
      now(),

      'activation_source',
      'seat_client_onboarding'
    ),

    nullif(
      profile_data
        ->> 'country_code',
      ''
    ),

    nullif(
      profile_data
        ->> 'state_region',
      ''
    ),

    nullif(
      profile_data
        ->> 'county_name',
      ''
    ),

    nullif(
      profile_data
        ->> 'municipality_name',
      ''
    ),

    nullif(
      profile_data
        ->> 'postal_code',
      ''
    )
  )

  returning id
  into created_workspace_id;


  -- ----------------------------------------------------------
  -- CREATE CAMPAIGN OWNER
  --
  -- The existing workspace membership trigger intentionally
  -- blocks browser users from assigning Campaign Owner.
  -- This AAL2-protected Activation RPC performs the controlled
  -- system insertion.
  -- ----------------------------------------------------------

  select
    role.key,
    role.name,
    role.dashboard_type,
    role.seat_type

  into owner_role

  from public.campaign_roles
    as role

  where
    role.key =
      'campaign_owner'

    and role.is_active =
      true;


  if owner_role.key is null then
    raise exception
      'The Campaign Owner role is unavailable.';
  end if;


  perform set_config(
    'campaign_hq.accepting_invitation',
    'on',
    true
  );


  insert into public.workspace_members (
    workspace_id,
    user_id,
    role,
    status,
    role_key,
    display_title,
    seat_type,
    dashboard_type,
    membership_state,
    joined_at,
    is_primary_contact
  )
  values (
    created_workspace_id,
    actor_user_id,
    'client',
    'active',
    owner_role.key,
    coalesce(
      nullif(
        team_data
          -> 'primary_member'
          ->> 'display_title',
        ''
      ),
      'Candidate'
    ),
    owner_role.seat_type,
    owner_role.dashboard_type,
    'active',
    now(),
    true
  );


  perform set_config(
    'campaign_hq.accepting_invitation',
    'off',
    true
  );


  -- ----------------------------------------------------------
  -- PRODUCT ACCOUNT ↔ WORKSPACE BINDING
  -- ----------------------------------------------------------

  insert into public.seat_workspace_bindings (
    product_account_id,
    workspace_id,
    relationship_type,
    status,
    metadata
  )
  values (
    activation_record.product_account_id,
    created_workspace_id,
    'primary',
    'active',
    jsonb_build_object(
      'created_from_onboarding',
      true,

      'onboarding_run_id',
      activation_record.onboarding_run_id,

      'created_by',
      actor_user_id,

      'created_at',
      now()
    )
  );


  -- ----------------------------------------------------------
  -- BRIDGE EXISTING WORKSPACE SUBSCRIPTION SYSTEM
  -- ----------------------------------------------------------

  insert into public.workspace_subscriptions (
    workspace_id,
    plan_key,
    status,
    starts_at,
    trial_ends_at,
    external_customer_id,
    external_subscription_id,
    metadata
  )
  values (
    created_workspace_id,

    'campaign_seat',

    activation_record.subscription_status,

    now(),

    activation_record.trial_ends_at,

    activation_record.external_customer_id,

    activation_record.external_subscription_id,

    jsonb_build_object(
      'seat_product_account_id',
      activation_record.product_account_id,

      'seat_subscription_id',
      activation_record.subscription_id,

      'package_name',
      activation_record.package_name_snapshot,

      'included_user_seats',
      activation_record.included_user_seats,

      'source',
      'seat_client_activation'
    )
  )

  on conflict (
    workspace_id
  )
  do update
  set
    plan_key =
      excluded.plan_key,

    status =
      excluded.status,

    starts_at =
      excluded.starts_at,

    trial_ends_at =
      excluded.trial_ends_at,

    external_customer_id =
      excluded.external_customer_id,

    external_subscription_id =
      excluded.external_subscription_id,

    metadata =
      coalesce(
        public.workspace_subscriptions.metadata,
        '{}'::jsonb
      ) ||
      excluded.metadata,

    updated_at =
      now();


  -- ----------------------------------------------------------
  -- ASSIGN REAL WORKSPACE TO CONNECTED INTEGRATIONS
  -- ----------------------------------------------------------

  update
  public.seat_product_account_integrations
  set
    workspace_id =
      created_workspace_id,

    updated_at =
      now()

  where
    product_account_id =
      activation_record.product_account_id;


  -- ----------------------------------------------------------
  -- MARK THE OLD WORKSPACE SETUP CHECKLIST COMPLETE
  --
  -- The new secure client onboarding has already collected and
  -- validated the required information. Do not force the client
  -- through a second setup wizard.
  -- ----------------------------------------------------------

  update public.workspace_onboarding_steps
  set
    status =
      'complete',

    completed_at =
      coalesce(
        completed_at,
        now()
      ),

    completed_by =
      coalesce(
        completed_by,
        actor_user_id
      ),

    metadata =
      coalesce(
        metadata,
        '{}'::jsonb
      ) ||
      jsonb_build_object(
        'completed_by_seat_client_onboarding',
        true,

        'seat_onboarding_run_id',
        activation_record.onboarding_run_id
      ),

    updated_at =
      now()

  where
    workspace_id =
      created_workspace_id

    and is_required =
      true;


  -- ----------------------------------------------------------
  -- PREPARE LAUNCH TEAM INVITATIONS
  -- ----------------------------------------------------------

  planned_member_count :=
    jsonb_array_length(
      coalesce(
        team_data
          -> 'planned_members',
        '[]'::jsonb
      )
    );


  included_user_seats :=
    activation_record.included_user_seats;


  if
    included_user_seats is not null

    and (
      planned_member_count + 1
    ) >
      included_user_seats
  then
    raise exception
      'The launch team exceeds the % included Campaign Seat user seats.',
      included_user_seats;
  end if;


  for member_record in
    select value
    from jsonb_array_elements(
      coalesce(
        team_data
          -> 'planned_members',
        '[]'::jsonb
      )
    )
  loop

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


    member_display_title :=
      nullif(
        btrim(
          coalesce(
            member_record
              ->> 'display_title',
            ''
          )
        ),
        ''
      );


    if
      member_email = ''
      or position(
        '@' in member_email
      ) <= 1
    then
      raise exception
        'A planned launch-team email is invalid.';
    end if;


    if member_email =
      activation_record.contact_email
    then
      raise exception
        'The Campaign Owner cannot also be a planned team invitation.';
    end if;


    select
      role.key,
      role.name,
      role.seat_type

    into invitation_role

    from public.campaign_roles
      as role

    where
      role.key =
        member_role_key

      and role.is_active =
        true

      and role.key <>
        'campaign_owner';


    if invitation_role.key is null then
      raise exception
        'A planned launch-team role is unavailable: %',
        member_role_key;
    end if;


    raw_token :=
      encode(
        gen_random_bytes(32),
        'hex'
      );


    stored_hash :=
      encode(
        digest(
          raw_token,
          'sha256'
        ),
        'hex'
      );


    invitation_expires_at :=
      now() +
      interval '7 days';


    insert into public.workspace_invitations (
      workspace_id,
      email,
      role_key,
      seat_type,
      display_title,
      invited_by,
      token_hash,
      status,
      expires_at
    )
    values (
      created_workspace_id,
      member_email,
      invitation_role.key,
      invitation_role.seat_type,
      member_display_title,
      actor_user_id,
      stored_hash,
      'pending',
      invitation_expires_at
    )

    returning id
    into invitation_id;


    team_invitations :=
      team_invitations ||
      jsonb_build_array(
        jsonb_build_object(
          'invitation_id',
          invitation_id,

          'invitation_token',
          raw_token,

          'invitation_expires_at',
          invitation_expires_at,

          'email',
          member_email,

          'full_name',
          member_name,

          'role_key',
          invitation_role.key,

          'role_name',
          invitation_role.name
        )
      );

  end loop;


  -- ----------------------------------------------------------
  -- FINALIZE PRODUCT ACCOUNT + ONBOARDING
  -- ----------------------------------------------------------

  update public.seat_product_accounts
  set
    status =
      'active',

    onboarding_status =
      'complete',

    activated_at =
      now(),

    metadata =
      coalesce(
        metadata,
        '{}'::jsonb
      ) ||
      jsonb_build_object(
        'primary_workspace_id',
        created_workspace_id,

        'activated_by',
        actor_user_id,

        'activated_at',
        now()
      ),

    updated_at =
      now()

  where id =
    activation_record.product_account_id;


  update public.seat_onboarding_run_steps
  set
    status =
      'complete',

    completed_at =
      now(),

    completed_by_user_id =
      actor_user_id,

    step_data =
      coalesce(
        step_data,
        '{}'::jsonb
      ) ||
      jsonb_build_object(
        'workspace_id',
        created_workspace_id,

        'activated_at',
        now(),

        'planned_team_invitation_count',
        planned_member_count
      ),

    updated_at =
      now()

  where
    onboarding_run_id =
      activation_record.onboarding_run_id

    and step_key =
      'activation';


  update public.seat_onboarding_runs
  set
    status =
      'complete',

    current_step_key =
      'activation',

    completed_at =
      now(),

    metadata =
      coalesce(
        metadata,
        '{}'::jsonb
      ) ||
      jsonb_build_object(
        'workspace_id',
        created_workspace_id,

        'activated_by',
        actor_user_id,

        'activated_at',
        now()
      ),

    updated_at =
      now()

  where id =
    activation_record.onboarding_run_id;


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
    'campaign_seat_workspace_activated',
    'notice',
    activation_record.customer_id,
    'workspace',
    created_workspace_id::text,

    jsonb_build_object(
      'product_account_id',
      activation_record.product_account_id,

      'onboarding_run_id',
      activation_record.onboarding_run_id,

      'subscription_id',
      activation_record.subscription_id,

      'planned_team_invitation_count',
      planned_member_count
    ),

    now()
  );


  return jsonb_build_object(
    'ok',
    true,

    'already_active',
    false,

    'workspace_id',
    created_workspace_id,

    'workspace_name',
    workspace_name,

    'team_invitations',
    team_invitations
  );
end;
$seat_activate_campaign$;


revoke all
on function
public.activate_my_campaign_seat()
from
  public,
  anon;


grant execute
on function
public.activate_my_campaign_seat()
to authenticated;


notify pgrst, 'reload schema';

commit;

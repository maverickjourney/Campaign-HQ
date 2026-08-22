-- ============================================================
-- SEAT PLATFORM
-- FIX APPROVED CLIENT PROVISIONING COLUMN AMBIGUITY
--
-- The function returns product_account_id as an OUT parameter.
-- Seat commercial tables also contain product_account_id columns.
-- PostgreSQL therefore rejected unqualified column references.
--
-- This compiler directive applies ONLY to this function and tells
-- PL/pgSQL that ambiguous SQL identifiers resolve to table columns.
-- The function's authorization, MFA gate, token security and
-- provisioning behavior remain unchanged.
-- ============================================================

begin;

create or replace function
public.provision_approved_seat_proposal(
  target_proposal_id uuid,
  target_role_key text default 'account_owner',
  expires_in_hours integer default 72
)
returns table (
  product_account_id uuid,
  onboarding_run_id uuid,
  invitation_id uuid,
  invitation_token text,
  invitation_email text,
  invitation_expires_at timestamptz,
  existing_user boolean
)
language plpgsql
security definer
set search_path =
  public,
  private,
  extensions,
  auth,
  pg_temp
as $seat_provision$
#variable_conflict use_column
declare
  actor_user_id uuid :=
    auth.uid();

  normalized_role_key text :=
    lower(
      btrim(
        coalesce(
          target_role_key,
          ''
        )
      )
    );

  proposal_record record;
  contact_record
    public.seat_customer_contacts%rowtype;

  existing_auth_user_id uuid;

  account_id uuid;
  run_id uuid;
  invite_id uuid;

  invite_token text;
  invite_hash text;
  invite_expiration timestamptz;

  package_name text;

  included_seats integer;

  user_already_exists boolean :=
    false;
begin

  if actor_user_id is null then
    raise exception
      'A signed-in Seat Platform Admin session is required.'
      using errcode = '42501';
  end if;


  if not
    public.seat_platform_admin_authorized()
  then
    raise exception
      'Platform Owner or Platform Admin MFA authorization is required.'
      using errcode = '42501';
  end if;


  if normalized_role_key !~
    '^[a-z][a-z0-9_]{1,63}$'
  then
    raise exception
      'Initial account role is invalid.';
  end if;


  if
    expires_in_hours < 1
    or expires_in_hours > 168
  then
    raise exception
      'Onboarding invitations must expire between 1 and 168 hours.';
  end if;


  select
    proposal.*,
    customer.display_name
      as customer_name,
    product.product_name,
    deal.id as deal_id
  into proposal_record
  from public.seat_proposals proposal
  join public.seat_customers customer
    on customer.id =
      proposal.customer_id
  join public.seat_products product
    on product.id =
      proposal.product_id
  join public.seat_deals deal
    on deal.id =
      proposal.deal_id
  where proposal.id =
    target_proposal_id
  for update of proposal;


  if proposal_record.id is null then
    raise exception
      'Approved proposal was not found.';
  end if;


  if proposal_record.status <>
    'approved'
  then
    raise exception
      'Only an approved proposal can enter onboarding.';
  end if;


  select contact.*
  into contact_record
  from public.seat_customer_contacts
    as contact
  where
    contact.customer_id =
      proposal_record.customer_id
    and lower(
      btrim(contact.email)
    ) =
      lower(
        btrim(
          proposal_record.client_email
        )
      )
    and contact.status =
      'active'
  order by
    contact.is_primary desc,
    contact.created_at
  limit 1;


  if not found then
    select contact.*
    into contact_record
    from public.seat_customer_contacts
      as contact
    where
      contact.customer_id =
        proposal_record.customer_id
      and contact.is_primary =
        true
      and contact.status =
        'active'
    limit 1;
  end if;


  if contact_record.id is null then
    raise exception
      'The approved customer does not have an active onboarding contact.';
  end if;


  select auth_user.id
  into existing_auth_user_id
  from auth.users auth_user
  where lower(
    btrim(auth_user.email)
  ) =
    lower(
      btrim(
        contact_record.email
      )
    )
  limit 1;


  if existing_auth_user_id is not null then
    user_already_exists := true;

    if
      contact_record.user_id is not null
      and contact_record.user_id <>
        existing_auth_user_id
    then
      raise exception
        'The customer contact is already linked to another Auth identity.';
    end if;

    update public.seat_customer_contacts
    set
      user_id =
        existing_auth_user_id,
      metadata =
        metadata ||
        jsonb_build_object(
          'requested_role_key',
          normalized_role_key
        ),
      updated_at =
        now()
    where id =
      contact_record.id;
  end if;


  begin
    included_seats :=
      nullif(
        proposal_record.metadata
          ->> 'included_user_seats',
        ''
      )::integer;
  exception
    when invalid_text_representation then
      included_seats := null;
  end;


  if proposal_record.package_id is not null then
    select package.display_name
    into package_name
    from public.seat_packages package
    where package.id =
      proposal_record.package_id;
  end if;


  select account.id
  into account_id
  from public.seat_product_accounts
    as account
  where account.proposal_id =
    proposal_record.id
  limit 1
  for update;


  if account_id is null then
    insert into
    public.seat_product_accounts (
      customer_id,
      product_id,
      proposal_id,
      account_name,
      primary_contact_id,
      status,
      onboarding_status,
      metadata,
      created_by
    )
    values (
      proposal_record.customer_id,
      proposal_record.product_id,
      proposal_record.id,
      proposal_record.customer_name,
      contact_record.id,
      case
        when user_already_exists
        then 'onboarding'
        else 'pending_onboarding'
      end,
      case
        when user_already_exists
        then 'in_progress'
        else 'not_started'
      end,
      jsonb_build_object(
        'proposal_code',
        proposal_record.proposal_code,
        'requested_role_key',
        normalized_role_key,
        'dashboard_config',
        proposal_record.dashboard_config,
        'onboarding_config',
        proposal_record.onboarding_config
      ),
      actor_user_id
    )
    returning id
    into account_id;
  else
    update public.seat_product_accounts
    set
      account_name =
        proposal_record.customer_name,
      primary_contact_id =
        contact_record.id,
      metadata =
        metadata ||
        jsonb_build_object(
          'proposal_code',
          proposal_record.proposal_code,
          'requested_role_key',
          normalized_role_key,
          'dashboard_config',
          proposal_record.dashboard_config,
          'onboarding_config',
          proposal_record.onboarding_config
        ),
      updated_at =
        now()
    where id =
      account_id;
  end if;


  insert into
  public.seat_subscriptions (
    product_account_id,
    package_id,
    package_name_snapshot,
    billing_provider,
    status,
    currency,
    monthly_amount_cents,
    annual_amount_cents,
    onboarding_fee_cents,
    included_user_seats,
    metadata
  )
  values (
    account_id,
    proposal_record.package_id,
    coalesce(
      package_name,
      proposal_record.product_name ||
        ' Custom'
    ),
    'pending',
    'pending_billing',
    proposal_record.currency,
    proposal_record.monthly_total_cents,
    proposal_record.annual_total_cents,
    proposal_record.setup_total_cents,
    included_seats,
    jsonb_build_object(
      'proposal_id',
      proposal_record.id,
      'proposal_code',
      proposal_record.proposal_code,
      'billing_state',
      'awaiting_provider'
    )
  )
  on conflict (
    product_account_id
  )
  do update
  set
    package_id =
      excluded.package_id,
    package_name_snapshot =
      excluded.package_name_snapshot,
    currency =
      excluded.currency,
    monthly_amount_cents =
      excluded.monthly_amount_cents,
    annual_amount_cents =
      excluded.annual_amount_cents,
    onboarding_fee_cents =
      excluded.onboarding_fee_cents,
    included_user_seats =
      excluded.included_user_seats,
    metadata =
      public.seat_subscriptions.metadata ||
      excluded.metadata,
    updated_at =
      now();


  insert into
  public.seat_entitlements (
    product_account_id,
    module_id,
    enabled,
    source_type,
    source_reference,
    metadata
  )
  select
    account_id,
    item.module_id,
    true,
    'proposal',
    proposal_record.proposal_code,
    jsonb_build_object(
      'proposal_item_id',
      item.id
    )
  from public.seat_proposal_items item
  where
    item.proposal_id =
      proposal_record.id
    and item.item_type =
      'module'
    and item.module_id
      is not null
  on conflict (
    product_account_id,
    module_id
  )
  do update
  set
    enabled =
      true,
    source_type =
      'proposal',
    source_reference =
      proposal_record.proposal_code,
    metadata =
      public.seat_entitlements.metadata ||
      excluded.metadata,
    updated_at =
      now();


  select onboarding.id
  into run_id
  from public.seat_onboarding_runs
    as onboarding
  where
    onboarding.product_account_id =
      account_id
    and onboarding.status <>
      'cancelled'
  limit 1
  for update;


  if run_id is null then
    insert into
    public.seat_onboarding_runs (
      product_account_id,
      proposal_id,
      assigned_contact_id,
      status,
      current_step_key,
      started_at,
      metadata
    )
    values (
      account_id,
      proposal_record.id,
      contact_record.id,
      case
        when user_already_exists
        then 'in_progress'
        else 'not_started'
      end,
      case
        when user_already_exists
        then 'product_profile'
        else 'account_setup'
      end,
      case
        when user_already_exists
        then now()
        else null
      end,
      jsonb_build_object(
        'requested_role_key',
        normalized_role_key,
        'product_key',
        proposal_record.product_id,
        'proposal_code',
        proposal_record.proposal_code
      )
    )
    returning id
    into run_id;
  end if;


  insert into
  public.seat_onboarding_run_steps (
    onboarding_run_id,
    step_key,
    sort_order,
    display_name,
    owner_type,
    is_required,
    status,
    step_data
  )
  values
    (
      run_id,
      'account_setup',
      10,
      'Secure account',
      'client',
      true,
      case
        when user_already_exists
        then 'complete'
        else 'pending'
      end,
      '{}'::jsonb
    ),
    (
      run_id,
      'product_profile',
      20,
      'Campaign profile',
      'client',
      true,
      case
        when user_already_exists
        then 'in_progress'
        else 'pending'
      end,
      '{}'::jsonb
    ),
    (
      run_id,
      'security',
      30,
      'Security',
      'client',
      true,
      'pending',
      '{}'::jsonb
    ),
    (
      run_id,
      'billing',
      40,
      'Billing',
      'shared',
      true,
      'pending',
      '{}'::jsonb
    ),
    (
      run_id,
      'integrations',
      50,
      'Integrations',
      'client',
      false,
      'pending',
      proposal_record.onboarding_config
    ),
    (
      run_id,
      'team',
      60,
      'Team & access',
      'client',
      false,
      'pending',
      '{}'::jsonb
    ),
    (
      run_id,
      'review',
      70,
      'Review',
      'shared',
      true,
      'pending',
      '{}'::jsonb
    ),
    (
      run_id,
      'activation',
      80,
      'Activation',
      'seat_admin',
      true,
      'pending',
      '{}'::jsonb
    )
  on conflict (
    onboarding_run_id,
    step_key
  )
  do nothing;


  update public.seat_customers
  set
    status =
      'onboarding',
    updated_at =
      now()
  where id =
    proposal_record.customer_id;


  update public.seat_deals
  set
    stage =
      'onboarding',
    updated_at =
      now()
  where id =
    proposal_record.deal_id;


  if user_already_exists then

    update public.seat_product_accounts
    set
      status =
        'onboarding',
      onboarding_status =
        'in_progress',
      metadata =
        metadata ||
        jsonb_build_object(
          'initial_user_id',
          existing_auth_user_id
        ),
      updated_at =
        now()
    where id =
      account_id;


    update public.seat_onboarding_runs
    set
      status =
        'in_progress',
      current_step_key =
        'product_profile',
      started_at =
        coalesce(
          started_at,
          now()
        ),
      updated_at =
        now()
    where id =
      run_id;


    invite_id := null;
    invite_token := null;
    invite_expiration := null;

  else

    update
    private.seat_onboarding_invitations
    set
      status =
        'cancelled',
      cancelled_at =
        now(),
      updated_at =
        now()
    where
      product_account_id =
        account_id
      and status =
        'pending';


    invite_token :=
      encode(
        extensions.gen_random_bytes(32),
        'hex'
      );


    invite_hash :=
      encode(
        extensions.digest(
          invite_token,
          'sha256'
        ),
        'hex'
      );


    invite_expiration :=
      now() +
      make_interval(
        hours =>
          expires_in_hours
      );


    insert into
    private.seat_onboarding_invitations (
      product_account_id,
      customer_id,
      contact_id,
      proposal_id,
      email,
      requested_role_key,
      token_hash,
      status,
      expires_at,
      invited_by,
      metadata
    )
    values (
      account_id,
      proposal_record.customer_id,
      contact_record.id,
      proposal_record.id,
      lower(
        btrim(
          contact_record.email
        )
      ),
      normalized_role_key,
      invite_hash,
      'pending',
      invite_expiration,
      actor_user_id,
      jsonb_build_object(
        'proposal_code',
        proposal_record.proposal_code,
        'product_name',
        proposal_record.product_name
      )
    )
    returning id
    into invite_id;

  end if;


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
    'seat_approved_proposal_provisioned',
    'notice',
    proposal_record.customer_id,
    'seat_product_account',
    account_id::text,
    jsonb_build_object(
      'proposal_id',
      proposal_record.id,
      'proposal_code',
      proposal_record.proposal_code,
      'onboarding_run_id',
      run_id,
      'existing_user',
      user_already_exists,
      'requested_role_key',
      normalized_role_key
    ),
    now()
  );


  return query
  select
    account_id,
    run_id,
    invite_id,
    invite_token,
    lower(
      btrim(
        contact_record.email
      )
    ),
    invite_expiration,
    user_already_exists;
end;
$seat_provision$;


revoke all
on function
public.provision_approved_seat_proposal(
  uuid,
  text,
  integer
)
from
  public,
  anon;


grant execute
on function
public.provision_approved_seat_proposal(
  uuid,
  text,
  integer
)
to authenticated;


notify pgrst, 'reload schema';

commit;

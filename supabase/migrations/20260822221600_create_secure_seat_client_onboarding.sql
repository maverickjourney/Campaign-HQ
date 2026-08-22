begin;

-- ============================================================
-- PRIVATE SEAT CLIENT ONBOARDING INVITATIONS
--
-- Separate from:
--   workspace invitations -> team access to an existing workspace
--   platform staff invites -> Seat Platform administration
--
-- This invitation represents:
--   approved customer -> initial Seat account -> product onboarding
--
-- Plaintext invitation tokens are NEVER stored.
-- ============================================================

create table
private.seat_onboarding_invitations (
  id uuid primary key
    default gen_random_uuid(),

  product_account_id uuid not null
    references public.seat_product_accounts(id)
    on delete cascade,

  customer_id uuid not null
    references public.seat_customers(id)
    on delete restrict,

  contact_id uuid not null
    references public.seat_customer_contacts(id)
    on delete restrict,

  proposal_id uuid not null
    references public.seat_proposals(id)
    on delete restrict,

  email text not null,

  requested_role_key text not null
    default 'account_owner',

  token_hash text not null unique,

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
    seat_onboarding_invitation_email_check
  check (
    btrim(email) <> ''
    and position('@' in email) > 1
  ),

  constraint
    seat_onboarding_invitation_role_check
  check (
    requested_role_key ~
      '^[a-z][a-z0-9_]{1,63}$'
  ),

  constraint
    seat_onboarding_invitation_status_check
  check (
    status in (
      'pending',
      'accepted',
      'cancelled',
      'expired'
    )
  ),

  constraint
    seat_onboarding_invitation_metadata_check
  check (
    jsonb_typeof(metadata) =
      'object'
  ),

  constraint
    seat_onboarding_invitation_acceptance_check
  check (
    status <> 'accepted'
    or (
      accepted_by is not null
      and accepted_at is not null
    )
  )
);


create unique index
seat_onboarding_pending_account_unique
on private.seat_onboarding_invitations (
  product_account_id
)
where status = 'pending';


create index
seat_onboarding_invitation_expiry_idx
on private.seat_onboarding_invitations (
  status,
  expires_at
);


create unique index
if not exists
seat_product_accounts_proposal_unique
on public.seat_product_accounts (
  proposal_id
)
where proposal_id is not null;


create unique index
if not exists
seat_onboarding_active_run_unique
on public.seat_onboarding_runs (
  product_account_id
)
where status <> 'cancelled';


alter table
private.seat_onboarding_invitations
enable row level security;


revoke all
on table
private.seat_onboarding_invitations
from
  public,
  anon,
  authenticated;


grant
  select,
  insert,
  update,
  delete
on table
private.seat_onboarding_invitations
to service_role;


grant usage
on schema private
to supabase_auth_admin;


grant select
on table
private.seat_onboarding_invitations
to supabase_auth_admin;


create policy
"Auth hook may inspect Seat onboarding invitations"
on private.seat_onboarding_invitations
for select
to supabase_auth_admin
using (true);


create trigger
seat_onboarding_invitations_set_updated_at
before update
on private.seat_onboarding_invitations
for each row
execute function
public.set_campaign_updated_at();


-- ============================================================
-- ADMIN: PROVISION AN APPROVED PROPOSAL
-- ============================================================

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


-- ============================================================
-- TOKEN-SCOPED ONBOARDING INVITATION LOOKUP
-- ============================================================

create or replace function
public.get_seat_onboarding_invitation_by_token(
  target_token text
)
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  extensions,
  pg_temp
as $seat_onboarding_lookup$
declare
  token_hash_value text;
  invitation_record record;
begin

  if char_length(
    btrim(
      coalesce(
        target_token,
        ''
      )
    )
  ) < 32 then
    return jsonb_build_object(
      'found',
      false
    );
  end if;


  token_hash_value :=
    encode(
      extensions.digest(
        btrim(target_token),
        'sha256'
      ),
      'hex'
    );


  select
    invitation.id,
    invitation.email,
    invitation.requested_role_key,
    invitation.status,
    invitation.expires_at,
    contact.full_name,
    account.account_name,
    product.product_name,
    proposal.proposal_code
  into invitation_record
  from private.seat_onboarding_invitations
    as invitation
  join public.seat_customer_contacts
    as contact
    on contact.id =
      invitation.contact_id
  join public.seat_product_accounts
    as account
    on account.id =
      invitation.product_account_id
  join public.seat_products
    as product
    on product.id =
      account.product_id
  join public.seat_proposals
    as proposal
    on proposal.id =
      invitation.proposal_id
  where invitation.token_hash =
    token_hash_value
  limit 1;


  if invitation_record.id is null then
    return jsonb_build_object(
      'found',
      false
    );
  end if;


  if
    invitation_record.status =
      'pending'
    and invitation_record.expires_at <=
      now()
  then
    update
    private.seat_onboarding_invitations
    set
      status =
        'expired',
      updated_at =
        now()
    where id =
      invitation_record.id;

    return jsonb_build_object(
      'found',
      false,
      'expired',
      true
    );
  end if;


  if invitation_record.status <>
    'pending'
  then
    return jsonb_build_object(
      'found',
      false,
      'used',
      true
    );
  end if;


  return jsonb_build_object(
    'found',
    true,
    'email',
    invitation_record.email,
    'full_name',
    invitation_record.full_name,
    'account_name',
    invitation_record.account_name,
    'product_name',
    invitation_record.product_name,
    'proposal_code',
    invitation_record.proposal_code,
    'requested_role_key',
    invitation_record.requested_role_key,
    'expires_at',
    invitation_record.expires_at
  );
end;
$seat_onboarding_lookup$;


revoke all
on function
public.get_seat_onboarding_invitation_by_token(
  text
)
from public;


grant execute
on function
public.get_seat_onboarding_invitation_by_token(
  text
)
to
  anon,
  authenticated;


-- ============================================================
-- AUTH HOOK
--
-- Existing invitation paths remain supported:
--   * workspace invitation
--   * Platform Staff invitation
--
-- New Seat onboarding accounts additionally require:
--   * matching email
--   * pending unexpired onboarding invitation
--   * SHA-256 invitation credential supplied at signup
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

  onboarding_invitation_hash text :=
    lower(
      btrim(
        coalesce(
          event
            -> 'user'
            -> 'user_metadata'
            ->> 'seat_onboarding_invitation_hash',
          ''
        )
      )
    );

  valid_workspace_invitation boolean :=
    false;

  valid_platform_invitation boolean :=
    false;

  valid_onboarding_invitation boolean :=
    false;
begin

  if signup_provider <>
    'email'
  then
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


  if onboarding_invitation_hash ~
    '^[0-9a-f]{64}$'
  then
    select exists (
      select 1
      from private.seat_onboarding_invitations
        as invitation
      where
        lower(
          btrim(
            invitation.email
          )
        ) =
          candidate_email
        and invitation.token_hash =
          onboarding_invitation_hash
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
      valid_onboarding_invitation;
  end if;


  if not (
    valid_workspace_invitation
    or valid_platform_invitation
    or valid_onboarding_invitation
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


-- ============================================================
-- ACTIVATE CLIENT ONBOARDING AFTER AUTH USER CREATION
-- ============================================================

create or replace function
private.activate_seat_onboarding_invitation()
returns trigger
language plpgsql
security definer
set search_path =
  public,
  private,
  auth,
  pg_temp
as $seat_onboarding_activation$
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

  onboarding_hash text :=
    lower(
      btrim(
        coalesce(
          new.raw_user_meta_data
            ->> 'seat_onboarding_invitation_hash',
          ''
        )
      )
    );

  invitation_record
    private.seat_onboarding_invitations%rowtype;

  run_id uuid;
begin

  if
    candidate_email = ''
    or onboarding_hash !~
      '^[0-9a-f]{64}$'
  then
    return new;
  end if;


  select invitation.*
  into invitation_record
  from private.seat_onboarding_invitations
    as invitation
  where
    lower(
      btrim(
        invitation.email
      )
    ) =
      candidate_email
    and invitation.token_hash =
      onboarding_hash
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
    raise exception
      'Seat onboarding invitation could not be verified.';
  end if;


  if exists (
    select 1
    from public.seat_customer_contacts
      as contact
    where
      contact.id =
        invitation_record.contact_id
      and contact.user_id
        is not null
      and contact.user_id <>
        new.id
  ) then
    raise exception
      'Seat onboarding contact is already linked to another account.';
  end if;


  update public.seat_customer_contacts
  set
    user_id =
      new.id,
    metadata =
      metadata ||
      jsonb_build_object(
        'requested_role_key',
        invitation_record.requested_role_key,
        'onboarding_invitation_id',
        invitation_record.id
      ),
    updated_at =
      now()
  where id =
    invitation_record.contact_id;


  update
  private.seat_onboarding_invitations
  set
    status =
      'accepted',
    accepted_by =
      new.id,
    accepted_at =
      now(),
    updated_at =
      now()
  where id =
    invitation_record.id;


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
        new.id,
        'requested_role_key',
        invitation_record.requested_role_key
      ),
    updated_at =
      now()
  where id =
    invitation_record.product_account_id;


  select onboarding.id
  into run_id
  from public.seat_onboarding_runs
    as onboarding
  where
    onboarding.product_account_id =
      invitation_record.product_account_id
    and onboarding.status <>
      'cancelled'
  order by
    onboarding.created_at desc
  limit 1
  for update;


  if run_id is not null then

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


    update public.seat_onboarding_run_steps
    set
      status =
        'complete',
      completed_at =
        coalesce(
          completed_at,
          now()
        ),
      completed_by_user_id =
        coalesce(
          completed_by_user_id,
          new.id
        ),
      updated_at =
        now()
    where
      onboarding_run_id =
        run_id
      and step_key =
        'account_setup';


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
        run_id
      and step_key =
        'product_profile'
      and status =
        'pending';

  end if;


  -- Remove the one-time invitation credential from persistent
  -- user-editable metadata immediately after successful creation.
  update auth.users
  set
    raw_user_meta_data =
      coalesce(
        raw_user_meta_data,
        '{}'::jsonb
      ) -
      'seat_onboarding_invitation_hash'
  where id =
    new.id;


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
    new.id,
    'seat_onboarding_invitation_accepted',
    'notice',
    invitation_record.customer_id,
    'seat_product_account',
    invitation_record.product_account_id::text,
    jsonb_build_object(
      'invitation_id',
      invitation_record.id,
      'proposal_id',
      invitation_record.proposal_id,
      'requested_role_key',
      invitation_record.requested_role_key
    ),
    now()
  );


  return new;
end;
$seat_onboarding_activation$;


revoke all
on function
private.activate_seat_onboarding_invitation()
from
  public,
  anon,
  authenticated,
  supabase_auth_admin;


drop trigger if exists
seat_activate_client_onboarding_invitation
on auth.users;


create trigger
seat_activate_client_onboarding_invitation
after insert
on auth.users
for each row
execute function
private.activate_seat_onboarding_invitation();


-- ============================================================
-- AUTHENTICATED CLIENT: GET MY ACTIVE ONBOARDING
-- ============================================================

create or replace function
public.get_my_seat_onboarding()
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $seat_my_onboarding$
declare
  actor_user_id uuid :=
    auth.uid();

  onboarding_record record;

  step_data jsonb;
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
    account.account_name,
    account.status
      as account_status,
    account.onboarding_status,
    product.product_name,
    onboarding.id
      as onboarding_run_id,
    onboarding.status
      as onboarding_run_status,
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
  left join lateral (
    select run.*
    from public.seat_onboarding_runs run
    where
      run.product_account_id =
        account.id
      and run.status <>
        'cancelled'
    order by
      run.created_at desc
    limit 1
  ) onboarding
    on true
  where
    contact.user_id =
      actor_user_id
    and contact.status =
      'active'
    and account.status in (
      'pending_onboarding',
      'onboarding',
      'active'
    )
  order by
    account.created_at desc
  limit 1;


  if onboarding_record.product_account_id
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
          'step_key',
          step.step_key,
          'sort_order',
          step.sort_order,
          'display_name',
          step.display_name,
          'owner_type',
          step.owner_type,
          'is_required',
          step.is_required,
          'status',
          step.status
        )
        order by
          step.sort_order
      ),
      '[]'::jsonb
    )
  into step_data
  from public.seat_onboarding_run_steps
    as step
  where step.onboarding_run_id =
    onboarding_record.onboarding_run_id;


  return jsonb_build_object(
    'found',
    true,
    'full_name',
    onboarding_record.full_name,
    'email',
    onboarding_record.email,
    'product_account_id',
    onboarding_record.product_account_id,
    'account_name',
    onboarding_record.account_name,
    'account_status',
    onboarding_record.account_status,
    'onboarding_status',
    onboarding_record.onboarding_status,
    'product_name',
    onboarding_record.product_name,
    'onboarding_run_id',
    onboarding_record.onboarding_run_id,
    'onboarding_run_status',
    onboarding_record.onboarding_run_status,
    'current_step_key',
    onboarding_record.current_step_key,
    'steps',
    step_data
  );
end;
$seat_my_onboarding$;


revoke all
on function
public.get_my_seat_onboarding()
from
  public,
  anon;


grant execute
on function
public.get_my_seat_onboarding()
to authenticated;


notify pgrst, 'reload schema';

commit;

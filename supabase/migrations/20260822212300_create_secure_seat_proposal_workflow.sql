begin;

-- ============================================================
-- CREATE / VERSION A PROPOSAL DRAFT
-- ============================================================

create or replace function
public.create_seat_proposal_draft(
  target_deal_code text,
  target_customer_display_name text,
  target_client_name text,
  target_client_email text,
  target_monthly_cents integer,
  target_setup_cents integer,
  target_contract_term_months integer default null,
  target_valid_days integer default 7,
  target_terms_summary jsonb default '{}'::jsonb
)
returns table (
  proposal_id uuid,
  proposal_code text,
  proposal_version integer
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $seat_proposal$
declare
  actor_user_id uuid := auth.uid();

  normalized_deal_code text :=
    upper(btrim(coalesce(target_deal_code, '')));

  normalized_customer_name text :=
    btrim(coalesce(target_customer_display_name, ''));

  normalized_client_name text :=
    btrim(coalesce(target_client_name, ''));

  normalized_client_email text :=
    lower(btrim(coalesce(target_client_email, '')));

  deal_record record;

  selected_package_id uuid;
  next_version integer;

  created_proposal_id uuid;
  created_proposal_code text;

  requested_modules jsonb;
  requested_integrations jsonb;
  requested_addons jsonb;
  dashboard_emphasis jsonb;

  included_seats integer;
  data_import_required boolean;
  custom_setup_required boolean;
begin
  if actor_user_id is null then
    raise exception
      'A signed-in Seat Platform session is required.'
      using errcode = '42501';
  end if;

  if not public.seat_platform_admin_authorized() then
    raise exception
      'Platform Owner or Platform Admin MFA authorization is required.'
      using errcode = '42501';
  end if;

  if normalized_deal_code = '' then
    raise exception 'Deal code is required.';
  end if;

  if normalized_customer_name = '' then
    raise exception 'Customer / organization name is required.';
  end if;

  if normalized_client_name = '' then
    raise exception 'Client contact name is required.';
  end if;

  if
    normalized_client_email = ''
    or position('@' in normalized_client_email) <= 1
  then
    raise exception 'A valid client email is required.';
  end if;

  if
    target_monthly_cents < 0
    or target_setup_cents < 0
  then
    raise exception 'Pricing cannot be negative.';
  end if;

  if
    target_contract_term_months is not null
    and target_contract_term_months < 0
  then
    raise exception 'Contract term cannot be negative.';
  end if;

  if target_valid_days < 1 or target_valid_days > 30 then
    raise exception
      'Proposal validity must be between 1 and 30 days.';
  end if;

  if
    target_terms_summary is null
    or jsonb_typeof(target_terms_summary) <> 'object'
  then
    raise exception 'Proposal terms must be a JSON object.';
  end if;

  select
    deal.id as deal_id,
    deal.customer_id,
    deal.product_id,
    deal.currency,
    deal.metadata,
    product.product_name,
    customer.display_name as customer_name
  into deal_record
  from public.seat_deals deal
  join public.seat_customers customer
    on customer.id = deal.customer_id
  join public.seat_products product
    on product.id = deal.product_id
  where deal.deal_code = normalized_deal_code
  for update of deal;

  if deal_record.deal_id is null then
    raise exception 'Seat deal was not found.';
  end if;

  requested_modules :=
    coalesce(
      deal_record.metadata -> 'requested_module_keys',
      '[]'::jsonb
    );

  requested_integrations :=
    coalesce(
      deal_record.metadata -> 'requested_integration_keys',
      '[]'::jsonb
    );

  requested_addons :=
    coalesce(
      deal_record.metadata -> 'requested_addon_ids',
      '[]'::jsonb
    );

  dashboard_emphasis :=
    coalesce(
      deal_record.metadata -> 'dashboard_emphasis',
      '[]'::jsonb
    );

  included_seats :=
    case
      when coalesce(
        deal_record.metadata ->> 'included_user_seats',
        ''
      ) ~ '^[0-9]+$'
      then (
        deal_record.metadata ->> 'included_user_seats'
      )::integer
      else null
    end;

  data_import_required :=
    coalesce(
      (
        deal_record.metadata ->>
        'data_import_required'
      )::boolean,
      false
    );

  custom_setup_required :=
    coalesce(
      (
        deal_record.metadata ->>
        'custom_setup_required'
      )::boolean,
      false
    );

  begin
    selected_package_id :=
      nullif(
        deal_record.metadata ->> 'package_id',
        ''
      )::uuid;
  exception
    when invalid_text_representation then
      selected_package_id := null;
  end;

  -- Keep the canonical commercial customer name synchronized
  -- with what the Admin explicitly confirms in the proposal.
  update public.seat_customers
  set
    display_name = normalized_customer_name,
    updated_at = now()
  where id = deal_record.customer_id;

  -- Only one live proposal version per deal.
  update public.seat_proposals
  set
    status = 'revoked',
    updated_at = now()
  where deal_id = deal_record.deal_id
    and status in (
      'draft',
      'sent',
      'viewed',
      'changes_requested'
    );

  select
    coalesce(max(version), 0) + 1
  into next_version
  from public.seat_proposals
  where deal_id = deal_record.deal_id;

  insert into public.seat_proposals (
    deal_id,
    customer_id,
    product_id,
    package_id,
    client_name,
    client_email,
    status,
    version,
    currency,
    monthly_total_cents,
    annual_total_cents,
    setup_total_cents,
    contract_term_months,
    terms_summary,
    dashboard_config,
    onboarding_config,
    metadata,
    created_by
  )
  values (
    deal_record.deal_id,
    deal_record.customer_id,
    deal_record.product_id,
    selected_package_id,
    normalized_client_name,
    normalized_client_email,
    'draft',
    next_version,
    deal_record.currency,
    target_monthly_cents,
    target_monthly_cents * 12,
    target_setup_cents,
    target_contract_term_months,
    target_terms_summary,
    jsonb_build_object(
      'emphasis',
      dashboard_emphasis
    ),
    jsonb_build_object(
      'requested_integration_keys',
      requested_integrations,
      'data_import_required',
      data_import_required,
      'custom_setup_required',
      custom_setup_required
    ),
    jsonb_build_object(
      'deal_code',
      normalized_deal_code,
      'product_name',
      deal_record.product_name,
      'requested_module_keys',
      requested_modules,
      'requested_integration_keys',
      requested_integrations,
      'requested_addon_ids',
      requested_addons,
      'included_user_seats',
      included_seats,
      'proposal_valid_days',
      target_valid_days
    ),
    actor_user_id
  )
  returning
    id,
    seat_proposals.proposal_code
  into
    created_proposal_id,
    created_proposal_code;

  -- Core subscription.
  insert into public.seat_proposal_items (
    proposal_id,
    item_type,
    item_key,
    package_id,
    display_name,
    description,
    quantity,
    unit_amount_cents,
    billing_cadence,
    included,
    sort_order
  )
  values (
    created_proposal_id,
    'package',
    'seat_subscription',
    selected_package_id,
    deal_record.product_name || ' Subscription',
    'Secure Seat Platform access and selected operational modules.',
    1,
    target_monthly_cents,
    'monthly',
    false,
    10
  );

  -- One-time onboarding.
  if target_setup_cents > 0 then
    insert into public.seat_proposal_items (
      proposal_id,
      item_type,
      item_key,
      display_name,
      description,
      quantity,
      unit_amount_cents,
      billing_cadence,
      included,
      sort_order
    )
    values (
      created_proposal_id,
      'service',
      'onboarding_setup',
      'Onboarding & Setup',
      'Initial configuration, account setup and launch preparation.',
      1,
      target_setup_cents,
      'one_time',
      false,
      20
    );
  end if;

  -- Included users.
  if included_seats is not null and included_seats > 0 then
    insert into public.seat_proposal_items (
      proposal_id,
      item_type,
      item_key,
      display_name,
      description,
      quantity,
      unit_amount_cents,
      billing_cadence,
      included,
      sort_order
    )
    values (
      created_proposal_id,
      'seat',
      'included_users',
      'Included Users',
      'Authorized team members included in the starting package.',
      included_seats,
      0,
      'none',
      true,
      30
    );
  end if;

  -- Selected modules.
  insert into public.seat_proposal_items (
    proposal_id,
    item_type,
    item_key,
    module_id,
    display_name,
    description,
    quantity,
    unit_amount_cents,
    billing_cadence,
    included,
    sort_order
  )
  select
    created_proposal_id,
    'module',
    module.module_key,
    module.id,
    module.display_name,
    'Included Seat module.',
    1,
    0,
    'none',
    true,
    100 + row_number() over (
      order by module.display_name
    )
  from public.seat_modules module
  where module.module_key in (
    select value
    from jsonb_array_elements_text(
      requested_modules
    )
  );

  -- Selected integrations.
  insert into public.seat_proposal_items (
    proposal_id,
    item_type,
    item_key,
    display_name,
    description,
    quantity,
    unit_amount_cents,
    billing_cadence,
    included,
    sort_order
  )
  select
    created_proposal_id,
    'integration',
    integration.integration_key,
    integration.display_name,
    'Integration selected for onboarding.',
    1,
    0,
    'none',
    true,
    300 + row_number() over (
      order by integration.display_name
    )
  from public.seat_integration_catalog integration
  where integration.integration_key in (
    select value
    from jsonb_array_elements_text(
      requested_integrations
    )
  );

  -- Selected add-ons.
  insert into public.seat_proposal_items (
    proposal_id,
    item_type,
    item_key,
    addon_id,
    display_name,
    description,
    quantity,
    unit_amount_cents,
    billing_cadence,
    included,
    sort_order
  )
  select
    created_proposal_id,
    'addon',
    addon.addon_key,
    addon.id,
    addon.display_name,
    addon.description,
    1,
    coalesce(addon.unit_price_cents, 0),
    addon.billing_cadence,
    false,
    400 + row_number() over (
      order by addon.display_name
    )
  from public.seat_addons addon
  where addon.id::text in (
    select value
    from jsonb_array_elements_text(
      requested_addons
    )
  );

  if data_import_required then
    insert into public.seat_proposal_items (
      proposal_id,
      item_type,
      item_key,
      display_name,
      description,
      quantity,
      unit_amount_cents,
      billing_cadence,
      included,
      sort_order
    )
    values (
      created_proposal_id,
      'migration',
      'data_import',
      'Data Migration / Import',
      'Migration scope will be confirmed during onboarding.',
      1,
      0,
      'none',
      true,
      500
    );
  end if;

  if custom_setup_required then
    insert into public.seat_proposal_items (
      proposal_id,
      item_type,
      item_key,
      display_name,
      description,
      quantity,
      unit_amount_cents,
      billing_cadence,
      included,
      sort_order
    )
    values (
      created_proposal_id,
      'service',
      'custom_implementation',
      'Custom Implementation',
      'Additional implementation requirements captured during setup.',
      1,
      0,
      'none',
      true,
      510
    );
  end if;

  update public.seat_deals
  set
    stage = 'proposal',
    expected_monthly_cents =
      target_monthly_cents,
    expected_setup_cents =
      target_setup_cents,
    contract_term_months =
      target_contract_term_months,
    updated_at = now()
  where id = deal_record.deal_id;

  insert into private.seat_security_events (
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
    'seat_proposal_draft_created',
    'notice',
    deal_record.customer_id,
    'seat_proposal',
    created_proposal_id::text,
    jsonb_build_object(
      'proposal_code',
      created_proposal_code,
      'version',
      next_version
    ),
    now()
  );

  return query
  select
    created_proposal_id,
    created_proposal_code,
    next_version;
end;
$seat_proposal$;


-- ============================================================
-- SEND / GENERATE SECURE CLIENT LINK
-- ============================================================

create or replace function
public.send_seat_proposal(
  target_proposal_id uuid,
  target_valid_days integer default null
)
returns table (
  proposal_id uuid,
  proposal_code text,
  access_token text,
  valid_until timestamptz
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $seat_send_proposal$
declare
  actor_user_id uuid := auth.uid();

  proposal_record record;
  new_token text;
  new_token_hash text;
  valid_days integer;
  new_valid_until timestamptz;
begin
  if actor_user_id is null then
    raise exception
      'A signed-in Seat Platform session is required.'
      using errcode = '42501';
  end if;

  if not public.seat_platform_admin_authorized() then
    raise exception
      'Platform Owner or Platform Admin MFA authorization is required.'
      using errcode = '42501';
  end if;

  select proposal.*
  into proposal_record
  from public.seat_proposals proposal
  where proposal.id = target_proposal_id
  for update;

  if proposal_record.id is null then
    raise exception 'Proposal was not found.';
  end if;

  if proposal_record.status not in (
    'draft',
    'changes_requested'
  ) then
    raise exception
      'Only draft or changes-requested proposals can be sent.';
  end if;

  valid_days :=
    coalesce(
      target_valid_days,
      case
        when coalesce(
          proposal_record.metadata ->>
          'proposal_valid_days',
          ''
        ) ~ '^[0-9]+$'
        then (
          proposal_record.metadata ->>
          'proposal_valid_days'
        )::integer
        else 7
      end
    );

  if valid_days < 1 or valid_days > 30 then
    raise exception
      'Proposal validity must be between 1 and 30 days.';
  end if;

  new_token :=
    encode(
      gen_random_bytes(32),
      'hex'
    );

  new_token_hash :=
    encode(
      digest(
        new_token,
        'sha256'
      ),
      'hex'
    );

  new_valid_until :=
    now()
    + make_interval(
        days => valid_days
      );

  update public.seat_proposals
  set
    status = 'sent',
    access_token_hash = new_token_hash,
    token_created_at = now(),
    sent_at = now(),
    valid_until = new_valid_until,
    viewed_at = null,
    updated_at = now()
  where id = proposal_record.id;

  insert into private.seat_security_events (
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
    'seat_proposal_sent',
    'notice',
    proposal_record.customer_id,
    'seat_proposal',
    proposal_record.id::text,
    jsonb_build_object(
      'proposal_code',
      proposal_record.proposal_code,
      'valid_until',
      new_valid_until
    ),
    now()
  );

  return query
  select
    proposal_record.id,
    proposal_record.proposal_code,
    new_token,
    new_valid_until;
end;
$seat_send_proposal$;


-- ============================================================
-- CLIENT TOKEN VIEW
-- ============================================================

create or replace function
public.get_seat_proposal_by_token(
  target_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $seat_client_proposal$
declare
  token_hash text;
  proposal_record record;
  item_data jsonb;
begin
  if length(btrim(coalesce(target_token, ''))) < 32 then
    return jsonb_build_object(
      'found',
      false
    );
  end if;

  token_hash :=
    encode(
      digest(
        btrim(target_token),
        'sha256'
      ),
      'hex'
    );

  select
    proposal.id,
    proposal.proposal_code,
    proposal.customer_id,
    proposal.product_id,
    proposal.client_name,
    proposal.status,
    proposal.version,
    proposal.currency,
    proposal.monthly_total_cents,
    proposal.annual_total_cents,
    proposal.setup_total_cents,
    proposal.contract_term_months,
    proposal.valid_until,
    proposal.terms_summary,
    proposal.dashboard_config,
    proposal.onboarding_config,
    proposal.metadata,
    customer.display_name as customer_name,
    product.product_name
  into proposal_record
  from public.seat_proposals proposal
  join public.seat_customers customer
    on customer.id = proposal.customer_id
  join public.seat_products product
    on product.id = proposal.product_id
  where proposal.access_token_hash =
    token_hash
  limit 1;

  if proposal_record.id is null then
    return jsonb_build_object(
      'found',
      false
    );
  end if;

  if
    proposal_record.valid_until is not null
    and proposal_record.valid_until <= now()
  then
    update public.seat_proposals
    set
      status = 'expired',
      updated_at = now()
    where id = proposal_record.id
      and status in (
        'sent',
        'viewed',
        'changes_requested'
      );

    return jsonb_build_object(
      'found',
      false,
      'expired',
      true
    );
  end if;

  if proposal_record.status in (
    'revoked',
    'expired'
  ) then
    return jsonb_build_object(
      'found',
      false
    );
  end if;

  if proposal_record.status = 'sent' then
    update public.seat_proposals
    set
      status = 'viewed',
      viewed_at = coalesce(
        viewed_at,
        now()
      ),
      updated_at = now()
    where id = proposal_record.id;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'item_type',
        item.item_type,
        'item_key',
        item.item_key,
        'display_name',
        item.display_name,
        'description',
        item.description,
        'quantity',
        item.quantity,
        'unit_amount_cents',
        item.unit_amount_cents,
        'billing_cadence',
        item.billing_cadence,
        'included',
        item.included
      )
      order by item.sort_order,
               item.display_name
    ),
    '[]'::jsonb
  )
  into item_data
  from public.seat_proposal_items item
  where item.proposal_id =
    proposal_record.id;

  return jsonb_build_object(
    'found',
    true,
    'proposal_code',
    proposal_record.proposal_code,
    'customer_name',
    proposal_record.customer_name,
    'client_name',
    proposal_record.client_name,
    'product_name',
    proposal_record.product_name,
    'status',
    proposal_record.status,
    'version',
    proposal_record.version,
    'currency',
    proposal_record.currency,
    'monthly_total_cents',
    proposal_record.monthly_total_cents,
    'annual_total_cents',
    proposal_record.annual_total_cents,
    'setup_total_cents',
    proposal_record.setup_total_cents,
    'contract_term_months',
    proposal_record.contract_term_months,
    'valid_until',
    proposal_record.valid_until,
    'terms_summary',
    proposal_record.terms_summary,
    'dashboard_config',
    proposal_record.dashboard_config,
    'onboarding_config',
    proposal_record.onboarding_config,
    'items',
    item_data
  );
end;
$seat_client_proposal$;


-- ============================================================
-- CLIENT RESPONSE
-- ============================================================

create or replace function
public.respond_to_seat_proposal(
  target_token text,
  target_action text,
  target_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $seat_client_response$
declare
  token_hash text;
  proposal_record record;
  normalized_note text;
begin
  if target_action not in (
    'approved',
    'changes_requested',
    'declined'
  ) then
    raise exception
      'Invalid proposal response.';
  end if;

  token_hash :=
    encode(
      digest(
        btrim(coalesce(target_token, '')),
        'sha256'
      ),
      'hex'
    );

  select proposal.*
  into proposal_record
  from public.seat_proposals proposal
  where proposal.access_token_hash =
    token_hash
  for update;

  if proposal_record.id is null then
    raise exception
      'Proposal link is invalid.';
  end if;

  if
    proposal_record.valid_until is not null
    and proposal_record.valid_until <= now()
  then
    raise exception
      'Proposal link has expired.';
  end if;

  if proposal_record.status not in (
    'sent',
    'viewed',
    'changes_requested'
  ) then
    raise exception
      'Proposal can no longer be changed.';
  end if;

  normalized_note :=
    nullif(
      left(
        btrim(
          coalesce(
            target_note,
            ''
          )
        ),
        2000
      ),
      ''
    );

  update public.seat_proposals
  set
    status = target_action,
    approved_at =
      case
        when target_action = 'approved'
        then now()
        else approved_at
      end,
    changes_requested_at =
      case
        when target_action =
          'changes_requested'
        then now()
        else changes_requested_at
      end,
    declined_at =
      case
        when target_action = 'declined'
        then now()
        else declined_at
      end,
    metadata =
      metadata ||
      jsonb_build_object(
        'client_response_note',
        normalized_note
      ),
    updated_at = now()
  where id = proposal_record.id;

  insert into private.seat_security_events (
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
    null,
    'seat_proposal_client_response',
    'notice',
    proposal_record.customer_id,
    'seat_proposal',
    proposal_record.id::text,
    jsonb_build_object(
      'proposal_code',
      proposal_record.proposal_code,
      'response',
      target_action
    ),
    now()
  );

  return jsonb_build_object(
    'ok',
    true,
    'status',
    target_action
  );
end;
$seat_client_response$;


-- ============================================================
-- PERMISSIONS
-- ============================================================

revoke all
on function public.create_seat_proposal_draft(
  text,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  jsonb
)
from public, anon;

grant execute
on function public.create_seat_proposal_draft(
  text,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  jsonb
)
to authenticated;


revoke all
on function public.send_seat_proposal(
  uuid,
  integer
)
from public, anon;

grant execute
on function public.send_seat_proposal(
  uuid,
  integer
)
to authenticated;


revoke all
on function public.get_seat_proposal_by_token(text)
from public;

grant execute
on function public.get_seat_proposal_by_token(text)
to anon, authenticated;


revoke all
on function public.respond_to_seat_proposal(
  text,
  text,
  text
)
from public;

grant execute
on function public.respond_to_seat_proposal(
  text,
  text,
  text
)
to anon, authenticated;


notify pgrst, 'reload schema';

commit;

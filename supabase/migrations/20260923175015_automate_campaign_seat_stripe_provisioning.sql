
create unique index if not exists seat_subscriptions_external_subscription_uidx
  on public.seat_subscriptions (external_subscription_id)
  where external_subscription_id is not null;

create unique index if not exists workspace_subscriptions_external_subscription_uidx
  on public.workspace_subscriptions (external_subscription_id)
  where external_subscription_id is not null;

create or replace function public.provision_campaign_seat_stripe_request(
  target_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  req private.workspace_provisioning_requests%rowtype;
  campaign_product_id uuid;
  plan_monthly_cents integer;
  plan_member_limit integer;
  customer_id uuid;
  contact_id uuid;
  product_account_id uuid;
  seat_subscription_id uuid;
  workspace_id uuid;
  existing_workspace_id uuid;
  existing_customer_id uuid;
  existing_product_account_id uuid;
  existing_seat_subscription_id uuid;
  contact_name text;
  contact_phone text;
  billing_address jsonb;
  resolved_campaign_type text;
begin
  select *
  into req
  from private.workspace_provisioning_requests
  where id = target_request_id
  for update;

  if not found then
    raise exception 'provisioning request not found';
  end if;

  if req.stripe_subscription_id is null or btrim(req.stripe_subscription_id) = '' then
    raise exception 'stripe subscription id is required';
  end if;

  select
    swb.workspace_id,
    sc.id,
    spa.id,
    ss.id
  into
    existing_workspace_id,
    existing_customer_id,
    existing_product_account_id,
    existing_seat_subscription_id
  from public.seat_subscriptions ss
  join public.seat_product_accounts spa on spa.id = ss.product_account_id
  join public.seat_customers sc on sc.id = spa.customer_id
  left join public.seat_workspace_bindings swb
    on swb.product_account_id = spa.id
   and swb.status = 'active'
  where ss.external_subscription_id = req.stripe_subscription_id
  limit 1;

  if existing_seat_subscription_id is not null then
    update private.workspace_provisioning_requests
    set status = 'provisioned',
        workspace_id = coalesce(existing_workspace_id, workspace_id),
        processed_at = coalesce(processed_at, now()),
        request_payload = request_payload || jsonb_build_object(
          'seat_customer_id', existing_customer_id,
          'seat_product_account_id', existing_product_account_id,
          'seat_subscription_id', existing_seat_subscription_id,
          'workspace_id', existing_workspace_id,
          'provisioning_reused_existing', true
        ),
        updated_at = now()
    where id = req.id;

    return jsonb_build_object(
      'request_id', req.id,
      'customer_id', existing_customer_id,
      'product_account_id', existing_product_account_id,
      'seat_subscription_id', existing_seat_subscription_id,
      'workspace_id', existing_workspace_id,
      'reused_existing', true
    );
  end if;

  update private.workspace_provisioning_requests
  set status = 'processing',
      failure_code = null,
      failure_summary = null,
      updated_at = now()
  where id = req.id;

  select id
  into campaign_product_id
  from public.seat_products
  where product_key = 'campaign'
    and status = 'active'
  limit 1;

  if campaign_product_id is null then
    raise exception 'active Campaign Seat product not found';
  end if;

  select monthly_price_cents, member_seat_limit
  into plan_monthly_cents, plan_member_limit
  from public.campaign_seat_plan_catalog
  where plan_key = 'founding_pilot'
    and status = 'active'
  limit 1;

  if plan_monthly_cents is null then
    raise exception 'Founding Pilot plan price is not configured';
  end if;

  contact_name := nullif(btrim(coalesce(req.request_payload->>'stripe_customer_name', '')), '');
  if contact_name is null then
    contact_name := req.campaign_name;
  end if;

  contact_phone := nullif(btrim(coalesce(req.request_payload->>'stripe_customer_phone', '')), '');

  if jsonb_typeof(req.request_payload->'stripe_customer_address') = 'object' then
    billing_address := req.request_payload->'stripe_customer_address';
  else
    billing_address := '{}'::jsonb;
  end if;

  resolved_campaign_type := case
    when req.campaign_type in (
      'candidate_campaign','ballot_measure','pac','party_organization',
      'elected_official','advocacy_organization','other'
    ) then req.campaign_type
    else 'other'
  end;

  insert into public.seat_customers (
    display_name,
    customer_type,
    status,
    billing_email,
    phone,
    billing_address,
    metadata
  )
  values (
    req.campaign_name,
    'campaign',
    'onboarding',
    lower(btrim(req.email)),
    contact_phone,
    billing_address,
    jsonb_build_object(
      'source', 'stripe',
      'product_key', 'campaign',
      'plan_key', 'founding_pilot',
      'stripe_customer_id', req.stripe_customer_id,
      'stripe_subscription_id', req.stripe_subscription_id,
      'stripe_checkout_session_id', req.stripe_checkout_session_id,
      'stripe_event_id', req.stripe_event_id
    )
  )
  returning id into customer_id;

  insert into public.seat_customer_contacts (
    customer_id,
    full_name,
    email,
    phone,
    is_primary,
    is_billing,
    is_onboarding,
    status,
    metadata
  )
  values (
    customer_id,
    contact_name,
    lower(btrim(req.email)),
    contact_phone,
    true,
    true,
    true,
    'active',
    jsonb_build_object(
      'source', 'stripe',
      'stripe_customer_id', req.stripe_customer_id
    )
  )
  returning id into contact_id;

  insert into public.seat_product_accounts (
    customer_id,
    product_id,
    account_name,
    primary_contact_id,
    status,
    onboarding_status,
    metadata
  )
  values (
    customer_id,
    campaign_product_id,
    req.campaign_name,
    contact_id,
    'pending_onboarding',
    'not_started',
    jsonb_build_object(
      'source', 'stripe',
      'product_key', 'campaign',
      'plan_key', 'founding_pilot',
      'stripe_customer_id', req.stripe_customer_id,
      'stripe_subscription_id', req.stripe_subscription_id
    )
  )
  returning id into product_account_id;

  insert into public.seat_subscriptions (
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
    external_customer_id,
    external_subscription_id,
    starts_at,
    metadata
  )
  values (
    product_account_id,
    null,
    'Founding Pilot',
    'stripe',
    'active',
    'USD',
    plan_monthly_cents,
    0,
    0,
    plan_member_limit,
    req.stripe_customer_id,
    req.stripe_subscription_id,
    now(),
    jsonb_build_object(
      'source', 'stripe',
      'product_key', 'campaign',
      'plan_key', 'founding_pilot',
      'stripe_checkout_session_id', req.stripe_checkout_session_id,
      'stripe_event_id', req.stripe_event_id
    )
  )
  returning id into seat_subscription_id;

  insert into public.workspaces (
    name,
    status,
    political_party,
    campaign_type,
    onboarding_status,
    setup_metadata
  )
  values (
    req.campaign_name,
    'active',
    'other',
    resolved_campaign_type,
    'not_started',
    jsonb_build_object(
      'source', 'stripe',
      'product_key', 'campaign',
      'plan_key', 'founding_pilot',
      'seat_customer_id', customer_id,
      'seat_product_account_id', product_account_id,
      'seat_subscription_id', seat_subscription_id
    )
  )
  returning id into workspace_id;

  insert into public.seat_workspace_bindings (
    product_account_id,
    workspace_id,
    relationship_type,
    status,
    metadata
  )
  values (
    product_account_id,
    workspace_id,
    'primary',
    'active',
    jsonb_build_object(
      'source', 'stripe',
      'plan_key', 'founding_pilot'
    )
  );

  insert into public.workspace_subscriptions (
    workspace_id,
    plan_key,
    status,
    starts_at,
    external_customer_id,
    external_subscription_id,
    entitlement_overrides,
    metadata
  )
  values (
    workspace_id,
    'founding_pilot',
    'active',
    now(),
    req.stripe_customer_id,
    req.stripe_subscription_id,
    '{}'::jsonb,
    jsonb_build_object(
      'source', 'stripe',
      'seat_subscription_id', seat_subscription_id,
      'seat_product_account_id', product_account_id
    )
  );

  update private.workspace_provisioning_requests
  set status = 'provisioned',
      workspace_id = workspace_id,
      processed_at = now(),
      request_payload = request_payload || jsonb_build_object(
        'seat_customer_id', customer_id,
        'seat_product_account_id', product_account_id,
        'seat_subscription_id', seat_subscription_id,
        'workspace_id', workspace_id,
        'provisioning_reused_existing', false
      ),
      updated_at = now()
  where id = req.id;

  return jsonb_build_object(
    'request_id', req.id,
    'customer_id', customer_id,
    'product_account_id', product_account_id,
    'seat_subscription_id', seat_subscription_id,
    'workspace_id', workspace_id,
    'reused_existing', false
  );
end;
$$;

revoke all on function public.provision_campaign_seat_stripe_request(uuid) from public;
revoke all on function public.provision_campaign_seat_stripe_request(uuid) from anon;
revoke all on function public.provision_campaign_seat_stripe_request(uuid) from authenticated;
grant execute on function public.provision_campaign_seat_stripe_request(uuid) to service_role;

create or replace function public.record_campaign_seat_stripe_checkout(
  target_event_id text,
  target_checkout_session_id text,
  target_customer_id text,
  target_subscription_id text,
  target_email text,
  target_campaign_name text,
  target_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  request_id uuid;
  normalized_email text;
  normalized_campaign_name text;
begin
  normalized_email := lower(trim(coalesce(target_email, '')));
  if normalized_email = '' then
    raise exception 'customer email is required';
  end if;

  normalized_campaign_name := nullif(trim(coalesce(target_campaign_name, '')), '');
  if normalized_campaign_name is null then
    normalized_campaign_name := 'Campaign Seat customer — ' || normalized_email;
  end if;

  insert into private.workspace_provisioning_requests (
    email,
    campaign_name,
    campaign_type,
    request_payload,
    status,
    stripe_event_id,
    stripe_checkout_session_id,
    stripe_customer_id,
    stripe_subscription_id
  )
  values (
    normalized_email,
    normalized_campaign_name,
    'other',
    coalesce(target_payload, '{}'::jsonb) || jsonb_build_object(
      'source', 'stripe',
      'product_key', 'campaign',
      'plan_key', 'founding_pilot',
      'monthly_price_cents', 14900
    ),
    'pending',
    target_event_id,
    target_checkout_session_id,
    target_customer_id,
    target_subscription_id
  )
  on conflict (stripe_event_id) where stripe_event_id is not null
  do update set
    email = excluded.email,
    campaign_name = excluded.campaign_name,
    stripe_checkout_session_id = coalesce(excluded.stripe_checkout_session_id, private.workspace_provisioning_requests.stripe_checkout_session_id),
    stripe_customer_id = coalesce(excluded.stripe_customer_id, private.workspace_provisioning_requests.stripe_customer_id),
    stripe_subscription_id = coalesce(excluded.stripe_subscription_id, private.workspace_provisioning_requests.stripe_subscription_id),
    request_payload = private.workspace_provisioning_requests.request_payload || excluded.request_payload,
    updated_at = now()
  returning id into request_id;

  return request_id;
end;
$$;

revoke all on function public.record_campaign_seat_stripe_checkout(text, text, text, text, text, text, jsonb) from public;
revoke all on function public.record_campaign_seat_stripe_checkout(text, text, text, text, text, text, jsonb) from anon;
revoke all on function public.record_campaign_seat_stripe_checkout(text, text, text, text, text, text, jsonb) from authenticated;
grant execute on function public.record_campaign_seat_stripe_checkout(text, text, text, text, text, text, jsonb) to service_role;
;

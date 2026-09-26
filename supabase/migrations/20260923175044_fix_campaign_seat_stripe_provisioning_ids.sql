
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
  v_campaign_product_id uuid;
  v_plan_monthly_cents integer;
  v_plan_member_limit integer;
  v_customer_id uuid;
  v_contact_id uuid;
  v_product_account_id uuid;
  v_seat_subscription_id uuid;
  v_workspace_id uuid;
  v_existing_workspace_id uuid;
  v_existing_customer_id uuid;
  v_existing_product_account_id uuid;
  v_existing_seat_subscription_id uuid;
  v_contact_name text;
  v_contact_phone text;
  v_billing_address jsonb;
  v_resolved_campaign_type text;
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
    v_existing_workspace_id,
    v_existing_customer_id,
    v_existing_product_account_id,
    v_existing_seat_subscription_id
  from public.seat_subscriptions ss
  join public.seat_product_accounts spa on spa.id = ss.product_account_id
  join public.seat_customers sc on sc.id = spa.customer_id
  left join public.seat_workspace_bindings swb
    on swb.product_account_id = spa.id
   and swb.status = 'active'
  where ss.external_subscription_id = req.stripe_subscription_id
  limit 1;

  if v_existing_seat_subscription_id is not null then
    update private.workspace_provisioning_requests wpr
    set status = 'provisioned',
        workspace_id = coalesce(v_existing_workspace_id, wpr.workspace_id),
        processed_at = coalesce(wpr.processed_at, now()),
        request_payload = wpr.request_payload || jsonb_build_object(
          'seat_customer_id', v_existing_customer_id,
          'seat_product_account_id', v_existing_product_account_id,
          'seat_subscription_id', v_existing_seat_subscription_id,
          'workspace_id', v_existing_workspace_id,
          'provisioning_reused_existing', true
        ),
        updated_at = now()
    where wpr.id = req.id;

    return jsonb_build_object(
      'request_id', req.id,
      'customer_id', v_existing_customer_id,
      'product_account_id', v_existing_product_account_id,
      'seat_subscription_id', v_existing_seat_subscription_id,
      'workspace_id', v_existing_workspace_id,
      'reused_existing', true
    );
  end if;

  update private.workspace_provisioning_requests wpr
  set status = 'processing',
      failure_code = null,
      failure_summary = null,
      updated_at = now()
  where wpr.id = req.id;

  select id
  into v_campaign_product_id
  from public.seat_products
  where product_key = 'campaign'
    and status = 'active'
  limit 1;

  if v_campaign_product_id is null then
    raise exception 'active Campaign Seat product not found';
  end if;

  select monthly_price_cents, member_seat_limit
  into v_plan_monthly_cents, v_plan_member_limit
  from public.campaign_seat_plan_catalog
  where plan_key = 'founding_pilot'
    and status = 'active'
  limit 1;

  if v_plan_monthly_cents is null then
    raise exception 'Founding Pilot plan price is not configured';
  end if;

  v_contact_name := nullif(btrim(coalesce(req.request_payload->>'stripe_customer_name', '')), '');
  if v_contact_name is null then
    v_contact_name := req.campaign_name;
  end if;

  v_contact_phone := nullif(btrim(coalesce(req.request_payload->>'stripe_customer_phone', '')), '');

  if jsonb_typeof(req.request_payload->'stripe_customer_address') = 'object' then
    v_billing_address := req.request_payload->'stripe_customer_address';
  else
    v_billing_address := '{}'::jsonb;
  end if;

  v_resolved_campaign_type := case
    when req.campaign_type in (
      'candidate_campaign','ballot_measure','pac','party_organization',
      'elected_official','advocacy_organization','other'
    ) then req.campaign_type
    else 'other'
  end;

  insert into public.seat_customers (
    display_name, customer_type, status, billing_email, phone, billing_address, metadata
  )
  values (
    req.campaign_name,
    'campaign',
    'onboarding',
    lower(btrim(req.email)),
    v_contact_phone,
    v_billing_address,
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
  returning id into v_customer_id;

  insert into public.seat_customer_contacts (
    customer_id, full_name, email, phone,
    is_primary, is_billing, is_onboarding, status, metadata
  )
  values (
    v_customer_id,
    v_contact_name,
    lower(btrim(req.email)),
    v_contact_phone,
    true,
    true,
    true,
    'active',
    jsonb_build_object(
      'source', 'stripe',
      'stripe_customer_id', req.stripe_customer_id
    )
  )
  returning id into v_contact_id;

  insert into public.seat_product_accounts (
    customer_id, product_id, account_name, primary_contact_id,
    status, onboarding_status, metadata
  )
  values (
    v_customer_id,
    v_campaign_product_id,
    req.campaign_name,
    v_contact_id,
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
  returning id into v_product_account_id;

  insert into public.seat_subscriptions (
    product_account_id, package_id, package_name_snapshot,
    billing_provider, status, currency,
    monthly_amount_cents, annual_amount_cents, onboarding_fee_cents,
    included_user_seats, external_customer_id, external_subscription_id,
    starts_at, metadata
  )
  values (
    v_product_account_id,
    null,
    'Founding Pilot',
    'stripe',
    'active',
    'USD',
    v_plan_monthly_cents,
    0,
    0,
    v_plan_member_limit,
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
  returning id into v_seat_subscription_id;

  insert into public.workspaces (
    name, status, political_party, campaign_type, onboarding_status, setup_metadata
  )
  values (
    req.campaign_name,
    'active',
    'other',
    v_resolved_campaign_type,
    'not_started',
    jsonb_build_object(
      'source', 'stripe',
      'product_key', 'campaign',
      'plan_key', 'founding_pilot',
      'seat_customer_id', v_customer_id,
      'seat_product_account_id', v_product_account_id,
      'seat_subscription_id', v_seat_subscription_id
    )
  )
  returning id into v_workspace_id;

  insert into public.seat_workspace_bindings (
    product_account_id, workspace_id, relationship_type, status, metadata
  )
  values (
    v_product_account_id,
    v_workspace_id,
    'primary',
    'active',
    jsonb_build_object(
      'source', 'stripe',
      'plan_key', 'founding_pilot'
    )
  );

  insert into public.workspace_subscriptions (
    workspace_id, plan_key, status, starts_at,
    external_customer_id, external_subscription_id,
    entitlement_overrides, metadata
  )
  values (
    v_workspace_id,
    'founding_pilot',
    'active',
    now(),
    req.stripe_customer_id,
    req.stripe_subscription_id,
    '{}'::jsonb,
    jsonb_build_object(
      'source', 'stripe',
      'seat_subscription_id', v_seat_subscription_id,
      'seat_product_account_id', v_product_account_id
    )
  );

  update private.workspace_provisioning_requests wpr
  set status = 'provisioned',
      workspace_id = v_workspace_id,
      processed_at = now(),
      request_payload = wpr.request_payload || jsonb_build_object(
        'seat_customer_id', v_customer_id,
        'seat_product_account_id', v_product_account_id,
        'seat_subscription_id', v_seat_subscription_id,
        'workspace_id', v_workspace_id,
        'provisioning_reused_existing', false
      ),
      updated_at = now()
  where wpr.id = req.id;

  return jsonb_build_object(
    'request_id', req.id,
    'customer_id', v_customer_id,
    'product_account_id', v_product_account_id,
    'seat_subscription_id', v_seat_subscription_id,
    'workspace_id', v_workspace_id,
    'reused_existing', false
  );
end;
$$;

revoke all on function public.provision_campaign_seat_stripe_request(uuid) from public;
revoke all on function public.provision_campaign_seat_stripe_request(uuid) from anon;
revoke all on function public.provision_campaign_seat_stripe_request(uuid) from authenticated;
grant execute on function public.provision_campaign_seat_stripe_request(uuid) to service_role;
;

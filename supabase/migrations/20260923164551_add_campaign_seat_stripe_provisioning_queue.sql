
alter table private.workspace_provisioning_requests
  add column if not exists stripe_event_id text,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

create unique index if not exists workspace_provisioning_requests_stripe_event_uidx
  on private.workspace_provisioning_requests (stripe_event_id)
  where stripe_event_id is not null;

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
    'candidate_campaign',
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

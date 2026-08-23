begin;

-- ============================================================
-- CAMPAIGN SEAT
-- REVIEW LOOKUP REPAIR
--
-- Previous version attempted max(jsonb), which PostgreSQL does
-- not support.
--
-- This replacement reads each unique onboarding step directly.
-- No customer/onboarding data is changed.
-- ============================================================

create or replace function
public.get_my_seat_onboarding_review()
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $seat_review_lookup$
declare
  actor_user_id uuid :=
    auth.uid();

  review_record record;

  profile_data jsonb :=
    '{}'::jsonb;

  billing_data jsonb :=
    '{}'::jsonb;

  security_data jsonb :=
    '{}'::jsonb;

  integration_data jsonb :=
    '{}'::jsonb;

  team_data jsonb :=
    '{}'::jsonb;

  connections_data jsonb :=
    '[]'::jsonb;

  pending_connections integer :=
    0;

  billing_ready boolean :=
    false;

  integrations_ready boolean :=
    false;

  activation_blockers jsonb :=
    '[]'::jsonb;
begin

  if actor_user_id is null then
    raise exception
      'Sign in to continue onboarding.'
      using errcode = '42501';
  end if;


  select
    customer.id
      as customer_id,

    customer.display_name
      as customer_name,

    contact.full_name,

    contact.email,

    account.id
      as product_account_id,

    account.account_name,

    subscription.id
      as subscription_id,

    subscription.package_name_snapshot,

    subscription.billing_provider,

    subscription.status
      as subscription_status,

    subscription.currency,

    subscription.monthly_amount_cents,

    subscription.onboarding_fee_cents,

    subscription.included_user_seats,

    onboarding.id
      as onboarding_run_id,

    onboarding.current_step_key

  into review_record

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
      'pending_onboarding',
      'onboarding'
    )

    and onboarding.status =
      'in_progress'

  order by
    onboarding.created_at desc

  limit 1;


  if review_record.onboarding_run_id
    is null
  then
    return jsonb_build_object(
      'found',
      false
    );
  end if;


  select
    coalesce(
      (
        select step.step_data
        from public.seat_onboarding_run_steps
          as step
        where
          step.onboarding_run_id =
            review_record.onboarding_run_id
          and step.step_key =
            'product_profile'
        limit 1
      ),
      '{}'::jsonb
    )
  into profile_data;


  select
    coalesce(
      (
        select step.step_data
        from public.seat_onboarding_run_steps
          as step
        where
          step.onboarding_run_id =
            review_record.onboarding_run_id
          and step.step_key =
            'billing'
        limit 1
      ),
      '{}'::jsonb
    )
  into billing_data;


  select
    coalesce(
      (
        select step.step_data
        from public.seat_onboarding_run_steps
          as step
        where
          step.onboarding_run_id =
            review_record.onboarding_run_id
          and step.step_key =
            'security'
        limit 1
      ),
      '{}'::jsonb
    )
  into security_data;


  select
    coalesce(
      (
        select step.step_data
        from public.seat_onboarding_run_steps
          as step
        where
          step.onboarding_run_id =
            review_record.onboarding_run_id
          and step.step_key =
            'integrations'
        limit 1
      ),
      '{}'::jsonb
    )
  into integration_data;


  select
    coalesce(
      (
        select step.step_data
        from public.seat_onboarding_run_steps
          as step
        where
          step.onboarding_run_id =
            review_record.onboarding_run_id
          and step.step_key =
            'team'
        limit 1
      ),
      '{}'::jsonb
    )
  into team_data;


  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'integration_key',
          catalog.integration_key,

          'display_name',
          catalog.display_name,

          'provider',
          catalog.provider,

          'status',
          connection.status,

          'display_email',
          connection.display_email,

          'last_synced_at',
          connection.last_synced_at
        )
        order by
          catalog.display_name
      ),
      '[]'::jsonb
    ),

    count(*)
      filter (
        where connection.status <>
          'connected'
      )

  into
    connections_data,
    pending_connections

  from public.seat_product_account_integrations
    as connection

  join public.seat_integration_catalog
    as catalog
    on catalog.id =
      connection.integration_id

  where
    connection.product_account_id =
      review_record.product_account_id

    and coalesce(
      connection.connection_metadata
        ->> 'onboarding_selected',
      'false'
    ) = 'true';


  billing_ready :=
    review_record.billing_provider <>
      'pending'

    and review_record.subscription_status <>
      'pending_billing';


  integrations_ready :=
    pending_connections = 0;


  if not billing_ready then
    activation_blockers :=
      activation_blockers ||
      jsonb_build_array(
        jsonb_build_object(
          'key',
          'billing_provider',

          'title',
          'Billing provider connection required',

          'description',
          'Payment setup must be completed before the Campaign workspace can be activated.'
        )
      );
  end if;


  if not integrations_ready then
    activation_blockers :=
      activation_blockers ||
      jsonb_build_array(
        jsonb_build_object(
          'key',
          'integrations',

          'title',
          'Provider connections required',

          'description',
          pending_connections::text ||
          ' selected provider connection(s) still need secure OAuth authorization.'
        )
      );
  end if;


  return jsonb_build_object(
    'found',
    true,

    'current_step_key',
    review_record.current_step_key,

    'account_name',
    review_record.account_name,

    'customer_name',
    review_record.customer_name,

    'primary_contact',
    jsonb_build_object(
      'full_name',
      review_record.full_name,

      'email',
      review_record.email
    ),

    'commercial',
    jsonb_build_object(
      'package_name',
      review_record.package_name_snapshot,

      'billing_provider',
      review_record.billing_provider,

      'subscription_status',
      review_record.subscription_status,

      'currency',
      review_record.currency,

      'monthly_amount_cents',
      review_record.monthly_amount_cents,

      'onboarding_fee_cents',
      review_record.onboarding_fee_cents,

      'included_user_seats',
      review_record.included_user_seats
    ),

    'profile',
    profile_data,

    'billing',
    billing_data,

    'security',
    security_data,

    'integrations',
    integration_data,

    'integration_connections',
    connections_data,

    'team',
    team_data,

    'activation_readiness',
    jsonb_build_object(
      'billing_ready',
      billing_ready,

      'integrations_ready',
      integrations_ready,

      'pending_provider_connections',
      pending_connections,

      'ready',
      (
        billing_ready
        and integrations_ready
      ),

      'blockers',
      activation_blockers
    )
  );
end;
$seat_review_lookup$;


revoke all
on function
public.get_my_seat_onboarding_review()
from
  public,
  anon;


grant execute
on function
public.get_my_seat_onboarding_review()
to authenticated;


notify pgrst, 'reload schema';

commit;

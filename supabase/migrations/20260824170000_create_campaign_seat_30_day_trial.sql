begin;

-- ============================================================
-- CAMPAIGN SEAT
-- ONE-TIME 30-DAY FREE TRIAL
--
-- PURPOSE:
--
-- Allow an approved Campaign Seat client to launch before Stripe
-- is available, without creating a fake payment.
--
-- SECURITY / BILLING RULES:
--
--   * AAL2 required
--   * Billing details must already be confirmed
--   * Review must already be complete
--   * Client must already be at Activation
--   * No workspace may already exist
--   * Existing commercial terms are PRESERVED
--   * No card is collected
--   * No Stripe customer is created
--   * No Stripe subscription is created
--   * No payment or charge occurs
--   * Trial is exactly 30 days from the moment it is started
--   * Re-running this RPC does NOT extend the trial
--
-- billing_provider = manual is used because this is a real
-- Campaign Seat-managed trial rather than a Stripe-backed trial.
-- ============================================================


create or replace function
public.start_my_campaign_seat_free_trial()
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  auth,
  pg_temp
as $start_campaign_seat_trial$
declare
  actor_user_id uuid :=
    auth.uid();

  trial_record record;

  billing_step_status text;

  review_step_status text;

  activation_step_status text;

  existing_workspace_id uuid;

  trial_started_at_value timestamptz;

  trial_ends_at_value timestamptz;
begin

  if actor_user_id
    is null
  then
    raise exception
      'Sign in to start the Campaign Seat trial.'
      using errcode = '42501';
  end if;


  perform public.require_aal2();


  select
    customer.id
      as customer_id,

    account.id
      as product_account_id,

    account.status
      as account_status,

    account.onboarding_status,

    subscription.id
      as subscription_id,

    subscription.billing_provider,

    subscription.status
      as subscription_status,

    subscription.currency,

    subscription.monthly_amount_cents,

    subscription.annual_amount_cents,

    subscription.onboarding_fee_cents,

    subscription.included_user_seats,

    subscription.external_customer_id,

    subscription.external_subscription_id,

    subscription.starts_at,

    subscription.trial_ends_at,

    subscription.metadata
      as subscription_metadata,

    onboarding.id
      as onboarding_run_id,

    onboarding.status
      as onboarding_run_status,

    onboarding.current_step_key

  into trial_record

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

    and account.status =
      'onboarding'

    and onboarding.status =
      'in_progress'

  order by
    onboarding.created_at desc

  limit 1

  for update of
    account,
    subscription,
    onboarding;


  if trial_record.product_account_id
    is null
  then
    raise exception
      'An eligible Campaign Seat onboarding account was not found.'
      using errcode = 'P0002';
  end if;


  select status
  into billing_step_status

  from public.seat_onboarding_run_steps

  where
    onboarding_run_id =
      trial_record.onboarding_run_id

    and step_key =
      'billing';


  select status
  into review_step_status

  from public.seat_onboarding_run_steps

  where
    onboarding_run_id =
      trial_record.onboarding_run_id

    and step_key =
      'review';


  select status
  into activation_step_status

  from public.seat_onboarding_run_steps

  where
    onboarding_run_id =
      trial_record.onboarding_run_id

    and step_key =
      'activation';


  select binding.workspace_id

  into existing_workspace_id

  from public.seat_workspace_bindings
    as binding

  where
    binding.product_account_id =
      trial_record.product_account_id

    and binding.relationship_type =
      'primary'

    and binding.status =
      'active'

  limit 1;


  if existing_workspace_id
    is not null
  then
    raise exception
      'This Campaign Seat account already has an active workspace.';
  end if;


  -- ----------------------------------------------------------
  -- IDEMPOTENCY
  --
  -- Calling this again while the same trial is active returns
  -- the existing trial. It NEVER starts another 30 days.
  -- ----------------------------------------------------------

  if
    trial_record.billing_provider =
      'manual'

    and trial_record.subscription_status =
      'trial'

    and trial_record.trial_ends_at
      is not null

    and trial_record.trial_ends_at >
      now()
  then

    return jsonb_build_object(
      'ok',
      true,

      'already_started',
      true,

      'billing_provider',
      'manual',

      'subscription_status',
      'trial',

      'trial_started_at',
      trial_record.starts_at,

      'trial_ends_at',
      trial_record.trial_ends_at,

      'trial_days',
      30,

      'amount_charged_cents',
      0,

      'card_required',
      false
    );

  end if;


  if trial_record.current_step_key <>
    'activation'
  then
    raise exception
      'Campaign Seat must be at the Activation step before the free trial can begin.';
  end if;


  if billing_step_status <>
    'complete'
  then
    raise exception
      'Complete the Billing information step before starting the trial.';
  end if;


  if review_step_status <>
    'complete'
  then
    raise exception
      'Complete and confirm Review before starting the trial.';
  end if;


  if activation_step_status <>
    'in_progress'
  then
    raise exception
      'Campaign Seat Activation is not ready for the trial.';
  end if;


  if coalesce(
    (
      trial_record.subscription_metadata
        ->> 'billing_details_confirmed'
    )::boolean,
    false
  ) is not true
  then
    raise exception
      'Confirmed billing contact information is required before starting the trial.';
  end if;


  if
    trial_record.billing_provider <>
      'pending'

    or trial_record.subscription_status <>
      'pending_billing'
  then
    raise exception
      'This Campaign Seat subscription is not awaiting its first billing arrangement.';
  end if;


  if
    trial_record.external_customer_id
      is not null

    or trial_record.external_subscription_id
      is not null
  then
    raise exception
      'An external billing relationship already exists for this subscription.';
  end if;


  trial_started_at_value :=
    now();


  trial_ends_at_value :=
    trial_started_at_value +
    interval '30 days';


  -- ----------------------------------------------------------
  -- START REAL MANUAL TRIAL
  --
  -- IMPORTANT:
  -- Commercial pricing is NOT changed.
  --
  -- Existing:
  --   monthly_amount_cents
  --   annual_amount_cents
  --   onboarding_fee_cents
  --   included_user_seats
  --
  -- remain untouched.
  -- ----------------------------------------------------------

  update public.seat_subscriptions

  set
    billing_provider =
      'manual',

    status =
      'trial',

    starts_at =
      trial_started_at_value,

    trial_ends_at =
      trial_ends_at_value,

    current_period_start =
      trial_started_at_value,

    current_period_end =
      trial_ends_at_value,

    cancelled_at =
      null,

    metadata =
      coalesce(
        metadata,
        '{}'::jsonb
      ) ||
      jsonb_build_object(
        'billing_state',
        'manual_free_trial_active',

        'manual_trial',
        true,

        'trial_days',
        30,

        'trial_charge_cents',
        0,

        'card_required',
        false,

        'stripe_required_to_start',
        false,

        'trial_started_at',
        trial_started_at_value,

        'trial_ends_at',
        trial_ends_at_value,

        'trial_started_by',
        actor_user_id,

        'commercial_terms_preserved',
        true
      ),

    updated_at =
      now()

  where id =
    trial_record.subscription_id;


  -- Preserve the completed Billing step while recording that
  -- the previously-pending provider is now a manual free trial.

  update public.seat_onboarding_run_steps

  set
    step_data =
      coalesce(
        step_data,
        '{}'::jsonb
      ) ||
      jsonb_build_object(
        'payment_provider_status',
        'manual_trial',

        'subscription_status',
        'trial',

        'trial_days',
        30,

        'trial_charge_cents',
        0,

        'card_required',
        false,

        'trial_started_at',
        trial_started_at_value,

        'trial_ends_at',
        trial_ends_at_value
      ),

    updated_at =
      now()

  where
    onboarding_run_id =
      trial_record.onboarding_run_id

    and step_key =
      'billing';


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

    'seat_manual_free_trial_started',

    'notice',

    trial_record.customer_id,

    'seat_subscription',

    trial_record.subscription_id::text,

    jsonb_build_object(
      'product_account_id',
      trial_record.product_account_id,

      'onboarding_run_id',
      trial_record.onboarding_run_id,

      'billing_provider',
      'manual',

      'subscription_status',
      'trial',

      'trial_days',
      30,

      'amount_charged_cents',
      0,

      'card_required',
      false,

      'trial_started_at',
      trial_started_at_value,

      'trial_ends_at',
      trial_ends_at_value,

      'currency',
      trial_record.currency,

      'commercial_monthly_amount_cents',
      trial_record.monthly_amount_cents,

      'commercial_annual_amount_cents',
      trial_record.annual_amount_cents,

      'commercial_onboarding_fee_cents',
      trial_record.onboarding_fee_cents,

      'included_user_seats',
      trial_record.included_user_seats
    ),

    now()
  );


  return jsonb_build_object(
    'ok',
    true,

    'already_started',
    false,

    'billing_provider',
    'manual',

    'subscription_status',
    'trial',

    'trial_started_at',
    trial_started_at_value,

    'trial_ends_at',
    trial_ends_at_value,

    'trial_days',
    30,

    'amount_charged_cents',
    0,

    'card_required',
    false,

    'commercial_terms',
    jsonb_build_object(
      'currency',
      trial_record.currency,

      'monthly_amount_cents',
      trial_record.monthly_amount_cents,

      'annual_amount_cents',
      trial_record.annual_amount_cents,

      'onboarding_fee_cents',
      trial_record.onboarding_fee_cents,

      'included_user_seats',
      trial_record.included_user_seats
    )
  );

end;
$start_campaign_seat_trial$;


revoke all
on function
public.start_my_campaign_seat_free_trial()
from
  public,
  anon;


grant execute
on function
public.start_my_campaign_seat_free_trial()
to authenticated;


notify pgrst, 'reload schema';

commit;

begin;

-- ============================================================
-- CAMPAIGN SEAT
-- CLIENT ONBOARDING — BILLING DETAILS
--
-- This step confirms:
--   * billing contact
--   * billing address
--   * agreed proposal pricing
--
-- It DOES NOT:
--   * collect card data
--   * charge Stripe
--   * activate a subscription
--   * create a workspace
--
-- The subscription remains pending_billing until a real billing
-- provider is connected later.
-- ============================================================


create or replace function
public.get_my_seat_billing_setup()
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $seat_billing_lookup$
declare
  actor_user_id uuid :=
    auth.uid();

  billing_record record;
begin

  if actor_user_id is null then
    raise exception
      'Sign in to continue onboarding.'
      using errcode = '42501';
  end if;


  select
    customer.id
      as customer_id,

    customer.display_name,

    customer.billing_email,

    customer.billing_address,

    contact.full_name,

    contact.email
      as contact_email,

    contact.phone,

    account.id
      as product_account_id,

    subscription.id
      as subscription_id,

    subscription.package_name_snapshot,

    subscription.billing_provider,

    subscription.status
      as subscription_status,

    subscription.currency,

    subscription.monthly_amount_cents,

    subscription.annual_amount_cents,

    subscription.onboarding_fee_cents,

    subscription.included_user_seats,

    onboarding.id
      as onboarding_run_id,

    onboarding.current_step_key

  into billing_record

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

  join public.seat_subscriptions
    as subscription
    on subscription.product_account_id =
      account.id

  join public.seat_products
    as product
    on product.id =
      account.product_id

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


  if billing_record.subscription_id
    is null
  then
    return jsonb_build_object(
      'found',
      false
    );
  end if;


  return jsonb_build_object(
    'found',
    true,

    'display_name',
    billing_record.display_name,

    'billing_email',
    coalesce(
      billing_record.billing_email,
      billing_record.contact_email
    ),

    'billing_address',
    coalesce(
      billing_record.billing_address,
      '{}'::jsonb
    ),

    'full_name',
    billing_record.full_name,

    'phone',
    billing_record.phone,

    'package_name',
    billing_record.package_name_snapshot,

    'billing_provider',
    billing_record.billing_provider,

    'subscription_status',
    billing_record.subscription_status,

    'currency',
    billing_record.currency,

    'monthly_amount_cents',
    billing_record.monthly_amount_cents,

    'annual_amount_cents',
    billing_record.annual_amount_cents,

    'onboarding_fee_cents',
    billing_record.onboarding_fee_cents,

    'included_user_seats',
    billing_record.included_user_seats,

    'current_step_key',
    billing_record.current_step_key
  );
end;
$seat_billing_lookup$;


revoke all
on function
public.get_my_seat_billing_setup()
from
  public,
  anon;


grant execute
on function
public.get_my_seat_billing_setup()
to authenticated;



create or replace function
public.save_my_seat_billing_setup(
  billing_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  auth,
  pg_temp
as $seat_billing_save$
declare
  actor_user_id uuid :=
    auth.uid();

  onboarding_record record;

  billing_email_value text :=
    lower(
      btrim(
        coalesce(
          billing_data ->> 'billing_email',
          ''
        )
      )
    );

  billing_name_value text :=
    btrim(
      coalesce(
        billing_data ->> 'billing_name',
        ''
      )
    );

  billing_phone_value text :=
    btrim(
      coalesce(
        billing_data ->> 'billing_phone',
        ''
      )
    );

  address_line1_value text :=
    btrim(
      coalesce(
        billing_data ->> 'address_line1',
        ''
      )
    );

  address_line2_value text :=
    btrim(
      coalesce(
        billing_data ->> 'address_line2',
        ''
      )
    );

  city_value text :=
    btrim(
      coalesce(
        billing_data ->> 'city',
        ''
      )
    );

  state_region_value text :=
    btrim(
      coalesce(
        billing_data ->> 'state_region',
        ''
      )
    );

  postal_code_value text :=
    btrim(
      coalesce(
        billing_data ->> 'postal_code',
        ''
      )
    );

  country_code_value text :=
    upper(
      btrim(
        coalesce(
          billing_data ->> 'country_code',
          ''
        )
      )
    );

  terms_confirmed boolean :=
    coalesce(
      (
        billing_data
          ->> 'terms_confirmed'
      )::boolean,
      false
    );

  billing_address_value jsonb;
begin

  if actor_user_id is null then
    raise exception
      'Sign in to continue onboarding.'
      using errcode = '42501';
  end if;


  perform public.require_aal2();


  if
    billing_data is null
    or jsonb_typeof(
      billing_data
    ) <> 'object'
  then
    raise exception
      'Billing information is required.';
  end if;


  select
    customer.id
      as customer_id,

    contact.id
      as contact_id,

    account.id
      as product_account_id,

    subscription.id
      as subscription_id,

    subscription.billing_provider,

    subscription.status
      as subscription_status,

    subscription.monthly_amount_cents,

    subscription.onboarding_fee_cents,

    subscription.currency,

    onboarding.id
      as onboarding_run_id,

    onboarding.current_step_key

  into onboarding_record

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

  join public.seat_subscriptions
    as subscription
    on subscription.product_account_id =
      account.id

  join public.seat_products
    as product
    on product.id =
      account.product_id

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
    'billing'
  then
    raise exception
      'Billing is not the current onboarding step.';
  end if;


  if
    billing_email_value = ''
    or position(
      '@' in billing_email_value
    ) <= 1
  then
    raise exception
      'A valid billing email is required.';
  end if;


  if billing_name_value = '' then
    raise exception
      'Billing contact name is required.';
  end if;


  if address_line1_value = '' then
    raise exception
      'Billing address is required.';
  end if;


  if city_value = '' then
    raise exception
      'Billing city is required.';
  end if;


  if state_region_value = '' then
    raise exception
      'Billing state or region is required.';
  end if;


  if postal_code_value = '' then
    raise exception
      'Billing postal code is required.';
  end if;


  if
    country_code_value !~
      '^[A-Z]{2}$'
  then
    raise exception
      'Country code must use two letters.';
  end if;


  if not terms_confirmed then
    raise exception
      'Confirm the approved billing terms to continue.';
  end if;


  billing_address_value :=
    jsonb_strip_nulls(
      jsonb_build_object(
        'line1',
        address_line1_value,

        'line2',
        nullif(
          address_line2_value,
          ''
        ),

        'city',
        city_value,

        'state_region',
        state_region_value,

        'postal_code',
        postal_code_value,

        'country_code',
        country_code_value
      )
    );


  update public.seat_customers
  set
    billing_email =
      billing_email_value,

    billing_address =
      billing_address_value,

    updated_at =
      now()

  where id =
    onboarding_record.customer_id;


  update public.seat_customer_contacts
  set
    is_billing =
      true,

    phone =
      coalesce(
        nullif(
          billing_phone_value,
          ''
        ),
        phone
      ),

    metadata =
      coalesce(
        metadata,
        '{}'::jsonb
      ) ||
      jsonb_build_object(
        'billing_contact_name',
        billing_name_value
      ),

    updated_at =
      now()

  where id =
    onboarding_record.contact_id;


  update public.seat_subscriptions
  set
    metadata =
      coalesce(
        metadata,
        '{}'::jsonb
      ) ||
      jsonb_build_object(
        'billing_state',
        'details_confirmed_awaiting_provider',

        'billing_details_confirmed',
        true,

        'billing_confirmed_at',
        now(),

        'billing_confirmed_by',
        actor_user_id
      ),

    updated_at =
      now()

  where id =
    onboarding_record.subscription_id;


  update public.seat_onboarding_run_steps
  set
    status =
      'complete',

    step_data =
      jsonb_build_object(
        'billing_email',
        billing_email_value,

        'billing_contact_name',
        billing_name_value,

        'billing_phone',
        nullif(
          billing_phone_value,
          ''
        ),

        'billing_address',
        billing_address_value,

        'terms_confirmed',
        true,

        'payment_provider_status',
        'pending',

        'subscription_status',
        onboarding_record.subscription_status
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
      'billing';


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
      'integrations'

    and status =
      'pending';


  update public.seat_onboarding_runs
  set
    current_step_key =
      'integrations',

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
    'seat_billing_details_confirmed',
    'notice',
    onboarding_record.customer_id,
    'seat_subscription',
    onboarding_record.subscription_id::text,
    jsonb_build_object(
      'onboarding_run_id',
      onboarding_record.onboarding_run_id,

      'billing_provider',
      onboarding_record.billing_provider,

      'subscription_status',
      onboarding_record.subscription_status,

      'currency',
      onboarding_record.currency,

      'monthly_amount_cents',
      onboarding_record.monthly_amount_cents,

      'onboarding_fee_cents',
      onboarding_record.onboarding_fee_cents
    ),
    now()
  );


  return jsonb_build_object(
    'ok',
    true,

    'current_step_key',
    'integrations',

    'billing_provider',
    onboarding_record.billing_provider,

    'subscription_status',
    onboarding_record.subscription_status
  );
end;
$seat_billing_save$;


revoke all
on function
public.save_my_seat_billing_setup(
  jsonb
)
from
  public,
  anon;


grant execute
on function
public.save_my_seat_billing_setup(
  jsonb
)
to authenticated;


notify pgrst, 'reload schema';

commit;

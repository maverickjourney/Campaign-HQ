begin;

-- ============================================================
-- CAMPAIGN SEAT
-- CLIENT ONBOARDING — INTEGRATION PLAN
--
-- Creates the real Product Account integration records.
--
-- IMPORTANT:
-- This does NOT claim OAuth has succeeded.
-- New connections remain status = not_connected.
--
-- The selected providers must be connected before final
-- activation when required by the customer's onboarding plan.
-- ============================================================


create or replace function
public.get_my_seat_integration_setup()
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $seat_integration_lookup$
declare
  actor_user_id uuid :=
    auth.uid();

  onboarding_record record;

  integrations_data jsonb;
begin

  if actor_user_id is null then
    raise exception
      'Sign in to continue onboarding.'
      using errcode = '42501';
  end if;


  select
    account.id
      as product_account_id,

    product.id
      as product_id,

    onboarding.id
      as onboarding_run_id,

    onboarding.current_step_key,

    step.step_data

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

  join public.seat_onboarding_runs
    as onboarding
    on onboarding.product_account_id =
      account.id

  join public.seat_onboarding_run_steps
    as step
    on step.onboarding_run_id =
      onboarding.id
    and step.step_key =
      'integrations'

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


  if onboarding_record.onboarding_run_id
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
          'integration_id',
          catalog.id,

          'integration_key',
          catalog.integration_key,

          'display_name',
          catalog.display_name,

          'provider',
          catalog.provider,

          'category',
          catalog.category,

          'auth_type',
          catalog.auth_type,

          'capabilities',
          catalog.capabilities,

          'catalog_status',
          catalog.status,

          'connection_id',
          connection.id,

          'connection_status',
          coalesce(
            connection.status,
            'not_connected'
          ),

          'display_email',
          connection.display_email,

          'external_account_id',
          connection.external_account_id,

          'last_synced_at',
          connection.last_synced_at
        )
        order by
          catalog.display_name
      ),
      '[]'::jsonb
    )

  into integrations_data

  from jsonb_array_elements_text(
    coalesce(
      onboarding_record.step_data
        -> 'requested_integration_keys',
      '[]'::jsonb
    )
  ) requested(integration_key)

  join public.seat_integration_catalog
    as catalog
    on catalog.integration_key =
      requested.integration_key

  join public.seat_product_integrations
    as product_integration
    on product_integration.integration_id =
      catalog.id
    and product_integration.product_id =
      onboarding_record.product_id

  left join public.seat_product_account_integrations
    as connection
    on connection.product_account_id =
      onboarding_record.product_account_id
    and connection.integration_id =
      catalog.id
    and connection.connection_key =
      'primary'

  where
    catalog.visibility =
      'client'

    and catalog.status =
      'available'

    and product_integration.availability in (
      'optional',
      'included',
      'required'
    );


  return jsonb_build_object(
    'found',
    true,

    'current_step_key',
    onboarding_record.current_step_key,

    'integrations',
    integrations_data
  );
end;
$seat_integration_lookup$;


revoke all
on function
public.get_my_seat_integration_setup()
from
  public,
  anon;


grant execute
on function
public.get_my_seat_integration_setup()
to authenticated;



create or replace function
public.save_my_seat_integration_setup(
  selected_integration_keys text[]
)
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  auth,
  pg_temp
as $seat_integration_save$
declare
  actor_user_id uuid :=
    auth.uid();

  onboarding_record record;

  normalized_keys text[] :=
    array(
      select distinct
        lower(
          btrim(value)
        )
      from unnest(
        coalesce(
          selected_integration_keys,
          array[]::text[]
        )
      ) as selected(value)
      where btrim(
        coalesce(
          value,
          ''
        )
      ) <> ''
    );

  invalid_key text;

  pending_count integer :=
    0;
begin

  if actor_user_id is null then
    raise exception
      'Sign in to continue onboarding.'
      using errcode = '42501';
  end if;


  perform public.require_aal2();


  select
    contact.customer_id,

    account.id
      as product_account_id,

    product.id
      as product_id,

    onboarding.id
      as onboarding_run_id,

    onboarding.current_step_key,

    step.step_data

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

  join public.seat_onboarding_runs
    as onboarding
    on onboarding.product_account_id =
      account.id

  join public.seat_onboarding_run_steps
    as step
    on step.onboarding_run_id =
      onboarding.id
    and step.step_key =
      'integrations'

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
    'integrations'
  then
    raise exception
      'Integrations is not the current onboarding step.';
  end if;


  select key_value
  into invalid_key
  from unnest(
    normalized_keys
  ) as selected(key_value)

  where not exists (
    select 1

    from jsonb_array_elements_text(
      coalesce(
        onboarding_record.step_data
          -> 'requested_integration_keys',
        '[]'::jsonb
      )
    ) requested(integration_key)

    join public.seat_integration_catalog
      as catalog
      on catalog.integration_key =
        requested.integration_key

    join public.seat_product_integrations
      as product_integration
      on product_integration.integration_id =
        catalog.id
      and product_integration.product_id =
        onboarding_record.product_id

    where
      requested.integration_key =
        selected.key_value

      and catalog.visibility =
        'client'

      and catalog.status =
        'available'

      and product_integration.availability in (
        'optional',
        'included',
        'required'
      )
  )

  limit 1;


  if invalid_key is not null then
    raise exception
      'An integration is not available for this Campaign Seat account: %',
      invalid_key;
  end if;


  insert into
  public.seat_product_account_integrations (
    product_account_id,
    user_id,
    integration_id,
    connection_key,
    status,
    display_name,
    connection_metadata
  )

  select
    onboarding_record.product_account_id,
    actor_user_id,
    catalog.id,
    'primary',
    'not_connected',
    catalog.display_name,

    jsonb_build_object(
      'onboarding_selected',
      true,

      'oauth_required',
      catalog.auth_type = 'oauth2',

      'provider',
      catalog.provider,

      'selected_at',
      now(),

      'selected_by',
      actor_user_id,

      'connection_requirement',
      'before_activation'
    )

  from public.seat_integration_catalog
    as catalog

  where catalog.integration_key =
    any(normalized_keys)

  on conflict (
    product_account_id,
    integration_id,
    connection_key
  )

  do update
  set
    user_id =
      excluded.user_id,

    display_name =
      excluded.display_name,

    connection_metadata =
      public.seat_product_account_integrations
        .connection_metadata ||
      excluded.connection_metadata,

    updated_at =
      now();


  delete from
  public.seat_product_account_integrations
    as connection

  using public.seat_integration_catalog
    as catalog

  where
    connection.integration_id =
      catalog.id

    and connection.product_account_id =
      onboarding_record.product_account_id

    and connection.status =
      'not_connected'

    and coalesce(
      connection.connection_metadata
        ->> 'onboarding_selected',
      'false'
    ) = 'true'

    and catalog.integration_key in (
      select requested.integration_key

      from jsonb_array_elements_text(
        coalesce(
          onboarding_record.step_data
            -> 'requested_integration_keys',
          '[]'::jsonb
        )
      ) requested(integration_key)
    )

    and not (
      catalog.integration_key =
      any(normalized_keys)
    );


  select count(*)
  into pending_count

  from public.seat_product_account_integrations
    as connection

  join public.seat_integration_catalog
    as catalog
    on catalog.id =
      connection.integration_id

  where
    connection.product_account_id =
      onboarding_record.product_account_id

    and catalog.integration_key =
      any(normalized_keys)

    and connection.status <>
      'connected';


  update public.seat_onboarding_run_steps
  set
    status =
      'complete',

    step_data =
      coalesce(
        step_data,
        '{}'::jsonb
      ) ||
      jsonb_build_object(
        'selected_integration_keys',
        to_jsonb(
          normalized_keys
        ),

        'provider_connections_pending',
        pending_count,

        'connection_requirement',
        'before_activation',

        'oauth_connection_state',
        case
          when pending_count = 0
          then 'connected'
          else 'pending'
        end
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
      'integrations';


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
      'team'

    and status =
      'pending';


  update public.seat_onboarding_runs
  set
    current_step_key =
      'team',

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
    'seat_integrations_selected',
    'notice',
    onboarding_record.customer_id,
    'seat_product_account',
    onboarding_record.product_account_id::text,

    jsonb_build_object(
      'onboarding_run_id',
      onboarding_record.onboarding_run_id,

      'integration_keys',
      to_jsonb(
        normalized_keys
      ),

      'provider_connections_pending',
      pending_count
    ),

    now()
  );


  return jsonb_build_object(
    'ok',
    true,

    'current_step_key',
    'team',

    'selected_integration_keys',
    to_jsonb(
      normalized_keys
    ),

    'provider_connections_pending',
    pending_count
  );
end;
$seat_integration_save$;


revoke all
on function
public.save_my_seat_integration_setup(
  text[]
)
from
  public,
  anon;


grant execute
on function
public.save_my_seat_integration_setup(
  text[]
)
to authenticated;


notify pgrst, 'reload schema';

commit;

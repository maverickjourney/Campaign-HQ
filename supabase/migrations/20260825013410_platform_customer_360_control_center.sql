-- ============================================================
-- CAMPAIGN SEAT
-- CUSTOMER 360 CONTROL CENTER
-- ============================================================
--
-- Adds:
--   * guarded Customer 360 loader
--   * fresh TOTP verification for sensitive Admin actions
--   * audited manual billing management
--   * audited product-module entitlement management
--   * audited account lifecycle management
--
-- Existing Workspace Draft / Preview / Publish remains separate.
-- ============================================================


-- ============================================================
-- FRESH PLATFORM ADMIN TOTP
--
-- Sensitive operations require the latest TOTP verification
-- to be no older than the supplied age.
-- ============================================================

create or replace function
private.platform_admin_recent_totp(
  max_age_seconds integer default 300
)
returns boolean
language sql
stable
set search_path =
  pg_catalog,
  auth,
  pg_temp
as $$
  select exists (
    select 1

    from jsonb_array_elements(
      coalesce(
        auth.jwt() -> 'amr',
        '[]'::jsonb
      )
    ) as method

    where
      method ->> 'method' =
        'totp'

      and coalesce(
        method ->> 'timestamp',
        ''
      ) ~ '^[0-9]+$'

      and (
        method ->> 'timestamp'
      )::bigint >=
        extract(
          epoch from now()
        )::bigint
        -
        greatest(
          coalesce(
            max_age_seconds,
            300
          ),
          0
        )
  );
$$;


revoke all
on function
private.platform_admin_recent_totp(integer)
from public, anon, authenticated;


-- ============================================================
-- CUSTOMER 360 LOADER
-- ============================================================

create or replace function
public.get_platform_customer_control_center(
  target_workspace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $$
declare
  binding_row
    public.seat_workspace_bindings%rowtype;

  account_row
    public.seat_product_accounts%rowtype;

  customer_row
    public.seat_customers%rowtype;

  subscription_row
    public.seat_subscriptions%rowtype;

  billing_contact_row
    public.seat_customer_contacts%rowtype;

  subscription_json jsonb;
  billing_contact_json jsonb;
  entitlements_json jsonb;
  integrations_json jsonb;
  team_json jsonb;
  onboarding_json jsonb;
  audit_json jsonb;
begin

  if not
    public.seat_platform_admin_authorized()
  then
    raise exception
      'Seat Platform Admin authorization with MFA is required.'
      using errcode = '42501';
  end if;


  select *
  into binding_row
  from public.seat_workspace_bindings
  where
    workspace_id =
      target_workspace_id
    and status =
      'active'
  order by
    case
      when relationship_type =
        'primary'
      then 0
      else 1
    end,
    created_at
  limit 1;


  if not found then
    raise exception
      'An active Seat workspace binding could not be found.';
  end if;


  select *
  into account_row
  from public.seat_product_accounts
  where id =
    binding_row.product_account_id;


  if not found then
    raise exception
      'Seat product account could not be found.';
  end if;


  select *
  into customer_row
  from public.seat_customers
  where id =
    account_row.customer_id;


  if not found then
    raise exception
      'Seat customer could not be found.';
  end if;


  select *
  into subscription_row
  from public.seat_subscriptions
  where product_account_id =
    account_row.id
  order by
    created_at desc
  limit 1;


  if subscription_row.id
    is not null
  then
    subscription_json :=
      jsonb_build_object(
        'id',
          subscription_row.id,

        'package_id',
          subscription_row.package_id,

        'package_name',
          subscription_row.package_name_snapshot,

        'billing_provider',
          subscription_row.billing_provider,

        'status',
          subscription_row.status,

        'currency',
          subscription_row.currency,

        'monthly_amount_cents',
          subscription_row.monthly_amount_cents,

        'annual_amount_cents',
          subscription_row.annual_amount_cents,

        'onboarding_fee_cents',
          subscription_row.onboarding_fee_cents,

        'included_user_seats',
          subscription_row.included_user_seats,

        'external_customer_id',
          subscription_row.external_customer_id,

        'external_subscription_id',
          subscription_row.external_subscription_id,

        'starts_at',
          subscription_row.starts_at,

        'trial_ends_at',
          subscription_row.trial_ends_at,

        'current_period_start',
          subscription_row.current_period_start,

        'current_period_end',
          subscription_row.current_period_end,

        'cancelled_at',
          subscription_row.cancelled_at,

        'updated_at',
          subscription_row.updated_at
      );
  else
    subscription_json :=
      null;
  end if;


  select *
  into billing_contact_row
  from public.seat_customer_contacts
  where
    customer_id =
      customer_row.id
    and status =
      'active'
  order by
    coalesce(
      is_billing,
      false
    ) desc,

    coalesce(
      is_primary,
      false
    ) desc,

    created_at
  limit 1;


  if billing_contact_row.id
    is not null
  then
    billing_contact_json :=
      jsonb_build_object(
        'id',
          billing_contact_row.id,

        'full_name',
          billing_contact_row.full_name,

        'billing_name',
          coalesce(
            billing_contact_row.metadata
              ->> 'billing_contact_name',

            billing_contact_row.full_name
          ),

        'email',
          billing_contact_row.email,

        'phone',
          billing_contact_row.phone,

        'title',
          billing_contact_row.title,

        'is_primary',
          billing_contact_row.is_primary,

        'is_billing',
          billing_contact_row.is_billing
      );
  else
    billing_contact_json :=
      null;
  end if;


  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',
            entitlement.id,

          'module_id',
            module.id,

          'module_key',
            module.module_key,

          'display_name',
            module.display_name,

          'module_scope',
            module.module_scope,

          'enabled',
            entitlement.enabled,

          'source_type',
            entitlement.source_type,

          'source_reference',
            entitlement.source_reference,

          'limits',
            entitlement.limits,

          'expires_at',
            entitlement.expires_at
        )
        order by
          module.display_name
      ),
      '[]'::jsonb
    )
  into entitlements_json

  from public.seat_entitlements
    as entitlement

  join public.seat_modules
    as module
    on module.id =
      entitlement.module_id

  where
    entitlement.product_account_id =
      account_row.id;


  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',
            integration.id,

          'integration_id',
            catalog.id,

          'integration_key',
            catalog.integration_key,

          'integration_name',
            catalog.display_name,

          'category',
            catalog.category,

          'status',
            integration.status,

          'display_name',
            integration.display_name,

          'display_email',
            integration.display_email,

          'external_account_id',
            integration.external_account_id,

          'last_synced_at',
            integration.last_synced_at
        )
        order by
          catalog.display_name
      ),
      '[]'::jsonb
    )
  into integrations_json

  from public.seat_product_account_integrations
    as integration

  join public.seat_integration_catalog
    as catalog
    on catalog.id =
      integration.integration_id

  where
    integration.product_account_id =
      account_row.id;


  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',
            member.id,

          'user_id',
            member.user_id,

          'full_name',
            profile.full_name,

          'email',
            profile.email,

          'role',
            member.role,

          'role_key',
            member.role_key,

          'display_title',
            member.display_title,

          'seat_type',
            member.seat_type,

          'dashboard_type',
            member.dashboard_type,

          'status',
            member.status,

          'membership_state',
            member.membership_state,

          'is_primary_contact',
            member.is_primary_contact,

          'joined_at',
            member.joined_at,

          'last_accessed_at',
            member.last_accessed_at
        )
        order by
          coalesce(
            member.is_primary_contact,
            false
          ) desc,
          profile.full_name,
          profile.email
      ),
      '[]'::jsonb
    )
  into team_json

  from public.workspace_members
    as member

  left join public.profiles
    as profile
    on profile.id =
      member.user_id

  where
    member.workspace_id =
      target_workspace_id;


  select
    jsonb_build_object(
      'id',
        onboarding.id,

      'status',
        onboarding.status,

      'current_step_key',
        onboarding.current_step_key,

      'started_at',
        onboarding.started_at,

      'completed_at',
        onboarding.completed_at,

      'updated_at',
        onboarding.updated_at
    )
  into onboarding_json

  from public.seat_onboarding_runs
    as onboarding

  where
    onboarding.product_account_id =
      account_row.id

  order by
    onboarding.created_at desc

  limit 1;


  select
    coalesce(
      jsonb_agg(
        to_jsonb(entry)
        order by
          entry.occurred_at desc
      ),
      '[]'::jsonb
    )
  into audit_json

  from (
    select
      audit.id,
      audit.actor_user_id,
      audit.action,
      audit.target_type,
      audit.target_id,
      audit.reason,
      audit.metadata,
      audit.occurred_at

    from private.platform_audit_log
      as audit

    where audit.workspace_id =
      target_workspace_id

    order by
      audit.occurred_at desc

    limit 50
  ) as entry;


  return
    jsonb_build_object(
      'customer',
        jsonb_build_object(
          'id',
            customer_row.id,

          'display_name',
            customer_row.display_name,

          'legal_name',
            customer_row.legal_name,

          'customer_type',
            customer_row.customer_type,

          'status',
            customer_row.status,

          'billing_email',
            customer_row.billing_email,

          'billing_address',
            customer_row.billing_address,

          'phone',
            customer_row.phone,

          'website_url',
            customer_row.website_url
        ),

      'product_account',
        jsonb_build_object(
          'id',
            account_row.id,

          'account_name',
            account_row.account_name,

          'status',
            account_row.status,

          'onboarding_status',
            account_row.onboarding_status,

          'activated_at',
            account_row.activated_at,

          'suspended_at',
            account_row.suspended_at,

          'cancelled_at',
            account_row.cancelled_at,

          'updated_at',
            account_row.updated_at
        ),

      'binding',
        jsonb_build_object(
          'id',
            binding_row.id,

          'workspace_id',
            binding_row.workspace_id,

          'relationship_type',
            binding_row.relationship_type,

          'status',
            binding_row.status
        ),

      'subscription',
        subscription_json,

      'billing_contact',
        billing_contact_json,

      'entitlements',
        entitlements_json,

      'team',
        team_json,

      'integrations',
        integrations_json,

      'onboarding',
        onboarding_json,

      'audit',
        audit_json,

      'security',
        jsonb_build_object(
          'aal2',
            (
              coalesce(
                auth.jwt() ->> 'aal',
                'aal1'
              ) = 'aal2'
            ),

          'recent_totp',
            private.platform_admin_recent_totp(
              300
            )
        )
    );
end;
$$;


-- ============================================================
-- MANUAL BILLING MANAGEMENT
--
-- Local plan edits are allowed only while billing_provider is
-- manual and there are no external provider IDs.
--
-- Future Stripe-connected subscriptions must use the Stripe-
-- aware management path instead of silently diverging here.
-- ============================================================

create or replace function
public.update_platform_manual_billing(
  target_workspace_id uuid,
  target_billing jsonb,
  expected_subscription_updated_at timestamptz default null,
  target_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $$
declare
  binding_row
    public.seat_workspace_bindings%rowtype;

  account_row
    public.seat_product_accounts%rowtype;

  customer_row
    public.seat_customers%rowtype;

  subscription_row
    public.seat_subscriptions%rowtype;

  billing_contact_row
    public.seat_customer_contacts%rowtype;

  billing_email_value text;
  billing_name_value text;
  billing_phone_value text;

  billing_address_value jsonb;

  monthly_value integer;
  annual_value integer;
  onboarding_fee_value integer;
  included_seats_value integer;

  subscription_status_value text;

  trial_ends_value timestamptz;
  current_period_end_value timestamptz;

  money_or_status_changed boolean;

  old_snapshot jsonb;
  new_snapshot jsonb;
begin

  if not
    public.seat_platform_admin_authorized()
  then
    raise exception
      'Seat Platform Admin authorization with MFA is required.'
      using errcode = '42501';
  end if;


  if not
    private.platform_admin_recent_totp(
      300
    )
  then
    raise exception
      'A fresh authenticator verification is required to change billing.'
      using errcode = '42501';
  end if;


  if
    target_billing is null
    or jsonb_typeof(
      target_billing
    ) <> 'object'
  then
    raise exception
      'Billing changes must be a JSON object.';
  end if;


  select *
  into binding_row
  from public.seat_workspace_bindings
  where
    workspace_id =
      target_workspace_id
    and status =
      'active'
  order by
    case
      when relationship_type =
        'primary'
      then 0
      else 1
    end
  limit 1;


  if not found then
    raise exception
      'Active workspace binding was not found.';
  end if;


  select *
  into account_row
  from public.seat_product_accounts
  where id =
    binding_row.product_account_id
  for update;


  select *
  into customer_row
  from public.seat_customers
  where id =
    account_row.customer_id
  for update;


  select *
  into subscription_row
  from public.seat_subscriptions
  where product_account_id =
    account_row.id
  order by
    created_at desc
  limit 1
  for update;


  if subscription_row.id
    is null
  then
    raise exception
      'Seat subscription was not found.';
  end if;


  if
    subscription_row.billing_provider
      <> 'manual'

    or subscription_row.external_customer_id
      is not null

    or subscription_row.external_subscription_id
      is not null
  then
    raise exception
      'This subscription is connected to an external billing provider and cannot be edited through manual billing controls.';
  end if;


  if
    expected_subscription_updated_at
      is not null

    and subscription_row.updated_at
      <> expected_subscription_updated_at
  then
    raise exception
      'Billing changed after this page was loaded. Reload before saving.';
  end if;


  billing_email_value :=
    case
      when target_billing ?
        'billing_email'
      then lower(
        btrim(
          coalesce(
            target_billing
              ->> 'billing_email',
            ''
          )
        )
      )
      else customer_row.billing_email
    end;


  if
    billing_email_value is null
    or billing_email_value = ''
    or position(
      '@' in billing_email_value
    ) <= 1
  then
    raise exception
      'A valid billing email is required.';
  end if;


  billing_name_value :=
    nullif(
      btrim(
        coalesce(
          target_billing
            ->> 'billing_name',
          ''
        )
      ),
      ''
    );


  billing_phone_value :=
    nullif(
      btrim(
        coalesce(
          target_billing
            ->> 'billing_phone',
          ''
        )
      ),
      ''
    );


  if target_billing ?
    'billing_address'
  then

    if jsonb_typeof(
      target_billing
        -> 'billing_address'
    ) <> 'object'
    then
      raise exception
        'Billing address must be an object.';
    end if;


    billing_address_value :=
      jsonb_strip_nulls(
        jsonb_build_object(
          'line1',
            nullif(
              btrim(
                target_billing
                  -> 'billing_address'
                  ->> 'line1'
              ),
              ''
            ),

          'line2',
            nullif(
              btrim(
                target_billing
                  -> 'billing_address'
                  ->> 'line2'
              ),
              ''
            ),

          'city',
            nullif(
              btrim(
                target_billing
                  -> 'billing_address'
                  ->> 'city'
              ),
              ''
            ),

          'state_region',
            nullif(
              btrim(
                target_billing
                  -> 'billing_address'
                  ->> 'state_region'
              ),
              ''
            ),

          'postal_code',
            nullif(
              btrim(
                target_billing
                  -> 'billing_address'
                  ->> 'postal_code'
              ),
              ''
            ),

          'country_code',
            nullif(
              upper(
                btrim(
                  target_billing
                    -> 'billing_address'
                    ->> 'country_code'
                )
              ),
              ''
            )
        )
      );


    if
      billing_address_value
        ->> 'line1'
        is null

      or billing_address_value
        ->> 'city'
        is null

      or billing_address_value
        ->> 'state_region'
        is null

      or billing_address_value
        ->> 'postal_code'
        is null

      or billing_address_value
        ->> 'country_code'
        is null
    then
      raise exception
        'Complete billing address information is required.';
    end if;

  else
    billing_address_value :=
      customer_row.billing_address;
  end if;


  monthly_value :=
    case
      when target_billing ?
        'monthly_amount_cents'
      then (
        target_billing
          ->> 'monthly_amount_cents'
      )::integer
      else subscription_row.monthly_amount_cents
    end;


  annual_value :=
    case
      when target_billing ?
        'annual_amount_cents'
      then (
        target_billing
          ->> 'annual_amount_cents'
      )::integer
      else subscription_row.annual_amount_cents
    end;


  onboarding_fee_value :=
    case
      when target_billing ?
        'onboarding_fee_cents'
      then (
        target_billing
          ->> 'onboarding_fee_cents'
      )::integer
      else subscription_row.onboarding_fee_cents
    end;


  included_seats_value :=
    case
      when target_billing ?
        'included_user_seats'
      then (
        target_billing
          ->> 'included_user_seats'
      )::integer
      else subscription_row.included_user_seats
    end;


  if
    monthly_value < 0
    or annual_value < 0
    or onboarding_fee_value < 0
    or included_seats_value < 0
  then
    raise exception
      'Billing amounts and included seats cannot be negative.';
  end if;


  subscription_status_value :=
    coalesce(
      nullif(
        btrim(
          target_billing
            ->> 'subscription_status'
        ),
        ''
      ),
      subscription_row.status
    );


  if subscription_status_value
    <> all(
      array[
        'pending_billing',
        'trial',
        'active',
        'past_due'
      ]::text[]
    )
  then
    raise exception
      'Use Account Lifecycle controls for suspended or cancelled accounts.';
  end if;


  trial_ends_value :=
    case
      when target_billing ?
        'trial_ends_at'
      then nullif(
        btrim(
          target_billing
            ->> 'trial_ends_at'
        ),
        ''
      )::timestamptz
      else subscription_row.trial_ends_at
    end;


  current_period_end_value :=
    case
      when target_billing ?
        'current_period_end'
      then nullif(
        btrim(
          target_billing
            ->> 'current_period_end'
        ),
        ''
      )::timestamptz
      else subscription_row.current_period_end
    end;


  money_or_status_changed :=
    monthly_value
      is distinct from
      subscription_row.monthly_amount_cents

    or annual_value
      is distinct from
      subscription_row.annual_amount_cents

    or onboarding_fee_value
      is distinct from
      subscription_row.onboarding_fee_cents

    or included_seats_value
      is distinct from
      subscription_row.included_user_seats

    or subscription_status_value
      is distinct from
      subscription_row.status

    or trial_ends_value
      is distinct from
      subscription_row.trial_ends_at

    or current_period_end_value
      is distinct from
      subscription_row.current_period_end;


  if
    money_or_status_changed

    and nullif(
      btrim(
        coalesce(
          target_reason,
          ''
        )
      ),
      ''
    ) is null
  then
    raise exception
      'Enter an internal reason for plan, price, seat, or subscription-status changes.';
  end if;


  old_snapshot :=
    jsonb_build_object(
      'billing_email',
        customer_row.billing_email,

      'billing_address',
        customer_row.billing_address,

      'subscription_status',
        subscription_row.status,

      'monthly_amount_cents',
        subscription_row.monthly_amount_cents,

      'annual_amount_cents',
        subscription_row.annual_amount_cents,

      'onboarding_fee_cents',
        subscription_row.onboarding_fee_cents,

      'included_user_seats',
        subscription_row.included_user_seats,

      'trial_ends_at',
        subscription_row.trial_ends_at,

      'current_period_end',
        subscription_row.current_period_end
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
    customer_row.id;


  select *
  into billing_contact_row
  from public.seat_customer_contacts
  where
    customer_id =
      customer_row.id
    and status =
      'active'
  order by
    coalesce(
      is_billing,
      false
    ) desc,

    coalesce(
      is_primary,
      false
    ) desc,

    created_at
  limit 1
  for update;


  if billing_contact_row.id
    is not null
  then
    update public.seat_customer_contacts
    set
      is_billing =
        true,

      phone =
        case
          when target_billing ?
            'billing_phone'
          then billing_phone_value
          else phone
        end,

      metadata =
        coalesce(
          metadata,
          '{}'::jsonb
        )
        ||
        case
          when billing_name_value
            is not null
          then jsonb_build_object(
            'billing_contact_name',
            billing_name_value
          )
          else '{}'::jsonb
        end,

      updated_at =
        now()

    where id =
      billing_contact_row.id;
  end if;


  update public.seat_subscriptions
  set
    status =
      subscription_status_value,

    monthly_amount_cents =
      monthly_value,

    annual_amount_cents =
      annual_value,

    onboarding_fee_cents =
      onboarding_fee_value,

    included_user_seats =
      included_seats_value,

    trial_ends_at =
      trial_ends_value,

    current_period_end =
      current_period_end_value,

    metadata =
      coalesce(
        metadata,
        '{}'::jsonb
      ) ||
      jsonb_build_object(
        'platform_admin_last_billing_update_at',
          now(),

        'platform_admin_last_billing_update_by',
          auth.uid(),

        'platform_admin_last_billing_update_reason',
          nullif(
            btrim(
              coalesce(
                target_reason,
                ''
              )
            ),
            ''
          )
      ),

    updated_at =
      now()

  where id =
    subscription_row.id;


  new_snapshot :=
    jsonb_build_object(
      'billing_email',
        billing_email_value,

      'billing_address',
        billing_address_value,

      'subscription_status',
        subscription_status_value,

      'monthly_amount_cents',
        monthly_value,

      'annual_amount_cents',
        annual_value,

      'onboarding_fee_cents',
        onboarding_fee_value,

      'included_user_seats',
        included_seats_value,

      'trial_ends_at',
        trial_ends_value,

      'current_period_end',
        current_period_end_value
    );


  insert into
  private.platform_audit_log (
    actor_user_id,
    workspace_id,
    action,
    target_type,
    target_id,
    reason,
    metadata
  )
  values (
    auth.uid(),
    target_workspace_id,
    'customer_billing_updated',
    'seat_subscription',
    subscription_row.id::text,
    nullif(
      btrim(
        coalesce(
          target_reason,
          ''
        )
      ),
      ''
    ),
    jsonb_build_object(
      'old',
        old_snapshot,

      'new',
        new_snapshot,

      'billing_provider',
        subscription_row.billing_provider
    )
  );


  return
    public.get_platform_customer_control_center(
      target_workspace_id
    );
end;
$$;


-- ============================================================
-- MODULE / ENTITLEMENT MANAGEMENT
-- ============================================================

create or replace function
public.set_platform_customer_module(
  target_workspace_id uuid,
  target_module_key text,
  target_enabled boolean,
  target_reason text
)
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $$
declare
  binding_row
    public.seat_workspace_bindings%rowtype;

  account_row
    public.seat_product_accounts%rowtype;

  module_row
    public.seat_modules%rowtype;

  existing_row
    public.seat_entitlements%rowtype;
begin

  if not
    public.seat_platform_admin_authorized()
  then
    raise exception
      'Seat Platform Admin authorization with MFA is required.'
      using errcode = '42501';
  end if;


  if not
    private.platform_admin_recent_totp(
      300
    )
  then
    raise exception
      'A fresh authenticator verification is required to change product access.'
      using errcode = '42501';
  end if;


  if nullif(
    btrim(
      coalesce(
        target_reason,
        ''
      )
    ),
    ''
  ) is null
  then
    raise exception
      'An internal reason is required for module changes.';
  end if;


  select *
  into binding_row
  from public.seat_workspace_bindings
  where
    workspace_id =
      target_workspace_id
    and status =
      'active'
  limit 1;


  if not found then
    raise exception
      'Active workspace binding was not found.';
  end if;


  select *
  into account_row
  from public.seat_product_accounts
  where id =
    binding_row.product_account_id;


  select *
  into module_row
  from public.seat_modules
  where module_key =
    lower(
      btrim(
        target_module_key
      )
    );


  if not found then
    raise exception
      'Seat module could not be found.';
  end if;


  select *
  into existing_row
  from public.seat_entitlements
  where
    product_account_id =
      account_row.id

    and module_id =
      module_row.id
  for update;


  insert into public.seat_entitlements (
    product_account_id,
    module_id,
    enabled,
    source_type,
    source_reference,
    limits,
    metadata,
    updated_at
  )
  values (
    account_row.id,
    module_row.id,
    target_enabled,
    'manual',
    'platform_admin',
    coalesce(
      existing_row.limits,
      '{}'::jsonb
    ),
    coalesce(
      existing_row.metadata,
      '{}'::jsonb
    ) ||
    jsonb_build_object(
      'platform_admin_override',
        true,

      'platform_admin_reason',
        target_reason,

      'platform_admin_changed_by',
        auth.uid(),

      'platform_admin_changed_at',
        now(),

      'previous_source_type',
        existing_row.source_type,

      'previous_source_reference',
        existing_row.source_reference
    ),
    now()
  )

  on conflict (
    product_account_id,
    module_id
  )

  do update set
    enabled =
      excluded.enabled,

    source_type =
      'manual',

    source_reference =
      'platform_admin',

    metadata =
      excluded.metadata,

    updated_at =
      now();


  insert into
  private.platform_audit_log (
    actor_user_id,
    workspace_id,
    action,
    target_type,
    target_id,
    reason,
    metadata
  )
  values (
    auth.uid(),
    target_workspace_id,
    case
      when target_enabled
      then 'customer_module_enabled'
      else 'customer_module_disabled'
    end,
    'seat_entitlement',
    module_row.id::text,
    target_reason,
    jsonb_build_object(
      'module_key',
        module_row.module_key,

      'module_name',
        module_row.display_name,

      'old_enabled',
        existing_row.enabled,

      'new_enabled',
        target_enabled,

      'previous_source_type',
        existing_row.source_type,

      'previous_source_reference',
        existing_row.source_reference
    )
  );


  return
    public.get_platform_customer_control_center(
      target_workspace_id
    );
end;
$$;


-- ============================================================
-- ACCOUNT ACCESS LIFECYCLE
--
-- Subscription billing status remains separately managed.
-- This controls product access only.
-- ============================================================

create or replace function
public.set_platform_customer_account_status(
  target_workspace_id uuid,
  target_status text,
  target_reason text
)
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $$
declare
  binding_row
    public.seat_workspace_bindings%rowtype;

  account_row
    public.seat_product_accounts%rowtype;

  normalized_status text :=
    lower(
      btrim(
        coalesce(
          target_status,
          ''
        )
      )
    );
begin

  if not
    public.seat_platform_admin_authorized()
  then
    raise exception
      'Seat Platform Admin authorization with MFA is required.'
      using errcode = '42501';
  end if;


  if not
    private.platform_admin_recent_totp(
      300
    )
  then
    raise exception
      'A fresh authenticator verification is required to change account access.'
      using errcode = '42501';
  end if;


  if normalized_status
    <> all(
      array[
        'active',
        'suspended',
        'cancelled'
      ]::text[]
    )
  then
    raise exception
      'Account status must be active, suspended, or cancelled.';
  end if;


  if nullif(
    btrim(
      coalesce(
        target_reason,
        ''
      )
    ),
    ''
  ) is null
  then
    raise exception
      'An internal reason is required for account lifecycle changes.';
  end if;


  select *
  into binding_row
  from public.seat_workspace_bindings
  where
    workspace_id =
      target_workspace_id
    and status =
      'active'
  limit 1;


  if not found then
    raise exception
      'Active workspace binding was not found.';
  end if;


  select *
  into account_row
  from public.seat_product_accounts
  where id =
    binding_row.product_account_id
  for update;


  if
    account_row.status =
      'cancelled'

    and normalized_status <>
      'cancelled'
  then
    raise exception
      'Cancelled Seat accounts require a separate reactivation workflow.';
  end if;


  update public.seat_product_accounts
  set
    status =
      normalized_status,

    activated_at =
      case
        when normalized_status =
          'active'
        then coalesce(
          activated_at,
          now()
        )
        else activated_at
      end,

    suspended_at =
      case
        when normalized_status =
          'suspended'
        then now()

        when normalized_status =
          'active'
        then null

        else suspended_at
      end,

    cancelled_at =
      case
        when normalized_status =
          'cancelled'
        then coalesce(
          cancelled_at,
          now()
        )
        else cancelled_at
      end,

    metadata =
      coalesce(
        metadata,
        '{}'::jsonb
      ) ||
      jsonb_build_object(
        'platform_admin_last_status_reason',
          target_reason,

        'platform_admin_last_status_by',
          auth.uid(),

        'platform_admin_last_status_at',
          now()
      ),

    updated_at =
      now()

  where id =
    account_row.id;


  insert into
  private.platform_audit_log (
    actor_user_id,
    workspace_id,
    action,
    target_type,
    target_id,
    reason,
    metadata
  )
  values (
    auth.uid(),
    target_workspace_id,
    'customer_account_status_changed',
    'seat_product_account',
    account_row.id::text,
    target_reason,
    jsonb_build_object(
      'old_status',
        account_row.status,

      'new_status',
        normalized_status
    )
  );


  return
    public.get_platform_customer_control_center(
      target_workspace_id
    );
end;
$$;


-- ============================================================
-- PERMISSIONS
-- ============================================================

revoke all
on function
public.get_platform_customer_control_center(uuid)
from public, anon, authenticated;

revoke all
on function
public.update_platform_manual_billing(uuid, jsonb, timestamptz, text)
from public, anon, authenticated;

revoke all
on function
public.set_platform_customer_module(uuid, text, boolean, text)
from public, anon, authenticated;

revoke all
on function
public.set_platform_customer_account_status(uuid, text, text)
from public, anon, authenticated;


grant execute
on function
public.get_platform_customer_control_center(uuid)
to authenticated;

grant execute
on function
public.update_platform_manual_billing(uuid, jsonb, timestamptz, text)
to authenticated;

grant execute
on function
public.set_platform_customer_module(uuid, text, boolean, text)
to authenticated;

grant execute
on function
public.set_platform_customer_account_status(uuid, text, text)
to authenticated;


comment on function
public.get_platform_customer_control_center(uuid)
is
'Seat Platform Admin AAL2-only Customer 360 data loader.';

comment on function
public.update_platform_manual_billing(uuid, jsonb, timestamptz, text)
is
'Seat Platform Admin manual-billing management. Requires recent TOTP and creates an Admin audit event.';

comment on function
public.set_platform_customer_module(uuid, text, boolean, text)
is
'Seat Platform Admin module-entitlement override. Requires recent TOTP, reason, and audit event.';

comment on function
public.set_platform_customer_account_status(uuid, text, text)
is
'Seat Platform Admin product-access lifecycle control. Requires recent TOTP, reason, and audit event.';

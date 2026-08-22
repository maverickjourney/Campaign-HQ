-- ============================================================
-- SEAT PLATFORM
-- COMMERCIAL + CUSTOMER + PRODUCT FOUNDATION
--
-- Product-neutral foundation for:
--   Campaign Seat
--   Firm Seat
--   District Seat
--   future Seat products / industries
--
-- SECURITY PRINCIPLES
-- ------------------------------------------------------------
-- * Reuses authoritative public.platform_staff
-- * Reuses public.has_platform_role(text[])
-- * Platform-admin direct access requires MFA / AAL2
-- * RLS enabled on every public Seat commercial table
-- * No anonymous direct table access
-- * No passwords stored here
-- * No credit-card data stored here
-- * No OAuth access/refresh tokens stored here
-- * Approved commercial records are retained, not hard deleted
-- * Client access is workspace/customer scoped
--
-- EXISTING CAMPAIGN SEAT RUNTIME IS PRESERVED
-- ------------------------------------------------------------
-- public.workspace_subscriptions remains authoritative for
-- the currently deployed Campaign Seat workspace runtime.
--
-- This migration creates the broader Seat Platform commercial
-- layer above that runtime. A later bridge will synchronize
-- activated Seat subscriptions/entitlements into each product.
-- ============================================================

begin;

create extension if not exists pgcrypto;

create schema if not exists private;

revoke all
on schema private
from public, anon, authenticated;

grant usage
on schema private
to service_role;


-- ============================================================
-- REQUIRED EXISTING SECURITY FOUNDATION
-- ============================================================

do $seat_preflight$
begin
  if to_regclass(
    'public.platform_staff'
  ) is null then
    raise exception
      'Seat Platform requires the existing public.platform_staff security model.';
  end if;

  if to_regclass(
    'public.profiles'
  ) is null then
    raise exception
      'Seat Platform requires public.profiles.';
  end if;

  if to_regclass(
    'public.workspaces'
  ) is null then
    raise exception
      'Seat Platform requires public.workspaces.';
  end if;

  if to_regclass(
    'public.workspace_members'
  ) is null then
    raise exception
      'Seat Platform requires public.workspace_members.';
  end if;

  if to_regprocedure(
    'public.has_platform_role(text[])'
  ) is null then
    raise exception
      'Seat Platform requires public.has_platform_role(text[]).';
  end if;

  if to_regprocedure(
    'public.set_campaign_updated_at()'
  ) is null then
    raise exception
      'Seat Platform requires the existing updated-at trigger helper.';
  end if;
end
$seat_preflight$;


-- ============================================================
-- PLATFORM ADMIN AUTHORIZATION
--
-- Email address alone NEVER grants admin access.
--
-- A user must:
--   1. be authenticated
--   2. hold an active public.platform_staff record
--   3. hold platform_owner or platform_admin
--   4. have an aal2 MFA session
-- ============================================================

create or replace function
public.seat_platform_admin_authorized()
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $seat_platform$
  select
    auth.uid() is not null
    and coalesce(
      auth.jwt()->>'aal',
      'aal1'
    ) = 'aal2'
    and public.has_platform_role(
      array[
        'platform_owner',
        'platform_admin'
      ]::text[]
    );
$seat_platform$;

revoke all
on function
public.seat_platform_admin_authorized()
from public, anon;

grant execute
on function
public.seat_platform_admin_authorized()
to authenticated, service_role;


-- ============================================================
-- PRODUCTS
-- ============================================================

create table
public.seat_products (
  id uuid primary key
    default gen_random_uuid(),

  product_key text not null unique,

  product_name text not null,

  short_name text not null,

  workspace_label text not null,

  hq_label text not null,

  ask_ai_label text,

  tool_group_label text,

  status text not null
    default 'planned',

  description text,

  metadata jsonb not null
    default '{}'::jsonb,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint seat_products_key_check
  check (
    product_key ~
      '^[a-z][a-z0-9_]{1,63}$'
  ),

  constraint seat_products_status_check
  check (
    status in (
      'planned',
      'active',
      'hidden',
      'retired'
    )
  ),

  constraint seat_products_metadata_check
  check (
    jsonb_typeof(metadata) = 'object'
  )
);


-- ============================================================
-- MODULE CATALOG
-- ============================================================

create table
public.seat_modules (
  id uuid primary key
    default gen_random_uuid(),

  module_key text not null unique,

  display_name text not null,

  description text,

  module_scope text not null
    default 'core',

  default_route text,

  default_nav_group text,

  default_sort_order integer not null
    default 100,

  data_classification text not null
    default 'standard',

  status text not null
    default 'active',

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint seat_modules_key_check
  check (
    module_key ~
      '^[a-z][a-z0-9_]{1,63}$'
  ),

  constraint seat_modules_scope_check
  check (
    module_scope in (
      'core',
      'platform',
      'product'
    )
  ),

  constraint seat_modules_classification_check
  check (
    data_classification in (
      'standard',
      'sensitive',
      'restricted'
    )
  ),

  constraint seat_modules_status_check
  check (
    status in (
      'active',
      'hidden',
      'retired'
    )
  ),

  constraint seat_modules_metadata_check
  check (
    jsonb_typeof(metadata) = 'object'
  )
);


create table
public.seat_product_modules (
  product_id uuid not null
    references public.seat_products(id)
    on delete cascade,

  module_id uuid not null
    references public.seat_modules(id)
    on delete restrict,

  enabled boolean not null
    default true,

  required boolean not null
    default false,

  default_enabled boolean not null
    default true,

  display_label text,

  route_override text,

  nav_group text,

  sort_order integer not null
    default 100,

  config jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  primary key (
    product_id,
    module_id
  ),

  constraint seat_product_modules_config_check
  check (
    jsonb_typeof(config) = 'object'
  )
);


-- ============================================================
-- PACKAGE / PLAN CATALOG
-- ============================================================

create table
public.seat_packages (
  id uuid primary key
    default gen_random_uuid(),

  product_id uuid not null
    references public.seat_products(id)
    on delete restrict,

  package_key text not null,

  display_name text not null,

  description text,

  status text not null
    default 'draft',

  pricing_model text not null
    default 'custom',

  currency text not null
    default 'USD',

  monthly_price_cents integer,

  annual_price_cents integer,

  onboarding_fee_cents integer,

  included_user_seats integer,

  contract_term_months integer,

  is_public boolean not null
    default false,

  metadata jsonb not null
    default '{}'::jsonb,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  unique (
    product_id,
    package_key
  ),

  constraint seat_packages_status_check
  check (
    status in (
      'draft',
      'active',
      'hidden',
      'retired'
    )
  ),

  constraint seat_packages_pricing_check
  check (
    pricing_model in (
      'fixed',
      'custom',
      'usage',
      'hybrid'
    )
  ),

  constraint seat_packages_currency_check
  check (
    currency ~ '^[A-Z]{3}$'
  ),

  constraint seat_packages_prices_check
  check (
    (
      monthly_price_cents is null
      or monthly_price_cents >= 0
    )
    and (
      annual_price_cents is null
      or annual_price_cents >= 0
    )
    and (
      onboarding_fee_cents is null
      or onboarding_fee_cents >= 0
    )
  ),

  constraint seat_packages_seats_check
  check (
    included_user_seats is null
    or included_user_seats >= 0
  ),

  constraint seat_packages_term_check
  check (
    contract_term_months is null
    or contract_term_months >= 0
  ),

  constraint seat_packages_metadata_check
  check (
    jsonb_typeof(metadata) = 'object'
  )
);


create table
public.seat_package_modules (
  package_id uuid not null
    references public.seat_packages(id)
    on delete cascade,

  module_id uuid not null
    references public.seat_modules(id)
    on delete restrict,

  included boolean not null
    default true,

  limit_value bigint,

  limit_unit text,

  config jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  primary key (
    package_id,
    module_id
  ),

  constraint seat_package_module_limit_check
  check (
    limit_value is null
    or limit_value >= 0
  ),

  constraint seat_package_modules_config_check
  check (
    jsonb_typeof(config) = 'object'
  )
);


create table
public.seat_addons (
  id uuid primary key
    default gen_random_uuid(),

  product_id uuid
    references public.seat_products(id)
    on delete restrict,

  addon_key text not null,

  display_name text not null,

  description text,

  status text not null
    default 'draft',

  billing_cadence text not null
    default 'one_time',

  currency text not null
    default 'USD',

  unit_price_cents integer,

  setup_price_cents integer,

  configurable boolean not null
    default true,

  metadata jsonb not null
    default '{}'::jsonb,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint seat_addons_status_check
  check (
    status in (
      'draft',
      'active',
      'hidden',
      'retired'
    )
  ),

  constraint seat_addons_cadence_check
  check (
    billing_cadence in (
      'one_time',
      'monthly',
      'annual',
      'usage'
    )
  ),

  constraint seat_addons_currency_check
  check (
    currency ~ '^[A-Z]{3}$'
  ),

  constraint seat_addons_prices_check
  check (
    (
      unit_price_cents is null
      or unit_price_cents >= 0
    )
    and (
      setup_price_cents is null
      or setup_price_cents >= 0
    )
  ),

  constraint seat_addons_metadata_check
  check (
    jsonb_typeof(metadata) = 'object'
  )
);

create unique index
seat_addons_product_key_unique
on public.seat_addons (
  product_id,
  addon_key
)
where product_id is not null;

create unique index
seat_addons_shared_key_unique
on public.seat_addons (
  addon_key
)
where product_id is null;


-- ============================================================
-- CUSTOMERS / ORGANIZATIONS
-- ============================================================

create table
public.seat_customers (
  id uuid primary key
    default gen_random_uuid(),

  display_name text not null,

  legal_name text,

  customer_type text not null
    default 'organization',

  status text not null
    default 'prospect',

  billing_email text,

  phone text,

  website_url text,

  billing_address jsonb not null
    default '{}'::jsonb,

  metadata jsonb not null
    default '{}'::jsonb,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint seat_customers_type_check
  check (
    customer_type in (
      'campaign',
      'firm',
      'government',
      'association',
      'nonprofit',
      'business',
      'organization',
      'individual',
      'other'
    )
  ),

  constraint seat_customers_status_check
  check (
    status in (
      'prospect',
      'onboarding',
      'active',
      'paused',
      'cancelled'
    )
  ),

  constraint seat_customers_address_check
  check (
    jsonb_typeof(billing_address) =
      'object'
  ),

  constraint seat_customers_metadata_check
  check (
    jsonb_typeof(metadata) =
      'object'
  )
);


create table
public.seat_customer_contacts (
  id uuid primary key
    default gen_random_uuid(),

  customer_id uuid not null
    references public.seat_customers(id)
    on delete restrict,

  user_id uuid
    references auth.users(id)
    on delete set null,

  full_name text not null,

  email text not null,

  phone text,

  title text,

  is_primary boolean not null
    default false,

  is_billing boolean not null
    default false,

  is_onboarding boolean not null
    default false,

  status text not null
    default 'active',

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint seat_customer_contacts_status_check
  check (
    status in (
      'active',
      'inactive'
    )
  ),

  constraint seat_customer_contacts_metadata_check
  check (
    jsonb_typeof(metadata) =
      'object'
  )
);

create unique index
seat_customer_contact_email_unique
on public.seat_customer_contacts (
  customer_id,
  lower(email)
)
where status = 'active';

create unique index
seat_customer_primary_contact_unique
on public.seat_customer_contacts (
  customer_id
)
where
  is_primary = true
  and status = 'active';


-- ============================================================
-- LEADS
-- ============================================================

create table
public.seat_leads (
  id uuid primary key
    default gen_random_uuid(),

  product_id uuid
    references public.seat_products(id)
    on delete set null,

  full_name text not null,

  email text not null,

  phone text,

  organization_name text,

  source text not null
    default 'manual',

  status text not null
    default 'new',

  notes text,

  assigned_to uuid
    references auth.users(id)
    on delete set null,

  converted_customer_id uuid
    references public.seat_customers(id)
    on delete set null,

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint seat_leads_status_check
  check (
    status in (
      'new',
      'contacted',
      'qualified',
      'disqualified',
      'converted'
    )
  ),

  constraint seat_leads_metadata_check
  check (
    jsonb_typeof(metadata) =
      'object'
  )
);


-- ============================================================
-- DEALS
-- ============================================================

create table
public.seat_deals (
  id uuid primary key
    default gen_random_uuid(),

  deal_code text not null unique
    default (
      'DL-' ||
      upper(
        substr(
          replace(
            gen_random_uuid()::text,
            '-',
            ''
          ),
          1,
          10
        )
      )
    ),

  lead_id uuid
    references public.seat_leads(id)
    on delete set null,

  customer_id uuid
    references public.seat_customers(id)
    on delete restrict,

  product_id uuid not null
    references public.seat_products(id)
    on delete restrict,

  stage text not null
    default 'discovery',

  currency text not null
    default 'USD',

  expected_monthly_cents integer,

  expected_setup_cents integer,

  contract_term_months integer,

  owner_user_id uuid
    references auth.users(id)
    on delete set null,

  notes text,

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint seat_deals_origin_check
  check (
    lead_id is not null
    or customer_id is not null
  ),

  constraint seat_deals_stage_check
  check (
    stage in (
      'discovery',
      'qualified',
      'proposal',
      'negotiation',
      'won',
      'lost',
      'onboarding'
    )
  ),

  constraint seat_deals_currency_check
  check (
    currency ~ '^[A-Z]{3}$'
  ),

  constraint seat_deals_prices_check
  check (
    (
      expected_monthly_cents is null
      or expected_monthly_cents >= 0
    )
    and (
      expected_setup_cents is null
      or expected_setup_cents >= 0
    )
  ),

  constraint seat_deals_term_check
  check (
    contract_term_months is null
    or contract_term_months >= 0
  ),

  constraint seat_deals_metadata_check
  check (
    jsonb_typeof(metadata) =
      'object'
  )
);


-- ============================================================
-- CLIENT PROPOSALS
--
-- access_token_hash stores ONLY the secure hash.
-- Plaintext client access tokens must never be stored.
-- ============================================================

create table
public.seat_proposals (
  id uuid primary key
    default gen_random_uuid(),

  proposal_code text not null unique
    default (
      'SP-' ||
      upper(
        substr(
          replace(
            gen_random_uuid()::text,
            '-',
            ''
          ),
          1,
          10
        )
      )
    ),

  deal_id uuid not null
    references public.seat_deals(id)
    on delete restrict,

  customer_id uuid
    references public.seat_customers(id)
    on delete restrict,

  product_id uuid not null
    references public.seat_products(id)
    on delete restrict,

  package_id uuid
    references public.seat_packages(id)
    on delete set null,

  client_name text not null,

  client_email text not null,

  status text not null
    default 'draft',

  version integer not null
    default 1,

  currency text not null
    default 'USD',

  monthly_total_cents integer not null
    default 0,

  annual_total_cents integer not null
    default 0,

  setup_total_cents integer not null
    default 0,

  contract_term_months integer,

  billing_start_date date,

  valid_until timestamptz,

  access_token_hash text unique,

  token_created_at timestamptz,

  sent_at timestamptz,

  viewed_at timestamptz,

  changes_requested_at timestamptz,

  approved_at timestamptz,

  approved_by_user_id uuid
    references auth.users(id)
    on delete set null,

  declined_at timestamptz,

  terms_summary jsonb not null
    default '{}'::jsonb,

  dashboard_config jsonb not null
    default '{}'::jsonb,

  onboarding_config jsonb not null
    default '{}'::jsonb,

  metadata jsonb not null
    default '{}'::jsonb,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint seat_proposals_status_check
  check (
    status in (
      'draft',
      'sent',
      'viewed',
      'changes_requested',
      'approved',
      'declined',
      'expired',
      'revoked'
    )
  ),

  constraint seat_proposals_version_check
  check (
    version >= 1
  ),

  constraint seat_proposals_currency_check
  check (
    currency ~ '^[A-Z]{3}$'
  ),

  constraint seat_proposals_totals_check
  check (
    monthly_total_cents >= 0
    and annual_total_cents >= 0
    and setup_total_cents >= 0
  ),

  constraint seat_proposals_term_check
  check (
    contract_term_months is null
    or contract_term_months >= 0
  ),

  constraint seat_proposals_terms_check
  check (
    jsonb_typeof(terms_summary) =
      'object'
  ),

  constraint seat_proposals_dashboard_check
  check (
    jsonb_typeof(dashboard_config) =
      'object'
  ),

  constraint seat_proposals_onboarding_check
  check (
    jsonb_typeof(onboarding_config) =
      'object'
  ),

  constraint seat_proposals_metadata_check
  check (
    jsonb_typeof(metadata) =
      'object'
  )
);


create table
public.seat_proposal_items (
  id uuid primary key
    default gen_random_uuid(),

  proposal_id uuid not null
    references public.seat_proposals(id)
    on delete cascade,

  item_type text not null,

  item_key text,

  package_id uuid
    references public.seat_packages(id)
    on delete set null,

  addon_id uuid
    references public.seat_addons(id)
    on delete set null,

  module_id uuid
    references public.seat_modules(id)
    on delete set null,

  display_name text not null,

  description text,

  quantity numeric(12,2) not null
    default 1,

  unit_amount_cents integer not null
    default 0,

  billing_cadence text not null
    default 'one_time',

  included boolean not null
    default false,

  sort_order integer not null
    default 100,

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint seat_proposal_items_type_check
  check (
    item_type in (
      'package',
      'module',
      'addon',
      'seat',
      'integration',
      'service',
      'migration',
      'discount',
      'custom'
    )
  ),

  constraint seat_proposal_items_quantity_check
  check (
    quantity > 0
  ),

  constraint seat_proposal_items_cadence_check
  check (
    billing_cadence in (
      'none',
      'one_time',
      'monthly',
      'annual',
      'usage'
    )
  ),

  constraint seat_proposal_items_metadata_check
  check (
    jsonb_typeof(metadata) =
      'object'
  )
);


-- ============================================================
-- PRODUCT ACCOUNTS
--
-- Customer = commercial/legal relationship.
-- Product account = customer's instance of a Seat product.
-- Workspace = operational workspace(s) underneath that account.
-- ============================================================

create table
public.seat_product_accounts (
  id uuid primary key
    default gen_random_uuid(),

  customer_id uuid not null
    references public.seat_customers(id)
    on delete restrict,

  product_id uuid not null
    references public.seat_products(id)
    on delete restrict,

  proposal_id uuid
    references public.seat_proposals(id)
    on delete set null,

  account_name text not null,

  primary_contact_id uuid
    references public.seat_customer_contacts(id)
    on delete set null,

  status text not null
    default 'pending_onboarding',

  onboarding_status text not null
    default 'not_started',

  activated_at timestamptz,

  suspended_at timestamptz,

  cancelled_at timestamptz,

  metadata jsonb not null
    default '{}'::jsonb,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint seat_product_accounts_status_check
  check (
    status in (
      'pending_onboarding',
      'onboarding',
      'active',
      'suspended',
      'cancelled'
    )
  ),

  constraint seat_product_accounts_onboarding_check
  check (
    onboarding_status in (
      'not_started',
      'in_progress',
      'blocked',
      'ready',
      'complete'
    )
  ),

  constraint seat_product_accounts_metadata_check
  check (
    jsonb_typeof(metadata) =
      'object'
  )
);


create table
public.seat_workspace_bindings (
  id uuid primary key
    default gen_random_uuid(),

  product_account_id uuid not null
    references public.seat_product_accounts(id)
    on delete cascade,

  workspace_id uuid not null unique
    references public.workspaces(id)
    on delete cascade,

  relationship_type text not null
    default 'primary',

  status text not null
    default 'active',

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint seat_workspace_bindings_relationship_check
  check (
    relationship_type in (
      'primary',
      'child',
      'client',
      'managed'
    )
  ),

  constraint seat_workspace_bindings_status_check
  check (
    status in (
      'active',
      'inactive'
    )
  ),

  constraint seat_workspace_bindings_metadata_check
  check (
    jsonb_typeof(metadata) =
      'object'
  )
);


-- ============================================================
-- GENERIC SEAT SUBSCRIPTIONS
--
-- Stripe fields are identifiers/status only.
-- Stripe will remain the payment-card system of record.
-- ============================================================

create table
public.seat_subscriptions (
  id uuid primary key
    default gen_random_uuid(),

  product_account_id uuid not null unique
    references public.seat_product_accounts(id)
    on delete restrict,

  package_id uuid
    references public.seat_packages(id)
    on delete set null,

  package_name_snapshot text,

  billing_provider text not null
    default 'pending',

  status text not null
    default 'pending_billing',

  currency text not null
    default 'USD',

  monthly_amount_cents integer not null
    default 0,

  annual_amount_cents integer not null
    default 0,

  onboarding_fee_cents integer not null
    default 0,

  included_user_seats integer,

  external_customer_id text,

  external_subscription_id text,

  starts_at timestamptz,

  trial_ends_at timestamptz,

  current_period_start timestamptz,

  current_period_end timestamptz,

  cancelled_at timestamptz,

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint seat_subscriptions_provider_check
  check (
    billing_provider in (
      'pending',
      'stripe',
      'manual'
    )
  ),

  constraint seat_subscriptions_status_check
  check (
    status in (
      'pending_billing',
      'trial',
      'active',
      'past_due',
      'suspended',
      'cancelled'
    )
  ),

  constraint seat_subscriptions_currency_check
  check (
    currency ~ '^[A-Z]{3}$'
  ),

  constraint seat_subscriptions_amounts_check
  check (
    monthly_amount_cents >= 0
    and annual_amount_cents >= 0
    and onboarding_fee_cents >= 0
  ),

  constraint seat_subscriptions_seats_check
  check (
    included_user_seats is null
    or included_user_seats >= 0
  ),

  constraint seat_subscriptions_metadata_check
  check (
    jsonb_typeof(metadata) =
      'object'
  )
);


-- ============================================================
-- RESOLVED MODULE ENTITLEMENTS
-- ============================================================

create table
public.seat_entitlements (
  id uuid primary key
    default gen_random_uuid(),

  product_account_id uuid not null
    references public.seat_product_accounts(id)
    on delete cascade,

  module_id uuid not null
    references public.seat_modules(id)
    on delete restrict,

  enabled boolean not null
    default true,

  source_type text not null
    default 'manual',

  source_reference text,

  limits jsonb not null
    default '{}'::jsonb,

  expires_at timestamptz,

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  unique (
    product_account_id,
    module_id
  ),

  constraint seat_entitlements_source_check
  check (
    source_type in (
      'package',
      'addon',
      'proposal',
      'manual',
      'system'
    )
  ),

  constraint seat_entitlements_limits_check
  check (
    jsonb_typeof(limits) =
      'object'
  ),

  constraint seat_entitlements_metadata_check
  check (
    jsonb_typeof(metadata) =
      'object'
  )
);


-- ============================================================
-- PRODUCT-DRIVEN ONBOARDING TEMPLATES
-- ============================================================

create table
public.seat_onboarding_templates (
  id uuid primary key
    default gen_random_uuid(),

  product_id uuid not null
    references public.seat_products(id)
    on delete restrict,

  template_key text not null,

  version integer not null
    default 1,

  display_name text not null,

  description text,

  audience text not null
    default 'leadership',

  status text not null
    default 'draft',

  config jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  unique (
    product_id,
    template_key,
    version
  ),

  constraint seat_onboarding_template_version_check
  check (
    version >= 1
  ),

  constraint seat_onboarding_template_audience_check
  check (
    audience in (
      'owner',
      'leadership',
      'manager',
      'candidate',
      'staff',
      'custom'
    )
  ),

  constraint seat_onboarding_template_status_check
  check (
    status in (
      'draft',
      'active',
      'retired'
    )
  ),

  constraint seat_onboarding_template_config_check
  check (
    jsonb_typeof(config) =
      'object'
  )
);


create table
public.seat_onboarding_template_steps (
  id uuid primary key
    default gen_random_uuid(),

  template_id uuid not null
    references public.seat_onboarding_templates(id)
    on delete cascade,

  step_key text not null,

  sort_order integer not null,

  display_name text not null,

  description text,

  owner_type text not null
    default 'client',

  is_required boolean not null
    default true,

  completion_mode text not null
    default 'client_action',

  config jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  unique (
    template_id,
    step_key
  ),

  unique (
    template_id,
    sort_order
  ),

  constraint seat_onboarding_step_owner_check
  check (
    owner_type in (
      'client',
      'seat_admin',
      'system',
      'shared'
    )
  ),

  constraint seat_onboarding_step_mode_check
  check (
    completion_mode in (
      'client_action',
      'admin_action',
      'system_check',
      'shared'
    )
  ),

  constraint seat_onboarding_step_config_check
  check (
    jsonb_typeof(config) =
      'object'
  )
);


create table
public.seat_onboarding_runs (
  id uuid primary key
    default gen_random_uuid(),

  product_account_id uuid not null
    references public.seat_product_accounts(id)
    on delete cascade,

  proposal_id uuid
    references public.seat_proposals(id)
    on delete set null,

  template_id uuid
    references public.seat_onboarding_templates(id)
    on delete set null,

  assigned_contact_id uuid
    references public.seat_customer_contacts(id)
    on delete set null,

  status text not null
    default 'not_started',

  current_step_key text,

  started_at timestamptz,

  completed_at timestamptz,

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint seat_onboarding_runs_status_check
  check (
    status in (
      'not_started',
      'in_progress',
      'blocked',
      'complete',
      'cancelled'
    )
  ),

  constraint seat_onboarding_runs_metadata_check
  check (
    jsonb_typeof(metadata) =
      'object'
  )
);


create table
public.seat_onboarding_run_steps (
  id uuid primary key
    default gen_random_uuid(),

  onboarding_run_id uuid not null
    references public.seat_onboarding_runs(id)
    on delete cascade,

  step_key text not null,

  sort_order integer not null,

  display_name text not null,

  owner_type text not null
    default 'client',

  is_required boolean not null
    default true,

  status text not null
    default 'pending',

  step_data jsonb not null
    default '{}'::jsonb,

  started_at timestamptz,

  completed_at timestamptz,

  completed_by_user_id uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  unique (
    onboarding_run_id,
    step_key
  ),

  constraint seat_onboarding_run_step_owner_check
  check (
    owner_type in (
      'client',
      'seat_admin',
      'system',
      'shared'
    )
  ),

  constraint seat_onboarding_run_step_status_check
  check (
    status in (
      'pending',
      'in_progress',
      'complete',
      'skipped',
      'blocked'
    )
  ),

  constraint seat_onboarding_run_step_data_check
  check (
    jsonb_typeof(step_data) =
      'object'
  )
);


-- ============================================================
-- INTEGRATION CATALOG
--
-- Customer-facing connection state only.
-- Provider credentials remain server-side.
-- ============================================================

create table
public.seat_integration_catalog (
  id uuid primary key
    default gen_random_uuid(),

  integration_key text not null unique,

  display_name text not null,

  provider text not null,

  category text not null,

  auth_type text not null,

  visibility text not null
    default 'client',

  status text not null
    default 'planned',

  capabilities jsonb not null
    default '[]'::jsonb,

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint seat_integrations_category_check
  check (
    category in (
      'email',
      'calendar',
      'contacts',
      'storage',
      'communications',
      'billing',
      'crm',
      'fundraising',
      'social',
      'other'
    )
  ),

  constraint seat_integrations_auth_check
  check (
    auth_type in (
      'oauth2',
      'api_key',
      'webhook',
      'internal',
      'none'
    )
  ),

  constraint seat_integrations_visibility_check
  check (
    visibility in (
      'client',
      'platform',
      'both'
    )
  ),

  constraint seat_integrations_status_check
  check (
    status in (
      'planned',
      'available',
      'hidden',
      'retired'
    )
  ),

  constraint seat_integrations_capabilities_check
  check (
    jsonb_typeof(capabilities) =
      'array'
  ),

  constraint seat_integrations_metadata_check
  check (
    jsonb_typeof(metadata) =
      'object'
  )
);


create table
public.seat_product_integrations (
  product_id uuid not null
    references public.seat_products(id)
    on delete cascade,

  integration_id uuid not null
    references public.seat_integration_catalog(id)
    on delete restrict,

  availability text not null
    default 'available',

  default_enabled boolean not null
    default false,

  config jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  primary key (
    product_id,
    integration_id
  ),

  constraint seat_product_integrations_availability_check
  check (
    availability in (
      'available',
      'optional',
      'required',
      'hidden'
    )
  ),

  constraint seat_product_integrations_config_check
  check (
    jsonb_typeof(config) =
      'object'
  )
);


create table
public.seat_product_account_integrations (
  id uuid primary key
    default gen_random_uuid(),

  product_account_id uuid not null
    references public.seat_product_accounts(id)
    on delete cascade,

  workspace_id uuid
    references public.workspaces(id)
    on delete cascade,

  user_id uuid
    references auth.users(id)
    on delete set null,

  integration_id uuid not null
    references public.seat_integration_catalog(id)
    on delete restrict,

  connection_key text not null
    default 'primary',

  status text not null
    default 'not_connected',

  display_name text,

  display_email text,

  external_account_id text,

  last_synced_at timestamptz,

  connection_metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  unique (
    product_account_id,
    integration_id,
    connection_key
  ),

  constraint seat_account_integrations_status_check
  check (
    status in (
      'not_connected',
      'connecting',
      'connected',
      'reauthorization_required',
      'error',
      'disabled'
    )
  ),

  constraint seat_account_integrations_metadata_check
  check (
    jsonb_typeof(connection_metadata) =
      'object'
  )
);


-- ============================================================
-- EXPLICIT SUPPORT ACCESS GRANTS
--
-- Platform Support does NOT automatically receive customer data.
-- Future support sessions must be approved/time-bounded here.
-- ============================================================

create table
public.seat_support_access_grants (
  id uuid primary key
    default gen_random_uuid(),

  product_account_id uuid not null
    references public.seat_product_accounts(id)
    on delete cascade,

  staff_user_id uuid not null
    references auth.users(id)
    on delete cascade,

  requested_by_user_id uuid
    references auth.users(id)
    on delete set null,

  approved_by_user_id uuid
    references auth.users(id)
    on delete set null,

  reason text not null,

  access_scope jsonb not null
    default '[]'::jsonb,

  status text not null
    default 'pending',

  starts_at timestamptz,

  expires_at timestamptz,

  approved_at timestamptz,

  revoked_at timestamptz,

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint seat_support_access_scope_check
  check (
    jsonb_typeof(access_scope) =
      'array'
  ),

  constraint seat_support_access_status_check
  check (
    status in (
      'pending',
      'active',
      'expired',
      'revoked',
      'denied'
    )
  ),

  constraint seat_support_access_dates_check
  check (
    expires_at is null
    or starts_at is null
    or expires_at > starts_at
  ),

  constraint seat_support_access_metadata_check
  check (
    jsonb_typeof(metadata) =
      'object'
  )
);


-- ============================================================
-- ACCESS HELPERS
-- ============================================================

create or replace function
public.seat_user_can_access_product_account(
  target_product_account_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $seat_platform$
  select
    (
      public.seat_platform_admin_authorized()
    )
    or exists (
      select 1
      from public.seat_product_accounts
        as account
      join public.seat_customer_contacts
        as contact
        on contact.customer_id =
          account.customer_id
      where
        account.id =
          target_product_account_id
        and contact.user_id =
          auth.uid()
        and contact.status =
          'active'
    )
    or exists (
      select 1
      from public.seat_workspace_bindings
        as binding
      join public.workspace_members
        as member
        on member.workspace_id =
          binding.workspace_id
      where
        binding.product_account_id =
          target_product_account_id
        and binding.status =
          'active'
        and member.user_id =
          auth.uid()
        and member.status =
          'active'
        and member.membership_state =
          'active'
    );
$seat_platform$;

revoke all
on function
public.seat_user_can_access_product_account(uuid)
from public, anon;

grant execute
on function
public.seat_user_can_access_product_account(uuid)
to authenticated, service_role;


create or replace function
public.seat_user_can_view_product_billing(
  target_product_account_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $seat_platform$
  select
    public.seat_platform_admin_authorized()
    or exists (
      select 1
      from public.seat_product_accounts
        as account
      join public.seat_customer_contacts
        as contact
        on contact.customer_id =
          account.customer_id
      where
        account.id =
          target_product_account_id
        and contact.user_id =
          auth.uid()
        and contact.status =
          'active'
        and (
          contact.is_primary = true
          or contact.is_billing = true
        )
    );
$seat_platform$;

revoke all
on function
public.seat_user_can_view_product_billing(uuid)
from public, anon;

grant execute
on function
public.seat_user_can_view_product_billing(uuid)
to authenticated, service_role;


-- ============================================================
-- UPDATED-AT TRIGGERS
-- ============================================================

do $seat_updated_at$
declare
  target_table text;
begin
  foreach target_table in array array[
    'seat_products',
    'seat_modules',
    'seat_product_modules',
    'seat_packages',
    'seat_package_modules',
    'seat_addons',
    'seat_customers',
    'seat_customer_contacts',
    'seat_leads',
    'seat_deals',
    'seat_proposals',
    'seat_proposal_items',
    'seat_product_accounts',
    'seat_workspace_bindings',
    'seat_subscriptions',
    'seat_entitlements',
    'seat_onboarding_templates',
    'seat_onboarding_template_steps',
    'seat_onboarding_runs',
    'seat_onboarding_run_steps',
    'seat_integration_catalog',
    'seat_product_integrations',
    'seat_product_account_integrations',
    'seat_support_access_grants'
  ]
  loop
    execute format(
      'drop trigger if exists %I on public.%I',
      target_table ||
        '_set_updated_at',
      target_table
    );

    execute format(
      'create trigger %I
       before update on public.%I
       for each row
       execute function public.set_campaign_updated_at()',
      target_table ||
        '_set_updated_at',
      target_table
    );
  end loop;
end
$seat_updated_at$;


-- ============================================================
-- INDEXES
-- ============================================================

create index
seat_customers_status_idx
on public.seat_customers (
  status,
  created_at desc
);

create index
seat_leads_status_product_idx
on public.seat_leads (
  status,
  product_id,
  created_at desc
);

create index
seat_deals_stage_product_idx
on public.seat_deals (
  stage,
  product_id,
  updated_at desc
);

create index
seat_proposals_deal_status_idx
on public.seat_proposals (
  deal_id,
  status,
  updated_at desc
);

create index
seat_proposals_client_email_idx
on public.seat_proposals (
  lower(client_email),
  created_at desc
);

create index
seat_product_accounts_customer_idx
on public.seat_product_accounts (
  customer_id,
  status,
  updated_at desc
);

create index
seat_workspace_bindings_account_idx
on public.seat_workspace_bindings (
  product_account_id,
  status
);

create index
seat_entitlements_account_idx
on public.seat_entitlements (
  product_account_id,
  enabled
);

create index
seat_onboarding_runs_account_idx
on public.seat_onboarding_runs (
  product_account_id,
  status
);

create index
seat_account_integrations_account_idx
on public.seat_product_account_integrations (
  product_account_id,
  status
);

create index
seat_support_access_account_idx
on public.seat_support_access_grants (
  product_account_id,
  status,
  expires_at
);


-- ============================================================
-- RLS: ADMIN-ONLY COMMERCIAL/CATALOG TABLES
--
-- These tables are NEVER exposed anonymously.
-- Direct reads/writes require:
-- platform_owner / platform_admin + MFA/AAL2.
--
-- Client proposal access will later happen through a narrowly
-- scoped token-verification server function / Edge Function.
-- ============================================================

do $seat_admin_rls$
declare
  target_table text;
begin
  foreach target_table in array array[
    'seat_products',
    'seat_modules',
    'seat_product_modules',
    'seat_packages',
    'seat_package_modules',
    'seat_addons',
    'seat_customers',
    'seat_customer_contacts',
    'seat_leads',
    'seat_deals',
    'seat_proposals',
    'seat_proposal_items',
    'seat_onboarding_templates',
    'seat_onboarding_template_steps',
    'seat_integration_catalog',
    'seat_product_integrations'
  ]
  loop
    execute format(
      'alter table public.%I
       enable row level security',
      target_table
    );

    execute format(
      'revoke all
       on table public.%I
       from public, anon',
      target_table
    );

    execute format(
      'grant select, insert, update
       on table public.%I
       to authenticated',
      target_table
    );

    execute format(
      'grant select, insert, update, delete
       on table public.%I
       to service_role',
      target_table
    );

    execute format(
      'drop policy if exists
       "Seat platform admins can read"
       on public.%I',
      target_table
    );

    execute format(
      'create policy
       "Seat platform admins can read"
       on public.%I
       for select
       to authenticated
       using (
         public.seat_platform_admin_authorized()
       )',
      target_table
    );

    execute format(
      'drop policy if exists
       "Seat platform admins can insert"
       on public.%I',
      target_table
    );

    execute format(
      'create policy
       "Seat platform admins can insert"
       on public.%I
       for insert
       to authenticated
       with check (
         public.seat_platform_admin_authorized()
       )',
      target_table
    );

    execute format(
      'drop policy if exists
       "Seat platform admins can update"
       on public.%I',
      target_table
    );

    execute format(
      'create policy
       "Seat platform admins can update"
       on public.%I
       for update
       to authenticated
       using (
         public.seat_platform_admin_authorized()
       )
       with check (
         public.seat_platform_admin_authorized()
       )',
      target_table
    );
  end loop;
end
$seat_admin_rls$;


-- ============================================================
-- RLS: PRODUCT ACCOUNT OPERATIONAL TABLES
-- ============================================================

do $seat_account_rls$
declare
  target_table text;
  account_expression text;
begin
  foreach target_table in array array[
    'seat_product_accounts',
    'seat_workspace_bindings',
    'seat_entitlements',
    'seat_onboarding_runs',
    'seat_onboarding_run_steps',
    'seat_product_account_integrations',
    'seat_support_access_grants'
  ]
  loop
    execute format(
      'alter table public.%I
       enable row level security',
      target_table
    );

    execute format(
      'revoke all
       on table public.%I
       from public, anon',
      target_table
    );

    execute format(
      'grant select, insert, update
       on table public.%I
       to authenticated',
      target_table
    );

    execute format(
      'grant select, insert, update, delete
       on table public.%I
       to service_role',
      target_table
    );

    if target_table =
      'seat_product_accounts'
    then
      account_expression :=
        'id';

    elsif target_table =
      'seat_workspace_bindings'
    then
      account_expression :=
        'product_account_id';

    elsif target_table =
      'seat_entitlements'
    then
      account_expression :=
        'product_account_id';

    elsif target_table =
      'seat_onboarding_runs'
    then
      account_expression :=
        'product_account_id';

    elsif target_table =
      'seat_onboarding_run_steps'
    then
      account_expression :=
        '(
          select run.product_account_id
          from public.seat_onboarding_runs run
          where run.id =
            onboarding_run_id
        )';

    elsif target_table =
      'seat_product_account_integrations'
    then
      account_expression :=
        'product_account_id';

    else
      account_expression :=
        'product_account_id';
    end if;

    execute format(
      'drop policy if exists
       "Authorized users can read Seat account data"
       on public.%I',
      target_table
    );

    execute format(
      'create policy
       "Authorized users can read Seat account data"
       on public.%I
       for select
       to authenticated
       using (
         public.seat_user_can_access_product_account(
           %s
         )
       )',
      target_table,
      account_expression
    );

    execute format(
      'drop policy if exists
       "Seat platform admins can insert account data"
       on public.%I',
      target_table
    );

    execute format(
      'create policy
       "Seat platform admins can insert account data"
       on public.%I
       for insert
       to authenticated
       with check (
         public.seat_platform_admin_authorized()
       )',
      target_table
    );

    execute format(
      'drop policy if exists
       "Seat platform admins can update account data"
       on public.%I',
      target_table
    );

    execute format(
      'create policy
       "Seat platform admins can update account data"
       on public.%I
       for update
       to authenticated
       using (
         public.seat_platform_admin_authorized()
       )
       with check (
         public.seat_platform_admin_authorized()
       )',
      target_table
    );
  end loop;
end
$seat_account_rls$;


-- ============================================================
-- SUBSCRIPTION RLS
-- ============================================================

alter table
public.seat_subscriptions
enable row level security;

revoke all
on table public.seat_subscriptions
from public, anon;

grant select, insert, update
on table public.seat_subscriptions
to authenticated;

grant select, insert, update, delete
on table public.seat_subscriptions
to service_role;

create policy
"Authorized billing users can read Seat subscriptions"
on public.seat_subscriptions
for select
to authenticated
using (
  public.seat_user_can_view_product_billing(
    product_account_id
  )
);

create policy
"Seat platform admins can insert Seat subscriptions"
on public.seat_subscriptions
for insert
to authenticated
with check (
  public.seat_platform_admin_authorized()
);

create policy
"Seat platform admins can update Seat subscriptions"
on public.seat_subscriptions
for update
to authenticated
using (
  public.seat_platform_admin_authorized()
)
with check (
  public.seat_platform_admin_authorized()
);


-- ============================================================
-- SEED SEAT PRODUCTS
-- ============================================================

insert into public.seat_products (
  product_key,
  product_name,
  short_name,
  workspace_label,
  hq_label,
  ask_ai_label,
  tool_group_label,
  status,
  description,
  metadata
)
values
  (
    'campaign',
    'Campaign Seat',
    'Campaign',
    'Campaign Workspace',
    'Campaign HQ',
    'Ask Campaign HQ',
    'Campaign tools',
    'active',
    'Secure campaign operations and communications workspace.',
    jsonb_build_object(
      'first_product',
      true
    )
  ),
  (
    'firm',
    'Firm Seat',
    'Firm',
    'Firm Workspace',
    'Firm HQ',
    'Ask Firm HQ',
    'Firm tools',
    'planned',
    'Seat Platform product for professional firms and multi-client operations.',
    '{}'::jsonb
  ),
  (
    'district',
    'District Seat',
    'District',
    'District Workspace',
    'District HQ',
    'Ask District HQ',
    'District tools',
    'planned',
    'Seat Platform product for elected offices and district operations.',
    '{}'::jsonb
  )
on conflict (
  product_key
)
do update set
  product_name =
    excluded.product_name,
  short_name =
    excluded.short_name,
  workspace_label =
    excluded.workspace_label,
  hq_label =
    excluded.hq_label,
  ask_ai_label =
    excluded.ask_ai_label,
  tool_group_label =
    excluded.tool_group_label,
  description =
    excluded.description,
  updated_at =
    now();


-- ============================================================
-- SEED SHARED + CAMPAIGN MODULE CATALOG
-- ============================================================

insert into public.seat_modules (
  module_key,
  display_name,
  module_scope,
  default_route,
  default_nav_group,
  default_sort_order,
  data_classification,
  status
)
values
  ('dashboard', 'HQ', 'core', '/dashboard', 'core', 10, 'sensitive', 'active'),
  ('inbox', 'Inbox', 'core', '/inbox', 'core', 20, 'restricted', 'active'),
  ('calendar', 'Calendar', 'core', '/calendar', 'core', 30, 'sensitive', 'active'),
  ('tasks', 'Tasks', 'core', '/tasks', 'core', 40, 'sensitive', 'active'),
  ('commitments', 'Commitments', 'core', '/commitments', 'core', 50, 'sensitive', 'active'),
  ('waiting_on', 'Waiting On', 'core', '/waiting-on', 'core', 60, 'sensitive', 'active'),
  ('contacts', 'Contacts', 'core', '/contacts', 'core', 70, 'restricted', 'active'),
  ('documents', 'Documents', 'core', '/files', 'core', 80, 'restricted', 'active'),
  ('approvals', 'Approvals', 'core', '/approvals', 'core', 90, 'restricted', 'active'),
  ('team', 'Team', 'core', '/team', 'core', 100, 'restricted', 'active'),
  ('inventory', 'Inventory', 'core', '/inventory', 'core', 110, 'sensitive', 'active'),

  ('ai', 'AI', 'platform', '/workspace/ai', 'platform', 500, 'restricted', 'active'),
  ('integrations', 'Integrations', 'platform', '/workspace/integrations', 'platform', 510, 'restricted', 'active'),
  ('plan_usage', 'Plan & Usage', 'platform', '/workspace/usage', 'platform', 520, 'sensitive', 'active'),
  ('settings', 'Settings', 'platform', '/workspace/settings', 'platform', 530, 'sensitive', 'active'),
  ('support', 'Support', 'platform', '/support', 'platform', 540, 'sensitive', 'active'),

  ('candidate', 'Candidate', 'product', '/workspace/candidate-profile', 'campaign', 200, 'restricted', 'active'),
  ('volunteers', 'Volunteers', 'product', '/volunteers', 'campaign', 210, 'restricted', 'active'),
  ('fundraising', 'Fundraising', 'product', '/fundraising', 'campaign', 220, 'restricted', 'active'),
  ('events', 'Events', 'product', '/events', 'campaign', 230, 'sensitive', 'active'),
  ('social_media', 'Social Media', 'product', '/social-media', 'campaign', 240, 'sensitive', 'active'),
  ('media_center', 'Media Center', 'product', '/media-center', 'campaign', 250, 'restricted', 'active'),
  ('reports_analytics', 'Reports & Analytics', 'product', '/reports-analytics', 'campaign', 260, 'restricted', 'active')
on conflict (
  module_key
)
do update set
  display_name =
    excluded.display_name,
  module_scope =
    excluded.module_scope,
  default_route =
    excluded.default_route,
  default_nav_group =
    excluded.default_nav_group,
  default_sort_order =
    excluded.default_sort_order,
  data_classification =
    excluded.data_classification,
  status =
    excluded.status,
  updated_at =
    now();


-- Shared/core/platform modules belong to every Seat product.
insert into public.seat_product_modules (
  product_id,
  module_id,
  enabled,
  required,
  default_enabled,
  nav_group,
  sort_order
)
select
  product.id,
  module.id,
  true,
  module.module_key in (
    'dashboard',
    'team'
  ),
  true,
  module.default_nav_group,
  module.default_sort_order
from public.seat_products
  as product
cross join public.seat_modules
  as module
where
  product.product_key in (
    'campaign',
    'firm',
    'district'
  )
  and module.module_scope in (
    'core',
    'platform'
  )
on conflict (
  product_id,
  module_id
)
do update set
  enabled =
    excluded.enabled,
  required =
    excluded.required,
  default_enabled =
    excluded.default_enabled,
  nav_group =
    excluded.nav_group,
  sort_order =
    excluded.sort_order,
  updated_at =
    now();


-- Campaign-specific operational modules.
insert into public.seat_product_modules (
  product_id,
  module_id,
  enabled,
  required,
  default_enabled,
  nav_group,
  sort_order
)
select
  product.id,
  module.id,
  true,
  false,
  true,
  'campaign',
  module.default_sort_order
from public.seat_products
  as product
join public.seat_modules
  as module
  on module.module_key in (
    'candidate',
    'volunteers',
    'fundraising',
    'events',
    'social_media',
    'media_center',
    'reports_analytics'
  )
where
  product.product_key =
    'campaign'
on conflict (
  product_id,
  module_id
)
do update set
  enabled =
    excluded.enabled,
  default_enabled =
    excluded.default_enabled,
  nav_group =
    excluded.nav_group,
  sort_order =
    excluded.sort_order,
  updated_at =
    now();


-- ============================================================
-- FIRST INTERNAL PACKAGE TEMPLATE
--
-- Pricing intentionally remains unset until commercial terms
-- are finalized. Proposals can override every amount.
-- ============================================================

insert into public.seat_packages (
  product_id,
  package_key,
  display_name,
  description,
  status,
  pricing_model,
  currency,
  is_public,
  metadata
)
select
  product.id,
  'custom',
  'Campaign Seat Custom',
  'Internal customizable Campaign Seat package template.',
  'draft',
  'custom',
  'USD',
  false,
  jsonb_build_object(
    'pricing_pending',
    true,
    'purpose',
    'Founding client proposal builder'
  )
from public.seat_products
  as product
where
  product.product_key =
    'campaign'
on conflict (
  product_id,
  package_key
)
do update set
  display_name =
    excluded.display_name,
  description =
    excluded.description,
  metadata =
    excluded.metadata,
  updated_at =
    now();


-- ============================================================
-- INTEGRATION CATALOG
-- ============================================================

insert into public.seat_integration_catalog (
  integration_key,
  display_name,
  provider,
  category,
  auth_type,
  visibility,
  status,
  capabilities,
  metadata
)
values
  (
    'google_workspace',
    'Google Workspace',
    'google',
    'calendar',
    'oauth2',
    'client',
    'available',
    '[
      "calendar",
      "email",
      "contacts",
      "drive"
    ]'::jsonb,
    jsonb_build_object(
      'runtime_strategy',
      'provider_adapter'
    )
  ),
  (
    'microsoft_365',
    'Microsoft 365',
    'microsoft',
    'calendar',
    'oauth2',
    'client',
    'available',
    '[
      "calendar",
      "email",
      "contacts",
      "onedrive"
    ]'::jsonb,
    jsonb_build_object(
      'runtime_strategy',
      'provider_adapter'
    )
  ),
  (
    'twilio_sms',
    'Twilio Messaging',
    'twilio',
    'communications',
    'api_key',
    'client',
    'available',
    '[
      "sms"
    ]'::jsonb,
    '{}'::jsonb
  ),
  (
    'stripe_billing',
    'Stripe Billing',
    'stripe',
    'billing',
    'internal',
    'platform',
    'planned',
    '[
      "checkout",
      "subscriptions",
      "invoices",
      "payment_status"
    ]'::jsonb,
    jsonb_build_object(
      'payment_card_storage',
      'stripe_only'
    )
  )
on conflict (
  integration_key
)
do update set
  display_name =
    excluded.display_name,
  provider =
    excluded.provider,
  category =
    excluded.category,
  auth_type =
    excluded.auth_type,
  visibility =
    excluded.visibility,
  capabilities =
    excluded.capabilities,
  metadata =
    excluded.metadata,
  updated_at =
    now();


insert into public.seat_product_integrations (
  product_id,
  integration_id,
  availability,
  default_enabled
)
select
  product.id,
  integration.id,
  'optional',
  false
from public.seat_products
  as product
join public.seat_integration_catalog
  as integration
  on integration.integration_key in (
    'google_workspace',
    'microsoft_365',
    'twilio_sms'
  )
where
  product.product_key =
    'campaign'
on conflict (
  product_id,
  integration_id
)
do update set
  availability =
    excluded.availability,
  default_enabled =
    excluded.default_enabled,
  updated_at =
    now();


-- ============================================================
-- CAMPAIGN SEAT CLIENT-LAUNCH ONBOARDING TEMPLATE
--
-- Product-specific questions/content will be stored in config.
-- The engine itself remains generic for every Seat product.
-- ============================================================

insert into public.seat_onboarding_templates (
  product_id,
  template_key,
  version,
  display_name,
  description,
  audience,
  status,
  config
)
select
  product.id,
  'client_launch',
  1,
  'Campaign Seat Client Launch',
  'Founding Campaign Seat customer onboarding flow.',
  'leadership',
  'active',
  jsonb_build_object(
    'workspace_onboarding_bridge',
    true
  )
from public.seat_products
  as product
where
  product.product_key =
    'campaign'
on conflict (
  product_id,
  template_key,
  version
)
do update set
  display_name =
    excluded.display_name,
  description =
    excluded.description,
  audience =
    excluded.audience,
  status =
    excluded.status,
  config =
    excluded.config,
  updated_at =
    now();


insert into public.seat_onboarding_template_steps (
  template_id,
  step_key,
  sort_order,
  display_name,
  description,
  owner_type,
  is_required,
  completion_mode,
  config
)
select
  template.id,
  step.step_key,
  step.sort_order,
  step.display_name,
  step.description,
  step.owner_type,
  step.is_required,
  step.completion_mode,
  step.config
from public.seat_onboarding_templates
  as template
join public.seat_products
  as product
  on product.id =
    template.product_id
cross join (
  values
    (
      'account_security',
      10,
      'Secure your account',
      'Create the authorized client identity and complete required account security.',
      'client',
      true,
      'client_action',
      '{}'::jsonb
    ),
    (
      'confirm_package',
      20,
      'Confirm your Campaign Seat',
      'Review the approved package, modules, add-ons, seats and commercial terms.',
      'client',
      true,
      'client_action',
      '{}'::jsonb
    ),
    (
      'campaign_identity',
      30,
      'Campaign information',
      'Confirm campaign, candidate, office, jurisdiction and election information.',
      'client',
      true,
      'client_action',
      '{}'::jsonb
    ),
    (
      'leadership_setup',
      40,
      'Leadership setup',
      'Identify the candidate, campaign manager and initial authorized leadership.',
      'shared',
      true,
      'shared',
      '{}'::jsonb
    ),
    (
      'integrations',
      50,
      'Connect your tools',
      'Connect approved Google, Microsoft and other purchased integrations.',
      'client',
      false,
      'client_action',
      '{}'::jsonb
    ),
    (
      'data_import',
      60,
      'Import campaign data',
      'Complete any purchased contact, file, calendar or other migration work.',
      'shared',
      false,
      'shared',
      '{}'::jsonb
    ),
    (
      'workspace_review',
      70,
      'Review your workspace',
      'Verify roles, modules, dashboard defaults and initial campaign configuration.',
      'shared',
      true,
      'shared',
      '{}'::jsonb
    ),
    (
      'activation',
      80,
      'Activate Campaign Seat',
      'Complete final security and readiness checks before Campaign HQ goes live.',
      'seat_admin',
      true,
      'admin_action',
      '{}'::jsonb
    )
) as step(
  step_key,
  sort_order,
  display_name,
  description,
  owner_type,
  is_required,
  completion_mode,
  config
)
where
  product.product_key =
    'campaign'
  and template.template_key =
    'client_launch'
  and template.version =
    1
on conflict (
  template_id,
  step_key
)
do update set
  sort_order =
    excluded.sort_order,
  display_name =
    excluded.display_name,
  description =
    excluded.description,
  owner_type =
    excluded.owner_type,
  is_required =
    excluded.is_required,
  completion_mode =
    excluded.completion_mode,
  config =
    excluded.config,
  updated_at =
    now();


-- ============================================================
-- PRIVATE COMMERCIAL SECURITY EVENT LEDGER
--
-- Server-side only.
-- Do not put proposal bodies, customer messages,
-- payment card data or OAuth tokens here.
-- ============================================================

create table
private.seat_security_events (
  id uuid primary key
    default gen_random_uuid(),

  actor_user_id uuid
    references auth.users(id)
    on delete set null,

  event_type text not null,

  severity text not null
    default 'info',

  customer_id uuid,

  product_account_id uuid,

  resource_type text,

  resource_id text,

  metadata jsonb not null
    default '{}'::jsonb,

  occurred_at timestamptz not null
    default now(),

  constraint seat_security_events_severity_check
  check (
    severity in (
      'info',
      'notice',
      'warning',
      'critical'
    )
  ),

  constraint seat_security_events_metadata_check
  check (
    jsonb_typeof(metadata) =
      'object'
  )
);

alter table
private.seat_security_events
enable row level security;

revoke all
on table private.seat_security_events
from public, anon, authenticated;

grant select, insert
on table private.seat_security_events
to service_role;

create index
seat_security_events_time_idx
on private.seat_security_events (
  occurred_at desc
);

create index
seat_security_events_actor_idx
on private.seat_security_events (
  actor_user_id,
  occurred_at desc
);


-- ============================================================
-- FINAL SECURITY / SCHEMA ASSERTIONS
-- ============================================================

do $seat_verify$
declare
  missing_count integer;
  campaign_product_count integer;
  firm_product_count integer;
  district_product_count integer;
begin
  select count(*)
  into missing_count
  from (
    values
      ('seat_products'),
      ('seat_modules'),
      ('seat_product_modules'),
      ('seat_packages'),
      ('seat_addons'),
      ('seat_customers'),
      ('seat_customer_contacts'),
      ('seat_leads'),
      ('seat_deals'),
      ('seat_proposals'),
      ('seat_product_accounts'),
      ('seat_workspace_bindings'),
      ('seat_subscriptions'),
      ('seat_entitlements'),
      ('seat_onboarding_templates'),
      ('seat_onboarding_runs'),
      ('seat_integration_catalog'),
      ('seat_product_account_integrations'),
      ('seat_support_access_grants')
  ) as expected(table_name)
  where to_regclass(
    'public.' ||
    expected.table_name
  ) is null;

  if missing_count <> 0 then
    raise exception
      'Seat Platform verification failed: % expected tables are missing.',
      missing_count;
  end if;

  select count(*)
  into campaign_product_count
  from public.seat_products
  where product_key =
    'campaign';

  select count(*)
  into firm_product_count
  from public.seat_products
  where product_key =
    'firm';

  select count(*)
  into district_product_count
  from public.seat_products
  where product_key =
    'district';

  if
    campaign_product_count <> 1
    or firm_product_count <> 1
    or district_product_count <> 1
  then
    raise exception
      'Seat product seed verification failed.';
  end if;

  if not exists (
    select 1
    from pg_policies
    where
      schemaname = 'public'
      and tablename =
        'seat_customers'
      and policyname =
        'Seat platform admins can read'
  ) then
    raise exception
      'Seat customer RLS verification failed.';
  end if;

  if to_regprocedure(
    'public.seat_platform_admin_authorized()'
  ) is null then
    raise exception
      'Seat Platform admin authorization helper verification failed.';
  end if;

  if to_regprocedure(
    'public.seat_user_can_access_product_account(uuid)'
  ) is null then
    raise exception
      'Seat product-account access helper verification failed.';
  end if;
end
$seat_verify$;


-- ============================================================
-- COMMENTS / SECURITY CONTRACT
-- ============================================================

comment on table
public.seat_products
is
  'Product-neutral Seat Platform product catalog. Campaign Seat is the first active Seat product.';

comment on table
public.seat_customers
is
  'Commercial customer/organization record shared across every Seat product.';

comment on table
public.seat_product_accounts
is
  'A customer instance of a Seat product. Operational workspaces bind underneath this record.';

comment on table
public.seat_proposals
is
  'Versioned client proposal/order summary. Client access must use secure token verification, never anonymous direct table access.';

comment on table
public.seat_subscriptions
is
  'Product-neutral commercial subscription record. No payment card data is stored.';

comment on table
public.seat_entitlements
is
  'Resolved module entitlements for a Seat product account.';

comment on table
public.seat_support_access_grants
is
  'Explicit, scoped and time-bounded foundation for future customer support access. Platform support does not receive blanket customer access.';

comment on function
public.seat_platform_admin_authorized()
is
  'Requires active platform_owner/platform_admin authorization plus an aal2 MFA session.';

notify pgrst, 'reload schema';

commit;

-- ============================================================
-- CAMPAIGN SEAT
-- CAMPAIGN INTELLIGENCE + SUBSCRIPTION + INVENTORY FOUNDATION
--
-- Creates the durable foundation for:
--   • structured campaign location intelligence
--   • provider-neutral Campaign Seat AI settings
--   • subscription entitlements
--   • normalized usage metering
--   • physical campaign inventory
--   • safe Campaign Brain context snapshots
--
-- IMPORTANT:
--   No OpenAI / Anthropic / Gemini API keys are stored here.
--   Provider credentials belong in server-side Supabase secrets.
-- ============================================================

begin;

-- ============================================================
-- STRUCTURED CAMPAIGN LOCATION
-- ============================================================

alter table public.workspaces
add column if not exists country_code text;

alter table public.workspaces
add column if not exists state_region text;

alter table public.workspaces
add column if not exists county_name text;

alter table public.workspaces
add column if not exists municipality_name text;

alter table public.workspaces
add column if not exists postal_code text;

alter table public.workspaces
add column if not exists latitude numeric(9,6);

alter table public.workspaces
add column if not exists longitude numeric(9,6);

alter table public.workspaces
add column if not exists location_source text;

alter table public.workspaces
add column if not exists location_verified_at timestamptz;

alter table public.workspaces
add column if not exists location_context jsonb
not null default '{}'::jsonb;

alter table public.workspaces
drop constraint if exists workspaces_latitude_check;

alter table public.workspaces
add constraint workspaces_latitude_check
check (
  latitude is null
  or latitude between -90 and 90
);

alter table public.workspaces
drop constraint if exists workspaces_longitude_check;

alter table public.workspaces
add constraint workspaces_longitude_check
check (
  longitude is null
  or longitude between -180 and 180
);

alter table public.workspaces
drop constraint if exists workspaces_location_context_object_check;

alter table public.workspaces
add constraint workspaces_location_context_object_check
check (
  jsonb_typeof(location_context) = 'object'
);

-- Inventory becomes a first-class workspace module.
update public.workspaces
set enabled_modules =
  case
    when enabled_modules ? 'inventory'
      then enabled_modules
    else enabled_modules || '["inventory"]'::jsonb
  end;

-- ============================================================
-- MEMBERSHIP HELPERS
-- ============================================================

create or replace function
public.campaign_seat_workspace_member(
  target_workspace_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $campaign_seat$
  select exists (
    select 1
    from public.workspace_members member
    where
      member.workspace_id = target_workspace_id
      and member.user_id = auth.uid()
      and member.status = 'active'
      and member.membership_state = 'active'
  );
$campaign_seat$;

revoke all
on function public.campaign_seat_workspace_member(uuid)
from public;

grant execute
on function public.campaign_seat_workspace_member(uuid)
to authenticated;


create or replace function
public.campaign_seat_workspace_leader(
  target_workspace_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $campaign_seat$
  select exists (
    select 1
    from public.workspace_members member
    where
      member.workspace_id = target_workspace_id
      and member.user_id = auth.uid()
      and member.status = 'active'
      and member.membership_state = 'active'
      and member.role_key in (
        'campaign_owner',
        'candidate',
        'campaign_consultant',
        'campaign_manager',
        'campaign_administrator'
      )
  );
$campaign_seat$;

revoke all
on function public.campaign_seat_workspace_leader(uuid)
from public;

grant execute
on function public.campaign_seat_workspace_leader(uuid)
to authenticated;

-- ============================================================
-- PLAN CATALOG
--
-- Raw tokens are tracked internally, but plans can be sold as
-- Campaign Seat AI credits plus understandable usage limits.
-- ============================================================

create table if not exists
public.campaign_seat_plan_catalog (
  plan_key text primary key,

  display_name text not null,

  status text not null
    default 'active',

  monthly_price_cents integer,
  annual_price_cents integer,

  ai_credit_limit bigint not null
    default 0,

  ai_input_token_soft_limit bigint not null
    default 0,

  ai_output_token_soft_limit bigint not null
    default 0,

  sms_message_limit integer not null
    default 0,

  whatsapp_message_limit integer not null
    default 0,

  email_send_limit integer not null
    default 0,

  storage_bytes_limit bigint not null
    default 0,

  member_seat_limit integer not null
    default 0,

  inventory_item_limit integer not null
    default 0,

  overage_policy jsonb not null
    default '{}'::jsonb,

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint campaign_seat_plan_catalog_status_check
  check (
    status in (
      'active',
      'hidden',
      'retired'
    )
  ),

  constraint campaign_seat_plan_catalog_overage_object_check
  check (
    jsonb_typeof(overage_policy) = 'object'
  ),

  constraint campaign_seat_plan_catalog_metadata_object_check
  check (
    jsonb_typeof(metadata) = 'object'
  )
);

alter table public.campaign_seat_plan_catalog
enable row level security;

revoke all
on table public.campaign_seat_plan_catalog
from public, anon;

grant select
on table public.campaign_seat_plan_catalog
to authenticated;

drop policy if exists
  "Authenticated users can view active Campaign Seat plans"
on public.campaign_seat_plan_catalog;

create policy
  "Authenticated users can view active Campaign Seat plans"
on public.campaign_seat_plan_catalog
for select
to authenticated
using (
  status = 'active'
);

-- Demo entitlements only. These are not final commercial prices.
insert into public.campaign_seat_plan_catalog (
  plan_key,
  display_name,
  status,
  monthly_price_cents,
  annual_price_cents,
  ai_credit_limit,
  ai_input_token_soft_limit,
  ai_output_token_soft_limit,
  sms_message_limit,
  whatsapp_message_limit,
  email_send_limit,
  storage_bytes_limit,
  member_seat_limit,
  inventory_item_limit,
  metadata
)
values (
  'beta_demo',
  'Campaign Seat Demo',
  'active',
  null,
  null,
  10000,
  5000000,
  1000000,
  5000,
  1000,
  10000,
  10737418240,
  20,
  1000,
  jsonb_build_object(
    'commercial_pricing_finalized',
    false,
    'purpose',
    'Patrick demo and beta entitlement foundation'
  )
)
on conflict (plan_key)
do update set
  display_name = excluded.display_name,
  ai_credit_limit = excluded.ai_credit_limit,
  ai_input_token_soft_limit =
    excluded.ai_input_token_soft_limit,
  ai_output_token_soft_limit =
    excluded.ai_output_token_soft_limit,
  sms_message_limit =
    excluded.sms_message_limit,
  whatsapp_message_limit =
    excluded.whatsapp_message_limit,
  email_send_limit =
    excluded.email_send_limit,
  storage_bytes_limit =
    excluded.storage_bytes_limit,
  member_seat_limit =
    excluded.member_seat_limit,
  inventory_item_limit =
    excluded.inventory_item_limit,
  metadata = excluded.metadata,
  updated_at = now();

-- ============================================================
-- WORKSPACE SUBSCRIPTION
-- ============================================================

create table if not exists
public.workspace_subscriptions (
  workspace_id uuid primary key
    references public.workspaces(id)
    on delete cascade,

  plan_key text not null
    references public.campaign_seat_plan_catalog(plan_key),

  status text not null
    default 'demo',

  billing_period_start timestamptz,

  billing_period_end timestamptz,

  trial_ends_at timestamptz,

  external_customer_id text,

  external_subscription_id text,

  entitlement_overrides jsonb not null
    default '{}'::jsonb,

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint workspace_subscriptions_status_check
  check (
    status in (
      'demo',
      'trialing',
      'active',
      'past_due',
      'paused',
      'canceled',
      'incomplete'
    )
  ),

  constraint workspace_subscriptions_override_object_check
  check (
    jsonb_typeof(entitlement_overrides) = 'object'
  ),

  constraint workspace_subscriptions_metadata_object_check
  check (
    jsonb_typeof(metadata) = 'object'
  )
);

alter table public.workspace_subscriptions
enable row level security;

revoke all
on table public.workspace_subscriptions
from public, anon;

grant select
on table public.workspace_subscriptions
to authenticated;

drop policy if exists
  "Workspace members can view subscription"
on public.workspace_subscriptions;

create policy
  "Workspace members can view subscription"
on public.workspace_subscriptions
for select
to authenticated
using (
  public.campaign_seat_workspace_member(
    workspace_id
  )
);

-- ============================================================
-- NORMALIZED USAGE LEDGER
--
-- Examples:
-- ai_request
-- ai_credit
-- ai_input_token
-- ai_output_token
-- sms_message
-- whatsapp_message
-- email_send
-- storage_byte
-- ============================================================

create table if not exists
public.workspace_usage_ledger (
  id uuid primary key
    default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  metric_key text not null,

  quantity bigint not null,

  provider text,

  model text,

  source_type text,

  source_id text,

  estimated_cost_microusd bigint,

  metadata jsonb not null
    default '{}'::jsonb,

  recorded_at timestamptz not null
    default now(),

  created_at timestamptz not null
    default now(),

  constraint workspace_usage_ledger_quantity_check
  check (
    quantity >= 0
  ),

  constraint workspace_usage_ledger_metadata_object_check
  check (
    jsonb_typeof(metadata) = 'object'
  )
);

create index if not exists
workspace_usage_ledger_workspace_metric_time_idx
on public.workspace_usage_ledger (
  workspace_id,
  metric_key,
  recorded_at desc
);

alter table public.workspace_usage_ledger
enable row level security;

revoke all
on table public.workspace_usage_ledger
from public, anon;

grant select
on table public.workspace_usage_ledger
to authenticated;

drop policy if exists
  "Workspace members can view usage"
on public.workspace_usage_ledger;

create policy
  "Workspace members can view usage"
on public.workspace_usage_ledger
for select
to authenticated
using (
  public.campaign_seat_workspace_member(
    workspace_id
  )
);

-- ============================================================
-- WORKSPACE AI SETTINGS
--
-- No provider keys are stored here.
-- ============================================================

create table if not exists
public.workspace_ai_settings (
  workspace_id uuid primary key
    references public.workspaces(id)
    on delete cascade,

  enabled boolean not null
    default false,

  preferred_provider text not null
    default 'auto',

  preferred_model text,

  fallback_providers jsonb not null
    default '[
      "openai",
      "anthropic",
      "gemini"
    ]'::jsonb,

  allow_write_actions boolean not null
    default false,

  require_human_approval boolean not null
    default true,

  require_source_citations boolean not null
    default true,

  include_location_context boolean not null
    default true,

  include_inventory_context boolean not null
    default true,

  settings_metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint workspace_ai_settings_provider_check
  check (
    preferred_provider in (
      'auto',
      'openai',
      'anthropic',
      'gemini'
    )
  ),

  constraint workspace_ai_settings_fallback_array_check
  check (
    jsonb_typeof(fallback_providers) = 'array'
  ),

  constraint workspace_ai_settings_metadata_object_check
  check (
    jsonb_typeof(settings_metadata) = 'object'
  )
);

alter table public.workspace_ai_settings
enable row level security;

revoke all
on table public.workspace_ai_settings
from public, anon;

grant select, insert, update
on table public.workspace_ai_settings
to authenticated;

drop policy if exists
  "Workspace members can view AI settings"
on public.workspace_ai_settings;

create policy
  "Workspace members can view AI settings"
on public.workspace_ai_settings
for select
to authenticated
using (
  public.campaign_seat_workspace_member(
    workspace_id
  )
);

drop policy if exists
  "Workspace leaders can create AI settings"
on public.workspace_ai_settings;

create policy
  "Workspace leaders can create AI settings"
on public.workspace_ai_settings
for insert
to authenticated
with check (
  public.campaign_seat_workspace_leader(
    workspace_id
  )
);

drop policy if exists
  "Workspace leaders can update AI settings"
on public.workspace_ai_settings;

create policy
  "Workspace leaders can update AI settings"
on public.workspace_ai_settings
for update
to authenticated
using (
  public.campaign_seat_workspace_leader(
    workspace_id
  )
)
with check (
  public.campaign_seat_workspace_leader(
    workspace_id
  )
);

-- ============================================================
-- PHYSICAL CAMPAIGN INVENTORY
-- ============================================================

create table if not exists
public.workspace_inventory_items (
  id uuid primary key
    default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  item_name text not null,

  category text not null
    default 'other',

  sku text,

  description text,

  quantity_on_hand integer not null
    default 0,

  quantity_reserved integer not null
    default 0,

  quantity_available integer
    generated always as (
      quantity_on_hand -
      quantity_reserved
    ) stored,

  reorder_point integer not null
    default 0,

  unit_cost numeric(12,2),

  storage_location text,

  vendor_name text,

  image_file_id uuid
    references public.campaign_files(id)
    on delete set null,

  status text not null
    default 'active',

  metadata jsonb not null
    default '{}'::jsonb,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  updated_by uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint workspace_inventory_items_category_check
  check (
    category in (
      'yard_signs',
      'large_signs',
      'banners',
      'palm_cards',
      'door_hangers',
      'posters',
      'shirts',
      'hats',
      'stickers',
      'buttons',
      'canvassing_supplies',
      'event_supplies',
      'office_supplies',
      'other'
    )
  ),

  constraint workspace_inventory_items_quantities_check
  check (
    quantity_on_hand >= 0
    and quantity_reserved >= 0
    and quantity_reserved <= quantity_on_hand
    and reorder_point >= 0
  ),

  constraint workspace_inventory_items_status_check
  check (
    status in (
      'active',
      'archived'
    )
  ),

  constraint workspace_inventory_items_metadata_object_check
  check (
    jsonb_typeof(metadata) = 'object'
  )
);

create index if not exists
workspace_inventory_items_workspace_category_idx
on public.workspace_inventory_items (
  workspace_id,
  category,
  status
);

alter table public.workspace_inventory_items
enable row level security;

revoke all
on table public.workspace_inventory_items
from public, anon;

grant select, insert, update, delete
on table public.workspace_inventory_items
to authenticated;

drop policy if exists
  "Workspace members can view inventory"
on public.workspace_inventory_items;

create policy
  "Workspace members can view inventory"
on public.workspace_inventory_items
for select
to authenticated
using (
  public.campaign_seat_workspace_member(
    workspace_id
  )
);

drop policy if exists
  "Workspace leaders can add inventory"
on public.workspace_inventory_items;

create policy
  "Workspace leaders can add inventory"
on public.workspace_inventory_items
for insert
to authenticated
with check (
  public.campaign_seat_workspace_leader(
    workspace_id
  )
);

drop policy if exists
  "Workspace leaders can update inventory"
on public.workspace_inventory_items;

create policy
  "Workspace leaders can update inventory"
on public.workspace_inventory_items
for update
to authenticated
using (
  public.campaign_seat_workspace_leader(
    workspace_id
  )
)
with check (
  public.campaign_seat_workspace_leader(
    workspace_id
  )
);

drop policy if exists
  "Workspace leaders can delete inventory"
on public.workspace_inventory_items;

create policy
  "Workspace leaders can delete inventory"
on public.workspace_inventory_items
for delete
to authenticated
using (
  public.campaign_seat_workspace_leader(
    workspace_id
  )
);


create table if not exists
public.workspace_inventory_movements (
  id uuid primary key
    default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  inventory_item_id uuid not null
    references public.workspace_inventory_items(id)
    on delete cascade,

  movement_type text not null,

  on_hand_delta integer not null
    default 0,

  reserved_delta integer not null
    default 0,

  note text,

  actor_user_id uuid
    references public.profiles(id)
    on delete set null,

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  constraint workspace_inventory_movements_type_check
  check (
    movement_type in (
      'received',
      'distributed',
      'reserved',
      'released',
      'returned',
      'damaged',
      'adjustment'
    )
  ),

  constraint workspace_inventory_movements_delta_check
  check (
    on_hand_delta <> 0
    or reserved_delta <> 0
  ),

  constraint workspace_inventory_movements_metadata_object_check
  check (
    jsonb_typeof(metadata) = 'object'
  )
);

create index if not exists
workspace_inventory_movements_item_time_idx
on public.workspace_inventory_movements (
  inventory_item_id,
  created_at desc
);

alter table public.workspace_inventory_movements
enable row level security;

revoke all
on table public.workspace_inventory_movements
from public, anon;

grant select
on table public.workspace_inventory_movements
to authenticated;

drop policy if exists
  "Workspace members can view inventory movements"
on public.workspace_inventory_movements;

create policy
  "Workspace members can view inventory movements"
on public.workspace_inventory_movements
for select
to authenticated
using (
  public.campaign_seat_workspace_member(
    workspace_id
  )
);

-- ============================================================
-- INVENTORY ADJUSTMENT RPC
-- ============================================================

create or replace function
public.adjust_campaign_inventory(
  target_item_id uuid,
  target_movement_type text,
  target_on_hand_delta integer default 0,
  target_reserved_delta integer default 0,
  target_note text default null
)
returns public.workspace_inventory_items
language plpgsql
security definer
set search_path = public, pg_temp
as $campaign_seat$
declare
  current_item public.workspace_inventory_items;
  next_on_hand integer;
  next_reserved integer;
begin
  select *
  into current_item
  from public.workspace_inventory_items
  where id = target_item_id
  for update;

  if current_item.id is null then
    raise exception
      'Inventory item not found';
  end if;

  if not public.campaign_seat_workspace_leader(
    current_item.workspace_id
  ) then
    raise exception
      'Not authorized to adjust inventory';
  end if;

  if target_movement_type not in (
    'received',
    'distributed',
    'reserved',
    'released',
    'returned',
    'damaged',
    'adjustment'
  ) then
    raise exception
      'Invalid inventory movement type';
  end if;

  if
    target_on_hand_delta = 0
    and target_reserved_delta = 0
  then
    raise exception
      'Inventory adjustment must change quantity';
  end if;

  next_on_hand :=
    current_item.quantity_on_hand +
    target_on_hand_delta;

  next_reserved :=
    current_item.quantity_reserved +
    target_reserved_delta;

  if
    next_on_hand < 0
    or next_reserved < 0
    or next_reserved > next_on_hand
  then
    raise exception
      'Inventory quantities would become invalid';
  end if;

  update public.workspace_inventory_items
  set
    quantity_on_hand = next_on_hand,
    quantity_reserved = next_reserved,
    updated_by = auth.uid(),
    updated_at = now()
  where id = target_item_id
  returning *
  into current_item;

  insert into public.workspace_inventory_movements (
    workspace_id,
    inventory_item_id,
    movement_type,
    on_hand_delta,
    reserved_delta,
    note,
    actor_user_id
  )
  values (
    current_item.workspace_id,
    current_item.id,
    target_movement_type,
    target_on_hand_delta,
    target_reserved_delta,
    nullif(btrim(coalesce(target_note, '')), ''),
    auth.uid()
  );

  return current_item;
end;
$campaign_seat$;

revoke all
on function public.adjust_campaign_inventory(
  uuid,
  text,
  integer,
  integer,
  text
)
from public;

grant execute
on function public.adjust_campaign_inventory(
  uuid,
  text,
  integer,
  integer,
  text
)
to authenticated;

-- ============================================================
-- CAMPAIGN BRAIN CONTEXT SNAPSHOT
--
-- Safe workspace identity/location/subscription/inventory summary.
-- The AI Edge Function will add Tasks / Calendar / Inbox later
-- according to the requesting user's permissions.
-- ============================================================

create or replace function
public.get_campaign_brain_context(
  target_workspace_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $campaign_seat$
declare
  result jsonb;
begin
  if not public.campaign_seat_workspace_member(
    target_workspace_id
  ) then
    raise exception
      'Not authorized to view campaign context';
  end if;

  select jsonb_build_object(
    'workspace',
      jsonb_build_object(
        'id', workspace_record.id,
        'name', workspace_record.name,
        'campaign_type', workspace_record.campaign_type,
        'candidate_name', workspace_record.candidate_name,
        'office_sought', workspace_record.office_sought,
        'office_level', workspace_record.office_level,
        'district_label', workspace_record.district_label,
        'political_party', workspace_record.political_party,
        'primary_election_date',
          workspace_record.primary_election_date,
        'general_election_date',
          workspace_record.general_election_date,
        'timezone', workspace_record.timezone
      ),

    'location',
      jsonb_build_object(
        'country_code', workspace_record.country_code,
        'state_region', workspace_record.state_region,
        'county_name', workspace_record.county_name,
        'municipality_name',
          workspace_record.municipality_name,
        'jurisdiction_type',
          workspace_record.jurisdiction_type,
        'jurisdiction_name',
          workspace_record.jurisdiction_name,
        'district_label',
          workspace_record.district_label,
        'postal_code', workspace_record.postal_code,
        'latitude', workspace_record.latitude,
        'longitude', workspace_record.longitude,
        'context', workspace_record.location_context
      ),

    'subscription',
      coalesce(
        (
          select jsonb_build_object(
            'plan_key', subscription.plan_key,
            'status', subscription.status,
            'billing_period_start',
              subscription.billing_period_start,
            'billing_period_end',
              subscription.billing_period_end
          )
          from public.workspace_subscriptions subscription
          where
            subscription.workspace_id =
              workspace_record.id
        ),
        '{}'::jsonb
      ),

    'inventory',
      jsonb_build_object(
        'item_count',
          (
            select count(*)
            from public.workspace_inventory_items item
            where
              item.workspace_id =
                workspace_record.id
              and item.status = 'active'
          ),
        'low_stock_count',
          (
            select count(*)
            from public.workspace_inventory_items item
            where
              item.workspace_id =
                workspace_record.id
              and item.status = 'active'
              and item.quantity_available <=
                  item.reorder_point
          )
      )
  )
  into result
  from public.workspaces workspace_record
  where
    workspace_record.id =
      target_workspace_id;

  return coalesce(
    result,
    '{}'::jsonb
  );
end;
$campaign_seat$;

revoke all
on function public.get_campaign_brain_context(uuid)
from public;

grant execute
on function public.get_campaign_brain_context(uuid)
to authenticated;

-- ============================================================
-- USAGE SUMMARY RPC
-- ============================================================

create or replace function
public.get_campaign_usage_summary(
  target_workspace_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $campaign_seat$
declare
  result jsonb;
  period_start timestamptz;
  period_end timestamptz;
begin
  if not public.campaign_seat_workspace_member(
    target_workspace_id
  ) then
    raise exception
      'Not authorized to view campaign usage';
  end if;

  select
    coalesce(
      subscription.billing_period_start,
      date_trunc('month', now())
    ),
    coalesce(
      subscription.billing_period_end,
      date_trunc('month', now()) +
      interval '1 month'
    )
  into
    period_start,
    period_end
  from public.workspace_subscriptions subscription
  where
    subscription.workspace_id =
      target_workspace_id;

  if period_start is null then
    period_start :=
      date_trunc('month', now());

    period_end :=
      period_start +
      interval '1 month';
  end if;

  select jsonb_build_object(
    'period_start', period_start,
    'period_end', period_end,

    'plan',
      coalesce(
        (
          select to_jsonb(plan)
          from public.campaign_seat_plan_catalog plan
          join public.workspace_subscriptions subscription
            on subscription.plan_key =
               plan.plan_key
          where
            subscription.workspace_id =
              target_workspace_id
        ),
        '{}'::jsonb
      ),

    'usage',
      coalesce(
        (
          select jsonb_object_agg(
            metric.metric_key,
            metric.total_quantity
          )
          from (
            select
              ledger.metric_key,
              sum(ledger.quantity)::bigint
                as total_quantity
            from public.workspace_usage_ledger ledger
            where
              ledger.workspace_id =
                target_workspace_id
              and ledger.recorded_at >=
                period_start
              and ledger.recorded_at <
                period_end
            group by
              ledger.metric_key
          ) metric
        ),
        '{}'::jsonb
      )
  )
  into result;

  return result;
end;
$campaign_seat$;

revoke all
on function public.get_campaign_usage_summary(uuid)
from public;

grant execute
on function public.get_campaign_usage_summary(uuid)
to authenticated;

-- ============================================================
-- SEED FOUNDATION FOR WORKSPACES
-- ============================================================

create or replace function
private.seed_campaign_intelligence_foundation()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $campaign_seat$
begin
  insert into public.workspace_subscriptions (
    workspace_id,
    plan_key,
    status
  )
  values (
    new.id,
    'beta_demo',
    'demo'
  )
  on conflict (workspace_id)
  do nothing;

  insert into public.workspace_ai_settings (
    workspace_id
  )
  values (
    new.id
  )
  on conflict (workspace_id)
  do nothing;

  return new;
end;
$campaign_seat$;

revoke all
on function private.seed_campaign_intelligence_foundation()
from public, anon, authenticated;

drop trigger if exists
  workspaces_seed_campaign_intelligence_foundation
on public.workspaces;

create trigger
  workspaces_seed_campaign_intelligence_foundation
after insert
on public.workspaces
for each row
execute function
  private.seed_campaign_intelligence_foundation();

insert into public.workspace_subscriptions (
  workspace_id,
  plan_key,
  status
)
select
  workspace_record.id,
  'beta_demo',
  'demo'
from public.workspaces workspace_record
on conflict (workspace_id)
do nothing;

insert into public.workspace_ai_settings (
  workspace_id
)
select
  workspace_record.id
from public.workspaces workspace_record
on conflict (workspace_id)
do nothing;

commit;

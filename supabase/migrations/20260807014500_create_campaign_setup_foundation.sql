-- ============================================================
-- CAMPAIGN SEAT
-- CAMPAIGN SETUP, INTEGRATIONS AND PLATFORM ADMIN FOUNDATION
--
-- This migration creates the durable configuration layer for:
--   • workspace onboarding
--   • campaign identity
--   • political-party-aware recommended themes
--   • future Google/Microsoft/Twilio integrations
--   • private provider credential references
--   • Campaign Seat platform staff
--   • audited platform operations
--   • future first-workspace provisioning
--
-- IMPORTANT:
-- Provider access tokens and refresh tokens do NOT belong in
-- public.workspace_integrations.
-- ============================================================

begin;


-- ============================================================
-- PRIVATE SERVER-ONLY SCHEMA
-- ============================================================

create schema if not exists private;

revoke all
on schema private
from public, anon, authenticated;

grant usage
on schema private
to service_role;


-- ============================================================
-- EXPAND POLITICAL PARTY SUPPORT
-- ============================================================

alter table public.workspaces
drop constraint if exists
  workspaces_political_party_check;

alter table public.workspaces
add constraint
  workspaces_political_party_check
check (
  political_party in (
    'republican',
    'democratic',
    'independent',
    'libertarian',
    'green',
    'nonpartisan',
    'other'
  )
);


-- ============================================================
-- CAMPAIGN WORKSPACE PROFILE
--
-- Existing columns remain authoritative:
--   id
--   name
--   description
--   location
--   election_date
--   political_party
--   status
--
-- These fields extend that existing workspace record rather than
-- creating a second competing campaign identity table.
-- ============================================================

alter table public.workspaces
add column if not exists
  campaign_type text not null
  default 'candidate_campaign';

alter table public.workspaces
add column if not exists
  candidate_name text;

alter table public.workspaces
add column if not exists
  legal_committee_name text;

alter table public.workspaces
add column if not exists
  office_sought text;

alter table public.workspaces
add column if not exists
  office_level text;

alter table public.workspaces
add column if not exists
  district_label text;

alter table public.workspaces
add column if not exists
  jurisdiction_name text;

alter table public.workspaces
add column if not exists
  jurisdiction_type text;

alter table public.workspaces
add column if not exists
  primary_election_date date;

alter table public.workspaces
add column if not exists
  general_election_date date;

alter table public.workspaces
add column if not exists
  timezone text;

alter table public.workspaces
add column if not exists
  campaign_email text;

alter table public.workspaces
add column if not exists
  campaign_phone text;

alter table public.workspaces
add column if not exists
  website_url text;

alter table public.workspaces
add column if not exists
  campaign_address jsonb not null
  default '{}'::jsonb;

alter table public.workspaces
add column if not exists
  disclaimer_text text;

alter table public.workspaces
add column if not exists
  recommended_theme text not null
  default 'neutral';

alter table public.workspaces
add column if not exists
  active_theme text not null
  default 'neutral';

alter table public.workspaces
add column if not exists
  theme_source text not null
  default 'campaign_branding';

alter table public.workspaces
add column if not exists
  theme_primary_color text;

alter table public.workspaces
add column if not exists
  theme_accent_color text;

alter table public.workspaces
add column if not exists
  onboarding_status text not null
  default 'not_started';

alter table public.workspaces
add column if not exists
  onboarding_current_step text
  default 'campaign_identity';

alter table public.workspaces
add column if not exists
  onboarding_started_at timestamptz;

alter table public.workspaces
add column if not exists
  onboarding_completed_at timestamptz;

alter table public.workspaces
add column if not exists
  setup_version integer not null
  default 1;

alter table public.workspaces
add column if not exists
  enabled_modules jsonb not null
  default '[
    "dashboard",
    "inbox",
    "calendar",
    "tasks",
    "commitments",
    "waiting_on",
    "contacts",
    "documents",
    "approvals",
    "team",
    "volunteers",
    "fundraising",
    "events",
    "social_media",
    "media_center",
    "reports_analytics"
  ]'::jsonb;

alter table public.workspaces
add column if not exists
  setup_metadata jsonb not null
  default '{}'::jsonb;


-- ============================================================
-- WORKSPACE PROFILE CONSTRAINTS
-- ============================================================

alter table public.workspaces
drop constraint if exists
  workspaces_campaign_type_check;

alter table public.workspaces
add constraint
  workspaces_campaign_type_check
check (
  campaign_type in (
    'candidate_campaign',
    'ballot_measure',
    'pac',
    'party_organization',
    'elected_official',
    'advocacy_organization',
    'other'
  )
);

alter table public.workspaces
drop constraint if exists
  workspaces_office_level_check;

alter table public.workspaces
add constraint
  workspaces_office_level_check
check (
  office_level is null
  or office_level in (
    'federal',
    'state',
    'county',
    'municipal',
    'school_board',
    'special_district',
    'other',
    'not_applicable'
  )
);

alter table public.workspaces
drop constraint if exists
  workspaces_jurisdiction_type_check;

alter table public.workspaces
add constraint
  workspaces_jurisdiction_type_check
check (
  jurisdiction_type is null
  or jurisdiction_type in (
    'federal',
    'state',
    'county',
    'city',
    'town',
    'village',
    'district',
    'school_district',
    'special_district',
    'other'
  )
);

alter table public.workspaces
drop constraint if exists
  workspaces_recommended_theme_check;

alter table public.workspaces
add constraint
  workspaces_recommended_theme_check
check (
  recommended_theme in (
    'red',
    'blue',
    'neutral'
  )
);

alter table public.workspaces
drop constraint if exists
  workspaces_active_theme_check;

alter table public.workspaces
add constraint
  workspaces_active_theme_check
check (
  active_theme in (
    'red',
    'blue',
    'purple',
    'neutral',
    'custom'
  )
);

alter table public.workspaces
drop constraint if exists
  workspaces_theme_source_check;

alter table public.workspaces
add constraint
  workspaces_theme_source_check
check (
  theme_source in (
    'recommended',
    'campaign_branding',
    'platform_override'
  )
);

alter table public.workspaces
drop constraint if exists
  workspaces_theme_primary_color_check;

alter table public.workspaces
add constraint
  workspaces_theme_primary_color_check
check (
  theme_primary_color is null
  or theme_primary_color ~
    '^#[0-9A-Fa-f]{6}$'
);

alter table public.workspaces
drop constraint if exists
  workspaces_theme_accent_color_check;

alter table public.workspaces
add constraint
  workspaces_theme_accent_color_check
check (
  theme_accent_color is null
  or theme_accent_color ~
    '^#[0-9A-Fa-f]{6}$'
);

alter table public.workspaces
drop constraint if exists
  workspaces_onboarding_status_check;

alter table public.workspaces
add constraint
  workspaces_onboarding_status_check
check (
  onboarding_status in (
    'not_started',
    'in_progress',
    'pending_verification',
    'ready',
    'active',
    'paused'
  )
);

alter table public.workspaces
drop constraint if exists
  workspaces_enabled_modules_array_check;

alter table public.workspaces
add constraint
  workspaces_enabled_modules_array_check
check (
  jsonb_typeof(enabled_modules) = 'array'
);

alter table public.workspaces
drop constraint if exists
  workspaces_campaign_address_object_check;

alter table public.workspaces
add constraint
  workspaces_campaign_address_object_check
check (
  jsonb_typeof(campaign_address) = 'object'
);

alter table public.workspaces
drop constraint if exists
  workspaces_setup_metadata_object_check;

alter table public.workspaces
add constraint
  workspaces_setup_metadata_object_check
check (
  jsonb_typeof(setup_metadata) = 'object'
);


-- ============================================================
-- PARTY → RECOMMENDED THEME
-- ============================================================

create or replace function
public.campaign_recommended_theme(
  target_party text
)
returns text
language sql
immutable
security invoker
set search_path = public, pg_temp
as $campaign_seat$
  select
    case
      when lower(
        btrim(
          coalesce(
            target_party,
            ''
          )
        )
      ) = 'republican'
        then 'red'

      when lower(
        btrim(
          coalesce(
            target_party,
            ''
          )
        )
      ) = 'democratic'
        then 'blue'

      else 'neutral'
    end;
$campaign_seat$;

revoke all
on function
public.campaign_recommended_theme(text)
from public;

grant execute
on function
public.campaign_recommended_theme(text)
to authenticated;


create or replace function
private.sync_workspace_theme_defaults()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $campaign_seat$
begin
  -- Political affiliation can provide informational metadata,
  -- but it must never control the workspace appearance.
  new.recommended_theme :=
    public.campaign_recommended_theme(
      new.political_party
    );

  return new;
end;
$campaign_seat$;

revoke all
on function
private.sync_workspace_theme_defaults()
from public, anon, authenticated;

drop trigger if exists
  workspaces_sync_theme_defaults
on public.workspaces;

create trigger
  workspaces_sync_theme_defaults
before insert
or update of
  political_party
on public.workspaces
for each row
execute function
  private.sync_workspace_theme_defaults();


-- Populate informational party recommendation for existing
-- workspaces without changing their selected workspace color.
update public.workspaces
set
  recommended_theme =
    public.campaign_recommended_theme(
      political_party
    );


-- ============================================================
-- ONBOARDING STEP MODEL
-- ============================================================

create table if not exists
public.workspace_onboarding_steps (
  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  step_key text not null,

  status text not null
    default 'pending',

  is_required boolean not null
    default true,

  completed_at timestamptz,

  completed_by uuid
    references public.profiles(id)
    on delete set null,

  metadata jsonb not null
    default '{}'::jsonb,

  updated_at timestamptz not null
    default now(),

  primary key (
    workspace_id,
    step_key
  ),

  constraint
    workspace_onboarding_steps_key_check
  check (
    step_key in (
      'campaign_identity',
      'election_details',
      'branding',
      'security',
      'team',
      'communications',
      'calendar',
      'files',
      'texting',
      'review'
    )
  ),

  constraint
    workspace_onboarding_steps_status_check
  check (
    status in (
      'pending',
      'in_progress',
      'complete',
      'not_required',
      'pending_verification',
      'blocked'
    )
  ),

  constraint
    workspace_onboarding_steps_metadata_check
  check (
    jsonb_typeof(metadata) = 'object'
  )
);

create index if not exists
workspace_onboarding_steps_workspace_status_idx
on public.workspace_onboarding_steps (
  workspace_id,
  status
);

alter table
public.workspace_onboarding_steps
enable row level security;

revoke all
on table
public.workspace_onboarding_steps
from public, anon;

grant select
on table
public.workspace_onboarding_steps
to authenticated;


drop policy if exists
  "Leadership can view workspace onboarding"
on public.workspace_onboarding_steps;

create policy
  "Leadership can view workspace onboarding"
on public.workspace_onboarding_steps
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members
      as member
    where
      member.workspace_id =
        workspace_onboarding_steps.workspace_id
      and member.user_id =
        auth.uid()
      and member.status =
        'active'
      and member.membership_state =
        'active'
      and member.role_key in (
        'campaign_owner',
        'candidate',
        'campaign_consultant',
        'campaign_manager',
        'campaign_administrator'
      )
  )
);


create or replace function
private.seed_workspace_onboarding_steps()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $campaign_seat$
begin
  insert into
  public.workspace_onboarding_steps (
    workspace_id,
    step_key,
    is_required
  )
  values
    (new.id, 'campaign_identity', true),
    (new.id, 'election_details', true),
    (new.id, 'branding', true),
    (new.id, 'security', true),
    (new.id, 'team', true),
    (new.id, 'communications', true),
    (new.id, 'calendar', true),
    (new.id, 'files', true),
    (new.id, 'texting', false),
    (new.id, 'review', true)
  on conflict (
    workspace_id,
    step_key
  )
  do nothing;

  return new;
end;
$campaign_seat$;

revoke all
on function
private.seed_workspace_onboarding_steps()
from public, anon, authenticated;

drop trigger if exists
  workspaces_seed_onboarding_steps
on public.workspaces;

create trigger
  workspaces_seed_onboarding_steps
after insert
on public.workspaces
for each row
execute function
  private.seed_workspace_onboarding_steps();


-- Seed the onboarding model for existing workspaces.
insert into
public.workspace_onboarding_steps (
  workspace_id,
  step_key,
  is_required
)
select
  workspace_record.id,
  step.step_key,
  step.is_required
from public.workspaces
  as workspace_record
cross join (
  values
    ('campaign_identity'::text, true),
    ('election_details'::text, true),
    ('branding'::text, true),
    ('security'::text, true),
    ('team'::text, true),
    ('communications'::text, true),
    ('calendar'::text, true),
    ('files'::text, true),
    ('texting'::text, false),
    ('review'::text, true)
) as step(
  step_key,
  is_required
)
on conflict (
  workspace_id,
  step_key
)
do nothing;


-- ============================================================
-- PUBLIC INTEGRATION CONNECTION METADATA
--
-- No provider tokens belong in this table.
-- This is the safe operational metadata a leadership user or
-- Integration Center can display.
-- ============================================================

create table if not exists
public.workspace_integrations (
  id uuid primary key
    default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  provider text not null,

  integration_type text not null,

  connection_key text not null
    default 'primary',

  status text not null
    default 'not_connected',

  display_name text,

  display_email text,

  external_account_id text,

  external_resource_id text,

  capabilities jsonb not null
    default '{}'::jsonb,

  settings jsonb not null
    default '{}'::jsonb,

  last_sync_at timestamptz,

  last_success_at timestamptz,

  last_error_code text,

  last_error_summary text,

  connected_by uuid
    references public.profiles(id)
    on delete set null,

  connected_at timestamptz,

  disconnected_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint
    workspace_integrations_provider_check
  check (
    provider in (
      'google',
      'microsoft',
      'nylas',
      'nango',
      'twilio',
      'other'
    )
  ),

  constraint
    workspace_integrations_type_check
  check (
    integration_type in (
      'email',
      'calendar',
      'contacts',
      'files',
      'sms',
      'whatsapp',
      'social',
      'other'
    )
  ),

  constraint
    workspace_integrations_status_check
  check (
    status in (
      'not_connected',
      'connecting',
      'connected',
      'degraded',
      'reauthorization_required',
      'pending_verification',
      'disconnected',
      'error'
    )
  ),

  constraint
    workspace_integrations_capabilities_check
  check (
    jsonb_typeof(capabilities) =
      'object'
  ),

  constraint
    workspace_integrations_settings_check
  check (
    jsonb_typeof(settings) =
      'object'
  ),

  constraint
    workspace_integrations_unique_connection
  unique (
    workspace_id,
    provider,
    integration_type,
    connection_key
  )
);

create index if not exists
workspace_integrations_workspace_status_idx
on public.workspace_integrations (
  workspace_id,
  status
);

alter table
public.workspace_integrations
enable row level security;

revoke all
on table
public.workspace_integrations
from public, anon;

grant select
on table
public.workspace_integrations
to authenticated;


drop policy if exists
  "Leadership can view workspace integrations"
on public.workspace_integrations;

create policy
  "Leadership can view workspace integrations"
on public.workspace_integrations
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members
      as member
    where
      member.workspace_id =
        workspace_integrations.workspace_id
      and member.user_id =
        auth.uid()
      and member.status =
        'active'
      and member.membership_state =
        'active'
      and member.role_key in (
        'campaign_owner',
        'candidate',
        'campaign_consultant',
        'campaign_manager',
        'campaign_administrator'
      )
  )
);


-- ============================================================
-- PRIVATE INTEGRATION CREDENTIAL REFERENCES
--
-- Campaign Seat stores a reference to provider credentials here.
-- Raw OAuth refresh tokens are never exposed through public
-- PostgREST tables.
-- ============================================================

create table if not exists
private.workspace_integration_credentials (
  integration_id uuid primary key
    references public.workspace_integrations(id)
    on delete cascade,

  credential_reference text,

  provider_grant_id text,

  token_expires_at timestamptz,

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint
    workspace_integration_credentials_metadata_check
  check (
    jsonb_typeof(metadata) =
      'object'
  )
);

alter table
private.workspace_integration_credentials
enable row level security;

revoke all
on table
private.workspace_integration_credentials
from public, anon, authenticated;

grant
  select,
  insert,
  update,
  delete
on table
private.workspace_integration_credentials
to service_role;


-- ============================================================
-- CAMPAIGN SEAT PLATFORM STAFF
--
-- IMPORTANT:
-- Campaign Seat already has the authoritative platform staff
-- model in public.platform_staff and the security helper
-- public.is_platform_staff().
--
-- Do not create a second staff table or overload that helper.
--
-- Existing roles:
--   platform_owner
--   platform_admin
--   developer
--   platform_support
--
-- The helper below adds optional role-specific authorization
-- while preserving the existing platform security architecture.
-- ============================================================

create or replace function
public.has_platform_role(
  required_roles text[]
  default null
)
returns boolean
language sql
stable
security definer
set search_path =
  public,
  pg_temp
as $campaign_seat$
  select exists (
    select 1
    from public.platform_staff
      as staff
    where
      staff.user_id =
        auth.uid()
      and staff.status =
        'active'
      and (
        required_roles is null
        or staff.platform_role =
          any(required_roles)
      )
  );
$campaign_seat$;

revoke all
on function
public.has_platform_role(text[])
from public, anon;

grant execute
on function
public.has_platform_role(text[])
to authenticated, service_role;


-- ============================================================
-- PLATFORM AUDIT LOG
--
-- Every future Super Admin action should write here.
-- It stores operational metadata, not customer message bodies.
-- ============================================================

create table if not exists
private.platform_audit_log (
  id uuid primary key
    default gen_random_uuid(),

  actor_user_id uuid
    references auth.users(id)
    on delete set null,

  workspace_id uuid
    references public.workspaces(id)
    on delete set null,

  action text not null,

  target_type text,

  target_id text,

  reason text,

  metadata jsonb not null
    default '{}'::jsonb,

  occurred_at timestamptz not null
    default now(),

  constraint
    platform_audit_log_metadata_check
  check (
    jsonb_typeof(metadata) =
      'object'
  )
);

create index if not exists
platform_audit_log_workspace_time_idx
on private.platform_audit_log (
  workspace_id,
  occurred_at desc
);

create index if not exists
platform_audit_log_actor_time_idx
on private.platform_audit_log (
  actor_user_id,
  occurred_at desc
);

alter table
private.platform_audit_log
enable row level security;

revoke all
on table
private.platform_audit_log
from public, anon, authenticated;

grant
  select,
  insert
on table
private.platform_audit_log
to service_role;


-- ============================================================
-- FUTURE FIRST-WORKSPACE PROVISIONING
--
-- Current Campaign Seat account creation is invitation-only.
-- We intentionally do NOT weaken that existing Auth hook here.
--
-- A future protected Edge Function will:
--   1. verify Turnstile/rate limits
--   2. create this request
--   3. provision the workspace
--   4. create a campaign_owner invitation
--   5. let the owner create their account through the existing
--      invitation-protected Auth path
--
-- This preserves the existing account-creation security model.
-- ============================================================

create table if not exists
private.workspace_provisioning_requests (
  id uuid primary key
    default gen_random_uuid(),

  email text not null,

  campaign_name text not null,

  campaign_type text not null
    default 'candidate_campaign',

  political_party text,

  request_payload jsonb not null
    default '{}'::jsonb,

  status text not null
    default 'pending',

  workspace_id uuid
    references public.workspaces(id)
    on delete set null,

  processed_at timestamptz,

  failure_code text,

  failure_summary text,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint
    workspace_provisioning_requests_status_check
  check (
    status in (
      'pending',
      'processing',
      'provisioned',
      'rejected',
      'failed'
    )
  ),

  constraint
    workspace_provisioning_requests_payload_check
  check (
    jsonb_typeof(request_payload) =
      'object'
  )
);

alter table
private.workspace_provisioning_requests
enable row level security;

revoke all
on table
private.workspace_provisioning_requests
from public, anon, authenticated;

grant
  select,
  insert,
  update,
  delete
on table
private.workspace_provisioning_requests
to service_role;


-- ============================================================
-- PRIVATE SCHEMA FINAL LOCK
-- ============================================================

revoke all
on all tables in schema private
from public, anon, authenticated;

revoke all
on all functions in schema private
from public, anon, authenticated;


notify pgrst, 'reload schema';

commit;

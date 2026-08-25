-- ============================================================
-- CAMPAIGN SEAT
-- PLATFORM ADMIN WORKSPACE DRAFT / PREVIEW / PUBLISH FOUNDATION
-- ============================================================
--
-- public.workspaces remains the LIVE customer-facing record.
--
-- Draft edits live only in private.platform_workspace_revisions.
-- Save Draft NEVER writes to public.workspaces.
-- Publish is the only RPC in this workflow that updates live data.
--
-- All public RPCs require:
--   * authenticated user
--   * AAL2 / MFA
--   * platform_owner or platform_admin
-- through public.seat_platform_admin_authorized().
-- ============================================================


-- ============================================================
-- PRIVATE REVISION HISTORY
-- ============================================================

create table if not exists private.platform_workspace_revisions (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  product_account_id uuid not null
    references public.seat_product_accounts(id)
    on delete cascade,

  revision_number integer not null
    check (revision_number >= 1),

  status text not null default 'draft'
    check (
      status in (
        'draft',
        'superseded',
        'published'
      )
    ),

  base_workspace_updated_at timestamptz not null,

  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object'),

  created_by uuid not null
    references auth.users(id),

  updated_by uuid not null
    references auth.users(id),

  published_by uuid
    references auth.users(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,

  unique (
    workspace_id,
    revision_number
  )
);


alter table
  private.platform_workspace_revisions
enable row level security;


revoke all
on table private.platform_workspace_revisions
from anon, authenticated;


create unique index if not exists
  platform_workspace_revisions_one_draft_idx
on private.platform_workspace_revisions (
  workspace_id
)
where status = 'draft';


create index if not exists
  platform_workspace_revisions_account_idx
on private.platform_workspace_revisions (
  product_account_id,
  revision_number desc
);


create index if not exists
  platform_workspace_revisions_workspace_history_idx
on private.platform_workspace_revisions (
  workspace_id,
  revision_number desc
);


-- ============================================================
-- STRICT WORKSPACE EDITOR FIELD ALLOWLIST
-- ============================================================

create or replace function
private.filter_platform_workspace_payload(
  target_payload jsonb
)
returns jsonb
language sql
immutable
set search_path = pg_catalog, public, private, pg_temp
as $$
  select
    coalesce(
      jsonb_object_agg(
        item.key,
        item.value
      ),
      '{}'::jsonb
    )
  from jsonb_each(
    coalesce(
      target_payload,
      '{}'::jsonb
    )
  ) as item
  where item.key = any(
    array[
      'name',
      'description',
      'location',
      'election_date',
      'political_party',
      'campaign_type',
      'candidate_name',
      'legal_committee_name',
      'office_sought',
      'office_level',
      'district_label',
      'jurisdiction_name',
      'jurisdiction_type',
      'primary_election_date',
      'general_election_date',
      'timezone',
      'campaign_email',
      'campaign_phone',
      'website_url',
      'campaign_address',
      'disclaimer_text',
      'recommended_theme',
      'active_theme',
      'theme_source',
      'theme_primary_color',
      'theme_accent_color',
      'candidate_bio',
      'candidate_photo_path',
      'candidate_public_email',
      'candidate_public_phone',
      'country_code',
      'state_region',
      'county_name',
      'municipality_name',
      'postal_code',
      'latitude',
      'longitude',
      'location_source',
      'location_context'
    ]::text[]
  );
$$;


revoke all
on function
private.filter_platform_workspace_payload(jsonb)
from public, anon, authenticated;


-- ============================================================
-- LOAD LIVE + DRAFT + PREVIEW
-- ============================================================

create or replace function
public.get_platform_workspace_editor(
  target_workspace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  workspace_row
    public.workspaces%rowtype;

  binding_row
    public.seat_workspace_bindings%rowtype;

  account_row
    public.seat_product_accounts%rowtype;

  customer_row
    public.seat_customers%rowtype;

  draft_json jsonb;
  live_json jsonb;
  preview_json jsonb;
  draft_is_stale boolean := false;
begin
  if not public.seat_platform_admin_authorized() then
    raise exception
      'Seat Platform Admin authorization with MFA is required.';
  end if;


  select *
  into workspace_row
  from public.workspaces
  where id = target_workspace_id;

  if not found then
    raise exception
      'Campaign workspace could not be found.';
  end if;


  select *
  into binding_row
  from public.seat_workspace_bindings
  where
    workspace_id = target_workspace_id
    and status = 'active'
  limit 1;

  if not found then
    raise exception
      'This workspace is not bound to an active Seat product account.';
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


  select
    jsonb_build_object(
      'id',
        revision.id,

      'revision_number',
        revision.revision_number,

      'status',
        revision.status,

      'base_workspace_updated_at',
        revision.base_workspace_updated_at,

      'payload',
        revision.payload,

      'created_by',
        revision.created_by,

      'updated_by',
        revision.updated_by,

      'created_at',
        revision.created_at,

      'updated_at',
        revision.updated_at
    )
  into draft_json
  from private.platform_workspace_revisions
    as revision
  where
    revision.workspace_id =
      target_workspace_id
    and revision.status =
      'draft'
  order by
    revision.revision_number desc
  limit 1;


  live_json :=
    to_jsonb(workspace_row);


  preview_json :=
    live_json ||
    coalesce(
      draft_json -> 'payload',
      '{}'::jsonb
    );


  if draft_json is not null then
    draft_is_stale :=
      (
        draft_json
          ->> 'base_workspace_updated_at'
      )::timestamptz
      <>
      workspace_row.updated_at;
  end if;


  return jsonb_build_object(
    'workspace',
      live_json,

    'draft',
      draft_json,

    'preview',
      preview_json,

    'draft_is_stale',
      draft_is_stale,

    'binding',
      jsonb_build_object(
        'id',
          binding_row.id,

        'product_account_id',
          binding_row.product_account_id,

        'relationship_type',
          binding_row.relationship_type,

        'status',
          binding_row.status
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
          account_row.onboarding_status
      ),

    'customer',
      jsonb_build_object(
        'id',
          customer_row.id,

        'display_name',
          customer_row.display_name,

        'customer_type',
          customer_row.customer_type,

        'status',
          customer_row.status
      )
  );
end;
$$;


-- ============================================================
-- SAVE DRAFT
--
-- NEVER UPDATES public.workspaces
-- ============================================================

create or replace function
public.save_platform_workspace_draft(
  target_workspace_id uuid,
  target_payload jsonb,
  expected_revision_number integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  workspace_row
    public.workspaces%rowtype;

  binding_row
    public.seat_workspace_bindings%rowtype;

  existing_draft
    private.platform_workspace_revisions%rowtype;

  clean_payload jsonb;

  next_revision integer;

  new_revision_id uuid;
begin
  if not public.seat_platform_admin_authorized() then
    raise exception
      'Seat Platform Admin authorization with MFA is required.';
  end if;


  if
    target_payload is null
    or jsonb_typeof(target_payload) <> 'object'
  then
    raise exception
      'Workspace draft payload must be a JSON object.';
  end if;


  clean_payload :=
    private.filter_platform_workspace_payload(
      target_payload
    );


  if clean_payload = '{}'::jsonb then
    raise exception
      'No supported workspace changes were provided.';
  end if;


  if
    clean_payload ? 'name'
    and nullif(
      btrim(
        clean_payload ->> 'name'
      ),
      ''
    ) is null
  then
    raise exception
      'Workspace name cannot be empty.';
  end if;


  if
    clean_payload ? 'campaign_address'
    and jsonb_typeof(
      clean_payload -> 'campaign_address'
    ) <> 'object'
  then
    raise exception
      'Campaign address must be an object.';
  end if;


  if
    clean_payload ? 'location_context'
    and jsonb_typeof(
      clean_payload -> 'location_context'
    ) <> 'object'
  then
    raise exception
      'Location context must be an object.';
  end if;


  select *
  into workspace_row
  from public.workspaces
  where id = target_workspace_id
  for update;

  if not found then
    raise exception
      'Campaign workspace could not be found.';
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
      'This workspace is not bound to an active Seat product account.';
  end if;


  select *
  into existing_draft
  from private.platform_workspace_revisions
  where
    workspace_id =
      target_workspace_id
    and status =
      'draft'
  order by
    revision_number desc
  limit 1
  for update;


  if found then
    if
      expected_revision_number is not null
      and existing_draft.revision_number
        <> expected_revision_number
    then
      raise exception
        'This draft changed after it was loaded. Reload before saving.';
    end if;
  else
    if
      expected_revision_number is not null
      and expected_revision_number <> 0
    then
      raise exception
        'The expected draft revision no longer exists. Reload before saving.';
    end if;
  end if;


  select
    coalesce(
      max(revision_number),
      0
    ) + 1
  into next_revision
  from private.platform_workspace_revisions
  where workspace_id =
    target_workspace_id;


  if existing_draft.id is not null then
    update
      private.platform_workspace_revisions
    set
      status =
        'superseded',

      updated_by =
        auth.uid(),

      updated_at =
        now()
    where id =
      existing_draft.id;
  end if;


  insert into
    private.platform_workspace_revisions (
      workspace_id,
      product_account_id,
      revision_number,
      status,
      base_workspace_updated_at,
      payload,
      created_by,
      updated_by
    )
  values (
    target_workspace_id,
    binding_row.product_account_id,
    next_revision,
    'draft',
    workspace_row.updated_at,
    clean_payload,
    auth.uid(),
    auth.uid()
  )
  returning id
  into new_revision_id;


  insert into
    private.platform_audit_log (
      actor_user_id,
      workspace_id,
      action,
      target_type,
      target_id,
      metadata
    )
  values (
    auth.uid(),
    target_workspace_id,
    'workspace_draft_saved',
    'platform_workspace_revision',
    new_revision_id::text,
    jsonb_build_object(
      'revision_number',
        next_revision,

      'product_account_id',
        binding_row.product_account_id
    )
  );


  return
    public.get_platform_workspace_editor(
      target_workspace_id
    );
end;
$$;


-- ============================================================
-- PREVIEW DRAFT AS CAMPAIGN
--
-- RETURNS LIVE + DRAFT OVERLAY.
-- DOES NOT WRITE TO public.workspaces.
-- ============================================================

create or replace function
public.preview_platform_workspace_draft(
  target_workspace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  editor jsonb;
begin
  if not public.seat_platform_admin_authorized() then
    raise exception
      'Seat Platform Admin authorization with MFA is required.';
  end if;


  editor :=
    public.get_platform_workspace_editor(
      target_workspace_id
    );


  return jsonb_build_object(
    'workspace_id',
      target_workspace_id,

    'draft',
      editor -> 'draft',

    'draft_is_stale',
      editor -> 'draft_is_stale',

    'preview',
      editor -> 'preview'
  );
end;
$$;


-- ============================================================
-- PUBLISH DRAFT
--
-- THIS IS THE ONLY RPC IN THIS WORKFLOW THAT WRITES
-- ADMIN WORKSPACE CHANGES INTO public.workspaces.
-- ============================================================

create or replace function
public.publish_platform_workspace_draft(
  target_workspace_id uuid,
  target_revision_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  workspace_row
    public.workspaces%rowtype;

  candidate_workspace
    public.workspaces%rowtype;

  binding_row
    public.seat_workspace_bindings%rowtype;

  revision_row
    private.platform_workspace_revisions%rowtype;

  clean_payload jsonb;

  changed_keys jsonb;
begin
  if not public.seat_platform_admin_authorized() then
    raise exception
      'Seat Platform Admin authorization with MFA is required.';
  end if;


  select *
  into workspace_row
  from public.workspaces
  where id =
    target_workspace_id
  for update;

  if not found then
    raise exception
      'Campaign workspace could not be found.';
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
      'This workspace is not bound to an active Seat product account.';
  end if;


  select *
  into revision_row
  from private.platform_workspace_revisions
  where
    id =
      target_revision_id
    and workspace_id =
      target_workspace_id
    and product_account_id =
      binding_row.product_account_id
    and status =
      'draft'
  for update;

  if not found then
    raise exception
      'The selected workspace draft is no longer publishable.';
  end if;


  if
    revision_row.base_workspace_updated_at
    <>
    workspace_row.updated_at
  then
    raise exception
      'The live workspace changed after this draft was saved. Reload and review before publishing.';
  end if;


  clean_payload :=
    private.filter_platform_workspace_payload(
      revision_row.payload
    );


  if clean_payload = '{}'::jsonb then
    raise exception
      'This draft contains no publishable workspace changes.';
  end if;


  select *
  into candidate_workspace
  from jsonb_populate_record(
    null::public.workspaces,
    to_jsonb(workspace_row)
      || clean_payload
  );


  if
    nullif(
      btrim(
        candidate_workspace.name
      ),
      ''
    ) is null
  then
    raise exception
      'Workspace name cannot be empty.';
  end if;


  update public.workspaces
  set
    name =
      candidate_workspace.name,

    description =
      candidate_workspace.description,

    location =
      candidate_workspace.location,

    election_date =
      candidate_workspace.election_date,

    political_party =
      candidate_workspace.political_party,

    campaign_type =
      candidate_workspace.campaign_type,

    candidate_name =
      candidate_workspace.candidate_name,

    legal_committee_name =
      candidate_workspace.legal_committee_name,

    office_sought =
      candidate_workspace.office_sought,

    office_level =
      candidate_workspace.office_level,

    district_label =
      candidate_workspace.district_label,

    jurisdiction_name =
      candidate_workspace.jurisdiction_name,

    jurisdiction_type =
      candidate_workspace.jurisdiction_type,

    primary_election_date =
      candidate_workspace.primary_election_date,

    general_election_date =
      candidate_workspace.general_election_date,

    timezone =
      candidate_workspace.timezone,

    campaign_email =
      candidate_workspace.campaign_email,

    campaign_phone =
      candidate_workspace.campaign_phone,

    website_url =
      candidate_workspace.website_url,

    campaign_address =
      candidate_workspace.campaign_address,

    disclaimer_text =
      candidate_workspace.disclaimer_text,

    recommended_theme =
      candidate_workspace.recommended_theme,

    active_theme =
      candidate_workspace.active_theme,

    theme_source =
      candidate_workspace.theme_source,

    theme_primary_color =
      candidate_workspace.theme_primary_color,

    theme_accent_color =
      candidate_workspace.theme_accent_color,

    candidate_bio =
      candidate_workspace.candidate_bio,

    candidate_photo_path =
      candidate_workspace.candidate_photo_path,

    candidate_public_email =
      candidate_workspace.candidate_public_email,

    candidate_public_phone =
      candidate_workspace.candidate_public_phone,

    country_code =
      candidate_workspace.country_code,

    state_region =
      candidate_workspace.state_region,

    county_name =
      candidate_workspace.county_name,

    municipality_name =
      candidate_workspace.municipality_name,

    postal_code =
      candidate_workspace.postal_code,

    latitude =
      candidate_workspace.latitude,

    longitude =
      candidate_workspace.longitude,

    location_source =
      candidate_workspace.location_source,

    location_context =
      candidate_workspace.location_context,

    updated_at =
      now()

  where id =
    target_workspace_id;


  update
    private.platform_workspace_revisions
  set
    status =
      'published',

    updated_by =
      auth.uid(),

    published_by =
      auth.uid(),

    updated_at =
      now(),

    published_at =
      now()

  where id =
    revision_row.id;


  select
    coalesce(
      jsonb_agg(
        key_name
        order by key_name
      ),
      '[]'::jsonb
    )
  into changed_keys
  from jsonb_object_keys(
    clean_payload
  ) as key_name;


  insert into
    private.platform_audit_log (
      actor_user_id,
      workspace_id,
      action,
      target_type,
      target_id,
      metadata
    )
  values (
    auth.uid(),
    target_workspace_id,
    'workspace_draft_published',
    'platform_workspace_revision',
    revision_row.id::text,
    jsonb_build_object(
      'revision_number',
        revision_row.revision_number,

      'product_account_id',
        binding_row.product_account_id,

      'changed_fields',
        changed_keys
    )
  );


  return
    public.get_platform_workspace_editor(
      target_workspace_id
    );
end;
$$;


-- ============================================================
-- RPC PERMISSIONS
-- ============================================================

revoke all
on function
public.get_platform_workspace_editor(uuid)
from public, anon, authenticated;

revoke all
on function
public.save_platform_workspace_draft(uuid, jsonb, integer)
from public, anon, authenticated;

revoke all
on function
public.preview_platform_workspace_draft(uuid)
from public, anon, authenticated;

revoke all
on function
public.publish_platform_workspace_draft(uuid, uuid)
from public, anon, authenticated;


grant execute
on function
public.get_platform_workspace_editor(uuid)
to authenticated;

grant execute
on function
public.save_platform_workspace_draft(uuid, jsonb, integer)
to authenticated;

grant execute
on function
public.preview_platform_workspace_draft(uuid)
to authenticated;

grant execute
on function
public.publish_platform_workspace_draft(uuid, uuid)
to authenticated;


comment on table
private.platform_workspace_revisions
is
'Private immutable-style Platform Admin workspace revision history. Draft records never affect the live customer workspace until explicitly published.';


comment on function
public.save_platform_workspace_draft(uuid, jsonb, integer)
is
'Platform Admin AAL2-only Save Draft operation. Never updates public.workspaces.';


comment on function
public.publish_platform_workspace_draft(uuid, uuid)
is
'Platform Admin AAL2-only publish operation. Explicitly promotes a non-stale workspace draft into public.workspaces.';

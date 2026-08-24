begin;

-- ============================================================
-- CAMPAIGN SEAT
-- MULTI-PROVIDER WORKSPACE READ SYNC
--
-- Provides safe server-side contracts for:
--
--   Microsoft Calendar
--   Google Calendar
--   Microsoft Contacts
--   Google Contacts
--
-- This migration DOES NOT run a sync.
-- This migration DOES NOT create a workspace.
-- This migration DOES NOT modify provider data.
-- ============================================================


-- ============================================================
-- CONTACT EXTERNAL LINKS
--
-- One Campaign Seat contact can represent the same person from
-- multiple provider address books without duplicating the
-- Campaign Seat contact record.
-- ============================================================

create table if not exists
public.campaign_contact_external_links (

  id uuid
    primary key
    default gen_random_uuid(),

  workspace_id uuid
    not null
    references public.workspaces(id)
    on delete cascade,

  contact_id uuid
    not null
    references public.campaign_contacts(id)
    on delete cascade,

  source_integration_id uuid
    not null
    references public.workspace_integrations(id)
    on delete cascade,

  source_provider text
    not null
    default 'nylas',

  source_account_provider text
    not null,

  external_contact_id text
    not null,

  source_metadata jsonb
    not null
    default '{}'::jsonb,

  last_seen_at timestamptz
    not null
    default now(),

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint
  campaign_contact_external_links_provider_check
  check (
    source_provider =
      'nylas'
  ),

  constraint
  campaign_contact_external_links_account_provider_check
  check (
    source_account_provider in (
      'google',
      'microsoft'
    )
  ),

  constraint
  campaign_contact_external_links_external_id_check
  check (
    btrim(
      external_contact_id
    ) <> ''
  ),

  constraint
  campaign_contact_external_links_metadata_check
  check (
    jsonb_typeof(
      source_metadata
    ) = 'object'
  ),

  constraint
  campaign_contact_external_links_identity_unique
  unique (
    workspace_id,
    source_integration_id,
    external_contact_id
  )
);


create index if not exists
campaign_contact_external_links_contact_idx
on public.campaign_contact_external_links (
  workspace_id,
  contact_id
);


create index if not exists
campaign_contact_external_links_integration_idx
on public.campaign_contact_external_links (
  workspace_id,
  source_integration_id
);


alter table
public.campaign_contact_external_links
enable row level security;


revoke all
on table
public.campaign_contact_external_links
from
  public,
  anon,
  authenticated;



-- ============================================================
-- CONTACT LINK INTEGRITY
-- ============================================================

create or replace function
private.enforce_campaign_contact_external_link()
returns trigger
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $contact_external_link_integrity$
declare
  resolved_provider text;
begin

  if not exists (
    select 1
    from public.campaign_contacts
      as contact
    where
      contact.id =
        new.contact_id
      and contact.workspace_id =
        new.workspace_id
  )
  then
    raise exception
      'The Campaign Seat contact does not belong to this workspace.';
  end if;


  select
    lower(
      coalesce(
        integration.settings
          ->> 'account_provider',
        ''
      )
    )

  into resolved_provider

  from public.workspace_integrations
    as integration

  where
    integration.id =
      new.source_integration_id

    and integration.workspace_id =
      new.workspace_id

    and integration.provider =
      'nylas'

    and integration.integration_type =
      'contacts'

    and integration.status =
      'connected';


  if resolved_provider not in (
    'google',
    'microsoft'
  )
  then
    raise exception
      'The Contacts source integration is not valid for this workspace.';
  end if;


  new.source_provider :=
    'nylas';

  new.source_account_provider :=
    resolved_provider;

  new.external_contact_id :=
    btrim(
      new.external_contact_id
    );

  new.updated_at :=
    now();


  return new;

end;
$contact_external_link_integrity$;


revoke all
on function
private.enforce_campaign_contact_external_link()
from
  public,
  anon,
  authenticated;


drop trigger if exists
campaign_contact_external_link_integrity
on public.campaign_contact_external_links;


create trigger
campaign_contact_external_link_integrity

before insert
or update

on public.campaign_contact_external_links

for each row

execute function
private.enforce_campaign_contact_external_link();



-- ============================================================
-- SERVICE-ROLE CALENDAR RUNTIME RESOLVER
-- ============================================================

create or replace function
public.get_calendar_runtime_connections_for_service(
  target_workspace_id uuid
)
returns table (
  integration_id uuid,
  connected_email text,
  account_provider text,
  grant_reference text,
  read_ready boolean,
  write_ready boolean,
  runtime_priority integer
)
language sql
stable
security definer
set search_path =
  public,
  private,
  pg_temp
as $calendar_runtime_service$

  select
    integration.id,

    integration.display_email,

    integration.settings
      ->> 'account_provider',

    credential.provider_grant_id,

    coalesce(
      (
        integration.capabilities
          ->> 'read'
      )::boolean,
      false
    ),

    coalesce(
      (
        integration.capabilities
          ->> 'write'
      )::boolean,
      false
    ),

    case
      when coalesce(
        integration.settings
          ->> 'runtime_priority',
        ''
      ) ~ '^[0-9]+$'
      then (
        integration.settings
          ->> 'runtime_priority'
      )::integer
      else 0
    end

  from public.workspace_integrations
    as integration

  join private.workspace_integration_credentials
    as credential
    on credential.integration_id =
      integration.id

  where
    integration.workspace_id =
      target_workspace_id

    and integration.provider =
      'nylas'

    and integration.integration_type =
      'calendar'

    and integration.status =
      'connected'

    and credential.provider_grant_id
      is not null

    and btrim(
      credential.provider_grant_id
    ) <> ''

  order by
    7 desc,
    integration.connected_at desc
      nulls last,
    integration.id;

$calendar_runtime_service$;


revoke all
on function
public.get_calendar_runtime_connections_for_service(
  uuid
)
from
  public,
  anon,
  authenticated;


grant execute
on function
public.get_calendar_runtime_connections_for_service(
  uuid
)
to service_role;



-- ============================================================
-- SERVICE-ROLE CONTACTS RUNTIME RESOLVER
-- ============================================================

create or replace function
public.get_contacts_runtime_connections_for_service(
  target_workspace_id uuid
)
returns table (
  integration_id uuid,
  connected_email text,
  account_provider text,
  grant_reference text,
  read_ready boolean,
  import_ready boolean,
  runtime_priority integer
)
language sql
stable
security definer
set search_path =
  public,
  private,
  pg_temp
as $contacts_runtime_service$

  select
    integration.id,

    integration.display_email,

    integration.settings
      ->> 'account_provider',

    credential.provider_grant_id,

    coalesce(
      (
        integration.capabilities
          ->> 'read'
      )::boolean,
      false
    ),

    coalesce(
      (
        integration.capabilities
          ->> 'import'
      )::boolean,
      false
    ),

    case
      when coalesce(
        integration.settings
          ->> 'runtime_priority',
        ''
      ) ~ '^[0-9]+$'
      then (
        integration.settings
          ->> 'runtime_priority'
      )::integer
      else 0
    end

  from public.workspace_integrations
    as integration

  join private.workspace_integration_credentials
    as credential
    on credential.integration_id =
      integration.id

  where
    integration.workspace_id =
      target_workspace_id

    and integration.provider =
      'nylas'

    and integration.integration_type =
      'contacts'

    and integration.status =
      'connected'

    and credential.provider_grant_id
      is not null

    and btrim(
      credential.provider_grant_id
    ) <> ''

  order by
    7 desc,
    integration.connected_at desc
      nulls last,
    integration.id;

$contacts_runtime_service$;


revoke all
on function
public.get_contacts_runtime_connections_for_service(
  uuid
)
from
  public,
  anon,
  authenticated;


grant execute
on function
public.get_contacts_runtime_connections_for_service(
  uuid
)
to service_role;



-- ============================================================
-- CALENDAR PROVIDER IDENTITY
--
-- Existing imported Calendar rows were unique only by generic
-- Nylas provider identity. Multi-provider workspaces need the
-- actual runtime integration in the identity.
-- ============================================================

drop index if exists
public.events_external_provider_identity_unique_idx;


create unique index if not exists
events_external_integration_identity_unique_idx

on public.events (
  workspace_id,
  source_integration_id,
  external_calendar_id,
  external_event_id
)

where
  source_integration_id
    is not null

  and external_calendar_id
    is not null

  and external_event_id
    is not null;


create unique index if not exists
events_legacy_external_provider_identity_unique_idx

on public.events (
  workspace_id,
  source_provider,
  external_calendar_id,
  external_event_id
)

where
  source_integration_id
    is null

  and source_provider
    is not null

  and external_calendar_id
    is not null

  and external_event_id
    is not null;



-- ============================================================
-- MULTI-PROVIDER CALENDAR UPSERT
-- ============================================================

create or replace function
public.upsert_nylas_calendar_event_from_integration(
  target_workspace_id uuid,
  target_source_integration_id uuid,
  target_external_calendar_id text,
  target_external_event_id text,
  target_external_ical_uid text,
  target_title text,
  target_description text,
  target_location text,
  target_starts_at timestamptz,
  target_ends_at timestamptz,
  target_status text,
  target_is_all_day boolean,
  target_external_updated_at timestamptz,
  target_sync_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $calendar_multi_upsert$
declare
  resolved_event_id uuid;

  resolved_status text :=
    case
      when lower(
        coalesce(
          target_status,
          ''
        )
      ) = 'cancelled'
      then 'cancelled'
      else 'scheduled'
    end;
begin

  if target_source_integration_id
    is null
  then
    raise exception
      'A Calendar source integration is required.';
  end if;


  if not exists (
    select 1

    from public.workspace_integrations
      as integration

    where
      integration.id =
        target_source_integration_id

      and integration.workspace_id =
        target_workspace_id

      and integration.provider =
        'nylas'

      and integration.integration_type =
        'calendar'

      and integration.status =
        'connected'
  )
  then
    raise exception
      'The connected Calendar source could not be verified.';
  end if;


  if nullif(
    btrim(
      coalesce(
        target_external_calendar_id,
        ''
      )
    ),
    ''
  ) is null
  then
    raise exception
      'A provider Calendar ID is required.';
  end if;


  if nullif(
    btrim(
      coalesce(
        target_external_event_id,
        ''
      )
    ),
    ''
  ) is null
  then
    raise exception
      'A provider event ID is required.';
  end if;


  if target_starts_at
    is null
  then
    raise exception
      'A provider event start time is required.';
  end if;


  if
    target_ends_at
      is not null

    and target_ends_at <
      target_starts_at
  then
    raise exception
      'Provider event end time cannot precede its start.';
  end if;


  insert into public.events (
    workspace_id,
    title,
    description,
    event_type,
    location,
    starts_at,
    ends_at,
    status,
    capacity,
    rsvp_count,
    created_by,
    is_sample,
    source_provider,
    source_integration_id,
    external_calendar_id,
    external_event_id,
    external_ical_uid,
    external_updated_at,
    is_all_day,
    sync_metadata
  )
  values (
    target_workspace_id,

    coalesce(
      nullif(
        btrim(
          target_title
        ),
        ''
      ),
      'Untitled calendar event'
    ),

    nullif(
      btrim(
        coalesce(
          target_description,
          ''
        )
      ),
      ''
    ),

    'meeting',

    nullif(
      btrim(
        coalesce(
          target_location,
          ''
        )
      ),
      ''
    ),

    target_starts_at,
    target_ends_at,
    resolved_status,
    null,
    0,
    null,
    false,
    'nylas',
    target_source_integration_id,
    btrim(
      target_external_calendar_id
    ),
    btrim(
      target_external_event_id
    ),

    nullif(
      btrim(
        coalesce(
          target_external_ical_uid,
          ''
        )
      ),
      ''
    ),

    target_external_updated_at,

    coalesce(
      target_is_all_day,
      false
    ),

    coalesce(
      target_sync_metadata,
      '{}'::jsonb
    )
  )

  on conflict (
    workspace_id,
    source_integration_id,
    external_calendar_id,
    external_event_id
  )
  where
    source_integration_id
      is not null

    and external_calendar_id
      is not null

    and external_event_id
      is not null

  do update
  set
    title =
      excluded.title,

    description =
      excluded.description,

    location =
      excluded.location,

    starts_at =
      excluded.starts_at,

    ends_at =
      excluded.ends_at,

    status =
      excluded.status,

    external_ical_uid =
      excluded.external_ical_uid,

    external_updated_at =
      excluded.external_updated_at,

    is_all_day =
      excluded.is_all_day,

    sync_metadata =
      excluded.sync_metadata,

    updated_at =
      now()

  returning id
  into resolved_event_id;


  return resolved_event_id;

end;
$calendar_multi_upsert$;


revoke all
on function
public.upsert_nylas_calendar_event_from_integration(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  boolean,
  timestamptz,
  jsonb
)
from
  public,
  anon,
  authenticated;


grant execute
on function
public.upsert_nylas_calendar_event_from_integration(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  boolean,
  timestamptz,
  jsonb
)
to service_role;



-- ============================================================
-- COMPLETE ONE CALENDAR INTEGRATION SYNC
-- ============================================================

create or replace function
public.complete_nylas_calendar_integration_sync(
  target_workspace_id uuid,
  target_source_integration_id uuid,
  target_calendar_id text,
  target_calendar_name text,
  target_calendar_timezone text,
  target_imported_count integer
)
returns void
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $complete_calendar_integration_sync$
begin

  update public.workspace_integrations
  set
    last_sync_at =
      now(),

    last_success_at =
      now(),

    last_error_code =
      null,

    last_error_summary =
      null,

    settings =
      coalesce(
        settings,
        '{}'::jsonb
      ) ||
      jsonb_build_object(
        'primary_calendar_id',
        target_calendar_id,

        'primary_calendar_name',
        target_calendar_name,

        'primary_calendar_timezone',
        target_calendar_timezone,

        'last_imported_count',
        greatest(
          coalesce(
            target_imported_count,
            0
          ),
          0
        ),

        'last_multi_provider_sync_at',
        now()
      ),

    updated_at =
      now()

  where
    id =
      target_source_integration_id

    and workspace_id =
      target_workspace_id

    and provider =
      'nylas'

    and integration_type =
      'calendar'

    and status =
      'connected';


  if not found then
    raise exception
      'The Calendar integration could not be marked synchronized.';
  end if;

end;
$complete_calendar_integration_sync$;


revoke all
on function
public.complete_nylas_calendar_integration_sync(
  uuid,
  uuid,
  text,
  text,
  text,
  integer
)
from
  public,
  anon,
  authenticated;


grant execute
on function
public.complete_nylas_calendar_integration_sync(
  uuid,
  uuid,
  text,
  text,
  text,
  integer
)
to service_role;



-- ============================================================
-- CANONICAL CAMPAIGN CONTACT UPSERT
--
-- Provider address-book presence DOES NOT imply:
--
--   campaign email consent
--   campaign SMS consent
--   supporter status
--
-- Existing Campaign Seat consent and classification fields are
-- therefore never overwritten by provider sync.
-- ============================================================

create or replace function
public.upsert_nylas_campaign_contact_from_integration(
  target_workspace_id uuid,
  target_source_integration_id uuid,
  target_actor_user_id uuid,
  target_external_contact_id text,
  target_full_name text,
  target_email text,
  target_phone text,
  target_organization text,
  target_source_metadata jsonb
)
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $contact_multi_upsert$
declare
  normalized_external_id text :=
    btrim(
      coalesce(
        target_external_contact_id,
        ''
      )
    );

  normalized_name text :=
    btrim(
      coalesce(
        target_full_name,
        ''
      )
    );

  normalized_email text :=
    lower(
      btrim(
        coalesce(
          target_email,
          ''
        )
      )
    );

  normalized_phone text :=
    btrim(
      coalesce(
        target_phone,
        ''
      )
    );

  normalized_phone_digits text :=
    regexp_replace(
      coalesce(
        target_phone,
        ''
      ),
      '[^0-9]',
      '',
      'g'
    );

  normalized_organization text :=
    btrim(
      coalesce(
        target_organization,
        ''
      )
    );

  resolved_provider text;

  linked_contact_id uuid;

  matched_contact_id uuid;

  match_count integer :=
    0;

  action_name text;
begin

  if normalized_external_id = ''
  then
    return jsonb_build_object(
      'ok',
      false,
      'action',
      'skipped_invalid',
      'reason',
      'missing_external_contact_id'
    );
  end if;


  select
    lower(
      coalesce(
        integration.settings
          ->> 'account_provider',
        ''
      )
    )

  into resolved_provider

  from public.workspace_integrations
    as integration

  where
    integration.id =
      target_source_integration_id

    and integration.workspace_id =
      target_workspace_id

    and integration.provider =
      'nylas'

    and integration.integration_type =
      'contacts'

    and integration.status =
      'connected';


  if resolved_provider not in (
    'google',
    'microsoft'
  )
  then
    raise exception
      'The connected Contacts source could not be verified.';
  end if;


  select
    link.contact_id

  into linked_contact_id

  from public.campaign_contact_external_links
    as link

  where
    link.workspace_id =
      target_workspace_id

    and link.source_integration_id =
      target_source_integration_id

    and link.external_contact_id =
      normalized_external_id

  limit 1;


  if linked_contact_id
    is not null
  then

    update public.campaign_contacts
    set
      full_name =
        case
          when source_integration_id =
            target_source_integration_id
          then coalesce(
            nullif(
              normalized_name,
              ''
            ),
            full_name
          )
          else full_name
        end,

      email =
        case
          when email is null
          then nullif(
            normalized_email,
            ''
          )
          when source_integration_id =
            target_source_integration_id
          then coalesce(
            nullif(
              normalized_email,
              ''
            ),
            email
          )
          else email
        end,

      phone =
        case
          when phone is null
          then nullif(
            normalized_phone,
            ''
          )
          when source_integration_id =
            target_source_integration_id
          then coalesce(
            nullif(
              normalized_phone,
              ''
            ),
            phone
          )
          else phone
        end,

      organization =
        case
          when organization is null
          then nullif(
            normalized_organization,
            ''
          )
          when source_integration_id =
            target_source_integration_id
          then coalesce(
            nullif(
              normalized_organization,
              ''
            ),
            organization
          )
          else organization
        end,

      source_metadata =
        coalesce(
          source_metadata,
          '{}'::jsonb
        ) ||
        jsonb_build_object(
          'last_provider_sync_at',
          now()
        ),

      updated_by =
        coalesce(
          target_actor_user_id,
          updated_by
        ),

      updated_at =
        now()

    where id =
      linked_contact_id;


    update public.campaign_contact_external_links
    set
      source_metadata =
        coalesce(
          target_source_metadata,
          '{}'::jsonb
        ),

      last_seen_at =
        now(),

      updated_at =
        now()

    where
      workspace_id =
        target_workspace_id

      and source_integration_id =
        target_source_integration_id

      and external_contact_id =
        normalized_external_id;


    return jsonb_build_object(
      'ok',
      true,
      'action',
      'updated',
      'contact_id',
      linked_contact_id
    );

  end if;


  -- ----------------------------------------------------------
  -- Try to merge into one unambiguous Campaign Seat contact.
  -- Email is strongest; normalized phone is fallback.
  -- ----------------------------------------------------------

  if normalized_email <> ''
  then

    select
      count(*),
      min(contact.id)

    into
      match_count,
      matched_contact_id

    from public.campaign_contacts
      as contact

    where
      contact.workspace_id =
        target_workspace_id

      and contact.email
        is not null

      and lower(
        btrim(
          contact.email
        )
      ) =
        normalized_email;

  end if;


  if
    match_count = 0
    and normalized_phone_digits <> ''
  then

    select
      count(*),
      min(contact.id)

    into
      match_count,
      matched_contact_id

    from public.campaign_contacts
      as contact

    where
      contact.workspace_id =
        target_workspace_id

      and contact.phone
        is not null

      and regexp_replace(
        contact.phone,
        '[^0-9]',
        '',
        'g'
      ) =
        normalized_phone_digits;

  end if;


  if match_count > 1
  then
    return jsonb_build_object(
      'ok',
      false,
      'action',
      'skipped_ambiguous',
      'reason',
      'multiple_campaign_contact_matches'
    );
  end if;


  if match_count = 1
  then

    linked_contact_id :=
      matched_contact_id;

    action_name :=
      'linked';


    update public.campaign_contacts
    set
      email =
        coalesce(
          email,
          nullif(
            normalized_email,
            ''
          )
        ),

      phone =
        coalesce(
          phone,
          nullif(
            normalized_phone,
            ''
          )
        ),

      organization =
        coalesce(
          organization,
          nullif(
            normalized_organization,
            ''
          )
        ),

      updated_by =
        coalesce(
          target_actor_user_id,
          updated_by
        ),

      updated_at =
        now()

    where id =
      linked_contact_id;

  else

    if normalized_name = ''
    then
      normalized_name :=
        coalesce(
          nullif(
            normalized_email,
            ''
          ),
          nullif(
            normalized_phone,
            ''
          ),
          'Provider contact'
        );
    end if;


    insert into public.campaign_contacts (
      workspace_id,
      full_name,
      email,
      phone,
      organization,
      contact_type,
      source,
      status,
      notes,
      tags,
      email_consent,
      email_consent_at,
      sms_consent,
      sms_consent_at,
      consent_source,
      created_by,
      updated_by,
      source_integration_id,
      external_contact_id,
      source_provider,
      source_account_provider,
      source_metadata
    )
    values (
      target_workspace_id,
      normalized_name,
      nullif(
        normalized_email,
        ''
      ),
      nullif(
        normalized_phone,
        ''
      ),
      nullif(
        normalized_organization,
        ''
      ),
      'other',
      'provider_contacts',
      'active',
      null,
      '{}'::text[],
      false,
      null,
      false,
      null,
      null,
      target_actor_user_id,
      target_actor_user_id,
      target_source_integration_id,
      normalized_external_id,
      'nylas',
      resolved_provider,
      coalesce(
        target_source_metadata,
        '{}'::jsonb
      ) ||
      jsonb_build_object(
        'provider_imported_at',
        now()
      )
    )

    returning id
    into linked_contact_id;


    action_name :=
      'created';

  end if;


  insert into
  public.campaign_contact_external_links (
    workspace_id,
    contact_id,
    source_integration_id,
    source_provider,
    source_account_provider,
    external_contact_id,
    source_metadata,
    last_seen_at
  )
  values (
    target_workspace_id,
    linked_contact_id,
    target_source_integration_id,
    'nylas',
    resolved_provider,
    normalized_external_id,
    coalesce(
      target_source_metadata,
      '{}'::jsonb
    ),
    now()
  )

  on conflict (
    workspace_id,
    source_integration_id,
    external_contact_id
  )
  do update
  set
    contact_id =
      excluded.contact_id,

    source_metadata =
      excluded.source_metadata,

    last_seen_at =
      now(),

    updated_at =
      now();


  return jsonb_build_object(
    'ok',
    true,
    'action',
    action_name,
    'contact_id',
    linked_contact_id
  );

end;
$contact_multi_upsert$;


revoke all
on function
public.upsert_nylas_campaign_contact_from_integration(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb
)
from
  public,
  anon,
  authenticated;


grant execute
on function
public.upsert_nylas_campaign_contact_from_integration(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb
)
to service_role;



-- ============================================================
-- UPDATE ONE CONTACTS INTEGRATION AFTER SYNC
-- ============================================================

create or replace function
public.complete_nylas_contacts_integration_sync(
  target_workspace_id uuid,
  target_source_integration_id uuid,
  target_seen_count integer,
  target_created_count integer,
  target_linked_count integer,
  target_updated_count integer,
  target_skipped_count integer
)
returns void
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $complete_contacts_integration_sync$
begin

  update public.workspace_integrations
  set
    last_sync_at =
      now(),

    last_success_at =
      now(),

    last_error_code =
      null,

    last_error_summary =
      null,

    settings =
      coalesce(
        settings,
        '{}'::jsonb
      ) ||
      jsonb_build_object(
        'last_contacts_seen_count',
        greatest(
          coalesce(
            target_seen_count,
            0
          ),
          0
        ),

        'last_contacts_created_count',
        greatest(
          coalesce(
            target_created_count,
            0
          ),
          0
        ),

        'last_contacts_linked_count',
        greatest(
          coalesce(
            target_linked_count,
            0
          ),
          0
        ),

        'last_contacts_updated_count',
        greatest(
          coalesce(
            target_updated_count,
            0
          ),
          0
        ),

        'last_contacts_skipped_count',
        greatest(
          coalesce(
            target_skipped_count,
            0
          ),
          0
        ),

        'last_multi_provider_sync_at',
        now()
      ),

    updated_at =
      now()

  where
    id =
      target_source_integration_id

    and workspace_id =
      target_workspace_id

    and provider =
      'nylas'

    and integration_type =
      'contacts'

    and status =
      'connected';


  if not found then
    raise exception
      'The Contacts integration could not be marked synchronized.';
  end if;

end;
$complete_contacts_integration_sync$;


revoke all
on function
public.complete_nylas_contacts_integration_sync(
  uuid,
  uuid,
  integer,
  integer,
  integer,
  integer,
  integer
)
from
  public,
  anon,
  authenticated;


grant execute
on function
public.complete_nylas_contacts_integration_sync(
  uuid,
  uuid,
  integer,
  integer,
  integer,
  integer,
  integer
)
to service_role;


notify pgrst, 'reload schema';

commit;

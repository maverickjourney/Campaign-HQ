begin;

-- ============================================================
-- CAMPAIGN SEAT
-- MULTI-PROVIDER SYNC PROVENANCE
--
-- Adds immutable provider identity fields so Campaign Seat can
-- safely preserve Microsoft + Google records in one workspace.
--
-- THIS MIGRATION IMPORTS NO PROVIDER DATA.
-- ============================================================


-- ============================================================
-- CALENDAR EVENT PROVENANCE
-- ============================================================

alter table public.events
add column if not exists
source_integration_id uuid;


alter table public.events
add column if not exists
source_account_provider text;


do $$
begin

  if not exists (
    select 1
    from pg_constraint
    where conname =
      'events_source_integration_id_fkey'
  )
  then

    alter table public.events

    add constraint
    events_source_integration_id_fkey

    foreign key (
      source_integration_id
    )

    references
    public.workspace_integrations (
      id
    )

    on delete set null;

  end if;

end;
$$;


do $$
begin

  if not exists (
    select 1
    from pg_constraint
    where conname =
      'events_source_account_provider_check'
  )
  then

    alter table public.events

    add constraint
    events_source_account_provider_check

    check (
      source_account_provider
        is null

      or source_account_provider in (
        'google',
        'microsoft'
      )
    );

  end if;

end;
$$;


create index if not exists
events_source_integration_idx

on public.events (
  workspace_id,
  source_integration_id,
  starts_at
)

where source_integration_id
  is not null;



-- ============================================================
-- CAMPAIGN CONTACT PROVIDER PROVENANCE
-- ============================================================

alter table public.campaign_contacts
add column if not exists
source_integration_id uuid;


alter table public.campaign_contacts
add column if not exists
external_contact_id text;


alter table public.campaign_contacts
add column if not exists
source_provider text;


alter table public.campaign_contacts
add column if not exists
source_account_provider text;


alter table public.campaign_contacts
add column if not exists
source_metadata jsonb
not null
default '{}'::jsonb;


do $$
begin

  if not exists (
    select 1
    from pg_constraint
    where conname =
      'campaign_contacts_source_integration_id_fkey'
  )
  then

    alter table
    public.campaign_contacts

    add constraint
    campaign_contacts_source_integration_id_fkey

    foreign key (
      source_integration_id
    )

    references
    public.workspace_integrations (
      id
    )

    on delete set null;

  end if;

end;
$$;


do $$
begin

  if not exists (
    select 1
    from pg_constraint
    where conname =
      'campaign_contacts_source_provider_check'
  )
  then

    alter table
    public.campaign_contacts

    add constraint
    campaign_contacts_source_provider_check

    check (
      source_provider
        is null

      or source_provider =
        'nylas'
    );

  end if;

end;
$$;


do $$
begin

  if not exists (
    select 1
    from pg_constraint
    where conname =
      'campaign_contacts_source_account_provider_check'
  )
  then

    alter table
    public.campaign_contacts

    add constraint
    campaign_contacts_source_account_provider_check

    check (
      source_account_provider
        is null

      or source_account_provider in (
        'google',
        'microsoft'
      )
    );

  end if;

end;
$$;


do $$
begin

  if not exists (
    select 1
    from pg_constraint
    where conname =
      'campaign_contacts_source_metadata_check'
  )
  then

    alter table
    public.campaign_contacts

    add constraint
    campaign_contacts_source_metadata_check

    check (
      jsonb_typeof(
        source_metadata
      ) = 'object'
    );

  end if;

end;
$$;


create unique index if not exists
campaign_contacts_external_provider_identity_unique_idx

on public.campaign_contacts (
  workspace_id,
  source_integration_id,
  external_contact_id
)

where
  source_integration_id
    is not null

  and external_contact_id
    is not null;


create index if not exists
campaign_contacts_source_integration_idx

on public.campaign_contacts (
  workspace_id,
  source_integration_id
)

where source_integration_id
  is not null;



-- ============================================================
-- EVENT SOURCE-INTEGRATION INTEGRITY
--
-- If an imported event declares a source integration, that
-- integration must be a connected Nylas Calendar belonging to
-- the exact same workspace.
-- ============================================================

create or replace function
private.enforce_event_source_integration()
returns trigger
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $event_source_integrity$
begin

  if new.source_integration_id
    is null
  then
    return new;
  end if;


  if not exists (
    select 1

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
        'calendar'

      and integration.status =
        'connected'
  )
  then
    raise exception
      'Calendar event source integration does not belong to this workspace.';
  end if;


  select
    integration.settings
      ->> 'account_provider'

  into
    new.source_account_provider

  from public.workspace_integrations
    as integration

  where integration.id =
    new.source_integration_id;


  return new;

end;
$event_source_integrity$;


revoke all
on function
private.enforce_event_source_integration()
from
  public,
  anon,
  authenticated;


drop trigger if exists
events_source_integration_integrity
on public.events;


create trigger
events_source_integration_integrity

before insert
or update of
  workspace_id,
  source_integration_id

on public.events

for each row

execute function
private.enforce_event_source_integration();



-- ============================================================
-- CONTACT SOURCE-INTEGRATION INTEGRITY
-- ============================================================

create or replace function
private.enforce_contact_source_integration()
returns trigger
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $contact_source_integrity$
begin

  if new.source_integration_id
    is null
  then

    new.source_provider :=
      null;

    new.source_account_provider :=
      null;

    return new;

  end if;


  if not exists (
    select 1

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
        'connected'
  )
  then
    raise exception
      'Campaign contact source integration does not belong to this workspace.';
  end if;


  new.source_provider :=
    'nylas';


  select
    integration.settings
      ->> 'account_provider'

  into
    new.source_account_provider

  from public.workspace_integrations
    as integration

  where integration.id =
    new.source_integration_id;


  return new;

end;
$contact_source_integrity$;


revoke all
on function
private.enforce_contact_source_integration()
from
  public,
  anon,
  authenticated;


drop trigger if exists
campaign_contacts_source_integration_integrity
on public.campaign_contacts;


create trigger
campaign_contacts_source_integration_integrity

before insert
or update of
  workspace_id,
  source_integration_id

on public.campaign_contacts

for each row

execute function
private.enforce_contact_source_integration();



-- ============================================================
-- MULTI-PROVIDER CONTACT RUNTIME RESOLVER
--
-- Private/server-only because it returns protected Nylas grant
-- references.
-- ============================================================

create or replace function
private.get_contacts_runtime_connections(
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
as $contacts_runtime_all$

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

$contacts_runtime_all$;


revoke all
on function
private.get_contacts_runtime_connections(
  uuid
)
from
  public,
  anon,
  authenticated;


grant execute
on function
private.get_contacts_runtime_connections(
  uuid
)
to service_role;


notify pgrst, 'reload schema';

commit;

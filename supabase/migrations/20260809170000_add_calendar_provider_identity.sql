-- ============================================================
-- CAMPAIGN SEAT
-- PROVIDER CALENDAR EVENT IDENTITY
--
-- Extends the existing public.events table so Nylas/provider
-- events can be safely imported without creating duplicates.
--
-- Existing Campaign Seat-created events remain untouched.
-- ============================================================


alter table
  public.events
add column if not exists
  source_provider text;


alter table
  public.events
add column if not exists
  external_calendar_id text;


alter table
  public.events
add column if not exists
  external_event_id text;


alter table
  public.events
add column if not exists
  external_ical_uid text;


alter table
  public.events
add column if not exists
  external_updated_at timestamptz;


alter table
  public.events
add column if not exists
  is_all_day boolean not null
  default false;


alter table
  public.events
add column if not exists
  sync_metadata jsonb not null
  default '{}'::jsonb;


alter table
  public.events
drop constraint if exists
  events_source_provider_check;


alter table
  public.events
add constraint
  events_source_provider_check
check (
  source_provider is null
  or source_provider in (
    'nylas'
  )
);


alter table
  public.events
drop constraint if exists
  events_sync_metadata_check;


alter table
  public.events
add constraint
  events_sync_metadata_check
check (
  jsonb_typeof(
    sync_metadata
  ) = 'object'
);


create unique index if not exists
  events_external_provider_identity_unique_idx
on public.events (
  workspace_id,
  source_provider,
  external_calendar_id,
  external_event_id
)
where
  source_provider is not null
  and external_calendar_id is not null
  and external_event_id is not null;


create index if not exists
  events_external_ical_uid_idx
on public.events (
  workspace_id,
  external_ical_uid
)
where
  external_ical_uid is not null;


create index if not exists
  events_provider_sync_window_idx
on public.events (
  workspace_id,
  source_provider,
  starts_at
)
where
  source_provider is not null;

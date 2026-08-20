-- ============================================================
-- CAMPAIGN SEAT
-- NYLAS CALENDAR EVENT IMPORT CONTRACT
-- ============================================================


create or replace function
public.upsert_nylas_calendar_event(
  target_workspace_id uuid,
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
set search_path to
  'public',
  'private',
  'pg_temp'
as $function$
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

  if
    target_external_calendar_id is null
    or btrim(
      target_external_calendar_id
    ) = ''
  then
    raise exception
      'A provider calendar ID is required.';
  end if;


  if
    target_external_event_id is null
    or btrim(
      target_external_event_id
    ) = ''
  then
    raise exception
      'A provider event ID is required.';
  end if;


  if target_starts_at is null then
    raise exception
      'A provider event start time is required.';
  end if;


  if
    target_ends_at is not null
    and target_ends_at <
      target_starts_at
  then
    raise exception
      'Provider event end time cannot precede its start.';
  end if;


  if not exists (
    select 1
    from public.workspace_integrations
      as integration
    where
      integration.workspace_id =
        target_workspace_id

      and integration.provider =
        'nylas'

      and integration.integration_type =
        'calendar'

      and integration.status =
        'connected'
  ) then
    raise exception
      'A connected Nylas Calendar integration is required.';
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
    target_external_calendar_id,
    target_external_event_id,
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
    source_provider,
    external_calendar_id,
    external_event_id
  )
  where
    source_provider is not null
    and external_calendar_id is not null
    and external_event_id is not null

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
$function$;


revoke all
on function
public.upsert_nylas_calendar_event(
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
from public, anon, authenticated;

grant execute
on function
public.upsert_nylas_calendar_event(
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


create or replace function
public.complete_nylas_calendar_sync(
  target_workspace_id uuid,
  target_calendar_id text,
  target_calendar_name text,
  target_calendar_timezone text,
  target_imported_count integer
)
returns void
language plpgsql
security definer
set search_path to
  'public',
  'pg_temp'
as $function$
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
      settings ||
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
        )
      ),

    updated_at =
      now()

  where
    workspace_id =
      target_workspace_id

    and provider =
      'nylas'

    and integration_type =
      'calendar'

    and status =
      'connected';
end;
$function$;


revoke all
on function
public.complete_nylas_calendar_sync(
  uuid,
  text,
  text,
  text,
  integer
)
from public, anon, authenticated;

grant execute
on function
public.complete_nylas_calendar_sync(
  uuid,
  text,
  text,
  text,
  integer
)
to service_role;

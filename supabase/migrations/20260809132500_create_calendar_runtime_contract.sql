-- ============================================================
-- CAMPAIGN SEAT
-- NYLAS CALENDAR RUNTIME CONTRACT
--
-- Calendar uses the same verified Nylas grant as the campaign
-- mailbox, but stores its own public integration capability row.
-- Provider grant IDs remain private.
-- ============================================================


-- ------------------------------------------------------------
-- 1. SERVER-ONLY CALENDAR CONNECTION FINALIZATION
-- ------------------------------------------------------------

create or replace function
public.finalize_calendar_connection(
  target_workspace_id uuid,
  target_actor_user_id uuid,
  target_provider text,
  target_provider_grant_id text,
  target_email text,
  target_scope text
)
returns jsonb
language plpgsql
security definer
set search_path to
  'public',
  'private',
  'pg_temp'
as $function$
declare
  normalized_email text :=
    lower(
      btrim(
        coalesce(
          target_email,
          ''
        )
      )
    );

  normalized_provider text :=
    lower(
      btrim(
        coalesce(
          target_provider,
          ''
        )
      )
    );

  normalized_scope text :=
    lower(
      coalesce(
        target_scope,
        ''
      )
    );

  existing_email_integration_id uuid;
  existing_email_grant_id text;

  calendar_integration_id uuid;

  calendar_scope_verified boolean :=
    false;
begin

  if target_actor_user_id is null then
    raise exception
      'The connecting campaign user is required.'
      using errcode = '22023';
  end if;


  if normalized_provider not in (
    'google',
    'microsoft'
  ) then
    raise exception
      'The Calendar provider must be Google or Microsoft.'
      using errcode = '22023';
  end if;


  if
    target_provider_grant_id is null
    or btrim(
      target_provider_grant_id
    ) = ''
  then
    raise exception
      'A verified Nylas grant is required.'
      using errcode = '22023';
  end if;


  if
    normalized_email = ''
    or position(
      '@'
      in normalized_email
    ) <= 1
  then
    raise exception
      'A valid connected email address is required.'
      using errcode = '22023';
  end if;


  if not exists (
    select 1
    from public.workspace_members
      as member
    where
      member.workspace_id =
        target_workspace_id

      and member.user_id =
        target_actor_user_id

      and member.status =
        'active'

      and member.membership_state =
        'active'

      and member.dashboard_type in (
        'command',
        'candidate'
      )
  ) then
    raise exception
      'Active campaign leadership access is required.'
      using errcode = '42501';
  end if;


  if not exists (
    select 1
    from public.workspaces
      as workspace
    where
      workspace.id =
        target_workspace_id

      and workspace.onboarding_status =
        'active'

      and workspace.onboarding_current_step =
        'calendar'
  ) then
    raise exception
      'Calendar is not the current onboarding phase.';
  end if;


  if not exists (
    select 1
    from public.workspace_onboarding_steps
      as onboarding_step
    where
      onboarding_step.workspace_id =
        target_workspace_id

      and onboarding_step.step_key =
        'calendar'

      and onboarding_step.status =
        'in_progress'
  ) then
    raise exception
      'Calendar onboarding must be in progress.';
  end if;


  -- Resolve the already-verified Campaign Seat mailbox
  -- and its protected Nylas grant.
  select
    integration.id,
    credential.provider_grant_id

  into
    existing_email_integration_id,
    existing_email_grant_id

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
      'email'

    and integration.status =
      'connected'

    and lower(
      coalesce(
        integration.display_email,
        ''
      )
    ) =
      normalized_email

    and lower(
      coalesce(
        integration.settings
          ->> 'account_provider',
        ''
      )
    ) =
      normalized_provider

    and credential.provider_grant_id
      is not null

    and btrim(
      credential.provider_grant_id
    ) <> ''

  order by
    integration.connected_at desc
    nulls last

  limit 1;


  if existing_email_integration_id is null then
    raise exception
      'The verified Campaign Seat mailbox could not be found.';
  end if;


  -- Calendar must extend the SAME Nylas grant.
  if existing_email_grant_id <>
    target_provider_grant_id
  then
    raise exception
      'Calendar authorization returned a different Nylas grant. Reconnect using the existing campaign mailbox.'
      using errcode = '42501';
  end if;


  if normalized_provider =
    'google'
  then
    calendar_scope_verified =
      position(
        'calendar.readonly'
        in normalized_scope
      ) > 0

      and

      position(
        'calendar.events'
        in normalized_scope
      ) > 0;

  else
    calendar_scope_verified =
      position(
        'calendars.readwrite'
        in normalized_scope
      ) > 0;
  end if;


  if not calendar_scope_verified then
    raise exception
      'The provider grant does not include the required Calendar permissions.'
      using errcode = '42501';
  end if;


  insert into
    public.workspace_integrations (
      workspace_id,
      provider,
      integration_type,
      connection_key,
      status,
      display_name,
      display_email,
      external_account_id,
      capabilities,
      settings,
      last_sync_at,
      last_success_at,
      connected_by,
      connected_at,
      disconnected_at,
      last_error_code,
      last_error_summary
    )
  values (
    target_workspace_id,
    'nylas',
    'calendar',
    normalized_email,
    'connected',
    normalized_email,
    normalized_email,
    null,

    jsonb_build_object(
      'read',
      true,

      'write',
      true,

      'two_way_sync',
      true
    ),

    jsonb_build_object(
      'account_provider',
      normalized_provider,

      'credential_mode',
      'nylas_grant',

      'scope_verified',
      true
    ),

    null,
    now(),
    target_actor_user_id,
    now(),
    null,
    null,
    null
  )

  on conflict (
    workspace_id,
    provider,
    integration_type,
    connection_key
  )
  do update
  set
    status =
      'connected',

    display_name =
      excluded.display_name,

    display_email =
      excluded.display_email,

    external_account_id =
      null,

    capabilities =
      excluded.capabilities,

    settings =
      excluded.settings,

    last_success_at =
      now(),

    connected_by =
      target_actor_user_id,

    connected_at =
      now(),

    disconnected_at =
      null,

    last_error_code =
      null,

    last_error_summary =
      null,

    updated_at =
      now()

  returning id
  into calendar_integration_id;


  insert into
    private.workspace_integration_credentials (
      integration_id,
      credential_reference,
      provider_grant_id,
      token_expires_at,
      metadata,
      updated_at
    )
  values (
    calendar_integration_id,
    'nylas_grant',
    target_provider_grant_id,
    null,

    jsonb_build_object(
      'account_provider',
      normalized_provider,

      'scope',
      coalesce(
        target_scope,
        ''
      )
    ),

    now()
  )

  on conflict (
    integration_id
  )
  do update
  set
    credential_reference =
      'nylas_grant',

    provider_grant_id =
      target_provider_grant_id,

    token_expires_at =
      null,

    metadata =
      excluded.metadata,

    updated_at =
      now();


  return jsonb_build_object(
    'success',
    true,

    'integrationId',
    calendar_integration_id,

    'provider',
    normalized_provider,

    'email',
    normalized_email
  );
end;
$function$;


revoke all
on function
public.finalize_calendar_connection(
  uuid,
  uuid,
  text,
  text,
  text,
  text
)
from public;

revoke all
on function
public.finalize_calendar_connection(
  uuid,
  uuid,
  text,
  text,
  text,
  text
)
from anon;

revoke all
on function
public.finalize_calendar_connection(
  uuid,
  uuid,
  text,
  text,
  text,
  text
)
from authenticated;

grant execute
on function
public.finalize_calendar_connection(
  uuid,
  uuid,
  text,
  text,
  text,
  text
)
to service_role;


-- ------------------------------------------------------------
-- 2. SERVICE-ONLY CALENDAR RUNTIME RESOLVER
--
-- Later used by nylas-calendar-sync / event writes.
-- ------------------------------------------------------------

create or replace function
public.get_calendar_runtime_connection(
  target_workspace_id uuid
)
returns table (
  integration_id uuid,
  connected_email text,
  account_provider text,
  grant_reference text,
  read_ready boolean,
  write_ready boolean
)
language sql
stable
security definer
set search_path to
  'public',
  'private',
  'pg_temp'
as $function$

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
    )

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
    integration.connected_at desc
    nulls last

  limit 1;

$function$;


revoke all
on function
public.get_calendar_runtime_connection(uuid)
from public;

revoke all
on function
public.get_calendar_runtime_connection(uuid)
from anon;

revoke all
on function
public.get_calendar_runtime_connection(uuid)
from authenticated;

grant execute
on function
public.get_calendar_runtime_connection(uuid)
to service_role;

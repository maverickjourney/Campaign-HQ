-- Campaign Seat
-- Protected Email runtime server contract.
--
-- Important:
--   * Nylas grant IDs stay in private storage.
--   * Public workspace_integrations never exposes the grant.
--   * Browser code cannot resolve a Nylas grant.
--   * Webhooks store no mailbox body or recipient content.
--   * Mailbox bodies remain provider/Nylas data.

-- ============================================================
-- 1. SCRUB NYLAS GRANT REFERENCES FROM PUBLIC STORAGE
-- ============================================================

create or replace function
private.scrub_nylas_public_grant_reference()
returns trigger
language plpgsql
set search_path to
  'public',
  'private',
  'pg_temp'
as $function$
begin
  if
    new.provider = 'nylas'
    and new.integration_type in (
      'email',
      'contacts'
    )
  then
    new.external_account_id = null;
  end if;

  return new;
end;
$function$;

drop trigger if exists
scrub_nylas_public_grant_reference_trigger
on public.workspace_integrations;

create trigger
scrub_nylas_public_grant_reference_trigger
before insert or update
on public.workspace_integrations
for each row
execute function
private.scrub_nylas_public_grant_reference();

update public.workspace_integrations
set
  external_account_id = null,
  updated_at = now()
where
  provider = 'nylas'
  and integration_type in (
    'email',
    'contacts'
  )
  and external_account_id is not null;


-- ============================================================
-- 2. SERVICE-ONLY CONNECTION RESOLVER
-- ============================================================

create or replace function
public.get_email_runtime_connection(
  target_workspace_id uuid
)
returns table (
  integration_id uuid,
  connected_email text,
  account_provider text,
  grant_reference text,
  read_ready boolean,
  send_ready boolean
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
          ->> 'send'
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
      'email'

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
public.get_email_runtime_connection(uuid)
from public;

revoke all
on function
public.get_email_runtime_connection(uuid)
from anon;

revoke all
on function
public.get_email_runtime_connection(uuid)
from authenticated;

grant execute
on function
public.get_email_runtime_connection(uuid)
to service_role;


-- ============================================================
-- 3. SERVICE-ONLY MAILBOX EVENT SIGNAL
--
-- No email body, subject, sender, recipient or attachment
-- data is persisted here.
-- ============================================================

create or replace function
public.touch_email_runtime_connection(
  target_provider_grant_id text,
  target_event_type text,
  target_event_id text
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
  resolved_integration_id uuid;
  resolved_workspace_id uuid;
  resulting_status text;
begin
  if target_provider_grant_id is null
    or btrim(
      target_provider_grant_id
    ) = ''
  then
    raise exception
      'A provider grant reference is required.'
      using errcode = '22023';
  end if;

  if target_event_type is null
    or btrim(
      target_event_type
    ) = ''
    or length(
      target_event_type
    ) > 100
  then
    raise exception
      'A valid mailbox event type is required.'
      using errcode = '22023';
  end if;

  select
    integration.id,
    integration.workspace_id
  into
    resolved_integration_id,
    resolved_workspace_id

  from public.workspace_integrations
    as integration

  join private.workspace_integration_credentials
    as credential
    on credential.integration_id =
      integration.id

  where
    integration.provider =
      'nylas'

    and integration.integration_type =
      'email'

    and credential.provider_grant_id =
      target_provider_grant_id

  order by
    integration.connected_at desc
    nulls last

  limit 1;

  if resolved_integration_id is null then
    raise exception
      'No Campaign Seat mailbox matches this provider grant.';
  end if;

  update public.workspace_integrations
    as integration
  set
    status =
      case
        when target_event_type =
          'grant.expired'
        then
          'reauthorization_required'

        when target_event_type =
          'grant.deleted'
        then
          'disconnected'

        else
          integration.status
      end,

    last_sync_at =
      case
        when target_event_type like
          'message.%'
        then
          now()
        else
          integration.last_sync_at
      end,

    last_success_at =
      case
        when target_event_type in (
          'message.created',
          'message.created.truncated',
          'message.created.transformed',
          'message.updated',
          'message.send_success',
          'campaign_seat.send_success',
          'grant.updated'
        )
        then
          now()
        else
          integration.last_success_at
      end,

    last_error_code =
      case
        when target_event_type =
          'grant.expired'
        then
          'nylas_grant_expired'

        when target_event_type =
          'grant.deleted'
        then
          'nylas_grant_deleted'

        when target_event_type =
          'message.send_failed'
        then
          'nylas_send_failed'

        else
          integration.last_error_code
      end,

    last_error_summary =
      case
        when target_event_type =
          'grant.expired'
        then
          'Connected email authorization expired. Reconnect the mailbox.'

        when target_event_type =
          'grant.deleted'
        then
          'The connected email authorization was removed.'

        when target_event_type =
          'message.send_failed'
        then
          'The connected provider reported an email send failure.'

        else
          integration.last_error_summary
      end,

    settings =
      coalesce(
        integration.settings,
        '{}'::jsonb
      )
      ||
      jsonb_build_object(
        'last_mailbox_event_type',
        target_event_type,
        'last_mailbox_event_id',
        nullif(
          btrim(
            coalesce(
              target_event_id,
              ''
            )
          ),
          ''
        ),
        'last_mailbox_event_at',
        now()
      ),

    updated_at =
      now()

  where
    integration.id =
      resolved_integration_id

  returning
    integration.status
  into
    resulting_status;

  return jsonb_build_object(
    'success',
    true,
    'workspaceId',
    resolved_workspace_id,
    'status',
    resulting_status
  );
end;
$function$;

revoke all
on function
public.touch_email_runtime_connection(
  text,
  text,
  text
)
from public;

revoke all
on function
public.touch_email_runtime_connection(
  text,
  text,
  text
)
from anon;

revoke all
on function
public.touch_email_runtime_connection(
  text,
  text,
  text
)
from authenticated;

grant execute
on function
public.touch_email_runtime_connection(
  text,
  text,
  text
)
to service_role;

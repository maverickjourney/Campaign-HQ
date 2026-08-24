begin;

-- ============================================================
-- CAMPAIGN SEAT
-- WORKSPACE PROVIDER SYNC STATUS
--
-- Returns only sanitized provider/sync state.
-- Never exposes Nylas grants or private credentials.
-- ============================================================

create or replace function
public.get_my_workspace_provider_sync_status(
  target_workspace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $workspace_provider_sync_status$
declare
  actor_user_id uuid :=
    auth.uid();

  job_record record;

  integrations_data jsonb :=
    '[]'::jsonb;
begin

  if actor_user_id
    is null
  then
    raise exception
      'Sign in to view provider synchronization.'
      using errcode = '42501';
  end if;


  if not exists (
    select 1

    from public.workspace_members
      as member

    where
      member.workspace_id =
        target_workspace_id

      and member.user_id =
        actor_user_id

      and member.status =
        'active'

      and member.membership_state =
        'active'
  )
  then
    raise exception
      'Active campaign access is required.'
      using errcode = '42501';
  end if;


  select
    job.status,
    job.attempts,
    job.requested_at,
    job.started_at,
    job.completed_at,
    job.last_error,
    job.result

  into job_record

  from private.seat_workspace_initial_sync_jobs
    as job

  where job.workspace_id =
    target_workspace_id

  limit 1;


  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',
          integration.id,

          'type',
          integration.integration_type,

          'provider',
          integration.settings
            ->> 'account_provider',

          'email',
          integration.display_email,

          'status',
          integration.status,

          'last_sync_at',
          integration.last_sync_at,

          'last_success_at',
          integration.last_success_at,

          'last_error_code',
          integration.last_error_code,

          'last_error_summary',
          integration.last_error_summary,

          'read_ready',
          coalesce(
            (
              integration.capabilities
                ->> 'read'
            )::boolean,
            false
          ),

          'write_ready',
          coalesce(
            (
              integration.capabilities
                ->> 'write'
            )::boolean,
            false
          ),

          'send_ready',
          coalesce(
            (
              integration.capabilities
                ->> 'send'
            )::boolean,
            false
          ),

          'import_ready',
          coalesce(
            (
              integration.capabilities
                ->> 'import'
            )::boolean,
            false
          ),

          'last_imported_count',
          integration.settings
            ->> 'last_imported_count',

          'last_contacts_seen_count',
          integration.settings
            ->> 'last_contacts_seen_count'
        )

        order by
          case
            integration.settings
              ->> 'account_provider'

            when 'microsoft'
              then 1

            when 'google'
              then 2

            else 3
          end,

          integration.integration_type
      ),
      '[]'::jsonb
    )

  into integrations_data

  from public.workspace_integrations
    as integration

  where
    integration.workspace_id =
      target_workspace_id

    and integration.provider =
      'nylas';


  return jsonb_build_object(
    'workspace_id',
    target_workspace_id,

    'job',
    case
      when job_record.status
        is null
      then
        null

      else
        jsonb_build_object(
          'status',
          job_record.status,

          'attempts',
          job_record.attempts,

          'requested_at',
          job_record.requested_at,

          'started_at',
          job_record.started_at,

          'completed_at',
          job_record.completed_at,

          'last_error',
          job_record.last_error,

          'result',
          coalesce(
            job_record.result,
            '{}'::jsonb
          )
        )
    end,

    'integrations',
    integrations_data,

    'can_retry',
    coalesce(
      job_record.status in (
        'partial',
        'failed'
      ),
      false
    )
  );

end;
$workspace_provider_sync_status$;


revoke all
on function
public.get_my_workspace_provider_sync_status(
  uuid
)
from
  public,
  anon;


grant execute
on function
public.get_my_workspace_provider_sync_status(
  uuid
)
to authenticated;


notify pgrst, 'reload schema';

commit;

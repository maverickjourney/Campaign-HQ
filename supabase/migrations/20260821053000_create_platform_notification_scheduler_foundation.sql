-- ============================================================
-- CAMPAIGN SEAT
-- PLATFORM NOTIFICATION SCHEDULER FOUNDATION — PHASE 2.1
--
-- Scheduler:
--   pg_cron -> pg_net -> notification-dispatch Edge Function
--
-- Security:
--   * Dispatcher URL and secret are encrypted in Supabase Vault.
--   * No credential is embedded in this migration.
--   * Configuration/status RPCs are service_role only.
--   * Edge Function delivery gate remains OFF until explicitly enabled.
-- ============================================================

begin;

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault with schema vault;

create or replace function
public.configure_platform_notification_scheduler(
  target_dispatch_url text,
  target_dispatch_secret text
)
returns jsonb
language plpgsql
security definer
set search_path to
  'public',
  'vault',
  'cron',
  'net',
  'pg_temp'
as $function$
declare
  normalized_url text :=
    btrim(
      coalesce(
        target_dispatch_url,
        ''
      )
    );

  normalized_secret text :=
    btrim(
      coalesce(
        target_dispatch_secret,
        ''
      )
    );

  url_secret_id uuid;
  dispatch_secret_id uuid;
  existing_job record;
  scheduled_job_id bigint;
begin
  if
    normalized_url !~
      '^https://[a-z0-9]+[.]supabase[.]co/functions/v1/notification-dispatch$'
  then
    raise exception
      'The dispatcher URL is invalid.'
      using errcode = '22023';
  end if;

  if
    char_length(
      normalized_secret
    ) < 32
  then
    raise exception
      'The dispatcher secret is invalid.'
      using errcode = '22023';
  end if;

  select
    secret.id
  into
    url_secret_id
  from
    vault.secrets
      as secret
  where
    secret.name =
      'campaign_seat_notification_dispatch_url'
  order by
    secret.updated_at desc
  limit 1;

  if url_secret_id is null then
    select
      vault.create_secret(
        normalized_url,
        'campaign_seat_notification_dispatch_url',
        'Campaign Seat notification dispatcher Edge Function URL'
      )
    into
      url_secret_id;
  else
    perform
      vault.update_secret(
        url_secret_id,
        normalized_url,
        'campaign_seat_notification_dispatch_url',
        'Campaign Seat notification dispatcher Edge Function URL'
      );
  end if;

  select
    secret.id
  into
    dispatch_secret_id
  from
    vault.secrets
      as secret
  where
    secret.name =
      'campaign_seat_notification_dispatch_secret'
  order by
    secret.updated_at desc
  limit 1;

  if dispatch_secret_id is null then
    select
      vault.create_secret(
        normalized_secret,
        'campaign_seat_notification_dispatch_secret',
        'Campaign Seat notification dispatcher shared cron secret'
      )
    into
      dispatch_secret_id;
  else
    perform
      vault.update_secret(
        dispatch_secret_id,
        normalized_secret,
        'campaign_seat_notification_dispatch_secret',
        'Campaign Seat notification dispatcher shared cron secret'
      );
  end if;

  for existing_job in
    select
      job.jobid
    from
      cron.job as job
    where
      job.jobname =
        'campaign-seat-platform-notification-dispatch'
  loop
    perform
      cron.unschedule(
        existing_job.jobid
      );
  end loop;

  select
    cron.schedule(
      'campaign-seat-platform-notification-dispatch',
      '* * * * *',
      $cron$
        select
          net.http_post(
            url := (
              select
                secret.decrypted_secret
              from
                vault.decrypted_secrets
                  as secret
              where
                secret.name =
                  'campaign_seat_notification_dispatch_url'
              order by
                secret.updated_at desc
              limit 1
            ),
            headers :=
              jsonb_build_object(
                'Content-Type',
                  'application/json',
                'x-campaign-seat-dispatch-secret',
                  (
                    select
                      secret.decrypted_secret
                    from
                      vault.decrypted_secrets
                        as secret
                    where
                      secret.name =
                        'campaign_seat_notification_dispatch_secret'
                    order by
                      secret.updated_at desc
                    limit 1
                  )
              ),
            body :=
              jsonb_build_object(
                'source',
                  'supabase_cron',
                'scheduled_at',
                  now()
              ),
            timeout_milliseconds :=
              10000
          ) as request_id;
      $cron$
    )
  into
    scheduled_job_id;

  return
    jsonb_build_object(
      'ok',
        true,
      'job_id',
        scheduled_job_id,
      'job_name',
        'campaign-seat-platform-notification-dispatch',
      'schedule',
        '* * * * *',
      'vault_configured',
        true
    );
end;
$function$;

revoke all
on function
public.configure_platform_notification_scheduler(
  text,
  text
)
from public;

revoke all
on function
public.configure_platform_notification_scheduler(
  text,
  text
)
from anon;

revoke all
on function
public.configure_platform_notification_scheduler(
  text,
  text
)
from authenticated;

grant execute
on function
public.configure_platform_notification_scheduler(
  text,
  text
)
to service_role;

create or replace function
public.get_platform_notification_scheduler_status()
returns jsonb
language plpgsql
security definer
set search_path to
  'public',
  'vault',
  'cron',
  'pg_temp'
as $function$
declare
  selected_job record;
  latest_run record;
  url_configured boolean :=
    false;
  secret_configured boolean :=
    false;
begin
  select
    exists (
      select 1
      from
        vault.secrets
          as secret
      where
        secret.name =
          'campaign_seat_notification_dispatch_url'
    )
  into
    url_configured;

  select
    exists (
      select 1
      from
        vault.secrets
          as secret
      where
        secret.name =
          'campaign_seat_notification_dispatch_secret'
    )
  into
    secret_configured;

  select
    job.jobid,
    job.jobname,
    job.schedule,
    job.active
  into
    selected_job
  from
    cron.job
      as job
  where
    job.jobname =
      'campaign-seat-platform-notification-dispatch'
  order by
    job.jobid desc
  limit 1;

  if selected_job.jobid is not null then
    select
      run.status,
      run.start_time,
      run.end_time,
      run.return_message
    into
      latest_run
    from
      cron.job_run_details
        as run
    where
      run.jobid =
        selected_job.jobid
    order by
      run.start_time desc
    limit 1;
  end if;

  return
    jsonb_build_object(
      'ok',
        true,
      'vault_url_configured',
        url_configured,
      'vault_secret_configured',
        secret_configured,
      'job_exists',
        selected_job.jobid
          is not null,
      'job_id',
        selected_job.jobid,
      'job_name',
        selected_job.jobname,
      'schedule',
        selected_job.schedule,
      'active',
        coalesce(
          selected_job.active,
          false
        ),
      'latest_run_status',
        latest_run.status,
      'latest_run_started_at',
        latest_run.start_time,
      'latest_run_finished_at',
        latest_run.end_time,
      'latest_run_return_message',
        latest_run.return_message
    );
end;
$function$;

revoke all
on function
public.get_platform_notification_scheduler_status()
from public;

revoke all
on function
public.get_platform_notification_scheduler_status()
from anon;

revoke all
on function
public.get_platform_notification_scheduler_status()
from authenticated;

grant execute
on function
public.get_platform_notification_scheduler_status()
to service_role;

commit;

begin;

-- ============================================================
-- CAMPAIGN SEAT
-- INITIAL WORKSPACE PROVIDER SYNC QUEUE
--
-- Future Activation:
--
-- Product Account
--      ↓
-- Workspace created
--      ↓
-- Provider integrations bridged
--      ↓
-- Initial sync job queued
--      ↓
-- Microsoft + Google Calendar/Contacts sync attempted
--
-- A failed provider sync DOES NOT undo a valid Activation.
--
-- This migration does not create a Client #1 workspace.
-- ============================================================


create table if not exists
private.seat_workspace_initial_sync_jobs (

  id uuid
    primary key
    default gen_random_uuid(),

  product_account_id uuid
    not null
    references public.seat_product_accounts(id)
    on delete cascade,

  workspace_id uuid
    not null
    references public.workspaces(id)
    on delete cascade,

  status text
    not null
    default 'pending',

  attempts integer
    not null
    default 0,

  requested_at timestamptz
    not null
    default now(),

  started_at timestamptz,

  completed_at timestamptz,

  last_error text,

  result jsonb
    not null
    default '{}'::jsonb,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint
  seat_workspace_initial_sync_jobs_status_check
  check (
    status in (
      'pending',
      'running',
      'complete',
      'partial',
      'failed'
    )
  ),

  constraint
  seat_workspace_initial_sync_jobs_attempts_check
  check (
    attempts >= 0
  ),

  constraint
  seat_workspace_initial_sync_jobs_result_check
  check (
    jsonb_typeof(
      result
    ) = 'object'
  ),

  constraint
  seat_workspace_initial_sync_jobs_workspace_unique
  unique (
    product_account_id,
    workspace_id
  )
);


create index if not exists
seat_workspace_initial_sync_jobs_status_idx

on private.seat_workspace_initial_sync_jobs (
  status,
  requested_at
);


revoke all
on table
private.seat_workspace_initial_sync_jobs
from
  public,
  anon,
  authenticated;



-- ============================================================
-- QUEUE JOB WHEN FUTURE ACTIVE PRIMARY BINDING IS CREATED
-- ============================================================

create or replace function
private.queue_seat_workspace_initial_sync()
returns trigger
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $queue_initial_sync$
begin

  if
    new.relationship_type =
      'primary'

    and new.status =
      'active'

    and (
      tg_op =
        'INSERT'

      or old.workspace_id
        is distinct from
        new.workspace_id

      or old.product_account_id
        is distinct from
        new.product_account_id

      or old.relationship_type
        is distinct from
        new.relationship_type

      or old.status
        is distinct from
        new.status
    )
  then

    insert into
    private.seat_workspace_initial_sync_jobs (
      product_account_id,
      workspace_id,
      status,
      requested_at,
      updated_at
    )
    values (
      new.product_account_id,
      new.workspace_id,
      'pending',
      now(),
      now()
    )

    on conflict (
      product_account_id,
      workspace_id
    )
    do update
    set
      status =
        case
          when
            private.seat_workspace_initial_sync_jobs.status =
              'complete'
          then
            'complete'
          else
            'pending'
        end,

      requested_at =
        case
          when
            private.seat_workspace_initial_sync_jobs.status =
              'complete'
          then
            private.seat_workspace_initial_sync_jobs.requested_at
          else
            now()
        end,

      last_error =
        case
          when
            private.seat_workspace_initial_sync_jobs.status =
              'complete'
          then
            private.seat_workspace_initial_sync_jobs.last_error
          else
            null
        end,

      updated_at =
        now();

  end if;


  return new;

end;
$queue_initial_sync$;


revoke all
on function
private.queue_seat_workspace_initial_sync()
from
  public,
  anon,
  authenticated;


drop trigger if exists
seat_workspace_binding_initial_sync_queue
on public.seat_workspace_bindings;


create trigger
seat_workspace_binding_initial_sync_queue

after insert
or update of
  product_account_id,
  workspace_id,
  relationship_type,
  status

on public.seat_workspace_bindings

for each row

execute function
private.queue_seat_workspace_initial_sync();



-- ============================================================
-- SERVICE-ROLE: BEGIN JOB
-- ============================================================

create or replace function
public.begin_seat_workspace_initial_sync(
  target_workspace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $begin_initial_sync$
declare
  job_record record;
begin

  select
    job.id,
    job.status,
    job.attempts

  into job_record

  from private.seat_workspace_initial_sync_jobs
    as job

  where
    job.workspace_id =
      target_workspace_id

  for update;


  if job_record.id
    is null
  then
    return jsonb_build_object(
      'found',
      false
    );
  end if;


  update
  private.seat_workspace_initial_sync_jobs

  set
    status =
      'running',

    attempts =
      attempts + 1,

    started_at =
      now(),

    completed_at =
      null,

    last_error =
      null,

    updated_at =
      now()

  where id =
    job_record.id;


  return jsonb_build_object(
    'found',
    true,

    'job_id',
    job_record.id,

    'attempt',
    job_record.attempts + 1
  );

end;
$begin_initial_sync$;


revoke all
on function
public.begin_seat_workspace_initial_sync(
  uuid
)
from
  public,
  anon,
  authenticated;


grant execute
on function
public.begin_seat_workspace_initial_sync(
  uuid
)
to service_role;



-- ============================================================
-- SERVICE-ROLE: COMPLETE / PARTIAL / FAIL JOB
-- ============================================================

create or replace function
public.finish_seat_workspace_initial_sync(
  target_workspace_id uuid,
  target_status text,
  target_result jsonb,
  target_error text
)
returns void
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $finish_initial_sync$
declare
  normalized_status text :=
    lower(
      btrim(
        coalesce(
          target_status,
          ''
        )
      )
    );
begin

  if normalized_status not in (
    'complete',
    'partial',
    'failed'
  )
  then
    raise exception
      'Initial sync result status must be complete, partial or failed.';
  end if;


  update
  private.seat_workspace_initial_sync_jobs

  set
    status =
      normalized_status,

    result =
      coalesce(
        target_result,
        '{}'::jsonb
      ),

    last_error =
      nullif(
        btrim(
          coalesce(
            target_error,
            ''
          )
        ),
        ''
      ),

    completed_at =
      now(),

    updated_at =
      now()

  where workspace_id =
    target_workspace_id;


  if not found then
    raise exception
      'The Campaign Seat initial sync job could not be found.';
  end if;

end;
$finish_initial_sync$;


revoke all
on function
public.finish_seat_workspace_initial_sync(
  uuid,
  text,
  jsonb,
  text
)
from
  public,
  anon,
  authenticated;


grant execute
on function
public.finish_seat_workspace_initial_sync(
  uuid,
  text,
  jsonb,
  text
)
to service_role;


notify pgrst, 'reload schema';

commit;

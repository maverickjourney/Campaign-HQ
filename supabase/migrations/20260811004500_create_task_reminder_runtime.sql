-- ============================================================
-- CAMPAIGN SEAT
-- TASK REMINDERS / OVERDUE ESCALATIONS
--
-- Phase 4A
-- Database-backed timed task automation.
-- ============================================================

create extension if not exists pg_cron;

-- ============================================================
-- TASK REMINDERS
-- ============================================================

create table if not exists public.task_reminders (
  id uuid primary key
    default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  task_id uuid not null
    references public.tasks(id)
    on delete cascade,

  -- before_due
  -- exact
  -- overdue
  schedule_type text not null,

  -- Number of minutes:
  --
  -- before_due:
  --   due_at - offset_minutes
  --
  -- overdue:
  --   due_at + offset_minutes
  --
  -- exact:
  --   unused
  offset_minutes integer,

  -- Used only by exact reminders.
  exact_at timestamptz,

  -- Database-calculated effective fire time.
  next_fire_at timestamptz,

  -- assignee
  -- creator
  -- leadership
  -- assignee_and_leadership
  recipient_scope text not null
    default 'assignee',

  message text,

  is_enabled boolean not null
    default true,

  fired_at timestamptz,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint task_reminders_schedule_type_valid
    check (
      schedule_type in (
        'before_due',
        'exact',
        'overdue'
      )
    ),

  constraint task_reminders_recipient_scope_valid
    check (
      recipient_scope in (
        'assignee',
        'creator',
        'leadership',
        'assignee_and_leadership'
      )
    ),

  constraint task_reminders_offset_valid
    check (
      offset_minutes is null
      or (
        offset_minutes >= 0
        and offset_minutes <= 525600
      )
    ),

  constraint task_reminders_message_length
    check (
      message is null
      or char_length(message) <= 1000
    )
);

create index if not exists
  task_reminders_workspace_idx
on public.task_reminders (
  workspace_id
);

create index if not exists
  task_reminders_task_idx
on public.task_reminders (
  task_id
);

create index if not exists
  task_reminders_due_processor_idx
on public.task_reminders (
  is_enabled,
  next_fire_at
)
where
  is_enabled = true
  and fired_at is null;

-- ============================================================
-- TARGETED TASK ALERTS
--
-- These are intentionally separate from the general
-- workspace activity stream because reminders can be targeted
-- to one user instead of every campaign member.
-- ============================================================

create table if not exists public.task_alerts (
  id uuid primary key
    default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  task_id uuid not null
    references public.tasks(id)
    on delete cascade,

  reminder_id uuid
    references public.task_reminders(id)
    on delete cascade,

  recipient_user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  alert_type text not null,

  title text not null,

  detail text,

  route text not null
    default '/tasks',

  scheduled_for timestamptz not null,

  delivered_at timestamptz not null
    default now(),

  read_at timestamptz,

  metadata jsonb not null
    default '{}'::jsonb,

  constraint task_alerts_type_valid
    check (
      alert_type in (
        'task_reminder',
        'task_overdue'
      )
    )
);

create index if not exists
  task_alerts_workspace_idx
on public.task_alerts (
  workspace_id,
  delivered_at desc
);

create index if not exists
  task_alerts_recipient_idx
on public.task_alerts (
  recipient_user_id,
  read_at,
  delivered_at desc
);

create index if not exists
  task_alerts_task_idx
on public.task_alerts (
  task_id
);

-- ============================================================
-- IDEMPOTENT DELIVERY
--
-- If Cron runs twice, or two processor executions overlap,
-- the same reminder cannot be delivered twice to the same
-- user for the same scheduled moment.
-- ============================================================

create unique index if not exists
  task_alerts_reminder_delivery_unique
on public.task_alerts (
  reminder_id,
  recipient_user_id,
  scheduled_for
)
where reminder_id is not null;

-- ============================================================
-- REMINDER NORMALIZATION
-- ============================================================

create or replace function
  public.normalize_task_reminder()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  task_workspace_id uuid;
  task_due_at timestamptz;
begin
  if
    tg_op = 'UPDATE'
    and (
      new.workspace_id
        is distinct from old.workspace_id
      or new.task_id
        is distinct from old.task_id
      or new.created_by
        is distinct from old.created_by
    )
  then
    raise exception
      'A task reminder cannot be moved or reassigned to another creator.'
      using errcode = '22023';
  end if;

  select
    task.workspace_id,
    task.due_at
  into
    task_workspace_id,
    task_due_at
  from public.tasks as task
  where task.id = new.task_id;

  if task_workspace_id is null then
    raise exception
      'The reminder task does not exist.'
      using errcode = '23503';
  end if;

  if
    new.workspace_id
      <> task_workspace_id
  then
    raise exception
      'A task reminder must remain inside its task workspace.'
      using errcode = '22023';
  end if;

  if new.schedule_type = 'exact' then
    if new.exact_at is null then
      raise exception
        'An exact reminder requires a date and time.'
        using errcode = '22023';
    end if;

    new.next_fire_at :=
      new.exact_at;

    new.offset_minutes :=
      null;
  elsif
    new.schedule_type in (
      'before_due',
      'overdue'
    )
  then
    if task_due_at is null then
      raise exception
        'This reminder requires the task to have a deadline.'
        using errcode = '22023';
    end if;

    if new.offset_minutes is null then
      raise exception
        'A relative task reminder requires an offset.'
        using errcode = '22023';
    end if;

    new.exact_at :=
      null;

    if
      new.schedule_type =
        'before_due'
    then
      new.next_fire_at :=
        task_due_at
        - pg_catalog.make_interval(
            mins =>
              new.offset_minutes
          );
    else
      new.next_fire_at :=
        task_due_at
        + pg_catalog.make_interval(
            mins =>
              new.offset_minutes
          );
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.fired_at :=
      null;
  elsif
    new.schedule_type
      is distinct from old.schedule_type
    or new.offset_minutes
      is distinct from old.offset_minutes
    or new.exact_at
      is distinct from old.exact_at
    or new.recipient_scope
      is distinct from old.recipient_scope
    or new.is_enabled
      is distinct from old.is_enabled
  then
    new.fired_at :=
      null;
  end if;

  new.updated_at :=
    now();

  return new;
end;
$$;

drop trigger if exists
  normalize_task_reminder_trigger
on public.task_reminders;

create trigger
  normalize_task_reminder_trigger
before insert or update
on public.task_reminders
for each row
execute function
  public.normalize_task_reminder();

-- ============================================================
-- DEADLINE CHANGE RECALCULATION
--
-- A moved task deadline automatically moves all relative
-- reminder schedules.
--
-- If the new reminder time is in the future, an already-fired
-- relative reminder becomes eligible again at the new time.
-- ============================================================

create or replace function
  public.refresh_task_reminder_schedules()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if
    new.due_at
      is not distinct from old.due_at
  then
    return new;
  end if;

  update public.task_reminders
  set
    next_fire_at =
      case
        when schedule_type =
          'before_due'
        then
          case
            when new.due_at is null
            then null
            else
              new.due_at
              - pg_catalog.make_interval(
                  mins =>
                    offset_minutes
                )
          end

        when schedule_type =
          'overdue'
        then
          case
            when new.due_at is null
            then null
            else
              new.due_at
              + pg_catalog.make_interval(
                  mins =>
                    offset_minutes
                )
          end

        else
          next_fire_at
      end,

    fired_at =
      case
        when
          schedule_type in (
            'before_due',
            'overdue'
          )
          and new.due_at is not null
          and (
            case
              when schedule_type =
                'before_due'
              then
                new.due_at
                - pg_catalog.make_interval(
                    mins =>
                      offset_minutes
                  )
              else
                new.due_at
                + pg_catalog.make_interval(
                    mins =>
                      offset_minutes
                  )
            end
          ) > now()
        then
          null

        else
          fired_at
      end,

    updated_at =
      now()

  where
    task_id = new.id
    and schedule_type in (
      'before_due',
      'overdue'
    );

  return new;
end;
$$;

revoke all
on function
  public.refresh_task_reminder_schedules()
from public;

revoke all
on function
  public.refresh_task_reminder_schedules()
from anon;

revoke all
on function
  public.refresh_task_reminder_schedules()
from authenticated;

drop trigger if exists
  refresh_task_reminder_schedules_trigger
on public.tasks;

create trigger
  refresh_task_reminder_schedules_trigger
after update of due_at
on public.tasks
for each row
execute function
  public.refresh_task_reminder_schedules();

-- ============================================================
-- RLS — TASK REMINDERS
-- ============================================================

alter table
  public.task_reminders
enable row level security;

create policy
  "Visible task reminders can be viewed"
on public.task_reminders
for select
to authenticated
using (
  public.can_view_role_scoped_task(
    task_id
  )
);

create policy
  "Authorized members can create task reminders"
on public.task_reminders
for insert
to authenticated
with check (
  created_by = auth.uid()

  and public.can_view_role_scoped_task(
    task_id
  )

  and exists (
    select 1
    from public.tasks as task
    where
      task.id =
        task_reminders.task_id

      and task.workspace_id =
        task_reminders.workspace_id

      and (
        public.is_workspace_admin(
          task.workspace_id
        )

        or public.has_campaign_permission(
          task.workspace_id,
          'tasks.manage_all'
        )

        or task.assigned_to =
          auth.uid()

        or task.created_by =
          auth.uid()
      )
  )
);

create policy
  "Authorized members can update task reminders"
on public.task_reminders
for update
to authenticated
using (
  public.can_view_role_scoped_task(
    task_id
  )

  and exists (
    select 1
    from public.tasks as task
    where
      task.id =
        task_reminders.task_id

      and task.workspace_id =
        task_reminders.workspace_id

      and (
        public.is_workspace_admin(
          task.workspace_id
        )

        or public.has_campaign_permission(
          task.workspace_id,
          'tasks.manage_all'
        )

        or task.assigned_to =
          auth.uid()

        or task.created_by =
          auth.uid()
      )
  )
)
with check (
  public.can_view_role_scoped_task(
    task_id
  )
);

create policy
  "Authorized members can delete task reminders"
on public.task_reminders
for delete
to authenticated
using (
  public.can_view_role_scoped_task(
    task_id
  )

  and exists (
    select 1
    from public.tasks as task
    where
      task.id =
        task_reminders.task_id

      and task.workspace_id =
        task_reminders.workspace_id

      and (
        public.is_workspace_admin(
          task.workspace_id
        )

        or public.has_campaign_permission(
          task.workspace_id,
          'tasks.manage_all'
        )

        or task.assigned_to =
          auth.uid()

        or task.created_by =
          auth.uid()
      )
  )
);

-- ============================================================
-- RLS — TARGETED ALERTS
-- ============================================================

alter table
  public.task_alerts
enable row level security;

create policy
  "Users can view their task alerts"
on public.task_alerts
for select
to authenticated
using (
  recipient_user_id =
    auth.uid()
);

-- No browser INSERT / DELETE policy is intentionally granted.
-- The timed processor owns task-alert delivery.

-- ============================================================
-- MARK TASK ALERT READ
-- ============================================================

create or replace function
  public.mark_task_alert_read(
    target_alert_id uuid
  )
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  changed_rows integer;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  update public.task_alerts
  set
    read_at =
      coalesce(
        read_at,
        now()
      )
  where
    id = target_alert_id
    and recipient_user_id =
      auth.uid();

  get diagnostics
    changed_rows =
      row_count;

  return
    changed_rows > 0;
end;
$$;

revoke all
on function
  public.mark_task_alert_read(uuid)
from public;

grant execute
on function
  public.mark_task_alert_read(uuid)
to authenticated;

-- ============================================================
-- TIMED REMINDER PROCESSOR
--
-- Executes from pg_cron.
-- ============================================================

create or replace function
  public.process_task_reminders()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  reminder record;
  inserted_rows integer;
  delivery_exists boolean;
  total_inserted integer :=
    0;
begin
  -- Only one reminder processor may run at a time.
  if not
    pg_catalog.pg_try_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'campaign-seat-task-reminders',
        0
      )
    )
  then
    return 0;
  end if;

  for reminder in
    select
      reminder_record.id
        as reminder_id,

      reminder_record.workspace_id,

      reminder_record.task_id,

      reminder_record.schedule_type,

      reminder_record.recipient_scope,

      reminder_record.message,

      reminder_record.next_fire_at,

      task.title
        as task_title,

      task.priority
        as task_priority,

      task.due_at
        as task_due_at,

      task.assigned_to,

      task.created_by
        as task_created_by

    from public.task_reminders
      as reminder_record

    join public.tasks
      as task
      on task.id =
        reminder_record.task_id

    where
      reminder_record.is_enabled =
        true

      and reminder_record.fired_at
        is null

      and reminder_record.next_fire_at
        is not null

      and reminder_record.next_fire_at
        <= now()

      and task.status not in (
        'completed',
        'archived'
      )

    order by
      reminder_record.next_fire_at
        asc

    for update of reminder_record
  loop

    with recipients as (
      select
        reminder.assigned_to
          as user_id
      where
        reminder.recipient_scope
          in (
            'assignee',
            'assignee_and_leadership'
          )
        and reminder.assigned_to
          is not null

      union

      select
        reminder.task_created_by
          as user_id
      where
        reminder.recipient_scope =
          'creator'
        and reminder.task_created_by
          is not null

      union

      select
        member.user_id
      from public.workspace_members
        as member
      where
        reminder.recipient_scope
          in (
            'leadership',
            'assignee_and_leadership'
          )

        and member.workspace_id =
          reminder.workspace_id

        and member.status =
          'active'

        and member.membership_state =
          'active'

        and member.role_key in (
          'campaign_owner',
          'candidate',
          'campaign_consultant',
          'campaign_manager',
          'campaign_administrator'
        )
    )

    insert into public.task_alerts (
      workspace_id,
      task_id,
      reminder_id,
      recipient_user_id,
      alert_type,
      title,
      detail,
      route,
      scheduled_for,
      delivered_at,
      metadata
    )

    select distinct
      reminder.workspace_id,

      reminder.task_id,

      reminder.reminder_id,

      recipient.user_id,

      case
        when
          reminder.schedule_type =
            'overdue'
        then
          'task_overdue'
        else
          'task_reminder'
      end,

      case
        when
          reminder.schedule_type =
            'overdue'
        then
          'Task overdue'
        else
          'Task reminder'
      end,

      case
        when
          nullif(
            btrim(
              coalesce(
                reminder.message,
                ''
              )
            ),
            ''
          )
          is not null
        then
          reminder.task_title
          || ' — '
          || btrim(
               reminder.message
             )

        else
          reminder.task_title
      end,

      '/tasks',

      reminder.next_fire_at,

      now(),

      jsonb_build_object(
        'task_id',
          reminder.task_id,

        'reminder_id',
          reminder.reminder_id,

        'schedule_type',
          reminder.schedule_type,

        'recipient_scope',
          reminder.recipient_scope,

        'due_at',
          reminder.task_due_at,

        'priority',
          reminder.task_priority
      )

    from recipients
      as recipient

    where
      recipient.user_id
        is not null

    on conflict
      (
        reminder_id,
        recipient_user_id,
        scheduled_for
      )
      where reminder_id is not null
    do nothing;

    get diagnostics
      inserted_rows =
        row_count;

    total_inserted :=
      total_inserted
      + inserted_rows;

    select exists (
      select 1
      from public.task_alerts
        as delivered_alert
      where
        delivered_alert.reminder_id =
          reminder.reminder_id

        and delivered_alert.scheduled_for =
          reminder.next_fire_at
    )
    into
      delivery_exists;

    if delivery_exists then
      update public.task_reminders
      set
        fired_at =
          now(),

        updated_at =
          now()

      where
        id =
          reminder.reminder_id;
    end if;
  end loop;

  return total_inserted;
end;
$$;

revoke all
on function
  public.process_task_reminders()
from public;

revoke all
on function
  public.process_task_reminders()
from anon;

revoke all
on function
  public.process_task_reminders()
from authenticated;

-- ============================================================
-- CRON
--
-- Every minute:
-- 1. locate due reminders / escalations
-- 2. insert targeted alerts exactly once
-- 3. mark the reminder fired
-- ============================================================

select cron.schedule(
  'campaign-seat-task-reminders',
  '* * * * *',
  $cron$
    select public.process_task_reminders();
  $cron$
);

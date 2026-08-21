-- ============================================================
-- CAMPAIGN SEAT
-- PLATFORM NOTIFICATION ENGINE — PHASE 4
--
-- Adds:
--   * field handoff / acknowledgment targeted alerts
--   * completed field assignment -> latest handoff sender alert
--   * conservative high-value campaign update notifications
--   * weekly summary run ledger + Monday generator
--   * approval submitted status correction: pending = submitted
--
-- Delivery remains protected by the existing dispatcher gates:
--   1. PLATFORM_NOTIFICATION_DISPATCH_ENABLED
--   2. Twilio TFV must report TWILIO_APPROVED
-- ============================================================

begin;

create extension if not exists pgcrypto;
create extension if not exists pg_cron;

-- ============================================================
-- APPROVAL STATUS CORRECTION
--
-- Existing approval workflow uses status='pending' for an item
-- that has been submitted and is awaiting review.
-- ============================================================

create or replace function
public.enqueue_approval_platform_notification()
returns trigger
language plpgsql
security definer
set search_path to
  'public',
  'pg_temp'
as $function$
declare
  next_row jsonb :=
    to_jsonb(
      new
    );

  previous_row jsonb :=
    case
      when tg_op =
        'UPDATE'
      then
        to_jsonb(
          old
        )
      else
        '{}'::jsonb
    end;

  recipient_id uuid;
  approval_id uuid;
  workspace_id uuid;
  approval_title text;
  approval_status text;
  previous_status text;
  event_source_type text;
begin
  recipient_id =
    nullif(
      next_row ->>
        'assigned_to',
      ''
    )::uuid;

  if recipient_id is null then
    return new;
  end if;

  approval_id =
    nullif(
      next_row ->>
        'id',
      ''
    )::uuid;

  workspace_id =
    nullif(
      next_row ->>
        'workspace_id',
      ''
    )::uuid;

  approval_title =
    coalesce(
      nullif(
        btrim(
          next_row ->>
            'title'
        ),
        ''
      ),
      'Approval request'
    );

  approval_status =
    lower(
      btrim(
        coalesce(
          next_row ->>
            'status',
          ''
        )
      )
    );

  previous_status =
    lower(
      btrim(
        coalesce(
          previous_row ->>
            'status',
          ''
        )
      )
    );

  if
    approval_status =
      'pending'
    and (
      tg_op =
        'INSERT'
      or previous_status
        is distinct from
        'pending'
    )
  then
    event_source_type :=
      'approval_submitted';

  elsif
    tg_op =
      'INSERT'
    or nullif(
      next_row ->>
        'assigned_to',
      ''
    )
      is distinct from
    nullif(
      previous_row ->>
        'assigned_to',
      ''
    )
  then
    event_source_type :=
      'approval_assigned';

  else
    return new;
  end if;

  perform
    public.enqueue_platform_notification(
      workspace_id,
      recipient_id,
      'approvals',
      event_source_type,
      approval_id,
      case
        when event_source_type =
          'approval_submitted'
        then
          'Approval submitted for your review'
        else
          'Approval assigned to you'
      end,
      case
        when event_source_type =
          'approval_submitted'
        then
          'Campaign Seat: "' ||
          approval_title ||
          '" was submitted and requires your review.'
        else
          'Campaign Seat: "' ||
          approval_title ||
          '" is assigned to you for review.'
      end,
      '/approvals'
    );

  return new;
end;
$function$;

-- ============================================================
-- FIELD OPERATION ALERTS
--
-- Targeted only where the existing field runtime gives us an
-- exact recipient. No blanket field leadership broadcast.
-- ============================================================

create or replace function
public.enqueue_field_handoff_platform_notification()
returns trigger
language plpgsql
security definer
set search_path to
  'public',
  'pg_temp'
as $function$
declare
  assignment_title text;
begin
  select
    coalesce(
      nullif(
        btrim(
          assignment.title
        ),
        ''
      ),
      'Field assignment'
    )
  into
    assignment_title
  from
    public.field_assignments
      as assignment
  where
    assignment.id =
      new.assignment_id;

  assignment_title :=
    coalesce(
      assignment_title,
      'Field assignment'
    );

  if tg_op =
    'INSERT'
  then
    perform
      public.enqueue_platform_notification(
        new.workspace_id,
        new.volunteer_user_id,
        'field_alerts',
        'field_handoff_sent',
        new.id,
        'New field deployment handoff',
        'Campaign Seat: A new field deployment handoff is ready for "' ||
          assignment_title ||
          '". Open Campaign Seat to review and acknowledge it.',
        null
      );

    return new;
  end if;

  if
    new.acknowledged_at
      is not null
    and new.acknowledged_at
      is distinct from
        old.acknowledged_at
    and new.sent_by
      is not null
  then
    perform
      public.enqueue_platform_notification(
        new.workspace_id,
        new.sent_by,
        'field_alerts',
        'field_handoff_acknowledged',
        new.id,
        'Field handoff acknowledged',
        'Campaign Seat: The Volunteer acknowledged the deployment handoff for "' ||
          assignment_title ||
          '".',
        null
      );
  end if;

  return new;
end;
$function$;

drop trigger if exists
enqueue_field_handoff_platform_notification_trigger
on public.field_assignment_handoffs;

create trigger
enqueue_field_handoff_platform_notification_trigger
after insert or update
on public.field_assignment_handoffs
for each row
execute function
public.enqueue_field_handoff_platform_notification();

create or replace function
public.enqueue_field_assignment_completion_platform_notification()
returns trigger
language plpgsql
security definer
set search_path to
  'public',
  'pg_temp'
as $function$
declare
  leadership_recipient uuid;
  assignment_title text;
begin
  if
    new.status
      is distinct from
        'completed'
    or old.status =
      'completed'
  then
    return new;
  end if;

  select
    handoff.sent_by
  into
    leadership_recipient
  from
    public.field_assignment_handoffs
      as handoff
  where
    handoff.assignment_id =
      new.id
  order by
    handoff.sent_at desc,
    handoff.created_at desc
  limit 1;

  if leadership_recipient is null then
    return new;
  end if;

  assignment_title :=
    coalesce(
      nullif(
        btrim(
          new.title
        ),
        ''
      ),
      'Field assignment'
    );

  perform
    public.enqueue_platform_notification(
      new.workspace_id,
      leadership_recipient,
      'field_alerts',
      'field_assignment_completed',
      new.id,
      'Field assignment ready for review',
      'Campaign Seat: "' ||
        assignment_title ||
        '" was completed and is ready for leadership review.',
      null
    );

  return new;
end;
$function$;

drop trigger if exists
enqueue_field_assignment_completion_platform_notification_trigger
on public.field_assignments;

create trigger
enqueue_field_assignment_completion_platform_notification_trigger
after update of status
on public.field_assignments
for each row
execute function
public.enqueue_field_assignment_completion_platform_notification();

-- ============================================================
-- CONSERVATIVE CAMPAIGN UPDATES
--
-- Intentionally excludes routine task edits, file uploads,
-- ordinary event edits, and approval events that already have
-- their own targeted notification category.
-- ============================================================

create or replace function
public.enqueue_high_value_campaign_activity_notification()
returns trigger
language plpgsql
security definer
set search_path to
  'public',
  'pg_temp'
as $function$
declare
  member_record record;
  notification_body text;
begin
  if new.activity_type not in (
    'workspace_updated',
    'member_added',
    'member_access_updated',
    'invitation_accepted',
    'event_cancelled',
    'communication_scheduled'
  ) then
    return new;
  end if;

  notification_body :=
    left(
      concat_ws(
        ' — ',
        'Campaign Seat: ' ||
          coalesce(
            nullif(
              btrim(
                new.title
              ),
              ''
            ),
            'Campaign update'
          ),
        nullif(
          btrim(
            coalesce(
              new.detail,
              ''
            )
          ),
          ''
        )
      ),
      1500
    );

  for member_record in
    select
      member.user_id
    from
      public.workspace_members
        as member
    where
      member.workspace_id =
        new.workspace_id
      and member.status =
        'active'
      and member.user_id
        is not null
      and (
        new.actor_user_id
          is null
        or member.user_id <>
          new.actor_user_id
      )
  loop
    perform
      public.enqueue_platform_notification(
        new.workspace_id,
        member_record.user_id,
        'campaign_updates',
        'activity_' ||
          new.activity_type,
        new.id,
        coalesce(
          nullif(
            btrim(
              new.title
            ),
            ''
          ),
          'Campaign update'
        ),
        notification_body,
        new.route
      );
  end loop;

  return new;
end;
$function$;

drop trigger if exists
enqueue_high_value_campaign_activity_notification_trigger
on public.activity_log;

create trigger
enqueue_high_value_campaign_activity_notification_trigger
after insert
on public.activity_log
for each row
execute function
public.enqueue_high_value_campaign_activity_notification();

-- ============================================================
-- WEEKLY SUMMARY LEDGER
-- ============================================================

create table if not exists
public.platform_weekly_summary_runs (
  id uuid primary key
    default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  recipient_user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  week_start date not null,
  week_end date not null,

  open_task_count integer not null
    default 0,

  overdue_task_count integer not null
    default 0,

  pending_approval_count integer not null
    default 0,

  open_field_assignment_count integer not null
    default 0,

  completed_field_assignment_count integer not null
    default 0,

  campaign_activity_count integer not null
    default 0,

  created_at timestamptz not null
    default now(),

  constraint
    platform_weekly_summary_runs_week_check
    check (
      week_end >
        week_start
    ),

  unique (
    workspace_id,
    recipient_user_id,
    week_start
  )
);

create index if not exists
platform_weekly_summary_runs_recipient_idx
on public.platform_weekly_summary_runs (
  recipient_user_id,
  week_start desc
);

alter table
public.platform_weekly_summary_runs
enable row level security;

drop policy if exists
"Users can view their own weekly summary runs"
on public.platform_weekly_summary_runs;

create policy
"Users can view their own weekly summary runs"
on public.platform_weekly_summary_runs
for select
to authenticated
using (
  recipient_user_id =
    auth.uid()
);

grant select
on public.platform_weekly_summary_runs
to authenticated;

-- ============================================================
-- WEEKLY SUMMARY PROCESSOR
--
-- Runs each Monday at 16:00 UTC.
-- This is a fixed platform cadence until a per-user timezone
-- preference exists.
-- ============================================================

create or replace function
public.process_platform_weekly_summaries()
returns jsonb
language plpgsql
security definer
set search_path to
  'public',
  'pg_temp'
as $function$
declare
  summary_week_end date :=
    date_trunc(
      'week',
      now()
    )::date;

  summary_week_start date :=
    (
      date_trunc(
        'week',
        now()
      )::date -
      7
    );

  recipient record;

  workspace_name text;

  open_tasks integer;
  overdue_tasks integer;
  pending_approvals integer;
  open_field_assignments integer;
  completed_field_assignments integer;
  campaign_activity integer;

  summary_run_id uuid;
  enqueued_id uuid;

  created_count integer :=
    0;

  skipped_count integer :=
    0;
begin
  for recipient in
    select
      member.workspace_id,
      member.user_id
    from
      public.workspace_members
        as member
    join
      public.platform_notification_preferences
        as preference
      on preference.user_id =
        member.user_id
    join
      public.platform_sms_subscriptions
        as subscription
      on subscription.user_id =
        member.user_id
    where
      member.status =
        'active'
      and preference.weekly_summary =
        true
      and subscription.status =
        'active'
  loop
    select
      coalesce(
        nullif(
          btrim(
            workspace.name
          ),
          ''
        ),
        'your campaign'
      )
    into
      workspace_name
    from
      public.workspaces
        as workspace
    where
      workspace.id =
        recipient.workspace_id;

    select
      count(*)
    into
      open_tasks
    from
      public.tasks
        as task
    where
      task.workspace_id =
        recipient.workspace_id
      and task.status not in (
        'completed',
        'archived'
      );

    select
      count(*)
    into
      overdue_tasks
    from
      public.tasks
        as task
    where
      task.workspace_id =
        recipient.workspace_id
      and task.status not in (
        'completed',
        'archived'
      )
      and task.due_at
        is not null
      and task.due_at <
        now();

    select
      count(*)
    into
      pending_approvals
    from
      public.approvals
        as approval
    where
      approval.workspace_id =
        recipient.workspace_id
      and approval.status =
        'pending';

    select
      count(*)
    into
      open_field_assignments
    from
      public.field_assignments
        as assignment
    where
      assignment.workspace_id =
        recipient.workspace_id
      and assignment.status not in (
        'completed',
        'cancelled'
      );

    select
      count(*)
    into
      completed_field_assignments
    from
      public.field_assignments
        as assignment
    where
      assignment.workspace_id =
        recipient.workspace_id
      and assignment.status =
        'completed'
      and assignment.updated_at >=
        summary_week_start::timestamptz
      and assignment.updated_at <
        summary_week_end::timestamptz;

    select
      count(*)
    into
      campaign_activity
    from
      public.activity_log
        as activity
    where
      activity.workspace_id =
        recipient.workspace_id
      and activity.occurred_at >=
        summary_week_start::timestamptz
      and activity.occurred_at <
        summary_week_end::timestamptz;

    insert into
      public.platform_weekly_summary_runs (
        workspace_id,
        recipient_user_id,
        week_start,
        week_end,
        open_task_count,
        overdue_task_count,
        pending_approval_count,
        open_field_assignment_count,
        completed_field_assignment_count,
        campaign_activity_count
      )
    values (
      recipient.workspace_id,
      recipient.user_id,
      summary_week_start,
      summary_week_end,
      open_tasks,
      overdue_tasks,
      pending_approvals,
      open_field_assignments,
      completed_field_assignments,
      campaign_activity
    )
    on conflict (
      workspace_id,
      recipient_user_id,
      week_start
    )
    do nothing
    returning
      id
    into
      summary_run_id;

    if summary_run_id is null then
      skipped_count :=
        skipped_count +
        1;

      continue;
    end if;

    enqueued_id :=
      public.enqueue_platform_notification(
        recipient.workspace_id,
        recipient.user_id,
        'weekly_summary',
        'weekly_summary',
        summary_run_id,
        'Weekly campaign summary',
        left(
          'Campaign Seat weekly summary for ' ||
            coalesce(
              workspace_name,
              'your campaign'
            ) ||
            ': ' ||
            open_tasks ||
            ' open tasks (' ||
            overdue_tasks ||
            ' overdue), ' ||
            pending_approvals ||
            ' pending approvals, ' ||
            open_field_assignments ||
            ' open field assignments, ' ||
            completed_field_assignments ||
            ' field assignments completed last week, and ' ||
            campaign_activity ||
            ' campaign activity updates last week.',
          1500
        ),
        null
      );

    if enqueued_id is not null then
      created_count :=
        created_count +
        1;
    else
      skipped_count :=
        skipped_count +
        1;
    end if;

    summary_run_id :=
      null;
  end loop;

  return
    jsonb_build_object(
      'ok',
        true,
      'week_start',
        summary_week_start,
      'week_end',
        summary_week_end,
      'created',
        created_count,
      'skipped',
        skipped_count
    );
end;
$function$;

revoke all
on function
public.process_platform_weekly_summaries()
from public;

revoke all
on function
public.process_platform_weekly_summaries()
from anon;

revoke all
on function
public.process_platform_weekly_summaries()
from authenticated;

grant execute
on function
public.process_platform_weekly_summaries()
to service_role;

-- Replace any prior copy of this named cron job.
do $scheduler$
declare
  existing_job record;
begin
  for existing_job in
    select
      job.jobid
    from
      cron.job
        as job
    where
      job.jobname =
        'campaign-seat-weekly-summary-generator'
  loop
    perform
      cron.unschedule(
        existing_job.jobid
      );
  end loop;
end;
$scheduler$;

select
  cron.schedule(
    'campaign-seat-weekly-summary-generator',
    '0 16 * * 1',
    $cron$
      select
        public.process_platform_weekly_summaries();
    $cron$
  );

commit;

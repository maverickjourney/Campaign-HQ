-- ============================================================
-- CAMPAIGN SEAT
-- PLATFORM NOTIFICATION ENGINE — PHASE 1
--
-- Grounded sources:
--   * task_alerts -> targeted task reminder / overdue recipient
--   * approvals   -> assigned reviewer / assignee
--
-- Important:
-- Notification category preferences default OFF until the
-- Profile & Settings toggles are persisted server-side.
-- ============================================================

begin;

create extension if not exists pgcrypto;

-- ============================================================
-- USER NOTIFICATION PREFERENCES
-- ============================================================

create table if not exists
public.platform_notification_preferences (
  user_id uuid primary key
    references public.profiles(id)
    on delete cascade,

  campaign_updates boolean not null
    default false,

  task_reminders boolean not null
    default false,

  approvals boolean not null
    default false,

  field_alerts boolean not null
    default false,

  weekly_summary boolean not null
    default false,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()
);

alter table
public.platform_notification_preferences
enable row level security;

drop policy if exists
"Users can view their platform notification preferences"
on public.platform_notification_preferences;

create policy
"Users can view their platform notification preferences"
on public.platform_notification_preferences
for select
to authenticated
using (
  user_id = auth.uid()
);

revoke all
on public.platform_notification_preferences
from anon;

grant select
on public.platform_notification_preferences
to authenticated;

create or replace function
public.set_platform_notification_preference(
  target_category text,
  target_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path to
  'public',
  'pg_temp'
as $function$
declare
  current_user_id uuid :=
    auth.uid();

  normalized_category text :=
    lower(
      btrim(
        coalesce(
          target_category,
          ''
        )
      )
    );
begin
  if current_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if normalized_category not in (
    'campaign_updates',
    'task_reminders',
    'approvals',
    'field_alerts',
    'weekly_summary'
  ) then
    raise exception
      'Unsupported notification category.'
      using errcode = '22023';
  end if;

  insert into
    public.platform_notification_preferences (
      user_id
    )
  values (
    current_user_id
  )
  on conflict (
    user_id
  )
  do nothing;

  execute format(
    'update public.platform_notification_preferences
       set %I = $1,
           updated_at = now()
     where user_id = $2',
    normalized_category
  )
  using
    coalesce(
      target_enabled,
      false
    ),
    current_user_id;

  return jsonb_build_object(
    'ok',
    true,
    'category',
    normalized_category,
    'enabled',
    coalesce(
      target_enabled,
      false
    )
  );
end;
$function$;

revoke all
on function
public.set_platform_notification_preference(
  text,
  boolean
)
from public;

grant execute
on function
public.set_platform_notification_preference(
  text,
  boolean
)
to authenticated;

create or replace function
public.get_platform_notification_preferences()
returns jsonb
language plpgsql
security definer
set search_path to
  'public',
  'pg_temp'
as $function$
declare
  current_user_id uuid :=
    auth.uid();

  preference_record
    public.platform_notification_preferences%rowtype;
begin
  if current_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  insert into
    public.platform_notification_preferences (
      user_id
    )
  values (
    current_user_id
  )
  on conflict (
    user_id
  )
  do nothing;

  select
    preference.*
  into
    preference_record
  from
    public.platform_notification_preferences
      as preference
  where
    preference.user_id =
      current_user_id;

  return jsonb_build_object(
    'campaign_updates',
      preference_record.campaign_updates,
    'task_reminders',
      preference_record.task_reminders,
    'approvals',
      preference_record.approvals,
    'field_alerts',
      preference_record.field_alerts,
    'weekly_summary',
      preference_record.weekly_summary
  );
end;
$function$;

revoke all
on function
public.get_platform_notification_preferences()
from public;

grant execute
on function
public.get_platform_notification_preferences()
to authenticated;

-- ============================================================
-- DELIVERY QUEUE
-- ============================================================

create table if not exists
public.platform_notification_queue (
  id uuid primary key
    default gen_random_uuid(),

  workspace_id uuid
    references public.workspaces(id)
    on delete cascade,

  recipient_user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  category text not null
    check (
      category in (
        'campaign_updates',
        'task_reminders',
        'approvals',
        'field_alerts',
        'weekly_summary'
      )
    ),

  source_type text not null,

  source_id uuid,

  title text not null,

  body text not null,

  route text,

  status text not null
    default 'pending'
    check (
      status in (
        'pending',
        'processing',
        'sent',
        'skipped',
        'failed'
      )
    ),

  available_at timestamptz not null
    default now(),

  attempts integer not null
    default 0,

  last_error text,

  twilio_message_sid text,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  sent_at timestamptz,

  constraint
    platform_notification_queue_title_check
    check (
      char_length(
        btrim(
          title
        )
      ) between 1 and 200
    ),

  constraint
    platform_notification_queue_body_check
    check (
      char_length(
        btrim(
          body
        )
      ) between 1 and 1500
    )
);

create index if not exists
platform_notification_queue_pending_idx
on public.platform_notification_queue (
  status,
  available_at,
  created_at
)
where
  status = 'pending';

create index if not exists
platform_notification_queue_recipient_idx
on public.platform_notification_queue (
  recipient_user_id,
  created_at desc
);

create unique index if not exists
platform_notification_queue_source_unique
on public.platform_notification_queue (
  recipient_user_id,
  category,
  source_type,
  source_id
)
where
  source_id is not null;

alter table
public.platform_notification_queue
enable row level security;

drop policy if exists
"Users can view their own queued platform notifications"
on public.platform_notification_queue;

create policy
"Users can view their own queued platform notifications"
on public.platform_notification_queue
for select
to authenticated
using (
  recipient_user_id =
    auth.uid()
);

grant select
on public.platform_notification_queue
to authenticated;

-- ============================================================
-- ELIGIBILITY HELPERS
-- ============================================================

create or replace function
public.platform_notification_category_enabled(
  target_user_id uuid,
  target_category text
)
returns boolean
language sql
stable
security definer
set search_path to
  'public',
  'pg_temp'
as $function$
  select
    case lower(
      btrim(
        coalesce(
          target_category,
          ''
        )
      )
    )
      when 'campaign_updates'
        then coalesce(
          preference.campaign_updates,
          false
        )

      when 'task_reminders'
        then coalesce(
          preference.task_reminders,
          false
        )

      when 'approvals'
        then coalesce(
          preference.approvals,
          false
        )

      when 'field_alerts'
        then coalesce(
          preference.field_alerts,
          false
        )

      when 'weekly_summary'
        then coalesce(
          preference.weekly_summary,
          false
        )

      else false
    end
  from
    (
      select 1
    ) as seed
  left join
    public.platform_notification_preferences
      as preference
    on preference.user_id =
      target_user_id;
$function$;

revoke all
on function
public.platform_notification_category_enabled(
  uuid,
  text
)
from public;

create or replace function
public.platform_sms_delivery_eligible(
  target_user_id uuid,
  target_category text
)
returns boolean
language sql
stable
security definer
set search_path to
  'public',
  'pg_temp'
as $function$
  select
    public.platform_notification_category_enabled(
      target_user_id,
      target_category
    )
    and exists (
      select 1
      from
        public.platform_sms_subscriptions
          as subscription
      where
        subscription.user_id =
          target_user_id
        and subscription.status =
          'active'
    );
$function$;

revoke all
on function
public.platform_sms_delivery_eligible(
  uuid,
  text
)
from public;

create or replace function
public.enqueue_platform_notification(
  target_workspace_id uuid,
  target_recipient_user_id uuid,
  target_category text,
  target_source_type text,
  target_source_id uuid,
  target_title text,
  target_body text,
  target_route text
)
returns uuid
language plpgsql
security definer
set search_path to
  'public',
  'pg_temp'
as $function$
declare
  inserted_id uuid;
begin
  if target_recipient_user_id is null then
    return null;
  end if;

  if not public.platform_sms_delivery_eligible(
    target_recipient_user_id,
    target_category
  ) then
    return null;
  end if;

  insert into
    public.platform_notification_queue (
      workspace_id,
      recipient_user_id,
      category,
      source_type,
      source_id,
      title,
      body,
      route
    )
  values (
    target_workspace_id,
    target_recipient_user_id,
    lower(
      btrim(
        target_category
      )
    ),
    left(
      btrim(
        coalesce(
          target_source_type,
          'campaign_event'
        )
      ),
      120
    ),
    target_source_id,
    left(
      btrim(
        target_title
      ),
      200
    ),
    left(
      btrim(
        target_body
      ),
      1500
    ),
    nullif(
      btrim(
        coalesce(
          target_route,
          ''
        )
      ),
      ''
    )
  )
  on conflict do nothing
  returning id
  into inserted_id;

  return inserted_id;
end;
$function$;

revoke all
on function
public.enqueue_platform_notification(
  uuid,
  uuid,
  text,
  text,
  uuid,
  text,
  text,
  text
)
from public;

-- ============================================================
-- TASK ALERTS -> PLATFORM SMS QUEUE
-- ============================================================

create or replace function
public.enqueue_task_alert_platform_notification()
returns trigger
language plpgsql
security definer
set search_path to
  'public',
  'pg_temp'
as $function$
begin
  perform
    public.enqueue_platform_notification(
      new.workspace_id,
      new.recipient_user_id,
      'task_reminders',
      'task_alert',
      new.id,
      coalesce(
        nullif(
          btrim(
            new.title
          ),
          ''
        ),
        'Task reminder'
      ),
      concat_ws(
        ' — ',
        coalesce(
          nullif(
            btrim(
              new.title
            ),
            ''
          ),
          'Task reminder'
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
      coalesce(
        nullif(
          btrim(
            new.route
          ),
          ''
        ),
        '/tasks'
      )
    );

  return new;
end;
$function$;

drop trigger if exists
enqueue_task_alert_platform_notification_trigger
on public.task_alerts;

create trigger
enqueue_task_alert_platform_notification_trigger
after insert
on public.task_alerts
for each row
execute function
public.enqueue_task_alert_platform_notification();

-- ============================================================
-- APPROVAL ASSIGNMENT -> PLATFORM SMS QUEUE
--
-- We notify the assigned reviewer when:
--   * a new approval has an assigned_to user
--   * assigned_to changes to a new user
--   * status becomes submitted
--
-- The unique queue key prevents duplicate sends to the same
-- reviewer for the same approval record.
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
  should_notify boolean :=
    false;
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

  if tg_op =
    'INSERT'
  then
    should_notify =
      true;
  elsif
    nullif(
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
    should_notify =
      true;
  elsif
    approval_status =
      'submitted'
    and previous_status
      is distinct from
      'submitted'
  then
    should_notify =
      true;
  end if;

  if not should_notify then
    return new;
  end if;

  perform
    public.enqueue_platform_notification(
      workspace_id,
      recipient_id,
      'approvals',
      'approval',
      approval_id,
      'Approval requires your review',
      case
        when approval_status =
          'submitted'
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

drop trigger if exists
enqueue_approval_platform_notification_trigger
on public.approvals;

create trigger
enqueue_approval_platform_notification_trigger
after insert or update
on public.approvals
for each row
execute function
public.enqueue_approval_platform_notification();

commit;

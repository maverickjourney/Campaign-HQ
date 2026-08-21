-- ============================================================
-- CAMPAIGN SEAT
-- PLATFORM NOTIFICATION DELIVERY GUARDRAILS — PHASE 3
--
-- Adds:
--   * category-specific expiration
--   * stale processing recovery
--   * queue health RPC
--   * approval event-specific idempotency
--
-- SMS delivery remains controlled by the Edge Function gate.
-- ============================================================

begin;

alter table
public.platform_notification_queue
add column if not exists
expires_at timestamptz;

update
  public.platform_notification_queue
set
  expires_at =
    created_at +
    case category
      when 'task_reminders'
        then interval '6 hours'

      when 'approvals'
        then interval '24 hours'

      when 'field_alerts'
        then interval '2 hours'

      when 'campaign_updates'
        then interval '6 hours'

      when 'weekly_summary'
        then interval '72 hours'

      else interval '6 hours'
    end
where
  expires_at is null;

alter table
public.platform_notification_queue
alter column
expires_at
set not null;

alter table
public.platform_notification_queue
drop constraint if exists
platform_notification_queue_expiry_check;

alter table
public.platform_notification_queue
add constraint
platform_notification_queue_expiry_check
check (
  expires_at >=
    created_at
);

create index if not exists
platform_notification_queue_delivery_guard_idx
on public.platform_notification_queue (
  status,
  available_at,
  expires_at,
  created_at
)
where
  status in (
    'pending',
    'processing'
  );

-- ============================================================
-- ENQUEUE WITH CATEGORY TTL
-- ============================================================

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

  normalized_category text :=
    lower(
      btrim(
        coalesce(
          target_category,
          ''
        )
      )
    );

  target_expires_at timestamptz;
begin
  if target_recipient_user_id is null then
    return null;
  end if;

  if normalized_category not in (
    'campaign_updates',
    'task_reminders',
    'approvals',
    'field_alerts',
    'weekly_summary'
  ) then
    return null;
  end if;

  if not public.platform_sms_delivery_eligible(
    target_recipient_user_id,
    normalized_category
  ) then
    return null;
  end if;

  target_expires_at :=
    now() +
    case normalized_category
      when 'task_reminders'
        then interval '6 hours'

      when 'approvals'
        then interval '24 hours'

      when 'field_alerts'
        then interval '2 hours'

      when 'campaign_updates'
        then interval '6 hours'

      when 'weekly_summary'
        then interval '72 hours'

      else interval '6 hours'
    end;

  insert into
    public.platform_notification_queue (
      workspace_id,
      recipient_user_id,
      category,
      source_type,
      source_id,
      title,
      body,
      route,
      expires_at
    )
  values (
    target_workspace_id,
    target_recipient_user_id,
    normalized_category,
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
    ),
    target_expires_at
  )
  on conflict do nothing
  returning
    id
  into
    inserted_id;

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
-- APPROVAL EVENT-SPECIFIC IDEMPOTENCY
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
    tg_op =
      'UPDATE'
    and approval_status =
      'submitted'
    and previous_status
      is distinct from
      'submitted'
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
-- EXPIRE STALE PENDING ITEMS
-- Called immediately before enabled delivery.
-- ============================================================

create or replace function
public.expire_platform_notification_queue()
returns integer
language plpgsql
security definer
set search_path to
  'public',
  'pg_temp'
as $function$
declare
  affected_count integer :=
    0;
begin
  update
    public.platform_notification_queue
  set
    status =
      'skipped',

    last_error =
      'Notification expired before dispatch.',

    updated_at =
      now()
  where
    status =
      'pending'
    and expires_at <=
      now();

  get diagnostics
    affected_count =
      row_count;

  return
    affected_count;
end;
$function$;

revoke all
on function
public.expire_platform_notification_queue()
from public;

revoke all
on function
public.expire_platform_notification_queue()
from anon;

revoke all
on function
public.expire_platform_notification_queue()
from authenticated;

grant execute
on function
public.expire_platform_notification_queue()
to service_role;

-- ============================================================
-- RECOVER STUCK PROCESSING ITEMS
-- A crashed Edge Function must not strand queue rows forever.
-- ============================================================

create or replace function
public.recover_stale_platform_notification_queue()
returns jsonb
language plpgsql
security definer
set search_path to
  'public',
  'pg_temp'
as $function$
declare
  recovered_count integer :=
    0;

  failed_count integer :=
    0;
begin
  update
    public.platform_notification_queue
  set
    status =
      'failed',

    last_error =
      coalesce(
        nullif(
          last_error,
          ''
        ) ||
          ' ',
        ''
      ) ||
      'Maximum dispatcher attempts reached after stale processing recovery.',

    updated_at =
      now()
  where
    status =
      'processing'
    and updated_at <
      now() -
      interval '10 minutes'
    and attempts >=
      5;

  get diagnostics
    failed_count =
      row_count;

  update
    public.platform_notification_queue
  set
    status =
      'pending',

    available_at =
      now() +
      interval '2 minutes',

    last_error =
      coalesce(
        nullif(
          last_error,
          ''
        ) ||
          ' ',
        ''
      ) ||
      'Recovered from stale dispatcher processing state.',

    updated_at =
      now()
  where
    status =
      'processing'
    and updated_at <
      now() -
      interval '10 minutes'
    and attempts <
      5;

  get diagnostics
    recovered_count =
      row_count;

  return
    jsonb_build_object(
      'recovered',
        recovered_count,
      'failed',
        failed_count
    );
end;
$function$;

revoke all
on function
public.recover_stale_platform_notification_queue()
from public;

revoke all
on function
public.recover_stale_platform_notification_queue()
from anon;

revoke all
on function
public.recover_stale_platform_notification_queue()
from authenticated;

grant execute
on function
public.recover_stale_platform_notification_queue()
to service_role;

-- ============================================================
-- QUEUE HEALTH
-- No message bodies, phone numbers or secret values are returned.
-- ============================================================

create or replace function
public.get_platform_notification_queue_health()
returns jsonb
language plpgsql
security definer
set search_path to
  'public',
  'pg_temp'
as $function$
declare
  pending_count bigint :=
    0;

  processing_count bigint :=
    0;

  sent_count bigint :=
    0;

  skipped_count bigint :=
    0;

  failed_count bigint :=
    0;

  expired_pending_count bigint :=
    0;

  oldest_pending timestamptz;

  by_category jsonb :=
    '{}'::jsonb;
begin
  select
    count(*)
  into
    pending_count
  from
    public.platform_notification_queue
  where
    status =
      'pending';

  select
    count(*)
  into
    processing_count
  from
    public.platform_notification_queue
  where
    status =
      'processing';

  select
    count(*)
  into
    sent_count
  from
    public.platform_notification_queue
  where
    status =
      'sent';

  select
    count(*)
  into
    skipped_count
  from
    public.platform_notification_queue
  where
    status =
      'skipped';

  select
    count(*)
  into
    failed_count
  from
    public.platform_notification_queue
  where
    status =
      'failed';

  select
    count(*)
  into
    expired_pending_count
  from
    public.platform_notification_queue
  where
    status =
      'pending'
    and expires_at <=
      now();

  select
    min(
      created_at
    )
  into
    oldest_pending
  from
    public.platform_notification_queue
  where
    status =
      'pending';

  select
    coalesce(
      jsonb_object_agg(
        category,
        category_count
      ),
      '{}'::jsonb
    )
  into
    by_category
  from
    (
      select
        category,
        count(*) as
          category_count
      from
        public.platform_notification_queue
      where
        status =
          'pending'
      group by
        category
    ) as counts;

  return
    jsonb_build_object(
      'pending',
        pending_count,
      'processing',
        processing_count,
      'sent',
        sent_count,
      'skipped',
        skipped_count,
      'failed',
        failed_count,
      'expired_pending',
        expired_pending_count,
      'oldest_pending_created_at',
        oldest_pending,
      'pending_by_category',
        by_category
    );
end;
$function$;

revoke all
on function
public.get_platform_notification_queue_health()
from public;

revoke all
on function
public.get_platform_notification_queue_health()
from anon;

revoke all
on function
public.get_platform_notification_queue_health()
from authenticated;

grant execute
on function
public.get_platform_notification_queue_health()
to service_role;

commit;

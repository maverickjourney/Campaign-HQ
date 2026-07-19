-- ============================================================
-- CAMPAIGN HQ — SHARED ACTIVITY CENTER
--
-- Reuses public.activity_log, adds per-user read tracking,
-- clickable destinations and automatic activity capture.
-- ============================================================

begin;

create extension if not exists pgcrypto;

alter table public.activity_log
  add column if not exists route text;

alter table public.activity_log
  add column if not exists metadata jsonb
  not null default '{}'::jsonb;

create unique index if not exists
activity_log_id_workspace_unique
on public.activity_log (
  id,
  workspace_id
);

create table if not exists
public.activity_read_receipts (
  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  activity_id uuid not null,

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  read_at timestamptz not null
    default now(),

  primary key (
    activity_id,
    user_id
  ),

  foreign key (
    activity_id,
    workspace_id
  )
  references public.activity_log (
    id,
    workspace_id
  )
  on delete cascade
);

create index if not exists
activity_reads_workspace_user_index
on public.activity_read_receipts (
  workspace_id,
  user_id,
  read_at desc
);

alter table
public.activity_read_receipts
enable row level security;

drop policy if exists
"Members can view their activity receipts"
on public.activity_read_receipts;

create policy
"Members can view their activity receipts"
on public.activity_read_receipts
for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_workspace_member(
    workspace_id
  )
);

drop policy if exists
"Members can create their activity receipts"
on public.activity_read_receipts;

create policy
"Members can create their activity receipts"
on public.activity_read_receipts
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_workspace_member(
    workspace_id
  )
);

drop policy if exists
"Members can update their activity receipts"
on public.activity_read_receipts;

create policy
"Members can update their activity receipts"
on public.activity_read_receipts
for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_workspace_member(
    workspace_id
  )
)
with check (
  user_id = auth.uid()
  and public.is_workspace_member(
    workspace_id
  )
);

drop policy if exists
"Members can delete their activity receipts"
on public.activity_read_receipts;

create policy
"Members can delete their activity receipts"
on public.activity_read_receipts
for delete
to authenticated
using (
  user_id = auth.uid()
  and public.is_workspace_member(
    workspace_id
  )
);

grant select, insert, update, delete
on public.activity_read_receipts
to authenticated;

create or replace function
public.capture_campaign_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $campaign_hq$
declare
  next_row jsonb :=
    to_jsonb(new);

  previous_row jsonb :=
    case
      when tg_op = 'UPDATE'
        then to_jsonb(old)
      else '{}'::jsonb
    end;

  activity_workspace_id uuid;
  activity_actor_id uuid;
  activity_entity_id uuid;
  activity_kind text;
  activity_title text;
  activity_detail text;
  activity_entity_type text;
  activity_route text;
  record_title text;
begin
  if coalesce(
    (
      next_row ->> 'is_sample'
    )::boolean,
    false
  ) then
    return new;
  end if;

  activity_workspace_id =
    coalesce(
      nullif(
        next_row ->>
          'workspace_id',
        ''
      )::uuid,
      case
        when tg_table_name =
          'workspaces'
          then nullif(
            next_row ->> 'id',
            ''
          )::uuid
        else null
      end
    );

  activity_entity_id =
    nullif(
      next_row ->> 'id',
      ''
    )::uuid;

  activity_actor_id =
    coalesce(
      auth.uid(),
      nullif(
        next_row ->>
          'updated_by',
        ''
      )::uuid,
      nullif(
        next_row ->>
          'reviewed_by',
        ''
      )::uuid,
      nullif(
        next_row ->>
          'uploaded_by',
        ''
      )::uuid,
      nullif(
        next_row ->>
          'created_by',
        ''
      )::uuid,
      nullif(
        next_row ->>
          'submitted_by',
        ''
      )::uuid,
      nullif(
        next_row ->>
          'invited_by',
        ''
      )::uuid,
      nullif(
        next_row ->>
          'user_id',
        ''
      )::uuid
    );

  record_title =
    coalesce(
      nullif(
        next_row ->> 'title',
        ''
      ),
      nullif(
        next_row ->> 'file_name',
        ''
      ),
      nullif(
        next_row ->> 'email',
        ''
      ),
      nullif(
        next_row ->> 'name',
        ''
      ),
      'Campaign record'
    );

  case tg_table_name
    when 'campaign_files' then
      if tg_op <> 'INSERT' then
        return new;
      end if;

      activity_kind =
        'file_uploaded';
      activity_title =
        'New file uploaded';
      activity_detail =
        record_title ||
        ' · ' ||
        coalesce(
          nullif(
            next_row ->>
              'category',
            ''
          ),
          'Other'
        );
      activity_entity_type =
        'file';
      activity_route =
        '/files';

    when 'tasks' then
      activity_entity_type =
        'task';
      activity_route =
        '/tasks';

      if tg_op = 'INSERT' then
        activity_kind =
          'task_created';
        activity_title =
          'Task created';
        activity_detail =
          record_title;
      elsif
        next_row ->> 'status'
        is distinct from
        previous_row ->> 'status'
      then
        activity_kind =
          case
            when next_row ->>
              'status' =
              'completed'
              then 'task_completed'
            when next_row ->>
              'status' =
              'in_progress'
              then 'task_started'
            when next_row ->>
              'status' =
              'archived'
              then 'task_archived'
            else 'task_status_changed'
          end;

        activity_title =
          case
            when next_row ->>
              'status' =
              'completed'
              then 'Task completed'
            when next_row ->>
              'status' =
              'in_progress'
              then 'Task started'
            when next_row ->>
              'status' =
              'archived'
              then 'Task archived'
            else 'Task status updated'
          end;

        activity_detail =
          record_title;
      elsif
        next_row ->> 'title'
          is distinct from
          previous_row ->> 'title'
        or next_row ->>
          'assigned_to'
          is distinct from
          previous_row ->>
            'assigned_to'
        or next_row ->>
          'due_at'
          is distinct from
          previous_row ->>
            'due_at'
      then
        activity_kind =
          'task_updated';
        activity_title =
          'Task updated';
        activity_detail =
          record_title;
      else
        return new;
      end if;

    when 'events' then
      activity_entity_type =
        'event';
      activity_route =
        '/calendar';

      if tg_op = 'INSERT' then
        activity_kind =
          'event_created';
        activity_title =
          'Event created';
      elsif
        next_row ->> 'status'
        is distinct from
        previous_row ->> 'status'
      then
        activity_kind =
          case
            when next_row ->>
              'status' =
              'completed'
              then 'event_completed'
            when next_row ->>
              'status' =
              'cancelled'
              then 'event_cancelled'
            else 'event_status_changed'
          end;

        activity_title =
          case
            when next_row ->>
              'status' =
              'completed'
              then 'Event completed'
            when next_row ->>
              'status' =
              'cancelled'
              then 'Event cancelled'
            else 'Event status updated'
          end;
      elsif
        next_row ->> 'title'
          is distinct from
          previous_row ->> 'title'
        or next_row ->>
          'starts_at'
          is distinct from
          previous_row ->>
            'starts_at'
        or next_row ->>
          'location'
          is distinct from
          previous_row ->>
            'location'
      then
        activity_kind =
          'event_updated';
        activity_title =
          'Event updated';
      else
        return new;
      end if;

      activity_detail =
        record_title;

    when 'approvals' then
      activity_entity_type =
        'approval';
      activity_route =
        '/approvals';

      if tg_op = 'INSERT' then
        activity_kind =
          'approval_created';
        activity_title =
          'Approval requested';
      elsif
        next_row ->> 'status'
        is distinct from
        previous_row ->> 'status'
      then
        activity_kind =
          'approval_' ||
          coalesce(
            next_row ->>
              'status',
            'updated'
          );

        activity_title =
          case
            when next_row ->>
              'status' =
              'approved'
              then 'Approval granted'
            when next_row ->>
              'status' =
              'changes_requested'
              then 'Changes requested'
            when next_row ->>
              'status' =
              'rejected'
              then 'Approval rejected'
            when next_row ->>
              'status' =
              'pending'
              then 'Approval submitted'
            else 'Approval updated'
          end;
      elsif
        next_row ->> 'title'
          is distinct from
          previous_row ->> 'title'
        or next_row ->>
          'assigned_to'
          is distinct from
          previous_row ->>
            'assigned_to'
      then
        activity_kind =
          'approval_updated';
        activity_title =
          'Approval updated';
      else
        return new;
      end if;

      activity_detail =
        record_title;

    when 'campaign_communications' then
      activity_entity_type =
        'communication';
      activity_route =
        '/communications';

      if tg_op = 'INSERT' then
        activity_kind =
          'communication_created';
        activity_title =
          'Message draft created';
      elsif
        next_row ->> 'status'
        is distinct from
        previous_row ->> 'status'
      then
        activity_kind =
          'communication_' ||
          coalesce(
            next_row ->>
              'status',
            'updated'
          );

        activity_title =
          case
            when next_row ->>
              'status' =
              'ready'
              then 'Message ready for review'
            when next_row ->>
              'status' =
              'scheduled'
              then 'Message scheduled'
            when next_row ->>
              'status' =
              'archived'
              then 'Message archived'
            else 'Message updated'
          end;
      elsif
        next_row ->> 'title'
          is distinct from
          previous_row ->> 'title'
        or next_row ->>
          'channel'
          is distinct from
          previous_row ->>
            'channel'
        or next_row ->>
          'scheduled_at'
          is distinct from
          previous_row ->>
            'scheduled_at'
      then
        activity_kind =
          'communication_updated';
        activity_title =
          'Message updated';
      else
        return new;
      end if;

      activity_detail =
        record_title;

    when 'workspace_invitations' then
      activity_entity_type =
        'invitation';
      activity_route =
        '/team/invitations';

      if tg_op = 'INSERT' then
        activity_kind =
          'invitation_created';
        activity_title =
          'Team invitation created';
      elsif
        next_row ->> 'status'
        is distinct from
        previous_row ->> 'status'
      then
        activity_kind =
          'invitation_' ||
          coalesce(
            next_row ->>
              'status',
            'updated'
          );

        activity_title =
          case
            when next_row ->>
              'status' =
              'accepted'
              then 'Team invitation accepted'
            when next_row ->>
              'status' =
              'cancelled'
              then 'Team invitation cancelled'
            else 'Team invitation updated'
          end;
      else
        return new;
      end if;

      activity_detail =
        record_title;

    when 'workspace_members' then
      activity_entity_type =
        'member';
      activity_route =
        '/team/access';

      if tg_op = 'INSERT' then
        activity_kind =
          'member_added';
        activity_title =
          'Campaign member added';
      elsif
        next_row ->> 'role_key'
          is distinct from
          previous_row ->>
            'role_key'
        or next_row ->>
          'display_title'
          is distinct from
          previous_row ->>
            'display_title'
        or next_row ->>
          'status'
          is distinct from
          previous_row ->>
            'status'
      then
        activity_kind =
          'member_access_updated';
        activity_title =
          'Member access updated';
      else
        return new;
      end if;

      activity_detail =
        coalesce(
          nullif(
            next_row ->>
              'display_title',
            ''
          ),
          nullif(
            next_row ->>
              'role_key',
            ''
          ),
          'Campaign member'
        );

    when 'workspaces' then
      if tg_op <> 'UPDATE' then
        return new;
      end if;

      if not (
        next_row ->> 'name'
          is distinct from
          previous_row ->> 'name'
        or next_row ->>
          'description'
          is distinct from
          previous_row ->>
            'description'
        or next_row ->>
          'location'
          is distinct from
          previous_row ->>
            'location'
        or next_row ->>
          'election_date'
          is distinct from
          previous_row ->>
            'election_date'
      ) then
        return new;
      end if;

      activity_kind =
        'workspace_updated';
      activity_title =
        'Workspace settings updated';
      activity_detail =
        record_title;
      activity_entity_type =
        'workspace';
      activity_route =
        '/workspace/settings';

    else
      return new;
  end case;

  if activity_workspace_id is null then
    return new;
  end if;

  insert into public.activity_log (
    workspace_id,
    actor_user_id,
    activity_type,
    title,
    detail,
    entity_type,
    entity_id,
    route,
    metadata,
    occurred_at
  )
  values (
    activity_workspace_id,
    activity_actor_id,
    activity_kind,
    activity_title,
    activity_detail,
    activity_entity_type,
    activity_entity_id,
    activity_route,
    jsonb_build_object(
      'table',
      tg_table_name,
      'operation',
      tg_op,
      'status',
      next_row ->> 'status'
    ),
    now()
  );

  return new;
end
$campaign_hq$;

drop trigger if exists
capture_campaign_files_activity
on public.campaign_files;

create trigger
capture_campaign_files_activity
after insert
on public.campaign_files
for each row
execute function
public.capture_campaign_activity();

drop trigger if exists
capture_tasks_activity
on public.tasks;

create trigger
capture_tasks_activity
after insert or update
on public.tasks
for each row
execute function
public.capture_campaign_activity();

drop trigger if exists
capture_events_activity
on public.events;

create trigger
capture_events_activity
after insert or update
on public.events
for each row
execute function
public.capture_campaign_activity();

drop trigger if exists
capture_approvals_activity
on public.approvals;

create trigger
capture_approvals_activity
after insert or update
on public.approvals
for each row
execute function
public.capture_campaign_activity();

drop trigger if exists
capture_communications_activity
on public.campaign_communications;

create trigger
capture_communications_activity
after insert or update
on public.campaign_communications
for each row
execute function
public.capture_campaign_activity();

drop trigger if exists
capture_invitations_activity
on public.workspace_invitations;

create trigger
capture_invitations_activity
after insert or update
on public.workspace_invitations
for each row
execute function
public.capture_campaign_activity();

drop trigger if exists
capture_members_activity
on public.workspace_members;

create trigger
capture_members_activity
after insert or update
on public.workspace_members
for each row
execute function
public.capture_campaign_activity();

drop trigger if exists
capture_workspace_settings_activity
on public.workspaces;

create trigger
capture_workspace_settings_activity
after update
on public.workspaces
for each row
execute function
public.capture_campaign_activity();

insert into public.activity_log (
  workspace_id,
  actor_user_id,
  activity_type,
  title,
  detail,
  entity_type,
  entity_id,
  route,
  metadata,
  occurred_at
)
select
  campaign_file.workspace_id,
  campaign_file.uploaded_by,
  'file_uploaded',
  'New file uploaded',
  campaign_file.file_name ||
    ' · ' ||
    campaign_file.category,
  'file',
  campaign_file.id,
  '/files',
  jsonb_build_object(
    'table',
    'campaign_files',
    'operation',
    'BACKFILL'
  ),
  campaign_file.created_at
from public.campaign_files
  as campaign_file
where not exists (
  select 1
  from public.activity_log
    as existing_activity
  where
    existing_activity.workspace_id =
      campaign_file.workspace_id
    and existing_activity.entity_type =
      'file'
    and existing_activity.entity_id =
      campaign_file.id
);

do $campaign_hq$
begin
  alter publication
  supabase_realtime
  add table
  public.activity_read_receipts;
exception
  when duplicate_object then null;
end
$campaign_hq$;

do $campaign_hq$
begin
  alter publication
  supabase_realtime
  add table
  public.activity_log;
exception
  when duplicate_object then null;
end
$campaign_hq$;

notify pgrst, 'reload schema';

commit;

select
  (
    select count(*)
    from public.activity_log
  ) as activity_rows,
  (
    select count(*)
    from public.activity_read_receipts
  ) as read_receipts;

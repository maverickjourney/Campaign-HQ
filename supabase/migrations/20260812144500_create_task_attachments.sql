-- ============================================================
-- CAMPAIGN SEAT
-- TASK ATTACHMENTS
--
-- Task attachments reuse Campaign Seat's existing private
-- campaign_files records and campaign-files Storage bucket.
--
-- This table links an existing campaign file to a task.
-- Removing an attachment removes only this relationship.
-- It does NOT delete the underlying campaign file.
-- ============================================================

create extension if not exists pgcrypto;


-- ============================================================
-- TASK ATTACHMENT RELATIONSHIPS
-- ============================================================

create table if not exists
  public.task_attachments (
    id uuid primary key
      default gen_random_uuid(),

    workspace_id uuid not null
      references public.workspaces(id)
      on delete cascade,

    task_id uuid not null
      references public.tasks(id)
      on delete cascade,

    file_id uuid not null
      references public.campaign_files(id)
      on delete cascade,

    created_by uuid
      references public.profiles(id)
      on delete set null
      default auth.uid(),

    created_at timestamptz not null
      default now(),

    constraint task_attachments_unique_file
      unique (
        task_id,
        file_id
      )
  );


create index if not exists
  task_attachments_workspace_idx
on public.task_attachments (
  workspace_id,
  created_at desc
);


create index if not exists
  task_attachments_task_idx
on public.task_attachments (
  task_id,
  created_at desc
);


create index if not exists
  task_attachments_file_idx
on public.task_attachments (
  file_id
);


-- ============================================================
-- VALIDATION / IMMUTABILITY
--
-- Protect against:
-- 1. attaching a file from another workspace
-- 2. spoofing workspace_id
-- 3. moving an attachment relationship after creation
-- 4. spoofing created_by
-- ============================================================

create or replace function
  public.validate_task_attachment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  task_workspace_id uuid;
  file_workspace_id uuid;
begin
  if
    tg_op = 'UPDATE'
    and (
      new.workspace_id
        is distinct from old.workspace_id
      or new.task_id
        is distinct from old.task_id
      or new.file_id
        is distinct from old.file_id
      or new.created_by
        is distinct from old.created_by
    )
  then
    raise exception
      'A task attachment relationship cannot be reassigned.'
      using errcode = '22023';
  end if;


  select
    task.workspace_id
  into
    task_workspace_id
  from public.tasks as task
  where task.id = new.task_id;


  if task_workspace_id is null then
    raise exception
      'The task does not exist.'
      using errcode = '23503';
  end if;


  select
    campaign_file.workspace_id
  into
    file_workspace_id
  from public.campaign_files
    as campaign_file
  where campaign_file.id =
    new.file_id;


  if file_workspace_id is null then
    raise exception
      'The campaign file does not exist.'
      using errcode = '23503';
  end if;


  if
    task_workspace_id
      <> file_workspace_id
    or new.workspace_id
      <> task_workspace_id
  then
    raise exception
      'Task attachments must remain inside one campaign workspace.'
      using errcode = '22023';
  end if;


  if tg_op = 'INSERT' then
    new.created_by :=
      auth.uid();
  end if;


  return new;
end;
$$;


revoke all
on function
  public.validate_task_attachment()
from public;

revoke all
on function
  public.validate_task_attachment()
from anon;

revoke all
on function
  public.validate_task_attachment()
from authenticated;


drop trigger if exists
  validate_task_attachment_trigger
on public.task_attachments;


create trigger
  validate_task_attachment_trigger
before insert or update
on public.task_attachments
for each row
execute function
  public.validate_task_attachment();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table
  public.task_attachments
enable row level security;


grant
  select,
  insert,
  delete
on public.task_attachments
to authenticated;


-- ------------------------------------------------------------
-- SELECT
--
-- Attachment relationships are visible only when the parent
-- task is visible under Campaign Seat's existing task rules.
--
-- The campaign_files table and private Storage bucket retain
-- their own workspace-level security.
-- ------------------------------------------------------------

drop policy if exists
  "task_attachments_select_visible"
on public.task_attachments;


create policy
  "Visible task attachments can be viewed"
on public.task_attachments
for select
to authenticated
using (
  public.can_view_role_scoped_task(
    task_id
  )
);


-- ------------------------------------------------------------
-- INSERT
--
-- Leadership may attach files to any task they manage.
--
-- Otherwise the task assignee or task creator may attach a
-- campaign file to their own visible task.
--
-- The file must belong to the exact same workspace.
-- ------------------------------------------------------------

drop policy if exists
  "task_attachments_insert_authorized"
on public.task_attachments;


create policy
  "Authorized members can attach campaign files to tasks"
on public.task_attachments
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
        task_attachments.task_id

      and task.workspace_id =
        task_attachments.workspace_id

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

  and exists (
    select 1
    from public.campaign_files
      as campaign_file
    where
      campaign_file.id =
        task_attachments.file_id

      and campaign_file.workspace_id =
        task_attachments.workspace_id
  )
);


-- ------------------------------------------------------------
-- UPDATE
--
-- Attachment relationships are immutable.
--
-- No UPDATE privilege or RLS policy is intentionally granted.
-- To change the file relationship, unlink it and attach the
-- correct campaign file.
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- DELETE / UNLINK
--
-- Deleting this row unlinks the file from the task.
--
-- It intentionally does NOT delete public.campaign_files or
-- the underlying private Storage object.
-- ------------------------------------------------------------

drop policy if exists
  "task_attachments_delete_authorized"
on public.task_attachments;


create policy
  "Authorized members can unlink task attachments"
on public.task_attachments
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
        task_attachments.task_id

      and task.workspace_id =
        task_attachments.workspace_id

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
-- REALTIME
-- Keep an open task drawer synchronized when another campaign
-- member attaches or unlinks a file.
-- ============================================================

-- CAMPAIGN SEAT TASK ATTACHMENTS REALTIME
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where
      pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'task_attachments'
  ) then
    alter publication
      supabase_realtime
    add table
      public.task_attachments;
  end if;
end;
$$;

-- ============================================================
-- DOCUMENTATION
-- ============================================================

comment on table
  public.task_attachments
is
  'Links Campaign Seat campaign_files records to Tasks without duplicating or deleting the underlying private campaign file.';


comment on column
  public.task_attachments.file_id
is
  'Existing public.campaign_files record attached to this task.';


comment on column
  public.task_attachments.created_by
is
  'Campaign member who attached the file to the task.';


comment on function
  public.validate_task_attachment()
is
  'Prevents cross-workspace or reassigned task attachment relationships and records the authenticated attaching user.';

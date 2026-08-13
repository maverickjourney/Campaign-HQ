-- ============================================================
-- CAMPAIGN SEAT
-- TASK SUBTASKS / CHECKLISTS
-- ============================================================

create table if not exists public.task_subtasks (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  task_id uuid not null
    references public.tasks(id)
    on delete cascade,

  title text not null,

  is_completed boolean not null
    default false,

  sort_order integer not null
    default 0,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  completed_by uuid
    references public.profiles(id)
    on delete set null,

  completed_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint task_subtasks_title_not_blank
    check (
      length(trim(title)) > 0
      and length(trim(title)) <= 500
    ),

  constraint task_subtasks_sort_order_valid
    check (sort_order >= 0)
);

create index if not exists
  task_subtasks_workspace_idx
on public.task_subtasks (
  workspace_id
);

create index if not exists
  task_subtasks_task_idx
on public.task_subtasks (
  task_id,
  sort_order,
  created_at
);

create index if not exists
  task_subtasks_open_idx
on public.task_subtasks (
  task_id,
  is_completed
);

-- ------------------------------------------------------------
-- Keep completion metadata internally consistent.
-- ------------------------------------------------------------

create or replace function
  public.normalize_task_subtask_completion()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if
    tg_op = 'UPDATE'
    and (
      new.workspace_id is distinct from old.workspace_id
      or new.task_id is distinct from old.task_id
    )
  then
    raise exception
      'A checklist item cannot be moved to another task.'
      using errcode = '22023';
  end if;

  if new.is_completed then
    if
      tg_op = 'INSERT'
      or old.is_completed is distinct from true
    then
      new.completed_at := now();
      new.completed_by := auth.uid();
    end if;
  else
    new.completed_at := null;
    new.completed_by := null;
  end if;

  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists
  normalize_task_subtask_completion_trigger
on public.task_subtasks;

create trigger
  normalize_task_subtask_completion_trigger
before insert or update
on public.task_subtasks
for each row
execute function
  public.normalize_task_subtask_completion();

-- ------------------------------------------------------------
-- RLS
--
-- Visibility follows the parent task. Existing Tasks RLS still
-- controls whether the user can work with the underlying task.
-- ------------------------------------------------------------

alter table
  public.task_subtasks
enable row level security;

-- ------------------------------------------------------------
-- SELECT
-- A checklist is visible only when its parent task is visible
-- under Campaign Seat's existing role-scoped task rules.
-- ------------------------------------------------------------

drop policy if exists
  "task_subtasks_select_workspace"
on public.task_subtasks;

create policy
  "Visible task checklists can be viewed"
on public.task_subtasks
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
-- Leadership may manage all task checklists.
-- The task assignee or creator may manage their own visible task.
-- The actor is always recorded as created_by.
-- ------------------------------------------------------------

drop policy if exists
  "task_subtasks_insert_workspace"
on public.task_subtasks;

create policy
  "Authorized members can create task checklist items"
on public.task_subtasks
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
      task.id = task_subtasks.task_id

      and task.workspace_id =
        task_subtasks.workspace_id

      and (
        public.is_workspace_admin(
          task.workspace_id
        )

        or public.has_campaign_permission(
          task.workspace_id,
          'tasks.manage_all'
        )

        or task.assigned_to = auth.uid()

        or task.created_by = auth.uid()
      )
  )
);

-- ------------------------------------------------------------
-- UPDATE
-- Same ownership/leadership rule as checklist creation.
-- Parent task/workspace are immutable via trigger.
-- ------------------------------------------------------------

drop policy if exists
  "task_subtasks_update_workspace"
on public.task_subtasks;

create policy
  "Authorized members can update task checklist items"
on public.task_subtasks
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
      task.id = task_subtasks.task_id

      and task.workspace_id =
        task_subtasks.workspace_id

      and (
        public.is_workspace_admin(
          task.workspace_id
        )

        or public.has_campaign_permission(
          task.workspace_id,
          'tasks.manage_all'
        )

        or task.assigned_to = auth.uid()

        or task.created_by = auth.uid()
      )
  )
)
with check (
  public.can_view_role_scoped_task(
    task_id
  )

  and exists (
    select 1
    from public.tasks as task
    where
      task.id = task_subtasks.task_id

      and task.workspace_id =
        task_subtasks.workspace_id

      and (
        public.is_workspace_admin(
          task.workspace_id
        )

        or public.has_campaign_permission(
          task.workspace_id,
          'tasks.manage_all'
        )

        or task.assigned_to = auth.uid()

        or task.created_by = auth.uid()
      )
  )
);

-- ------------------------------------------------------------
-- DELETE
-- Same ownership/leadership rule.
-- ------------------------------------------------------------

drop policy if exists
  "task_subtasks_delete_workspace"
on public.task_subtasks;

create policy
  "Authorized members can delete task checklist items"
on public.task_subtasks
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
      task.id = task_subtasks.task_id

      and task.workspace_id =
        task_subtasks.workspace_id

      and (
        public.is_workspace_admin(
          task.workspace_id
        )

        or public.has_campaign_permission(
          task.workspace_id,
          'tasks.manage_all'
        )

        or task.assigned_to = auth.uid()

        or task.created_by = auth.uid()
      )
  )
);

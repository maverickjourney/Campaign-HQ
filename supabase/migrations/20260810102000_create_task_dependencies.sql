-- ============================================================
-- CAMPAIGN SEAT
-- TASK DEPENDENCIES / BLOCKERS
-- ============================================================

create table if not exists public.task_dependencies (
  id uuid primary key
    default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  -- The task that cannot proceed yet.
  task_id uuid not null
    references public.tasks(id)
    on delete cascade,

  -- The prerequisite task that must be completed.
  depends_on_task_id uuid not null
    references public.tasks(id)
    on delete cascade,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  constraint task_dependencies_no_self_reference
    check (
      task_id <> depends_on_task_id
    ),

  constraint task_dependencies_unique_pair
    unique (
      task_id,
      depends_on_task_id
    )
);

create index if not exists
  task_dependencies_workspace_idx
on public.task_dependencies (
  workspace_id
);

create index if not exists
  task_dependencies_task_idx
on public.task_dependencies (
  task_id
);

create index if not exists
  task_dependencies_prerequisite_idx
on public.task_dependencies (
  depends_on_task_id
);

-- ============================================================
-- VALIDATION
--
-- Protect:
-- 1. cross-workspace relationships
-- 2. changing relationship ownership after creation
-- 3. circular dependency chains
-- ============================================================

create or replace function
  public.validate_task_dependency()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  source_workspace_id uuid;
  prerequisite_workspace_id uuid;
  cycle_exists boolean;
begin
  if
    tg_op = 'UPDATE'
    and (
      new.workspace_id is distinct from old.workspace_id
      or new.task_id is distinct from old.task_id
      or new.depends_on_task_id
        is distinct from old.depends_on_task_id
    )
  then
    raise exception
      'A task dependency relationship cannot be reassigned.'
      using errcode = '22023';
  end if;

  if new.task_id = new.depends_on_task_id then
    raise exception
      'A task cannot depend on itself.'
      using errcode = '22023';
  end if;

  select
    task.workspace_id
  into
    source_workspace_id
  from public.tasks as task
  where task.id = new.task_id;

  if source_workspace_id is null then
    raise exception
      'The dependent task does not exist.'
      using errcode = '23503';
  end if;

  select
    task.workspace_id
  into
    prerequisite_workspace_id
  from public.tasks as task
  where task.id = new.depends_on_task_id;

  if prerequisite_workspace_id is null then
    raise exception
      'The prerequisite task does not exist.'
      using errcode = '23503';
  end if;

  if
    source_workspace_id
      <> prerequisite_workspace_id
    or new.workspace_id
      <> source_workspace_id
  then
    raise exception
      'Task dependencies must remain inside one campaign workspace.'
      using errcode = '22023';
  end if;

  -- Serialize dependency graph changes inside this campaign.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      source_workspace_id::text,
      0
    )
  );

  -- ----------------------------------------------------------
  -- Circular dependency protection.
  --
  -- If we are adding:
  --
  --   A depends on B
  --
  -- then starting from B we must never be able to travel
  -- through existing dependencies and eventually reach A.
  -- ----------------------------------------------------------

  with recursive dependency_chain as (
    select
      dependency.depends_on_task_id
        as task_id
    from public.task_dependencies
      as dependency
    where
      dependency.task_id =
        new.depends_on_task_id

    union

    select
      dependency.depends_on_task_id
    from public.task_dependencies
      as dependency

    join dependency_chain
      on dependency.task_id =
        dependency_chain.task_id
  )
  select exists (
    select 1
    from dependency_chain
    where
      dependency_chain.task_id =
        new.task_id
  )
  into cycle_exists;

  if cycle_exists then
    raise exception
      'This dependency would create a circular task chain.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all
on function public.validate_task_dependency()
from public;

revoke all
on function public.validate_task_dependency()
from anon;

revoke all
on function public.validate_task_dependency()
from authenticated;

drop trigger if exists
  validate_task_dependency_trigger
on public.task_dependencies;

create trigger
  validate_task_dependency_trigger
before insert or update
on public.task_dependencies
for each row
execute function
  public.validate_task_dependency();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table
  public.task_dependencies
enable row level security;

-- ------------------------------------------------------------
-- SELECT
--
-- Do not expose a hidden task through a visible relationship.
-- User must be able to see BOTH sides.
-- ------------------------------------------------------------

create policy
  "Visible task dependencies can be viewed"
on public.task_dependencies
for select
to authenticated
using (
  public.can_view_role_scoped_task(
    task_id
  )

  and public.can_view_role_scoped_task(
    depends_on_task_id
  )
);

-- ------------------------------------------------------------
-- INSERT
--
-- Leadership can manage all.
-- Otherwise the actor must be creator/assignee of the task
-- being blocked, and must be able to see both tasks.
-- ------------------------------------------------------------

create policy
  "Authorized members can create task dependencies"
on public.task_dependencies
for insert
to authenticated
with check (
  created_by = auth.uid()

  and public.can_view_role_scoped_task(
    task_id
  )

  and public.can_view_role_scoped_task(
    depends_on_task_id
  )

  and exists (
    select 1
    from public.tasks as task
    where
      task.id =
        task_dependencies.task_id

      and task.workspace_id =
        task_dependencies.workspace_id

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

-- ------------------------------------------------------------
-- UPDATE
--
-- Dependency relationships are immutable.
-- No UPDATE policy is intentionally granted.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- DELETE
-- ------------------------------------------------------------

create policy
  "Authorized members can delete task dependencies"
on public.task_dependencies
for delete
to authenticated
using (
  public.can_view_role_scoped_task(
    task_id
  )

  and public.can_view_role_scoped_task(
    depends_on_task_id
  )

  and exists (
    select 1
    from public.tasks as task
    where
      task.id =
        task_dependencies.task_id

      and task.workspace_id =
        task_dependencies.workspace_id

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

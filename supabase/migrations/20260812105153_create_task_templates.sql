-- ============================================================
-- CAMPAIGN SEAT
-- TASK TEMPLATES / CAMPAIGN PLAYBOOKS
-- ============================================================

create table if not exists public.task_templates (
  id uuid primary key
    default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  name text not null,

  task_title text not null,

  task_description text,

  category text not null
    default 'General',

  priority text not null
    default 'normal',

  visibility text not null
    default 'workspace',

  tags text[] not null
    default '{}'::text[],

  estimated_minutes integer,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  updated_by uuid
    references public.profiles(id)
    on delete set null,

  is_active boolean not null
    default true,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint task_templates_name_valid
    check (
      length(trim(name)) between 1 and 160
    ),

  constraint task_templates_title_valid
    check (
      length(trim(task_title)) between 1 and 500
    ),

  constraint task_templates_description_valid
    check (
      task_description is null
      or length(task_description) <= 10000
    ),

  constraint task_templates_category_valid
    check (
      length(trim(category)) between 1 and 120
    ),

  constraint task_templates_priority_valid
    check (
      priority in (
        'urgent',
        'high',
        'normal',
        'low'
      )
    ),

  constraint task_templates_visibility_valid
    check (
      visibility in (
        'workspace',
        'assignee_only',
        'admin_only'
      )
    ),

  constraint task_templates_estimate_valid
    check (
      estimated_minutes is null
      or estimated_minutes between 1 and 10080
    )
);

create index if not exists
  task_templates_workspace_idx
on public.task_templates (
  workspace_id,
  is_active,
  updated_at desc
);

create unique index if not exists
  task_templates_active_name_uidx
on public.task_templates (
  workspace_id,
  lower(trim(name))
)
where is_active = true;


-- ============================================================
-- TEMPLATE CHECKLIST ITEMS
-- These are blueprint items, NOT live task_subtasks.
-- ============================================================

create table if not exists
  public.task_template_items (
    id uuid primary key
      default gen_random_uuid(),

    workspace_id uuid not null
      references public.workspaces(id)
      on delete cascade,

    template_id uuid not null
      references public.task_templates(id)
      on delete cascade,

    title text not null,

    sort_order integer not null
      default 0,

    created_by uuid
      references public.profiles(id)
      on delete set null,

    created_at timestamptz not null
      default now(),

    updated_at timestamptz not null
      default now(),

    constraint task_template_items_title_valid
      check (
        length(trim(title)) between 1 and 500
      ),

    constraint task_template_items_sort_valid
      check (
        sort_order >= 0
      )
  );

create index if not exists
  task_template_items_template_idx
on public.task_template_items (
  template_id,
  sort_order,
  created_at
);


-- ============================================================
-- NORMALIZATION / IMMUTABILITY
-- ============================================================

create or replace function
  public.normalize_task_template()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if
    tg_op = 'UPDATE'
    and new.workspace_id
      is distinct from old.workspace_id
  then
    raise exception
      'A task template cannot be moved to another workspace.'
      using errcode = '22023';
  end if;

  new.name :=
    trim(new.name);

  new.task_title :=
    trim(new.task_title);

  new.category :=
    coalesce(
      nullif(
        trim(new.category),
        ''
      ),
      'General'
    );

  if tg_op = 'INSERT' then
    new.created_by :=
      auth.uid();
  else
    new.created_by :=
      old.created_by;
  end if;

  new.updated_by :=
    auth.uid();

  new.updated_at :=
    now();

  return new;
end;
$$;

drop trigger if exists
  normalize_task_template_trigger
on public.task_templates;

create trigger
  normalize_task_template_trigger
before insert or update
on public.task_templates
for each row
execute function
  public.normalize_task_template();


create or replace function
  public.normalize_task_template_item()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  parent_workspace_id uuid;
begin
  if
    tg_op = 'UPDATE'
    and (
      new.workspace_id
        is distinct from old.workspace_id
      or new.template_id
        is distinct from old.template_id
    )
  then
    raise exception
      'A template checklist item cannot be moved.'
      using errcode = '22023';
  end if;

  select
    template.workspace_id
  into
    parent_workspace_id
  from public.task_templates
    as template
  where
    template.id =
      new.template_id;

  if parent_workspace_id is null then
    raise exception
      'The task template does not exist.'
      using errcode = '23503';
  end if;

  if
    new.workspace_id
      is distinct from
        parent_workspace_id
  then
    raise exception
      'Template checklist workspace does not match its template.'
      using errcode = '22023';
  end if;

  new.title :=
    trim(new.title);

  if tg_op = 'INSERT' then
    new.created_by :=
      auth.uid();
  else
    new.created_by :=
      old.created_by;
  end if;

  new.updated_at :=
    now();

  return new;
end;
$$;

drop trigger if exists
  normalize_task_template_item_trigger
on public.task_template_items;

create trigger
  normalize_task_template_item_trigger
before insert or update
on public.task_template_items
for each row
execute function
  public.normalize_task_template_item();


-- ============================================================
-- RLS — TASK TEMPLATES
--
-- Active templates:
-- anyone who can create tasks may use them.
--
-- Template management:
-- workspace administrators / tasks.manage_all only.
-- ============================================================

alter table
  public.task_templates
enable row level security;

drop policy if exists
  "task_templates_select_workspace"
on public.task_templates;

create policy
  "Authorized members can view task templates"
on public.task_templates
for select
to authenticated
using (
  public.is_workspace_admin(
    workspace_id
  )

  or public.has_campaign_permission(
    workspace_id,
    'tasks.manage_all'
  )

  or (
    is_active = true

    and public.has_campaign_permission(
      workspace_id,
      'tasks.create'
    )
  )
);


drop policy if exists
  "task_templates_insert_workspace"
on public.task_templates;

create policy
  "Campaign leadership can create task templates"
on public.task_templates
for insert
to authenticated
with check (
  created_by = auth.uid()

  and (
    public.is_workspace_admin(
      workspace_id
    )

    or public.has_campaign_permission(
      workspace_id,
      'tasks.manage_all'
    )
  )
);


drop policy if exists
  "task_templates_update_workspace"
on public.task_templates;

create policy
  "Campaign leadership can update task templates"
on public.task_templates
for update
to authenticated
using (
  public.is_workspace_admin(
    workspace_id
  )

  or public.has_campaign_permission(
    workspace_id,
    'tasks.manage_all'
  )
)
with check (
  public.is_workspace_admin(
    workspace_id
  )

  or public.has_campaign_permission(
    workspace_id,
    'tasks.manage_all'
  )
);


drop policy if exists
  "task_templates_delete_workspace"
on public.task_templates;

create policy
  "Campaign leadership can delete task templates"
on public.task_templates
for delete
to authenticated
using (
  public.is_workspace_admin(
    workspace_id
  )

  or public.has_campaign_permission(
    workspace_id,
    'tasks.manage_all'
  )
);


-- ============================================================
-- RLS — TEMPLATE CHECKLIST ITEMS
-- ============================================================

alter table
  public.task_template_items
enable row level security;

drop policy if exists
  "task_template_items_select_workspace"
on public.task_template_items;

create policy
  "Authorized members can view template checklist items"
on public.task_template_items
for select
to authenticated
using (
  exists (
    select 1
    from public.task_templates
      as template
    where
      template.id =
        task_template_items.template_id

      and template.workspace_id =
        task_template_items.workspace_id

      and (
        public.is_workspace_admin(
          template.workspace_id
        )

        or public.has_campaign_permission(
          template.workspace_id,
          'tasks.manage_all'
        )

        or (
          template.is_active = true

          and public.has_campaign_permission(
            template.workspace_id,
            'tasks.create'
          )
        )
      )
  )
);


drop policy if exists
  "task_template_items_insert_workspace"
on public.task_template_items;

create policy
  "Campaign leadership can create template checklist items"
on public.task_template_items
for insert
to authenticated
with check (
  created_by = auth.uid()

  and (
    public.is_workspace_admin(
      workspace_id
    )

    or public.has_campaign_permission(
      workspace_id,
      'tasks.manage_all'
    )
  )
);


drop policy if exists
  "task_template_items_update_workspace"
on public.task_template_items;

create policy
  "Campaign leadership can update template checklist items"
on public.task_template_items
for update
to authenticated
using (
  public.is_workspace_admin(
    workspace_id
  )

  or public.has_campaign_permission(
    workspace_id,
    'tasks.manage_all'
  )
)
with check (
  public.is_workspace_admin(
    workspace_id
  )

  or public.has_campaign_permission(
    workspace_id,
    'tasks.manage_all'
  )
);


drop policy if exists
  "task_template_items_delete_workspace"
on public.task_template_items;

create policy
  "Campaign leadership can delete template checklist items"
on public.task_template_items
for delete
to authenticated
using (
  public.is_workspace_admin(
    workspace_id
  )

  or public.has_campaign_permission(
    workspace_id,
    'tasks.manage_all'
  )
);


-- ============================================================
-- TABLE PRIVILEGES
-- RLS remains authoritative.
-- ============================================================

grant select, insert, update, delete
on public.task_templates
to authenticated;

grant select, insert, update, delete
on public.task_template_items
to authenticated;


comment on table
  public.task_templates
is
  'Reusable Campaign Seat task blueprints. These are not live tasks and do not run recurrence automation.';

comment on table
  public.task_template_items
is
  'Checklist blueprint items copied into task_subtasks when a task is created from a template.';

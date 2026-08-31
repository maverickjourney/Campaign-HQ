begin;


create table if not exists
public.event_task_links (
  id uuid
    primary key
    default gen_random_uuid(),

  workspace_id uuid
    not null
    references public.workspaces(id)
    on delete cascade,

  event_id uuid
    not null
    references public.events(id)
    on delete cascade,

  task_id uuid
    not null
    references public.tasks(id)
    on delete cascade,

  created_by uuid
    not null
    default auth.uid(),

  created_at timestamptz
    not null
    default now(),

  constraint
    event_task_links_unique
    unique (
      workspace_id,
      event_id,
      task_id
    )
);


create index if not exists
event_task_links_workspace_event_idx
on public.event_task_links (
  workspace_id,
  event_id,
  created_at
);


create index if not exists
event_task_links_workspace_task_idx
on public.event_task_links (
  workspace_id,
  task_id,
  created_at
);


create or replace function
public.validate_event_task_link_workspace()
returns trigger
language plpgsql
security definer
set search_path =
  public,
  pg_temp
as $campaign_seat$
begin
  if not exists (
    select 1
    from public.events e
    where
      e.id = new.event_id
      and e.workspace_id =
        new.workspace_id
  ) then
    raise exception
      'Linked event does not belong to this workspace.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.tasks t
    where
      t.id = new.task_id
      and t.workspace_id =
        new.workspace_id
  ) then
    raise exception
      'Linked task does not belong to this workspace.'
      using errcode = '23514';
  end if;

  return new;
end;
$campaign_seat$;


revoke all
on function
public.validate_event_task_link_workspace()
from
public,
anon,
authenticated;


drop trigger if exists
validate_event_task_link_workspace_trigger
on public.event_task_links;


create trigger
validate_event_task_link_workspace_trigger
before insert or update
on public.event_task_links
for each row
execute function
public.validate_event_task_link_workspace();


alter table
public.event_task_links
enable row level security;


drop policy if exists
"Authorized members can view event task links"
on public.event_task_links;


create policy
"Authorized members can view event task links"
on public.event_task_links
for select
to authenticated
using (
  public.is_workspace_member(
    workspace_id
  )
  and not
    public.is_workspace_volunteer(
      workspace_id
    )
);


drop policy if exists
"Task managers can create event task links"
on public.event_task_links;


create policy
"Task managers can create event task links"
on public.event_task_links
for insert
to authenticated
with check (
  created_by =
    auth.uid()
  and (
    public.is_workspace_admin(
      workspace_id
    )
    or public.has_campaign_permission(
      workspace_id,
      'tasks.manage_all'
    )
    or public.has_campaign_permission(
      workspace_id,
      'tasks.create'
    )
  )
);


drop policy if exists
"Task managers can remove event task links"
on public.event_task_links;


create policy
"Task managers can remove event task links"
on public.event_task_links
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
  or public.has_campaign_permission(
    workspace_id,
    'tasks.create'
  )
);


grant
select,
insert,
delete
on public.event_task_links
to authenticated;


revoke all
on public.event_task_links
from
public,
anon;


do $campaign_seat$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where
      pubname =
        'supabase_realtime'
      and schemaname =
        'public'
      and tablename =
        'event_task_links'
  ) then
    alter publication
      supabase_realtime
    add table
      public.event_task_links;
  end if;
end;
$campaign_seat$;


notify pgrst, 'reload schema';


commit;

begin;


create table if not exists
public.inbox_conversation_workflows (
  id uuid
    primary key
    default gen_random_uuid(),

  workspace_id uuid
    not null
    references public.workspaces(id)
    on delete cascade,

  conversation_key text
    not null,

  channel text
    not null
    default 'email',

  provider_thread_id text,

  mailbox_email text,

  account_provider text,

  workflow_status text
    not null
    default 'open',

  assigned_to uuid,

  is_vip boolean
    not null
    default false,

  follow_up_at timestamptz,

  snoozed_until timestamptz,

  linked_task_id uuid
    references public.tasks(id)
    on delete set null,

  note text,

  metadata jsonb
    not null
    default '{}'::jsonb,

  created_by uuid,

  updated_by uuid,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint
    inbox_conversation_workflows_key_unique
    unique (
      workspace_id,
      conversation_key
    ),

  constraint
    inbox_conversation_workflows_status_check
    check (
      workflow_status in (
        'open',
        'needs_reply',
        'waiting_on',
        'snoozed',
        'resolved'
      )
    )
);


create index if not exists
inbox_conversation_workflows_workspace_status_idx
on public.inbox_conversation_workflows (
  workspace_id,
  workflow_status
);


create index if not exists
inbox_conversation_workflows_workspace_assignee_idx
on public.inbox_conversation_workflows (
  workspace_id,
  assigned_to
);


create index if not exists
inbox_conversation_workflows_workspace_follow_up_idx
on public.inbox_conversation_workflows (
  workspace_id,
  follow_up_at
)
where follow_up_at is not null;


create index if not exists
inbox_conversation_workflows_workspace_vip_idx
on public.inbox_conversation_workflows (
  workspace_id,
  is_vip
)
where is_vip = true;


create or replace function
public.set_inbox_conversation_workflow_updated_at()
returns trigger
language plpgsql
set search_path =
  public,
  pg_temp
as $campaign_seat$
begin
  new.updated_at =
    now();

  return new;
end;
$campaign_seat$;


drop trigger if exists
set_inbox_conversation_workflow_updated_at
on public.inbox_conversation_workflows;


create trigger
set_inbox_conversation_workflow_updated_at
before update
on public.inbox_conversation_workflows
for each row
execute function
public.set_inbox_conversation_workflow_updated_at();


alter table
public.inbox_conversation_workflows
enable row level security;


drop policy if exists
"Inbox workflow visible to communications members"
on public.inbox_conversation_workflows;


create policy
"Inbox workflow visible to communications members"
on public.inbox_conversation_workflows
for select
to authenticated
using (
  public.is_workspace_member(
    workspace_id
  )
  and (
    public.is_workspace_admin(
      workspace_id
    )
    or public.has_campaign_permission(
      workspace_id,
      'communications.view'
    )
    or public.has_campaign_permission(
      workspace_id,
      'communications.manage'
    )
  )
);


drop policy if exists
"Inbox workflow manageable by communications team"
on public.inbox_conversation_workflows;


create policy
"Inbox workflow manageable by communications team"
on public.inbox_conversation_workflows
for all
to authenticated
using (
  public.is_workspace_member(
    workspace_id
  )
  and (
    public.is_workspace_admin(
      workspace_id
    )
    or public.has_campaign_permission(
      workspace_id,
      'communications.manage'
    )
  )
)
with check (
  public.is_workspace_member(
    workspace_id
  )
  and (
    public.is_workspace_admin(
      workspace_id
    )
    or public.has_campaign_permission(
      workspace_id,
      'communications.manage'
    )
  )
  and (
    assigned_to is null
    or public.is_active_workspace_user(
      workspace_id,
      assigned_to
    )
  )
);


revoke all
on public.inbox_conversation_workflows
from public, anon;


grant
select,
insert,
update,
delete
on public.inbox_conversation_workflows
to authenticated;


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
        'inbox_conversation_workflows'
  ) then
    alter publication
      supabase_realtime
    add table
      public.inbox_conversation_workflows;
  end if;
end;
$campaign_seat$;


notify pgrst, 'reload schema';


commit;

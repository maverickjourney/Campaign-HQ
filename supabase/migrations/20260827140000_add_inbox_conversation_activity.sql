begin;


create table if not exists
public.inbox_conversation_activity (
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

  event_type text
    not null,

  event_label text
    not null,

  event_detail text,

  actor_user_id uuid,

  metadata jsonb
    not null
    default '{}'::jsonb,

  created_at timestamptz
    not null
    default now()
);


create index if not exists
inbox_conversation_activity_workspace_conversation_idx
on public.inbox_conversation_activity (
  workspace_id,
  conversation_key,
  created_at desc
);


create index if not exists
inbox_conversation_activity_workspace_created_idx
on public.inbox_conversation_activity (
  workspace_id,
  created_at desc
);


alter table
public.inbox_conversation_activity
enable row level security;


drop policy if exists
"Inbox activity visible to communications members"
on public.inbox_conversation_activity;


create policy
"Inbox activity visible to communications members"
on public.inbox_conversation_activity
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
"Inbox activity creatable by communications team"
on public.inbox_conversation_activity;


create policy
"Inbox activity creatable by communications team"
on public.inbox_conversation_activity
for insert
to authenticated
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
);


revoke all
on public.inbox_conversation_activity
from public, anon;


grant
select,
insert
on public.inbox_conversation_activity
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
        'inbox_conversation_activity'
  ) then
    alter publication
      supabase_realtime
    add table
      public.inbox_conversation_activity;
  end if;
end;
$campaign_seat$;


notify pgrst, 'reload schema';


commit;

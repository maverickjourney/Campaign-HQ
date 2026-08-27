begin;


create table if not exists
public.campaign_file_context_links (
  id uuid
    primary key
    default gen_random_uuid(),

  workspace_id uuid
    not null
    references public.workspaces(id)
    on delete cascade,

  file_id uuid
    not null
    references public.campaign_files(id)
    on delete cascade,

  context_type text
    not null,

  context_key text
    not null,

  metadata jsonb
    not null
    default '{}'::jsonb,

  created_by uuid
    not null
    default auth.uid(),

  created_at timestamptz
    not null
    default now(),

  constraint
    campaign_file_context_links_unique
    unique (
      workspace_id,
      file_id,
      context_type,
      context_key
    )
);


create unique index if not exists
campaign_file_context_links_provider_attachment_unique
on public.campaign_file_context_links (
  workspace_id,
  context_type,
  context_key
)
where context_type =
  'inbox_attachment';


create index if not exists
campaign_file_context_links_workspace_context_idx
on public.campaign_file_context_links (
  workspace_id,
  context_type,
  context_key
);


alter table
public.campaign_file_context_links
enable row level security;


drop policy if exists
"Active workspace members can view file links"
on public.campaign_file_context_links;


create policy
"Active workspace members can view file links"
on public.campaign_file_context_links
for select
to authenticated
using (
  public.is_workspace_member(
    workspace_id
  )
);


drop policy if exists
"Active workspace members can create file links"
on public.campaign_file_context_links;


create policy
"Active workspace members can create file links"
on public.campaign_file_context_links
for insert
to authenticated
with check (
  created_by =
    auth.uid()
  and public.is_workspace_member(
    workspace_id
  )
);


grant
select,
insert
on public.campaign_file_context_links
to authenticated;


revoke all
on public.campaign_file_context_links
from public, anon;


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
        'campaign_file_context_links'
  ) then
    alter publication
      supabase_realtime
    add table
      public.campaign_file_context_links;
  end if;
end;
$campaign_seat$;


notify pgrst, 'reload schema';


commit;

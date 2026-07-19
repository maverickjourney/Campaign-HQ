create extension if not exists pgcrypto;

create table if not exists public.campaign_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  category text not null default 'Other',
  uploaded_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists campaign_files_workspace_created_idx
on public.campaign_files (workspace_id, created_at desc);

alter table public.campaign_files enable row level security;
grant select, insert on public.campaign_files to authenticated;

drop policy if exists "Active workspace members can view campaign files"
on public.campaign_files;

create policy "Active workspace members can view campaign files"
on public.campaign_files
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members as member
    where member.workspace_id = campaign_files.workspace_id
      and member.user_id = auth.uid()
      and member.status = 'active'
  )
);

drop policy if exists "Active workspace members can upload campaign files"
on public.campaign_files;

create policy "Active workspace members can upload campaign files"
on public.campaign_files
for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.workspace_members as member
    where member.workspace_id = campaign_files.workspace_id
      and member.user_id = auth.uid()
      and member.status = 'active'
  )
);

insert into storage.buckets (id, name, public, file_size_limit)
values ('campaign-files', 'campaign-files', false, 52428800)
on conflict (id)
do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

drop policy if exists "Active workspace members can read campaign storage"
on storage.objects;

create policy "Active workspace members can read campaign storage"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'campaign-files'
  and exists (
    select 1
    from public.workspace_members as member
    where member.workspace_id::text = split_part(storage.objects.name, '/', 1)
      and member.user_id = auth.uid()
      and member.status = 'active'
  )
);

drop policy if exists "Active workspace members can upload campaign storage"
on storage.objects;

create policy "Active workspace members can upload campaign storage"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'campaign-files'
  and exists (
    select 1
    from public.workspace_members as member
    where member.workspace_id::text = split_part(storage.objects.name, '/', 1)
      and member.user_id = auth.uid()
      and member.status = 'active'
  )
);

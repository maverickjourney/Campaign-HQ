create extension if not exists pgcrypto;

create table if not exists public.campaign_communications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,
  title text not null,
  channel text not null default 'internal'
    check (channel in ('internal', 'email', 'sms', 'social', 'press', 'web')),
  audience text not null default 'Campaign team',
  subject text,
  message_body text not null,
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'scheduled', 'archived')),
  scheduled_at timestamptz,
  created_by uuid not null
    references public.profiles(id)
    on delete restrict,
  updated_by uuid
    references public.profiles(id)
    on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'scheduled' or scheduled_at is not null)
);

drop trigger if exists campaign_communications_set_updated_at
on public.campaign_communications;

create trigger campaign_communications_set_updated_at
before update on public.campaign_communications
for each row
execute function public.set_campaign_updated_at();

create index if not exists campaign_communications_workspace_status_idx
on public.campaign_communications (workspace_id, status, updated_at desc);

alter table public.campaign_communications enable row level security;

drop policy if exists "Members can view campaign communications"
on public.campaign_communications;
create policy "Members can view campaign communications"
on public.campaign_communications
for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Members can create campaign communications"
on public.campaign_communications;
create policy "Members can create campaign communications"
on public.campaign_communications
for insert to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);

drop policy if exists "Admins or creators can update campaign communications"
on public.campaign_communications;
create policy "Admins or creators can update campaign communications"
on public.campaign_communications
for update to authenticated
using (
  public.is_workspace_admin(workspace_id)
  or created_by = (select auth.uid())
)
with check (
  public.is_workspace_member(workspace_id)
  and (
    public.is_workspace_admin(workspace_id)
    or created_by = (select auth.uid())
  )
);

drop policy if exists "Admins or creators can delete campaign communications"
on public.campaign_communications;
create policy "Admins or creators can delete campaign communications"
on public.campaign_communications
for delete to authenticated
using (
  public.is_workspace_admin(workspace_id)
  or created_by = (select auth.uid())
);

grant select, insert, update, delete
on public.campaign_communications
to authenticated;

do $campaign_hq$
begin
  alter publication supabase_realtime
  add table public.campaign_communications;
exception
  when duplicate_object then null;
end
$campaign_hq$;

notify pgrst, 'reload schema';

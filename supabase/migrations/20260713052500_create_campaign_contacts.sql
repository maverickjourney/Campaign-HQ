-- CAMPAIGN HQ — CONTACTS MODULE
begin;

create extension if not exists pgcrypto;

create table if not exists public.campaign_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  organization text,
  contact_type text not null default 'supporter'
    check (contact_type in (
      'supporter','volunteer','donor','vendor','media','endorser',
      'community_leader','elected_official','other'
    )),
  assigned_to uuid references public.profiles(id) on delete set null,
  precinct text,
  source text,
  status text not null default 'active'
    check (status in ('active','follow_up','do_not_contact','inactive')),
  notes text,
  tags text[] not null default '{}'::text[],
  last_contact_at timestamptz,
  next_follow_up_at timestamptz,
  email_consent boolean not null default false,
  email_consent_at timestamptz,
  sms_consent boolean not null default false,
  sms_consent_at timestamptz,
  consent_source text,
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_contacts_name_required
    check (char_length(btrim(full_name)) between 1 and 160)
);

create index if not exists campaign_contacts_workspace_updated_idx
on public.campaign_contacts(workspace_id, updated_at desc);

create index if not exists campaign_contacts_workspace_type_idx
on public.campaign_contacts(workspace_id, contact_type);

create index if not exists campaign_contacts_workspace_status_idx
on public.campaign_contacts(workspace_id, status);

create index if not exists campaign_contacts_workspace_assignee_idx
on public.campaign_contacts(workspace_id, assigned_to);

create index if not exists campaign_contacts_follow_up_idx
on public.campaign_contacts(workspace_id, next_follow_up_at)
where next_follow_up_at is not null;

create index if not exists campaign_contacts_email_lookup_idx
on public.campaign_contacts(workspace_id, lower(btrim(email)))
where email is not null;

create index if not exists campaign_contacts_phone_lookup_idx
on public.campaign_contacts(
  workspace_id,
  regexp_replace(phone, '[^0-9]', '', 'g')
)
where phone is not null;

create index if not exists campaign_contacts_tags_idx
on public.campaign_contacts using gin(tags);

alter table public.campaign_contacts enable row level security;

drop policy if exists "Workspace members can view campaign contacts"
on public.campaign_contacts;

create policy "Workspace members can view campaign contacts"
on public.campaign_contacts
for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can create campaign contacts"
on public.campaign_contacts;

create policy "Workspace members can create campaign contacts"
on public.campaign_contacts
for insert to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and created_by = auth.uid()
);

drop policy if exists "Workspace members can update campaign contacts"
on public.campaign_contacts;

create policy "Workspace members can update campaign contacts"
on public.campaign_contacts
for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (
  public.is_workspace_member(workspace_id)
  and (updated_by is null or updated_by = auth.uid())
);

grant select, insert, update on public.campaign_contacts to authenticated;

create or replace function public.set_campaign_contacts_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  if new.updated_by is null then
    new.updated_by = auth.uid();
  end if;
  return new;
end
$$;

drop trigger if exists set_campaign_contacts_updated_at
on public.campaign_contacts;

create trigger set_campaign_contacts_updated_at
before update on public.campaign_contacts
for each row
execute function public.set_campaign_contacts_updated_at();

create or replace function public.capture_contact_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  kind text;
  activity_title text;
  activity_detail text;
begin
  if tg_op = 'INSERT' then
    kind = 'contact_created';
    activity_title = 'Contact added';
    activity_detail = new.full_name || ' · ' || replace(new.contact_type, '_', ' ');
  elsif new.assigned_to is distinct from old.assigned_to then
    kind = 'contact_assigned';
    activity_title = 'Contact assignment updated';
    activity_detail = new.full_name;
  elsif new.status is distinct from old.status then
    kind = 'contact_status_changed';
    activity_title = 'Contact status updated';
    activity_detail = new.full_name || ' · ' || replace(new.status, '_', ' ');
  elsif new.next_follow_up_at is distinct from old.next_follow_up_at then
    kind = 'contact_follow_up_updated';
    activity_title = 'Contact follow-up updated';
    activity_detail = new.full_name;
  else
    kind = 'contact_updated';
    activity_title = 'Contact updated';
    activity_detail = new.full_name;
  end if;

  insert into public.activity_log (
    workspace_id, actor_user_id, activity_type, title, detail,
    entity_type, entity_id, route, metadata, occurred_at
  )
  values (
    new.workspace_id,
    coalesce(auth.uid(), new.updated_by, new.created_by),
    kind,
    activity_title,
    activity_detail,
    'contact',
    new.id,
    '/contacts',
    jsonb_build_object(
      'table','campaign_contacts',
      'operation',tg_op,
      'contact_type',new.contact_type,
      'status',new.status
    ),
    now()
  );

  return new;
end
$$;

drop trigger if exists capture_contact_activity
on public.campaign_contacts;

create trigger capture_contact_activity
after insert or update on public.campaign_contacts
for each row
execute function public.capture_contact_activity();

do $$
begin
  alter publication supabase_realtime add table public.campaign_contacts;
exception
  when duplicate_object then null;
end
$$;

notify pgrst, 'reload schema';
commit;

select count(*) as campaign_contacts from public.campaign_contacts;

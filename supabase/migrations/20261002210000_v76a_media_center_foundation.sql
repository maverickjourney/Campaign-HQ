
begin;

create table if not exists public.campaign_media_items (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  item_type text not null,

  title text not null,

  summary text,

  body text,

  status text not null
    default 'draft',

  outlet text,

  source_url text,

  due_at timestamptz,

  occurred_at timestamptz,

  published_at timestamptz,

  owner_user_id uuid
    references public.profiles(id)
    on delete set null,

  approval_id uuid
    references public.approvals(id)
    on delete set null,

  metadata jsonb not null
    default '{}'::jsonb,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  updated_by uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint campaign_media_items_type_check
    check (
      item_type = any (
        array[
          'press_release',
          'media_request',
          'talking_point',
          'coverage_mention',
          'briefing',
          'statement',
          'other'
        ]::text[]
      )
    ),

  constraint campaign_media_items_status_check
    check (
      status = any (
        array[
          'draft',
          'review',
          'approved',
          'open',
          'in_progress',
          'responded',
          'closed',
          'published',
          'archived'
        ]::text[]
      )
    ),

  constraint campaign_media_items_title_check
    check (
      char_length(btrim(title)) >= 1
      and char_length(btrim(title)) <= 200
    ),

  constraint campaign_media_items_summary_check
    check (
      summary is null
      or char_length(summary) <= 5000
    ),

  constraint campaign_media_items_body_check
    check (
      body is null
      or char_length(body) <= 50000
    ),

  constraint campaign_media_items_outlet_check
    check (
      outlet is null
      or char_length(btrim(outlet)) <= 200
    ),

  constraint campaign_media_items_source_url_check
    check (
      source_url is null
      or char_length(source_url) <= 2000
    ),

  constraint campaign_media_items_metadata_check
    check (
      jsonb_typeof(metadata) = 'object'
    ),

  constraint campaign_media_items_publish_check
    check (
      status <> 'published'
      or published_at is not null
    )
);


create table if not exists public.campaign_media_item_contacts (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  media_item_id uuid not null
    references public.campaign_media_items(id)
    on delete cascade,

  contact_id uuid not null
    references public.campaign_contacts(id)
    on delete cascade,

  relation_type text not null
    default 'recipient',

  notes text,

  metadata jsonb not null
    default '{}'::jsonb,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  updated_by uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint campaign_media_item_contacts_relation_check
    check (
      relation_type = any (
        array[
          'reporter',
          'requester',
          'recipient',
          'spokesperson',
          'subject',
          'source',
          'other'
        ]::text[]
      )
    ),

  constraint campaign_media_item_contacts_notes_check
    check (
      notes is null
      or char_length(notes) <= 5000
    ),

  constraint campaign_media_item_contacts_metadata_check
    check (
      jsonb_typeof(metadata) = 'object'
    ),

  constraint campaign_media_item_contacts_unique
    unique (
      media_item_id,
      contact_id,
      relation_type
    )
);


create table if not exists public.campaign_media_item_assets (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  media_item_id uuid
    references public.campaign_media_items(id)
    on delete cascade,

  file_id uuid not null
    references public.campaign_files(id)
    on delete cascade,

  asset_role text not null
    default 'attachment',

  status text not null
    default 'draft',

  approval_id uuid
    references public.approvals(id)
    on delete set null,

  sort_order integer not null
    default 0,

  caption text,

  alt_text text,

  metadata jsonb not null
    default '{}'::jsonb,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  updated_by uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint campaign_media_item_assets_role_check
    check (
      asset_role = any (
        array[
          'attachment',
          'press_release',
          'press_photo',
          'logo',
          'brand_asset',
          'briefing',
          'backgrounder',
          'other'
        ]::text[]
      )
    ),

  constraint campaign_media_item_assets_status_check
    check (
      status = any (
        array[
          'draft',
          'review',
          'approved',
          'retired'
        ]::text[]
      )
    ),

  constraint campaign_media_item_assets_sort_check
    check (
      sort_order >= 0
    ),

  constraint campaign_media_item_assets_caption_check
    check (
      caption is null
      or char_length(caption) <= 2000
    ),

  constraint campaign_media_item_assets_alt_text_check
    check (
      alt_text is null
      or char_length(alt_text) <= 2000
    ),

  constraint campaign_media_item_assets_metadata_check
    check (
      jsonb_typeof(metadata) = 'object'
    ),

  constraint campaign_media_item_assets_unique
    unique (
      media_item_id,
      file_id,
      asset_role
    )
);


create index if not exists
  campaign_media_items_workspace_status_idx
on public.campaign_media_items (
  workspace_id,
  status,
  created_at desc
);


create index if not exists
  campaign_media_items_workspace_type_idx
on public.campaign_media_items (
  workspace_id,
  item_type,
  created_at desc
);


create index if not exists
  campaign_media_items_due_idx
on public.campaign_media_items (
  workspace_id,
  due_at
)
where due_at is not null;


create index if not exists
  campaign_media_item_contacts_workspace_idx
on public.campaign_media_item_contacts (
  workspace_id,
  contact_id
);


create index if not exists
  campaign_media_item_contacts_item_idx
on public.campaign_media_item_contacts (
  media_item_id
);


create index if not exists
  campaign_media_item_assets_workspace_status_idx
on public.campaign_media_item_assets (
  workspace_id,
  status,
  created_at desc
);


create index if not exists
  campaign_media_item_assets_item_idx
on public.campaign_media_item_assets (
  media_item_id
)
where media_item_id is not null;


create or replace function private.stamp_media_actor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if tg_op = 'INSERT' then
    if new.created_by is null then
      new.created_by := auth.uid();
    end if;

    if new.updated_by is null then
      new.updated_by := auth.uid();
    end if;
  else
    new.updated_by := auth.uid();
  end if;

  return new;
end;
$function$;


create or replace function private.enforce_media_item_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  approval_workspace uuid;
  approval_type_value text;
begin
  if new.owner_user_id is not null
    and not exists (
      select 1
      from public.workspace_members
      where workspace_id = new.workspace_id
        and user_id = new.owner_user_id
        and status = 'active'
        and membership_state = 'active'
    )
  then
    raise exception
      'Media item owner is not an active member of this workspace';
  end if;

  if new.approval_id is not null then
    select
      workspace_id,
      approval_type
    into
      approval_workspace,
      approval_type_value
    from public.approvals
    where id = new.approval_id;

    if not found
      or approval_workspace is distinct from new.workspace_id
      or approval_type_value <> 'communications'
    then
      raise exception
        'Media item approval must be a communications approval in the same workspace';
    end if;
  end if;

  if (
    new.status in ('published', 'responded')
    and auth.uid() is not null
    and not public.has_campaign_permission(
      new.workspace_id,
      'communications.send'
    )
  ) then
    raise exception
      'communications.send permission is required to publish or mark media responses sent';
  end if;

  return new;
end;
$function$;


create or replace function private.enforce_media_contact_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if not exists (
    select 1
    from public.campaign_media_items
    where id = new.media_item_id
      and workspace_id = new.workspace_id
  ) then
    raise exception
      'Media contact link item does not belong to this workspace';
  end if;

  if not exists (
    select 1
    from public.campaign_contacts
    where id = new.contact_id
      and workspace_id = new.workspace_id
  ) then
    raise exception
      'Media contact does not belong to this workspace';
  end if;

  return new;
end;
$function$;


create or replace function private.enforce_media_asset_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  approval_workspace uuid;
  approval_type_value text;
begin
  if new.media_item_id is not null
    and not exists (
      select 1
      from public.campaign_media_items
      where id = new.media_item_id
        and workspace_id = new.workspace_id
    )
  then
    raise exception
      'Media asset item does not belong to this workspace';
  end if;

  if not exists (
    select 1
    from public.campaign_files
    where id = new.file_id
      and workspace_id = new.workspace_id
  ) then
    raise exception
      'Media asset file does not belong to this workspace';
  end if;

  if new.approval_id is not null then
    select
      workspace_id,
      approval_type
    into
      approval_workspace,
      approval_type_value
    from public.approvals
    where id = new.approval_id;

    if not found
      or approval_workspace is distinct from new.workspace_id
      or approval_type_value <> 'communications'
    then
      raise exception
        'Media asset approval must be a communications approval in the same workspace';
    end if;
  end if;

  return new;
end;
$function$;


drop trigger if exists
  campaign_media_items_set_updated_at
on public.campaign_media_items;

create trigger campaign_media_items_set_updated_at
before update
on public.campaign_media_items
for each row
execute function public.set_campaign_updated_at();


drop trigger if exists
  campaign_media_items_stamp_actor
on public.campaign_media_items;

create trigger campaign_media_items_stamp_actor
before insert or update
on public.campaign_media_items
for each row
execute function private.stamp_media_actor();


drop trigger if exists
  campaign_media_items_integrity
on public.campaign_media_items;

create trigger campaign_media_items_integrity
before insert or update
on public.campaign_media_items
for each row
execute function private.enforce_media_item_integrity();


drop trigger if exists
  audit_campaign_media_items
on public.campaign_media_items;

create trigger audit_campaign_media_items
after insert or update or delete
on public.campaign_media_items
for each row
execute function public.log_campaign_audit_change(
  'media_item'
);


drop trigger if exists
  campaign_media_item_contacts_set_updated_at
on public.campaign_media_item_contacts;

create trigger campaign_media_item_contacts_set_updated_at
before update
on public.campaign_media_item_contacts
for each row
execute function public.set_campaign_updated_at();


drop trigger if exists
  campaign_media_item_contacts_stamp_actor
on public.campaign_media_item_contacts;

create trigger campaign_media_item_contacts_stamp_actor
before insert or update
on public.campaign_media_item_contacts
for each row
execute function private.stamp_media_actor();


drop trigger if exists
  campaign_media_item_contacts_integrity
on public.campaign_media_item_contacts;

create trigger campaign_media_item_contacts_integrity
before insert or update
on public.campaign_media_item_contacts
for each row
execute function private.enforce_media_contact_integrity();


drop trigger if exists
  audit_campaign_media_item_contacts
on public.campaign_media_item_contacts;

create trigger audit_campaign_media_item_contacts
after insert or update or delete
on public.campaign_media_item_contacts
for each row
execute function public.log_campaign_audit_change(
  'media_item_contact'
);


drop trigger if exists
  campaign_media_item_assets_set_updated_at
on public.campaign_media_item_assets;

create trigger campaign_media_item_assets_set_updated_at
before update
on public.campaign_media_item_assets
for each row
execute function public.set_campaign_updated_at();


drop trigger if exists
  campaign_media_item_assets_stamp_actor
on public.campaign_media_item_assets;

create trigger campaign_media_item_assets_stamp_actor
before insert or update
on public.campaign_media_item_assets
for each row
execute function private.stamp_media_actor();


drop trigger if exists
  campaign_media_item_assets_integrity
on public.campaign_media_item_assets;

create trigger campaign_media_item_assets_integrity
before insert or update
on public.campaign_media_item_assets
for each row
execute function private.enforce_media_asset_integrity();


drop trigger if exists
  audit_campaign_media_item_assets
on public.campaign_media_item_assets;

create trigger audit_campaign_media_item_assets
after insert or update or delete
on public.campaign_media_item_assets
for each row
execute function public.log_campaign_audit_change(
  'media_item_asset'
);


alter table public.campaign_media_items
  enable row level security;

alter table public.campaign_media_item_contacts
  enable row level security;

alter table public.campaign_media_item_assets
  enable row level security;


drop policy if exists
  "Communications viewers can view media items"
on public.campaign_media_items;

create policy
  "Communications viewers can view media items"
on public.campaign_media_items
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and public.has_campaign_permission(
    workspace_id,
    'communications.view'
  )
);


drop policy if exists
  "Communications managers can create media items"
on public.campaign_media_items;

create policy
  "Communications managers can create media items"
on public.campaign_media_items
for insert
to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and public.has_campaign_permission(
    workspace_id,
    'communications.manage'
  )
  and created_by = auth.uid()
);


drop policy if exists
  "Communications managers can update media items"
on public.campaign_media_items;

create policy
  "Communications managers can update media items"
on public.campaign_media_items
for update
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and public.has_campaign_permission(
    workspace_id,
    'communications.manage'
  )
)
with check (
  public.is_workspace_member(workspace_id)
  and public.has_campaign_permission(
    workspace_id,
    'communications.manage'
  )
  and (
    updated_by is null
    or updated_by = auth.uid()
  )
);


drop policy if exists
  "Communications viewers can view media contacts"
on public.campaign_media_item_contacts;

create policy
  "Communications viewers can view media contacts"
on public.campaign_media_item_contacts
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and public.has_campaign_permission(
    workspace_id,
    'communications.view'
  )
);


drop policy if exists
  "Communications managers can create media contacts"
on public.campaign_media_item_contacts;

create policy
  "Communications managers can create media contacts"
on public.campaign_media_item_contacts
for insert
to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and public.has_campaign_permission(
    workspace_id,
    'communications.manage'
  )
  and created_by = auth.uid()
);


drop policy if exists
  "Communications managers can update media contacts"
on public.campaign_media_item_contacts;

create policy
  "Communications managers can update media contacts"
on public.campaign_media_item_contacts
for update
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and public.has_campaign_permission(
    workspace_id,
    'communications.manage'
  )
)
with check (
  public.is_workspace_member(workspace_id)
  and public.has_campaign_permission(
    workspace_id,
    'communications.manage'
  )
  and (
    updated_by is null
    or updated_by = auth.uid()
  )
);


drop policy if exists
  "Communications viewers can view media assets"
on public.campaign_media_item_assets;

create policy
  "Communications viewers can view media assets"
on public.campaign_media_item_assets
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and public.has_campaign_permission(
    workspace_id,
    'communications.view'
  )
);


drop policy if exists
  "Communications managers can create media assets"
on public.campaign_media_item_assets;

create policy
  "Communications managers can create media assets"
on public.campaign_media_item_assets
for insert
to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and public.has_campaign_permission(
    workspace_id,
    'communications.manage'
  )
  and created_by = auth.uid()
);


drop policy if exists
  "Communications managers can update media assets"
on public.campaign_media_item_assets;

create policy
  "Communications managers can update media assets"
on public.campaign_media_item_assets
for update
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and public.has_campaign_permission(
    workspace_id,
    'communications.manage'
  )
)
with check (
  public.is_workspace_member(workspace_id)
  and public.has_campaign_permission(
    workspace_id,
    'communications.manage'
  )
  and (
    updated_by is null
    or updated_by = auth.uid()
  )
);


revoke all
on table public.campaign_media_items
from anon;

revoke all
on table public.campaign_media_item_contacts
from anon;

revoke all
on table public.campaign_media_item_assets
from anon;


grant select, insert, update
on table public.campaign_media_items
to authenticated;

grant select, insert, update
on table public.campaign_media_item_contacts
to authenticated;

grant select, insert, update
on table public.campaign_media_item_assets
to authenticated;


revoke delete
on table public.campaign_media_items
from authenticated;

revoke delete
on table public.campaign_media_item_contacts
from authenticated;

revoke delete
on table public.campaign_media_item_assets
from authenticated;


grant all
on table public.campaign_media_items
to service_role;

grant all
on table public.campaign_media_item_contacts
to service_role;

grant all
on table public.campaign_media_item_assets
to service_role;


comment on table public.campaign_media_items is
  'Campaign Seat Media Center operational records including press releases, media requests, talking points, briefings, statements, and coverage mentions.';

comment on table public.campaign_media_item_contacts is
  'Workspace-safe links between Media Center records and Campaign Seat contacts. Media contacts continue to use campaign_contacts with contact_type=media.';

comment on table public.campaign_media_item_assets is
  'Approved and working Media Center assets linked to Campaign Seat files, optionally associated with a specific media record.';

commit;

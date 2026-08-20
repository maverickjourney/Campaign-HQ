-- ============================================================
-- CAMPAIGN SEAT
-- COMMUNICATION ATTACHMENTS
--
-- Reuses:
--   public.campaign_files
--   private campaign-files Storage bucket
--
-- A campaign file may be linked to exactly one communication
-- parent per relationship:
--
--   1. campaign_internal_messages
--      Dashboard / Campaign Seat conversation
--
--   2. campaign_external_outreach
--      Text / WhatsApp external handoff record
--
-- The underlying campaign file remains available to Campaign
-- Seat's Files system. Deleting a relationship does NOT delete
-- the campaign file or Storage object.
-- ============================================================

create extension if not exists pgcrypto;


-- ============================================================
-- COMMUNICATION ATTACHMENT RELATIONSHIPS
-- ============================================================

create table if not exists
public.campaign_communication_attachments (
  id uuid primary key
    default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  file_id uuid not null
    references public.campaign_files(id)
    on delete cascade,

  internal_message_id uuid
    references public.campaign_internal_messages(id)
    on delete cascade,

  external_outreach_id uuid
    references public.campaign_external_outreach(id)
    on delete cascade,

  created_by uuid
    references public.profiles(id)
    on delete set null
    default auth.uid(),

  created_at timestamptz not null
    default now(),

  constraint
    campaign_communication_attachments_one_parent_check
    check (
      num_nonnulls(
        internal_message_id,
        external_outreach_id
      ) = 1
    )
);


create index if not exists
campaign_communication_attachments_workspace_idx
on public.campaign_communication_attachments (
  workspace_id,
  created_at desc
);


create index if not exists
campaign_communication_attachments_file_idx
on public.campaign_communication_attachments (
  file_id
);


create index if not exists
campaign_communication_attachments_internal_message_idx
on public.campaign_communication_attachments (
  internal_message_id,
  created_at asc
)
where internal_message_id is not null;


create index if not exists
campaign_communication_attachments_external_outreach_idx
on public.campaign_communication_attachments (
  external_outreach_id,
  created_at asc
)
where external_outreach_id is not null;


create unique index if not exists
campaign_communication_attachments_internal_file_unique
on public.campaign_communication_attachments (
  internal_message_id,
  file_id
)
where internal_message_id is not null;


create unique index if not exists
campaign_communication_attachments_external_file_unique
on public.campaign_communication_attachments (
  external_outreach_id,
  file_id
)
where external_outreach_id is not null;


-- ============================================================
-- VALIDATION / IMMUTABILITY
--
-- Prevent:
--   * cross-workspace file attachment
--   * cross-workspace communication attachment
--   * spoofed workspace_id
--   * spoofed created_by
--   * reassignment after creation
-- ============================================================

create or replace function
public.validate_campaign_communication_attachment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  file_workspace_id uuid;
  parent_workspace_id uuid;
begin
  if
    tg_op = 'UPDATE'
    and (
      new.workspace_id
        is distinct from old.workspace_id
      or new.file_id
        is distinct from old.file_id
      or new.internal_message_id
        is distinct from old.internal_message_id
      or new.external_outreach_id
        is distinct from old.external_outreach_id
      or new.created_by
        is distinct from old.created_by
    )
  then
    raise exception
      'A communication attachment relationship cannot be reassigned.'
      using errcode = '22023';
  end if;


  if
    num_nonnulls(
      new.internal_message_id,
      new.external_outreach_id
    ) <> 1
  then
    raise exception
      'A communication attachment must belong to exactly one message or outreach record.'
      using errcode = '22023';
  end if;


  select
    campaign_file.workspace_id
  into
    file_workspace_id
  from public.campaign_files
    as campaign_file
  where campaign_file.id =
    new.file_id;


  if file_workspace_id is null then
    raise exception
      'The campaign file does not exist.'
      using errcode = '23503';
  end if;


  if new.internal_message_id is not null then
    select
      internal_message.workspace_id
    into
      parent_workspace_id
    from public.campaign_internal_messages
      as internal_message
    where internal_message.id =
      new.internal_message_id;
  else
    select
      outreach.workspace_id
    into
      parent_workspace_id
    from public.campaign_external_outreach
      as outreach
    where outreach.id =
      new.external_outreach_id;
  end if;


  if parent_workspace_id is null then
    raise exception
      'The communication parent record does not exist.'
      using errcode = '23503';
  end if;


  if
    new.workspace_id <> file_workspace_id
    or new.workspace_id <> parent_workspace_id
  then
    raise exception
      'Communication attachments must remain inside one campaign workspace.'
      using errcode = '22023';
  end if;


  if tg_op = 'INSERT' then
    new.created_by :=
      auth.uid();
  end if;


  return new;
end;
$function$;


revoke all
on function
public.validate_campaign_communication_attachment()
from public;

revoke all
on function
public.validate_campaign_communication_attachment()
from anon;

revoke all
on function
public.validate_campaign_communication_attachment()
from authenticated;


drop trigger if exists
validate_campaign_communication_attachment_trigger
on public.campaign_communication_attachments;


create trigger
validate_campaign_communication_attachment_trigger
before insert or update
on public.campaign_communication_attachments
for each row
execute function
public.validate_campaign_communication_attachment();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table
public.campaign_communication_attachments
enable row level security;


grant
  select,
  insert,
  delete
on public.campaign_communication_attachments
to authenticated;


-- ------------------------------------------------------------
-- SELECT
--
-- Communication attachments follow Communications visibility.
-- The campaign_files record and Storage object continue to
-- enforce their own workspace security as well.
-- ------------------------------------------------------------

drop policy if exists
"Authorized members can view communication attachments"
on public.campaign_communication_attachments;


create policy
"Authorized members can view communication attachments"
on public.campaign_communication_attachments
for select
to authenticated
using (
  (
    public.is_workspace_leadership(
      workspace_id
    )
    or
    public.has_campaign_permission(
      workspace_id,
      'communications.view'
    )
  )

  and exists (
    select 1
    from public.campaign_files
      as campaign_file
    where campaign_file.id =
      campaign_communication_attachments.file_id
      and campaign_file.workspace_id =
        campaign_communication_attachments.workspace_id
  )

  and (
    (
      internal_message_id is not null
      and exists (
        select 1
        from public.campaign_internal_messages
          as internal_message
        where internal_message.id =
          campaign_communication_attachments.internal_message_id
          and internal_message.workspace_id =
            campaign_communication_attachments.workspace_id
      )
    )

    or

    (
      external_outreach_id is not null
      and exists (
        select 1
        from public.campaign_external_outreach
          as outreach
        where outreach.id =
          campaign_communication_attachments.external_outreach_id
          and outreach.workspace_id =
            campaign_communication_attachments.workspace_id
      )
    )
  )
);


-- ------------------------------------------------------------
-- INSERT — INTERNAL DASHBOARD MESSAGE
--
-- Mirrors the current internal-message creation permission:
-- leadership OR communications.view.
-- ------------------------------------------------------------

drop policy if exists
"Authorized members can attach files to internal messages"
on public.campaign_communication_attachments;


create policy
"Authorized members can attach files to internal messages"
on public.campaign_communication_attachments
for insert
to authenticated
with check (
  created_by = auth.uid()

  and internal_message_id is not null

  and external_outreach_id is null

  and (
    public.is_workspace_leadership(
      workspace_id
    )
    or
    public.has_campaign_permission(
      workspace_id,
      'communications.view'
    )
  )

  and exists (
    select 1
    from public.campaign_internal_messages
      as internal_message
    where internal_message.id =
      campaign_communication_attachments.internal_message_id
      and internal_message.workspace_id =
        campaign_communication_attachments.workspace_id
  )

  and exists (
    select 1
    from public.campaign_files
      as campaign_file
    where campaign_file.id =
      campaign_communication_attachments.file_id
      and campaign_file.workspace_id =
        campaign_communication_attachments.workspace_id
  )
);


-- ------------------------------------------------------------
-- INSERT — TEXT / WHATSAPP EXTERNAL HANDOFF
--
-- Mirrors campaign_external_outreach creation permission:
-- leadership OR communications.manage.
-- ------------------------------------------------------------

drop policy if exists
"Authorized members can attach files to external outreach"
on public.campaign_communication_attachments;


create policy
"Authorized members can attach files to external outreach"
on public.campaign_communication_attachments
for insert
to authenticated
with check (
  created_by = auth.uid()

  and external_outreach_id is not null

  and internal_message_id is null

  and (
    public.is_workspace_leadership(
      workspace_id
    )
    or
    public.has_campaign_permission(
      workspace_id,
      'communications.manage'
    )
  )

  and exists (
    select 1
    from public.campaign_external_outreach
      as outreach
    where outreach.id =
      campaign_communication_attachments.external_outreach_id
      and outreach.workspace_id =
        campaign_communication_attachments.workspace_id
  )

  and exists (
    select 1
    from public.campaign_files
      as campaign_file
    where campaign_file.id =
      campaign_communication_attachments.file_id
      and campaign_file.workspace_id =
        campaign_communication_attachments.workspace_id
  )
);


-- ------------------------------------------------------------
-- DELETE / UNLINK
--
-- Unlink only. Does not delete campaign_files or Storage.
-- ------------------------------------------------------------

drop policy if exists
"Authorized members can unlink communication attachments"
on public.campaign_communication_attachments;


create policy
"Authorized members can unlink communication attachments"
on public.campaign_communication_attachments
for delete
to authenticated
using (
  public.is_workspace_leadership(
    workspace_id
  )
  or
  public.has_campaign_permission(
    workspace_id,
    'communications.manage'
  )
);


-- ============================================================
-- INTERNAL MESSAGE RPC RETURN IDS
--
-- Existing functions already atomically create the message.
-- We preserve their signatures and permissions, but include
-- messageId in their JSON result so the frontend can link
-- uploaded campaign files to the exact message safely.
-- ============================================================

create or replace function
public.create_internal_inbox_thread(
  target_workspace_id uuid,
  target_contact_id uuid,
  target_subject text,
  target_body text
)
returns jsonb
language plpgsql
security definer
set search_path to
  'public',
  'pg_temp'
as $function$
declare
  actor_user_id uuid := auth.uid();
  created_thread_id uuid;
  created_message_id uuid;
  normalized_subject text := btrim(coalesce(target_subject, ''));
  normalized_body text := btrim(coalesce(target_body, ''));
begin
  if actor_user_id is null then
    raise exception
      'A signed-in Campaign Seat user is required.'
      using errcode = '42501';
  end if;

  if not (
    public.is_workspace_leadership(target_workspace_id)
    or
    public.has_campaign_permission(
      target_workspace_id,
      'communications.view'
    )
  ) then
    raise exception
      'You do not have permission to create internal Campaign Seat conversations.'
      using errcode = '42501';
  end if;

  if normalized_subject = ''
    or length(normalized_subject) > 500
  then
    raise exception
      'Enter a valid internal conversation subject.'
      using errcode = '22023';
  end if;

  if normalized_body = ''
    or length(normalized_body) > 200000
  then
    raise exception
      'Enter a valid internal conversation message.'
      using errcode = '22023';
  end if;

  if target_contact_id is not null
    and not exists (
      select 1
      from public.campaign_contacts as contact
      where contact.id = target_contact_id
        and contact.workspace_id = target_workspace_id
    )
  then
    raise exception
      'The selected campaign contact does not belong to this workspace.'
      using errcode = '22023';
  end if;

  insert into public.campaign_internal_threads (
    workspace_id,
    contact_id,
    subject,
    status,
    created_by
  )
  values (
    target_workspace_id,
    target_contact_id,
    normalized_subject,
    'open',
    actor_user_id
  )
  returning id
  into created_thread_id;

  insert into public.campaign_internal_messages (
    workspace_id,
    thread_id,
    message_kind,
    body,
    created_by
  )
  values (
    target_workspace_id,
    created_thread_id,
    'message',
    normalized_body,
    actor_user_id
  )
  returning id
  into created_message_id;

  return jsonb_build_object(
    'success',
    true,
    'threadId',
    created_thread_id,
    'messageId',
    created_message_id
  );
end;
$function$;


create or replace function
public.add_internal_inbox_message(
  target_workspace_id uuid,
  target_thread_id uuid,
  target_body text
)
returns jsonb
language plpgsql
security definer
set search_path to
  'public',
  'pg_temp'
as $function$
declare
  actor_user_id uuid := auth.uid();
  normalized_body text := btrim(coalesce(target_body, ''));
  thread_status text;
  created_message_id uuid;
begin
  if actor_user_id is null then
    raise exception
      'A signed-in Campaign Seat user is required.'
      using errcode = '42501';
  end if;

  if not (
    public.is_workspace_leadership(target_workspace_id)
    or
    public.has_campaign_permission(
      target_workspace_id,
      'communications.view'
    )
  ) then
    raise exception
      'You do not have permission to reply to internal Campaign Seat conversations.'
      using errcode = '42501';
  end if;

  if normalized_body = ''
    or length(normalized_body) > 200000
  then
    raise exception
      'Enter a valid internal conversation message.'
      using errcode = '22023';
  end if;

  select
    thread.status
  into
    thread_status
  from public.campaign_internal_threads
    as thread
  where thread.id =
    target_thread_id
    and thread.workspace_id =
      target_workspace_id
  for update;

  if thread_status is null then
    raise exception
      'The internal Campaign Seat conversation could not be found.'
      using errcode = 'P0002';
  end if;

  if thread_status = 'archived' then
    raise exception
      'Archived Campaign Seat conversations cannot receive new replies.'
      using errcode = '22023';
  end if;

  insert into public.campaign_internal_messages (
    workspace_id,
    thread_id,
    message_kind,
    body,
    created_by
  )
  values (
    target_workspace_id,
    target_thread_id,
    'message',
    normalized_body,
    actor_user_id
  )
  returning id
  into created_message_id;

  update public.campaign_internal_threads
  set
    status =
      case
        when status = 'resolved'
        then 'open'
        else status
      end,
    updated_at = now()
  where id =
    target_thread_id
    and workspace_id =
      target_workspace_id;

  return jsonb_build_object(
    'success',
    true,
    'threadId',
    target_thread_id,
    'messageId',
    created_message_id
  );
end;
$function$;


-- Preserve the existing execution contract.

revoke all
on function public.create_internal_inbox_thread(
  uuid,
  uuid,
  text,
  text
)
from public;

revoke all
on function public.create_internal_inbox_thread(
  uuid,
  uuid,
  text,
  text
)
from anon;

grant execute
on function public.create_internal_inbox_thread(
  uuid,
  uuid,
  text,
  text
)
to authenticated;


revoke all
on function public.add_internal_inbox_message(
  uuid,
  uuid,
  text
)
from public;

revoke all
on function public.add_internal_inbox_message(
  uuid,
  uuid,
  text
)
from anon;

grant execute
on function public.add_internal_inbox_message(
  uuid,
  uuid,
  text
)
to authenticated;

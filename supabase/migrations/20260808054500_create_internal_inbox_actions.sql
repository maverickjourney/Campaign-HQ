-- Campaign Seat
-- Internal Inbox atomic actions.
--
-- These functions back the Campaign Seat internal channel.
-- They do not interact with Nylas.

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
  returning id into created_thread_id;

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
  );

  return jsonb_build_object(
    'success',
    true,
    'threadId',
    created_thread_id
  );
end;
$function$;

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

  select thread.status
  into thread_status
  from public.campaign_internal_threads as thread
  where thread.id = target_thread_id
    and thread.workspace_id = target_workspace_id
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
  );

  update public.campaign_internal_threads
  set
    status =
      case
        when status = 'resolved'
        then 'open'
        else status
      end,
    updated_at = now()
  where id = target_thread_id
    and workspace_id = target_workspace_id;

  return jsonb_build_object(
    'success',
    true,
    'threadId',
    target_thread_id
  );
end;
$function$;

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

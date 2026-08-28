create unique index if not exists activity_log_email_provider_event_unique
on public.activity_log (
  workspace_id,
  ((metadata ->> 'provider_event_id'))
)
where activity_type = 'email_received'
  and metadata ? 'provider_event_id'
  and btrim(coalesce(metadata ->> 'provider_event_id', '')) <> '';

create or replace function private.log_workspace_email_activity()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  mailbox_event_type text := btrim(
    coalesce(
      new.settings ->> 'last_mailbox_event_type',
      ''
    )
  );

  mailbox_event_id text := btrim(
    coalesce(
      new.settings ->> 'last_mailbox_event_id',
      ''
    )
  );

  previous_event_id text := btrim(
    coalesce(
      old.settings ->> 'last_mailbox_event_id',
      ''
    )
  );
begin
  if new.integration_type <> 'email'
     or new.provider <> 'nylas'
  then
    return new;
  end if;

  if mailbox_event_type not in (
    'message.created',
    'message.created.truncated',
    'message.created.transformed'
  )
  then
    return new;
  end if;

  if mailbox_event_id = ''
     or mailbox_event_id = previous_event_id
  then
    return new;
  end if;

  insert into public.activity_log (
    workspace_id,
    actor_user_id,
    activity_type,
    title,
    detail,
    entity_type,
    entity_id,
    route,
    metadata,
    occurred_at
  )
  values (
    new.workspace_id,
    null,
    'email_received',
    'New campaign email',
    'A new email arrived in the connected campaign inbox.',
    'communication',
    null,
    '/inbox',
    jsonb_build_object(
      'provider', 'nylas',
      'provider_event_id', mailbox_event_id,
      'provider_event_type', mailbox_event_type,
      'integration_id', new.id
    ),
    now()
  )
  on conflict do nothing;

  return new;
end;
$$;

revoke all
on function private.log_workspace_email_activity()
from public, anon, authenticated;

grant execute
on function private.log_workspace_email_activity()
to postgres, service_role;

drop trigger if exists workspace_email_activity_log_trigger
on public.workspace_integrations;

create trigger workspace_email_activity_log_trigger
after update of settings
on public.workspace_integrations
for each row
execute function private.log_workspace_email_activity();

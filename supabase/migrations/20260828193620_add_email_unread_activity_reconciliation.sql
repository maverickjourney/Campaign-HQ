create or replace function public.reconcile_email_unread_activity(
  target_workspace_id uuid,
  target_unread_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  resolved_integration_id uuid;
  previous_unread_count integer;
  unread_delta integer;
  created_activity_id uuid;
begin
  if auth.uid() is null then
    raise exception
      'A signed-in Campaign Seat session is required.'
      using errcode = '42501';
  end if;

  if target_workspace_id is null then
    raise exception
      'A Campaign Seat workspace is required.'
      using errcode = '22023';
  end if;

  if target_unread_count is null
     or target_unread_count < 0
     or target_unread_count > 100000
  then
    raise exception
      'A valid unread count is required.'
      using errcode = '22023';
  end if;

  if public.can_view_connected_email(
       target_workspace_id
     ) is not true
  then
    raise exception
      'You do not have permission to view this campaign mailbox.'
      using errcode = '42501';
  end if;

  select
    integration.id,

    case
      when coalesce(
        integration.settings
          ->> 'last_reconciled_inbox_unread_count',
        ''
      ) ~ '^[0-9]+$'
      then (
        integration.settings
          ->> 'last_reconciled_inbox_unread_count'
      )::integer

      else null
    end

  into
    resolved_integration_id,
    previous_unread_count

  from public.workspace_integrations
    as integration

  where
    integration.workspace_id =
      target_workspace_id

    and integration.integration_type =
      'email'

    and integration.provider =
      'nylas'

  order by
    integration.connected_at desc
      nulls last,
    integration.created_at desc

  limit 1

  for update;

  if resolved_integration_id is null then
    raise exception
      'No connected campaign mailbox was found.'
      using errcode = 'P0002';
  end if;

  update public.workspace_integrations
    as integration

  set
    settings =
      coalesce(
        integration.settings,
        '{}'::jsonb
      )
      ||
      jsonb_build_object(
        'last_reconciled_inbox_unread_count',
        target_unread_count,

        'last_reconciled_inbox_unread_at',
        now()
      ),

    updated_at =
      now()

  where
    integration.id =
      resolved_integration_id;

  if previous_unread_count is null then
    return jsonb_build_object(
      'success',
      true,

      'baseline',
      true,

      'notified',
      false,

      'unreadCount',
      target_unread_count
    );
  end if;

  if target_unread_count <=
     previous_unread_count
  then
    return jsonb_build_object(
      'success',
      true,

      'baseline',
      false,

      'notified',
      false,

      'unreadCount',
      target_unread_count,

      'previousUnreadCount',
      previous_unread_count
    );
  end if;

  unread_delta =
    target_unread_count -
    previous_unread_count;

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
    target_workspace_id,
    null,
    'email_received',

    case
      when unread_delta = 1
        then 'New campaign email'

      else
        unread_delta::text ||
        ' new campaign emails'
    end,

    case
      when unread_delta = 1
        then
          'A new email arrived in the connected campaign inbox.'

      else
        unread_delta::text ||
        ' new emails arrived in the connected campaign inbox.'
    end,

    'communication',
    null,
    '/inbox',

    jsonb_build_object(
      'source',
      'mailbox_reconciliation',

      'previous_unread_count',
      previous_unread_count,

      'unread_count',
      target_unread_count,

      'unread_delta',
      unread_delta,

      'reconciled_at',
      now()
    ),

    now()
  )

  returning id
  into created_activity_id;

  return jsonb_build_object(
    'success',
    true,

    'baseline',
    false,

    'notified',
    true,

    'activityId',
    created_activity_id,

    'unreadCount',
    target_unread_count,

    'previousUnreadCount',
    previous_unread_count,

    'delta',
    unread_delta
  );
end;
$$;

revoke all
on function public.reconcile_email_unread_activity(
  uuid,
  integer
)
from public, anon;

grant execute
on function public.reconcile_email_unread_activity(
  uuid,
  integer
)
to authenticated, service_role;

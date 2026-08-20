-- Campaign Seat
-- Real Communications runtime.
--
-- Responsibilities:
--   * internal Campaign Seat conversations
--   * internal thread messages
--   * external Text / WhatsApp / Call accountability
--   * connected-email view/send authorization
--   * server-only email-send capability activation
--   * Communications completion requires verified send
--
-- This migration does NOT store mailbox bodies.
-- Nylas remains the source for Gmail / Microsoft mailbox data.

-- ============================================================
-- INTERNAL CAMPAIGN SEAT THREADS
-- ============================================================

create table
public.campaign_internal_threads (
  id uuid primary key
    default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  contact_id uuid
    references public.campaign_contacts(id)
    on delete set null,

  subject text not null,

  status text not null
    default 'open',

  assigned_to uuid
    references public.profiles(id)
    on delete set null,

  created_by uuid not null
    references public.profiles(id)
    on delete restrict,

  resolved_by uuid
    references public.profiles(id)
    on delete set null,

  resolved_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint
    campaign_internal_threads_subject_check
    check (
      btrim(subject) <> ''
    ),

  constraint
    campaign_internal_threads_status_check
    check (
      status in (
        'open',
        'waiting',
        'resolved',
        'archived'
      )
    )
);

create index
campaign_internal_threads_workspace_status_idx
on public.campaign_internal_threads (
  workspace_id,
  status,
  updated_at desc
);

alter table
public.campaign_internal_threads
enable row level security;

create policy
"Authorized members can view internal threads"
on public.campaign_internal_threads
for select
to authenticated
using (
  public.is_workspace_leadership(
    workspace_id
  )
  or
  public.has_campaign_permission(
    workspace_id,
    'communications.view'
  )
);

create policy
"Authorized members can create internal threads"
on public.campaign_internal_threads
for insert
to authenticated
with check (
  created_by = auth.uid()
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
);

create policy
"Authorized members can update internal threads"
on public.campaign_internal_threads
for update
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
)
with check (
  public.is_workspace_leadership(
    workspace_id
  )
  or
  public.has_campaign_permission(
    workspace_id,
    'communications.manage'
  )
);

create policy
"Authorized members can delete internal threads"
on public.campaign_internal_threads
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
-- INTERNAL THREAD MESSAGES
-- ============================================================

create table
public.campaign_internal_messages (
  id uuid primary key
    default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  thread_id uuid not null
    references public.campaign_internal_threads(id)
    on delete cascade,

  message_kind text not null
    default 'message',

  body text not null,

  created_by uuid not null
    references public.profiles(id)
    on delete restrict,

  created_at timestamptz not null
    default now(),

  constraint
    campaign_internal_messages_kind_check
    check (
      message_kind in (
        'message',
        'internal_note',
        'status'
      )
    ),

  constraint
    campaign_internal_messages_body_check
    check (
      btrim(body) <> ''
    )
);

create index
campaign_internal_messages_thread_created_idx
on public.campaign_internal_messages (
  thread_id,
  created_at asc
);

alter table
public.campaign_internal_messages
enable row level security;

create policy
"Authorized members can view internal messages"
on public.campaign_internal_messages
for select
to authenticated
using (
  public.is_workspace_leadership(
    workspace_id
  )
  or
  public.has_campaign_permission(
    workspace_id,
    'communications.view'
  )
);

create policy
"Authorized members can create internal messages"
on public.campaign_internal_messages
for insert
to authenticated
with check (
  created_by = auth.uid()
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
);

create policy
"Authorized members can delete internal messages"
on public.campaign_internal_messages
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
-- EXTERNAL HANDOFF / OUTREACH ACCOUNTABILITY
-- ============================================================

create table
public.campaign_external_outreach (
  id uuid primary key
    default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  contact_id uuid
    references public.campaign_contacts(id)
    on delete set null,

  channel text not null,

  message_body text,

  status text not null
    default 'prepared',

  outcome text,

  notes text,

  next_follow_up_at timestamptz,

  opened_at timestamptz,

  confirmed_sent_at timestamptz,

  response_recorded_at timestamptz,

  resolved_at timestamptz,

  created_by uuid not null
    references public.profiles(id)
    on delete restrict,

  updated_by uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint
    campaign_external_outreach_channel_check
    check (
      channel in (
        'text',
        'whatsapp',
        'call'
      )
    ),

  constraint
    campaign_external_outreach_status_check
    check (
      status in (
        'prepared',
        'opened',
        'confirmed_sent',
        'waiting_for_response',
        'response_received',
        'follow_up',
        'resolved'
      )
    )
);

create index
campaign_external_outreach_workspace_follow_up_idx
on public.campaign_external_outreach (
  workspace_id,
  status,
  next_follow_up_at
);

alter table
public.campaign_external_outreach
enable row level security;

create policy
"Authorized members can view external outreach"
on public.campaign_external_outreach
for select
to authenticated
using (
  public.is_workspace_leadership(
    workspace_id
  )
  or
  public.has_campaign_permission(
    workspace_id,
    'communications.view'
  )
);

create policy
"Authorized members can create external outreach"
on public.campaign_external_outreach
for insert
to authenticated
with check (
  created_by = auth.uid()
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
);

create policy
"Authorized members can update external outreach"
on public.campaign_external_outreach
for update
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
)
with check (
  public.is_workspace_leadership(
    workspace_id
  )
  or
  public.has_campaign_permission(
    workspace_id,
    'communications.manage'
  )
);

create policy
"Authorized members can delete external outreach"
on public.campaign_external_outreach
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
-- CONNECTED EMAIL PERMISSION HELPERS
-- ============================================================

create or replace function
public.can_view_connected_email(
  target_workspace_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to
  'public',
  'pg_temp'
as $function$
  select
    auth.uid() is not null
    and (
      public.is_workspace_leadership(
        target_workspace_id
      )
      or
      public.has_campaign_permission(
        target_workspace_id,
        'communications.view'
      )
    );
$function$;

revoke all
on function
public.can_view_connected_email(uuid)
from public;

revoke all
on function
public.can_view_connected_email(uuid)
from anon;

grant execute
on function
public.can_view_connected_email(uuid)
to authenticated;


create or replace function
public.can_send_connected_email(
  target_workspace_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to
  'public',
  'pg_temp'
as $function$
  select
    auth.uid() is not null
    and (
      public.is_workspace_leadership(
        target_workspace_id
      )
      or
      public.has_campaign_permission(
        target_workspace_id,
        'communications.manage'
      )
    );
$function$;

revoke all
on function
public.can_send_connected_email(uuid)
from public;

revoke all
on function
public.can_send_connected_email(uuid)
from anon;

grant execute
on function
public.can_send_connected_email(uuid)
to authenticated;


-- ============================================================
-- SERVER-ONLY SEND CAPABILITY ACTIVATION
--
-- Called only after OAuth exchange succeeds and the Edge
-- Function verifies the grant carries the expected send scope.
-- ============================================================

create or replace function
public.activate_email_send_capability(
  target_workspace_id uuid,
  target_provider_grant_id text,
  target_provider text,
  target_scope text
)
returns jsonb
language plpgsql
security definer
set search_path to
  'public',
  'private',
  'pg_temp'
as $function$
declare
  target_integration_id uuid;
  normalized_scope text :=
    lower(
      coalesce(
        target_scope,
        ''
      )
    );

  scope_verified boolean :=
    false;
begin
  if target_provider not in (
    'google',
    'microsoft'
  ) then
    raise exception
      'The connected email provider is invalid.'
      using errcode = '22023';
  end if;

  if target_provider_grant_id is null
    or btrim(
      target_provider_grant_id
    ) = ''
  then
    raise exception
      'A verified Nylas grant is required.'
      using errcode = '22023';
  end if;

  if target_provider = 'google' then
    scope_verified =
      position(
        'gmail.send'
        in normalized_scope
      ) > 0;
  else
    scope_verified =
      position(
        'mail.send'
        in normalized_scope
      ) > 0
      and
      position(
        'mail.readwrite'
        in normalized_scope
      ) > 0;
  end if;

  if not scope_verified then
    raise exception
      'The connected mailbox does not include the required send permissions.'
      using errcode = '42501';
  end if;

  select
    integration.id
  into
    target_integration_id
  from public.workspace_integrations
    as integration
  join private.workspace_integration_credentials
    as credential
    on credential.integration_id =
      integration.id
  where
    integration.workspace_id =
      target_workspace_id

    and integration.provider =
      'nylas'

    and integration.integration_type =
      'email'

    and integration.status =
      'connected'

    and credential.provider_grant_id =
      target_provider_grant_id

  order by
    integration.connected_at desc
    nulls last

  limit 1;

  if target_integration_id is null then
    raise exception
      'The connected Campaign Seat mailbox could not be found.';
  end if;

  update
  public.workspace_integrations
  set
    capabilities =
      coalesce(
        capabilities,
        '{}'::jsonb
      )
      ||
      jsonb_build_object(
        'read',
        true,
        'send',
        true,
        'reply',
        true,
        'idempotent_send',
        true
      ),

    settings =
      coalesce(
        settings,
        '{}'::jsonb
      )
      ||
      jsonb_build_object(
        'send_scope_verified',
        true
      ),

    last_success_at =
      now(),

    updated_at =
      now()

  where id =
    target_integration_id;

  return jsonb_build_object(
    'success',
    true,
    'sendVerified',
    true
  );
end;
$function$;

revoke all
on function
public.activate_email_send_capability(
  uuid,
  text,
  text,
  text
)
from public;

revoke all
on function
public.activate_email_send_capability(
  uuid,
  text,
  text,
  text
)
from anon;

revoke all
on function
public.activate_email_send_capability(
  uuid,
  text,
  text,
  text
)
from authenticated;

grant execute
on function
public.activate_email_send_capability(
  uuid,
  text,
  text,
  text
)
to service_role;


-- ============================================================
-- COMMUNICATIONS COMPLETION GUARD
--
-- The existing completion RPC remains authoritative, but
-- Communications cannot transition to complete unless the
-- real mailbox supports BOTH read and send/reply.
-- ============================================================

create or replace function
public.guard_real_communications_completion()
returns trigger
language plpgsql
security definer
set search_path to
  'public',
  'pg_temp'
as $function$
begin
  if
    new.step_key = 'communications'
    and new.status = 'complete'
    and old.status is distinct from 'complete'
  then
    if not exists (
      select 1
      from public.workspace_integrations
        as email_connection
      join public.workspace_integrations
        as contacts_connection
        on contacts_connection.workspace_id =
          email_connection.workspace_id

        and contacts_connection.provider =
          'nylas'

        and contacts_connection.integration_type =
          'contacts'

        and contacts_connection.connection_key =
          email_connection.connection_key

        and contacts_connection.status =
          'connected'

      where
        email_connection.workspace_id =
          new.workspace_id

        and email_connection.provider =
          'nylas'

        and email_connection.integration_type =
          'email'

        and email_connection.status =
          'connected'

        and coalesce(
          (
            email_connection.capabilities
              ->> 'read'
          )::boolean,
          false
        )

        and coalesce(
          (
            email_connection.capabilities
              ->> 'send'
          )::boolean,
          false
        )

        and coalesce(
          (
            email_connection.capabilities
              ->> 'reply'
          )::boolean,
          false
        )

        and coalesce(
          (
            contacts_connection.capabilities
              ->> 'read'
          )::boolean,
          false
        )
    ) then
      raise exception
        'A verified read/send campaign mailbox and provider-contact connection are required before Email & Contacts can be completed.';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists
guard_real_communications_completion_trigger
on public.workspace_onboarding_steps;

create trigger
guard_real_communications_completion_trigger
before update
on public.workspace_onboarding_steps
for each row
execute function
public.guard_real_communications_completion();

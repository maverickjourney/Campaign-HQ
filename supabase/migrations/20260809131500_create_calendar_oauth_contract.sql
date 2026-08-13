-- ============================================================
-- CAMPAIGN SEAT
-- CALENDAR OAUTH STATE CONTRACT
--
-- Calendar authorization is intentionally separate from
-- Email & Contacts authorization.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Allow the private OAuth state store to identify
--    Calendar authorization sessions separately.
-- ------------------------------------------------------------

alter table
  private.workspace_oauth_states
drop constraint if exists
  workspace_oauth_states_family_check;

alter table
  private.workspace_oauth_states
add constraint
  workspace_oauth_states_family_check
check (
  integration_family in (
    'email_contacts',
    'calendar'
  )
);


-- ------------------------------------------------------------
-- 2. BEGIN CALENDAR OAUTH
--
-- Authenticated + AAL2.
-- Requires the workspace to currently be on Calendar onboarding.
-- Finds the already-connected campaign mailbox so the Nylas
-- authorization can re-authenticate that same account.
-- ------------------------------------------------------------

create or replace function
public.begin_calendar_oauth(
  target_workspace_id uuid
)
returns table (
  oauth_state text,
  oauth_expires_at timestamptz,
  connected_email text,
  account_provider text
)
language plpgsql
security definer
set search_path to
  'public',
  'private',
  'extensions',
  'pg_temp'
as $function$
declare
  current_actor_user_id uuid :=
    auth.uid();

  raw_state text :=
    encode(
      gen_random_bytes(32),
      'hex'
    );

  placeholder_verifier text :=
    encode(
      gen_random_bytes(48),
      'hex'
    );

  expiry timestamptz :=
    now() +
    interval '10 minutes';

  resolved_email text;
  resolved_provider text;
begin
  perform public.require_aal2();


  if current_actor_user_id is null then
    raise exception
      'A signed-in Campaign Seat session is required.'
      using errcode = '42501';
  end if;


  if not exists (
    select 1
    from public.workspace_members
      as member
    where
      member.workspace_id =
        target_workspace_id

      and member.user_id =
        current_actor_user_id

      and member.status =
        'active'

      and member.membership_state =
        'active'

      and member.dashboard_type in (
        'command',
        'candidate'
      )
  ) then
    raise exception
      'Active campaign leadership access is required.'
      using errcode = '42501';
  end if;


  if not exists (
    select 1
    from public.workspaces
      as workspace
    where
      workspace.id =
        target_workspace_id

      and workspace.onboarding_status =
        'active'

      and workspace.onboarding_current_step =
        'calendar'
  ) then
    raise exception
      'Calendar is not the current onboarding phase.';
  end if;


  if not exists (
    select 1
    from public.workspace_onboarding_steps
      as onboarding_step
    where
      onboarding_step.workspace_id =
        target_workspace_id

      and onboarding_step.step_key =
        'calendar'

      and onboarding_step.status =
        'in_progress'
  ) then
    raise exception
      'Calendar onboarding must be in progress.';
  end if;


  select
    email_connection.display_email,

    email_connection.settings
      ->> 'account_provider'

  into
    resolved_email,
    resolved_provider

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
      target_workspace_id

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

    and lower(
      coalesce(
        email_connection.settings
          ->> 'account_provider',
        ''
      )
    ) in (
      'google',
      'microsoft'
    )

  order by
    email_connection.connected_at desc
    nulls last

  limit 1;


  resolved_email :=
    lower(
      btrim(
        coalesce(
          resolved_email,
          ''
        )
      )
    );

  resolved_provider :=
    lower(
      btrim(
        coalesce(
          resolved_provider,
          ''
        )
      )
    );


  if
    resolved_email = ''
    or
    resolved_provider not in (
      'google',
      'microsoft'
    )
  then
    raise exception
      'Connect a verified campaign mailbox before connecting Calendar.';
  end if;


  -- Retire any abandoned Calendar OAuth sessions
  -- for this actor/workspace.
  update
    private.workspace_oauth_states
  set
    consumed_at =
      coalesce(
        consumed_at,
        now()
      ),

    updated_at =
      now()

  where
    workspace_id =
      target_workspace_id

    and actor_user_id =
      current_actor_user_id

    and integration_family =
      'calendar'

    and consumed_at is null;


  insert into
    private.workspace_oauth_states (
      workspace_id,
      actor_user_id,
      provider,
      integration_family,
      state_hash,
      code_verifier,
      expires_at
    )
  values (
    target_workspace_id,
    current_actor_user_id,
    resolved_provider,
    'calendar',

    encode(
      digest(
        raw_state,
        'sha256'
      ),
      'hex'
    ),

    -- The API-key Hosted OAuth flow does not send PKCE,
    -- but the existing private state table requires this
    -- field to be non-null.
    placeholder_verifier,

    expiry
  );


  return query
  select
    raw_state,
    expiry,
    resolved_email,
    resolved_provider;
end;
$function$;


revoke all
on function
public.begin_calendar_oauth(uuid)
from public;

revoke all
on function
public.begin_calendar_oauth(uuid)
from anon;

grant execute
on function
public.begin_calendar_oauth(uuid)
to authenticated;


-- ------------------------------------------------------------
-- 3. CONSUME CALENDAR OAUTH STATE
--
-- One-time state validation after Nylas returns to Campaign Seat.
-- ------------------------------------------------------------

create or replace function
public.consume_calendar_oauth_state(
  target_state text
)
returns table (
  workspace_id uuid,
  provider text,
  connected_email text
)
language plpgsql
security definer
set search_path to
  'public',
  'private',
  'extensions',
  'pg_temp'
as $function$
declare
  current_actor_user_id uuid :=
    auth.uid();

  oauth_record
    private.workspace_oauth_states%rowtype;

  resolved_email text;
begin
  perform public.require_aal2();


  if current_actor_user_id is null then
    raise exception
      'A signed-in Campaign Seat session is required.'
      using errcode = '42501';
  end if;


  if
    target_state is null
    or btrim(target_state) = ''
  then
    raise exception
      'The Calendar OAuth state value is required.'
      using errcode = '22023';
  end if;


  select *
  into oauth_record
  from private.workspace_oauth_states
    as oauth_state
  where
    oauth_state.state_hash =
      encode(
        digest(
          target_state,
          'sha256'
        ),
        'hex'
      )

    and oauth_state.actor_user_id =
      current_actor_user_id

    and oauth_state.integration_family =
      'calendar'

    and oauth_state.consumed_at
      is null

    and oauth_state.expires_at >
      now()

  for update;


  if oauth_record.id is null then
    raise exception
      'The Calendar authorization session is invalid or expired.'
      using errcode = '42501';
  end if;


  if not exists (
    select 1
    from public.workspace_members
      as member
    where
      member.workspace_id =
        oauth_record.workspace_id

      and member.user_id =
        current_actor_user_id

      and member.status =
        'active'

      and member.membership_state =
        'active'

      and member.dashboard_type in (
        'command',
        'candidate'
      )
  ) then
    raise exception
      'Your campaign leadership access is no longer active.'
      using errcode = '42501';
  end if;


  if not exists (
    select 1
    from public.workspaces
      as workspace
    where
      workspace.id =
        oauth_record.workspace_id

      and workspace.onboarding_status =
        'active'

      and workspace.onboarding_current_step =
        'calendar'
  ) then
    raise exception
      'Calendar is no longer the current onboarding phase.';
  end if;


  select
    email_connection.display_email

  into
    resolved_email

  from public.workspace_integrations
    as email_connection

  where
    email_connection.workspace_id =
      oauth_record.workspace_id

    and email_connection.provider =
      'nylas'

    and email_connection.integration_type =
      'email'

    and email_connection.status =
      'connected'

    and lower(
      coalesce(
        email_connection.settings
          ->> 'account_provider',
        ''
      )
    ) =
      oauth_record.provider

  order by
    email_connection.connected_at desc
    nulls last

  limit 1;


  resolved_email :=
    lower(
      btrim(
        coalesce(
          resolved_email,
          ''
        )
      )
    );


  if resolved_email = '' then
    raise exception
      'The connected campaign mailbox could not be resolved.';
  end if;


  update
    private.workspace_oauth_states
  set
    consumed_at =
      now(),

    updated_at =
      now()

  where
    id =
      oauth_record.id;


  return query
  select
    oauth_record.workspace_id,
    oauth_record.provider,
    resolved_email;
end;
$function$;


revoke all
on function
public.consume_calendar_oauth_state(text)
from public;

revoke all
on function
public.consume_calendar_oauth_state(text)
from anon;

grant execute
on function
public.consume_calendar_oauth_state(text)
to authenticated;

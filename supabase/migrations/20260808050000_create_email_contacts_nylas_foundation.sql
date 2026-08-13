-- Campaign Seat
--
-- Email & Contacts provider foundation.
--
-- Architecture:
--   Google / Microsoft -> Nylas grant
--   Nylas grant -> two workspace integration records:
--     * email
--     * contacts
--
-- Campaign Seat stores the Nylas grant identifier only.
-- Google/Microsoft access and refresh tokens are intentionally
-- not persisted in Campaign Seat.
--
-- Calendar remains a separate onboarding phase.
-- Provider contact data does not automatically become
-- campaign CRM consent data.

-- ============================================================
-- 1. NORMALIZE INTEGRATION VISIBILITY TO ACTIVE LEADERSHIP
-- ============================================================

drop policy if exists
"Leadership can view workspace integrations"
on public.workspace_integrations;

create policy
"Leadership can view workspace integrations"
on public.workspace_integrations
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members
      as member
    where
      member.workspace_id =
        workspace_integrations.workspace_id

      and member.user_id =
        auth.uid()

      and member.status =
        'active'

      and member.membership_state =
        'active'

      and member.dashboard_type in (
        'command',
        'candidate'
      )
  )
);


-- ============================================================
-- 2. PRIVATE, ONE-TIME OAUTH STATE + PKCE STORAGE
-- ============================================================

create table
private.workspace_oauth_states (
  id uuid primary key
    default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  actor_user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  provider text not null,

  integration_family text not null
    default 'email_contacts',

  state_hash text not null unique,

  code_verifier text not null,

  expires_at timestamptz not null,

  consumed_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint
    workspace_oauth_states_provider_check
    check (
      provider in (
        'google',
        'microsoft'
      )
    ),

  constraint
    workspace_oauth_states_family_check
    check (
      integration_family =
        'email_contacts'
    )
);

alter table
private.workspace_oauth_states
enable row level security;

revoke all
on private.workspace_oauth_states
from public;

revoke all
on private.workspace_oauth_states
from anon;

revoke all
on private.workspace_oauth_states
from authenticated;


create index
workspace_oauth_states_lookup_idx
on private.workspace_oauth_states (
  state_hash,
  actor_user_id,
  expires_at
);


-- ============================================================
-- 3. BEGIN OAUTH — AUTHENTICATED + AAL2
-- ============================================================

create or replace function
public.begin_email_contacts_oauth(
  target_workspace_id uuid,
  target_provider text
)
returns table (
  oauth_state text,
  code_challenge text,
  oauth_expires_at timestamptz
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

  raw_state text;
  raw_code_verifier text;
  encoded_challenge text;
  expiry timestamptz :=
    now() +
    interval '10 minutes';
begin
  perform public.require_aal2();


  if current_actor_user_id is null then
    raise exception
      'A signed-in Campaign Seat session is required.'
      using errcode = '42501';
  end if;


  if target_provider not in (
    'google',
    'microsoft'
  ) then
    raise exception
      'Only Google or Microsoft can be connected during Email & Contacts onboarding.'
      using errcode = '22023';
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
      'A protected leadership membership is required to connect campaign email.'
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
        'communications'
  ) then
    raise exception
      'Email & Contacts is not the current Campaign Seat onboarding phase.';
  end if;


  if not exists (
    select 1
    from public.workspace_onboarding_steps
      as onboarding_step
    where
      onboarding_step.workspace_id =
        target_workspace_id

      and onboarding_step.step_key =
        'team'

      and onboarding_step.status =
        'complete'
  ) then
    raise exception
      'Team & Access must be complete before connecting campaign email.';
  end if;


  delete from
    private.workspace_oauth_states
      as oauth_state
  where
    (
      oauth_state.expires_at <= now()
      or oauth_state.consumed_at is not null
    )
    and oauth_state.actor_user_id =
      current_actor_user_id;


  raw_state =
    encode(
      gen_random_bytes(32),
      'hex'
    );


  raw_code_verifier =
    rtrim(
      translate(
        encode(
          gen_random_bytes(48),
          'base64'
        ),
        '+/',
        '-_'
      ),
      '='
    );


  encoded_challenge =
    rtrim(
      translate(
        encode(
          digest(
            raw_code_verifier,
            'sha256'
          ),
          'base64'
        ),
        '+/',
        '-_'
      ),
      '='
    );


  insert into
  private.workspace_oauth_states (
    workspace_id,
    actor_user_id,
    provider,
    state_hash,
    code_verifier,
    expires_at
  )
  values (
    target_workspace_id,
    current_actor_user_id,
    target_provider,
    encode(
      digest(
        raw_state,
        'sha256'
      ),
      'hex'
    ),
    raw_code_verifier,
    expiry
  );


  return query
  select
    raw_state,
    encoded_challenge,
    expiry;
end;
$function$;


revoke all
on function
public.begin_email_contacts_oauth(
  uuid,
  text
)
from public;

revoke all
on function
public.begin_email_contacts_oauth(
  uuid,
  text
)
from anon;

grant execute
on function
public.begin_email_contacts_oauth(
  uuid,
  text
)
to authenticated;


-- ============================================================
-- 4. CONSUME OAUTH STATE — AUTHENTICATED + AAL2
-- ============================================================

create or replace function
public.consume_email_contacts_oauth_state(
  target_state text
)
returns table (
  workspace_id uuid,
  provider text,
  code_verifier text
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
begin
  perform public.require_aal2();


  if current_actor_user_id is null then
    raise exception
      'A signed-in Campaign Seat session is required.'
      using errcode = '42501';
  end if;


  if target_state is null
    or btrim(target_state) = ''
  then
    raise exception
      'The OAuth state value is required.'
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

    and oauth_state.consumed_at
      is null

    and oauth_state.expires_at >
      now()

  for update;


  if not found then
    raise exception
      'The Email & Contacts authorization session is invalid, expired or already used.'
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
        'communications'
  ) then
    raise exception
      'Email & Contacts is no longer the current onboarding phase.';
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
    oauth_record.code_verifier;
end;
$function$;


revoke all
on function
public.consume_email_contacts_oauth_state(text)
from public;

revoke all
on function
public.consume_email_contacts_oauth_state(text)
from anon;

grant execute
on function
public.consume_email_contacts_oauth_state(text)
to authenticated;


-- ============================================================
-- 5. SERVER-ONLY FINALIZATION AFTER NYLAS TOKEN EXCHANGE
-- ============================================================

create or replace function
public.finalize_email_contacts_connection(
  target_workspace_id uuid,
  target_actor_user_id uuid,
  target_provider text,
  target_provider_grant_id text,
  target_email text,
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
  normalized_email text :=
    lower(
      btrim(
        target_email
      )
    );

  email_integration_id uuid;
  contacts_integration_id uuid;

  result_rows jsonb;
begin
  if target_actor_user_id is null then
    raise exception
      'The connecting campaign user is required.'
      using errcode = '22023';
  end if;


  if target_provider not in (
    'google',
    'microsoft'
  ) then
    raise exception
      'The connected provider must be Google or Microsoft.'
      using errcode = '22023';
  end if;


  if target_provider_grant_id is null
    or btrim(
      target_provider_grant_id
    ) = ''
  then
    raise exception
      'A valid Nylas grant is required.'
      using errcode = '22023';
  end if;


  if normalized_email = ''
    or position(
      '@'
      in normalized_email
    ) <= 1
  then
    raise exception
      'A valid connected email address is required.'
      using errcode = '22023';
  end if;


  if not exists (
    select 1
    from public.workspace_members
      as member
    where
      member.workspace_id =
        target_workspace_id

      and member.user_id =
        target_actor_user_id

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
      'The connecting user is not active campaign leadership.'
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
        'communications'
  ) then
    raise exception
      'Email & Contacts is not the current onboarding phase.';
  end if;


  insert into
  public.workspace_integrations (
    workspace_id,
    provider,
    integration_type,
    connection_key,
    status,
    display_name,
    display_email,
    external_account_id,
    capabilities,
    settings,
    last_success_at,
    connected_by,
    connected_at,
    disconnected_at,
    last_error_code,
    last_error_summary
  )
  values (
    target_workspace_id,
    'nylas',
    'email',
    normalized_email,
    'connected',
    normalized_email,
    normalized_email,
    target_provider_grant_id,
    jsonb_build_object(
      'read',
      true,

      'send',
      false,

      'progressive_send_permission',
      true
    ),
    jsonb_build_object(
      'account_provider',
      target_provider,

      'credential_mode',
      'nylas_grant'
    ),
    now(),
    target_actor_user_id,
    now(),
    null,
    null,
    null
  )
  on conflict (
    workspace_id,
    provider,
    integration_type,
    connection_key
  )
  do update
  set
    status =
      'connected',

    display_name =
      excluded.display_name,

    display_email =
      excluded.display_email,

    external_account_id =
      excluded.external_account_id,

    capabilities =
      excluded.capabilities,

    settings =
      excluded.settings,

    last_success_at =
      now(),

    connected_by =
      target_actor_user_id,

    connected_at =
      now(),

    disconnected_at =
      null,

    last_error_code =
      null,

    last_error_summary =
      null,

    updated_at =
      now()

  returning id
  into email_integration_id;


  insert into
  public.workspace_integrations (
    workspace_id,
    provider,
    integration_type,
    connection_key,
    status,
    display_name,
    display_email,
    external_account_id,
    capabilities,
    settings,
    last_success_at,
    connected_by,
    connected_at,
    disconnected_at,
    last_error_code,
    last_error_summary
  )
  values (
    target_workspace_id,
    'nylas',
    'contacts',
    normalized_email,
    'connected',
    normalized_email,
    normalized_email,
    target_provider_grant_id,
    jsonb_build_object(
      'read',
      true,

      'import',
      true,

      'two_way_sync',
      false,

      'campaign_consent_is_separate',
      true
    ),
    jsonb_build_object(
      'account_provider',
      target_provider,

      'credential_mode',
      'nylas_grant'
    ),
    now(),
    target_actor_user_id,
    now(),
    null,
    null,
    null
  )
  on conflict (
    workspace_id,
    provider,
    integration_type,
    connection_key
  )
  do update
  set
    status =
      'connected',

    display_name =
      excluded.display_name,

    display_email =
      excluded.display_email,

    external_account_id =
      excluded.external_account_id,

    capabilities =
      excluded.capabilities,

    settings =
      excluded.settings,

    last_success_at =
      now(),

    connected_by =
      target_actor_user_id,

    connected_at =
      now(),

    disconnected_at =
      null,

    last_error_code =
      null,

    last_error_summary =
      null,

    updated_at =
      now()

  returning id
  into contacts_integration_id;


  insert into
  private.workspace_integration_credentials (
    integration_id,
    credential_reference,
    provider_grant_id,
    token_expires_at,
    metadata,
    updated_at
  )
  values (
    email_integration_id,
    'nylas_grant',
    target_provider_grant_id,
    null,
    jsonb_build_object(
      'account_provider',
      target_provider,

      'scope',
      coalesce(
        target_scope,
        ''
      )
    ),
    now()
  )
  on conflict (
    integration_id
  )
  do update
  set
    credential_reference =
      'nylas_grant',

    provider_grant_id =
      target_provider_grant_id,

    token_expires_at =
      null,

    metadata =
      excluded.metadata,

    updated_at =
      now();


  insert into
  private.workspace_integration_credentials (
    integration_id,
    credential_reference,
    provider_grant_id,
    token_expires_at,
    metadata,
    updated_at
  )
  values (
    contacts_integration_id,
    'nylas_grant',
    target_provider_grant_id,
    null,
    jsonb_build_object(
      'account_provider',
      target_provider,

      'scope',
      coalesce(
        target_scope,
        ''
      )
    ),
    now()
  )
  on conflict (
    integration_id
  )
  do update
  set
    credential_reference =
      'nylas_grant',

    provider_grant_id =
      target_provider_grant_id,

    token_expires_at =
      null,

    metadata =
      excluded.metadata,

    updated_at =
      now();


  select
    jsonb_agg(
      to_jsonb(
        integration_record
      )
      order by
        integration_record.integration_type
    )
  into
    result_rows
  from public.workspace_integrations
    as integration_record
  where
    integration_record.id in (
      email_integration_id,
      contacts_integration_id
    );


  return jsonb_build_object(
    'success',
    true,

    'provider',
    target_provider,

    'email',
    normalized_email,

    'integrations',
    coalesce(
      result_rows,
      '[]'::jsonb
    )
  );
end;
$function$;


revoke all
on function
public.finalize_email_contacts_connection(
  uuid,
  uuid,
  text,
  text,
  text,
  text
)
from public;

revoke all
on function
public.finalize_email_contacts_connection(
  uuid,
  uuid,
  text,
  text,
  text,
  text
)
from anon;

revoke all
on function
public.finalize_email_contacts_connection(
  uuid,
  uuid,
  text,
  text,
  text,
  text
)
from authenticated;

grant execute
on function
public.finalize_email_contacts_connection(
  uuid,
  uuid,
  text,
  text,
  text,
  text
)
to service_role;


-- ============================================================
-- 6. EMAIL & CONTACTS COMPLETION -> CALENDAR
-- ============================================================

create or replace function
public.complete_email_contacts_onboarding(
  target_workspace_id uuid
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
  actor_user_id uuid :=
    auth.uid();

  communications_status text;
  calendar_status text;

  email_integration_id uuid;
  contacts_integration_id uuid;

  email_grant_id text;
  contacts_grant_id text;

  updated_workspace jsonb;
  onboarding_steps jsonb;
begin
  perform public.require_aal2();


  if actor_user_id is null then
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
        actor_user_id

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
      'Protected campaign leadership access is required.'
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
        'communications'
  ) then
    raise exception
      'Email & Contacts is not the current Campaign Seat onboarding phase.';
  end if;


  if not exists (
    select 1
    from public.workspace_onboarding_steps
      as onboarding_step
    where
      onboarding_step.workspace_id =
        target_workspace_id

      and onboarding_step.step_key =
        'team'

      and onboarding_step.status =
        'complete'
  ) then
    raise exception
      'Team & Access must be complete first.';
  end if;


  select
    onboarding_step.status
  into
    communications_status
  from public.workspace_onboarding_steps
    as onboarding_step
  where
    onboarding_step.workspace_id =
      target_workspace_id

    and onboarding_step.step_key =
      'communications'
  for update;


  if communications_status <>
    'in_progress'
  then
    raise exception
      'Email & Contacts must be in progress before completion.';
  end if;


  select
    onboarding_step.status
  into
    calendar_status
  from public.workspace_onboarding_steps
    as onboarding_step
  where
    onboarding_step.workspace_id =
      target_workspace_id

    and onboarding_step.step_key =
      'calendar'
  for update;


  if calendar_status <>
    'pending'
  then
    raise exception
      'Calendar must be pending before Email & Contacts can advance.';
  end if;


  select
    email_connection.id,
    contacts_connection.id
  into
    email_integration_id,
    contacts_integration_id
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

    and (
      email_connection.capabilities
        ->> 'read'
    )::boolean is true

    and (
      contacts_connection.capabilities
        ->> 'read'
    )::boolean is true

  order by
    email_connection.connected_at desc
    nulls last

  limit 1;


  if email_integration_id is null
    or contacts_integration_id is null
  then
    raise exception
      'Connect a verified campaign email account with contact access before continuing.';
  end if;


  select
    credential.provider_grant_id
  into
    email_grant_id
  from private.workspace_integration_credentials
    as credential
  where
    credential.integration_id =
      email_integration_id;


  select
    credential.provider_grant_id
  into
    contacts_grant_id
  from private.workspace_integration_credentials
    as credential
  where
    credential.integration_id =
      contacts_integration_id;


  if email_grant_id is null
    or btrim(
      email_grant_id
    ) = ''
    or contacts_grant_id is null
    or email_grant_id <>
      contacts_grant_id
  then
    raise exception
      'The verified Nylas grant for Email & Contacts is incomplete.';
  end if;


  update
  public.workspace_onboarding_steps
  set
    status =
      'complete',

    completed_at =
      coalesce(
        completed_at,
        now()
      ),

    completed_by =
      coalesce(
        completed_by,
        actor_user_id
      ),

    updated_at =
      now()

  where
    workspace_id =
      target_workspace_id

    and step_key =
      'communications';


  update
  public.workspace_onboarding_steps
  set
    status =
      'in_progress',

    updated_at =
      now()

  where
    workspace_id =
      target_workspace_id

    and step_key =
      'calendar';


  update
  public.workspaces
  set
    onboarding_current_step =
      'calendar',

    setup_metadata =
      coalesce(
        setup_metadata,
        '{}'::jsonb
      ) ||
      jsonb_build_object(
        'communications_completed_at',
        now(),

        'communications_completed_by',
        actor_user_id,

        'next_setup_phase',
        'calendar'
      )

  where
    workspaces.id =
      target_workspace_id;


  select
    to_jsonb(
      workspace_record
    )
  into
    updated_workspace
  from public.workspaces
    as workspace_record
  where
    workspace_record.id =
      target_workspace_id;


  select
    coalesce(
      jsonb_agg(
        to_jsonb(
          onboarding_record
        )
        order by
          onboarding_record.step_key
      ),
      '[]'::jsonb
    )
  into
    onboarding_steps
  from public.workspace_onboarding_steps
    as onboarding_record
  where
    onboarding_record.workspace_id =
      target_workspace_id;


  return jsonb_build_object(
    'workspace',
    updated_workspace,

    'onboardingSteps',
    onboarding_steps,

    'nextPhase',
    'calendar'
  );
end;
$function$;


revoke all
on function
public.complete_email_contacts_onboarding(uuid)
from public;

revoke all
on function
public.complete_email_contacts_onboarding(uuid)
from anon;

grant execute
on function
public.complete_email_contacts_onboarding(uuid)
to authenticated;

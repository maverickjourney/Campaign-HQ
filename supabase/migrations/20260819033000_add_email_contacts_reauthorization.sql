-- ============================================================
-- CAMPAIGN SEAT
-- POST-ONBOARDING EMAIL & CONTACTS REAUTHORIZATION
--
-- Purpose:
-- - Reauthorize an existing Google/Microsoft mailbox.
-- - Require leadership + AAL2 at OAuth start and consume.
-- - Require the SAME provider and SAME mailbox.
-- - Replace Email + Contacts private Nylas grant together.
-- - Preserve all onboarding state.
-- - Keep provider grant references out of public tables.
-- ============================================================

begin;


-- ============================================================
-- BEGIN REAUTHORIZATION
-- ============================================================

create or replace function
public.begin_email_contacts_reauthorization(
  target_workspace_id uuid,
  target_provider text
)
returns table (
  oauth_state text,
  code_challenge text,
  oauth_expires_at timestamptz,
  login_hint text
)
language plpgsql
security definer
set search_path =
  public,
  private,
  extensions,
  pg_temp
as $campaign_seat_reauth_begin$
declare
  current_actor_user_id uuid :=
    auth.uid();

  existing_email text;
  existing_provider text;

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
      'Only Google or Microsoft can be reauthorized.'
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
      'Protected campaign leadership access is required to reconnect campaign email.'
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
  ) then
    raise exception
      'The Campaign Seat workspace is not active.';
  end if;


  if not exists (
    select 1

    from public.workspace_onboarding_steps
      as communications

    where
      communications.workspace_id =
        target_workspace_id

      and communications.step_key =
        'communications'

      and communications.status =
        'complete'
  ) then
    raise exception
      'Email & Contacts must already be complete before reauthorization.';
  end if;


  select
    lower(
      btrim(
        email_connection.display_email
      )
    ),

    email_connection.settings
      ->> 'account_provider'

  into
    existing_email,
    existing_provider

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

  join private.workspace_integration_credentials
    as email_credential
    on email_credential.integration_id =
      email_connection.id

  join private.workspace_integration_credentials
    as contacts_credential
    on contacts_credential.integration_id =
      contacts_connection.id

  where
    email_connection.workspace_id =
      target_workspace_id

    and email_connection.provider =
      'nylas'

    and email_connection.integration_type =
      'email'

    and email_connection.status =
      'connected'

    and email_connection.display_email
      is not null

    and btrim(
      email_connection.display_email
    ) <> ''

    and email_credential.provider_grant_id
      is not null

    and btrim(
      email_credential.provider_grant_id
    ) <> ''

    and email_credential.provider_grant_id =
      contacts_credential.provider_grant_id

  order by
    email_connection.connected_at desc
    nulls last

  limit 1;


  if existing_email is null then
    raise exception
      'No existing protected campaign mailbox is available to reconnect.';
  end if;


  if existing_provider is distinct from
    target_provider
  then
    raise exception
      'Reauthorization must use the provider already connected to this campaign mailbox.'
      using errcode = '42501';
  end if;


  delete from
    private.workspace_oauth_states
      as oauth_state_record

  where
    (
      oauth_state_record.expires_at <=
        now()

      or oauth_state_record.consumed_at
        is not null
    )

    and oauth_state_record.actor_user_id =
      current_actor_user_id;


  raw_state =
    'reauth.' ||
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
        replace(
          encode(
            convert_to(
              encode(
                digest(
                  raw_code_verifier,
                  'sha256'
                ),
                'hex'
              ),
              'UTF8'
            ),
            'base64'
          ),
          E'\\n',
          ''
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
    expiry,
    existing_email;
end;
$campaign_seat_reauth_begin$;


revoke all
on function
public.begin_email_contacts_reauthorization(
  uuid,
  text
)
from public, anon;

grant execute
on function
public.begin_email_contacts_reauthorization(
  uuid,
  text
)
to authenticated;


-- ============================================================
-- CONSUME REAUTHORIZATION STATE
-- ============================================================

create or replace function
public.consume_email_contacts_reauthorization_state(
  target_state text
)
returns table (
  workspace_id uuid,
  provider text,
  code_verifier text
)
language plpgsql
security definer
set search_path =
  public,
  private,
  extensions,
  pg_temp
as $campaign_seat_reauth_consume$
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
    or btrim(
      target_state
    ) = ''
  then
    raise exception
      'The OAuth state value is required.'
      using errcode = '22023';
  end if;


  if left(
    target_state,
    7
  ) <> 'reauth.'
  then
    raise exception
      'The mailbox reauthorization session is invalid.'
      using errcode = '42501';
  end if;


  select *
  into
    oauth_record

  from private.workspace_oauth_states
    as oauth_state_record

  where
    oauth_state_record.state_hash =
      encode(
        digest(
          target_state,
          'sha256'
        ),
        'hex'
      )

    and oauth_state_record.actor_user_id =
      current_actor_user_id

    and oauth_state_record.consumed_at
      is null

    and oauth_state_record.expires_at >
      now()

  for update;


  if not found then
    raise exception
      'The mailbox reauthorization session is invalid, expired or already used.'
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
      'Your protected campaign leadership access is no longer active.'
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
  ) then
    raise exception
      'The Campaign Seat workspace is no longer active.';
  end if;


  if not exists (
    select 1

    from public.workspace_onboarding_steps
      as communications

    where
      communications.workspace_id =
        oauth_record.workspace_id

      and communications.step_key =
        'communications'

      and communications.status =
        'complete'
  ) then
    raise exception
      'Email & Contacts is no longer complete for this workspace.';
  end if;


  if not exists (
    select 1

    from public.workspace_integrations
      as email_connection

    join private.workspace_integration_credentials
      as credential
      on credential.integration_id =
        email_connection.id

    where
      email_connection.workspace_id =
        oauth_record.workspace_id

      and email_connection.provider =
        'nylas'

      and email_connection.integration_type =
        'email'

      and email_connection.status =
        'connected'

      and email_connection.settings
        ->> 'account_provider' =
        oauth_record.provider

      and credential.provider_grant_id
        is not null

      and btrim(
        credential.provider_grant_id
      ) <> ''
  ) then
    raise exception
      'The existing protected campaign mailbox connection could not be verified.';
  end if;


  update
  private.workspace_oauth_states

  set
    consumed_at =
      now(),

    updated_at =
      now()

  where id =
    oauth_record.id;


  return query
  select
    oauth_record.workspace_id,
    oauth_record.provider,
    oauth_record.code_verifier;
end;
$campaign_seat_reauth_consume$;


revoke all
on function
public.consume_email_contacts_reauthorization_state(
  text
)
from public, anon;

grant execute
on function
public.consume_email_contacts_reauthorization_state(
  text
)
to authenticated;


-- ============================================================
-- FINALIZE REAUTHORIZATION
-- SERVICE-ROLE ONLY
-- ============================================================

create or replace function
public.finalize_email_contacts_reauthorization(
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
set search_path =
  public,
  private,
  pg_temp
as $campaign_seat_reauth_finalize$
declare
  normalized_email text :=
    lower(
      btrim(
        target_email
      )
    );

  normalized_scope text :=
    lower(
      coalesce(
        target_scope,
        ''
      )
    );

  email_integration_id uuid;
  contacts_integration_id uuid;

  existing_email text;
  existing_provider text;
  preserved_onboarding_step text;

  scope_verified boolean :=
    false;
begin
  if target_actor_user_id is null then
    raise exception
      'The reconnecting campaign user is required.'
      using errcode = '22023';
  end if;


  if target_provider not in (
    'google',
    'microsoft'
  ) then
    raise exception
      'The reauthorized provider must be Google or Microsoft.'
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


  if normalized_email = ''
    or position(
      '@'
      in normalized_email
    ) <= 1
  then
    raise exception
      'A valid reauthorized email address is required.'
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
      'The reconnecting user is not active campaign leadership.'
      using errcode = '42501';
  end if;


  if not exists (
    select 1

    from public.workspace_onboarding_steps
      as communications

    where
      communications.workspace_id =
        target_workspace_id

      and communications.step_key =
        'communications'

      and communications.status =
        'complete'
  ) then
    raise exception
      'Email & Contacts must remain complete during reauthorization.';
  end if;


  select
    email_connection.id,

    contacts_connection.id,

    lower(
      btrim(
        email_connection.display_email
      )
    ),

    email_connection.settings
      ->> 'account_provider',

    workspace.onboarding_current_step

  into
    email_integration_id,
    contacts_integration_id,
    existing_email,
    existing_provider,
    preserved_onboarding_step

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

  join private.workspace_integration_credentials
    as email_credential
    on email_credential.integration_id =
      email_connection.id

  join private.workspace_integration_credentials
    as contacts_credential
    on contacts_credential.integration_id =
      contacts_connection.id

  join public.workspaces
    as workspace
    on workspace.id =
      email_connection.workspace_id

    and workspace.onboarding_status =
      'active'

  where
    email_connection.workspace_id =
      target_workspace_id

    and email_connection.provider =
      'nylas'

    and email_connection.integration_type =
      'email'

    and email_connection.status =
      'connected'

    and email_credential.provider_grant_id
      is not null

    and btrim(
      email_credential.provider_grant_id
    ) <> ''

    and email_credential.provider_grant_id =
      contacts_credential.provider_grant_id

  order by
    email_connection.connected_at desc
    nulls last

  limit 1;


  if email_integration_id is null
    or contacts_integration_id is null
  then
    raise exception
      'The existing Email & Contacts connection could not be resolved.';
  end if;


  if existing_provider is distinct from
    target_provider
  then
    raise exception
      'Reauthorization cannot change the connected provider.'
      using errcode = '42501';
  end if;


  if existing_email is distinct from
    normalized_email
  then
    raise exception
      'Reauthorization must use the same campaign mailbox that is already connected.'
      using errcode = '42501';
  end if;


  if target_provider = 'google' then
    scope_verified =
      position(
        'gmail.readonly'
        in normalized_scope
      ) > 0

      and position(
        'gmail.send'
        in normalized_scope
      ) > 0

      and position(
        'contacts.readonly'
        in normalized_scope
      ) > 0;
  else
    scope_verified =
      position(
        'mail.readwrite'
        in normalized_scope
      ) > 0

      and position(
        'mail.send'
        in normalized_scope
      ) > 0

      and position(
        'contacts.read'
        in normalized_scope
      ) > 0;
  end if;


  if not scope_verified then
    raise exception
      'The reauthorized mailbox did not include all required Email & Contacts permissions.'
      using errcode = '42501';
  end if;


  update
  private.workspace_integration_credentials

  set
    credential_reference =
      'nylas_grant',

    provider_grant_id =
      target_provider_grant_id,

    token_expires_at =
      null,

    metadata =
      coalesce(
        metadata,
        '{}'::jsonb
      )
      ||
      jsonb_build_object(
        'account_provider',
        target_provider,

        'scope',
        coalesce(
          target_scope,
          ''
        ),

        'reauthorized_at',
        now()
      ),

    updated_at =
      now()

  where integration_id in (
    email_integration_id,
    contacts_integration_id
  );


  update
  public.workspace_integrations

  set
    external_account_id =
      null,

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
        'account_provider',
        target_provider,

        'credential_mode',
        'nylas_grant',

        'send_scope_verified',
        true,

        'reauthorized_at',
        now()
      ),

    status =
      'connected',

    disconnected_at =
      null,

    last_error_code =
      null,

    last_error_summary =
      null,

    last_success_at =
      now(),

    updated_at =
      now()

  where id =
    email_integration_id;


  update
  public.workspace_integrations

  set
    external_account_id =
      null,

    capabilities =
      coalesce(
        capabilities,
        '{}'::jsonb
      )
      ||
      jsonb_build_object(
        'read',
        true,

        'import',
        true
      ),

    settings =
      coalesce(
        settings,
        '{}'::jsonb
      )
      ||
      jsonb_build_object(
        'account_provider',
        target_provider,

        'credential_mode',
        'nylas_grant',

        'reauthorized_at',
        now()
      ),

    status =
      'connected',

    disconnected_at =
      null,

    last_error_code =
      null,

    last_error_summary =
      null,

    last_success_at =
      now(),

    updated_at =
      now()

  where id =
    contacts_integration_id;


  return jsonb_build_object(
    'success',
    true,

    'reauthorized',
    true,

    'provider',
    target_provider,

    'email',
    existing_email,

    'onboardingCurrentStep',
    preserved_onboarding_step
  );
end;
$campaign_seat_reauth_finalize$;


revoke all
on function
public.finalize_email_contacts_reauthorization(
  uuid,
  uuid,
  text,
  text,
  text,
  text
)
from public, anon, authenticated;

grant execute
on function
public.finalize_email_contacts_reauthorization(
  uuid,
  uuid,
  text,
  text,
  text,
  text
)
to service_role;


comment on function
public.begin_email_contacts_reauthorization(
  uuid,
  text
)
is
  'Begins AAL2-protected post-onboarding reauthorization for the existing campaign mailbox without changing onboarding state.';


comment on function
public.consume_email_contacts_reauthorization_state(
  text
)
is
  'Consumes a one-time AAL2-protected post-onboarding campaign-mailbox reauthorization state.';


comment on function
public.finalize_email_contacts_reauthorization(
  uuid,
  uuid,
  text,
  text,
  text,
  text
)
is
  'Service-role finalizer replacing the existing private Email and Contacts Nylas grant only when provider, mailbox and scopes match.';


commit;

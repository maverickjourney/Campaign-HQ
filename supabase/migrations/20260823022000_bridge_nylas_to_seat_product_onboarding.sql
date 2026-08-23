begin;

-- ============================================================
-- CAMPAIGN SEAT
-- PRODUCT ACCOUNT ↔ NYLAS OAUTH BRIDGE
--
-- This allows Google / Microsoft authorization BEFORE the
-- Campaign workspace exists.
--
-- SECURITY:
--   * AAL2 required
--   * hashed OAuth state
--   * PKCE verifier stored only in private schema
--   * Nylas grant ID stored only in private schema
--   * no provider passwords stored
--   * no provider refresh/access tokens stored by Campaign Seat
--   * OAuth connection belongs to the authenticated Product Account
--
-- One Nylas grant provides Campaign Seat's core:
--   * Email
--   * Contacts
--   * Calendar
--
-- Drive / OneDrive remain separate future file integrations.
-- ============================================================


create table if not exists
private.seat_product_oauth_states (
  id uuid primary key
    default gen_random_uuid(),

  product_account_id uuid not null
    references public.seat_product_accounts(id)
    on delete cascade,

  product_account_integration_id uuid not null
    references public.seat_product_account_integrations(id)
    on delete cascade,

  actor_user_id uuid not null
    references auth.users(id)
    on delete cascade,

  provider text not null
    check (
      provider in (
        'google',
        'microsoft'
      )
    ),

  integration_key text not null,

  state_hash text not null
    unique,

  code_verifier text not null,

  redirect_uri text not null,

  expires_at timestamptz not null,

  consumed_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()
);


create index if not exists
seat_product_oauth_states_actor_idx
on private.seat_product_oauth_states (
  actor_user_id,
  expires_at
);


create index if not exists
seat_product_oauth_states_connection_idx
on private.seat_product_oauth_states (
  product_account_integration_id,
  consumed_at
);


revoke all
on table
private.seat_product_oauth_states
from
  public,
  anon,
  authenticated;



create table if not exists
private.seat_product_integration_credentials (
  product_account_integration_id uuid primary key
    references public.seat_product_account_integrations(id)
    on delete cascade,

  credential_reference text not null
    default 'nylas_grant',

  provider_grant_id text not null,

  scope text not null
    default '',

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint
    seat_product_integration_credentials_metadata_check
    check (
      jsonb_typeof(metadata) =
      'object'
    )
);


revoke all
on table
private.seat_product_integration_credentials
from
  public,
  anon,
  authenticated;



create or replace function
public.begin_seat_product_oauth(
  target_integration_key text,
  target_redirect_uri text
)
returns table (
  oauth_state text,
  code_challenge text,
  oauth_expires_at timestamptz,
  provider text,
  integration_key text,
  login_hint text
)
language plpgsql
security definer
set search_path =
  public,
  private,
  extensions,
  pg_temp
as $seat_product_oauth_begin$
declare
  actor_user_id uuid :=
    auth.uid();

  normalized_key text :=
    lower(
      btrim(
        coalesce(
          target_integration_key,
          ''
        )
      )
    );

  normalized_redirect text :=
    btrim(
      coalesce(
        target_redirect_uri,
        ''
      )
    );

  connection_record record;

  raw_state text;

  raw_code_verifier text;

  encoded_challenge text;

  expiry timestamptz :=
    now() +
    interval '10 minutes';
begin

  perform public.require_aal2();


  if actor_user_id is null then
    raise exception
      'A signed-in Campaign Seat session is required.'
      using errcode = '42501';
  end if;


  if normalized_key not in (
    'google_workspace',
    'microsoft_365'
  ) then
    raise exception
      'Choose Google Workspace or Microsoft 365.'
      using errcode = '22023';
  end if;


  if normalized_redirect = '' then
    raise exception
      'The OAuth redirect URI is required.'
      using errcode = '22023';
  end if;


  select
    account.id
      as product_account_id,

    connection.id
      as connection_id,

    connection.status
      as connection_status,

    connection.display_email,

    catalog.provider,

    catalog.integration_key

  into connection_record

  from public.seat_customer_contacts
    as contact

  join public.seat_product_accounts
    as account
    on account.primary_contact_id =
      contact.id

  join public.seat_onboarding_runs
    as onboarding
    on onboarding.product_account_id =
      account.id

  join public.seat_product_account_integrations
    as connection
    on connection.product_account_id =
      account.id

  join public.seat_integration_catalog
    as catalog
    on catalog.id =
      connection.integration_id

  where
    contact.user_id =
      actor_user_id

    and contact.status =
      'active'

    and account.status =
      'onboarding'

    and onboarding.status =
      'in_progress'

    and onboarding.current_step_key in (
      'integrations',
      'activation'
    )

    and catalog.integration_key =
      normalized_key

    and catalog.provider in (
      'google',
      'microsoft'
    )

    and catalog.auth_type =
      'oauth2'

    and connection.connection_key =
      'primary'

    and coalesce(
      connection.connection_metadata
        ->> 'onboarding_selected',
      'false'
    ) = 'true'

  order by
    onboarding.created_at desc

  limit 1

  for update of
    connection;


  if connection_record.connection_id
    is null
  then
    raise exception
      'This provider is not available for the current Campaign Seat onboarding account.'
      using errcode = '42501';
  end if;


  -- Retire abandoned OAuth sessions for this provider connection.
  update
  private.seat_product_oauth_states
  set
    consumed_at =
      coalesce(
        consumed_at,
        now()
      ),

    updated_at =
      now()

  where
    product_account_integration_id =
      connection_record.connection_id

    and actor_user_id =
      actor_user_id

    and consumed_at is null;


  raw_state :=
    'seat.' ||
    encode(
      gen_random_bytes(32),
      'hex'
    );


  raw_code_verifier :=
    replace(
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
      ),
      chr(10),
      ''
    );


  encoded_challenge :=
    replace(
      rtrim(
        translate(
          encode(
            extensions.digest(
              raw_code_verifier,
              'sha256'
            ),
            'base64'
          ),
          '+/',
          '-_'
        ),
        '='
      ),
      chr(10),
      ''
    );


  insert into
  private.seat_product_oauth_states (
    product_account_id,
    product_account_integration_id,
    actor_user_id,
    provider,
    integration_key,
    state_hash,
    code_verifier,
    redirect_uri,
    expires_at
  )
  values (
    connection_record.product_account_id,
    connection_record.connection_id,
    actor_user_id,
    connection_record.provider,
    connection_record.integration_key,

    encode(
      extensions.digest(
        raw_state,
        'sha256'
      ),
      'hex'
    ),

    raw_code_verifier,
    normalized_redirect,
    expiry
  );


  update
  public.seat_product_account_integrations
  set
    status =
      'connecting',

    user_id =
      actor_user_id,

    connection_metadata =
      coalesce(
        connection_metadata,
        '{}'::jsonb
      ) ||
      jsonb_build_object(
        'oauth_started_at',
        now(),

        'oauth_provider',
        connection_record.provider,

        'credential_mode',
        'nylas_grant',

        'activation_required_capabilities',
        jsonb_build_array(
          'email',
          'contacts',
          'calendar'
        ),

        'deferred_file_capability',
        case
          when connection_record.provider =
            'google'
          then 'drive'
          else 'onedrive'
        end
      ),

    updated_at =
      now()

  where id =
    connection_record.connection_id;


  return query
  select
    raw_state,
    encoded_challenge,
    expiry,
    connection_record.provider,
    connection_record.integration_key,
    lower(
      coalesce(
        connection_record.display_email,
        ''
      )
    );
end;
$seat_product_oauth_begin$;


revoke all
on function
public.begin_seat_product_oauth(
  text,
  text
)
from
  public,
  anon;


grant execute
on function
public.begin_seat_product_oauth(
  text,
  text
)
to authenticated;



create or replace function
public.consume_seat_product_oauth_state(
  target_state text
)
returns table (
  product_account_id uuid,
  product_account_integration_id uuid,
  provider text,
  integration_key text,
  code_verifier text,
  redirect_uri text
)
language plpgsql
security definer
set search_path =
  public,
  private,
  extensions,
  pg_temp
as $seat_product_oauth_consume$
declare
  actor_user_id uuid :=
    auth.uid();

  oauth_record
    private.seat_product_oauth_states%rowtype;
begin

  perform public.require_aal2();


  if actor_user_id is null then
    raise exception
      'A signed-in Campaign Seat session is required.'
      using errcode = '42501';
  end if;


  if
    target_state is null
    or btrim(
      target_state
    ) = ''
    or target_state not like
      'seat.%'
  then
    raise exception
      'The Campaign Seat OAuth state is invalid.'
      using errcode = '22023';
  end if;


  select *
  into oauth_record

  from private.seat_product_oauth_states
    as oauth_state

  where
    oauth_state.state_hash =
      encode(
        extensions.digest(
          target_state,
          'sha256'
        ),
        'hex'
      )

    and oauth_state.actor_user_id =
      actor_user_id

    and oauth_state.consumed_at
      is null

    and oauth_state.expires_at >
      now()

  for update;


  if oauth_record.id is null then
    raise exception
      'The provider authorization session is invalid, expired or already used.'
      using errcode = '42501';
  end if;


  if not exists (
    select 1

    from public.seat_customer_contacts
      as contact

    join public.seat_product_accounts
      as account
      on account.primary_contact_id =
        contact.id

    join public.seat_onboarding_runs
      as onboarding
      on onboarding.product_account_id =
        account.id

    join public.seat_product_account_integrations
      as connection
      on connection.product_account_id =
        account.id

    where
      contact.user_id =
        actor_user_id

      and contact.status =
        'active'

      and account.id =
        oauth_record.product_account_id

      and account.status =
        'onboarding'

      and onboarding.status =
        'in_progress'

      and onboarding.current_step_key in (
        'integrations',
        'activation'
      )

      and connection.id =
        oauth_record.product_account_integration_id
  )
  then
    raise exception
      'The Campaign Seat provider connection is no longer available.'
      using errcode = '42501';
  end if;


  update
  private.seat_product_oauth_states
  set
    consumed_at =
      now(),

    updated_at =
      now()

  where id =
    oauth_record.id;


  return query
  select
    oauth_record.product_account_id,
    oauth_record.product_account_integration_id,
    oauth_record.provider,
    oauth_record.integration_key,
    oauth_record.code_verifier,
    oauth_record.redirect_uri;
end;
$seat_product_oauth_consume$;


revoke all
on function
public.consume_seat_product_oauth_state(
  text
)
from
  public,
  anon;


grant execute
on function
public.consume_seat_product_oauth_state(
  text
)
to authenticated;



create or replace function
public.finalize_seat_product_oauth_connection(
  target_connection_id uuid,
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
as $seat_product_oauth_finalize$
declare
  normalized_provider text :=
    lower(
      btrim(
        coalesce(
          target_provider,
          ''
        )
      )
    );

  normalized_email text :=
    lower(
      btrim(
        coalesce(
          target_email,
          ''
        )
      )
    );

  normalized_scope text :=
    lower(
      coalesce(
        target_scope,
        ''
      )
    );

  connection_record record;

  scope_verified boolean :=
    false;

  deferred_capability text;
begin

  if target_actor_user_id is null then
    raise exception
      'The connecting Campaign Seat user is required.'
      using errcode = '22023';
  end if;


  if normalized_provider not in (
    'google',
    'microsoft'
  ) then
    raise exception
      'The connected provider must be Google or Microsoft.'
      using errcode = '22023';
  end if;


  if
    target_provider_grant_id is null
    or btrim(
      target_provider_grant_id
    ) = ''
  then
    raise exception
      'A verified Nylas grant is required.'
      using errcode = '22023';
  end if;


  if
    normalized_email = ''
    or position(
      '@' in normalized_email
    ) <= 1
  then
    raise exception
      'A valid connected provider email is required.'
      using errcode = '22023';
  end if;


  select
    connection.id,

    connection.product_account_id,

    catalog.integration_key,

    catalog.provider,

    contact.customer_id

  into connection_record

  from public.seat_product_account_integrations
    as connection

  join public.seat_integration_catalog
    as catalog
    on catalog.id =
      connection.integration_id

  join public.seat_product_accounts
    as account
    on account.id =
      connection.product_account_id

  join public.seat_customer_contacts
    as contact
    on contact.id =
      account.primary_contact_id

  join public.seat_onboarding_runs
    as onboarding
    on onboarding.product_account_id =
      account.id

  where
    connection.id =
      target_connection_id

    and connection.user_id =
      target_actor_user_id

    and contact.user_id =
      target_actor_user_id

    and contact.status =
      'active'

    and account.status =
      'onboarding'

    and onboarding.status =
      'in_progress'

    and onboarding.current_step_key in (
      'integrations',
      'activation'
    )

    and catalog.provider =
      normalized_provider

    and catalog.auth_type =
      'oauth2'

    and coalesce(
      connection.connection_metadata
        ->> 'onboarding_selected',
      'false'
    ) = 'true'

  order by
    onboarding.created_at desc

  limit 1

  for update of
    connection;


  if connection_record.id is null then
    raise exception
      'The Campaign Seat provider connection could not be verified.'
      using errcode = '42501';
  end if;


  if normalized_provider =
    'google'
  then

    scope_verified :=
      position(
        'gmail.readonly'
        in normalized_scope
      ) > 0

      and

      position(
        'gmail.send'
        in normalized_scope
      ) > 0

      and

      position(
        'contacts.readonly'
        in normalized_scope
      ) > 0

      and

      position(
        'calendar.readonly'
        in normalized_scope
      ) > 0

      and

      position(
        'calendar.events'
        in normalized_scope
      ) > 0;


    deferred_capability :=
      'drive';

  else

    scope_verified :=
      position(
        'mail.readwrite'
        in normalized_scope
      ) > 0

      and

      position(
        'mail.send'
        in normalized_scope
      ) > 0

      and

      position(
        'contacts.read'
        in normalized_scope
      ) > 0

      and

      position(
        'calendars.readwrite'
        in normalized_scope
      ) > 0;


    deferred_capability :=
      'onedrive';

  end if;


  if not scope_verified then
    raise exception
      'The provider authorization is missing one or more Campaign Seat email, contacts or calendar permissions.'
      using errcode = '42501';
  end if;


  insert into
  private.seat_product_integration_credentials (
    product_account_integration_id,
    credential_reference,
    provider_grant_id,
    scope,
    metadata,
    updated_at
  )
  values (
    connection_record.id,
    'nylas_grant',
    target_provider_grant_id,
    coalesce(
      target_scope,
      ''
    ),

    jsonb_build_object(
      'provider',
      normalized_provider,

      'email',
      normalized_email,

      'scope_verified',
      true,

      'connected_capabilities',
      jsonb_build_array(
        'email',
        'contacts',
        'calendar'
      ),

      'deferred_file_capability',
      deferred_capability
    ),

    now()
  )

  on conflict (
    product_account_integration_id
  )
  do update
  set
    credential_reference =
      excluded.credential_reference,

    provider_grant_id =
      excluded.provider_grant_id,

    scope =
      excluded.scope,

    metadata =
      excluded.metadata,

    updated_at =
      now();


  update
  public.seat_product_account_integrations
  set
    status =
      'connected',

    user_id =
      target_actor_user_id,

    display_name =
      normalized_email,

    display_email =
      normalized_email,

    external_account_id =
      null,

    connection_metadata =
      coalesce(
        connection_metadata,
        '{}'::jsonb
      ) ||
      jsonb_build_object(
        'credential_mode',
        'nylas_grant',

        'provider',
        normalized_provider,

        'scope_verified',
        true,

        'activation_core_ready',
        true,

        'connected_capabilities',
        jsonb_build_array(
          'email',
          'contacts',
          'calendar'
        ),

        'deferred_file_capability',
        deferred_capability,

        'connected_at',
        now()
      ),

    updated_at =
      now()

  where id =
    connection_record.id;


  insert into
  private.seat_security_events (
    actor_user_id,
    event_type,
    severity,
    customer_id,
    resource_type,
    resource_id,
    metadata,
    occurred_at
  )
  values (
    target_actor_user_id,

    'seat_product_provider_connected',

    'notice',

    connection_record.customer_id,

    'seat_product_account_integration',

    connection_record.id::text,

    jsonb_build_object(
      'integration_key',
      connection_record.integration_key,

      'provider',
      normalized_provider,

      'connected_email',
      normalized_email,

      'connected_capabilities',
      jsonb_build_array(
        'email',
        'contacts',
        'calendar'
      ),

      'deferred_file_capability',
      deferred_capability
    ),

    now()
  );


  return jsonb_build_object(
    'success',
    true,

    'connectionId',
    connection_record.id,

    'integrationKey',
    connection_record.integration_key,

    'provider',
    normalized_provider,

    'email',
    normalized_email,

    'connectedCapabilities',
    jsonb_build_array(
      'email',
      'contacts',
      'calendar'
    ),

    'deferredFileCapability',
    deferred_capability
  );
end;
$seat_product_oauth_finalize$;


revoke all
on function
public.finalize_seat_product_oauth_connection(
  uuid,
  uuid,
  text,
  text,
  text,
  text
)
from
  public,
  anon,
  authenticated;


notify pgrst, 'reload schema';

commit;

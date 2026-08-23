begin;

-- ============================================================
-- CAMPAIGN SEAT
-- OAUTH ACTOR REFERENCE REPAIR
--
-- Fixes ambiguous actor_user_id references in the pre-workspace
-- Product Account OAuth state functions.
--
-- No customer data is changed.
-- No provider connection is fabricated.
-- ============================================================


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
  current_actor_user_id uuid :=
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


  if current_actor_user_id is null then
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
      current_actor_user_id

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


  update
  private.seat_product_oauth_states
    as state_row

  set
    consumed_at =
      coalesce(
        state_row.consumed_at,
        now()
      ),

    updated_at =
      now()

  where
    state_row.product_account_integration_id =
      connection_record.connection_id

    and state_row.actor_user_id =
      current_actor_user_id

    and state_row.consumed_at
      is null;


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
    current_actor_user_id,
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
      current_actor_user_id,

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
  current_actor_user_id uuid :=
    auth.uid();

  oauth_record
    private.seat_product_oauth_states%rowtype;
begin

  perform public.require_aal2();


  if current_actor_user_id is null then
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


  select
    state_row.*

  into oauth_record

  from private.seat_product_oauth_states
    as state_row

  where
    state_row.state_hash =
      encode(
        extensions.digest(
          target_state,
          'sha256'
        ),
        'hex'
      )

    and state_row.actor_user_id =
      current_actor_user_id

    and state_row.consumed_at
      is null

    and state_row.expires_at >
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
        current_actor_user_id

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
    as state_row

  set
    consumed_at =
      now(),

    updated_at =
      now()

  where state_row.id =
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


notify pgrst, 'reload schema';

commit;

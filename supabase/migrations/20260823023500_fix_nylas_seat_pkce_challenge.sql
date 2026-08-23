begin;

-- ============================================================
-- CAMPAIGN SEAT
-- NYLAS PRODUCT-ACCOUNT PKCE REPAIR
--
-- Nylas Hosted OAuth PKCE expects the same challenge format
-- already used by Campaign Seat's existing workspace OAuth:
--
-- verifier
--   -> SHA-256
--   -> hexadecimal digest text
--   -> Base64 encode that text
--   -> remove padding
--
-- No provider connection is created by this migration.
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


  -- Retire any failed/abandoned attempt for this provider.
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
    rtrim(
      translate(
        replace(
          encode(
            gen_random_bytes(48),
            'base64'
          ),
          chr(10),
          ''
        ),
        '+/',
        '-_'
      ),
      '='
    );


  -- IMPORTANT:
  -- Match Nylas Hosted OAuth's documented PKCE construction
  -- and Campaign Seat's existing workspace OAuth behavior.
  encoded_challenge :=
    rtrim(
      replace(
        encode(
          convert_to(
            encode(
              extensions.digest(
                raw_code_verifier,
                'sha256'
              ),
              'hex'
            ),
            'UTF8'
          ),
          'base64'
        ),
        chr(10),
        ''
      ),
      '='
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


notify pgrst, 'reload schema';

commit;

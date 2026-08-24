begin;

-- ============================================================
-- CAMPAIGN SEAT
-- PRODUCT ACCOUNT → WORKSPACE INTEGRATION BRIDGE
--
-- The secure client onboarding connects provider grants before
-- a Campaign workspace exists.
--
-- When Activation eventually creates the real primary workspace
-- binding, this bridge:
--
--   * copies only VERIFIED capabilities
--   * keeps Nylas grants in private schema
--   * supports Google + Microsoft using the same email address
--   * creates no Gmail runtime when Gmail was unavailable
--   * preserves multiple Calendar / Contacts providers
--   * makes the provider with verified Email the primary runtime
--
-- Creating this migration DOES NOT activate any account.
-- ============================================================


create or replace function
private.bridge_seat_product_integrations_to_workspace(
  target_product_account_id uuid,
  target_workspace_id uuid,
  target_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $seat_bridge_integrations$
declare
  provider_record record;

  normalized_provider text;
  normalized_email text;
  runtime_connection_key text;

  probe_data jsonb;

  email_ready boolean;
  calendar_ready boolean;
  contacts_ready boolean;

  send_ready boolean;
  calendar_write_ready boolean;

  runtime_priority integer;

  connected_by_user_id uuid;

  runtime_integration_id uuid;

  bridged_count integer :=
    0;

  provider_count integer :=
    0;

  bridged_rows jsonb :=
    '[]'::jsonb;
begin

  if target_product_account_id
    is null
  then
    raise exception
      'A Product Account is required for the integration bridge.';
  end if;


  if target_workspace_id
    is null
  then
    raise exception
      'A Campaign workspace is required for the integration bridge.';
  end if;


  if not exists (
    select 1

    from public.seat_product_accounts
      as account

    where account.id =
      target_product_account_id
  )
  then
    raise exception
      'The Product Account for the integration bridge was not found.';
  end if;


  if not exists (
    select 1

    from public.workspaces
      as workspace

    where workspace.id =
      target_workspace_id
  )
  then
    raise exception
      'The Campaign workspace for the integration bridge was not found.';
  end if;


  for provider_record in

    select
      connection.id
        as product_integration_id,

      connection.user_id,

      connection.display_email,

      connection.connection_metadata,

      catalog.provider,

      catalog.integration_key,

      credential.provider_grant_id,

      credential.scope,

      credential.metadata
        as credential_metadata

    from public.seat_product_account_integrations
      as connection

    join public.seat_integration_catalog
      as catalog
      on catalog.id =
        connection.integration_id

    join private.seat_product_integration_credentials
      as credential
      on credential.product_account_integration_id =
        connection.id

    where
      connection.product_account_id =
        target_product_account_id

      and connection.status =
        'connected'

      and coalesce(
        connection.connection_metadata
          ->> 'onboarding_selected',
        'false'
      ) = 'true'

      and catalog.provider in (
        'google',
        'microsoft'
      )

      and credential.credential_reference =
        'nylas_grant'

    order by
      catalog.provider,
      catalog.integration_key

  loop

    normalized_provider :=
      lower(
        btrim(
          coalesce(
            provider_record.provider,
            ''
          )
        )
      );


    normalized_email :=
      lower(
        btrim(
          coalesce(
            provider_record.display_email,
            ''
          )
        )
      );


    if normalized_provider not in (
      'google',
      'microsoft'
    )
    then
      raise exception
        'An unsupported provider reached the Campaign Seat integration bridge.';
    end if;


    if
      normalized_email = ''
      or position(
        '@'
        in normalized_email
      ) <= 1
    then
      raise exception
        'A connected provider email is missing from the Campaign Seat integration bridge.';
    end if;


    if
      provider_record.provider_grant_id
        is null

      or btrim(
        provider_record.provider_grant_id
      ) = ''
    then
      raise exception
        'A verified private Nylas grant is missing from the Campaign Seat integration bridge.';
    end if;


    probe_data :=
      provider_record.connection_metadata
        -> 'data_probe';


    if
      probe_data is null
      or jsonb_typeof(
        probe_data
      ) <> 'object'
    then
      raise exception
        'Verify connected provider data before Campaign Seat Activation.';
    end if;


    if nullif(
      btrim(
        coalesce(
          probe_data
            ->> 'verified_at',
          ''
        )
      ),
      ''
    ) is null
    then
      raise exception
        'Provider data verification must be completed before Campaign Seat Activation.';
    end if;


    email_ready :=
      coalesce(
        (
          probe_data
            ->> 'email_read'
        )::boolean,
        false
      );


    calendar_ready :=
      coalesce(
        (
          probe_data
            ->> 'calendar_read'
        )::boolean,
        false
      );


    contacts_ready :=
      coalesce(
        (
          probe_data
            ->> 'contacts_read'
        )::boolean,
        false
      );


    if not (
      email_ready
      or calendar_ready
      or contacts_ready
    )
    then
      raise exception
        'The connected provider has no verified Campaign Seat runtime capabilities.';
    end if;


    send_ready :=
      case

        when normalized_provider =
          'google'
        then
          position(
            'gmail.send'
            in lower(
              coalesce(
                provider_record.scope,
                ''
              )
            )
          ) > 0

        else
          position(
            'mail.send'
            in lower(
              coalesce(
                provider_record.scope,
                ''
              )
            )
          ) > 0

          and

          position(
            'mail.readwrite'
            in lower(
              coalesce(
                provider_record.scope,
                ''
              )
            )
          ) > 0

      end;


    calendar_write_ready :=
      case

        when normalized_provider =
          'google'
        then
          position(
            'calendar.events'
            in lower(
              coalesce(
                provider_record.scope,
                ''
              )
            )
          ) > 0

        else
          position(
            'calendars.readwrite'
            in lower(
              coalesce(
                provider_record.scope,
                ''
              )
            )
          ) > 0

      end;


    -- An Email-capable provider is preferred by the existing
    -- singular Calendar runtime resolver.
    runtime_priority :=
      case
        when email_ready
          then 100
        else 50
      end;


    -- Both Google and Microsoft may legitimately use the same
    -- visible email address. Include provider in the internal
    -- connection key so runtime rows never collide.
    runtime_connection_key :=
      normalized_provider ||
      ':' ||
      normalized_email;


    connected_by_user_id :=
      coalesce(
        target_actor_user_id,
        provider_record.user_id
      );


    if
      connected_by_user_id
        is not null

      and not exists (
        select 1
        from public.profiles
          as profile
        where profile.id =
          connected_by_user_id
      )
    then
      connected_by_user_id :=
        null;
    end if;


    provider_count :=
      provider_count + 1;


    -- ========================================================
    -- EMAIL
    -- ========================================================

    if email_ready then

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
        runtime_connection_key,
        'connected',
        normalized_email,
        normalized_email,
        null,

        jsonb_build_object(
          'read',
          true,

          'send',
          send_ready,

          'reply',
          send_ready,

          'idempotent_send',
          send_ready,

          'progressive_send_permission',
          false
        ),

        jsonb_build_object(
          'account_provider',
          normalized_provider,

          'credential_mode',
          'nylas_grant',

          'scope_verified',
          true,

          'send_scope_verified',
          send_ready,

          'runtime_priority',
          runtime_priority,

          'activation_bridge',
          true,

          'source_product_integration_id',
          provider_record.product_integration_id,

          'data_probe_verified_at',
          probe_data
            ->> 'verified_at'
        ),

        now(),
        connected_by_user_id,
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
          null,

        capabilities =
          excluded.capabilities,

        settings =
          excluded.settings,

        last_success_at =
          now(),

        connected_by =
          excluded.connected_by,

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
      into runtime_integration_id;


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
        runtime_integration_id,
        'nylas_grant',
        provider_record.provider_grant_id,
        null,

        jsonb_build_object(
          'account_provider',
          normalized_provider,

          'scope',
          coalesce(
            provider_record.scope,
            ''
          ),

          'source_product_integration_id',
          provider_record.product_integration_id,

          'data_probe_verified_at',
          probe_data
            ->> 'verified_at',

          'bridged_at',
          now()
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
          excluded.provider_grant_id,

        token_expires_at =
          null,

        metadata =
          excluded.metadata,

        updated_at =
          now();


      bridged_count :=
        bridged_count + 1;


      bridged_rows :=
        bridged_rows ||
        jsonb_build_array(
          jsonb_build_object(
            'provider',
            normalized_provider,

            'type',
            'email',

            'email',
            normalized_email,

            'runtime_priority',
            runtime_priority
          )
        );

    end if;


    -- ========================================================
    -- CALENDAR
    -- ========================================================

    if calendar_ready then

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
        'calendar',
        runtime_connection_key,
        'connected',
        normalized_email,
        normalized_email,
        null,

        jsonb_build_object(
          'read',
          true,

          'write',
          calendar_write_ready,

          'two_way_sync',
          calendar_write_ready
        ),

        jsonb_build_object(
          'account_provider',
          normalized_provider,

          'credential_mode',
          'nylas_grant',

          'scope_verified',
          true,

          'runtime_priority',
          runtime_priority,

          'activation_bridge',
          true,

          'source_product_integration_id',
          provider_record.product_integration_id,

          'data_probe_verified_at',
          probe_data
            ->> 'verified_at',

          'primary_calendar_name',
          coalesce(
            probe_data
              ->> 'primary_calendar_name',
            ''
          ),

          'primary_calendar_timezone',
          coalesce(
            probe_data
              ->> 'primary_calendar_timezone',
            ''
          ),

          'probe_calendar_count',
          greatest(
            coalesce(
              (
                probe_data
                  ->> 'visible_calendar_count'
              )::integer,
              0
            ),
            0
          )
        ),

        now(),
        connected_by_user_id,
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
          null,

        capabilities =
          excluded.capabilities,

        settings =
          excluded.settings,

        last_success_at =
          now(),

        connected_by =
          excluded.connected_by,

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
      into runtime_integration_id;


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
        runtime_integration_id,
        'nylas_grant',
        provider_record.provider_grant_id,
        null,

        jsonb_build_object(
          'account_provider',
          normalized_provider,

          'scope',
          coalesce(
            provider_record.scope,
            ''
          ),

          'source_product_integration_id',
          provider_record.product_integration_id,

          'data_probe_verified_at',
          probe_data
            ->> 'verified_at',

          'bridged_at',
          now()
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
          excluded.provider_grant_id,

        token_expires_at =
          null,

        metadata =
          excluded.metadata,

        updated_at =
          now();


      bridged_count :=
        bridged_count + 1;


      bridged_rows :=
        bridged_rows ||
        jsonb_build_array(
          jsonb_build_object(
            'provider',
            normalized_provider,

            'type',
            'calendar',

            'email',
            normalized_email,

            'runtime_priority',
            runtime_priority
          )
        );

    end if;


    -- ========================================================
    -- CONTACTS
    -- ========================================================

    if contacts_ready then

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
        runtime_connection_key,
        'connected',
        normalized_email,
        normalized_email,
        null,

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
          normalized_provider,

          'credential_mode',
          'nylas_grant',

          'runtime_priority',
          runtime_priority,

          'activation_bridge',
          true,

          'source_product_integration_id',
          provider_record.product_integration_id,

          'data_probe_verified_at',
          probe_data
            ->> 'verified_at'
        ),

        now(),
        connected_by_user_id,
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
          null,

        capabilities =
          excluded.capabilities,

        settings =
          excluded.settings,

        last_success_at =
          now(),

        connected_by =
          excluded.connected_by,

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
      into runtime_integration_id;


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
        runtime_integration_id,
        'nylas_grant',
        provider_record.provider_grant_id,
        null,

        jsonb_build_object(
          'account_provider',
          normalized_provider,

          'scope',
          coalesce(
            provider_record.scope,
            ''
          ),

          'source_product_integration_id',
          provider_record.product_integration_id,

          'data_probe_verified_at',
          probe_data
            ->> 'verified_at',

          'bridged_at',
          now()
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
          excluded.provider_grant_id,

        token_expires_at =
          null,

        metadata =
          excluded.metadata,

        updated_at =
          now();


      bridged_count :=
        bridged_count + 1;


      bridged_rows :=
        bridged_rows ||
        jsonb_build_array(
          jsonb_build_object(
            'provider',
            normalized_provider,

            'type',
            'contacts',

            'email',
            normalized_email,

            'runtime_priority',
            runtime_priority
          )
        );

    end if;

  end loop;


  return jsonb_build_object(
    'success',
    true,

    'provider_count',
    provider_count,

    'runtime_integration_count',
    bridged_count,

    'runtime_integrations',
    bridged_rows
  );

end;
$seat_bridge_integrations$;


revoke all
on function
private.bridge_seat_product_integrations_to_workspace(
  uuid,
  uuid,
  uuid
)
from
  public,
  anon,
  authenticated;



-- ============================================================
-- TRIGGER
--
-- Activation already creates the active primary Product Account
-- ↔ Workspace binding inside the same transaction.
--
-- Bridge integrations at that exact moment.
-- ============================================================

create or replace function
private.bridge_seat_integrations_from_workspace_binding()
returns trigger
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $seat_binding_integration_bridge$
begin

  if
    new.relationship_type =
      'primary'

    and new.status =
      'active'

    and (
      tg_op =
        'INSERT'

      or old.product_account_id
        is distinct from
        new.product_account_id

      or old.workspace_id
        is distinct from
        new.workspace_id

      or old.status
        is distinct from
        new.status

      or old.relationship_type
        is distinct from
        new.relationship_type
    )
  then

    perform
    private.bridge_seat_product_integrations_to_workspace(
      new.product_account_id,
      new.workspace_id,
      auth.uid()
    );

  end if;


  return new;

end;
$seat_binding_integration_bridge$;


revoke all
on function
private.bridge_seat_integrations_from_workspace_binding()
from
  public,
  anon,
  authenticated;


drop trigger if exists
seat_workspace_binding_integration_bridge
on public.seat_workspace_bindings;


create trigger
seat_workspace_binding_integration_bridge

after insert
or update of
  product_account_id,
  workspace_id,
  relationship_type,
  status

on public.seat_workspace_bindings

for each row

execute function
private.bridge_seat_integrations_from_workspace_binding();



-- ============================================================
-- RUNTIME PRIORITY
--
-- The workspace may preserve multiple provider calendars.
-- Existing singular runtime consumers should choose the provider
-- with the strongest verified runtime capability.
-- ============================================================

create or replace function
public.get_calendar_runtime_connection(
  target_workspace_id uuid
)
returns table (
  integration_id uuid,
  connected_email text,
  account_provider text,
  grant_reference text,
  read_ready boolean,
  write_ready boolean
)
language sql
stable
security definer
set search_path =
  public,
  private,
  pg_temp
as $calendar_runtime$
  select
    integration.id,

    integration.display_email,

    integration.settings
      ->> 'account_provider',

    credential.provider_grant_id,

    coalesce(
      (
        integration.capabilities
          ->> 'read'
      )::boolean,
      false
    ),

    coalesce(
      (
        integration.capabilities
          ->> 'write'
      )::boolean,
      false
    )

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
      'calendar'

    and integration.status =
      'connected'

    and credential.provider_grant_id
      is not null

    and btrim(
      credential.provider_grant_id
    ) <> ''

  order by
    case
      when coalesce(
        integration.settings
          ->> 'runtime_priority',
        ''
      ) ~ '^[0-9]+$'
      then (
        integration.settings
          ->> 'runtime_priority'
      )::integer
      else 0
    end desc,

    integration.connected_at desc
      nulls last,

    integration.id

  limit 1;
$calendar_runtime$;



create or replace function
public.get_email_runtime_connection(
  target_workspace_id uuid
)
returns table (
  integration_id uuid,
  connected_email text,
  account_provider text,
  grant_reference text,
  read_ready boolean,
  send_ready boolean
)
language sql
stable
security definer
set search_path =
  public,
  private,
  pg_temp
as $email_runtime$
  select
    integration.id,

    integration.display_email,

    integration.settings
      ->> 'account_provider',

    credential.provider_grant_id,

    coalesce(
      (
        integration.capabilities
          ->> 'read'
      )::boolean,
      false
    ),

    coalesce(
      (
        integration.capabilities
          ->> 'send'
      )::boolean,
      false
    )

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

    and credential.provider_grant_id
      is not null

    and btrim(
      credential.provider_grant_id
    ) <> ''

  order by
    case
      when coalesce(
        integration.settings
          ->> 'runtime_priority',
        ''
      ) ~ '^[0-9]+$'
      then (
        integration.settings
          ->> 'runtime_priority'
      )::integer
      else 0
    end desc,

    integration.connected_at desc
      nulls last,

    integration.id

  limit 1;
$email_runtime$;



-- ============================================================
-- FUTURE MULTI-PROVIDER RUNTIME RESOLVERS
--
-- These expose all runtime connections to trusted server-side
-- consumers without ever returning grants to the browser.
-- ============================================================

create or replace function
private.get_calendar_runtime_connections(
  target_workspace_id uuid
)
returns table (
  integration_id uuid,
  connected_email text,
  account_provider text,
  grant_reference text,
  read_ready boolean,
  write_ready boolean,
  runtime_priority integer
)
language sql
stable
security definer
set search_path =
  public,
  private,
  pg_temp
as $calendar_runtime_all$
  select
    integration.id,

    integration.display_email,

    integration.settings
      ->> 'account_provider',

    credential.provider_grant_id,

    coalesce(
      (
        integration.capabilities
          ->> 'read'
      )::boolean,
      false
    ),

    coalesce(
      (
        integration.capabilities
          ->> 'write'
      )::boolean,
      false
    ),

    case
      when coalesce(
        integration.settings
          ->> 'runtime_priority',
        ''
      ) ~ '^[0-9]+$'
      then (
        integration.settings
          ->> 'runtime_priority'
      )::integer
      else 0
    end

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
      'calendar'

    and integration.status =
      'connected'

    and credential.provider_grant_id
      is not null

    and btrim(
      credential.provider_grant_id
    ) <> ''

  order by
    7 desc,
    integration.connected_at desc
      nulls last,
    integration.id;
$calendar_runtime_all$;


revoke all
on function
private.get_calendar_runtime_connections(
  uuid
)
from
  public,
  anon,
  authenticated;


grant execute
on function
private.get_calendar_runtime_connections(
  uuid
)
to service_role;



create or replace function
private.get_email_runtime_connections(
  target_workspace_id uuid
)
returns table (
  integration_id uuid,
  connected_email text,
  account_provider text,
  grant_reference text,
  read_ready boolean,
  send_ready boolean,
  runtime_priority integer
)
language sql
stable
security definer
set search_path =
  public,
  private,
  pg_temp
as $email_runtime_all$
  select
    integration.id,

    integration.display_email,

    integration.settings
      ->> 'account_provider',

    credential.provider_grant_id,

    coalesce(
      (
        integration.capabilities
          ->> 'read'
      )::boolean,
      false
    ),

    coalesce(
      (
        integration.capabilities
          ->> 'send'
      )::boolean,
      false
    ),

    case
      when coalesce(
        integration.settings
          ->> 'runtime_priority',
        ''
      ) ~ '^[0-9]+$'
      then (
        integration.settings
          ->> 'runtime_priority'
      )::integer
      else 0
    end

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

    and credential.provider_grant_id
      is not null

    and btrim(
      credential.provider_grant_id
    ) <> ''

  order by
    7 desc,
    integration.connected_at desc
      nulls last,
    integration.id;
$email_runtime_all$;


revoke all
on function
private.get_email_runtime_connections(
  uuid
)
from
  public,
  anon,
  authenticated;


grant execute
on function
private.get_email_runtime_connections(
  uuid
)
to service_role;


notify pgrst, 'reload schema';

commit;

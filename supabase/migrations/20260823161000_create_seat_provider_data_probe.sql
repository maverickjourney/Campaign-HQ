begin;

-- ============================================================
-- CAMPAIGN SEAT
-- PRE-ACTIVATION PROVIDER DATA PROBE
--
-- Gives a trusted Edge Function the protected Nylas grant needed
-- to verify Email + Calendar + Contacts access.
--
-- Grant references never go to the browser.
-- ============================================================

create or replace function
public.get_seat_product_provider_probe_runtime(
  target_integration_key text,
  target_actor_user_id uuid
)
returns table (
  connection_id uuid,
  provider text,
  integration_key text,
  connected_email text,
  grant_reference text,
  granted_scope text
)
language sql
stable
security definer
set search_path =
  public,
  private,
  pg_temp
as $seat_provider_probe_runtime$

  select
    connection.id,

    catalog.provider,

    catalog.integration_key,

    connection.display_email,

    credential.provider_grant_id,

    credential.scope

  from public.seat_customer_contacts
    as contact

  join public.seat_product_accounts
    as account
    on account.primary_contact_id =
      contact.id

  join public.seat_product_account_integrations
    as connection
    on connection.product_account_id =
      account.id

  join public.seat_integration_catalog
    as catalog
    on catalog.id =
      connection.integration_id

  join private.seat_product_integration_credentials
    as credential
    on credential.product_account_integration_id =
      connection.id

  where
    contact.user_id =
      target_actor_user_id

    and contact.status =
      'active'

    and account.status =
      'onboarding'

    and connection.status =
      'connected'

    and catalog.integration_key =
      lower(
        btrim(
          target_integration_key
        )
      )

    and catalog.integration_key in (
      'google_workspace',
      'microsoft_365'
    )

    and credential.credential_reference =
      'nylas_grant'

    and credential.provider_grant_id
      is not null

    and btrim(
      credential.provider_grant_id
    ) <> ''

  order by
    connection.updated_at desc

  limit 1;

$seat_provider_probe_runtime$;


revoke all
on function
public.get_seat_product_provider_probe_runtime(
  text,
  uuid
)
from
  public,
  anon,
  authenticated;


grant execute
on function
public.get_seat_product_provider_probe_runtime(
  text,
  uuid
)
to service_role;


notify pgrst, 'reload schema';

commit;

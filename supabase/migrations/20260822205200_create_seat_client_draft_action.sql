begin;

create or replace function public.create_seat_client_draft(
  target_product_id uuid,
  target_customer_name text,
  target_customer_type text,
  target_primary_contact_name text,
  target_primary_contact_email text,
  target_primary_contact_phone text default null,
  target_package_id uuid default null,
  target_monthly_cents integer default 0,
  target_setup_cents integer default 0,
  target_contract_term_months integer default null,
  target_notes text default null,
  target_metadata jsonb default '{}'::jsonb
)
returns table (
  customer_id uuid,
  contact_id uuid,
  deal_id uuid,
  deal_code text
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $seat_create_client$
declare
  actor_user_id uuid := auth.uid();

  normalized_customer_name text :=
    btrim(coalesce(target_customer_name, ''));

  normalized_contact_name text :=
    btrim(coalesce(target_primary_contact_name, ''));

  normalized_email text :=
    lower(btrim(coalesce(target_primary_contact_email, '')));

  normalized_phone text :=
    nullif(btrim(coalesce(target_primary_contact_phone, '')), '');

  created_customer_id uuid;
  created_contact_id uuid;
  created_deal_id uuid;
  created_deal_code text;
begin
  if actor_user_id is null then
    raise exception
      'A signed-in Seat Platform session is required.'
      using errcode = '42501';
  end if;

  if not public.seat_platform_admin_authorized() then
    raise exception
      'Platform Owner or Platform Admin MFA authorization is required.'
      using errcode = '42501';
  end if;

  if normalized_customer_name = '' then
    raise exception 'Customer name is required.';
  end if;

  if normalized_contact_name = '' then
    raise exception 'Primary contact name is required.';
  end if;

  if normalized_email = ''
     or position('@' in normalized_email) <= 1 then
    raise exception 'A valid primary contact email is required.';
  end if;

  if target_customer_type not in (
    'campaign',
    'firm',
    'government',
    'association',
    'nonprofit',
    'business',
    'organization',
    'individual',
    'other'
  ) then
    raise exception 'Invalid customer type.';
  end if;

  if target_monthly_cents < 0
     or target_setup_cents < 0 then
    raise exception 'Pricing cannot be negative.';
  end if;

  if target_contract_term_months is not null
     and target_contract_term_months < 0 then
    raise exception 'Contract term cannot be negative.';
  end if;

  if jsonb_typeof(coalesce(target_metadata, '{}'::jsonb)) <> 'object' then
    raise exception 'Client metadata must be a JSON object.';
  end if;

  if not exists (
    select 1
    from public.seat_products product
    where product.id = target_product_id
      and product.status = 'active'
  ) then
    raise exception 'Selected Seat product is not active.';
  end if;

  if target_package_id is not null
     and not exists (
       select 1
       from public.seat_packages package
       where package.id = target_package_id
         and package.product_id = target_product_id
         and package.status <> 'retired'
     ) then
    raise exception 'Selected package is unavailable.';
  end if;

  if exists (
    select 1
    from public.seat_customers customer
    join public.seat_customer_contacts contact
      on contact.customer_id = customer.id
    where lower(btrim(customer.display_name)) =
          lower(normalized_customer_name)
      and lower(btrim(contact.email)) = normalized_email
      and customer.status <> 'cancelled'
      and contact.status = 'active'
  ) then
    raise exception
      'A matching customer and contact already exists.'
      using errcode = '23505';
  end if;

  insert into public.seat_customers (
    display_name,
    customer_type,
    status,
    billing_email,
    phone,
    metadata,
    created_by
  )
  values (
    normalized_customer_name,
    target_customer_type,
    'prospect',
    normalized_email,
    normalized_phone,
    jsonb_build_object(
      'created_from',
      'seat_platform_admin'
    ),
    actor_user_id
  )
  returning id
  into created_customer_id;

  insert into public.seat_customer_contacts (
    customer_id,
    full_name,
    email,
    phone,
    is_primary,
    is_billing,
    is_onboarding,
    status,
    metadata
  )
  values (
    created_customer_id,
    normalized_contact_name,
    normalized_email,
    normalized_phone,
    true,
    true,
    true,
    'active',
    jsonb_build_object(
      'created_from',
      'seat_platform_admin'
    )
  )
  returning id
  into created_contact_id;

  insert into public.seat_deals (
    customer_id,
    product_id,
    stage,
    currency,
    expected_monthly_cents,
    expected_setup_cents,
    contract_term_months,
    owner_user_id,
    notes,
    metadata
  )
  values (
    created_customer_id,
    target_product_id,
    'proposal',
    'USD',
    target_monthly_cents,
    target_setup_cents,
    target_contract_term_months,
    actor_user_id,
    nullif(btrim(coalesce(target_notes, '')), ''),
    coalesce(target_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'package_id',
        target_package_id,
        'created_from',
        'seat_platform_admin'
      )
  )
  returning id, seat_deals.deal_code
  into created_deal_id, created_deal_code;

  insert into private.seat_security_events (
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
    actor_user_id,
    'seat_client_draft_created',
    'notice',
    created_customer_id,
    'seat_deal',
    created_deal_id::text,
    jsonb_build_object(
      'product_id',
      target_product_id,
      'package_id',
      target_package_id
    ),
    now()
  );

  return query
  select
    created_customer_id,
    created_contact_id,
    created_deal_id,
    created_deal_code;
end;
$seat_create_client$;

revoke all
on function public.create_seat_client_draft(
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid,
  integer,
  integer,
  integer,
  text,
  jsonb
)
from public, anon;

grant execute
on function public.create_seat_client_draft(
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid,
  integer,
  integer,
  integer,
  text,
  jsonb
)
to authenticated;

comment on function public.create_seat_client_draft(
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid,
  integer,
  integer,
  integer,
  text,
  jsonb
)
is
  'Atomically creates a Seat customer, primary contact and commercial deal. Requires Platform Owner/Admin and MFA/AAL2.';

notify pgrst, 'reload schema';

commit;

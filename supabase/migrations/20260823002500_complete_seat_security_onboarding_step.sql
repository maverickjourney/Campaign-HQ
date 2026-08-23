begin;

-- ============================================================
-- CAMPAIGN SEAT
-- CLIENT ONBOARDING — SECURITY COMPLETION
--
-- Security may advance ONLY when:
--   * the user owns the active onboarding contact
--   * Security is the current onboarding step
--   * the current authenticated JWT is AAL2
--
-- No workspace is created here.
-- ============================================================

create or replace function
public.complete_my_seat_security_step()
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  auth,
  pg_temp
as $seat_security_onboarding$
declare
  actor_user_id uuid :=
    auth.uid();

  onboarding_record record;

  current_aal text :=
    coalesce(
      auth.jwt()->>'aal',
      'aal1'
    );
begin

  if actor_user_id is null then
    raise exception
      'Sign in to continue onboarding.'
      using errcode = '42501';
  end if;


  perform public.require_aal2();


  select
    contact.customer_id,

    account.id
      as product_account_id,

    onboarding.id
      as onboarding_run_id,

    onboarding.current_step_key,

    onboarding.status
      as onboarding_status

  into onboarding_record

  from public.seat_customer_contacts
    as contact

  join public.seat_product_accounts
    as account
    on account.primary_contact_id =
      contact.id

  join public.seat_products
    as product
    on product.id =
      account.product_id

  join public.seat_onboarding_runs
    as onboarding
    on onboarding.product_account_id =
      account.id

  where
    contact.user_id =
      actor_user_id

    and contact.status =
      'active'

    and product.product_key =
      'campaign'

    and account.status in (
      'pending_onboarding',
      'onboarding'
    )

    and onboarding.status =
      'in_progress'

  order by
    onboarding.created_at desc

  limit 1

  for update of onboarding;


  if onboarding_record.onboarding_run_id
    is null
  then
    raise exception
      'An active Campaign Seat onboarding run was not found.'
      using errcode = '42501';
  end if;


  if onboarding_record.current_step_key <>
    'security'
  then
    raise exception
      'Security is not the current onboarding step.';
  end if;


  update public.seat_onboarding_run_steps
  set
    status =
      'complete',

    step_data =
      coalesce(
        step_data,
        '{}'::jsonb
      ) ||
      jsonb_build_object(
        'aal',
        current_aal,
        'mfa_verified',
        true,
        'verified_at',
        now()
      ),

    completed_at =
      now(),

    completed_by_user_id =
      actor_user_id,

    updated_at =
      now()

  where
    onboarding_run_id =
      onboarding_record.onboarding_run_id

    and step_key =
      'security';


  update public.seat_onboarding_run_steps
  set
    status =
      'in_progress',

    started_at =
      coalesce(
        started_at,
        now()
      ),

    updated_at =
      now()

  where
    onboarding_run_id =
      onboarding_record.onboarding_run_id

    and step_key =
      'billing'

    and status =
      'pending';


  update public.seat_onboarding_runs
  set
    current_step_key =
      'billing',

    updated_at =
      now()

  where id =
    onboarding_record.onboarding_run_id;


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
    actor_user_id,
    'seat_client_security_completed',
    'notice',
    onboarding_record.customer_id,
    'seat_product_account',
    onboarding_record.product_account_id::text,
    jsonb_build_object(
      'onboarding_run_id',
      onboarding_record.onboarding_run_id,
      'aal',
      current_aal
    ),
    now()
  );


  return jsonb_build_object(
    'ok',
    true,
    'current_step_key',
    'billing',
    'aal',
    current_aal
  );
end;
$seat_security_onboarding$;


revoke all
on function
public.complete_my_seat_security_step()
from
  public,
  anon;


grant execute
on function
public.complete_my_seat_security_step()
to authenticated;


notify pgrst, 'reload schema';

commit;

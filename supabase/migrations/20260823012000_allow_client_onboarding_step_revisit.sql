begin;

create or replace function
public.reopen_my_seat_onboarding_step(
  requested_step_key text
)
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $seat_reopen_step$
declare
  actor_user_id uuid :=
    auth.uid();

  requested_key text :=
    lower(
      btrim(
        coalesce(
          requested_step_key,
          ''
        )
      )
    );

  onboarding_record record;

  requested_status text;

  requested_order integer;

  current_order integer;
begin

  if actor_user_id is null then
    raise exception
      'Sign in to continue onboarding.'
      using errcode = '42501';
  end if;


  if requested_key not in (
    'product_profile',
    'security',
    'billing',
    'integrations',
    'team'
  ) then
    raise exception
      'That onboarding step cannot be reopened.';
  end if;


  select
    contact.customer_id,

    account.id
      as product_account_id,

    onboarding.id
      as onboarding_run_id,

    onboarding.current_step_key

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


  requested_order :=
    case requested_key
      when 'account_setup' then 1
      when 'product_profile' then 2
      when 'security' then 3
      when 'billing' then 4
      when 'integrations' then 5
      when 'team' then 6
      when 'review' then 7
      when 'activation' then 8
      else 999
    end;


  current_order :=
    case onboarding_record.current_step_key
      when 'account_setup' then 1
      when 'product_profile' then 2
      when 'security' then 3
      when 'billing' then 4
      when 'integrations' then 5
      when 'team' then 6
      when 'review' then 7
      when 'activation' then 8
      else 999
    end;


  select status
  into requested_status

  from public.seat_onboarding_run_steps

  where
    onboarding_run_id =
      onboarding_record.onboarding_run_id

    and step_key =
      requested_key;


  if requested_status <>
    'complete'
  then
    raise exception
      'Only completed onboarding steps can be reopened.';
  end if;


  if requested_order >=
    current_order
  then
    raise exception
      'Choose an earlier completed onboarding step.';
  end if;


  update public.seat_onboarding_run_steps
  set
    status =
      case
        when step_key =
          requested_key
        then 'in_progress'

        when (
          case step_key
            when 'account_setup' then 1
            when 'product_profile' then 2
            when 'security' then 3
            when 'billing' then 4
            when 'integrations' then 5
            when 'team' then 6
            when 'review' then 7
            when 'activation' then 8
            else 999
          end
        ) > requested_order
        then 'pending'

        else status
      end,

    started_at =
      case
        when step_key =
          requested_key
        then now()

        when (
          case step_key
            when 'account_setup' then 1
            when 'product_profile' then 2
            when 'security' then 3
            when 'billing' then 4
            when 'integrations' then 5
            when 'team' then 6
            when 'review' then 7
            when 'activation' then 8
            else 999
          end
        ) > requested_order
        then null

        else started_at
      end,

    completed_at =
      case
        when (
          case step_key
            when 'account_setup' then 1
            when 'product_profile' then 2
            when 'security' then 3
            when 'billing' then 4
            when 'integrations' then 5
            when 'team' then 6
            when 'review' then 7
            when 'activation' then 8
            else 999
          end
        ) >= requested_order
        then null

        else completed_at
      end,

    completed_by_user_id =
      case
        when (
          case step_key
            when 'account_setup' then 1
            when 'product_profile' then 2
            when 'security' then 3
            when 'billing' then 4
            when 'integrations' then 5
            when 'team' then 6
            when 'review' then 7
            when 'activation' then 8
            else 999
          end
        ) >= requested_order
        then null

        else completed_by_user_id
      end,

    updated_at =
      now()

  where
    onboarding_run_id =
      onboarding_record.onboarding_run_id

    and (
      step_key =
        requested_key

      or (
        case step_key
          when 'account_setup' then 1
          when 'product_profile' then 2
          when 'security' then 3
          when 'billing' then 4
          when 'integrations' then 5
          when 'team' then 6
          when 'review' then 7
          when 'activation' then 8
          else 999
        end
      ) > requested_order
    );


  update public.seat_onboarding_runs
  set
    current_step_key =
      requested_key,

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
    'seat_onboarding_step_reopened',
    'notice',
    onboarding_record.customer_id,
    'seat_product_account',
    onboarding_record.product_account_id::text,
    jsonb_build_object(
      'onboarding_run_id',
      onboarding_record.onboarding_run_id,

      'reopened_step_key',
      requested_key,

      'previous_current_step_key',
      onboarding_record.current_step_key
    ),
    now()
  );


  return jsonb_build_object(
    'ok',
    true,

    'current_step_key',
    requested_key
  );
end;
$seat_reopen_step$;


revoke all
on function
public.reopen_my_seat_onboarding_step(
  text
)
from
  public,
  anon;


grant execute
on function
public.reopen_my_seat_onboarding_step(
  text
)
to authenticated;


notify pgrst, 'reload schema';

commit;

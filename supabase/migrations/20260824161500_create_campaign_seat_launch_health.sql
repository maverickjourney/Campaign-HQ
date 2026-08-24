begin;

-- ============================================================
-- CAMPAIGN SEAT
-- CUSTOMER LAUNCH HEALTH / ACTIVATION RECEIPT
--
-- One sanitized source of truth for:
--
--   Product Account
--   Activation
--   Billing
--   Workspace
--   Workspace subscription
--   Campaign Owner
--   Provider bridge
--   Initial provider sync
--   Team invitation delivery
--
-- No private credentials or invitation token hashes are exposed.
-- ============================================================


create or replace function
public.get_my_campaign_seat_launch_health()
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  auth,
  pg_temp
as $campaign_seat_launch_health$
declare
  actor_user_id uuid :=
    auth.uid();

  launch record;

  activation_status jsonb :=
    '{}'::jsonb;

  workspace_id_value uuid;

  product_account_id_value uuid;

  workspace_subscription_status text;

  owner_count integer :=
    0;

  selected_provider_count integer :=
    0;

  connected_provider_count integer :=
    0;

  runtime_integration_count integer :=
    0;

  runtime_email_count integer :=
    0;

  runtime_calendar_count integer :=
    0;

  runtime_contacts_count integer :=
    0;

  sync_job_status text;

  sync_job_attempts integer :=
    0;

  sync_job_error text;

  invitation_total integer :=
    0;

  invitation_pending integer :=
    0;

  invitation_accepted integer :=
    0;

  invitation_delivery_sent integer :=
    0;

  invitation_delivery_failed integer :=
    0;

  invitation_delivery_pending integer :=
    0;

  health_status text :=
    'pending';

  checks jsonb :=
    '[]'::jsonb;

  attention_items jsonb :=
    '[]'::jsonb;
begin

  if actor_user_id
    is null
  then
    raise exception
      'Sign in to view Campaign Seat launch health.'
      using errcode = '42501';
  end if;


  -- ----------------------------------------------------------
  -- Resolve the user's latest Campaign Seat Product Account.
  -- ----------------------------------------------------------

  select
    account.id
      as product_account_id,

    account.account_name,

    account.status
      as account_status,

    account.onboarding_status,

    account.activated_at,

    subscription.billing_provider,

    subscription.status
      as subscription_status,

    subscription.package_name_snapshot,

    subscription.included_user_seats

  into launch

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

  left join public.seat_subscriptions
    as subscription
    on subscription.product_account_id =
      account.id

  where
    contact.user_id =
      actor_user_id

    and contact.status =
      'active'

    and product.product_key =
      'campaign'

  order by
    account.created_at desc

  limit 1;


  if launch.product_account_id
    is null
  then
    return jsonb_build_object(
      'found',
      false
    );
  end if;


  product_account_id_value :=
    launch.product_account_id;


  -- Existing Activation status remains the pre-launch source of
  -- truth for Review/Billing/provider blockers.
  activation_status :=
    public.get_my_campaign_seat_activation_status();


  select
    binding.workspace_id

  into workspace_id_value

  from public.seat_workspace_bindings
    as binding

  where
    binding.product_account_id =
      product_account_id_value

    and binding.relationship_type =
      'primary'

    and binding.status =
      'active'

  order by
    binding.created_at

  limit 1;


  -- ----------------------------------------------------------
  -- PRE-ACTIVATION
  -- ----------------------------------------------------------

  if workspace_id_value
    is null
  then

    checks :=
      jsonb_build_array(
        jsonb_build_object(
          'key',
          'activation',
          'title',
          'Workspace Activation',
          'status',
          case
            when coalesce(
              (
                activation_status
                  ->> 'ready'
              )::boolean,
              false
            )
            then 'ready'
            else 'pending'
          end
        ),

        jsonb_build_object(
          'key',
          'billing',
          'title',
          'Billing',
          'status',
          case
            when coalesce(
              (
                activation_status
                  -> 'billing'
                  ->> 'ready'
              )::boolean,
              false
            )
            then 'ready'
            else 'pending'
          end
        ),

        jsonb_build_object(
          'key',
          'providers',
          'title',
          'Provider Connections',
          'status',
          case
            when coalesce(
              (
                activation_status
                  ->> 'integrations_ready'
              )::boolean,
              false
            )
            then 'ready'
            else 'pending'
          end
        )
      );


    return jsonb_build_object(
      'found',
      true,

      'phase',
      'onboarding',

      'health_status',
      case
        when coalesce(
          (
            activation_status
              ->> 'ready'
          )::boolean,
          false
        )
        then 'ready_to_activate'
        else 'pending'
      end,

      'product_account',
      jsonb_build_object(
        'id',
        product_account_id_value,

        'name',
        launch.account_name,

        'status',
        launch.account_status,

        'onboarding_status',
        launch.onboarding_status,

        'activated_at',
        launch.activated_at
      ),

      'workspace_id',
      null,

      'billing',
      activation_status
        -> 'billing',

      'activation',
      activation_status,

      'checks',
      checks,

      'attention',
      activation_status
        -> 'blockers'
    );
  end if;


  -- ----------------------------------------------------------
  -- POST-ACTIVATION HEALTH
  -- ----------------------------------------------------------

  select subscription.status

  into workspace_subscription_status

  from public.workspace_subscriptions
    as subscription

  where subscription.workspace_id =
    workspace_id_value

  limit 1;


  select count(*)

  into owner_count

  from public.workspace_members
    as member

  where
    member.workspace_id =
      workspace_id_value

    and member.role_key =
      'campaign_owner'

    and member.status =
      'active'

    and member.membership_state =
      'active';


  select
    count(*),

    count(*)
      filter (
        where connection.status =
          'connected'
      )

  into
    selected_provider_count,
    connected_provider_count

  from public.seat_product_account_integrations
    as connection

  where
    connection.product_account_id =
      product_account_id_value

    and coalesce(
      connection.connection_metadata
        ->> 'onboarding_selected',
      'false'
    ) = 'true';


  select
    count(*),

    count(*)
      filter (
        where integration_type =
          'email'
      ),

    count(*)
      filter (
        where integration_type =
          'calendar'
      ),

    count(*)
      filter (
        where integration_type =
          'contacts'
      )

  into
    runtime_integration_count,
    runtime_email_count,
    runtime_calendar_count,
    runtime_contacts_count

  from public.workspace_integrations

  where
    workspace_id =
      workspace_id_value

    and provider =
      'nylas'

    and status =
      'connected';


  select
    job.status,
    job.attempts,
    job.last_error

  into
    sync_job_status,
    sync_job_attempts,
    sync_job_error

  from private.seat_workspace_initial_sync_jobs
    as job

  where job.workspace_id =
    workspace_id_value

  limit 1;


  select
    count(*),

    count(*)
      filter (
        where invitation.status =
          'pending'
      ),

    count(*)
      filter (
        where invitation.status =
          'accepted'
      )

  into
    invitation_total,
    invitation_pending,
    invitation_accepted

  from public.workspace_invitations
    as invitation

  where invitation.workspace_id =
    workspace_id_value;


  select
    count(*)
      filter (
        where delivery.delivery_status =
          'sent'
      ),

    count(*)
      filter (
        where delivery.delivery_status =
          'failed'
      ),

    count(*)
      filter (
        where delivery.delivery_status in (
          'pending',
          'sending'
        )
      )

  into
    invitation_delivery_sent,
    invitation_delivery_failed,
    invitation_delivery_pending

  from private.workspace_invitation_deliveries
    as delivery

  where delivery.workspace_id =
    workspace_id_value;


  -- ----------------------------------------------------------
  -- BUILD HEALTH CHECKS
  -- ----------------------------------------------------------

  checks :=
    checks ||
    jsonb_build_array(
      jsonb_build_object(
        'key',
        'product_account',
        'title',
        'Product Account',
        'status',
        case
          when launch.account_status =
            'active'
          then 'healthy'
          else 'attention'
        end
      )
    );


  checks :=
    checks ||
    jsonb_build_array(
      jsonb_build_object(
        'key',
        'workspace',
        'title',
        'Campaign Workspace',
        'status',
        'healthy'
      )
    );


  checks :=
    checks ||
    jsonb_build_array(
      jsonb_build_object(
        'key',
        'subscription',
        'title',
        'Workspace Subscription',
        'status',
        case
          when workspace_subscription_status in (
            'trial',
            'active'
          )
          then 'healthy'
          else 'attention'
        end
      )
    );


  checks :=
    checks ||
    jsonb_build_array(
      jsonb_build_object(
        'key',
        'owner',
        'title',
        'Campaign Owner',
        'status',
        case
          when owner_count = 1
          then 'healthy'
          else 'attention'
        end
      )
    );


  checks :=
    checks ||
    jsonb_build_array(
      jsonb_build_object(
        'key',
        'providers',
        'title',
        'Provider Bridge',
        'status',
        case
          when
            selected_provider_count > 0

            and connected_provider_count =
              selected_provider_count

            and runtime_integration_count > 0
          then 'healthy'
          else 'attention'
        end
      )
    );


  checks :=
    checks ||
    jsonb_build_array(
      jsonb_build_object(
        'key',
        'provider_sync',
        'title',
        'Initial Provider Sync',
        'status',
        case
          when sync_job_status =
            'complete'
          then 'healthy'

          when sync_job_status in (
            'partial',
            'failed'
          )
          then 'attention'

          else 'pending'
        end
      )
    );


  checks :=
    checks ||
    jsonb_build_array(
      jsonb_build_object(
        'key',
        'team_delivery',
        'title',
        'Team Invitation Delivery',
        'status',
        case
          when invitation_total = 0
          then 'healthy'

          when invitation_delivery_failed > 0
          then 'attention'

          when invitation_delivery_pending > 0
          then 'pending'

          else 'healthy'
        end
      )
    );


  -- ----------------------------------------------------------
  -- ATTENTION ITEMS
  -- ----------------------------------------------------------

  if launch.account_status <>
    'active'
  then
    attention_items :=
      attention_items ||
      jsonb_build_array(
        jsonb_build_object(
          'key',
          'product_account',
          'message',
          'The Product Account is not active.'
        )
      );
  end if;


  if workspace_subscription_status
    not in (
      'trial',
      'active'
    )
  then
    attention_items :=
      attention_items ||
      jsonb_build_array(
        jsonb_build_object(
          'key',
          'subscription',
          'message',
          'The workspace subscription is not active or trialing.'
        )
      );
  end if;


  if owner_count <> 1
  then
    attention_items :=
      attention_items ||
      jsonb_build_array(
        jsonb_build_object(
          'key',
          'owner',
          'message',
          'Exactly one active Campaign Owner was not found.'
        )
      );
  end if;


  if
    selected_provider_count = 0

    or connected_provider_count <>
      selected_provider_count

    or runtime_integration_count = 0
  then
    attention_items :=
      attention_items ||
      jsonb_build_array(
        jsonb_build_object(
          'key',
          'providers',
          'message',
          'The activated workspace provider bridge needs attention.'
        )
      );
  end if;


  if sync_job_status in (
    'partial',
    'failed'
  )
  then
    attention_items :=
      attention_items ||
      jsonb_build_array(
        jsonb_build_object(
          'key',
          'provider_sync',
          'message',
          coalesce(
            nullif(
              sync_job_error,
              ''
            ),
            'The initial provider sync requires a retry.'
          )
        )
      );
  end if;


  if invitation_delivery_failed > 0
  then
    attention_items :=
      attention_items ||
      jsonb_build_array(
        jsonb_build_object(
          'key',
          'team_delivery',
          'message',
          invitation_delivery_failed::text ||
          ' team invitation delivery attempt(s) require attention.'
        )
      );
  end if;


  health_status :=
    case
      when jsonb_array_length(
        attention_items
      ) > 0
      then 'attention'

      when sync_job_status is null
        or sync_job_status in (
          'pending',
          'running'
        )
        or invitation_delivery_pending > 0
      then 'finishing_launch'

      else 'healthy'
    end;


  return jsonb_build_object(
    'found',
    true,

    'phase',
    'active',

    'health_status',
    health_status,

    'product_account',
    jsonb_build_object(
      'id',
      product_account_id_value,

      'name',
      launch.account_name,

      'status',
      launch.account_status,

      'onboarding_status',
      launch.onboarding_status,

      'activated_at',
      launch.activated_at
    ),

    'workspace_id',
    workspace_id_value,

    'billing',
    jsonb_build_object(
      'provider',
      launch.billing_provider,

      'status',
      launch.subscription_status,

      'package',
      launch.package_name_snapshot,

      'included_user_seats',
      launch.included_user_seats
    ),

    'workspace_subscription_status',
    workspace_subscription_status,

    'campaign_owner_count',
    owner_count,

    'providers',
    jsonb_build_object(
      'selected',
      selected_provider_count,

      'connected',
      connected_provider_count,

      'runtime_integrations',
      runtime_integration_count,

      'email',
      runtime_email_count,

      'calendar',
      runtime_calendar_count,

      'contacts',
      runtime_contacts_count
    ),

    'initial_sync',
    jsonb_build_object(
      'status',
      sync_job_status,

      'attempts',
      sync_job_attempts,

      'last_error',
      sync_job_error
    ),

    'team_invitations',
    jsonb_build_object(
      'total',
      invitation_total,

      'pending',
      invitation_pending,

      'accepted',
      invitation_accepted,

      'delivery_sent',
      invitation_delivery_sent,

      'delivery_failed',
      invitation_delivery_failed,

      'delivery_pending',
      invitation_delivery_pending
    ),

    'checks',
    checks,

    'attention',
    attention_items
  );

end;
$campaign_seat_launch_health$;


revoke all
on function
public.get_my_campaign_seat_launch_health()
from
  public,
  anon;


grant execute
on function
public.get_my_campaign_seat_launch_health()
to authenticated;


notify pgrst, 'reload schema';

commit;

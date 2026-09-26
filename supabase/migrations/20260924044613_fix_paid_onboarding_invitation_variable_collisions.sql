
create or replace function public.prepare_campaign_seat_stripe_onboarding_invitation(
  target_request_id uuid,
  expires_in_hours integer default 168
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, auth, pg_temp
as $$
declare
  req private.workspace_provisioning_requests%rowtype;
  v_account_id uuid;
  v_customer_id uuid;
  v_contact_id uuid;
  v_workspace_id uuid;
  v_contact_email text;
  v_existing_auth_user_id uuid;
  v_invitation_id uuid;
  v_invite_token text;
  v_invite_hash text;
  v_invite_expiration timestamptz;
  v_existing_pending_id uuid;
  v_existing_raw_token text;
begin
  if expires_in_hours < 1 or expires_in_hours > 168 then
    raise exception 'Onboarding invitations must expire between 1 and 168 hours.';
  end if;

  select wpr.*
  into req
  from private.workspace_provisioning_requests wpr
  where wpr.id = target_request_id
  for update;

  if not found then
    raise exception 'Stripe provisioning request was not found.';
  end if;

  if req.status <> 'provisioned' then
    raise exception 'Stripe provisioning must finish before onboarding can be prepared.';
  end if;

  if req.request_payload ? 'onboarding_email_sent_at' then
    return jsonb_build_object(
      'request_id', req.id,
      'email_sent', true,
      'invitation_id', nullif(req.request_payload->>'onboarding_invitation_id', '')::uuid,
      'email', req.email
    );
  end if;

  v_account_id :=
    nullif(req.request_payload->>'seat_product_account_id', '')::uuid;

  v_customer_id :=
    nullif(req.request_payload->>'seat_customer_id', '')::uuid;

  v_workspace_id :=
    coalesce(
      req.workspace_id,
      nullif(req.request_payload->>'workspace_id', '')::uuid
    );

  if v_account_id is null
     or v_customer_id is null
     or v_workspace_id is null
  then
    raise exception 'Stripe provisioning references are incomplete.';
  end if;

  select
    contact.id,
    lower(btrim(contact.email))
  into
    v_contact_id,
    v_contact_email
  from public.seat_customer_contacts contact
  where contact.customer_id = v_customer_id
    and contact.is_primary = true
    and contact.status = 'active'
  order by contact.created_at
  limit 1;

  if v_contact_id is null
     or v_contact_email is null
     or v_contact_email = ''
  then
    raise exception 'The Stripe customer does not have an active primary onboarding contact.';
  end if;

  select usr.id
  into v_existing_auth_user_id
  from auth.users usr
  where lower(btrim(usr.email)) = v_contact_email
  limit 1;

  if v_existing_auth_user_id is not null then
    update public.seat_customer_contacts contact
    set user_id = v_existing_auth_user_id,
        updated_at = now()
    where contact.id = v_contact_id
      and (
        contact.user_id is null
        or contact.user_id = v_existing_auth_user_id
      );

    select invitation.id
    into v_invitation_id
    from private.seat_onboarding_invitations invitation
    where invitation.product_account_id = v_account_id
      and coalesce(invitation.metadata->>'source', '') = 'stripe'
    order by invitation.created_at desc
    limit 1;

    if v_invitation_id is null then
      v_invite_hash :=
        encode(
          extensions.digest(
            encode(extensions.gen_random_bytes(32), 'hex'),
            'sha256'
          ),
          'hex'
        );

      insert into private.seat_onboarding_invitations (
        product_account_id,
        customer_id,
        contact_id,
        proposal_id,
        email,
        requested_role_key,
        token_hash,
        status,
        expires_at,
        invited_by,
        metadata
      )
      values (
        v_account_id,
        v_customer_id,
        v_contact_id,
        null,
        v_contact_email,
        'campaign_owner',
        v_invite_hash,
        'accepted',
        now() + make_interval(hours => expires_in_hours),
        null,
        jsonb_build_object(
          'source', 'stripe',
          'workspace_id', v_workspace_id,
          'provisioning_request_id', req.id,
          'existing_user', true
        )
      )
      returning id into v_invitation_id;
    end if;

    perform private.activate_stripe_campaign_seat_owner(
      v_existing_auth_user_id,
      v_invitation_id
    );

    update private.workspace_provisioning_requests wpr
    set request_payload =
          wpr.request_payload ||
          jsonb_build_object(
            'onboarding_invitation_id', v_invitation_id,
            'onboarding_existing_user', true
          ),
        updated_at = now()
    where wpr.id = req.id;

    return jsonb_build_object(
      'request_id', req.id,
      'existing_user', true,
      'user_id', v_existing_auth_user_id,
      'invitation_id', v_invitation_id,
      'email', v_contact_email,
      'workspace_id', v_workspace_id,
      'account_name', req.campaign_name
    );
  end if;

  v_existing_pending_id :=
    nullif(req.request_payload->>'onboarding_invitation_id', '')::uuid;

  v_existing_raw_token :=
    nullif(req.request_payload->>'onboarding_invitation_token', '');

  if v_existing_pending_id is not null
     and v_existing_raw_token is not null
     and exists (
       select 1
       from private.seat_onboarding_invitations invitation
       where invitation.id = v_existing_pending_id
         and invitation.status = 'pending'
         and invitation.expires_at > now()
         and invitation.cancelled_at is null
     )
  then
    return jsonb_build_object(
      'request_id', req.id,
      'existing_user', false,
      'invitation_id', v_existing_pending_id,
      'invitation_token', v_existing_raw_token,
      'email', v_contact_email,
      'workspace_id', v_workspace_id,
      'account_name', req.campaign_name
    );
  end if;

  update private.seat_onboarding_invitations invitation
  set status = 'cancelled',
      cancelled_at = now(),
      updated_at = now()
  where invitation.product_account_id = v_account_id
    and invitation.status = 'pending';

  v_invite_token :=
    encode(
      extensions.gen_random_bytes(32),
      'hex'
    );

  v_invite_hash :=
    encode(
      extensions.digest(v_invite_token, 'sha256'),
      'hex'
    );

  v_invite_expiration :=
    now() + make_interval(hours => expires_in_hours);

  insert into private.seat_onboarding_invitations (
    product_account_id,
    customer_id,
    contact_id,
    proposal_id,
    email,
    requested_role_key,
    token_hash,
    status,
    expires_at,
    invited_by,
    metadata
  )
  values (
    v_account_id,
    v_customer_id,
    v_contact_id,
    null,
    v_contact_email,
    'campaign_owner',
    v_invite_hash,
    'pending',
    v_invite_expiration,
    null,
    jsonb_build_object(
      'source', 'stripe',
      'workspace_id', v_workspace_id,
      'provisioning_request_id', req.id,
      'stripe_customer_id', req.stripe_customer_id,
      'stripe_subscription_id', req.stripe_subscription_id
    )
  )
  returning id into v_invitation_id;

  update private.workspace_provisioning_requests wpr
  set request_payload =
        wpr.request_payload ||
        jsonb_build_object(
          'onboarding_invitation_id', v_invitation_id,
          'onboarding_invitation_token', v_invite_token,
          'onboarding_invitation_expires_at', v_invite_expiration,
          'onboarding_existing_user', false
        ),
      updated_at = now()
  where wpr.id = req.id;

  return jsonb_build_object(
    'request_id', req.id,
    'existing_user', false,
    'invitation_id', v_invitation_id,
    'invitation_token', v_invite_token,
    'invitation_expires_at', v_invite_expiration,
    'email', v_contact_email,
    'workspace_id', v_workspace_id,
    'account_name', req.campaign_name
  );
end;
$$;

revoke all on function public.prepare_campaign_seat_stripe_onboarding_invitation(uuid, integer) from public;
revoke all on function public.prepare_campaign_seat_stripe_onboarding_invitation(uuid, integer) from anon;
revoke all on function public.prepare_campaign_seat_stripe_onboarding_invitation(uuid, integer) from authenticated;
grant execute on function public.prepare_campaign_seat_stripe_onboarding_invitation(uuid, integer) to service_role;
;

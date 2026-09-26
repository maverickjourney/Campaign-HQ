
alter table private.seat_onboarding_invitations
  alter column proposal_id drop not null;

create or replace function public.get_seat_onboarding_invitation_by_token(
  target_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  token_hash_value text;
  invitation_record record;
begin
  if char_length(btrim(coalesce(target_token, ''))) < 32 then
    return jsonb_build_object('found', false);
  end if;

  token_hash_value :=
    encode(
      extensions.digest(btrim(target_token), 'sha256'),
      'hex'
    );

  select
    invitation.id,
    invitation.email,
    invitation.requested_role_key,
    invitation.status,
    invitation.expires_at,
    invitation.metadata,
    contact.full_name,
    account.account_name,
    product.product_name,
    proposal.proposal_code
  into invitation_record
  from private.seat_onboarding_invitations as invitation
  join public.seat_customer_contacts as contact
    on contact.id = invitation.contact_id
  join public.seat_product_accounts as account
    on account.id = invitation.product_account_id
  join public.seat_products as product
    on product.id = account.product_id
  left join public.seat_proposals as proposal
    on proposal.id = invitation.proposal_id
  where invitation.token_hash = token_hash_value
  limit 1;

  if invitation_record.id is null then
    return jsonb_build_object('found', false);
  end if;

  if invitation_record.status = 'pending'
     and invitation_record.expires_at <= now()
  then
    update private.seat_onboarding_invitations
    set status = 'expired',
        updated_at = now()
    where id = invitation_record.id;

    return jsonb_build_object(
      'found', false,
      'expired', true
    );
  end if;

  if invitation_record.status <> 'pending' then
    return jsonb_build_object(
      'found', false,
      'used', true
    );
  end if;

  return jsonb_build_object(
    'found', true,
    'email', invitation_record.email,
    'full_name', invitation_record.full_name,
    'account_name', invitation_record.account_name,
    'product_name', invitation_record.product_name,
    'proposal_code', invitation_record.proposal_code,
    'source', coalesce(invitation_record.metadata->>'source', 'proposal'),
    'requested_role_key', invitation_record.requested_role_key,
    'expires_at', invitation_record.expires_at
  );
end;
$$;

create or replace function private.activate_stripe_campaign_seat_owner(
  target_user_id uuid,
  target_invitation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  invitation_record private.seat_onboarding_invitations%rowtype;
  target_workspace_id uuid;
  target_email text;
  auth_email text;
  owner_role record;
  member_id uuid;
begin
  select *
  into invitation_record
  from private.seat_onboarding_invitations
  where id = target_invitation_id
  for update;

  if not found then
    raise exception 'Stripe Campaign Seat onboarding invitation was not found.';
  end if;

  if coalesce(invitation_record.metadata->>'source', '') <> 'stripe' then
    raise exception 'This invitation is not a Stripe Campaign Seat onboarding invitation.';
  end if;

  target_workspace_id :=
    nullif(invitation_record.metadata->>'workspace_id', '')::uuid;

  if target_workspace_id is null then
    raise exception 'Stripe Campaign Seat invitation is missing its workspace.';
  end if;

  select lower(btrim(coalesce(email, '')))
  into auth_email
  from auth.users
  where id = target_user_id;

  target_email := lower(btrim(invitation_record.email));

  if auth_email is null or auth_email = '' or auth_email <> target_email then
    raise exception 'The invited Campaign Seat email does not match this account.';
  end if;

  select key, name, dashboard_type, seat_type
  into owner_role
  from public.campaign_roles
  where key = 'campaign_owner'
    and is_active = true;

  if owner_role.key is null then
    raise exception 'The Campaign Owner role is unavailable.';
  end if;

  update public.seat_customer_contacts
  set user_id = target_user_id,
      metadata = coalesce(metadata, '{}'::jsonb) ||
        jsonb_build_object(
          'requested_role_key', 'campaign_owner',
          'onboarding_invitation_id', invitation_record.id,
          'onboarding_source', 'stripe'
        ),
      updated_at = now()
  where id = invitation_record.contact_id
    and (user_id is null or user_id = target_user_id);

  perform set_config(
    'campaign_hq.accepting_invitation',
    'on',
    true
  );

  insert into public.workspace_members (
    workspace_id,
    user_id,
    role,
    status,
    role_key,
    display_title,
    seat_type,
    dashboard_type,
    membership_state,
    joined_at,
    is_primary_contact
  )
  values (
    target_workspace_id,
    target_user_id,
    'client',
    'active',
    owner_role.key,
    owner_role.name,
    owner_role.seat_type,
    owner_role.dashboard_type,
    'active',
    now(),
    true
  )
  on conflict (workspace_id, user_id)
  do update set
    status = 'active',
    role_key = excluded.role_key,
    display_title = excluded.display_title,
    seat_type = excluded.seat_type,
    dashboard_type = excluded.dashboard_type,
    membership_state = 'active',
    joined_at = coalesce(public.workspace_members.joined_at, now()),
    is_primary_contact = true,
    suspended_at = null,
    removed_at = null,
    access_version = coalesce(public.workspace_members.access_version, 0) + 1,
    updated_at = now()
  returning id into member_id;

  perform set_config(
    'campaign_hq.accepting_invitation',
    'off',
    true
  );

  update private.seat_onboarding_invitations
  set status = 'accepted',
      accepted_by = target_user_id,
      accepted_at = coalesce(accepted_at, now()),
      updated_at = now()
  where id = invitation_record.id;

  update public.seat_product_accounts
  set status = 'active',
      onboarding_status = case
        when onboarding_status = 'complete' then 'complete'
        else 'in_progress'
      end,
      activated_at = coalesce(activated_at, now()),
      metadata = coalesce(metadata, '{}'::jsonb) ||
        jsonb_build_object(
          'initial_user_id', target_user_id,
          'primary_workspace_id', target_workspace_id,
          'activation_source', 'stripe_paid_onboarding'
        ),
      updated_at = now()
  where id = invitation_record.product_account_id;

  update public.seat_customers
  set status = case
        when status = 'active' then 'active'
        else 'onboarding'
      end,
      updated_at = now()
  where id = invitation_record.customer_id;

  update public.workspaces
  set setup_metadata = coalesce(setup_metadata, '{}'::jsonb) ||
        jsonb_build_object(
          'campaign_owner_user_id', target_user_id,
          'campaign_owner_member_id', member_id,
          'owner_attached_from', 'stripe_paid_onboarding'
        ),
      updated_at = now()
  where id = target_workspace_id;

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
    target_user_id,
    'stripe_campaign_seat_owner_attached',
    'notice',
    invitation_record.customer_id,
    'workspace',
    target_workspace_id::text,
    jsonb_build_object(
      'invitation_id', invitation_record.id,
      'product_account_id', invitation_record.product_account_id,
      'workspace_member_id', member_id
    ),
    now()
  );

  return member_id;
exception
  when others then
    perform set_config(
      'campaign_hq.accepting_invitation',
      'off',
      true
    );
    raise;
end;
$$;

revoke all on function private.activate_stripe_campaign_seat_owner(uuid, uuid) from public;
revoke all on function private.activate_stripe_campaign_seat_owner(uuid, uuid) from anon;
revoke all on function private.activate_stripe_campaign_seat_owner(uuid, uuid) from authenticated;

create or replace function private.attach_stripe_campaign_owner_after_auth_insert()
returns trigger
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  onboarding_hash text :=
    lower(
      btrim(
        coalesce(
          new.raw_user_meta_data->>'seat_onboarding_invitation_hash',
          ''
        )
      )
    );
  invitation_id uuid;
begin
  if onboarding_hash !~ '^[0-9a-f]{64}$' then
    return new;
  end if;

  select invitation.id
  into invitation_id
  from private.seat_onboarding_invitations invitation
  where lower(btrim(invitation.email)) = lower(btrim(coalesce(new.email, '')))
    and invitation.token_hash = onboarding_hash
    and coalesce(invitation.metadata->>'source', '') = 'stripe'
    and invitation.expires_at > now()
    and invitation.cancelled_at is null
  order by invitation.created_at desc
  limit 1;

  if invitation_id is null then
    return new;
  end if;

  perform private.activate_stripe_campaign_seat_owner(
    new.id,
    invitation_id
  );

  return new;
end;
$$;

drop trigger if exists zz_seat_attach_stripe_campaign_owner on auth.users;

create trigger zz_seat_attach_stripe_campaign_owner
after insert on auth.users
for each row
execute function private.attach_stripe_campaign_owner_after_auth_insert();

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
  account_id uuid;
  customer_id uuid;
  contact_id uuid;
  workspace_id uuid;
  contact_email text;
  existing_auth_user_id uuid;
  invitation_id uuid;
  invite_token text;
  invite_hash text;
  invite_expiration timestamptz;
  existing_pending_id uuid;
  existing_raw_token text;
begin
  if expires_in_hours < 1 or expires_in_hours > 168 then
    raise exception 'Onboarding invitations must expire between 1 and 168 hours.';
  end if;

  select *
  into req
  from private.workspace_provisioning_requests
  where id = target_request_id
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

  account_id :=
    nullif(req.request_payload->>'seat_product_account_id', '')::uuid;
  customer_id :=
    nullif(req.request_payload->>'seat_customer_id', '')::uuid;
  workspace_id :=
    coalesce(
      req.workspace_id,
      nullif(req.request_payload->>'workspace_id', '')::uuid
    );

  if account_id is null or customer_id is null or workspace_id is null then
    raise exception 'Stripe provisioning references are incomplete.';
  end if;

  select contact.id, lower(btrim(contact.email))
  into contact_id, contact_email
  from public.seat_customer_contacts contact
  where contact.customer_id = customer_id
    and contact.is_primary = true
    and contact.status = 'active'
  order by contact.created_at
  limit 1;

  if contact_id is null or contact_email is null or contact_email = '' then
    raise exception 'The Stripe customer does not have an active primary onboarding contact.';
  end if;

  select id
  into existing_auth_user_id
  from auth.users
  where lower(btrim(email)) = contact_email
  limit 1;

  if existing_auth_user_id is not null then
    update public.seat_customer_contacts
    set user_id = existing_auth_user_id,
        updated_at = now()
    where id = contact_id
      and (user_id is null or user_id = existing_auth_user_id);

    select id
    into invitation_id
    from private.seat_onboarding_invitations
    where product_account_id = account_id
      and coalesce(metadata->>'source', '') = 'stripe'
    order by created_at desc
    limit 1;

    if invitation_id is null then
      invite_hash :=
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
        account_id,
        customer_id,
        contact_id,
        null,
        contact_email,
        'campaign_owner',
        invite_hash,
        'accepted',
        now() + make_interval(hours => expires_in_hours),
        null,
        jsonb_build_object(
          'source', 'stripe',
          'workspace_id', workspace_id,
          'provisioning_request_id', req.id,
          'existing_user', true
        )
      )
      returning id into invitation_id;
    end if;

    perform private.activate_stripe_campaign_seat_owner(
      existing_auth_user_id,
      invitation_id
    );

    update private.workspace_provisioning_requests
    set request_payload = request_payload ||
          jsonb_build_object(
            'onboarding_invitation_id', invitation_id,
            'onboarding_existing_user', true
          ),
        updated_at = now()
    where id = req.id;

    return jsonb_build_object(
      'request_id', req.id,
      'existing_user', true,
      'user_id', existing_auth_user_id,
      'invitation_id', invitation_id,
      'email', contact_email,
      'workspace_id', workspace_id,
      'account_name', req.campaign_name
    );
  end if;

  existing_pending_id :=
    nullif(req.request_payload->>'onboarding_invitation_id', '')::uuid;
  existing_raw_token :=
    nullif(req.request_payload->>'onboarding_invitation_token', '');

  if existing_pending_id is not null
     and existing_raw_token is not null
     and exists (
       select 1
       from private.seat_onboarding_invitations i
       where i.id = existing_pending_id
         and i.status = 'pending'
         and i.expires_at > now()
         and i.cancelled_at is null
     )
  then
    return jsonb_build_object(
      'request_id', req.id,
      'existing_user', false,
      'invitation_id', existing_pending_id,
      'invitation_token', existing_raw_token,
      'email', contact_email,
      'workspace_id', workspace_id,
      'account_name', req.campaign_name
    );
  end if;

  update private.seat_onboarding_invitations
  set status = 'cancelled',
      cancelled_at = now(),
      updated_at = now()
  where product_account_id = account_id
    and status = 'pending';

  invite_token :=
    encode(
      extensions.gen_random_bytes(32),
      'hex'
    );

  invite_hash :=
    encode(
      extensions.digest(invite_token, 'sha256'),
      'hex'
    );

  invite_expiration :=
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
    account_id,
    customer_id,
    contact_id,
    null,
    contact_email,
    'campaign_owner',
    invite_hash,
    'pending',
    invite_expiration,
    null,
    jsonb_build_object(
      'source', 'stripe',
      'workspace_id', workspace_id,
      'provisioning_request_id', req.id,
      'stripe_customer_id', req.stripe_customer_id,
      'stripe_subscription_id', req.stripe_subscription_id
    )
  )
  returning id into invitation_id;

  update private.workspace_provisioning_requests
  set request_payload = request_payload ||
        jsonb_build_object(
          'onboarding_invitation_id', invitation_id,
          'onboarding_invitation_token', invite_token,
          'onboarding_invitation_expires_at', invite_expiration,
          'onboarding_existing_user', false
        ),
      updated_at = now()
  where id = req.id;

  return jsonb_build_object(
    'request_id', req.id,
    'existing_user', false,
    'invitation_id', invitation_id,
    'invitation_token', invite_token,
    'invitation_expires_at', invite_expiration,
    'email', contact_email,
    'workspace_id', workspace_id,
    'account_name', req.campaign_name
  );
end;
$$;

revoke all on function public.prepare_campaign_seat_stripe_onboarding_invitation(uuid, integer) from public;
revoke all on function public.prepare_campaign_seat_stripe_onboarding_invitation(uuid, integer) from anon;
revoke all on function public.prepare_campaign_seat_stripe_onboarding_invitation(uuid, integer) from authenticated;
grant execute on function public.prepare_campaign_seat_stripe_onboarding_invitation(uuid, integer) to service_role;

create or replace function public.mark_campaign_seat_onboarding_email_sent(
  target_request_id uuid,
  target_invitation_id uuid,
  target_provider_message_id text
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  update private.workspace_provisioning_requests
  set request_payload =
        (request_payload - 'onboarding_invitation_token') ||
        jsonb_build_object(
          'onboarding_invitation_id', target_invitation_id,
          'onboarding_email_sent_at', now(),
          'onboarding_email_provider_message_id', target_provider_message_id
        ),
      updated_at = now()
  where id = target_request_id;
end;
$$;

revoke all on function public.mark_campaign_seat_onboarding_email_sent(uuid, uuid, text) from public;
revoke all on function public.mark_campaign_seat_onboarding_email_sent(uuid, uuid, text) from anon;
revoke all on function public.mark_campaign_seat_onboarding_email_sent(uuid, uuid, text) from authenticated;
grant execute on function public.mark_campaign_seat_onboarding_email_sent(uuid, uuid, text) to service_role;
;

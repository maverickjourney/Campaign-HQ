begin;

-- ============================================================
-- CAMPAIGN SEAT
-- WORKSPACE INVITATION DELIVERY RELIABILITY
--
-- SECURITY RULE:
--
-- Plain invitation tokens are NEVER stored.
--
-- A retry:
--   1. requires AAL2
--   2. requires workspace.invite_members
--   3. re-checks role-grant authority
--   4. generates a NEW random token
--   5. stores only its SHA-256 hash
--   6. returns plaintext exactly once
--   7. invalidates the previous invitation link
-- ============================================================


create table if not exists
private.workspace_invitation_deliveries (

  invitation_id uuid
    primary key
    references public.workspace_invitations(id)
    on delete cascade,

  workspace_id uuid
    not null
    references public.workspaces(id)
    on delete cascade,

  delivery_status text
    not null
    default 'pending',

  provider text
    not null
    default 'resend',

  attempts integer
    not null
    default 0,

  token_version integer
    not null
    default 1,

  last_attempt_at timestamptz,

  sent_at timestamptz,

  token_rotated_at timestamptz,

  provider_message_id text,

  provider_status_code integer,

  last_error text,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint
  workspace_invitation_deliveries_status_check
  check (
    delivery_status in (
      'pending',
      'sending',
      'sent',
      'failed'
    )
  ),

  constraint
  workspace_invitation_deliveries_provider_check
  check (
    provider =
      'resend'
  ),

  constraint
  workspace_invitation_deliveries_attempts_check
  check (
    attempts >= 0
  ),

  constraint
  workspace_invitation_deliveries_token_version_check
  check (
    token_version >= 1
  )
);


create index if not exists
workspace_invitation_deliveries_workspace_idx

on private.workspace_invitation_deliveries (
  workspace_id,
  delivery_status,
  updated_at desc
);


revoke all
on table
private.workspace_invitation_deliveries
from
  public,
  anon,
  authenticated;



-- ============================================================
-- CREATE DELIVERY ROW AUTOMATICALLY
-- ============================================================

create or replace function
private.queue_workspace_invitation_delivery()
returns trigger
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $queue_workspace_invitation_delivery$
begin

  insert into
  private.workspace_invitation_deliveries (
    invitation_id,
    workspace_id,
    delivery_status,
    provider,
    attempts,
    token_version,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.workspace_id,
    'pending',
    'resend',
    0,
    1,
    now(),
    now()
  )

  on conflict (
    invitation_id
  )
  do nothing;


  return new;

end;
$queue_workspace_invitation_delivery$;


revoke all
on function
private.queue_workspace_invitation_delivery()
from
  public,
  anon,
  authenticated;


drop trigger if exists
workspace_invitation_delivery_queue
on public.workspace_invitations;


create trigger
workspace_invitation_delivery_queue

after insert

on public.workspace_invitations

for each row

execute function
private.queue_workspace_invitation_delivery();



-- Backfill any existing invitations without storing or recreating
-- plaintext tokens.

insert into
private.workspace_invitation_deliveries (
  invitation_id,
  workspace_id,
  delivery_status,
  provider,
  attempts,
  token_version,
  created_at,
  updated_at
)

select
  invitation.id,
  invitation.workspace_id,
  'pending',
  'resend',
  0,
  1,
  now(),
  now()

from public.workspace_invitations
  as invitation

where not exists (
  select 1

  from private.workspace_invitation_deliveries
    as delivery

  where delivery.invitation_id =
    invitation.id
)

on conflict (
  invitation_id
)
do nothing;



-- ============================================================
-- BEGIN DELIVERY ATTEMPT
-- ============================================================

create or replace function
public.begin_workspace_invitation_delivery(
  target_invitation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $begin_invitation_delivery$
declare
  actor_user_id uuid :=
    auth.uid();

  invitation_record record;

  resulting_attempt integer;
begin

  perform public.require_aal2();


  if actor_user_id
    is null
  then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;


  select
    invitation.id,
    invitation.workspace_id,
    invitation.role_key,
    invitation.status,
    invitation.expires_at

  into invitation_record

  from public.workspace_invitations
    as invitation

  where invitation.id =
    target_invitation_id

  for update;


  if invitation_record.id
    is null
  then
    raise exception
      'The workspace invitation was not found.'
      using errcode = 'P0002';
  end if;


  if not public.has_campaign_permission(
    invitation_record.workspace_id,
    'workspace.invite_members'
  )
  then
    raise exception
      'You cannot send campaign invitations.'
      using errcode = '42501';
  end if;


  if invitation_record.status <>
    'pending'
  then
    raise exception
      'Only pending invitations can be delivered.';
  end if;


  if invitation_record.expires_at <=
    now()
  then
    raise exception
      'The invitation has expired.';
  end if;


  insert into
  private.workspace_invitation_deliveries (
    invitation_id,
    workspace_id,
    delivery_status,
    provider,
    attempts,
    token_version,
    last_attempt_at,
    updated_at
  )
  values (
    invitation_record.id,
    invitation_record.workspace_id,
    'sending',
    'resend',
    1,
    1,
    now(),
    now()
  )

  on conflict (
    invitation_id
  )
  do update
  set
    delivery_status =
      'sending',

    attempts =
      private.workspace_invitation_deliveries.attempts + 1,

    last_attempt_at =
      now(),

    provider_status_code =
      null,

    last_error =
      null,

    updated_at =
      now()

  returning attempts
  into resulting_attempt;


  return jsonb_build_object(
    'success',
    true,

    'attempt',
    resulting_attempt
  );

end;
$begin_invitation_delivery$;


revoke all
on function
public.begin_workspace_invitation_delivery(
  uuid
)
from
  public,
  anon;


grant execute
on function
public.begin_workspace_invitation_delivery(
  uuid
)
to authenticated;



-- ============================================================
-- FINISH DELIVERY ATTEMPT
-- ============================================================

create or replace function
public.finish_workspace_invitation_delivery(
  target_invitation_id uuid,
  target_success boolean,
  target_provider_message_id text,
  target_provider_status_code integer,
  target_error text
)
returns void
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $finish_invitation_delivery$
declare
  actor_user_id uuid :=
    auth.uid();

  invitation_record record;
begin

  perform public.require_aal2();


  if actor_user_id
    is null
  then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;


  select
    invitation.id,
    invitation.workspace_id

  into invitation_record

  from public.workspace_invitations
    as invitation

  where invitation.id =
    target_invitation_id;


  if invitation_record.id
    is null
  then
    raise exception
      'The workspace invitation was not found.'
      using errcode = 'P0002';
  end if;


  if not public.has_campaign_permission(
    invitation_record.workspace_id,
    'workspace.invite_members'
  )
  then
    raise exception
      'You cannot manage campaign invitations.'
      using errcode = '42501';
  end if;


  update
  private.workspace_invitation_deliveries

  set
    delivery_status =
      case
        when coalesce(
          target_success,
          false
        )
        then
          'sent'
        else
          'failed'
      end,

    sent_at =
      case
        when coalesce(
          target_success,
          false
        )
        then
          now()
        else
          sent_at
      end,

    provider_message_id =
      nullif(
        btrim(
          coalesce(
            target_provider_message_id,
            ''
          )
        ),
        ''
      ),

    provider_status_code =
      target_provider_status_code,

    last_error =
      case
        when coalesce(
          target_success,
          false
        )
        then
          null
        else
          nullif(
            btrim(
              coalesce(
                target_error,
                ''
              )
            ),
            ''
          )
      end,

    updated_at =
      now()

  where invitation_id =
    target_invitation_id;


  if not found then
    raise exception
      'Invitation delivery state could not be updated.';
  end if;

end;
$finish_invitation_delivery$;


revoke all
on function
public.finish_workspace_invitation_delivery(
  uuid,
  boolean,
  text,
  integer,
  text
)
from
  public,
  anon;


grant execute
on function
public.finish_workspace_invitation_delivery(
  uuid,
  boolean,
  text,
  integer,
  text
)
to authenticated;



-- ============================================================
-- SECURE TOKEN ROTATION FOR RETRY
--
-- Plaintext exists only as this one RPC return value.
-- The old token becomes invalid immediately.
-- ============================================================

create or replace function
public.rotate_workspace_invitation_for_retry(
  target_invitation_id uuid
)
returns table (
  invitation_id uuid,
  invitation_token text,
  invitation_expires_at timestamptz
)
language plpgsql
security definer
set search_path =
  public,
  private,
  extensions,
  pg_temp
as $rotate_invitation_retry$
declare
  actor_user_id uuid :=
    auth.uid();

  invitation_record
    public.workspace_invitations%rowtype;

  raw_token text;

  stored_hash text;

  new_expiry timestamptz :=
    now() +
    interval '7 days';
begin

  perform public.require_aal2();


  if actor_user_id
    is null
  then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;


  select *

  into invitation_record

  from public.workspace_invitations
    as invitation

  where invitation.id =
    target_invitation_id

  for update;


  if invitation_record.id
    is null
  then
    raise exception
      'The workspace invitation was not found.'
      using errcode = 'P0002';
  end if;


  if invitation_record.status <>
    'pending'
  then
    raise exception
      'Only a pending invitation can be retried.';
  end if;


  if not public.has_campaign_permission(
    invitation_record.workspace_id,
    'workspace.invite_members'
  )
  then
    raise exception
      'You cannot retry campaign invitations.'
      using errcode = '42501';
  end if;


  if not public.can_grant_campaign_role(
    invitation_record.workspace_id,
    invitation_record.role_key
  )
  then
    raise exception
      'You can no longer grant the role assigned to this invitation.'
      using errcode = '42501';
  end if;


  raw_token :=
    encode(
      gen_random_bytes(32),
      'hex'
    );


  stored_hash :=
    encode(
      digest(
        raw_token,
        'sha256'
      ),
      'hex'
    );


  update public.workspace_invitations

  set
    token_hash =
      stored_hash,

    expires_at =
      new_expiry,

    updated_at =
      now()

  where id =
    invitation_record.id;


  insert into
  private.workspace_invitation_deliveries (
    invitation_id,
    workspace_id,
    delivery_status,
    provider,
    attempts,
    token_version,
    token_rotated_at,
    updated_at
  )
  values (
    invitation_record.id,
    invitation_record.workspace_id,
    'pending',
    'resend',
    0,
    2,
    now(),
    now()
  )

  on conflict (
    invitation_id
  )
  do update
  set
    delivery_status =
      'pending',

    token_version =
      private.workspace_invitation_deliveries.token_version + 1,

    token_rotated_at =
      now(),

    provider_message_id =
      null,

    provider_status_code =
      null,

    last_error =
      null,

    updated_at =
      now();


  return query
  select
    invitation_record.id,
    raw_token,
    new_expiry;

end;
$rotate_invitation_retry$;


revoke all
on function
public.rotate_workspace_invitation_for_retry(
  uuid
)
from
  public,
  anon;


grant execute
on function
public.rotate_workspace_invitation_for_retry(
  uuid
)
to authenticated;



-- ============================================================
-- USER-SAFE DELIVERY STATUS
--
-- NEVER returns token_hash or plaintext token.
-- ============================================================

create or replace function
public.get_workspace_invitation_delivery_status(
  target_workspace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  private,
  pg_temp
as $workspace_invitation_delivery_status$
declare
  actor_user_id uuid :=
    auth.uid();

  result_data jsonb :=
    '[]'::jsonb;
begin

  if actor_user_id
    is null
  then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;


  if not public.has_campaign_permission(
    target_workspace_id,
    'workspace.invite_members'
  )
  then
    raise exception
      'You cannot view invitation delivery status.'
      using errcode = '42501';
  end if;


  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'invitation_id',
          invitation.id,

          'email',
          invitation.email,

          'role_key',
          invitation.role_key,

          'display_title',
          invitation.display_title,

          'invitation_status',
          invitation.status,

          'expires_at',
          invitation.expires_at,

          'delivery_status',
          coalesce(
            delivery.delivery_status,
            'pending'
          ),

          'attempts',
          coalesce(
            delivery.attempts,
            0
          ),

          'token_version',
          coalesce(
            delivery.token_version,
            1
          ),

          'last_attempt_at',
          delivery.last_attempt_at,

          'sent_at',
          delivery.sent_at,

          'provider_message_id',
          delivery.provider_message_id,

          'last_error',
          delivery.last_error,

          'can_retry',
          invitation.status =
            'pending'

            and coalesce(
              delivery.delivery_status,
              'pending'
            ) in (
              'pending',
              'failed'
            )
        )

        order by
          invitation.created_at desc
      ),
      '[]'::jsonb
    )

  into result_data

  from public.workspace_invitations
    as invitation

  left join
  private.workspace_invitation_deliveries
    as delivery
    on delivery.invitation_id =
      invitation.id

  where invitation.workspace_id =
    target_workspace_id;


  return jsonb_build_object(
    'workspace_id',
    target_workspace_id,

    'invitations',
    result_data
  );

end;
$workspace_invitation_delivery_status$;


revoke all
on function
public.get_workspace_invitation_delivery_status(
  uuid
)
from
  public,
  anon;


grant execute
on function
public.get_workspace_invitation_delivery_status(
  uuid
)
to authenticated;


notify pgrst, 'reload schema';

commit;

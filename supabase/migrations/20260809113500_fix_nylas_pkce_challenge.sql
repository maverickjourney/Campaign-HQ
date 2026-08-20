-- Fix Nylas Hosted OAuth PKCE challenge encoding.
begin;

create or replace function
public.begin_email_contacts_oauth(
  target_workspace_id uuid,
  target_provider text
)
returns table (
  oauth_state text,
  code_challenge text,
  oauth_expires_at timestamptz
)
language plpgsql
security definer
set search_path to
  'public',
  'private',
  'extensions',
  'pg_temp'
as $function$
declare
  current_actor_user_id uuid :=
    auth.uid();

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


  if target_provider not in (
    'google',
    'microsoft'
  ) then
    raise exception
      'Only Google or Microsoft can be connected during Email & Contacts onboarding.'
      using errcode = '22023';
  end if;


  if not exists (
    select 1
    from public.workspace_members
      as member
    where
      member.workspace_id =
        target_workspace_id

      and member.user_id =
        current_actor_user_id

      and member.status =
        'active'

      and member.membership_state =
        'active'

      and member.dashboard_type in (
        'command',
        'candidate'
      )
  ) then
    raise exception
      'A protected leadership membership is required to connect campaign email.'
      using errcode = '42501';
  end if;


  if not exists (
    select 1
    from public.workspaces
      as workspace
    where
      workspace.id =
        target_workspace_id

      and workspace.onboarding_status =
        'active'

      and workspace.onboarding_current_step =
        'communications'
  ) then
    raise exception
      'Email & Contacts is not the current Campaign Seat onboarding phase.';
  end if;


  if not exists (
    select 1
    from public.workspace_onboarding_steps
      as onboarding_step
    where
      onboarding_step.workspace_id =
        target_workspace_id

      and onboarding_step.step_key =
        'team'

      and onboarding_step.status =
        'complete'
  ) then
    raise exception
      'Team & Access must be complete before connecting campaign email.';
  end if;


  delete from
    private.workspace_oauth_states
      as oauth_state
  where
    (
      oauth_state.expires_at <= now()
      or oauth_state.consumed_at is not null
    )
    and oauth_state.actor_user_id =
      current_actor_user_id;


  raw_state =
    encode(
      gen_random_bytes(32),
      'hex'
    );


  raw_code_verifier =
    rtrim(
      translate(
        encode(
          gen_random_bytes(48),
          'base64'
        ),
        '+/',
        '-_'
      ),
      '='
    );


  encoded_challenge =
    rtrim(
      translate(
        encode(
          convert_to(
            encode(
              digest(
                raw_code_verifier,
                'sha256'
              ),
              'hex'
            ),
            'UTF8'
          ),
          'base64'
        ),
        '+/',
        '-_'
      ),
      '='
    );


  insert into
  private.workspace_oauth_states (
    workspace_id,
    actor_user_id,
    provider,
    state_hash,
    code_verifier,
    expires_at
  )
  values (
    target_workspace_id,
    current_actor_user_id,
    target_provider,
    encode(
      digest(
        raw_state,
        'sha256'
      ),
      'hex'
    ),
    raw_code_verifier,
    expiry
  );


  return query
  select
    raw_state,
    encoded_challenge,
    expiry;
end;
$function$;

commit;

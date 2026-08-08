-- Campaign Seat
--
-- Advance the post-activation onboarding flow from Security
-- to Team & Access.
--
-- Completion requires:
--   * a signed-in user
--   * an AAL2 Supabase session
--   * an active leadership membership
--   * an active workspace currently positioned at Security
--   * Review already complete
--
-- A second authenticator remains recommended in the UI but
-- is intentionally not required to complete onboarding.
--
-- This function does not create provider connections,
-- credentials, or provisioning requests.

create or replace function
public.complete_security_onboarding(
  target_workspace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to
  'public',
  'private',
  'pg_temp'
as $function$
declare
  actor_user_id uuid :=
    auth.uid();

  actor_is_authorized boolean;

  current_onboarding_status text;
  current_onboarding_step text;

  security_step_status text;
  team_step_status text;

  updated_workspace jsonb;
  onboarding_steps jsonb;
begin
  perform public.require_aal2();

  if actor_user_id is null then
    raise exception
      'A signed-in Campaign Seat session is required.'
      using errcode = '42501';
  end if;


  select exists (
    select 1
    from public.workspace_members
      as member
    where
      member.workspace_id =
        target_workspace_id
      and member.user_id =
        actor_user_id
      and member.status =
        'active'
      and member.membership_state =
        'active'
      and member.role_key in (
        'campaign_owner',
        'candidate',
        'campaign_consultant',
        'campaign_manager',
        'campaign_administrator'
      )
  )
  into actor_is_authorized;

  if not actor_is_authorized then
    raise exception
      'Your campaign role is not authorized to complete Security onboarding.'
      using errcode = '42501';
  end if;


  select
    workspace.onboarding_status,
    workspace.onboarding_current_step
  into
    current_onboarding_status,
    current_onboarding_step
  from public.workspaces
    as workspace
  where
    workspace.id =
      target_workspace_id
  for update;

  if not found then
    raise exception
      'The selected Campaign Seat workspace was not found.'
      using errcode = 'P0002';
  end if;

  if current_onboarding_status <>
    'active'
  then
    raise exception
      'Activate Campaign Seat before completing Security onboarding.';
  end if;

  if current_onboarding_step <>
    'security'
  then
    raise exception
      'Security onboarding is not the current Campaign Seat setup phase.';
  end if;


  if not exists (
    select 1
    from public.workspace_onboarding_steps
      as onboarding_step
    where
      onboarding_step.workspace_id =
        target_workspace_id
      and onboarding_step.step_key =
        'review'
      and onboarding_step.status =
        'complete'
  ) then
    raise exception
      'Review must be complete before Security onboarding can finish.';
  end if;


  select
    onboarding_step.status
  into
    security_step_status
  from public.workspace_onboarding_steps
    as onboarding_step
  where
    onboarding_step.workspace_id =
      target_workspace_id
    and onboarding_step.step_key =
      'security'
  for update;

  if not found then
    raise exception
      'The Security onboarding step is missing.';
  end if;

  if security_step_status not in (
    'pending',
    'in_progress'
  ) then
    raise exception
      'Security onboarding is already complete or unavailable.';
  end if;


  select
    onboarding_step.status
  into
    team_step_status
  from public.workspace_onboarding_steps
    as onboarding_step
  where
    onboarding_step.workspace_id =
      target_workspace_id
    and onboarding_step.step_key =
      'team'
  for update;

  if not found then
    raise exception
      'The Team onboarding step is missing.';
  end if;

  if team_step_status <>
    'pending'
  then
    raise exception
      'Team onboarding must be pending before Security can advance.';
  end if;


  update
  public.workspace_onboarding_steps
  set
    status =
      'complete',

    completed_at =
      coalesce(
        completed_at,
        now()
      ),

    completed_by =
      coalesce(
        completed_by,
        actor_user_id
      ),

    updated_at =
      now()

  where
    workspace_id =
      target_workspace_id
    and step_key =
      'security';


  update
  public.workspace_onboarding_steps
  set
    status =
      'in_progress',

    updated_at =
      now()

  where
    workspace_id =
      target_workspace_id
    and step_key =
      'team';


  update
  public.workspaces
  set
    onboarding_current_step =
      'team',

    setup_metadata =
      setup_metadata ||
      jsonb_build_object(
        'security_completed_at',
        now(),
        'security_completed_by',
        actor_user_id,
        'next_setup_phase',
        'team'
      )

  where
    workspaces.id =
      target_workspace_id;


  select
    to_jsonb(
      workspace_record
    )
  into
    updated_workspace
  from public.workspaces
    as workspace_record
  where
    workspace_record.id =
      target_workspace_id;


  select
    coalesce(
      jsonb_agg(
        to_jsonb(
          onboarding_record
        )
        order by
          onboarding_record.step_key
      ),
      '[]'::jsonb
    )
  into
    onboarding_steps
  from public.workspace_onboarding_steps
    as onboarding_record
  where
    onboarding_record.workspace_id =
      target_workspace_id;


  return jsonb_build_object(
    'workspace',
    updated_workspace,
    'onboardingSteps',
    onboarding_steps,
    'nextPhase',
    'team'
  );
end;
$function$;


revoke all
on function
public.complete_security_onboarding(uuid)
from public;

revoke all
on function
public.complete_security_onboarding(uuid)
from anon;

grant execute
on function
public.complete_security_onboarding(uuid)
to authenticated;

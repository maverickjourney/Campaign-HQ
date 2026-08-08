-- Campaign Seat
--
-- Advance post-activation onboarding from:
--
--   Team & Access
--       to
--   Email & Contacts
--
-- Team completion is a leadership review/confirmation step.
-- Sending or accepting an invitation is intentionally NOT
-- required to finish this phase.
--
-- Requirements:
--   * signed-in user
--   * AAL2 session
--   * active command/candidate membership
--   * workspace.invite_members permission
--   * active workspace currently at Team
--   * Security complete
--   * exactly one active Campaign Owner
--   * at least one active member
--   * all active members use valid active roles
--
-- This function does not modify invitations, member access,
-- provider connections, credentials, or provisioning.

create or replace function
public.complete_team_onboarding(
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

  actor_is_leadership boolean;

  current_onboarding_status text;
  current_onboarding_step text;

  team_step_status text;
  communications_step_status text;

  active_member_count bigint;
  active_owner_count bigint;

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

      and member.dashboard_type in (
        'command',
        'candidate'
      )
  )
  into actor_is_leadership;


  if not actor_is_leadership then
    raise exception
      'A protected leadership membership is required to complete Team & Access onboarding.'
      using errcode = '42501';
  end if;


  if not public.has_campaign_permission(
    target_workspace_id,
    'workspace.invite_members'
  ) then
    raise exception
      'Your campaign access does not permit Team & Access confirmation.'
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
      'Activate Campaign Seat before completing Team & Access onboarding.';
  end if;


  if current_onboarding_step <>
    'team'
  then
    raise exception
      'Team & Access is not the current Campaign Seat onboarding phase.';
  end if;


  if not exists (
    select 1
    from public.workspace_onboarding_steps
      as onboarding_step
    where
      onboarding_step.workspace_id =
        target_workspace_id

      and onboarding_step.step_key =
        'security'

      and onboarding_step.status =
        'complete'
  ) then
    raise exception
      'Security must be complete before Team & Access can finish.';
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
    'in_progress'
  then
    raise exception
      'Team & Access must be in progress before it can be completed.';
  end if;


  select
    onboarding_step.status
  into
    communications_step_status
  from public.workspace_onboarding_steps
    as onboarding_step
  where
    onboarding_step.workspace_id =
      target_workspace_id

    and onboarding_step.step_key =
      'communications'
  for update;


  if not found then
    raise exception
      'The Email & Contacts onboarding step is missing.';
  end if;


  if communications_step_status <>
    'pending'
  then
    raise exception
      'Email & Contacts must be pending before Team & Access can advance.';
  end if;


  select
    count(*)
  into
    active_member_count
  from public.workspace_members
    as member
  where
    member.workspace_id =
      target_workspace_id

    and member.status =
      'active'

    and member.membership_state =
      'active';


  if active_member_count < 1 then
    raise exception
      'At least one active Campaign Seat member is required.';
  end if;


  select
    count(*)
  into
    active_owner_count
  from public.workspace_members
    as member
  where
    member.workspace_id =
      target_workspace_id

    and member.status =
      'active'

    and member.membership_state =
      'active'

    and member.role_key =
      'campaign_owner';


  if active_owner_count <> 1 then
    raise exception
      'Campaign Seat requires exactly one active Campaign Owner before Team & Access can be confirmed.';
  end if;


  if exists (
    select 1
    from public.workspace_members
      as member

    left join public.campaign_roles
      as role_record
      on role_record.key =
        member.role_key

    where
      member.workspace_id =
        target_workspace_id

      and member.status =
        'active'

      and member.membership_state =
        'active'

      and (
        role_record.key is null
        or role_record.is_active
          is not true
      )
  ) then
    raise exception
      'One or more active campaign members have an unavailable Campaign Seat role.';
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
      'team';


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
      'communications';


  update
  public.workspaces
  set
    onboarding_current_step =
      'communications',

    setup_metadata =
      setup_metadata ||
      jsonb_build_object(
        'team_completed_at',
        now(),

        'team_completed_by',
        actor_user_id,

        'next_setup_phase',
        'communications'
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
    'communications'
  );
end;
$function$;


revoke all
on function
public.complete_team_onboarding(uuid)
from public;

revoke all
on function
public.complete_team_onboarding(uuid)
from anon;

grant execute
on function
public.complete_team_onboarding(uuid)
to authenticated;

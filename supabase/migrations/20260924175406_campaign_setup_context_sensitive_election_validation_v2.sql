
create or replace function public.activate_campaign_setup(
  target_workspace_id uuid,
  target_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_is_authorized boolean;
  payload jsonb := coalesce(target_payload, '{}'::jsonb);
  campaign_type text := lower(btrim(coalesce(target_payload->>'campaignType','')));
  saved_workspace jsonb;
  activated_workspace jsonb;
  onboarding_steps jsonb;
begin
  perform public.require_aal2();

  if actor_user_id is null then
    raise exception 'A signed-in Campaign Seat session is required.'
      using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.workspace_members member
    where member.workspace_id = target_workspace_id
      and member.user_id = actor_user_id
      and member.status = 'active'
      and member.membership_state = 'active'
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
    raise exception 'Your campaign role is not authorized to activate Campaign Seat.'
      using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(payload->>'officeSought','')), '') is null then
    raise exception 'Enter the office, race, focus or public purpose before activation.';
  end if;

  if nullif(btrim(coalesce(payload->>'jurisdictionName','')), '') is null then
    raise exception 'Enter the primary geography or jurisdiction before activation.';
  end if;

  if campaign_type in ('candidate_campaign','ballot_measure')
     and nullif(btrim(coalesce(payload->>'primaryElectionDate','')), '') is null
     and nullif(btrim(coalesce(payload->>'generalElectionDate','')), '') is null
  then
    raise exception 'Enter at least one election date before activation.';
  end if;

  if nullif(btrim(coalesce(payload->>'timezone','')), '') is null then
    raise exception 'Choose the campaign timezone before activation.';
  end if;

  saved_workspace :=
    public.save_campaign_setup_draft(
      target_workspace_id,
      payload,
      'review'
    );

  update public.workspaces
  set onboarding_status = 'active',
      onboarding_current_step = 'security',
      setup_metadata =
        setup_metadata ||
        jsonb_build_object(
          'core_workspace_activated_at', now(),
          'core_workspace_activated_by', actor_user_id,
          'next_setup_phase', 'security'
        )
  where id = target_workspace_id;

  update public.workspace_onboarding_steps
  set status = case
        when step_key = 'review' then 'complete'
        when step_key = 'security' then 'in_progress'
        else status
      end,
      completed_at = case
        when step_key = 'review' then coalesce(completed_at, now())
        else completed_at
      end,
      completed_by = case
        when step_key = 'review' then coalesce(completed_by, actor_user_id)
        else completed_by
      end,
      updated_at = now()
  where workspace_id = target_workspace_id
    and step_key in ('review','security');

  select to_jsonb(workspace_record)
  into activated_workspace
  from public.workspaces workspace_record
  where workspace_record.id = target_workspace_id;

  select coalesce(
    jsonb_agg(to_jsonb(onboarding_record) order by onboarding_record.step_key),
    '[]'::jsonb
  )
  into onboarding_steps
  from public.workspace_onboarding_steps onboarding_record
  where onboarding_record.workspace_id = target_workspace_id;

  return jsonb_build_object(
    'workspace', activated_workspace,
    'onboardingSteps', onboarding_steps,
    'nextPhase', 'security'
  );
end;
$$;
;

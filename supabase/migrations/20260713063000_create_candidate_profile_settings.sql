-- CAMPAIGN HQ — CANDIDATE PROFILE SETTINGS

begin;

create or replace function public.update_own_campaign_profile(
  target_workspace_id uuid,
  target_full_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $campaign_hq$
declare
  clean_name text := btrim(coalesce(target_full_name, ''));
  previous_name text;
  updated_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'You do not have access to this campaign workspace.';
  end if;

  if char_length(clean_name) < 1 or char_length(clean_name) > 160 then
    raise exception 'The full name must be between 1 and 160 characters.';
  end if;

  select profile.full_name
  into previous_name
  from public.profiles as profile
  where profile.id = auth.uid();

  update public.profiles
  set full_name = clean_name
  where profiles.id = auth.uid()
  returning *
  into updated_profile;

  if not found then
    raise exception 'Campaign profile could not be found.';
  end if;

  if previous_name is distinct from clean_name then
    insert into public.activity_log (
      workspace_id,
      actor_user_id,
      activity_type,
      title,
      detail,
      entity_type,
      entity_id,
      route,
      metadata,
      occurred_at
    )
    values (
      target_workspace_id,
      auth.uid(),
      'profile_updated',
      'Candidate profile updated',
      clean_name,
      'profile',
      auth.uid(),
      '/profile/settings',
      jsonb_build_object('full_name', clean_name),
      now()
    );
  end if;

  return jsonb_build_object(
    'id', updated_profile.id,
    'full_name', updated_profile.full_name,
    'email', updated_profile.email
  );
end
$campaign_hq$;

revoke all
on function public.update_own_campaign_profile(uuid, text)
from public;

grant execute
on function public.update_own_campaign_profile(uuid, text)
to authenticated;

notify pgrst, 'reload schema';

commit;

select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'update_own_campaign_profile';

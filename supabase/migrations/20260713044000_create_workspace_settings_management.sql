-- ============================================================
-- CAMPAIGN HQ — WORKSPACE SETTINGS MANAGEMENT
-- Adds one protected RPC for campaign identity settings.
-- Existing workspace records and memberships are reused.
-- ============================================================

begin;

create or replace function
public.manage_workspace_settings(
  target_workspace_id uuid,
  target_name text,
  target_description text,
  target_location text,
  target_election_date date
)
returns table (
  id uuid,
  name text,
  description text,
  location text,
  election_date date,
  status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $campaign_hq$
declare
  actor_user_id uuid :=
    auth.uid();

  normalized_name text :=
    btrim(
      coalesce(
        target_name,
        ''
      )
    );

  normalized_description text :=
    btrim(
      coalesce(
        target_description,
        ''
      )
    );

  normalized_location text :=
    btrim(
      coalesce(
        target_location,
        ''
      )
    );

  actor_is_authorized boolean;
begin
  if actor_user_id is null then
    raise exception
      'Authentication is required.';
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
      'You do not have permission to manage workspace settings.';
  end if;

  if normalized_name = '' then
    raise exception
      'Campaign name is required.';
  end if;

  if char_length(
    normalized_name
  ) > 120 then
    raise exception
      'Campaign name is too long.';
  end if;

  if normalized_description = '' then
    raise exception
      'Campaign race or office description is required.';
  end if;

  if char_length(
    normalized_description
  ) > 300 then
    raise exception
      'Campaign description is too long.';
  end if;

  if normalized_location = '' then
    raise exception
      'Campaign location is required.';
  end if;

  if char_length(
    normalized_location
  ) > 160 then
    raise exception
      'Campaign location is too long.';
  end if;

  if target_election_date is null then
    raise exception
      'Election date is required.';
  end if;

  update public.workspaces
  set
    name =
      normalized_name,
    description =
      normalized_description,
    location =
      normalized_location,
    election_date =
      target_election_date
  where
    workspaces.id =
      target_workspace_id;

  if not found then
    raise exception
      'The selected campaign workspace was not found.';
  end if;

  return query
  select
    workspace_record.id,
    workspace_record.name,
    workspace_record.description,
    workspace_record.location,
    workspace_record.election_date,
    workspace_record.status
  from public.workspaces
    as workspace_record
  where
    workspace_record.id =
      target_workspace_id;
end
$campaign_hq$;

revoke all
on function
public.manage_workspace_settings(
  uuid,
  text,
  text,
  text,
  date
)
from public;

grant execute
on function
public.manage_workspace_settings(
  uuid,
  text,
  text,
  text,
  date
)
to authenticated;

notify pgrst, 'reload schema';

commit;

-- ============================================================
-- CAMPAIGN HQ — TEAM ACCESS MANAGEMENT
-- Adds one protected RPC for changing existing member access.
-- The existing invitation system remains unchanged.
-- ============================================================

begin;

create or replace function
public.manage_workspace_member_access(
  target_workspace_id uuid,
  target_membership_id uuid,
  target_role_key text,
  target_display_title text default null,
  target_status text default 'active'
)
returns table (
  membership_id uuid,
  member_user_id uuid,
  member_role_key text,
  member_display_title text,
  member_dashboard_type text,
  member_seat_type text,
  member_status text,
  member_membership_state text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $campaign_hq$
declare
  actor_user_id uuid :=
    auth.uid();

  actor_role_key text;
  actor_authority_rank integer;

  existing_user_id uuid;
  existing_role_key text;
  existing_authority_rank integer;

  selected_role record;
  normalized_title text;
begin
  if actor_user_id is null then
    raise exception
      'Authentication is required.';
  end if;

  if target_status not in (
    'active',
    'inactive'
  ) then
    raise exception
      'Member status must be active or inactive.';
  end if;

  if not public.has_campaign_permission(
    target_workspace_id,
    'workspace.invite_members'
  ) then
    raise exception
      'You do not have permission to manage workspace members.';
  end if;

  select
    member.role_key,
    role_record.authority_rank
  into
    actor_role_key,
    actor_authority_rank
  from public.workspace_members
    as member
  join public.campaign_roles
    as role_record
    on role_record.key =
      member.role_key
  where
    member.workspace_id =
      target_workspace_id
    and member.user_id =
      actor_user_id
    and member.status =
      'active'
    and member.membership_state =
      'active'
  limit 1;

  if actor_role_key is null then
    raise exception
      'An active leadership membership could not be verified.';
  end if;

  select
    member.user_id,
    member.role_key,
    role_record.authority_rank
  into
    existing_user_id,
    existing_role_key,
    existing_authority_rank
  from public.workspace_members
    as member
  join public.campaign_roles
    as role_record
    on role_record.key =
      member.role_key
  where
    member.id =
      target_membership_id
    and member.workspace_id =
      target_workspace_id
  for update;

  if existing_user_id is null then
    raise exception
      'The selected campaign membership was not found.';
  end if;

  if existing_user_id =
    actor_user_id
  then
    raise exception
      'You cannot change your own active access from this screen.';
  end if;

  if existing_role_key =
    'campaign_owner'
  then
    raise exception
      'Campaign owner access is protected.';
  end if;

  if target_role_key =
    'campaign_owner'
  then
    raise exception
      'Campaign owner access cannot be assigned from this screen.';
  end if;

  select
    role_record.key,
    role_record.name,
    role_record.dashboard_type,
    role_record.seat_type,
    role_record.authority_rank
  into
    selected_role
  from public.campaign_roles
    as role_record
  where
    role_record.key =
      target_role_key
    and role_record.is_active =
      true;

  if selected_role.key is null then
    raise exception
      'The selected campaign role is unavailable.';
  end if;

  if
    actor_authority_rank >
      existing_authority_rank
  then
    raise exception
      'You cannot change a member with greater campaign authority.';
  end if;

  if
    actor_authority_rank >
      selected_role.authority_rank
  then
    raise exception
      'You cannot assign a role with greater campaign authority than your own.';
  end if;

  normalized_title =
    coalesce(
      nullif(
        btrim(
          target_display_title
        ),
        ''
      ),
      selected_role.name
    );

  update public.workspace_members
  set
    role_key =
      selected_role.key,
    display_title =
      normalized_title,
    dashboard_type =
      selected_role.dashboard_type,
    seat_type =
      selected_role.seat_type,
    status =
      target_status,
    membership_state =
      target_status
  where
    id =
      target_membership_id
    and workspace_id =
      target_workspace_id;

  return query
  select
    member.id,
    member.user_id,
    member.role_key,
    member.display_title,
    member.dashboard_type,
    member.seat_type,
    member.status,
    member.membership_state
  from public.workspace_members
    as member
  where
    member.id =
      target_membership_id
    and member.workspace_id =
      target_workspace_id;
end
$campaign_hq$;

revoke all
on function
public.manage_workspace_member_access(
  uuid,
  uuid,
  text,
  text,
  text
)
from public;

grant execute
on function
public.manage_workspace_member_access(
  uuid,
  uuid,
  text,
  text,
  text
)
to authenticated;

notify pgrst, 'reload schema';

commit;

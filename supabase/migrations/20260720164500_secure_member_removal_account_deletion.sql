begin;

-- ============================================================
-- PRESERVE CAMPAIGN HISTORY WHEN A USER ACCOUNT IS DELETED
-- ============================================================

alter table public.campaign_communications
  alter column created_by drop not null;

alter table public.campaign_communications
  drop constraint if exists
    campaign_communications_created_by_fkey;

alter table public.campaign_communications
  add constraint
    campaign_communications_created_by_fkey
  foreign key (created_by)
  references public.profiles(id)
  on delete set null;


alter table public.campaign_contacts
  alter column created_by drop not null;

alter table public.campaign_contacts
  alter column updated_by drop not null;

alter table public.campaign_contacts
  drop constraint if exists
    campaign_contacts_created_by_fkey;

alter table public.campaign_contacts
  add constraint
    campaign_contacts_created_by_fkey
  foreign key (created_by)
  references public.profiles(id)
  on delete set null;

alter table public.campaign_contacts
  drop constraint if exists
    campaign_contacts_updated_by_fkey;

alter table public.campaign_contacts
  add constraint
    campaign_contacts_updated_by_fkey
  foreign key (updated_by)
  references public.profiles(id)
  on delete set null;


alter table public.field_assignment_handoffs
  alter column sent_by drop not null;

alter table public.field_assignment_handoffs
  alter column volunteer_user_id drop not null;

alter table public.field_assignment_handoffs
  drop constraint if exists
    field_assignment_handoffs_sent_by_fkey;

alter table public.field_assignment_handoffs
  add constraint
    field_assignment_handoffs_sent_by_fkey
  foreign key (sent_by)
  references public.profiles(id)
  on delete set null;

alter table public.field_assignment_handoffs
  drop constraint if exists
    field_assignment_handoffs_volunteer_user_id_fkey;

alter table public.field_assignment_handoffs
  add constraint
    field_assignment_handoffs_volunteer_user_id_fkey
  foreign key (volunteer_user_id)
  references public.profiles(id)
  on delete set null;


alter table public.field_assignments
  alter column created_by drop not null;

alter table public.field_assignments
  alter column volunteer_user_id drop not null;

alter table public.field_assignments
  drop constraint if exists
    field_assignments_created_by_fkey;

alter table public.field_assignments
  add constraint
    field_assignments_created_by_fkey
  foreign key (created_by)
  references public.profiles(id)
  on delete set null;

alter table public.field_assignments
  drop constraint if exists
    field_assignments_volunteer_user_id_fkey;

alter table public.field_assignments
  add constraint
    field_assignments_volunteer_user_id_fkey
  foreign key (volunteer_user_id)
  references public.profiles(id)
  on delete set null;


alter table public.support_access_grants
  alter column requested_by drop not null;

alter table public.support_access_grants
  drop constraint if exists
    support_access_grants_requested_by_fkey;

alter table public.support_access_grants
  add constraint
    support_access_grants_requested_by_fkey
  foreign key (requested_by)
  references public.profiles(id)
  on delete set null;


alter table public.workspace_invitations
  alter column invited_by drop not null;

alter table public.workspace_invitations
  drop constraint if exists
    workspace_invitations_invited_by_fkey;

alter table public.workspace_invitations
  add constraint
    workspace_invitations_invited_by_fkey
  foreign key (invited_by)
  references public.profiles(id)
  on delete set null;


-- Preserve task comments while removing the deleted author reference.
alter table public.task_comments
  alter column author_id drop not null;

alter table public.task_comments
  drop constraint if exists
    task_comments_author_id_fkey;

alter table public.task_comments
  add constraint
    task_comments_author_id_fkey
  foreign key (author_id)
  references public.profiles(id)
  on delete set null;


-- ============================================================
-- SECURE REMOVE / RESTORE ACCESS
-- ============================================================

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
  actor_user_id uuid := auth.uid();

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
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if target_status not in (
    'active',
    'inactive'
  ) then
    raise exception
      'Member status must be active or inactive.'
      using errcode = '22023';
  end if;

  if not public.has_campaign_permission(
    target_workspace_id,
    'workspace.invite_members'
  ) then
    raise exception
      'You do not have permission to manage workspace members.'
      using errcode = '42501';
  end if;

  select
    member.role_key,
    role_record.authority_rank
  into
    actor_role_key,
    actor_authority_rank
  from public.workspace_members as member
  join public.campaign_roles as role_record
    on role_record.key = member.role_key
  where member.workspace_id = target_workspace_id
    and member.user_id = actor_user_id
    and member.status = 'active'
    and member.membership_state = 'active'
  limit 1;

  if actor_role_key is null then
    raise exception
      'An active leadership membership could not be verified.'
      using errcode = '42501';
  end if;

  select
    member.user_id,
    member.role_key,
    role_record.authority_rank
  into
    existing_user_id,
    existing_role_key,
    existing_authority_rank
  from public.workspace_members as member
  join public.campaign_roles as role_record
    on role_record.key = member.role_key
  where member.id = target_membership_id
    and member.workspace_id = target_workspace_id
  for update;

  if existing_user_id is null then
    raise exception
      'The selected campaign membership was not found.'
      using errcode = 'P0002';
  end if;

  if existing_user_id = actor_user_id then
    raise exception
      'You cannot change your own active access from this screen.'
      using errcode = '42501';
  end if;

  if existing_role_key = 'campaign_owner' then
    raise exception
      'Campaign owner access is protected.'
      using errcode = '42501';
  end if;

  if target_role_key = 'campaign_owner' then
    raise exception
      'Campaign owner access cannot be assigned from this screen.'
      using errcode = '42501';
  end if;

  select
    role_record.key,
    role_record.name,
    role_record.dashboard_type,
    role_record.seat_type,
    role_record.authority_rank
  into selected_role
  from public.campaign_roles as role_record
  where role_record.key = target_role_key
    and role_record.is_active = true;

  if selected_role.key is null then
    raise exception
      'The selected campaign role is unavailable.'
      using errcode = '22023';
  end if;

  if actor_authority_rank > existing_authority_rank then
    raise exception
      'You cannot change a member with greater campaign authority.'
      using errcode = '42501';
  end if;

  if actor_authority_rank > selected_role.authority_rank then
    raise exception
      'You cannot assign a role with greater campaign authority than your own.'
      using errcode = '42501';
  end if;

  normalized_title =
    coalesce(
      nullif(
        btrim(target_display_title),
        ''
      ),
      selected_role.name
    );

  update public.workspace_members
  set
    role_key = selected_role.key,
    display_title = normalized_title,
    dashboard_type =
      selected_role.dashboard_type,
    seat_type =
      selected_role.seat_type,
    status =
      target_status,
    membership_state =
      case
        when target_status = 'active'
          then 'active'
        else 'removed'
      end
  where id = target_membership_id
    and workspace_id = target_workspace_id;

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
  from public.workspace_members as member
  where member.id = target_membership_id
    and member.workspace_id = target_workspace_id;
end;
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
from public, anon;

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


-- ============================================================
-- SECURE PERMANENT ACCOUNT-DELETION GATE
-- ============================================================

create or replace function
public.prepare_workspace_account_deletion(
  target_workspace_id uuid,
  target_membership_id uuid,
  confirmation_email text
)
returns table (
  target_user_id uuid,
  target_email text,
  revoked_membership_id uuid
)
language plpgsql
security definer
set search_path = public, auth, storage, pg_temp
as $campaign_seat$
declare
  actor_user_id uuid := auth.uid();

  actor_authority_rank integer;
  selected_user_id uuid;
  selected_email text;
  selected_authority_rank integer;
  selected_role_key text;

  other_workspace_count integer;
  owned_storage_count integer;
begin
  if actor_user_id is null then
    raise exception
      'A signed-in Campaign Seat session is required.'
      using errcode = '42501';
  end if;

  if not public.has_campaign_permission(
    target_workspace_id,
    'workspace.invite_members'
  ) then
    raise exception
      'Your campaign role is not authorized to permanently delete members.'
      using errcode = '42501';
  end if;

  select
    role_record.authority_rank
  into
    actor_authority_rank
  from public.workspace_members as member
  join public.campaign_roles as role_record
    on role_record.key = member.role_key
  where member.workspace_id = target_workspace_id
    and member.user_id = actor_user_id
    and member.status = 'active'
    and member.membership_state = 'active'
  limit 1;

  if actor_authority_rank is null then
    raise exception
      'An active leadership membership could not be verified.'
      using errcode = '42501';
  end if;

  select
    member.user_id,
    auth_user.email,
    role_record.authority_rank,
    member.role_key
  into
    selected_user_id,
    selected_email,
    selected_authority_rank,
    selected_role_key
  from public.workspace_members as member
  join public.campaign_roles as role_record
    on role_record.key = member.role_key
  join auth.users as auth_user
    on auth_user.id = member.user_id
  where member.id = target_membership_id
    and member.workspace_id = target_workspace_id
  for update of member;

  if selected_user_id is null then
    raise exception
      'The selected campaign membership was not found.'
      using errcode = 'P0002';
  end if;

  if selected_user_id = actor_user_id then
    raise exception
      'You cannot permanently delete your own account.'
      using errcode = '42501';
  end if;

  if selected_role_key = 'campaign_owner' then
    raise exception
      'Campaign owner accounts are protected.'
      using errcode = '42501';
  end if;

  if actor_authority_rank >= selected_authority_rank then
    raise exception
      'You may permanently delete only members with lower campaign authority.'
      using errcode = '42501';
  end if;

  if
    lower(
      btrim(
        coalesce(
          confirmation_email,
          ''
        )
      )
    ) <>
    lower(
      btrim(
        coalesce(
          selected_email,
          ''
        )
      )
    )
  then
    raise exception
      'The confirmation email does not match the selected account.'
      using errcode = '22023';
  end if;

  select count(*)
  into other_workspace_count
  from public.workspace_members
  where user_id = selected_user_id
    and workspace_id <>
      target_workspace_id;

  if other_workspace_count > 0 then
    raise exception
      'This account belongs to another campaign workspace and cannot be permanently deleted here.'
      using errcode = '23503';
  end if;

  select count(*)
  into owned_storage_count
  from storage.objects
  where owner_id::text =
    selected_user_id::text;

  if owned_storage_count > 0 then
    raise exception
      'This account owns % stored file(s). Transfer or remove those files before permanently deleting the account.',
      owned_storage_count
      using errcode = '23503';
  end if;

  update public.workspace_members
  set
    status = 'inactive',
    membership_state = 'removed'
  where id = target_membership_id
    and workspace_id =
      target_workspace_id;

  return query
  select
    selected_user_id,
    selected_email,
    target_membership_id;
end;
$campaign_seat$;

revoke all
on function
public.prepare_workspace_account_deletion(
  uuid,
  uuid,
  text
)
from public, anon;

grant execute
on function
public.prepare_workspace_account_deletion(
  uuid,
  uuid,
  text
)
to authenticated;

comment on function
public.prepare_workspace_account_deletion(
  uuid,
  uuid,
  text
)
is
  'Validates authority, email confirmation, workspace exclusivity and file ownership before revoking access for permanent account deletion.';

notify pgrst, 'reload schema';

commit;

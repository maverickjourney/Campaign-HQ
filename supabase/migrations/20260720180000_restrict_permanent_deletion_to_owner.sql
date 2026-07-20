begin;

-- ============================================================
-- CAMPAIGN SEAT — OWNER-ONLY PERMANENT ACCOUNT DELETION
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
  actor_role_key text;

  selected_user_id uuid;
  selected_email text;
  selected_role_key text;

  other_workspace_count integer;
  owned_storage_count integer;
begin
  if actor_user_id is null then
    raise exception
      'A signed-in Campaign Seat session is required.'
      using errcode = '42501';
  end if;

  select member.role_key
  into actor_role_key
  from public.workspace_members as member
  where member.workspace_id = target_workspace_id
    and member.user_id = actor_user_id
    and member.status = 'active'
    and member.membership_state = 'active'
  limit 1;

  if actor_role_key is distinct from 'campaign_owner' then
    raise exception
      'Only the campaign owner may permanently delete Campaign Seat accounts.'
      using errcode = '42501';
  end if;

  select
    member.user_id,
    auth_user.email,
    member.role_key
  into
    selected_user_id,
    selected_email,
    selected_role_key
  from public.workspace_members as member
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
    and workspace_id <> target_workspace_id;

  if other_workspace_count > 0 then
    raise exception
      'This account belongs to another campaign workspace and cannot be permanently deleted here.'
      using errcode = '23503';
  end if;

  select count(*)
  into owned_storage_count
  from storage.objects
  where owner_id::text = selected_user_id::text;

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
    and workspace_id = target_workspace_id;

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
  'Owner-only validation gate for permanent Campaign Seat account deletion.';

notify pgrst, 'reload schema';

commit;

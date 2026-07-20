begin;

-- ============================================================
-- CAMPAIGN SEAT — TEAM ACCESS AUDIT TRAIL
--
-- Replaces the generic workspace_members activity trigger with
-- precise events for access, role and title changes.
-- ============================================================

create or replace function
public.capture_team_access_activity()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $campaign_seat$
declare
  activity_actor_id uuid :=
    auth.uid();

  member_label text;
  access_activity_type text;
  access_activity_title text;
begin
  member_label =
    coalesce(
      nullif(
        btrim(new.display_title),
        ''
      ),
      nullif(
        btrim(new.role_key),
        ''
      ),
      'Campaign member'
    );

  if tg_op = 'INSERT' then
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
      new.workspace_id,
      coalesce(
        activity_actor_id,
        new.user_id
      ),
      'member_added',
      'Campaign member added',
      member_label,
      'member',
      new.id,
      '/team/access',
      jsonb_build_object(
        'table',
        'workspace_members',
        'operation',
        'INSERT',
        'target_user_id',
        new.user_id,
        'role_key',
        new.role_key,
        'status',
        new.status,
        'membership_state',
        new.membership_state
      ),
      now()
    );

    return new;
  end if;

  if
    new.status
      is distinct from
      old.status
    or new.membership_state
      is distinct from
      old.membership_state
  then
    if
      new.status = 'active'
      and new.membership_state = 'active'
    then
      access_activity_type =
        'member_access_restored';

      access_activity_title =
        'Member access restored';

    elsif
      new.membership_state = 'suspended'
    then
      access_activity_type =
        'member_access_suspended';

      access_activity_title =
        'Member access suspended';

    else
      access_activity_type =
        'member_access_removed';

      access_activity_title =
        'Member access removed';
    end if;

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
      new.workspace_id,
      activity_actor_id,
      access_activity_type,
      access_activity_title,
      member_label,
      'member',
      new.id,
      '/team/access',
      jsonb_build_object(
        'table',
        'workspace_members',
        'operation',
        'UPDATE',
        'target_user_id',
        new.user_id,
        'previous_status',
        old.status,
        'new_status',
        new.status,
        'previous_membership_state',
        old.membership_state,
        'new_membership_state',
        new.membership_state
      ),
      now()
    );
  end if;

  if
    new.role_key
      is distinct from
      old.role_key
  then
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
      new.workspace_id,
      activity_actor_id,
      'member_role_changed',
      'Member role changed',
      member_label ||
        ' · ' ||
        coalesce(
          old.role_key,
          'Unassigned'
        ) ||
        ' -> ' ||
        coalesce(
          new.role_key,
          'Unassigned'
        ),
      'member',
      new.id,
      '/team/access',
      jsonb_build_object(
        'table',
        'workspace_members',
        'operation',
        'UPDATE',
        'target_user_id',
        new.user_id,
        'previous_role_key',
        old.role_key,
        'new_role_key',
        new.role_key
      ),
      now()
    );
  end if;

  if
    new.display_title
      is distinct from
      old.display_title
  then
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
      new.workspace_id,
      activity_actor_id,
      'member_title_changed',
      'Member display title changed',
      coalesce(
        nullif(
          btrim(old.display_title),
          ''
        ),
        'No title'
      ) ||
        ' -> ' ||
        coalesce(
          nullif(
            btrim(new.display_title),
            ''
          ),
          'No title'
        ),
      'member',
      new.id,
      '/team/access',
      jsonb_build_object(
        'table',
        'workspace_members',
        'operation',
        'UPDATE',
        'target_user_id',
        new.user_id,
        'previous_display_title',
        old.display_title,
        'new_display_title',
        new.display_title
      ),
      now()
    );
  end if;

  return new;
end;
$campaign_seat$;

revoke all
on function
public.capture_team_access_activity()
from public, anon;

drop trigger if exists
capture_members_activity
on public.workspace_members;

drop trigger if exists
capture_team_access_activity
on public.workspace_members;

create trigger
capture_team_access_activity
after insert or update
on public.workspace_members
for each row
execute function
public.capture_team_access_activity();

comment on function
public.capture_team_access_activity()
is
  'Records precise Campaign Seat team-access events in the shared Activity Center.';

notify pgrst, 'reload schema';

commit;

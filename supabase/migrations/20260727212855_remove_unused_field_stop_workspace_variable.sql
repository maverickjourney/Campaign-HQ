-- CAMPAIGN SEAT — REMOVE UNUSED FIELD STOP WORKSPACE VARIABLE
--
-- Purpose:
--   Remove the selected_workspace_id variable and its unused
--   assignment.workspace_id selection from
--   public.record_own_field_stop_result.
--
-- Security behavior preserved:
--   • signed-in user required
--   • stop must belong to the signed-in volunteer's assignment
--   • active Volunteer membership required
--   • closed assignments cannot be updated
--   • fixed SECURITY DEFINER search_path retained
--   • PUBLIC execution remains revoked
--
-- This is a lint-only cleanup. It does not broaden access.

begin;

CREATE OR REPLACE FUNCTION "public"."record_own_field_stop_result"("target_stop_id" "uuid", "target_status" "text", "target_result_code" "text" DEFAULT NULL::"text", "target_notes" "text" DEFAULT NULL::"text") RETURNS TABLE("stop_id" "uuid", "stop_status" "text", "stop_result_code" "text", "stop_notes" "text", "stop_completed_at" timestamp with time zone, "assignment_id" "uuid", "assignment_status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  actor_user_id uuid := auth.uid();

  selected_assignment_id uuid;
  selected_assignment_status text;

  normalized_status text :=
    lower(trim(coalesce(target_status, '')));

  normalized_result text :=
    nullif(
      lower(trim(coalesce(target_result_code, ''))),
      ''
    );

  normalized_notes text :=
    nullif(trim(coalesce(target_notes, '')), '');
begin
  if actor_user_id is null then
    raise exception
      'You must be signed in to record field progress.';
  end if;

  if normalized_status not in (
    'pending',
    'completed',
    'skipped',
    'inaccessible'
  ) then
    raise exception
      'Unsupported field stop status: %',
      normalized_status;
  end if;

  if normalized_result is not null
     and normalized_result not in (
       'contacted',
       'not_home',
       'refused',
       'inaccessible',
       'moved',
       'other'
     ) then
    raise exception
      'Unsupported field result code: %',
      normalized_result;
  end if;

  select
    assignment.id,
    assignment.status
  into
    selected_assignment_id,
    selected_assignment_status
  from public.field_stops as stop
  join public.field_routes as route
    on route.id = stop.route_id
  join public.field_assignments as assignment
    on assignment.id = route.assignment_id
  where stop.id = target_stop_id
    and assignment.volunteer_user_id =
      actor_user_id
  for update of stop;

  if selected_assignment_id is null then
    raise exception
      'This field stop is not assigned to your account.';
  end if;

  if not public.is_assigned_field_volunteer(
    selected_assignment_id
  ) then
    raise exception
      'Your active Volunteer membership could not be verified.';
  end if;

  if selected_assignment_status in (
    'draft',
    'cancelled',
    'completed'
  ) then
    raise exception
      'This field assignment is not open for progress updates.';
  end if;

  update public.field_stops
  set
    status = normalized_status,

    result_code =
      case
        when normalized_status = 'pending'
          then null
        else normalized_result
      end,

    volunteer_notes = normalized_notes,

    completed_by =
      case
        when normalized_status = 'pending'
          then null
        else actor_user_id
      end,

    completed_at =
      case
        when normalized_status = 'pending'
          then null
        else now()
      end,

    updated_at = now()

  where id = target_stop_id;

  if selected_assignment_status in (
    'assigned',
    'accepted'
  )
  and normalized_status <> 'pending' then
    update public.field_assignments
    set
      status = 'in_progress',
      updated_by = actor_user_id,
      updated_at = now()
    where id = selected_assignment_id;

    selected_assignment_status :=
      'in_progress';
  end if;

  return query
  select
    stop.id,
    stop.status,
    stop.result_code,
    stop.volunteer_notes,
    stop.completed_at,
    selected_assignment_id,
    selected_assignment_status
  from public.field_stops as stop
  where stop.id = target_stop_id;
end
$$;

revoke all on function
  public.record_own_field_stop_result(
    uuid,
    text,
    text,
    text
  )
from public;

grant execute on function
  public.record_own_field_stop_result(
    uuid,
    text,
    text,
    text
  )
to authenticated;

grant execute on function
  public.record_own_field_stop_result(
    uuid,
    text,
    text,
    text
  )
to service_role;

commit;

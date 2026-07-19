-- CAMPAIGN HQ - TURF ACTION PLANNER
-- Run once in the campaign Supabase SQL Editor before the app installer.
--
-- This adds one leadership-only atomic wrapper around the existing
-- create_field_follow_up_assignment function.
--
-- Safety decisions:
--   * A generated assignment keeps one source_assignment_id.
--   * Mixed-source selections create one assignment per source assignment.
--   * The complete multi-assignment plan is one database transaction.
--   * Pending stops are not duplicated; they remain in their current active assignment.
--   * Existing results, notes, completion times, reviews, route order and lineage remain unchanged.
--   * Existing duplicate source-stop protection remains authoritative.

begin;

drop function if exists
  public.create_field_turf_action_plan(
    uuid,
    jsonb,
    uuid,
    date,
    text,
    text,
    text
  );

create function
public.create_field_turf_action_plan(
  target_workspace_id uuid,
  target_source_groups jsonb,
  target_volunteer_user_id uuid default null,
  target_assignment_date date default null,
  target_meeting_location text default null,
  target_instructions text default null,
  target_finish_mode text default 'final_stop'
)
returns table (
  source_assignment_id uuid,
  created_assignment_id uuid,
  created_route_id uuid,
  created_stop_count integer
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $campaign_hq$
declare
  actor_user_id uuid :=
    auth.uid();

  group_count integer;
  group_record record;
  result_record record;

  group_source_assignment_id uuid;
  group_source_stop_ids uuid[];
  group_title text;
  total_requested_stops integer :=
    0;

  seen_source_assignment_ids uuid[] :=
    array[]::uuid[];
begin
  if actor_user_id is null then
    raise exception
      'A signed-in Campaign HQ session is required.'
      using errcode = '42501';
  end if;

  if target_workspace_id is null then
    raise exception
      'Choose a campaign workspace before creating a Turf Action Plan.'
      using errcode = '22023';
  end if;

  if not public.is_field_leadership(
    target_workspace_id
  ) then
    raise exception
      'Only authorized campaign leadership may create Turf Action Plans.'
      using errcode = '42501';
  end if;

  if target_source_groups is null
  or jsonb_typeof(
    target_source_groups
  ) <> 'array'
  then
    raise exception
      'Provide the reviewed source assignments and selected stops for this Turf Action Plan.'
      using errcode = '22023';
  end if;

  group_count :=
    jsonb_array_length(
      target_source_groups
    );

  if group_count = 0 then
    raise exception
      'Choose at least one reviewed source stop for the Turf Action Plan.'
      using errcode = '22023';
  end if;

  if group_count > 50 then
    raise exception
      'Create no more than 50 source-assignment routes in one Turf Action Plan.'
      using errcode = '22023';
  end if;

  for group_record in
    select
      plan_group.value,
      plan_group.ordinality
    from jsonb_array_elements(
      target_source_groups
    ) with ordinality
      as plan_group(
        value,
        ordinality
      )
    order by
      plan_group.ordinality
  loop
    if jsonb_typeof(
      group_record.value
    ) <> 'object'
    then
      raise exception
        'Every Turf Action Plan group must be a valid object.'
        using errcode = '22023';
    end if;

    begin
      group_source_assignment_id :=
        (
          group_record.value ->>
            'source_assignment_id'
        )::uuid;
    exception
      when invalid_text_representation
      or null_value_not_allowed
      then
        raise exception
          'Every Turf Action Plan group needs a valid source assignment.'
          using errcode = '22023';
    end;

    if group_source_assignment_id is null then
      raise exception
        'Every Turf Action Plan group needs a valid source assignment.'
        using errcode = '22023';
    end if;

    if group_source_assignment_id =
      any(
        seen_source_assignment_ids
      )
    then
      raise exception
        'Each reviewed source assignment may appear only once in a Turf Action Plan.'
        using errcode = '22023';
    end if;

    seen_source_assignment_ids :=
      array_append(
        seen_source_assignment_ids,
        group_source_assignment_id
      );

    if not exists (
      select 1
      from public.field_assignments
        as source_assignment
      where source_assignment.id =
        group_source_assignment_id
        and source_assignment.workspace_id =
          target_workspace_id
    ) then
      raise exception
        'One or more source assignments do not belong to the active campaign workspace.'
        using errcode = '42501';
    end if;

    group_title :=
      btrim(
        coalesce(
          group_record.value ->>
            'title',
          ''
        )
      );

    if group_title = '' then
      raise exception
        'Every generated Turf Action Plan assignment needs a title.'
        using errcode = '22023';
    end if;

    if jsonb_typeof(
      coalesce(
        group_record.value ->
          'source_stop_ids',
        'null'::jsonb
      )
    ) <> 'array'
    then
      raise exception
        'Every Turf Action Plan group needs a valid stop list.'
        using errcode = '22023';
    end if;

    begin
      select
        array_agg(
          selected.value::uuid
          order by
            selected.ordinality
        )
      into
        group_source_stop_ids
      from jsonb_array_elements_text(
        group_record.value ->
          'source_stop_ids'
      ) with ordinality
        as selected(
          value,
          ordinality
        );
    exception
      when invalid_text_representation
      then
        raise exception
          'Every selected Turf Action Plan stop must have a valid identifier.'
          using errcode = '22023';
    end;

    if coalesce(
      cardinality(
        group_source_stop_ids
      ),
      0
    ) = 0
    then
      raise exception
        'Every Turf Action Plan source assignment needs at least one selected recorded stop.'
        using errcode = '22023';
    end if;

    total_requested_stops :=
      total_requested_stops +
      cardinality(
        group_source_stop_ids
      );

    if total_requested_stops > 500 then
      raise exception
        'Create no more than 500 Turf Action Plan stops at one time.'
        using errcode = '22023';
    end if;

    select
      follow_up.created_assignment_id,
      follow_up.created_route_id,
      follow_up.created_stop_count
    into
      result_record
    from public.create_field_follow_up_assignment(
      group_source_assignment_id,
      group_source_stop_ids,
      group_title,
      target_volunteer_user_id,
      target_assignment_date,
      target_meeting_location,
      target_instructions,
      target_finish_mode
    ) as follow_up;

    source_assignment_id :=
      group_source_assignment_id;

    created_assignment_id :=
      result_record
        .created_assignment_id;

    created_route_id :=
      result_record
        .created_route_id;

    created_stop_count :=
      result_record
        .created_stop_count;

    return next;
  end loop;
end;
$campaign_hq$;

revoke all
on function
  public.create_field_turf_action_plan(
    uuid,
    jsonb,
    uuid,
    date,
    text,
    text,
    text
  )
from public;

revoke all
on function
  public.create_field_turf_action_plan(
    uuid,
    jsonb,
    uuid,
    date,
    text,
    text,
    text
  )
from anon;

grant execute
on function
  public.create_field_turf_action_plan(
    uuid,
    jsonb,
    uuid,
    date,
    text,
    text,
    text
  )
to authenticated;

comment on function
  public.create_field_turf_action_plan(
    uuid,
    jsonb,
    uuid,
    date,
    text,
    text,
    text
  )
is
  'Leadership-only atomic Turf Action Plan generator. Mixed-source selections are split into one lineage-safe assignment per reviewed source assignment; pending stops are not duplicated.';

notify pgrst, 'reload schema';

commit;

select
  routine_name,
  security_type
from information_schema.routines
where routine_schema =
  'public'
  and routine_name =
    'create_field_turf_action_plan';

-- CAMPAIGN HQ — FOLLOW-UP ROUTE GENERATOR
-- Run once in the campaign Supabase SQL Editor before the app installer.
--
-- Existing completion history remains unchanged.
-- Follow-up assignments and stops receive lineage back to their reviewed source records.
-- Volunteers only see follow-up assignments assigned directly to their own account.

begin;

-- Keep the earlier completion-review ambiguity repair in migration history.
create or replace function
public.save_field_assignment_review(
  target_assignment_id uuid,
  target_action text,
  target_review_notes text default null
)
returns table (
  assignment_id uuid,
  review_status text,
  review_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $campaign_hq$
declare
  actor_user_id uuid :=
    auth.uid();

  normalized_action text :=
    lower(
      btrim(
        coalesce(
          target_action,
          ''
        )
      )
    );

  normalized_notes text :=
    nullif(
      btrim(
        coalesce(
          target_review_notes,
          ''
        )
      ),
      ''
    );

  assignment_workspace_id uuid;
  assignment_status text;
  route_stop_count integer;
  pending_stop_count integer;
begin
  if actor_user_id is null then
    raise exception
      'A signed-in Campaign HQ session is required.'
      using errcode = '42501';
  end if;

  if normalized_action not in (
    'save_note',
    'mark_reviewed',
    'reopen'
  ) then
    raise exception
      'Choose save_note, mark_reviewed or reopen.'
      using errcode = '22023';
  end if;

  if length(
    coalesce(
      target_review_notes,
      ''
    )
  ) > 5000 then
    raise exception
      'The private leadership note must be 5000 characters or fewer.'
      using errcode = '22023';
  end if;

  select
    assignment.workspace_id,
    assignment.status
  into
    assignment_workspace_id,
    assignment_status
  from public.field_assignments
    as assignment
  where assignment.id =
    target_assignment_id;

  if assignment_workspace_id is null then
    raise exception
      'The requested field assignment was not found.'
      using errcode = 'P0002';
  end if;

  if not public.is_field_leadership(
    assignment_workspace_id
  ) then
    raise exception
      'Only authorized campaign leadership may review field assignments.'
      using errcode = '42501';
  end if;

  if normalized_action =
    'mark_reviewed'
  then
    select
      count(stop.id),
      count(stop.id)
        filter (
          where stop.status =
            'pending'
        )
    into
      route_stop_count,
      pending_stop_count
    from public.field_routes
      as route
    left join public.field_stops
      as stop
      on stop.route_id =
        route.id
    where route.assignment_id =
      target_assignment_id;

    if route_stop_count = 0 then
      raise exception
        'Add at least one route stop before reviewing this assignment.'
        using errcode = '22023';
    end if;

    if pending_stop_count > 0 then
      raise exception
        'Every route stop must have a result or skipped status before review.'
        using errcode = '22023';
    end if;

    if assignment_status <>
      'completed'
    then
      raise exception
        'The Volunteer must complete the assignment before leadership can mark it reviewed.'
        using errcode = '22023';
    end if;

    insert into
      public.field_assignment_reviews (
        assignment_id,
        workspace_id,
        review_status,
        review_notes,
        reviewed_by,
        reviewed_at,
        created_at,
        updated_at
      )
    values (
      target_assignment_id,
      assignment_workspace_id,
      'reviewed',
      normalized_notes,
      actor_user_id,
      now(),
      now(),
      now()
    )
    on conflict on constraint
      field_assignment_reviews_pkey
    do update
    set
      workspace_id =
        excluded.workspace_id,
      review_status =
        'reviewed',
      review_notes =
        excluded.review_notes,
      reviewed_by =
        actor_user_id,
      reviewed_at =
        now(),
      updated_at =
        now();

  elsif normalized_action =
    'reopen'
  then
    insert into
      public.field_assignment_reviews (
        assignment_id,
        workspace_id,
        review_status,
        review_notes,
        reviewed_by,
        reviewed_at,
        created_at,
        updated_at
      )
    values (
      target_assignment_id,
      assignment_workspace_id,
      'pending',
      normalized_notes,
      null,
      null,
      now(),
      now()
    )
    on conflict on constraint
      field_assignment_reviews_pkey
    do update
    set
      workspace_id =
        excluded.workspace_id,
      review_status =
        'pending',
      review_notes =
        excluded.review_notes,
      reviewed_by =
        null,
      reviewed_at =
        null,
      updated_at =
        now();

  else
    insert into
      public.field_assignment_reviews (
        assignment_id,
        workspace_id,
        review_status,
        review_notes,
        reviewed_by,
        reviewed_at,
        created_at,
        updated_at
      )
    values (
      target_assignment_id,
      assignment_workspace_id,
      'pending',
      normalized_notes,
      null,
      null,
      now(),
      now()
    )
    on conflict on constraint
      field_assignment_reviews_pkey
    do update
    set
      workspace_id =
        excluded.workspace_id,
      review_notes =
        excluded.review_notes,
      updated_at =
        now();
  end if;

  return query
  select
    review.assignment_id,
    review.review_status,
    review.review_notes,
    review.reviewed_by,
    review.reviewed_at,
    review.updated_at
  from public.field_assignment_reviews
    as review
  where review.assignment_id =
    target_assignment_id;
end;
$campaign_hq$;

revoke all
on function
  public.save_field_assignment_review(
    uuid,
    text,
    text
  )
from public;

revoke all
on function
  public.save_field_assignment_review(
    uuid,
    text,
    text
  )
from anon;

grant execute
on function
  public.save_field_assignment_review(
    uuid,
    text,
    text
  )
to authenticated;

comment on function
  public.save_field_assignment_review(
    uuid,
    text,
    text
  )
is
  'Leadership-only completion review action with stop-completeness validation and unambiguous primary-key conflict handling.';


-- Follow-up lineage. Existing rows remain unchanged.
alter table public.field_assignments
  alter column volunteer_user_id
  drop not null;

alter table public.field_assignments
  add column if not exists source_assignment_id uuid;

alter table public.field_assignments
  drop constraint if exists field_assignments_source_assignment_id_fkey;

alter table public.field_assignments
  add constraint field_assignments_source_assignment_id_fkey
  foreign key (source_assignment_id)
  references public.field_assignments(id)
  on delete set null;

create index if not exists
  field_assignments_source_assignment_idx
on public.field_assignments (
  source_assignment_id
)
where source_assignment_id is not null;

alter table public.field_stops
  add column if not exists source_stop_id uuid;

alter table public.field_stops
  drop constraint if exists field_stops_source_stop_id_fkey;

alter table public.field_stops
  add constraint field_stops_source_stop_id_fkey
  foreign key (source_stop_id)
  references public.field_stops(id)
  on delete set null;

create unique index if not exists
  field_stops_one_follow_up_per_source_idx
on public.field_stops (
  source_stop_id
)
where source_stop_id is not null;

comment on column public.field_assignments.source_assignment_id
is
  'Reviewed source assignment used to generate this follow-up assignment.';

comment on column public.field_stops.source_stop_id
is
  'Recorded source stop used to generate this new pending follow-up stop.';

create or replace function
public.create_field_follow_up_assignment(
  target_source_assignment_id uuid,
  target_source_stop_ids uuid[],
  target_title text,
  target_volunteer_user_id uuid default null,
  target_assignment_date date default null,
  target_meeting_location text default null,
  target_instructions text default null,
  target_finish_mode text default 'final_stop'
)
returns table (
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

  source_workspace_id uuid;
  source_title text;
  source_precinct text;
  source_turf_name text;
  source_meeting_location text;
  source_status text;

  clean_title text :=
    btrim(
      coalesce(
        target_title,
        ''
      )
    );

  clean_meeting_location text :=
    nullif(
      btrim(
        coalesce(
          target_meeting_location,
          ''
        )
      ),
      ''
    );

  clean_instructions text :=
    nullif(
      btrim(
        coalesce(
          target_instructions,
          ''
        )
      ),
      ''
    );

  clean_finish_mode text :=
    lower(
      btrim(
        coalesce(
          target_finish_mode,
          'final_stop'
        )
      )
    );

  requested_stop_count integer :=
    coalesce(
      cardinality(
        target_source_stop_ids
      ),
      0
    );

  distinct_stop_count integer;
  invalid_stop_count integer;
  existing_follow_up_count integer;
  route_start_location text;

  new_assignment_id uuid;
  new_route_id uuid;
  inserted_stop_count integer;
begin
  if actor_user_id is null then
    raise exception
      'A signed-in Campaign HQ session is required.'
      using errcode = '42501';
  end if;

  if clean_title = '' then
    raise exception
      'Enter a follow-up assignment title.'
      using errcode = '22023';
  end if;

  if length(clean_title) > 160 then
    raise exception
      'The follow-up assignment title must be 160 characters or fewer.'
      using errcode = '22023';
  end if;

  if length(
    coalesce(
      target_instructions,
      ''
    )
  ) > 3000 then
    raise exception
      'Volunteer instructions must be 3000 characters or fewer.'
      using errcode = '22023';
  end if;

  if clean_finish_mode not in (
    'final_stop',
    'return_start',
    'meeting_point'
  ) then
    raise exception
      'Choose a valid route finish option.'
      using errcode = '22023';
  end if;

  if (
    clean_finish_mode =
      'meeting_point'
    and clean_meeting_location is null
  ) then
    raise exception
      'Add a meeting point before choosing Return to meeting point.'
      using errcode = '22023';
  end if;

  if requested_stop_count = 0 then
    raise exception
      'Choose at least one recorded stop for follow-up.'
      using errcode = '22023';
  end if;

  if requested_stop_count > 200 then
    raise exception
      'Create no more than 200 follow-up stops at one time.'
      using errcode = '22023';
  end if;

  select
    assignment.workspace_id,
    assignment.title,
    assignment.precinct,
    assignment.turf_name,
    assignment.meeting_location,
    assignment.status
  into
    source_workspace_id,
    source_title,
    source_precinct,
    source_turf_name,
    source_meeting_location,
    source_status
  from public.field_assignments
    as assignment
  where assignment.id =
    target_source_assignment_id;

  if source_workspace_id is null then
    raise exception
      'The reviewed source assignment was not found.'
      using errcode = 'P0002';
  end if;

  if not public.is_field_leadership(
    source_workspace_id
  ) then
    raise exception
      'Only authorized campaign leadership may create follow-up field work.'
      using errcode = '42501';
  end if;

  if source_status <> 'completed' then
    raise exception
      'The source assignment must be completed before follow-up work is created.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.field_assignment_reviews
      as review
    where review.assignment_id =
      target_source_assignment_id
      and review.review_status =
        'reviewed'
  ) then
    raise exception
      'Mark the source completion review reviewed before creating follow-up work.'
      using errcode = '22023';
  end if;

  if target_volunteer_user_id is not null
  and not exists (
    select 1
    from public.workspace_members
      as member
    where member.workspace_id =
      source_workspace_id
      and member.user_id =
        target_volunteer_user_id
      and member.status =
        'active'
      and (
        member.role_key =
          'volunteer'
        or member.seat_type =
          'volunteer'
        or member.dashboard_type =
          'volunteer'
        or member.role =
          'volunteer'
      )
  ) then
    raise exception
      'Choose an active Volunteer in this campaign or leave the follow-up unassigned.'
      using errcode = '22023';
  end if;

  select
    count(
      distinct selected.stop_id
    )
  into
    distinct_stop_count
  from unnest(
    target_source_stop_ids
  ) as selected(stop_id);

  if distinct_stop_count <>
    requested_stop_count
  then
    raise exception
      'The follow-up selection contains a duplicate source stop.'
      using errcode = '22023';
  end if;

  select
    count(*)
  into
    invalid_stop_count
  from unnest(
    target_source_stop_ids
  ) as selected(stop_id)
  left join public.field_stops
    as stop
    on stop.id =
      selected.stop_id
  left join public.field_routes
    as route
    on route.id =
      stop.route_id
    and route.assignment_id =
      target_source_assignment_id
  where route.id is null
    or stop.status =
      'pending';

  if invalid_stop_count > 0 then
    raise exception
      'Every selected source stop must belong to the reviewed assignment and have a recorded result or skipped status.'
      using errcode = '22023';
  end if;

  select
    count(*)
  into
    existing_follow_up_count
  from public.field_stops
    as follow_up_stop
  where follow_up_stop.source_stop_id =
    any(
      target_source_stop_ids
    );

  if existing_follow_up_count > 0 then
    raise exception
      'One or more selected stops already have follow-up work. Refresh and review the available stops.'
      using errcode = '23505';
  end if;

  select
    coalesce(
      nullif(
        source_stop.location_label,
        ''
      ),
      source_stop.address_line_1
    )
  into
    route_start_location
  from unnest(
    target_source_stop_ids
  ) with ordinality
    as selected(stop_id, stop_order)
  join public.field_stops
    as source_stop
    on source_stop.id =
      selected.stop_id
  order by selected.stop_order
  limit 1;

  insert into
    public.field_assignments (
      source_assignment_id,
      workspace_id,
      volunteer_user_id,
      title,
      precinct,
      turf_name,
      assignment_date,
      shift_starts_at,
      shift_ends_at,
      meeting_location,
      instructions,
      status,
      created_by,
      updated_by
    )
  values (
    target_source_assignment_id,
    source_workspace_id,
    target_volunteer_user_id,
    clean_title,
    source_precinct,
    source_turf_name,
    target_assignment_date,
    null,
    null,
    coalesce(
      clean_meeting_location,
      source_meeting_location
    ),
    coalesce(
      clean_instructions,
      'Follow-up field work generated from the reviewed "' ||
        source_title ||
        '" assignment.'
    ),
    'assigned',
    actor_user_id,
    actor_user_id
  )
  returning id
  into new_assignment_id;

  insert into
    public.field_routes (
      assignment_id,
      route_order,
      name,
      start_location,
      finish_mode,
      instructions,
      status
    )
  values (
    new_assignment_id,
    1,
    'Follow-up route 1',
    route_start_location,
    clean_finish_mode,
    'Generated from selected recorded stops in "' ||
      source_title ||
      '".',
    'ready'
  )
  returning id
  into new_route_id;

  insert into
    public.field_stops (
      source_stop_id,
      route_id,
      stop_order,
      location_label,
      address_line_1,
      address_line_2,
      city,
      state,
      postal_code,
      latitude,
      longitude,
      instructions,
      status
    )
  select
    source_stop.id,
    new_route_id,
    selected.stop_order::integer,
    source_stop.location_label,
    source_stop.address_line_1,
    source_stop.address_line_2,
    source_stop.city,
    source_stop.state,
    source_stop.postal_code,
    source_stop.latitude,
    source_stop.longitude,
    source_stop.instructions,
    'pending'
  from unnest(
    target_source_stop_ids
  ) with ordinality
    as selected(stop_id, stop_order)
  join public.field_stops
    as source_stop
    on source_stop.id =
      selected.stop_id
  order by selected.stop_order;

  get diagnostics
    inserted_stop_count =
      row_count;

  return query
  select
    new_assignment_id,
    new_route_id,
    inserted_stop_count;
end;
$campaign_hq$;

revoke all
on function
  public.create_field_follow_up_assignment(
    uuid,
    uuid[],
    text,
    uuid,
    date,
    text,
    text,
    text
  )
from public;

revoke all
on function
  public.create_field_follow_up_assignment(
    uuid,
    uuid[],
    text,
    uuid,
    date,
    text,
    text,
    text
  )
from anon;

grant execute
on function
  public.create_field_follow_up_assignment(
    uuid,
    uuid[],
    text,
    uuid,
    date,
    text,
    text,
    text
  )
to authenticated;

comment on function
  public.create_field_follow_up_assignment(
    uuid,
    uuid[],
    text,
    uuid,
    date,
    text,
    text,
    text
  )
is
  'Leadership-only atomic follow-up assignment generator that preserves source results and blocks duplicate source-stop follow-up.';


notify pgrst, 'reload schema';

commit;

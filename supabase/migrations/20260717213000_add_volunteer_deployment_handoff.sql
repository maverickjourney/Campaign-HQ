-- CAMPAIGN HQ - VOLUNTEER DEPLOYMENT HANDOFF AND ACKNOWLEDGMENT
-- Run once in the campaign Supabase SQL Editor before the app installer.
--
-- This migration adds a secure handoff history between leadership and the
-- Volunteer currently assigned to a field assignment. It does not change
-- assignment status, route status, stop results, review history or source lineage.

begin;

create table if not exists public.field_assignment_handoffs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,
  assignment_id uuid not null
    references public.field_assignments(id)
    on delete cascade,
  volunteer_user_id uuid not null
    references public.profiles(id)
    on delete restrict,
  cycle_number integer not null
    check (cycle_number > 0),
  status text not null default 'sent'
    check (
      status in (
        'sent',
        'acknowledged',
        'invalidated'
      )
    ),
  content_fingerprint text not null,
  sent_by uuid not null
    references public.profiles(id)
    on delete restrict,
  sent_at timestamptz not null default now(),
  acknowledged_by uuid
    references public.profiles(id)
    on delete set null,
  acknowledged_at timestamptz,
  invalidated_by uuid
    references public.profiles(id)
    on delete set null,
  invalidated_at timestamptz,
  invalidation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (
    assignment_id,
    cycle_number
  )
);

create unique index if not exists
  field_assignment_handoffs_one_current_idx
on public.field_assignment_handoffs (
  assignment_id
)
where invalidated_at is null;

create index if not exists
  field_assignment_handoffs_workspace_sent_idx
on public.field_assignment_handoffs (
  workspace_id,
  sent_at desc
);

create index if not exists
  field_assignment_handoffs_volunteer_sent_idx
on public.field_assignment_handoffs (
  volunteer_user_id,
  sent_at desc
);

comment on table public.field_assignment_handoffs
is
  'Immutable deployment handoff cycles. Leadership sends a Volunteer-facing brief; the assigned Volunteer may acknowledge only their own current cycle.';

alter table public.field_assignment_handoffs
  enable row level security;

revoke all
on table public.field_assignment_handoffs
from public;

revoke all
on table public.field_assignment_handoffs
from anon;

revoke all
on table public.field_assignment_handoffs
from authenticated;

grant select
on table public.field_assignment_handoffs
to authenticated;

drop policy if exists
  "Field leadership can view deployment handoffs"
on public.field_assignment_handoffs;

create policy
  "Field leadership can view deployment handoffs"
on public.field_assignment_handoffs
for select
to authenticated
using (
  public.is_field_leadership(
    workspace_id
  )
);

drop policy if exists
  "Assigned Volunteers can view their deployment handoffs"
on public.field_assignment_handoffs;

create policy
  "Assigned Volunteers can view their deployment handoffs"
on public.field_assignment_handoffs
for select
to authenticated
using (
  volunteer_user_id = auth.uid()
  and exists (
    select 1
    from public.field_assignments
      as assignment
    where assignment.id =
      field_assignment_handoffs.assignment_id
      and assignment.workspace_id =
        field_assignment_handoffs.workspace_id
      and assignment.volunteer_user_id =
        auth.uid()
      and assignment.status <>
        'cancelled'
  )
);

create or replace function
public.set_field_assignment_handoff_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $campaign_hq$
begin
  new.updated_at = now();
  return new;
end;
$campaign_hq$;

drop trigger if exists
  set_field_assignment_handoff_updated_at
on public.field_assignment_handoffs;

create trigger
  set_field_assignment_handoff_updated_at
before update
on public.field_assignment_handoffs
for each row
execute function
  public.set_field_assignment_handoff_updated_at();

create or replace function
public.field_assignment_handoff_fingerprint(
  target_assignment_id uuid
)
returns text
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $campaign_hq$
  select md5(
    jsonb_build_object(
      'assignment',
      jsonb_build_object(
        'id',
          assignment.id,
        'workspace_id',
          assignment.workspace_id,
        'volunteer_user_id',
          assignment.volunteer_user_id,
        'title',
          coalesce(
            assignment.title,
            ''
          ),
        'precinct',
          coalesce(
            assignment.precinct,
            ''
          ),
        'turf_name',
          coalesce(
            assignment.turf_name,
            ''
          ),
        'assignment_date',
          assignment.assignment_date,
        'shift_starts_at',
          assignment.shift_starts_at,
        'shift_ends_at',
          assignment.shift_ends_at,
        'meeting_location',
          coalesce(
            assignment.meeting_location,
            ''
          ),
        'instructions',
          coalesce(
            assignment.instructions,
            ''
          )
      ),
      'routes',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id',
                route.id,
              'route_order',
                route.route_order,
              'name',
                coalesce(
                  route.name,
                  ''
                ),
              'start_location',
                coalesce(
                  route.start_location,
                  ''
                ),
              'finish_mode',
                coalesce(
                  route.finish_mode,
                  ''
                ),
              'instructions',
                coalesce(
                  route.instructions,
                  ''
                ),
              'stops',
              coalesce(
                (
                  select jsonb_agg(
                    jsonb_build_object(
                      'id',
                        stop.id,
                      'stop_order',
                        stop.stop_order,
                      'location_label',
                        coalesce(
                          stop.location_label,
                          ''
                        ),
                      'address_line_1',
                        coalesce(
                          stop.address_line_1,
                          ''
                        ),
                      'address_line_2',
                        coalesce(
                          stop.address_line_2,
                          ''
                        ),
                      'city',
                        coalesce(
                          stop.city,
                          ''
                        ),
                      'state',
                        coalesce(
                          stop.state,
                          ''
                        ),
                      'postal_code',
                        coalesce(
                          stop.postal_code,
                          ''
                        ),
                      'latitude',
                        stop.latitude,
                      'longitude',
                        stop.longitude,
                      'instructions',
                        coalesce(
                          stop.instructions,
                          ''
                        )
                    )
                    order by
                      stop.stop_order,
                      stop.id
                  )
                  from public.field_stops
                    as stop
                  where stop.route_id =
                    route.id
                ),
                '[]'::jsonb
              )
            )
            order by
              route.route_order,
              route.id
          )
          from public.field_routes
            as route
          where route.assignment_id =
            assignment.id
        ),
        '[]'::jsonb
      )
    )::text
  )
  from public.field_assignments
    as assignment
  where assignment.id =
    target_assignment_id;
$campaign_hq$;

revoke all
on function
  public.field_assignment_handoff_fingerprint(uuid)
from public;

revoke all
on function
  public.field_assignment_handoff_fingerprint(uuid)
from anon;

revoke all
on function
  public.field_assignment_handoff_fingerprint(uuid)
from authenticated;

create or replace function
public.invalidate_field_assignment_handoffs(
  target_assignment_id uuid,
  target_reason text,
  target_actor_user_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $campaign_hq$
declare
  affected_count integer := 0;
begin
  update public.field_assignment_handoffs
  set
    status = 'invalidated',
    invalidated_by =
      target_actor_user_id,
    invalidated_at = now(),
    invalidation_reason =
      nullif(
        btrim(
          coalesce(
            target_reason,
            ''
          )
        ),
        ''
      )
  where assignment_id =
    target_assignment_id
    and invalidated_at is null;

  get diagnostics
    affected_count =
      row_count;

  return affected_count;
end;
$campaign_hq$;

revoke all
on function
  public.invalidate_field_assignment_handoffs(
    uuid,
    text,
    uuid
  )
from public;

revoke all
on function
  public.invalidate_field_assignment_handoffs(
    uuid,
    text,
    uuid
  )
from anon;

revoke all
on function
  public.invalidate_field_assignment_handoffs(
    uuid,
    text,
    uuid
  )
from authenticated;

create or replace function
public.invalidate_handoff_from_assignment_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $campaign_hq$
begin
  if (
    old.volunteer_user_id,
    old.title,
    old.precinct,
    old.turf_name,
    old.assignment_date,
    old.shift_starts_at,
    old.shift_ends_at,
    old.meeting_location,
    old.instructions
  ) is distinct from (
    new.volunteer_user_id,
    new.title,
    new.precinct,
    new.turf_name,
    new.assignment_date,
    new.shift_starts_at,
    new.shift_ends_at,
    new.meeting_location,
    new.instructions
  )
  then
    perform
      public.invalidate_field_assignment_handoffs(
        new.id,
        case
          when old.volunteer_user_id
            is distinct from
              new.volunteer_user_id
            then
              'The assignment was reassigned or unassigned.'
          else
              'Leadership changed the Volunteer-facing assignment brief.'
        end,
        auth.uid()
      );
  end if;

  return new;
end;
$campaign_hq$;

drop trigger if exists
  invalidate_handoff_from_assignment_change
on public.field_assignments;

create trigger
  invalidate_handoff_from_assignment_change
after update of
  volunteer_user_id,
  title,
  precinct,
  turf_name,
  assignment_date,
  shift_starts_at,
  shift_ends_at,
  meeting_location,
  instructions
on public.field_assignments
for each row
execute function
  public.invalidate_handoff_from_assignment_change();

create or replace function
public.invalidate_handoff_from_route_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $campaign_hq$
declare
  prior_assignment_id uuid;
  next_assignment_id uuid;
begin
  prior_assignment_id =
    case
      when tg_op in (
        'UPDATE',
        'DELETE'
      )
        then old.assignment_id
      else null
    end;

  next_assignment_id =
    case
      when tg_op in (
        'INSERT',
        'UPDATE'
      )
        then new.assignment_id
      else null
    end;

  if tg_op = 'UPDATE'
    and (
      old.assignment_id,
      old.route_order,
      old.name,
      old.start_location,
      old.finish_mode,
      old.instructions
    ) is not distinct from (
      new.assignment_id,
      new.route_order,
      new.name,
      new.start_location,
      new.finish_mode,
      new.instructions
    )
  then
    return new;
  end if;

  if prior_assignment_id is not null then
    perform
      public.invalidate_field_assignment_handoffs(
        prior_assignment_id,
        'Leadership changed a route in the Volunteer-facing brief.',
        auth.uid()
      );
  end if;

  if next_assignment_id is not null
    and next_assignment_id
      is distinct from
        prior_assignment_id
  then
    perform
      public.invalidate_field_assignment_handoffs(
        next_assignment_id,
        'Leadership changed a route in the Volunteer-facing brief.',
        auth.uid()
      );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$campaign_hq$;

drop trigger if exists
  invalidate_handoff_from_route_change
on public.field_routes;

create trigger
  invalidate_handoff_from_route_change
after insert or update or delete
on public.field_routes
for each row
execute function
  public.invalidate_handoff_from_route_change();

create or replace function
public.invalidate_handoff_from_stop_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $campaign_hq$
declare
  prior_route_id uuid;
  next_route_id uuid;
  prior_assignment_id uuid;
  next_assignment_id uuid;
begin
  prior_route_id =
    case
      when tg_op in (
        'UPDATE',
        'DELETE'
      )
        then old.route_id
      else null
    end;

  next_route_id =
    case
      when tg_op in (
        'INSERT',
        'UPDATE'
      )
        then new.route_id
      else null
    end;

  if tg_op = 'UPDATE'
    and (
      old.route_id,
      old.stop_order,
      old.location_label,
      old.address_line_1,
      old.address_line_2,
      old.city,
      old.state,
      old.postal_code,
      old.latitude,
      old.longitude,
      old.instructions
    ) is not distinct from (
      new.route_id,
      new.stop_order,
      new.location_label,
      new.address_line_1,
      new.address_line_2,
      new.city,
      new.state,
      new.postal_code,
      new.latitude,
      new.longitude,
      new.instructions
    )
  then
    return new;
  end if;

  if prior_route_id is not null then
    select route.assignment_id
      into prior_assignment_id
    from public.field_routes
      as route
    where route.id =
      prior_route_id;
  end if;

  if next_route_id is not null then
    select route.assignment_id
      into next_assignment_id
    from public.field_routes
      as route
    where route.id =
      next_route_id;
  end if;

  if prior_assignment_id is not null then
    perform
      public.invalidate_field_assignment_handoffs(
        prior_assignment_id,
        'Leadership changed a stop in the Volunteer-facing brief.',
        auth.uid()
      );
  end if;

  if next_assignment_id is not null
    and next_assignment_id
      is distinct from
        prior_assignment_id
  then
    perform
      public.invalidate_field_assignment_handoffs(
        next_assignment_id,
        'Leadership changed a stop in the Volunteer-facing brief.',
        auth.uid()
      );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$campaign_hq$;

drop trigger if exists
  invalidate_handoff_from_stop_change
on public.field_stops;

create trigger
  invalidate_handoff_from_stop_change
after insert or update or delete
on public.field_stops
for each row
execute function
  public.invalidate_handoff_from_stop_change();

create or replace function
public.send_field_assignment_handoff(
  target_assignment_id uuid
)
returns table (
  handoff_id uuid,
  assignment_id uuid,
  workspace_id uuid,
  volunteer_user_id uuid,
  cycle_number integer,
  handoff_status text,
  content_fingerprint text,
  sent_by uuid,
  sent_at timestamptz,
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  invalidated_at timestamptz,
  invalidation_reason text
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $campaign_hq$
declare
  actor_user_id uuid :=
    auth.uid();

  assignment_record
    public.field_assignments%rowtype;

  route_count integer;
  stop_count integer;
  empty_route_count integer;
  incomplete_address_count integer;
  invalid_finish_count integer;
  meeting_point_route_count integer;
  invalid_route_order_count integer;
  invalid_stop_order_count integer;
  next_cycle integer;
  fingerprint text;
  inserted_handoff
    public.field_assignment_handoffs%rowtype;
begin
  if actor_user_id is null then
    raise exception
      'A signed-in Campaign HQ session is required.'
      using errcode = '42501';
  end if;

  select assignment.*
    into assignment_record
  from public.field_assignments
    as assignment
  where assignment.id =
    target_assignment_id
  for update;

  if assignment_record.id is null then
    raise exception
      'The requested field assignment was not found.'
      using errcode = 'P0002';
  end if;

  if not public.is_field_leadership(
    assignment_record.workspace_id
  )
  then
    raise exception
      'Only authorized campaign leadership may send a deployment handoff.'
      using errcode = '42501';
  end if;

  if assignment_record.status in (
    'completed',
    'cancelled'
  )
  then
    raise exception
      'Completed or cancelled field work cannot request a new acknowledgment.'
      using errcode = '22023';
  end if;

  if assignment_record.volunteer_user_id is null then
    raise exception
      'Assign an active Volunteer before sending the deployment handoff.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.workspace_members
      as member
    where member.workspace_id =
      assignment_record.workspace_id
      and member.user_id =
        assignment_record.volunteer_user_id
      and member.status =
        'active'
      and (
        member.role_key =
          'volunteer'
        or member.seat_type =
          'volunteer'
        or member.dashboard_type =
          'volunteer'
      )
  )
  then
    raise exception
      'The assigned Volunteer is not an active Volunteer in this campaign workspace.'
      using errcode = '22023';
  end if;

  if assignment_record.assignment_date is null then
    raise exception
      'Set the assignment date before sending the deployment handoff.'
      using errcode = '22023';
  end if;

  if assignment_record.shift_starts_at is null then
    raise exception
      'Set the shift start time before sending the deployment handoff.'
      using errcode = '22023';
  end if;

  select
    count(*),
    count(*)
      filter (
        where not exists (
          select 1
          from public.field_stops
            as route_stop
          where route_stop.route_id =
            route.id
        )
      ),
    count(*)
      filter (
        where route.finish_mode
          not in (
            'final_stop',
            'return_start',
            'meeting_point'
          )
      ),
    count(*)
      filter (
        where route.finish_mode =
          'meeting_point'
      )
    into
      route_count,
      empty_route_count,
      invalid_finish_count,
      meeting_point_route_count
  from public.field_routes
    as route
  where route.assignment_id =
    assignment_record.id;

  if route_count = 0 then
    raise exception
      'Add at least one route before sending the deployment handoff.'
      using errcode = '22023';
  end if;

  if empty_route_count > 0 then
    raise exception
      'Every route must contain at least one stop before handoff.'
      using errcode = '22023';
  end if;

  if invalid_finish_count > 0 then
    raise exception
      'Every route must have a valid finish option before handoff.'
      using errcode = '22023';
  end if;

  if meeting_point_route_count > 0
    and nullif(
      btrim(
        coalesce(
          assignment_record.meeting_location,
          ''
        )
      ),
      ''
    ) is null
  then
    raise exception
      'Add the meeting point because a route returns there.'
      using errcode = '22023';
  end if;

  select
    count(*),
    count(*)
      filter (
        where nullif(
          btrim(
            coalesce(
              stop.address_line_1,
              ''
            )
          ),
          ''
        ) is null
        or nullif(
          btrim(
            coalesce(
              stop.city,
              ''
            )
          ),
          ''
        ) is null
        or nullif(
          btrim(
            coalesce(
              stop.state,
              ''
            )
          ),
          ''
        ) is null
        or nullif(
          btrim(
            coalesce(
              stop.postal_code,
              ''
            )
          ),
          ''
        ) is null
      )
    into
      stop_count,
      incomplete_address_count
  from public.field_routes
    as route
  join public.field_stops
    as stop
    on stop.route_id =
      route.id
  where route.assignment_id =
    assignment_record.id;

  if stop_count = 0 then
    raise exception
      'Add at least one stop before sending the deployment handoff.'
      using errcode = '22023';
  end if;

  if incomplete_address_count > 0 then
    raise exception
      'Every stop needs a complete street, city, state and ZIP address before handoff.'
      using errcode = '22023';
  end if;

  select count(*)
    into invalid_route_order_count
  from (
    select
      count(*) as route_total,
      count(distinct route.route_order)
        as distinct_total,
      min(route.route_order)
        as minimum_order,
      max(route.route_order)
        as maximum_order
    from public.field_routes
      as route
    where route.assignment_id =
      assignment_record.id
  ) as route_order
  where route_order.route_total = 0
    or route_order.distinct_total <>
      route_order.route_total
    or route_order.minimum_order <> 1
    or route_order.maximum_order <>
      route_order.route_total;

  if invalid_route_order_count > 0 then
    raise exception
      'Route numbers must be complete, unique and sequential before handoff.'
      using errcode = '22023';
  end if;

  select count(*)
    into invalid_stop_order_count
  from (
    select
      route.id,
      count(stop.id) as stop_total,
      count(
        distinct stop.stop_order
      ) as distinct_total,
      min(stop.stop_order)
        as minimum_order,
      max(stop.stop_order)
        as maximum_order
    from public.field_routes
      as route
    left join public.field_stops
      as stop
      on stop.route_id =
        route.id
    where route.assignment_id =
      assignment_record.id
    group by route.id
  ) as stop_order
  where stop_order.stop_total = 0
    or stop_order.distinct_total <>
      stop_order.stop_total
    or stop_order.minimum_order <> 1
    or stop_order.maximum_order <>
      stop_order.stop_total;

  if invalid_stop_order_count > 0 then
    raise exception
      'Every route needs a complete, unique and sequential stop order before handoff.'
      using errcode = '22023';
  end if;

  fingerprint =
    public.field_assignment_handoff_fingerprint(
      assignment_record.id
    );

  if fingerprint is null then
    raise exception
      'The Volunteer-facing deployment brief could not be prepared.'
      using errcode = 'P0002';
  end if;

  perform
    public.invalidate_field_assignment_handoffs(
      assignment_record.id,
      'Leadership sent a newer deployment handoff.',
      actor_user_id
    );

  select
    coalesce(
      max(handoff.cycle_number),
      0
    ) + 1
    into next_cycle
  from public.field_assignment_handoffs
    as handoff
  where handoff.assignment_id =
    assignment_record.id;

  insert into
    public.field_assignment_handoffs (
      workspace_id,
      assignment_id,
      volunteer_user_id,
      cycle_number,
      status,
      content_fingerprint,
      sent_by,
      sent_at
    )
  values (
    assignment_record.workspace_id,
    assignment_record.id,
    assignment_record.volunteer_user_id,
    next_cycle,
    'sent',
    fingerprint,
    actor_user_id,
    now()
  )
  returning *
    into inserted_handoff;

  return query
  select
    inserted_handoff.id,
    inserted_handoff.assignment_id,
    inserted_handoff.workspace_id,
    inserted_handoff.volunteer_user_id,
    inserted_handoff.cycle_number,
    inserted_handoff.status,
    inserted_handoff.content_fingerprint,
    inserted_handoff.sent_by,
    inserted_handoff.sent_at,
    inserted_handoff.acknowledged_by,
    inserted_handoff.acknowledged_at,
    inserted_handoff.invalidated_at,
    inserted_handoff.invalidation_reason;
end;
$campaign_hq$;

revoke all
on function
  public.send_field_assignment_handoff(uuid)
from public;

revoke all
on function
  public.send_field_assignment_handoff(uuid)
from anon;

grant execute
on function
  public.send_field_assignment_handoff(uuid)
to authenticated;

create or replace function
public.acknowledge_own_field_assignment_handoff(
  target_assignment_id uuid
)
returns table (
  handoff_id uuid,
  assignment_id uuid,
  workspace_id uuid,
  volunteer_user_id uuid,
  cycle_number integer,
  handoff_status text,
  sent_at timestamptz,
  acknowledged_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $campaign_hq$
declare
  actor_user_id uuid :=
    auth.uid();

  assignment_record
    public.field_assignments%rowtype;

  handoff_record
    public.field_assignment_handoffs%rowtype;

  current_fingerprint text;
begin
  if actor_user_id is null then
    raise exception
      'A signed-in Campaign HQ session is required.'
      using errcode = '42501';
  end if;

  select assignment.*
    into assignment_record
  from public.field_assignments
    as assignment
  where assignment.id =
    target_assignment_id
    and assignment.volunteer_user_id =
      actor_user_id
  for update;

  if assignment_record.id is null then
    raise exception
      'This field assignment is not assigned to your Volunteer account.'
      using errcode = '42501';
  end if;

  if assignment_record.status in (
    'completed',
    'cancelled'
  )
  then
    raise exception
      'This field assignment is no longer available for acknowledgment.'
      using errcode = '22023';
  end if;

  select handoff.*
    into handoff_record
  from public.field_assignment_handoffs
    as handoff
  where handoff.assignment_id =
    assignment_record.id
    and handoff.workspace_id =
      assignment_record.workspace_id
    and handoff.volunteer_user_id =
      actor_user_id
    and handoff.invalidated_at
      is null
  order by
    handoff.cycle_number desc
  limit 1
  for update;

  if handoff_record.id is null then
    raise exception
      'Leadership has not sent a current deployment handoff for this assignment.'
      using errcode = 'P0002';
  end if;

  current_fingerprint =
    public.field_assignment_handoff_fingerprint(
      assignment_record.id
    );

  if current_fingerprint is distinct from
    handoff_record.content_fingerprint
  then
    perform
      public.invalidate_field_assignment_handoffs(
        assignment_record.id,
        'The Volunteer-facing assignment changed before acknowledgment.',
        null
      );

    raise exception
      'Leadership changed this assignment. Wait for a new deployment handoff before acknowledging.'
      using errcode = '22023';
  end if;

  if handoff_record.acknowledged_at
    is null
  then
    update public.field_assignment_handoffs
    set
      status =
        'acknowledged',
      acknowledged_by =
        actor_user_id,
      acknowledged_at =
        now()
    where id =
      handoff_record.id
    returning *
      into handoff_record;
  end if;

  return query
  select
    handoff_record.id,
    handoff_record.assignment_id,
    handoff_record.workspace_id,
    handoff_record.volunteer_user_id,
    handoff_record.cycle_number,
    handoff_record.status,
    handoff_record.sent_at,
    handoff_record.acknowledged_at;
end;
$campaign_hq$;

revoke all
on function
  public.acknowledge_own_field_assignment_handoff(uuid)
from public;

revoke all
on function
  public.acknowledge_own_field_assignment_handoff(uuid)
from anon;

grant execute
on function
  public.acknowledge_own_field_assignment_handoff(uuid)
to authenticated;

create or replace function
public.reset_field_assignment_handoff(
  target_assignment_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $campaign_hq$
declare
  actor_user_id uuid :=
    auth.uid();

  assignment_workspace_id uuid;
begin
  if actor_user_id is null then
    raise exception
      'A signed-in Campaign HQ session is required.'
      using errcode = '42501';
  end if;

  select assignment.workspace_id
    into assignment_workspace_id
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
  )
  then
    raise exception
      'Only authorized campaign leadership may reset a deployment handoff.'
      using errcode = '42501';
  end if;

  return
    public.invalidate_field_assignment_handoffs(
      target_assignment_id,
      'Leadership reset the deployment handoff.',
      actor_user_id
    );
end;
$campaign_hq$;

revoke all
on function
  public.reset_field_assignment_handoff(uuid)
from public;

revoke all
on function
  public.reset_field_assignment_handoff(uuid)
from anon;

grant execute
on function
  public.reset_field_assignment_handoff(uuid)
to authenticated;

do $campaign_hq$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname =
      'supabase_realtime'
      and schemaname =
        'public'
      and tablename =
        'field_assignment_handoffs'
  )
  then
    alter publication supabase_realtime
      add table
        public.field_assignment_handoffs;
  end if;
end;
$campaign_hq$;

commit;

select
  namespace.nspname
    as table_schema,
  relation.relname
    as table_name,
  relation.relrowsecurity
    as row_security_enabled
from pg_class
  as relation
join pg_namespace
  as namespace
  on namespace.oid =
    relation.relnamespace
where namespace.nspname =
  'public'
  and relation.relname =
    'field_assignment_handoffs';

select
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'send_field_assignment_handoff',
    'acknowledge_own_field_assignment_handoff',
    'reset_field_assignment_handoff',
    'field_assignment_handoff_fingerprint'
  )
order by routine_name;

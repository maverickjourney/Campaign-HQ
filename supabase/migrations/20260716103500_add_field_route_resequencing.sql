-- CAMPAIGN HQ — ROUTE SEQUENCING FOUNDATION
-- Run once in the campaign project's Supabase SQL Editor.
-- This adds one leadership-only RPC that saves a complete route order atomically.
-- It does not expose field data to Volunteers and does not contact an external provider.

begin;

create or replace function public.reorder_field_route_stops(
  target_route_id uuid,
  ordered_stop_ids uuid[]
)
returns table (
  stop_id uuid,
  stop_order integer
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  target_workspace_id uuid;
  route_stop_count integer;
  requested_stop_count integer;
  distinct_requested_count integer;
  invalid_stop_count integer;
begin
  if auth.uid() is null then
    raise exception 'A signed-in Campaign HQ session is required.'
      using errcode = '42501';
  end if;

  select assignment.workspace_id
    into target_workspace_id
  from public.field_routes as route
  join public.field_assignments as assignment
    on assignment.id = route.assignment_id
  where route.id = target_route_id;

  if target_workspace_id is null then
    raise exception 'The requested field route was not found.'
      using errcode = 'P0002';
  end if;

  if not public.is_field_leadership(target_workspace_id) then
    raise exception 'Only authorized campaign leadership may reorder field routes.'
      using errcode = '42501';
  end if;

  requested_stop_count :=
    coalesce(cardinality(ordered_stop_ids), 0);

  if requested_stop_count = 0 then
    raise exception 'Provide the complete ordered stop list.'
      using errcode = '22023';
  end if;

  select count(*)
    into route_stop_count
  from public.field_stops
  where route_id = target_route_id;

  if route_stop_count <> requested_stop_count then
    raise exception
      'The submitted order must include every stop on the route exactly once.'
      using errcode = '22023';
  end if;

  select count(distinct stop_id)
    into distinct_requested_count
  from unnest(ordered_stop_ids) as submitted(stop_id);

  if distinct_requested_count <> requested_stop_count then
    raise exception 'The submitted route order contains a duplicate stop.'
      using errcode = '22023';
  end if;

  select count(*)
    into invalid_stop_count
  from unnest(ordered_stop_ids) as submitted(stop_id)
  left join public.field_stops as stop
    on stop.id = submitted.stop_id
   and stop.route_id = target_route_id
  where stop.id is null;

  if invalid_stop_count > 0 then
    raise exception
      'The submitted order contains a stop that is not part of this route.'
      using errcode = '22023';
  end if;

  update public.field_stops as stop
  set stop_order = -(1000000 + submitted.ordinality::integer)
  from unnest(ordered_stop_ids)
    with ordinality as submitted(stop_id, ordinality)
  where stop.id = submitted.stop_id
    and stop.route_id = target_route_id;

  update public.field_stops as stop
  set stop_order = submitted.ordinality::integer
  from unnest(ordered_stop_ids)
    with ordinality as submitted(stop_id, ordinality)
  where stop.id = submitted.stop_id
    and stop.route_id = target_route_id;

  return query
  select
    stop.id,
    stop.stop_order
  from public.field_stops as stop
  where stop.route_id = target_route_id
  order by stop.stop_order;
end;
$$;

revoke all
on function public.reorder_field_route_stops(uuid, uuid[])
from public;

revoke all
on function public.reorder_field_route_stops(uuid, uuid[])
from anon;

grant execute
on function public.reorder_field_route_stops(uuid, uuid[])
to authenticated;

comment on function public.reorder_field_route_stops(uuid, uuid[])
is
  'Leadership-only atomic resequencing of every stop on one Campaign HQ field route.';

commit;

-- CAMPAIGN HQ — ROUTE COMPLETION REVIEW
-- Run once in the campaign Supabase SQL Editor before the app installer.
--
-- Privacy model:
--   • Review records live in a separate leadership-only table.
--   • Volunteers keep access to their assignment and stop results.
--   • Volunteer queries never load review notes, reviewer identity or review timestamps.
--   • All review writes go through one leadership-only security-definer function.

begin;

create table if not exists public.field_assignment_reviews (
  assignment_id uuid primary key
    references public.field_assignments(id)
    on delete cascade,
  workspace_id uuid not null,
  review_status text not null
    default 'pending'
    check (
      review_status in (
        'pending',
        'reviewed'
      )
    ),
  review_notes text,
  reviewed_by uuid
    references public.profiles(id)
    on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null
    default now(),
  updated_at timestamptz not null
    default now()
);

alter table public.field_assignment_reviews
  enable row level security;

drop policy if exists
  "Field leadership can view assignment reviews"
on public.field_assignment_reviews;

create policy
  "Field leadership can view assignment reviews"
on public.field_assignment_reviews
for select
to authenticated
using (
  public.is_field_leadership(
    workspace_id
  )
);

revoke all
on table public.field_assignment_reviews
from public;

revoke all
on table public.field_assignment_reviews
from anon;

grant select
on table public.field_assignment_reviews
to authenticated;

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
    on conflict (
      assignment_id
    )
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
    on conflict (
      assignment_id
    )
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
    on conflict (
      assignment_id
    )
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

comment on table
  public.field_assignment_reviews
is
  'Leadership-only completion review records for field assignments.';

comment on function
  public.save_field_assignment_review(
    uuid,
    text,
    text
  )
is
  'Leadership-only completion review action with stop-completeness validation.';

notify pgrst, 'reload schema';

commit;

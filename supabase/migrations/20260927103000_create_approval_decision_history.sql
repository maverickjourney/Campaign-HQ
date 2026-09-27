-- ============================================================
-- CAMPAIGN SEAT — APPROVAL DECISION HISTORY
--
-- Preserves every approval status transition independently
-- from the current approval snapshot.
-- ============================================================

begin;

create table if not exists
public.approval_decision_history (
  id uuid
    primary key
    default gen_random_uuid(),

  workspace_id uuid
    not null
    references public.workspaces(id)
    on delete cascade,

  approval_id uuid
    not null
    references public.approvals(id)
    on delete cascade,

  from_status text,

  to_status text
    not null,

  decision_notes text,

  actor_user_id uuid,

  occurred_at timestamptz
    not null
    default now(),

  created_at timestamptz
    not null
    default now(),

  constraint
    approval_decision_history_from_status_check
    check (
      from_status is null
      or from_status in (
        'draft',
        'pending',
        'changes_requested',
        'approved',
        'rejected'
      )
    ),

  constraint
    approval_decision_history_to_status_check
    check (
      to_status in (
        'draft',
        'pending',
        'changes_requested',
        'approved',
        'rejected'
      )
    )
);

create index if not exists
approval_decision_history_workspace_approval_idx
on public.approval_decision_history (
  workspace_id,
  approval_id,
  occurred_at
);

create or replace function
private.capture_approval_decision_history()
returns trigger
language plpgsql
security definer
set search_path =
  'public',
  'private',
  'pg_temp'
as $campaign_seat$
begin

  if
    new.status
      is not distinct from
        old.status
  then
    return new;
  end if;

  insert into
  public.approval_decision_history (
    workspace_id,
    approval_id,
    from_status,
    to_status,
    decision_notes,
    actor_user_id,
    occurred_at
  )
  values (
    new.workspace_id,
    new.id,
    old.status,
    new.status,

    case
      when new.status in (
        'changes_requested',
        'approved',
        'rejected'
      )
      then nullif(
        btrim(
          coalesce(
            new.review_notes,
            ''
          )
        ),
        ''
      )
      else null
    end,

    coalesce(
      new.reviewed_by,
      auth.uid(),
      new.assigned_to,
      new.submitted_by
    ),

    coalesce(
      new.reviewed_at,
      now()
    )
  );

  return new;

end;
$campaign_seat$;

revoke all
on function
private.capture_approval_decision_history()
from
public,
anon,
authenticated;

drop trigger if exists
capture_approval_decision_history_trigger
on public.approvals;

create trigger
capture_approval_decision_history_trigger
after update of status
on public.approvals
for each row
execute function
private.capture_approval_decision_history();

-- Preserve the currently visible latest decision for approvals
-- that were reviewed before this ledger existed.
insert into
public.approval_decision_history (
  workspace_id,
  approval_id,
  from_status,
  to_status,
  decision_notes,
  actor_user_id,
  occurred_at
)
select
  approval.workspace_id,
  approval.id,
  null,
  approval.status,
  approval.review_notes,
  coalesce(
    approval.reviewed_by,
    approval.assigned_to,
    approval.submitted_by
  ),
  coalesce(
    approval.reviewed_at,
    approval.updated_at
  )
from public.approvals
  as approval
where
  approval.reviewed_at
    is not null
  and approval.status in (
    'changes_requested',
    'approved',
    'rejected'
  )
  and not exists (
    select 1
    from
    public.approval_decision_history
      as existing_history
    where
      existing_history.approval_id =
        approval.id
  );

alter table
public.approval_decision_history
enable row level security;

drop policy if exists
"Authorized reviewers can view approval decision history"
on public.approval_decision_history;

create policy
"Authorized reviewers can view approval decision history"
on public.approval_decision_history
for select
to authenticated
using (
  public.is_workspace_leadership(
    workspace_id
  )
  or public.has_campaign_permission(
    workspace_id,
    'approvals.view'
  )
  or exists (
    select 1
    from public.approvals
      as approval
    where
      approval.id =
        approval_id
      and approval.workspace_id =
        workspace_id
      and approval.assigned_to =
        auth.uid()
  )
);

revoke all
on public.approval_decision_history
from
public,
anon,
authenticated;

grant select
on public.approval_decision_history
to authenticated;

do $campaign_seat$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where
      pubname =
        'supabase_realtime'
      and schemaname =
        'public'
      and tablename =
        'approval_decision_history'
  ) then
    alter publication
      supabase_realtime
    add table
      public.approval_decision_history;
  end if;
end;
$campaign_seat$;

notify pgrst, 'reload schema';

commit;

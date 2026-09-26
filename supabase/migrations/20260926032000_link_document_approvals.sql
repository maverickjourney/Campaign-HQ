-- ============================================================
-- CAMPAIGN SEAT — DOCUMENT APPROVAL LINK
--
-- Allows an approval request to point at the campaign file
-- that initiated the review while preserving the existing
-- approvals workflow and RLS policies.
-- ============================================================

begin;

alter table public.approvals
  add column if not exists
  source_file_id uuid;

alter table public.approvals
  drop constraint if exists
  approvals_source_file_id_fkey;

alter table public.approvals
  add constraint
  approvals_source_file_id_fkey
  foreign key (
    source_file_id
  )
  references public.campaign_files(id)
  on delete set null;

create index if not exists
  approvals_workspace_source_file_idx
on public.approvals (
  workspace_id,
  source_file_id
)
where source_file_id is not null;

create or replace function
private.enforce_approval_source_file_workspace()
returns trigger
language plpgsql
security definer
set search_path to
  'public',
  'private',
  'pg_temp'
as $function$
begin

  if new.source_file_id is null then
    return new;
  end if;

  if not exists (
    select 1

    from public.campaign_files
      as campaign_file

    where campaign_file.id =
      new.source_file_id

      and campaign_file.workspace_id =
        new.workspace_id
  )
  then
    raise exception
      'The linked campaign document does not belong to this workspace.';
  end if;

  return new;

end;
$function$;

drop trigger if exists
  approvals_source_file_workspace_integrity
on public.approvals;

create trigger
  approvals_source_file_workspace_integrity
before insert or update of
  workspace_id,
  source_file_id
on public.approvals
for each row
execute function
  private.enforce_approval_source_file_workspace();

comment on column
public.approvals.source_file_id
is
  'Campaign file that initiated or supports this approval request.';

commit;

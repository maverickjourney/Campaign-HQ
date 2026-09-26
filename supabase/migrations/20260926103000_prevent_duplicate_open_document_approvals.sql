-- ============================================================
-- CAMPAIGN SEAT — ONE OPEN APPROVAL PER DOCUMENT
--
-- Existing QA duplicates are intentionally preserved.
--
-- Future inserts may not create a second open approval for
-- the same campaign file. Existing open approvals may still
-- transition between Draft, Pending review, and Changes
-- requested so old duplicate QA rows can be resolved normally.
-- ============================================================

begin;

create or replace function
private.enforce_single_open_document_approval()
returns trigger
language plpgsql
security definer
set search_path to
  'public',
  'private',
  'pg_temp'
as $function$
begin

  if
    new.source_file_id is null
    or new.status not in (
      'draft',
      'pending',
      'changes_requested'
    )
  then
    return new;
  end if;

  /*
   * Do not strand legacy duplicates.
   *
   * An already-open approval can continue moving through
   * other open workflow states. Only a new open association,
   * terminal -> open transition, or move to another file must
   * pass the duplicate check below.
   */
  if
    tg_op = 'UPDATE'
    and old.source_file_id
      is not distinct from
        new.source_file_id
    and old.status in (
      'draft',
      'pending',
      'changes_requested'
    )
    and new.status in (
      'draft',
      'pending',
      'changes_requested'
    )
  then
    return new;
  end if;

  if exists (
    select 1

    from public.approvals
      as existing_approval

    where
      existing_approval.workspace_id =
        new.workspace_id

      and
      existing_approval.source_file_id =
        new.source_file_id

      and
      existing_approval.status in (
        'draft',
        'pending',
        'changes_requested'
      )

      and
      existing_approval.id
        is distinct from
          new.id
  )
  then
    raise exception using
      errcode = '23505',
      message =
        'An open approval already exists for this document.';
  end if;

  return new;

end;
$function$;

drop trigger if exists
  approvals_single_open_document_review
on public.approvals;

create trigger
  approvals_single_open_document_review
before insert
or update of
  workspace_id,
  source_file_id,
  status
on public.approvals
for each row
execute function
  private.enforce_single_open_document_approval();

comment on function
private.enforce_single_open_document_approval()
is
  'Prevents future duplicate Draft, Pending review, or Changes requested approvals for the same campaign document while allowing legacy duplicates to resolve normally.';

commit;

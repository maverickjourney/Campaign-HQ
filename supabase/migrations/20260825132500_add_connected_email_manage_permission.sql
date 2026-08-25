begin;

-- ============================================================
-- CAMPAIGN SEAT
-- CONNECTED EMAIL — PROVIDER WRITE PERMISSION
--
-- Viewing a mailbox is intentionally separate from modifying it.
--
-- Mailbox provider mutations require:
--   leadership
--   OR communications.manage
-- ============================================================

create or replace function
public.can_manage_connected_email(
  target_workspace_id uuid
)
returns boolean
language sql
stable
security definer
set search_path =
  public,
  pg_temp
as $campaign_seat$
  select
    auth.uid() is not null
    and (
      public.is_workspace_leadership(
        target_workspace_id
      )
      or
      public.has_campaign_permission(
        target_workspace_id,
        'communications.manage'
      )
    );
$campaign_seat$;


revoke all
on function
public.can_manage_connected_email(uuid)
from
  public,
  anon;


grant execute
on function
public.can_manage_connected_email(uuid)
to authenticated;


comment on function
public.can_manage_connected_email(uuid)
is
'Returns whether the signed-in Campaign Seat user may modify the connected email provider for the workspace.';


notify pgrst, 'reload schema';

commit;

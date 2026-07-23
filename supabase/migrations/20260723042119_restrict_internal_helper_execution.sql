-- Restrict direct authenticated execution of internal
-- SECURITY DEFINER helper functions.
--
-- These helpers remain callable by their database-owned
-- SECURITY DEFINER callers and by service_role.

revoke execute on function
  public.can_add_workspace_seat(
    uuid,
    text
  )
from authenticated;

revoke execute on function
  public.member_has_campaign_permission(
    uuid,
    text,
    uuid
  )
from authenticated;

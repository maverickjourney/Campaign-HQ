-- Restrict direct authenticated execution of an internal role helper
-- and an auth-user trigger function.
--
-- current_workspace_role_key remains callable by its database-owned
-- SECURITY DEFINER callers.
--
-- handle_new_campaign_user remains bound to the auth.users trigger.
--
-- service_role access remains unchanged.

revoke execute on function
  public.current_workspace_role_key(
    uuid
  )
from authenticated;

revoke execute on function
  public.handle_new_campaign_user()
from authenticated;

-- Prevent authenticated clients from directly invoking internal
-- SECURITY DEFINER trigger functions.
--
-- Existing database triggers continue to invoke these functions.
-- service_role access is intentionally retained.

revoke execute on function
  public.capture_campaign_activity()
from authenticated;

revoke execute on function
  public.capture_contact_activity()
from authenticated;

revoke execute on function
  public.capture_team_access_activity()
from authenticated;

revoke execute on function
  public.enforce_campaign_membership_guardrails()
from authenticated;

revoke execute on function
  public.invalidate_handoff_from_assignment_change()
from authenticated;

revoke execute on function
  public.invalidate_handoff_from_route_change()
from authenticated;

revoke execute on function
  public.invalidate_handoff_from_stop_change()
from authenticated;

revoke execute on function
  public.log_campaign_audit_change()
from authenticated;

revoke execute on function
  public.log_campaign_task_activity()
from authenticated;

revoke execute on function
  public.log_campaign_task_comment_activity()
from authenticated;

revoke execute on function
  public.prepare_campaign_membership()
from authenticated;

revoke execute on function
  public.prepare_campaign_task_comment()
from authenticated;

revoke execute on function
  public.prepare_member_permission_override()
from authenticated;

revoke execute on function
  public.prepare_workspace_invitation()
from authenticated;

revoke execute on function
  public.set_campaign_updated_at()
from authenticated;

revoke execute on function
  public.set_field_assignment_handoff_updated_at()
from authenticated;

revoke execute on function
  public.set_field_assignment_updated_at()
from authenticated;

revoke execute on function
  public.set_field_record_updated_at()
from authenticated;

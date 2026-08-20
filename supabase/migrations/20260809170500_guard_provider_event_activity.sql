-- ============================================================
-- CAMPAIGN SEAT
-- PROVIDER EVENT ACTIVITY GUARD
--
-- Native Campaign Seat events still generate activity.
-- Provider-synced events do not flood the activity feed.
-- ============================================================

drop trigger if exists
  capture_events_activity
on public.events;

create trigger
  capture_events_activity
after insert or update
on public.events
for each row
when (
  new.source_provider is null
)
execute function
  public.capture_campaign_activity();

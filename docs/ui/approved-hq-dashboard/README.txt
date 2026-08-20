CAMPAIGN SEAT — APPROVED HQ DASHBOARD LOCK

This snapshot protects the approved HQ dashboard and shared campaign
workspace sidebar.

Locked interface:
- Campaign workspace switcher
- HQ navigation sidebar
- Signed-in profile area
- Today's Priorities
- Campaign Spotlight
- Spotlight shortcuts
- Ask Campaign HQ strip
- Today's Schedule
- Eastern-Time live event selection
- Lower HQ dashboard cards

Future pages and tabs should be created in their own page files.
Do not rewrite these locked files while building another tab.

Commands:

Verify the approved interface:
  bash "$HOME/Campaign-HQ/scripts/check-approved-hq-dashboard.sh"

Restore the approved interface:
  bash "$HOME/Campaign-HQ/scripts/restore-approved-hq-dashboard.sh"

Temporarily unlock the approved files:
  bash "$HOME/Campaign-HQ/scripts/unlock-approved-hq-dashboard.sh"

Re-lock the approved files:
  bash "$HOME/Campaign-HQ/scripts/relock-approved-hq-dashboard.sh"

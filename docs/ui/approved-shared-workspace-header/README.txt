CAMPAIGN SEAT — APPROVED SHARED WORKSPACE HEADER

This snapshot protects the shared header used across authenticated tabs.

Protected header content:

- Current Workspace
- Campaign name and district
- Eastern date and time
- Ask Campaign HQ
- Keyboard shortcut
- Notifications
- Header layout and responsive styling

The header is owned by CampaignWorkspaceShell.

Pages may not hide, replace or restyle the shared header with page-level
global CSS.

Verify:

  bash "$HOME/Campaign-HQ/scripts/check-approved-shared-workspace-header.sh"

Restore:

  bash "$HOME/Campaign-HQ/scripts/restore-approved-shared-workspace-header.sh"

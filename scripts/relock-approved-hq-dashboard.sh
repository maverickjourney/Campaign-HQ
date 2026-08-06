#!/bin/bash
set -euo pipefail

PROJECT="$HOME/Campaign-HQ"

FILES="
src/pages/DashboardReferencePreview/DashboardReferencePreview.jsx
src/pages/DashboardReferencePreview/DashboardReferencePreview.module.css
src/components/CampaignWorkspaceShell/CampaignWorkspaceShell.jsx
src/components/CampaignWorkspaceShell/CampaignWorkspaceShell.module.css
"

cd "$PROJECT"

bash "$PROJECT/scripts/check-approved-hq-dashboard.sh"

echo
echo "============================================================"
echo "CAMPAIGN SEAT — RE-LOCK APPROVED HQ FILES"
echo "============================================================"

for FILE in $FILES; do
  chmod u-w "$FILE"
  chflags uchg "$FILE" 2>/dev/null || true
  echo "LOCKED: $FILE"
done

echo
echo "Approved HQ files are protected again."

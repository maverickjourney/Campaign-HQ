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

echo "============================================================"
echo "CAMPAIGN SEAT — UNLOCK APPROVED HQ FILES"
echo "============================================================"

for FILE in $FILES; do
  if [ -e "$FILE" ]; then
    chflags nouchg "$FILE" 2>/dev/null || true
    chmod u+w "$FILE"
    echo "UNLOCKED: $FILE"
  fi
done

echo
echo "The approved files are temporarily writable."
echo "Re-lock them after authorized HQ work with:"
echo "  bash \"$PROJECT/scripts/relock-approved-hq-dashboard.sh\""

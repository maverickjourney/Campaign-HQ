#!/bin/bash
set -euo pipefail

PROJECT="$HOME/Campaign-HQ"
LOCK_DIR="$PROJECT/docs/ui/approved-hq-dashboard"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$HOME/Desktop/Campaign-Seat-Before-HQ-Restore-$STAMP"

FILES="
src/pages/DashboardReferencePreview/DashboardReferencePreview.jsx
src/pages/DashboardReferencePreview/DashboardReferencePreview.module.css
src/components/CampaignWorkspaceShell/CampaignWorkspaceShell.jsx
src/components/CampaignWorkspaceShell/CampaignWorkspaceShell.module.css
"

cd "$PROJECT"

echo "============================================================"
echo "CAMPAIGN SEAT — RESTORE APPROVED HQ DASHBOARD"
echo "============================================================"
echo

mkdir -p "$BACKUP"

for FILE in $FILES; do
  if [ ! -f "$LOCK_DIR/$FILE" ]; then
    echo "ERROR: Golden restore file is missing:"
    echo "  $LOCK_DIR/$FILE"
    exit 1
  fi

  if [ -e "$FILE" ]; then
    chflags nouchg "$FILE" 2>/dev/null || true
    chmod u+w "$FILE"

    mkdir -p "$BACKUP/$(dirname "$FILE")"
    cp "$FILE" "$BACKUP/$FILE"
  fi

  mkdir -p "$(dirname "$FILE")"
  cp "$LOCK_DIR/$FILE" "$FILE"

  echo "RESTORED: $FILE"
done

npm run build

bash "$PROJECT/scripts/check-approved-hq-dashboard.sh"

for FILE in $FILES; do
  chmod u-w "$FILE"
  chflags uchg "$FILE" 2>/dev/null || true
done

echo
echo "============================================================"
echo "APPROVED HQ DASHBOARD RESTORED AND RE-LOCKED"
echo "============================================================"
echo
echo "Version replaced was preserved at:"
echo "  $BACKUP"
echo
echo "Nothing was committed, pushed, merged, or deployed."

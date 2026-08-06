#!/bin/bash
set -euo pipefail

PROJECT="$HOME/Campaign-HQ"
LOCK_DIR="$PROJECT/docs/ui/approved-shared-workspace-header"

STAMP="$(date +%Y%m%d-%H%M%S)"

BACKUP="$HOME/Desktop/Campaign-Seat-Before-Header-Restore-$STAMP"

FILES=(
  "src/components/CampaignWorkspaceShell/CampaignWorkspaceShell.jsx"
  "src/components/CampaignWorkspaceShell/CampaignWorkspaceShell.module.css"
)

cd "$PROJECT"

echo "============================================================"
echo "CAMPAIGN SEAT — RESTORE SHARED WORKSPACE HEADER"
echo "============================================================"
echo

mkdir -p "$BACKUP"

for FILE in "${FILES[@]}"; do
  GOLDEN="$LOCK_DIR/$FILE"

  if [ ! -f "$GOLDEN" ]; then
    echo "ERROR: Golden shared-header file is missing:"
    echo "  $GOLDEN"
    exit 1
  fi

  if [ -e "$FILE" ]; then
    chflags nouchg "$FILE" 2>/dev/null || true
    chmod u+w "$FILE"

    mkdir -p "$BACKUP/$(dirname "$FILE")"
    cp "$FILE" "$BACKUP/$FILE"
  fi

  mkdir -p "$(dirname "$FILE")"
  cp "$GOLDEN" "$FILE"

  echo "RESTORED: $FILE"
done

npm run build

bash "$PROJECT/scripts/check-approved-shared-workspace-header.sh"

for FILE in "${FILES[@]}"; do
  chmod u-w "$FILE"
  chflags uchg "$FILE" 2>/dev/null || true
done

echo
echo "============================================================"
echo "SHARED WORKSPACE HEADER RESTORED AND LOCKED"
echo "============================================================"
echo
echo "Replaced files were preserved at:"
echo "  $BACKUP"
echo
echo "Nothing was committed, pushed, merged, or deployed."

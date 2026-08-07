#!/bin/bash
set -euo pipefail

PROJECT="$HOME/Campaign-HQ"
LOCK_DIR="$PROJECT/docs/ui/approved-calendar-workspace"
STAMP="$(date +%Y%m%d-%H%M%S)"

BACKUP="$HOME/Desktop/Campaign-Seat-Before-Calendar-Restore-$STAMP"

FILES=(
  "src/pages/Calendar/Calendar.jsx"
  "src/pages/Calendar/Calendar.module.css"
  "src/pages/Calendar/index.js"
  "src/pages/CalendarReferencePreview/CalendarReferencePreview.jsx"
  "src/pages/CalendarReferencePreview/CalendarReferencePreview.module.css"
)

cd "$PROJECT"

echo "============================================================"
echo "CAMPAIGN SEAT — RESTORE APPROVED CALENDAR"
echo "============================================================"
echo

mkdir -p "$BACKUP"

for FILE in "${FILES[@]}"; do
  GOLDEN="$LOCK_DIR/$FILE"

  if [ ! -f "$GOLDEN" ]; then
    echo "ERROR: Golden Calendar file is missing:"
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

bash "$PROJECT/scripts/check-approved-calendar-workspace.sh"

for FILE in "${FILES[@]}"; do
  chmod u-w "$FILE"
  chflags uchg "$FILE" 2>/dev/null || true
done

echo
echo "============================================================"
echo "APPROVED CALENDAR RESTORED AND RE-LOCKED"
echo "============================================================"
echo
echo "Replaced version preserved at:"
echo "  $BACKUP"
echo
echo "Nothing was committed, pushed, merged, or deployed."

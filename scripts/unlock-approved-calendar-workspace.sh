#!/bin/bash
set -euo pipefail

PROJECT="$HOME/Campaign-HQ"

FILES=(
  "src/pages/Calendar/Calendar.jsx"
  "src/pages/Calendar/Calendar.module.css"
  "src/pages/Calendar/index.js"
  "src/pages/CalendarReferencePreview/CalendarReferencePreview.jsx"
  "src/pages/CalendarReferencePreview/CalendarReferencePreview.module.css"
)

cd "$PROJECT"

echo "============================================================"
echo "CAMPAIGN SEAT — UNLOCK APPROVED CALENDAR"
echo "============================================================"
echo

for FILE in "${FILES[@]}"; do
  if [ -e "$FILE" ]; then
    chflags nouchg "$FILE" 2>/dev/null || true
    chmod u+w "$FILE"

    echo "UNLOCKED: $FILE"
  fi
done

echo
echo "Calendar files are temporarily writable."
echo
echo "Re-lock after authorized Calendar work:"
echo "  bash \"$PROJECT/scripts/relock-approved-calendar-workspace.sh\""

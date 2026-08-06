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

bash "$PROJECT/scripts/check-approved-calendar-workspace.sh"

echo
echo "============================================================"
echo "CAMPAIGN SEAT — RE-LOCK APPROVED CALENDAR"
echo "============================================================"
echo

for FILE in "${FILES[@]}"; do
  chmod u-w "$FILE"
  chflags uchg "$FILE" 2>/dev/null || true

  echo "LOCKED: $FILE"
done

echo
echo "Approved Calendar files are protected."

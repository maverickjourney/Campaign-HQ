#!/bin/bash
set -euo pipefail

PROJECT="$HOME/Campaign-HQ"
LOCK_DIR="$PROJECT/docs/ui/approved-calendar-workspace"
MANIFEST="$LOCK_DIR/SHA256SUMS.txt"

cd "$PROJECT"

echo "============================================================"
echo "CAMPAIGN SEAT — CHECK APPROVED CALENDAR WORKSPACE"
echo "============================================================"
echo

if [ ! -f "$MANIFEST" ]; then
  echo "ERROR: Approved Calendar manifest is missing:"
  echo "  $MANIFEST"
  exit 1
fi

FAILED=0

while read -r EXPECTED FILE; do
  if [ -z "${FILE:-}" ]; then
    continue
  fi

  if [ ! -f "$FILE" ]; then
    echo "ERROR: Missing approved Calendar file:"
    echo "  $FILE"
    FAILED=1
    continue
  fi

  ACTUAL="$(shasum -a 256 "$FILE" | awk '{print $1}')"

  if [ "$ACTUAL" != "$EXPECTED" ]; then
    echo "ERROR: Approved Calendar file changed:"
    echo "  $FILE"
    FAILED=1
  else
    echo "PASS: $FILE"
  fi
done < "$MANIFEST"

echo

if [ "$FAILED" -ne 0 ]; then
  echo "============================================================"
  echo "APPROVED CALENDAR DRIFT DETECTED"
  echo "============================================================"
  echo
  echo "Restore it with:"
  echo "  bash \"$PROJECT/scripts/restore-approved-calendar-workspace.sh\""
  exit 1
fi

echo "============================================================"
echo "APPROVED CALENDAR WORKSPACE IS INTACT"
echo "============================================================"

#!/bin/bash
set -euo pipefail

PROJECT="$HOME/Campaign-HQ"
LOCK_DIR="$PROJECT/docs/ui/approved-shared-workspace-header"
MANIFEST="$LOCK_DIR/SHA256SUMS.txt"

cd "$PROJECT"

echo "============================================================"
echo "CAMPAIGN SEAT — CHECK APPROVED SHARED WORKSPACE HEADER"
echo "============================================================"
echo

if [ ! -f "$MANIFEST" ]; then
  echo "ERROR: Shared-header manifest is missing:"
  echo "  $MANIFEST"
  exit 1
fi

FAILED=0

while read -r EXPECTED FILE; do
  [ -z "${FILE:-}" ] && continue

  if [ ! -f "$FILE" ]; then
    echo "ERROR: Missing approved shared-header file:"
    echo "  $FILE"
    FAILED=1
    continue
  fi

  ACTUAL="$(
    shasum -a 256 "$FILE" |
      awk '{print $1}'
  )"

  if [ "$ACTUAL" != "$EXPECTED" ]; then
    echo "ERROR: Approved shared-header file changed:"
    echo "  $FILE"
    FAILED=1
  else
    echo "PASS: $FILE"
  fi
done < "$MANIFEST"

if [ "$FAILED" -ne 0 ]; then
  exit 1
fi

bash "$PROJECT/scripts/check-shared-header-and-active-navigation.sh"

echo
echo "============================================================"
echo "APPROVED SHARED WORKSPACE HEADER IS INTACT"
echo "============================================================"

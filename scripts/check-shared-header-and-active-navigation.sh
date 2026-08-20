#!/bin/bash
set -euo pipefail

PROJECT="$HOME/Campaign-HQ"

PAGES=(
  "src/pages/InboxReferencePreview/InboxReferencePreview.jsx"
  "src/pages/CalendarReferencePreview/CalendarReferencePreview.jsx"
  "src/pages/TasksReferencePreview/TasksReferencePreview.jsx"
)

SHELL_JSX="src/components/CampaignWorkspaceShell/CampaignWorkspaceShell.jsx"
SHELL_CSS="src/components/CampaignWorkspaceShell/CampaignWorkspaceShell.module.css"

cd "$PROJECT"

echo "============================================================"
echo "CAMPAIGN SEAT — CHECK SHARED HEADER + ACTIVE NAVIGATION"
echo "============================================================"
echo

python3 - \
  "${PAGES[@]}" \
  "$SHELL_JSX" \
  "$SHELL_CSS" <<'PY'
from pathlib import Path
import re
import sys

pages = [
    Path(value)
    for value in sys.argv[1:4]
]

shell_jsx = Path(sys.argv[4]).read_text()
shell_css = Path(sys.argv[5]).read_text()


def opening_tag(source: str):
    start = source.find("<CampaignWorkspaceShell")

    if start < 0:
        raise RuntimeError(
            "CampaignWorkspaceShell is missing."
        )

    quote = None
    braces = 0
    index = start

    while index < len(source):
        char = source[index]

        if quote:
            if char == "\\":
                index += 2
                continue

            if char == quote:
                quote = None
        else:
            if char in {'"', "'"}:
                quote = char
            elif char == "{":
                braces += 1
            elif char == "}":
                braces = max(0, braces - 1)
            elif char == ">" and braces == 0:
                return source[start:index + 1]

        index += 1

    raise RuntimeError(
        "CampaignWorkspaceShell opening tag is incomplete."
    )


for path in pages:
    tag = opening_tag(
        path.read_text(),
    )

    for prop_name in (
        "workspaceEyebrow",
        "workspaceTitle",
    ):
        if re.search(
            rf"\b{prop_name}\s*=",
            tag,
        ):
            raise RuntimeError(
                f"{path} overrides the shared header: {prop_name}"
            )

    print(f"PASS: {path}")

for required in (
    "const isActive",
    "activeNavigation",
):
    if required not in shell_jsx:
        raise RuntimeError(
            f"Shell active logic is missing: {required}"
        )

for required in (
    "SHARED ACTIVE NAVIGATION LOCK — START",
    ".sidebarNavigation > button.activeNavigation",
):
    if required not in shell_css:
        raise RuntimeError(
            f"Shared active CSS is missing: {required}"
        )

print("PASS: All checked pages inherit the shared header.")
print("PASS: Existing isActive logic remains intact.")
print("PASS: activeNavigation owns the shared blue state.")
PY

echo
echo "============================================================"
echo "SHARED HEADER + ACTIVE NAVIGATION IS INTACT"
echo "============================================================"

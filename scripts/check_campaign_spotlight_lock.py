#!/usr/bin/env python3

from pathlib import Path
import hashlib
import re
import sys

project = Path.cwd()

jsx_path = (
    project
    / "src/pages/DashboardReferencePreview/"
      "DashboardReferencePreview.jsx"
)

css_path = (
    project
    / "src/pages/DashboardReferencePreview/"
      "DashboardReferencePreview.module.css"
)

lock_path = (
    project
    / "docs/ui/CampaignSpotlight.approved.sha256"
)


def extract_element(
    source: str,
    class_name: str,
) -> str:
    opening = re.search(
        r"<([A-Za-z][A-Za-z0-9.]*)\b"
        r"(?=[^>]*styles\."
        + re.escape(class_name)
        + r"\b)[^>]*>",
        source,
        flags=re.DOTALL,
    )

    if not opening:
        raise RuntimeError(
            f"Could not locate styles.{class_name}."
        )

    tag = opening.group(1)

    pattern = re.compile(
        rf"</?{re.escape(tag)}\b[^>]*>",
        flags=re.DOTALL,
    )

    depth = 0

    for match in pattern.finditer(
        source,
        opening.start(),
    ):
        token = match.group(0)

        if token.startswith("</"):
            depth -= 1

            if depth == 0:
                return source[
                    opening.start():
                    match.end()
                ].strip()

        elif not token.rstrip().endswith("/>"):
            depth += 1

    raise RuntimeError(
        "Could not close the Spotlight JSX element."
    )


def extract_css_block(source: str) -> str:
    start = "/* SPOTLIGHT WRAPPER FLOW FIX — START */"
    end = "/* SPOTLIGHT WRAPPER FLOW FIX — END */"

    pattern = re.compile(
        re.escape(start)
        + r".*?"
        + re.escape(end),
        flags=re.DOTALL,
    )

    matches = list(pattern.finditer(source))

    if len(matches) != 1:
        raise RuntimeError(
            "Approved Spotlight CSS block is missing "
            "or duplicated."
        )

    return matches[0].group(0).strip()


def digest(value: str) -> str:
    return hashlib.sha256(
        value.encode("utf-8")
    ).hexdigest()


jsx_source = jsx_path.read_text()
css_source = css_path.read_text()

hero_jsx = extract_element(
    jsx_source,
    "heroCard",
)

hero_css = extract_css_block(
    css_source,
)

required = [
    "styles.heroShortcutArea",
    "styles.heroActions",
    "styles.editShortcutsButton",
    "styles.heroPortrait",
]

for marker in required:
    if marker not in hero_jsx:
        raise RuntimeError(
            f"Spotlight is missing {marker}."
        )

current = {
    "jsx": digest(hero_jsx),
    "css": digest(hero_css),
}

if "--write" in sys.argv:
    lock_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    lock_path.write_text(
        f"jsx {current['jsx']}\n"
        f"css {current['css']}\n"
    )

    print(
        "PASS: Current approved Spotlight was locked."
    )

    sys.exit(0)

if not lock_path.exists():
    raise RuntimeError(
        f"Spotlight lock is missing:\n  {lock_path}"
    )

locked = {}

for line in lock_path.read_text().splitlines():
    parts = line.split()

    if len(parts) == 2:
        locked[parts[0]] = parts[1]

failed = False

for key in ("jsx", "css"):
    if locked.get(key) != current[key]:
        print(
            f"ERROR: Spotlight {key.upper()} drift detected.",
            file=sys.stderr,
        )

        failed = True

if failed:
    sys.exit(1)

print(
    "PASS: Campaign Spotlight matches the approved design."
)

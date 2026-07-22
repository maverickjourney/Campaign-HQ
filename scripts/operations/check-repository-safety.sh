#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(
  git rev-parse --show-toplevel
)"

cd "$PROJECT_ROOT"

echo "Checking for tracked sensitive files..."

SENSITIVE_FILE_FOUND=0

while IFS= read -r TRACKED_FILE
do
  case "$TRACKED_FILE" in
    .env|.env.*)
      case "$TRACKED_FILE" in
        .env.example|.env.sample|*.example|*.sample)
          ;;
        *)
          echo "FAIL: Sensitive environment file is tracked:"
          echo "$TRACKED_FILE"
          SENSITIVE_FILE_FOUND=1
          ;;
      esac
      ;;

    *.pem|*.p12|*.pfx|id_rsa|id_ed25519)
      echo "FAIL: Private credential file is tracked:"
      echo "$TRACKED_FILE"
      SENSITIVE_FILE_FOUND=1
      ;;

    *service-account*.json|*service_account*.json)
      echo "FAIL: Possible service-account file is tracked:"
      echo "$TRACKED_FILE"
      SENSITIVE_FILE_FOUND=1
      ;;

    *.tar.gz.enc|*.enc.sha256)
      echo "FAIL: An encrypted operational backup is tracked:"
      echo "$TRACKED_FILE"
      SENSITIVE_FILE_FOUND=1
      ;;
  esac
done < <(
  git ls-files
)

if [ "$SENSITIVE_FILE_FOUND" -ne 0 ]; then
  exit 1
fi

echo "No prohibited sensitive files are tracked."

echo
echo "Scanning tracked text files for recognizable secret values..."

python3 <<'PYTHON'
import re
import subprocess
from pathlib import Path

project_root = Path(
    subprocess.check_output(
        ["git", "rev-parse", "--show-toplevel"],
        text=True,
    ).strip()
)

tracked_files = subprocess.check_output(
    ["git", "ls-files", "-z"],
    cwd=project_root,
).split(b"\0")

patterns = {
    "GitHub personal access token": re.compile(
        rb"\b(?:ghp_|github_pat_)[A-Za-z0-9_-]{20,}"
    ),
    "Supabase secret key": re.compile(
        rb"\bsb_secret_[A-Za-z0-9_-]{12,}"
    ),
    "Resend API key": re.compile(
        rb"\bre_[A-Za-z0-9_-]{20,}"
    ),
    "Stripe live secret key": re.compile(
        rb"\bsk_live_[A-Za-z0-9]{16,}"
    ),
    "AWS access key": re.compile(
        rb"\bAKIA[A-Z0-9]{16}\b"
    ),
    "JWT-like credential": re.compile(
        rb"\beyJ[A-Za-z0-9_-]{20,}"
        rb"\.[A-Za-z0-9_-]{10,}"
        rb"\.[A-Za-z0-9_-]{10,}"
    ),
    "Private-key material": re.compile(
        rb"BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY"
    ),
    "Credential-bearing database URL": re.compile(
        rb"postgres(?:ql)?://"
        rb"[^:\s/]+:[^@\s/]+@",
        re.IGNORECASE,
    ),
}

problems = []

for raw_path in tracked_files:
    if not raw_path:
        continue

    relative_path = raw_path.decode(
        "utf-8",
        errors="replace",
    )

    path = project_root / relative_path

    if not path.is_file():
        continue

    try:
        size = path.stat().st_size
    except OSError:
        continue

    if size > 5_000_000:
        continue

    try:
        data = path.read_bytes()
    except OSError:
        continue

    if b"\x00" in data:
        continue

    for label, pattern in patterns.items():
        if pattern.search(data):
            problems.append(
                f"{label}: {relative_path}"
            )

if problems:
    print("FAIL: Recognizable secret-like values were detected.")

    for problem in problems:
        print(f"- {problem}")

    raise SystemExit(1)

print("No recognizable secret values were detected.")
PYTHON

echo
echo "Repository safety check passed."

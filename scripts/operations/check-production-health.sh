#!/usr/bin/env bash

set -euo pipefail

BASE_URL="https://campaignseat.com"
WWW_URL="https://www.campaignseat.com"
EXPECTED_TURNSTILE_SITE_KEY="0x4AAAAAAD6pPy1gtFSgA01u"

TEMP_DIR="$(
  mktemp -d \
    "${TMPDIR:-/tmp}/campaign-seat-health-XXXXXX"
)"

cleanup_health_check() {
  rm -rf "$TEMP_DIR" 2>/dev/null || true
}

trap cleanup_health_check EXIT INT TERM

CURL_OPTIONS=(
  --silent
  --show-error
  --location
  --retry 3
  --retry-delay 2
  --retry-all-errors
  --connect-timeout 15
  --max-time 60
  --user-agent "CampaignSeat-Production-Health/1.0"
)

PASS_COUNT=0
WARNING_COUNT=0

pass() {
  printf 'PASS: %s\n' "$1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

warn() {
  printf 'WARNING: %s\n' "$1"
  WARNING_COUNT=$((WARNING_COUNT + 1))
}

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

check_route() {
  local label="$1"
  local url="$2"

  local result
  local status_code
  local final_url
  local ssl_result

  if ! result="$(
    curl \
      "${CURL_OPTIONS[@]}" \
      --output /dev/null \
      --write-out '%{http_code}|%{url_effective}|%{ssl_verify_result}' \
      "$url"
  )"; then
    fail "$label could not be reached: $url"
  fi

  IFS='|' read -r \
    status_code \
    final_url \
    ssl_result \
    <<< "$result"

  if [ "$status_code" != "200" ]; then
    fail "$label returned HTTP $status_code: $final_url"
  fi

  case "$final_url" in
    https://*)
      ;;
    *)
      fail "$label did not finish on HTTPS: $final_url"
      ;;
  esac

  if [ "$ssl_result" != "0" ]; then
    fail "$label failed TLS certificate validation."
  fi

  pass "$label returned HTTP 200 over verified HTTPS"
}

echo "============================================================"
echo "CAMPAIGN SEAT PRODUCTION HEALTH CHECK"
echo "============================================================"
echo "Checked UTC: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
echo

check_route \
  "Production homepage" \
  "$BASE_URL/"

check_route \
  "Password-reset route" \
  "$BASE_URL/forgot-password"

check_route \
  "WWW domain" \
  "$WWW_URL/"

echo
echo "Checking production security headers..."

if ! curl \
  "${CURL_OPTIONS[@]}" \
  --head \
  "$BASE_URL/" \
  > "$TEMP_DIR/headers.txt"
then
  fail "Production response headers could not be retrieved."
fi

if grep -Eiq \
  '^strict-transport-security:' \
  "$TEMP_DIR/headers.txt"
then
  pass "Strict-Transport-Security header is present"
else
  fail "Strict-Transport-Security header is missing"
fi

if grep -Eiq \
  '^content-type:[[:space:]]*text/html' \
  "$TEMP_DIR/headers.txt"
then
  pass "Homepage returns HTML content"
else
  warn "Homepage Content-Type was not recognized as text/html"
fi

echo
echo "Downloading the deployed application shell..."

CACHE_BUSTER="$(date +%s)"

if ! curl \
  "${CURL_OPTIONS[@]}" \
  "$BASE_URL/?healthcheck=$CACHE_BUSTER" \
  > "$TEMP_DIR/index.html"
then
  fail "Production application shell could not be downloaded."
fi

if grep -Fqi \
  'Campaign HQ' \
  "$TEMP_DIR/index.html"
then
  pass "Campaign HQ application shell was detected"
else
  fail "Campaign HQ application marker was not detected"
fi

JS_URL="$(
  python3 - \
    "$TEMP_DIR/index.html" \
    "$BASE_URL/" <<'PYTHON'
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin


class ScriptParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.sources = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() != "script":
            return

        attributes = dict(attrs)
        source = attributes.get("src")

        if source:
            self.sources.append(source)


html_path = Path(sys.argv[1])
base_url = sys.argv[2]

parser = ScriptParser()
parser.feed(
    html_path.read_text(
        encoding="utf-8",
        errors="replace",
    )
)

javascript_sources = [
    source
    for source in parser.sources
    if ".js" in source
]

if not javascript_sources:
    raise SystemExit(
        "No deployed JavaScript bundle was found."
    )

print(
    urljoin(
        base_url,
        javascript_sources[0],
    )
)
PYTHON
)"

if [ -z "$JS_URL" ]; then
  fail "Could not determine the deployed JavaScript bundle URL."
fi

if ! curl \
  "${CURL_OPTIONS[@]}" \
  "$JS_URL" \
  > "$TEMP_DIR/application.js"
then
  fail "Deployed JavaScript bundle could not be downloaded."
fi

if [ ! -s "$TEMP_DIR/application.js" ]; then
  fail "The deployed JavaScript bundle was empty."
fi

pass "Deployed JavaScript bundle was downloaded"

echo
echo "Checking deployed Turnstile integration..."

if grep -Fq \
  'challenges.cloudflare.com/turnstile/v0/api.js' \
  "$TEMP_DIR/application.js"
then
  pass "Cloudflare Turnstile loader is deployed"
else
  fail "Cloudflare Turnstile loader was not detected"
fi

if grep -Fq \
  "$EXPECTED_TURNSTILE_SITE_KEY" \
  "$TEMP_DIR/application.js"
then
  pass "Expected public Turnstile site key is deployed"
else
  fail "Expected public Turnstile site key was not detected"
fi

for ACTION_NAME in \
  campaign_signin \
  password_reset \
  invite_signup \
  invite_signin
do
  if grep -Fq \
    "$ACTION_NAME" \
    "$TEMP_DIR/application.js"
  then
    pass "Turnstile action deployed: $ACTION_NAME"
  else
    fail "Turnstile action missing: $ACTION_NAME"
  fi
done

echo
echo "============================================================"
echo "PRODUCTION HEALTH CHECK PASSED"
echo "============================================================"
echo "Passed checks: $PASS_COUNT"
echo "Warnings: $WARNING_COUNT"
echo "Production modified: NO"

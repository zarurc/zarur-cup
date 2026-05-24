#!/usr/bin/env bash
# Heartbeat smoke test (FND-05).
# Usage:
#   bash scripts/verify-heartbeat.sh                # tests local http://localhost:3000
#   bash scripts/verify-heartbeat.sh https://...    # tests a deployed URL
#
# If CRON_SECRET is exported in the calling shell, it is attached as a Bearer token.
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
URL="$BASE_URL/api/heartbeat"

echo "Pinging $URL ..."

if [[ -n "${CRON_SECRET:-}" ]]; then
  echo "(Sending Authorization: Bearer \$CRON_SECRET)"
  body=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    "$URL")
else
  body=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$URL")
fi

http_code=$(echo "$body" | grep -E '^HTTP_CODE:' | cut -d: -f2)
json=$(echo "$body" | grep -v '^HTTP_CODE:')

if [[ "$http_code" != "200" ]]; then
  echo "FAIL: heartbeat returned $http_code"
  echo "Body: $json"
  exit 1
fi

if ! echo "$json" | grep -q '"ok":true'; then
  echo "FAIL: response did not contain \"ok\":true"
  echo "Body: $json"
  exit 1
fi

if ! echo "$json" | grep -q '"pinged_at"'; then
  echo "FAIL: response did not contain pinged_at"
  echo "Body: $json"
  exit 1
fi

echo "PASS: heartbeat OK"
echo "Body: $json"
echo ""
echo "NEXT STEP: Verify the ping reached the DB (not just the function)."
echo "Open Supabase Dashboard -> Project -> Logs -> Postgres Logs"
echo "Filter for the last 5 minutes; search for 'select id'"
echo "You should see a SELECT statement against the fixtures table."

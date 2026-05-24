#!/usr/bin/env bash
# VIS-06 verification: unauthenticated curl against EVERY Phase-1 table must
# return [] (empty array). Proves RLS + zero-anon-GRANT contract is intact
# from the moment the schema is deployed.
#
# Run from project root:   bash scripts/verify-rls-no-leak.sh
# Or via npm:              npm run verify:rls

set -euo pipefail

# Load .env.local (publishable key is fine here; this is exactly what a leaked
# anon key in the wild would look like -- proving it leaks nothing is the point)
if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

: "${NEXT_PUBLIC_SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL must be set}"
: "${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:?NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set}"

# Private tables (own-row-only OR lock-and-reveal): anon MUST see [].
PRIVATE_TABLES=(predictions bracket_picks prop_answers profiles)

# Public-read tables (USING (true) for `to authenticated`): anon still gets []
# because the `to authenticated` policy never applies to anon, AND because anon
# has zero table-level GRANTs (per 0003_grants.sql anon-zero-DML invariant).
PUBLIC_READ_TABLES=(tournament teams fixtures bracket_slots prop_questions)

FAIL=0

check_table() {
  local label="$1"
  local t="$2"
  local body
  body=$(curl -s -X GET \
    "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/$t?select=*&limit=1" \
    -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
    -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
  if [[ "$body" == "[]" ]]; then
    echo "PASS $label: $t (anon read returns [])"
  else
    echo "FAIL $label: $t returned: $body"
    FAIL=1
  fi
}

echo "=== Phase 1 RLS leak check against $NEXT_PUBLIC_SUPABASE_URL ==="
echo ""
echo "--- Private (own-row / lock-and-reveal) tables ---"
for t in "${PRIVATE_TABLES[@]}"; do
  check_table "         " "$t"
done

echo ""
echo "--- Public-read (auth-gated) tables ---"
for t in "${PUBLIC_READ_TABLES[@]}"; do
  check_table "(auth-gated)" "$t"
done

echo ""
if [[ $FAIL -eq 1 ]]; then
  echo "FAIL: RLS leak detected. Check supabase/migrations/0002_rls.sql and 0003_grants.sql."
  exit 1
fi

echo "ALL RLS CHECKS PASSED (VIS-06)"

# Phase 2 — User Setup

This file is the SINGLE source-of-truth for everything a human (zekez) must do that Claude cannot.

## New env vars (Local + Vercel + GitHub Actions)

| Variable | Local (.env.local) | Vercel (Production env) | GitHub Actions Secret |
|----------|--------------------|--------------------------|------------------------|
| `DATABASE_URL` | Postgres pooled connection string from Supabase Settings → Database → Connection string (with password) | Same | Required — CI e2e job uses it for `db:test-seed` / `db:test-clean` |
| `PLAYWRIGHT_INVITE_CODE` | Same value as `INVITE_CODE` from Phase 1 | NOT needed in Vercel runtime | Required — CI smoke can't run without it |
| `PLAYWRIGHT_ADMIN_NAME` | Same value as `ADMIN_DISPLAY_NAME` from Phase 1 | NOT needed in Vercel runtime | Required for CI smoke |
| `PLAYWRIGHT_TEST_USER` | Default `SmokeUser` (any value that is NOT equal to `ADMIN_DISPLAY_NAME`) | Not needed | Optional — defaults to `SmokeUser` |
| `PLAYWRIGHT_BASE_URL` | Default `http://localhost:3000` (omit to use default) | Not needed | Optional — defaults to localhost (CI smoke runs against `next start` locally on the runner) |

All Phase 1 vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `INVITE_CODE`, `ADMIN_DISPLAY_NAME`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`) are still needed.

## GitHub Actions Secret setup (one-time)

1. Repo Settings → Secrets and variables → Actions → New repository secret.
2. Add each of the new secrets above (`DATABASE_URL`, `PLAYWRIGHT_INVITE_CODE`, `PLAYWRIGHT_ADMIN_NAME`).
3. Verify the existing Phase 1 secrets (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`) are present.

If any secret is missing on a CI run, the e2e job's `secret_check` step output is `have_secrets=false` and every subsequent step `if:`-skips. The job exits green (lint stays the blocking gate) but the smoke does NOT run — you'll see this in the workflow summary.

## Local Playwright workflow

The smoke runs against `next build` + `next start` (NOT `next dev`) — Phase 1 P05 contract. Expect the first run to be slow (~90–120s) because of the build step.

```bash
# 0. One-time setup — install Playwright browser binaries on this machine
#    (the npm package is installed by `npm ci`; the BROWSER binaries are not).
#    On macOS:
npx playwright install chromium
#    If `playwright install` fails behind a corp proxy: download the chromium
#    bundle from a non-corp network (e.g., a phone hotspot) and rerun.

# 1. One-time per QA cycle: mint admin storageState (if supabase-js admin.createSession
#    is available on the installed version). The smoke skips the admin half
#    gracefully if this file is absent.
node scripts/db-mint-admin-session.cjs

# 2. Seed test fixtures (idempotent — `where not exists` + the refresh UPDATEs)
npm run db:test-seed

# 3. Run smoke (90s window — start within ~60s of seeding; playwright.config
#    webServer does `npm run build && npm run start`).
npm run test:e2e

# 4. Cleanup auto-runs via globalTeardown; if it failed, run manually:
npm run db:test-clean
```

If the admin storageState wasn't minted, the smoke skips the admin half — verify QA-01 manually for that half:
1. In your real browser, visit `/admin/matches?mode=entry` as admin.
2. Enter result `2:1` for the SMOKE_PRE_LOCK fixture (BRA vs ARG, external_match_no=9001).
3. Load `/en/leaderboard` and confirm `SmokeUser` row total ≥ 4 (the exact +4 from scoreMatch).

If a SmokeUser profile / auth.users row was created and not cleaned, the cleanup SQL from Plan 02-08 Task 3:

```sql
DELETE FROM score_events WHERE user_id IN (SELECT user_id FROM profiles WHERE display_name LIKE 'SmokeUser%');
DELETE FROM predictions WHERE user_id IN (SELECT user_id FROM profiles WHERE display_name LIKE 'SmokeUser%');
DELETE FROM prop_answers WHERE user_id IN (SELECT user_id FROM profiles WHERE display_name LIKE 'SmokeUser%');
DELETE FROM profiles WHERE display_name LIKE 'SmokeUser%';
-- Then via Supabase admin API or dashboard: delete the auth.users row for SmokeUser.
```

## Production safety: /api/test/save-prediction is gated

The test-only route `src/app/api/test/save-prediction/route.ts` is hard-gated:
- In production (`NODE_ENV === 'production'`) it returns HTTP 403 UNLESS `PLAYWRIGHT_INVITE_CODE` is also set.
- Vercel production env MUST NOT set `PLAYWRIGHT_INVITE_CODE` (it's a CI-only secret).
- Verify after every deploy: `curl https://zarur-cup.vercel.app/api/test/save-prediction` MUST return `403` with body `{"ok":false,"error":"unauthenticated"}`.

## Family invite distribution (QA-04)

Once the four ship gates close (see 02-LAUNCH-CHECKLIST.md):
- Family WhatsApp message format:
  > Predict the WC: https://zarur-cup.vercel.app — invite code: `{INVITE_CODE}`
- Send by **June 11, 2026, before 19:00 UTC** kickoff (binary ship gate per D-32).

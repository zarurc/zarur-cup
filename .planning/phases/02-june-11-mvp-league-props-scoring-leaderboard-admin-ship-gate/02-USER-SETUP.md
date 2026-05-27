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
- Verify after every deploy: `curl -X POST -i https://zarur-cup.vercel.app/api/test/save-prediction` MUST return `HTTP/2 403` with body `{"ok":false,"error":"unauthenticated"}`. (Plain `curl` defaults to GET — the route is POST-only and would return 405; `-X POST` is required to actually exercise the production gate.)

## Family invite distribution (QA-04)

Once the four ship gates close (see 02-LAUNCH-CHECKLIST.md):
- Family WhatsApp message format:
  > Predict the WC: https://zarur-cup.vercel.app — invite code: `{INVITE_CODE}`
- Send by **June 11, 2026, before 19:00 UTC** kickoff (binary ship gate per D-32).

## Plan 02-12: auto-fetch match scores (D-45 + D-46)

These steps must be completed BEFORE `supabase db push` applies migration 0012, and BEFORE deploying the `/api/score-fetch` route to Vercel. Skipping any step results in 401s, missing data, or cron failures.

### 1. football-data.org account + token

1.1. Visit https://www.football-data.org/client/register and register a free account (email + name; no payment).
1.2. Confirm email; log in; navigate to dashboard.
1.3. Copy the API token (32-char string) from the dashboard.
1.4. Verify free-tier coverage with:
     ```
     curl -H "X-Auth-Token: <token>" https://api.football-data.org/v4/competitions/?plan=TIER_ONE | jq '.competitions[] | select(.code == "WC") | {code, name, area}'
     ```
     Expected output: a JSON object with `"code": "WC"` and `"name": "FIFA World Cup"`. If `code` is not `WC`, override via the `competitionCode` param in `src/lib/score-fetch/footballData.ts`.

### 2. SCORE_FETCH_SECRET generation

2.1. Generate a 32+ char random secret:
     ```
     openssl rand -hex 32
     ```
2.2. Save the value — required in both Vercel env and Supabase GUC.

### 3. Vercel env vars

3.1. Vercel dashboard → zarur-cup project → Settings → Environment Variables.
3.2. Add `FOOTBALL_DATA_TOKEN` (Production + Preview scopes) — value from step 1.3.
3.3. Add `SCORE_FETCH_SECRET` (Production + Preview scopes) — value from step 2.1.
3.4. Redeploy production (or trigger a new commit that pushes to main) so the env vars are loaded.

### 4. Supabase GUC for pg_cron

4.1. Supabase Dashboard → SQL Editor → New Query.
4.2. Run:
     ```sql
     ALTER DATABASE postgres SET app.score_fetch_secret TO '<value from step 2.1>';
     ```
     (The exact same SCORE_FETCH_SECRET value. pg_cron's `current_setting('app.score_fetch_secret', true)` reads from here when constructing the Bearer header.)
4.3. Verify:
     ```sql
     SELECT current_setting('app.score_fetch_secret', true);
     ```
     Should return the value.

### 5. Push migrations

5.1. Run `npm run db:push` — applies 0012, 0013 (Plan 02-10), 0014 in sequence.
5.2. Each migration's DO-block smoke validates its own invariants; if any raise, fix the migration body before retrying.

### 6. Verify pg_cron schedule

6.1. Supabase Dashboard → Database → Cron.
6.2. Confirm `zarur-score-fetch` job appears with schedule `*/15 * * * *`.
6.3. (Optional) Manually trigger the cron by clicking the job's "Run now" button (or via SQL: `SELECT cron.schedule(...)` repeats; or wait 15 min).
6.4. Tail Vercel function logs for `/api/score-fetch` — expect a 200 response and log lines `score-fetch ok` (or `outside-tournament-window` pre-June 11).

### 7. End-to-end smoke

7.1. Pre-June 11: cron polls return `{ok:true, skipped:'outside-tournament-window'}` — verify in Vercel function logs.
7.2. Post-June 11: cron polls fetch real scores; the integrity widget on `/admin/*` shows `Unscored Completed Matches` decreasing as each match finishes.
7.3. If admin enters a manual result via `/admin/matches`, the next cron tick MUST NOT overwrite it — verify by checking the fixture row's `auto_fetched_at` column is NULL after admin save.

### 8. Failure recovery

If the cron stops working:
- Check `cron.job_run_details` for failure rows.
- Check Vercel function logs for 401s (Bearer mismatch) or 5xx (route error).
- Re-run step 4.2 if the GUC was lost in a DB restore.
- As a last resort, admin enters every remaining match score manually at `/admin/matches` — same path that's the canonical fallback.

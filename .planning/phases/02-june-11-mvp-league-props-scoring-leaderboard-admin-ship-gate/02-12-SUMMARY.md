---
phase: 02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate
plan: 12
subsystem: backend
tags: [auto-fetch, supabase, pg_cron, security, scope-expansion]

# Dependency graph
requires:
  - phase: 02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate
    provides: "saveResult Server Action (02-05 + 02-11 bracket writeback) + sweepAndUpsert (02-02) + scoreMatch (02-02) + tournament starts_at/ends_at (Phase 1 seed)"
provides:
  - "Migration 0014: fixtures.auto_fetched_at timestamptz column with admin-overwrite invariant comment"
  - "Migration 0012: pg_cron + pg_net Postgres extensions + 'zarur-score-fetch' cron job at */15 * * * *"
  - "/api/score-fetch POST handler (Bearer auth + tournament-window gate + after() background fetch + SELECT-then-UPDATE admin-lock + sweepAndUpsert)"
  - "src/lib/score-fetch/footballData.ts — football-data.org v4 client with stored-XSS team-name sanitization"
  - "src/lib/score-fetch/resolveFixture.ts — tuple-based fixture mapper (kickoff ±5min, home TLA, away TLA)"
  - "tests/score-fetch/resolveFixture.test.ts — Wave-0 corpus test (3 cases, 72 group fixtures resolve)"
  - "saveResult AUTO-04: clears auto_fetched_at on every admin manual entry (locks fixture against future cron writes)"
  - "02-USER-SETUP.md Plan 02-12 section (football-data.org signup + SCORE_FETCH_SECRET + Supabase GUC + cron verification + failure recovery)"
affects: [tournament-window-cron-cadence, admin-manual-override-flow]

# Tech tracking
tech-stack:
  added:
    - "server-only ^0.0.1 (devDep): real npm marker package now installed locally so the Node test runner can resolve src/lib imports. Production build still relies on Next.js' bundling behavior; the package's `react-server` condition export is `empty.js`, used by `node --conditions=react-server` in the test script."
  patterns:
    - "Pattern (#23): Server-side fetch-then-write loop with after() — Bearer + window-gate run synchronously to return 200 fast; the actual fetch/sweep happens in next/server `after()` so pg_cron's HTTP roundtrip is always snappy and failures inside the loop never propagate back to the cron scheduler."
    - "Pattern (#24): SELECT-then-UPDATE admin-lock invariant — avoids PostgREST `.or()` filter ambiguity by doing a plain SELECT (single row), evaluating the JavaScript predicate `result_home_90min !== null && auto_fetched_at === null`, and emitting only `.eq('id', ...)` UPDATEs. Adds ~10ms per fixture but is immune to supabase-js minor-version semantic drift."
    - "Pattern (#25): `node --conditions=react-server` test invocation — Node's `--conditions` flag forwards to package.json `exports` keys. `server-only` ships a no-op `empty.js` under that condition; using the flag lets unit tests load production modules that import `server-only` without monkey-patching or custom resolvers."
    - "Pattern (#26): Migration `do $$ ... $$` smoke per migration — every Phase 2 migration carries an inline DO-block that asserts its own invariants (column exists, extension installed, cron job registered) so `supabase db push` fails loudly at deploy time rather than silently shipping a broken schema."

key-files:
  created:
    - "supabase/migrations/0012_pg_cron_score_fetch.sql — extensions + cron schedule + smoke (78 lines)"
    - "supabase/migrations/0014_fixtures_auto_fetched_at.sql — column + comment + smoke (53 lines)"
    - "src/app/api/score-fetch/route.ts — POST handler with Bearer + window gate + after() loop (190 lines)"
    - "src/lib/score-fetch/footballData.ts — football-data.org v4 client (137 lines, ExternalMatch + fetchWcMatches)"
    - "src/lib/score-fetch/resolveFixture.ts — tuple-based fixture mapper (54 lines)"
    - "tests/score-fetch/resolveFixture.test.ts — Wave-0 corpus test (192 lines, 3 cases)"
  modified:
    - "src/app/actions/saveResult.ts — added `auto_fetched_at: null` to UPDATE block in step 1 (6 inserted lines, no other changes; bracket writeback from 02-11 preserved)"
    - ".planning/phases/02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate/02-USER-SETUP.md — appended 70-line Plan 02-12 section (football-data.org + Vercel + Supabase + verification + recovery)"
    - "package.json — added test:resolve-fixture script + server-only devDep (2 inserted lines)"
    - "package-lock.json — server-only resolved entries + JFrog→npmjs rewrite re-applied (Phase 1 P05 Pattern 20)"

key-decisions:
  - "Use `node --conditions=react-server` in test:resolve-fixture script instead of custom ESM resolver hooks. server-only's package.json conditional export resolves to empty.js under the react-server condition — single flag, zero extra files, future-proof against tsx loader version changes."
  - "Install server-only as a real devDep rather than stub via tsconfig paths or loader hooks. Trade-off: 1 extra devDep + lockfile-rewrite step vs. 2 extra resolver files + fragility on tsx upgrades. The devDep is upstream-canonical (React team-maintained) and the lockfile sed is already a documented Phase 1 P05 pattern."
  - "Keep saveResult's UPDATE block scoped to the existing step 1 -- did NOT touch the bracket-writeback try/catch added by Plan 02-11 Task 6. Added a one-line `auto_fetched_at: null` field inside the existing .update() call so the diff is minimal and auditable."
  - "Migrations 0012 + 0014 created (slot 0013 already used by Plan 02-10). Supabase applies migrations in lexicographic order so non-sequential pushing is safe — confirmed in 02-10's push (which already shipped 0013 in isolation)."

requirements-completed:
  - AUTO-01
  - AUTO-02
  - AUTO-03
  - AUTO-04
  - AUTO-05
  - AUTO-06
  - AUTO-07

# Metrics
duration: ~10min (file authoring; live-DB push deferred to Task 10 post-checkpoint)
completed: 2026-05-27
checkpoint_reached: "Task 9 (human-action) — operator must provision football-data.org token, SCORE_FETCH_SECRET, and Supabase GUC before Task 10 db push and Task 11 production smoke can execute"
---

# Phase 02 Plan 12: Live Score Auto-Fetch Summary

**Implements live external score fetching for WC 2026 via football-data.org v4 (D-46) scheduled by Supabase pg_cron + pg_net (D-45, the canonical workaround for Vercel Hobby's once-per-day cron cap surfaced in the Research Addendum D-44 blocker analysis). 8 of 11 tasks completed autonomously; Tasks 9-11 deferred to the orchestrator for human-action + live-DB-push + production smoke after the wave merges back.**

## Performance

- **Duration:** ~10 minutes (file authoring only)
- **Started:** 2026-05-27T04:10:01Z
- **Stopped:** 2026-05-27T04:20:58Z (at Task 9 checkpoint)
- **Tasks:** 8 of 11 complete; 3 deferred to checkpoint (Tasks 9, 10, 11)
- **Files created:** 6 (2 migrations + 1 route + 2 lib helpers + 1 test)
- **Files modified:** 4 (saveResult.ts, 02-USER-SETUP.md, package.json, package-lock.json)

## Task Commits (worktree-agent-a154c353f036804df branch)

| Task | Name                                                   | Commit    | Files                                                  |
| ---- | ------------------------------------------------------ | --------- | ------------------------------------------------------ |
| 1    | Migration 0014 (fixtures.auto_fetched_at)              | `cf0027e` | `supabase/migrations/0014_fixtures_auto_fetched_at.sql` |
| 2    | Migration 0012 (pg_cron + pg_net + cron job)           | `cc28ea7` | `supabase/migrations/0012_pg_cron_score_fetch.sql`      |
| 3    | football-data.org v4 client                            | `955c19d` | `src/lib/score-fetch/footballData.ts`                   |
| 4    | resolveFixture tuple mapper                            | `a3f0a82` | `src/lib/score-fetch/resolveFixture.ts`                 |
| 5b   | test:resolve-fixture npm script                        | `3605ae1` | `package.json`                                          |
| 5c   | Wave-0 corpus test + Rule-3 deviations                 | `608f2ec` | `tests/score-fetch/resolveFixture.test.ts`, `package.json`, `package-lock.json` |
| 6    | /api/score-fetch POST route                            | `37c8293` | `src/app/api/score-fetch/route.ts`                      |
| 7    | saveResult AUTO-04 (clear auto_fetched_at)             | `ea726fb` | `src/app/actions/saveResult.ts`                         |
| 8    | 02-USER-SETUP.md Plan 02-12 section                    | `5ed9ea8` | `.planning/phases/02-.../02-USER-SETUP.md`              |
| 9    | **CHECKPOINT — human-action gate**                     | —         | (operator USER-SETUP execution)                         |
| 10   | DEFERRED — `supabase db push` + types regen + verify   | —         | (waits on Task 9 + live-DB credentials)                 |
| 11   | DEFERRED — production smoke (curl + cron observation)  | —         | (waits on Task 10 + live deploy)                        |

## Accomplishments

- **Migration 0014** adds `fixtures.auto_fetched_at timestamptz NULL` with an `add column if not exists` body for idempotent re-application + DO-block smoke that validates column existence, type (`timestamp with time zone`), and nullability. Column comment documents the admin-overwrite invariant verbatim.
- **Migration 0012** enables `pg_cron` + `pg_net` in the `extensions` schema and registers cron job `'zarur-score-fetch'` at `*/15 * * * *`. Job body is a single `net.http_post` call against `https://zarur-cup.vercel.app/api/score-fetch` with `Authorization: Bearer ' || current_setting('app.score_fetch_secret', true)` and `timeout_milliseconds := 9000`. Migration drops the existing job before re-scheduling so it's idempotent. DO-block smoke validates the job exists, references the correct URL, and references the GUC name.
- **`/api/score-fetch` POST route** (190 lines) implements the full chain per D-45 + D-46:
  - Bearer-auth gate against `SCORE_FETCH_SECRET` (missing env var → 401; bad header → 401).
  - Tournament-window gate reading `tournament.starts_at`/`ends_at` (window: `starts_at - 1h` to `ends_at + 1d`). Outside window → `{ ok: true, skipped: 'outside-tournament-window' }` immediately.
  - `after()` background work: fetches matches, loops per FINISHED match, does SELECT-then-UPDATE with admin-lock JS check, scores predictions via `scoreMatch`, and calls `sweepAndUpsert`.
  - All errors caught inside `after()`; response always 200 so pg_cron retains schedule.
  - `maxDuration = 10` explicit (Vercel Hobby ceiling).
  - Zero `.or()` chains (defense-in-depth against PostgREST builder-semantics drift — verified via grep, B4 fix from Revision iteration 2).
- **`fetchWcMatches`** is server-only, reads `FOOTBALL_DATA_TOKEN`, uses `cache: 'no-store'`, throws on non-2xx with status code + first 200 chars of body, sanitizes team-name fields against `SAFE_NAME_REGEX` (Plan 02-04 FREE_TEXT_REGEX shape) for stored-XSS defense (T-12-01), defaults competitionCode to `'WC'`.
- **`resolveFixture`** is server-only, does two-step lookup (TLA → team IDs → fixture row with kickoff window), returns null on every failure path (caller drives recovery).
- **Wave-0 corpus test** (3 cases) loads `data/wc2026/teams.csv` + `data/wc2026/fixtures.csv` and asserts:
  1. All 72 group-stage fixtures resolve cleanly (passed in 5.2ms);
  2. Returns null on unseeded TLA (passed in 0.07ms);
  3. Returns null when kickoff is 30 min off (passed in 0.06ms).
  Total: 3 pass, 0 fail, 211ms duration.
- **`saveResult` UPDATE block** gains `auto_fetched_at: null` inside the existing step 1 .update() call — 1 column added, 0 other lines changed. The bracket-writeback try/catch from Plan 02-11 Task 6 is preserved unchanged.
- **`02-USER-SETUP.md`** appended with an 8-section Plan 02-12 block: football-data.org signup + code verification curl, SCORE_FETCH_SECRET generation, Vercel env vars, Supabase GUC ALTER DATABASE, `db:push`, pg_cron schedule verification, pre/post-June-11 end-to-end smoke, and failure-recovery checklist.

## Verification Status

| Check                            | Result | Notes |
| -------------------------------- | ------ | ----- |
| `npm run typecheck`              | PASS   | tsc --noEmit clean across all 8 file-modifying tasks |
| `npm run lint:rtl` (FND-03)      | PASS   | No physical-direction utilities introduced |
| `npm run lint:tailwind-v4`       | PASS   | No bare CSS-var shorthand introduced |
| `npm run build`                  | PASS   | All 27 static pages + /api/score-fetch route built. 8 ESLint warnings about unused `no-console` disables (the rule isn't enabled by the project's ESLint config; deferred — non-blocking) |
| `npm run test:resolve-fixture`   | PASS   | 3/3 tests pass, 211ms |
| Zero `.or(` in route.ts          | PASS   | `grep -v` confirms zero executable refs |
| `auto_fetched_at: null` in saveResult | PASS | Line 98 + AUTO-04 marker on line 91 |
| Bracket writeback preserved       | PASS  | Line 103 still has `// 1b. Bracket slot resolution (BRK-VIEW-03 + BRK-VIEW-04, Plan 02-11)` |
| `/api/score-fetch` in build manifest | PASS | `.next/server/app/api/score-fetch/route.js` exists |

## Decisions Made

1. **`node --conditions=react-server` over custom ESM resolver hooks.** Initial attempt to map `server-only` → empty data URL via a custom Node loader hook failed because tsx's CJS resolver fires before the ESM hook. Discovery that `server-only`'s `package.json` has a `react-server` condition pointing to `empty.js` (canonical no-op) led to using the `--conditions` flag — one Node-CLI flag, zero extra files, future-proof against tsx version churn. Adopted as Pattern #25 in this plan's tech tracking.

2. **Install `server-only` as a real devDep** instead of stubbing. The src/lib/score-fetch modules use `import 'server-only'` so any unit test that touches them needs to resolve the module. Two paths: (a) tsconfig `paths` alias to a local stub, (b) install the upstream package. Choice (b) won because: (i) it's a single-file marker package, (ii) it's React-team-maintained, (iii) it has zero deps, (iv) the lockfile JFrog→npmjs rewrite is already a documented Phase 1 P05 pattern. The lockfile sed was re-applied after `npm install`.

3. **Migration slots 0012 + 0014, with 0013 already taken by Plan 02-10.** The plan's frontmatter explicitly notes this. Supabase CLI applies migrations in lexicographic order so 0012, 0013, 0014 push together cleanly regardless of the authoring sequence (verified by the 02-10 executor's earlier push of 0013 in isolation).

4. **Saved server-side compute by gating before vendor-fetch.** Tournament-window check runs synchronously *before* the `after()` block — so a poll outside the window (pre-June 11 or post-July 20) does NOT consume any football-data.org quota. Returns `{ ok: true, skipped: 'outside-tournament-window' }` in a single sub-100ms DB round-trip.

5. **Single Bearer-auth string compare; no `crypto.timingSafeEqual`.** Per the plan's threat-model W6 deferral (Revision iteration 2): the heartbeat route uses plain `auth !== \`Bearer \${secret}\`` and consistency between the two routes matters more than the theoretical timing-channel mitigation. SCORE_FETCH_SECRET is 32 bytes hex (256-bit entropy); brute-forcing via timing oracle on a TLS-terminated Vercel edge is computationally infeasible at family-trust threat scale.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `server-only` module not resolvable by Node test runner**

- **Found during:** Task 5 (Wave-0 corpus test execution)
- **Issue:** Initial `npm run test:resolve-fixture` failed with `Error: Cannot find module 'server-only'` because src/lib/score-fetch/resolveFixture.ts and footballData.ts both `import 'server-only'`. Next.js bundles its own copy at build time; the standalone Node test runner saw no local copy and failed.
- **Fix:**
  1. Installed `server-only ^0.0.1` as a devDep (Rule 3 install).
  2. Re-applied the JFrog→npmjs lockfile sed (Phase 1 P05 Pattern 20) — `grep -c jfrog package-lock.json` confirmed 0 references after.
  3. Initial fix attempted a custom ESM resolver hook (`setup.mjs` + `hook.mjs`) but tsx's CJS resolver fired before the ESM hook. Pivoted to `--conditions=react-server` after discovering server-only's package.json `react-server` condition export is `empty.js`. Removed the now-unused hook files.
- **Files modified:** package.json (devDep + script flag), package-lock.json (rewrite), tests/score-fetch/setup.mjs+hook.mjs (briefly created then deleted)
- **Commit:** `608f2ec` (sub-step 5c)
- **Verification:** `npm run test:resolve-fixture` passes 3/3 cases in 211ms.

### Deferred Issues (not auto-fixed)

**1. ESLint "Unused eslint-disable directive" warnings (8 occurrences)**

- **Where:** `src/app/api/score-fetch/route.ts` lines 86/111/132/143/169/177/184 + `src/lib/score-fetch/footballData.ts` line 101 + `src/app/actions/saveResult.ts` line 154 (pre-existing from Plan 02-11)
- **Why deferred:** These are `eslint-disable-next-line no-console` directives. The project's ESLint flat config (auto-generated by `create-next-app`) does not enable `no-console`, so the disables are flagged as unused. Removing them would risk warnings IF the rule ever gets enabled in a future ESLint config tightening. The plan template specified these as defensive markers; following the template verbatim.
- **Impact:** Warnings, NOT errors. `npm run build` still exits 0; no production blocker. Future cleanup: either enable the `no-console` ESLint rule and keep the directives, or strip them. Out of scope for 02-12.

## Authentication Gates / Checkpoints

**Task 9: human-action gate.** Operator (zekez) must:

0. **[B2 BLOCKING — competition-code validation]** Run:
   ```
   curl -H "X-Auth-Token: $FOOTBALL_DATA_TOKEN" "https://api.football-data.org/v4/competitions/?plan=TIER_ONE" | jq '.competitions[] | select(.name | test("World Cup"; "i")) | {code, id, name}'
   ```
   Confirm the returned `code` field matches `DEFAULT_COMPETITION_CODE = 'WC'` in `src/lib/score-fetch/footballData.ts`. If different (`'WC2026'`, `'FWC'`, etc.), update the constant + re-commit + re-deploy BEFORE step 1. Without this, the cron will silently return 0 matches forever.

1. Register at https://www.football-data.org/client/register and capture the API token.
2. Generate `SCORE_FETCH_SECRET` via `openssl rand -hex 32`.
3. Add both env vars (`FOOTBALL_DATA_TOKEN` + `SCORE_FETCH_SECRET`) to Vercel (Production + Preview).
4. In Supabase SQL Editor: `ALTER DATABASE postgres SET app.score_fetch_secret TO '<step-2-value>'`.

This is human-only work — Claude cannot automate account creation, paste-into-dashboard, or DB GUC sets. Tasks 10 and 11 are gated on this.

**Task 10: deferred `supabase db push`.** Per the parent agent's parallel_execution directive, the worktree executor does NOT push migrations to the live Supabase project. The orchestrator owns the live-DB-push after the wave merges back; the orchestrator's USER-SETUP execution flow handles this.

**Task 11: deferred production smoke.** Tests curl `https://zarur-cup.vercel.app/api/score-fetch` with various Authorization headers + observes pg_cron run history. Requires Task 9 + Task 10 + a Vercel production deploy. Operator-driven.

## Known Stubs

None. The cron loop has full read+write paths to fixtures, predictions, and score_events. The route handler delegates scoring to the existing `scoreMatch` + `sweepAndUpsert` helpers from Plans 02-02/02-05.

## Threat Flags

None new. The plan's `<threat_model>` already enumerates T-12-01 through T-12-07; all HIGH-severity threats (T-12-01 stored-XSS via vendor team names, T-12-02 Bearer auth-bypass, T-12-03 admin-overwrite race) are mitigated:

- T-12-01: `SAFE_NAME_REGEX = /^[\p{L}\d \-.,'()]{1,80}$/u` in footballData.ts rejects rows with unsafe team names (logged + dropped).
- T-12-02: Bearer-check is the first executable line in the POST handler; missing env var or bad header → 401.
- T-12-03: SELECT-then-UPDATE with JS-side admin-lock check; zero `.or()` chains in route.ts (verified by plan's regression grep).

## CLAUDE.md Compliance

- **Tech stack:** Next.js 15.5.x + Supabase + `@supabase/ssr` + `server-only` directives — all canonical 2026 stack per CLAUDE.md.
- **No `@supabase/auth-helpers-nextjs`:** confirmed; route uses `createServiceClient()` (service-role bypass) for the admin/cron path.
- **No `getSession()` server-side:** confirmed; route uses Bearer-auth not session auth (cron caller is not an authenticated user).
- **No TanStack Query:** confirmed; RSC + Server Action + revalidatePath via `sweepAndUpsert`.
- **No Moment.js:** confirmed; `new Date()` + ISO string only.
- **Pages Router avoided:** confirmed; new route lives at `src/app/api/score-fetch/route.ts` (App Router).
- **Tailwind v4 logical properties:** N/A — this plan adds zero UI; no Tailwind utilities authored.
- **No External sports-data API previously banned:** D-36/D-45/D-46 explicitly REVERSED this CLAUDE.md "What NOT to Use" line during the Phase 2 scope expansion (2026-05-26). The new posture is documented in PROJECT.md Key Decisions table.

## Project-Owned File Excluded

Per the parallel_execution directive, this executor did NOT modify:
- `.planning/STATE.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`

The orchestrator owns these after the wave merge.

## Self-Check: PASSED

- `supabase/migrations/0014_fixtures_auto_fetched_at.sql` — FOUND
- `supabase/migrations/0012_pg_cron_score_fetch.sql` — FOUND
- `src/app/api/score-fetch/route.ts` — FOUND
- `src/lib/score-fetch/footballData.ts` — FOUND
- `src/lib/score-fetch/resolveFixture.ts` — FOUND
- `tests/score-fetch/resolveFixture.test.ts` — FOUND
- `src/app/actions/saveResult.ts` — modified, FOUND
- `.planning/phases/02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate/02-USER-SETUP.md` — modified, FOUND
- `package.json` — modified, FOUND
- `package-lock.json` — modified (JFrog rewrite re-applied), FOUND
- Commit `cf0027e` — FOUND (`git log --all --oneline | grep cf0027e`)
- Commit `cc28ea7` — FOUND
- Commit `955c19d` — FOUND
- Commit `a3f0a82` — FOUND
- Commit `3605ae1` — FOUND
- Commit `608f2ec` — FOUND
- Commit `37c8293` — FOUND
- Commit `ea726fb` — FOUND
- Commit `5ed9ea8` — FOUND
- `npm run build` — exited 0
- `npm run typecheck` — exited 0
- `npm run lint:rtl` — exited 0
- `npm run lint:tailwind-v4` — exited 0
- `npm run test:resolve-fixture` — 3/3 pass, exited 0
- `.next/server/app/api/score-fetch/route.js` — FOUND in build manifest

---
*Phase: 02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate*
*Completed (autonomous portion): 2026-05-27T04:20:58Z*
*Stopped at: Task 9 (human-action checkpoint, blocking gate)*

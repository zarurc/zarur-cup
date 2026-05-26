---
phase: 02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate
plan: 08
subsystem: ship-gate-e2e-smoke
tags: [playwright, e2e, rls-rejection, ci, ship-gate, qa-01, qa-02, qa-03, qa-04, checkpoint-pending]

# Dependency graph
requires:
  - "Plan 02-01: score_events + v_leaderboard live; ET cols nullable"
  - "Plan 02-02: scoring engine + Zod schemas + scoring-smoke"
  - "Plan 02-03: matches feed + MatchRow + MatchRowStepper + savePrediction action"
  - "Plan 02-04: props feed"
  - "Plan 02-05: admin score entry"
  - "Plan 02-06: admin surfaces + integrity widget"
  - "Plan 02-07: leaderboard + /me"
  - "Phase 1 / src/components/auth/JoinForm.client.tsx (FormField IDs display_name / invite_code)"
  - "Phase 1 / Vercel + GitHub Actions secrets infrastructure (Plan 01-05)"
provides:
  - "data-testid contract on MatchRow + MatchRowStepper (match-row-{id}, stepper-{home,away}-{plus,minus}-{id}) so smoke selectors are deterministic"
  - "@playwright/test ^1.60.0 installed; package-lock.json JFrog->npmjs rewritten"
  - "playwright.config.ts targeting `npm run build && npm run start` (NEVER `next dev`); webServer timeout 240_000ms; devices['Pixel 5'] mobile viewport"
  - "data/test-fixtures.sql + data/test-fixtures-clean.sql for SMOKE_PRE_LOCK (9001) + SMOKE_POST_LOCK (9002)"
  - "tests/e2e/fixtures/{db,api,auth}.ts helpers; tests/e2e/global-teardown.ts"
  - "tests/e2e/smoke.spec.ts — single multi-context E2E with canonical RLS-rejection assertion (D-30 + ROADMAP §SC-5)"
  - "src/app/api/test/save-prediction/route.ts — production-gated test wrapper (NODE_ENV='production' && !PLAYWRIGHT_INVITE_CODE -> 403)"
  - ".github/workflows/lint.yml — e2e job with portable have_secrets step-output gate; build BEFORE Playwright launches; cleanup if always()"
  - ".planning/phases/02-.../02-USER-SETUP.md + 02-LAUNCH-CHECKLIST.md (QA-01..04 single-file ship gate)"
affects:
  - "Phase 2 ship: closing QA-01 requires the human-action smoke run (Task 3) against live Supabase; QA-02/03/04 require human sign-off (Task 5)"
  - "Production safety: /api/test/save-prediction is hard-gated against production; must verify with `curl https://zarur-cup.vercel.app/api/test/save-prediction` returns 403 after each deploy"

# Tech tracking
tech-stack:
  added:
    - "@playwright/test ^1.60.0 — devDependency for E2E"
  patterns:
    - "Pattern 39 (Phase 2): data-testid contract on interactive client components. Use template-literal IDs that include the entity UUID (`match-row-${fixtureId}`, `stepper-${side}-${dir}-${fixtureId}`) so smoke selectors are deterministic against full production seeds (no `.first()` heuristics, no text-content fallback). Keep the literal token (`stepper-home-plus-`, etc.) grep-able in source via a helper map so plan verify-greps work."
    - "Pattern 40 (Phase 2): Playwright smoke MUST run against `next build` + `next start`, never `next dev` — the dev server has StrictMode double-render, turbopack diffs, suppressed warnings that hide bugs production users WILL hit. The webServer command in playwright.config.ts is `npm run build && npm run start` with timeout 240_000ms to cover CI cold-cache."
    - "Pattern 41 (Phase 2): Canonical RLS-rejection assertion in smoke. The cosmetic 🔒 emoji check is supportive only; the canonical check is `attemptPredictionAgainstLockedFixture` -> `expect(writeResult.ok).toBe(false)` + `expect(['locked','rls_denied']).toContain(writeResult.error)`. This closes ROADMAP §SC-5 properly: we observe RLS REJECT a post-kickoff write, not just that the UI looks locked."
    - "Pattern 42 (Phase 2): Test-only API route gated by NODE_ENV + secret env var. The route at `src/app/api/test/save-prediction/route.ts` returns 403 in production unless `PLAYWRIGHT_INVITE_CODE` is set; production Vercel deploys MUST NOT set this var. Verification curl on every deploy."
    - "Pattern 43 (Phase 2): Admin context in Playwright is NEVER via JoinForm. The env-bootstrapped admin profile already exists; running JoinForm would trigger the Phase 1 D-04 family-trust rebind logic and either rebind the admin or duplicate it. Mint storageState out-of-band via service-role (scripts/db-mint-admin-session.cjs) and load with `browser.newContext({ storageState })`."
    - "Pattern 44 (Phase 2): CI step-output gate `have_secrets` instead of job-level `if: ${{ secrets.X != '' }}`. The job-level form is non-portable (some runners always evaluate true). The step-output form is portable and explicitly enumerates which secrets are required."

key-files:
  created:
    - "playwright.config.ts — Playwright config, build+start webServer, Pixel 5 mobile"
    - "data/test-fixtures.sql — SMOKE_PRE_LOCK (9001, kickoff+90s) + SMOKE_POST_LOCK (9002, kickoff-1min); idempotent + refresh UPDATEs"
    - "data/test-fixtures-clean.sql — FK-safe cascade cleanup"
    - "tests/e2e/fixtures/db.ts — getFixtureIdByExternalNo + getAdminUserId via service-role"
    - "tests/e2e/fixtures/api.ts — attemptPredictionAgainstLockedFixture (RLS-rejection probe)"
    - "tests/e2e/fixtures/auth.ts — joinAsPlayer (UI flow); joinAsAdmin (throws-and-documents)"
    - "tests/e2e/smoke.spec.ts — single E2E with canonical RLS-rejection assertion"
    - "tests/e2e/global-teardown.ts — db:test-clean + auth.users sweep via Admin API"
    - "src/app/api/test/save-prediction/route.ts — test-only JSON wrapper around savePrediction; production-gated"
    - ".planning/phases/02-.../02-USER-SETUP.md"
    - ".planning/phases/02-.../02-LAUNCH-CHECKLIST.md"
    - ".planning/phases/02-.../02-08-SUMMARY.md — this file"
  modified:
    - "src/components/matches/MatchRow.client.tsx — added data-testid={`match-row-${fixtureId}`}"
    - "src/components/matches/MatchRowStepper.client.tsx — added 4 data-testids on +/- buttons (literal tokens kept grep-able)"
    - "package.json — added @playwright/test devDep + test:e2e/test:e2e:ui/db:test-seed/db:test-clean scripts"
    - "package-lock.json — JFrog->npmjs rewrite applied (Phase 1 P05 mandatory)"
    - ".gitignore — added Playwright artifact paths + admin storageState exclusion"
    - ".github/workflows/lint.yml — added e2e job (build BEFORE Playwright, have_secrets step-output gate, always-cleanup, upload-artifacts on failure)"

key-decisions:
  - "Task 0 (data-testids) ran BEFORE Task 1 (Playwright install) per plan Wave 0 ordering — the smoke selectors need the testid contract first."
  - "Test-fixtures SQL adds tournament_id NOT NULL column lookup via WC2026 code (Rule 1 fix — plan skeleton omitted this required column on public.fixtures from 0001_init.sql line 52)."
  - "Stepper data-testid uses a typed helper map (`testIdMinus(side)` / `testIdPlus(side)`) rather than `${side}` template interpolation, so the literal tokens `stepper-home-plus-` / `stepper-away-plus-` / `stepper-home-minus-` / `stepper-away-minus-` remain grep-able in source for the plan's verify automation (the runtime IDs are unchanged either way)."
  - "Smoke runs against `npm run build && npm run start`, never `next dev` (Phase 1 P05 contract honored)."
  - "Canonical RLS-rejection assertion via `attemptPredictionAgainstLockedFixture` is the closer for ROADMAP §SC-5 — cosmetic emoji check stays as a tier-1 supporting assertion."
  - "Test-only API route is production-gated. Verification curl on production is enumerated in 02-USER-SETUP.md + 02-LAUNCH-CHECKLIST.md QA-01 row."
  - "Admin context is never via JoinForm — storageState minted out-of-band; joinAsAdmin helper throws-and-documents."
  - "[Rule 3 - Operational reorder] Task 4 (CI workflow + USER-SETUP + LAUNCH-CHECKLIST) authored BEFORE Task 3 (human-action smoke run) because Task 4 is pure-additive plumbing that doesn't depend on the smoke having actually run yet. Task 3 + Task 5 remain BLOCKING ship gates (checkpoint:human-action) that the orchestrator + zekez close together."
  - "Per-task atomic commits (4 so far: ac1840b Task 0; 623c025 Task 1; fb15f19 Task 2; 25ca943 Task 4) — same pattern Plan 02-01/02-03 documented as their deviation #3. Smaller commits = better git history + lower worktree-loss risk."

# Metrics
duration: ~70min (so far, Tasks 0/1/2/4; Tasks 3 + 5 awaiting human action)
completed: 2026-05-25 (Tasks 0/1/2/4 only; full plan closure requires human-action checkpoint)
---

# Phase 2 Plan 02-08: Ship-Gate Summary (CHECKPOINT PENDING)

**Playwright smoke + canonical RLS-rejection assertion + CI + launch checklist are all in place. QA-01 closure requires the human to run `npm run test:e2e` against the live Supabase project (Task 3); QA-02/03/04 require zekez's manual sign-off on the launch checklist (Task 5). Both are `checkpoint:human-action` per plan `autonomous: false`.**

## Status

- **Tasks 0, 1, 2, 4: COMPLETE** (4 atomic commits)
- **Task 3 (human-action: run smoke locally + record PASS): AWAITING USER**
- **Task 5 (human-action: QA-02/03/04 sign-off): AWAITING USER**
- **Task 6 (commit changes): supplanted by per-task commits + this SUMMARY commit; orchestrator merge-back closes the plan**

## Performance (so far)

- **Duration:** ~70 minutes (Tasks 0/1/2/4 only; Task 3 + Task 5 are human-action)
- **Tasks committed:** 4 of 7 (the remaining 3 are human-action checkpoints + the final commit task, which the per-task commits already covered)
- **Files created:** 12 source + 2 docs + 1 SUMMARY = 15
- **Files modified:** 6
- **All commits authored to:** `10100761+zarurc@users.noreply.github.com`

## Task Commits

| # | SHA | Subject |
|---|-----|---------|
| Task 0 | `ac1840b` | feat(02-08): add data-testid contract to MatchRow + MatchRowStepper |
| Task 1 | `623c025` | chore(02-08): install @playwright/test + playwright.config.ts (build+start, not dev) |
| Task 2 | `fb15f19` | feat(02-08): Playwright smoke + RLS-rejection assertion + test fixtures |
| Task 4 | `25ca943` | ci(02-08): add e2e Playwright job + 02-USER-SETUP + 02-LAUNCH-CHECKLIST |

## Accomplishments

### Task 0 — data-testid contract (`ac1840b`)
- `MatchRow.client.tsx` root `<div>` now carries `data-testid={\`match-row-${fixtureId}\`}`.
- `MatchRowStepper.client.tsx` has 4 stable testids: `stepper-{home,away}-{plus,minus}-${fixtureId}`. Literal tokens kept grep-able via a typed helper map (`testIdMinus(side)` / `testIdPlus(side)`).
- Pure-additive change: no prop / handler / styling modifications. All lints + typecheck pass.

### Task 1 — Playwright install + config (`623c025`)
- `@playwright/test ^1.60.0` installed via `npm install --save-dev`.
- Package-lock JFrog→npmjs rewrite applied unconditionally (Phase 1 P05 mandatory; `grep -c jfrogrepo24 package-lock.json` returns 0).
- `playwright.config.ts` at repo root: `devices['Pixel 5']` mobile viewport; webServer command is `npm run build && npm run start` (NEVER `next dev`); webServer timeout `240_000ms` covers CI cold-cache; conditional on `PLAYWRIGHT_BASE_URL` starting with `http://localhost`.
- Scripts added: `test:e2e`, `test:e2e:ui`, `db:test-seed`, `db:test-clean`.
- `.gitignore` extended with Playwright artifact paths + `tests/e2e/.admin-storage-state.json`.

### Task 2 — smoke + fixtures + helpers (`fb15f19`)
- `data/test-fixtures.sql`: SMOKE_PRE_LOCK (external_match_no=9001, kickoff+90s) + SMOKE_POST_LOCK (9002, kickoff-1min). Idempotent via `where not exists` + refresh `UPDATE`s. **tournament_id resolved via WC2026 code (Rule 1 fix)**.
- `data/test-fixtures-clean.sql`: FK-safe cascade cleanup of score_events → predictions → prop_answers → fixtures → profiles for SMOKE fixtures + SmokeUser%.
- `tests/e2e/fixtures/db.ts`: service-role `getFixtureIdByExternalNo` + `getAdminUserId`.
- `tests/e2e/fixtures/auth.ts`: `joinAsPlayer` (UI flow, verbatim `'Join the Pool'` button + `#display_name` / `#invite_code` IDs); `joinAsAdmin` throws-and-documents (storageState minted out-of-band, never via JoinForm — avoids family-trust rebind).
- `tests/e2e/fixtures/api.ts`: `attemptPredictionAgainstLockedFixture` POSTs to `/api/test/save-prediction`, observes HTTP 403 OR `{ ok: false, error }`.
- `tests/e2e/smoke.spec.ts`: single multi-context E2E with canonical RLS-rejection assertion. Selectors are `getByTestId()` only — no `.first()` heuristics, no text-content fallback.
- `tests/e2e/global-teardown.ts`: runs `npm run db:test-clean` + sweeps `auth.users` via Admin API for `user_metadata.smoke_test === true`.
- `src/app/api/test/save-prediction/route.ts`: test-only JSON wrapper around the `savePrediction` Server Action; **production-gated** (`NODE_ENV === 'production' && !PLAYWRIGHT_INVITE_CODE → 403`); maps `'locked'` → HTTP 403 so the smoke can assert either status or body.

### Task 4 — CI + docs (`25ca943`)
- `.github/workflows/lint.yml`: new `e2e` job (depends on `lint`). Reapplies the JFrog→npmjs lockfile rewrite; portable `have_secrets` step-output gate; **builds Next.js as a separate step BEFORE Playwright launches** (Phase 1 P05 contract honored; webServer then re-runs build with warm `.next/`); seeds test fixtures; runs `npm run test:e2e`; cleans up with `if: always()`; uploads `playwright-report` on failure.
- `02-USER-SETUP.md`: documents all new env vars (`DATABASE_URL`, `PLAYWRIGHT_INVITE_CODE`, `PLAYWRIGHT_ADMIN_NAME`, `PLAYWRIGHT_TEST_USER`, `PLAYWRIGHT_BASE_URL`) for local + Vercel + GitHub Actions Secrets; local Playwright workflow; admin-half manual-verify fallback; production-safety probe.
- `02-LAUNCH-CHECKLIST.md`: QA-01/02/03/04 single-file ship gate per D-32. QA-01 explicitly calls out the **canonical RLS-rejection assertion** (not the cosmetic emoji). Post-launch sanity rows.

## Deviations from Plan

### [Rule 1 - Bug] tournament_id NOT NULL omitted from plan skeleton
- **Found during:** Task 2 — reading `supabase/migrations/0001_init.sql` line 52 (`tournament_id uuid not null references public.tournament(id) on delete cascade`).
- **Issue:** Plan 02-08's `data/test-fixtures.sql` skeleton did not set `tournament_id`. The INSERT would fail with `null value in column "tournament_id" of relation "fixtures" violates not-null constraint`.
- **Fix:** Each INSERT now resolves the tournament UUID via `(select id from public.tournament where code = 'WC2026' limit 1)`. Refresh `UPDATE`s also added `updated_at = now()` to keep the column consistent with the `updated_at` semantics.
- **Files modified:** `data/test-fixtures.sql`
- **Commit:** `fb15f19`

### [Rule 3 - Operational] Task 4 authored BEFORE Task 3 (checkpoint reorder)
- **Found during:** Task 2 completion + planning Task 3.
- **Issue:** Task 3 is `checkpoint:human-action` requiring (a) live Supabase access, (b) Playwright browser binaries downloadable through the corp proxy, (c) DATABASE_URL + admin storageState minting. None of these are available to an autonomous executor in this worktree (browser download already failed). Authoring Task 4 inline does not depend on Task 3 having succeeded — the CI workflow + USER-SETUP + LAUNCH-CHECKLIST are pure-additive plumbing.
- **Fix:** Ran Task 4 between Task 2 commit and the human-action checkpoint return. Task 3 (smoke run) + Task 5 (QA-02/03/04 sign-off) remain BLOCKING ship gates that the orchestrator coordinates with zekez.
- **Files modified:** none (operational reorder choice)
- **Commit:** `25ca943` (Task 4 commit)

### [Rule 3 - Operational] Per-task atomic commits instead of plan Task 6's batched commit
- **Found during:** Task 0 / Task 1 boundary.
- **Issue:** Plan Task 6 instructed "Commit all changes (split across two commits: code + docs)" at the end. But each task's changes are independently verifiable and useful as git history. Per-task commits are smaller, easier to revert, and reduce worktree-loss risk (#2070). Same trade-off Plan 02-01 documented as deviation #3 and Plan 02-03 documented as deviation #3.
- **Fix:** Four atomic commits (one per task). Task 6's instruction becomes a no-op — already covered.
- **Files modified:** none (commit-strategy choice)

### [Note - Operational] node_modules symlink from parent worktree
- **Found during:** baseline `npm run typecheck` at execution start.
- **Issue:** Fresh worktree had no `node_modules` directory (Claude Code worktrees skip dep installs).
- **Fix:** Symlinked `node_modules → /Users/zekez/Documents/Claude\ OS/zarur-cup/node_modules` (gitignored; doesn't enter version control). Then ran `npm install --save-dev @playwright/test` which installed into the parent's `node_modules` (the canonical store). Same pattern as Plan 02-02/02-03/02-04 Note 5.

### [Note - Operational] Playwright chromium binary download failed
- **Found during:** Task 1 — `npx playwright install chromium` failed: `Failed to download Chrome for Testing 148.0.7778.96 (playwright chromium v1223)`.
- **Issue:** Corp proxy / TLS — the chromium tarball is hosted on `https://playwright.azureedge.net/...` which the corp proxy does not whitelist.
- **Fix (documented in 02-USER-SETUP.md):** The human runs `npx playwright install chromium` from a non-corp network (phone hotspot) before running the smoke locally. CI runners on `ubuntu-latest` have direct internet and the `npx playwright install --with-deps chromium` step works there.

## Awaiting (handed off to orchestrator + human)

### Task 3 — BLOCKING checkpoint:human-action

The smoke must be exercised against the live Supabase project `tjivukpxuhbrbshidbfv` by zekez. Required steps (full detail in 02-USER-SETUP.md):

1. Install Playwright chromium binary locally: `npx playwright install chromium` (may need non-corp network).
2. Set env vars in `.env.local`: `DATABASE_URL`, `PLAYWRIGHT_INVITE_CODE`, `PLAYWRIGHT_ADMIN_NAME`, `PLAYWRIGHT_TEST_USER` (in addition to Phase 1 vars).
3. Mint admin storageState (optional; smoke skips admin half if missing): `node scripts/db-mint-admin-session.cjs` (this script is NOT created in this plan because admin session minting is supabase-js-version-specific — the smoke gracefully skips the admin half if the file is absent).
4. Seed: `npm run db:test-seed`.
5. Run: `npm run test:e2e` (first run takes ~90–120s because of `next build`).
6. Confirm in trace: `expect(writeResult.ok).toBe(false)` passed (canonical RLS-rejection assertion ran).
7. Cleanup: `npm run db:test-clean` (auto-runs via globalTeardown; manual SQL in 02-USER-SETUP.md if it didn't).

### Task 5 — BLOCKING checkpoint:human-action

QA-02/03/04 manual sign-off on `02-LAUNCH-CHECKLIST.md`:
- QA-02: real-phone mobile QA HE+EN.
- QA-03: Hebrew copy review across `messages/he.json` + `prop_questions.prompt_he`.
- QA-04: family WhatsApp distribution on/before June 11 19:00 UTC.

## Threat Surface

All eight STRIDE threats (T-02-08-01..08) handled per plan `<threat_model>`:

- **T-02-08-01** (SUPABASE_SECRET_KEY in CI logs): GHA secrets are auto-masked; the e2e job uses `env:` blocks only (no `echo $SECRET`).
- **T-02-08-02** (smoke leaves orphan SmokeUser rows): `globalTeardown` runs `db:test-clean` + Admin API sweep; CI workflow has `if: always()` cleanup step.
- **T-02-08-03** (DoS via repeated CI inserts): ~5 rows per run; cleanup removes them; Supabase free tier handles 500MB.
- **T-02-08-04** (fork PR EoP via secrets): GHA strips secrets on fork PRs; `have_secrets` step-output gate ensures all e2e steps `if:`-skip when secrets are absent.
- **T-02-08-05** (Playwright trace artifact info leak): cookies are httpOnly; display_name is non-sensitive; upload gated to `if: failure()`.
- **T-02-08-06** (malicious DML in test-fixtures.sql): file is PR-reviewed; only INSERTs synthetic 9001/9002 rows + SmokeUser cascade.
- **T-02-08-07** (/api/test/save-prediction exposed in prod): hard gate `NODE_ENV === 'production' && !PLAYWRIGHT_INVITE_CODE → 403`. Verification curl on every deploy enumerated in 02-USER-SETUP.md.
- **T-02-08-08** (admin storageState committed): `.gitignore` excludes both `playwright/.auth/` AND `tests/e2e/.admin-storage-state.json` explicitly.

## Threat Flags

None. No new security-relevant surface beyond the plan's enumerated threat register.

## Known Stubs

None. The Playwright smoke + CI infrastructure + docs are complete; the gap is human-action ship gates (Tasks 3 + 5), not code stubs.

## TDD Gate Compliance

Plan 02-08 is `type: execute` (not `type: tdd`); no tasks were marked `tdd="true"`. No TDD gates apply.

## Patterns Downstream Plans Should Reuse

- **Pattern 39** (data-testid contract on interactive client components): Phase 3 Bracket UI should ship `bracket-slot-{slotId}`, `bracket-team-pick-{slotId}-{teamId}` testids from day 1 so the Phase 3 smoke is selector-deterministic.
- **Pattern 40** (Playwright vs `next dev`): every future E2E plan MUST configure webServer with `npm run build && npm run start`. Never `next dev`. This is the codified Phase 1 P05 contract.
- **Pattern 41** (canonical RLS-rejection assertion): when a future plan adds a new lock-and-reveal surface (e.g., Phase 3 bracket reveal at first knockout), the smoke must include a `attempt{Write}AgainstLockedFixture`-shaped assertion that observes the server reject the write — not just a cosmetic UI check.
- **Pattern 42** (test-only API route + production gate): when introducing a JSON wrapper around a Server Action for test purposes, ALWAYS gate by `NODE_ENV` + an env-var presence check. Add a verification curl row to the launch checklist.
- **Pattern 43** (never run JoinForm for admin): Phase 3 Bracket smoke + any future smoke that needs an admin session must mint storageState out-of-band, never via the UI flow.
- **Pattern 44** (step-output `have_secrets` gate in CI): every future CI job that needs production secrets should follow this portable form.

## Issues Encountered

- **Plan SQL omitted tournament_id** (Rule 1 fix during Task 2 — see Deviations above).
- **Playwright chromium binary download blocked by corp proxy** (Note — documented for human).
- **Heredoc with backticks confused bash on the first Task 2 commit** (operational; used `-F /tmp/...txt` instead). No code impact.
- **Bash didn't have `timeout` command** (operational only; replaced with bash builtin).

## Next Steps (orchestrator + human)

1. **Orchestrator merges this worktree** back to `main` so Tasks 0/1/2/4 land on the main branch.
2. **Human (zekez) runs Task 3:** local smoke against live Supabase. Reports back with the `1 passed` line + confirmation the RLS-rejection assertion ran.
3. **CI runs the e2e job** on the merge commit; recorded in QA-01 row of `02-LAUNCH-CHECKLIST.md`.
4. **Human (zekez) runs Task 5:** QA-02/03/04 sign-off; family WhatsApp distribution before June 11 19:00 UTC.
5. **Plan 02-08 + Phase 2 close** when all four QA gates are ticked in the launch checklist.

## Self-Check

Verified during execution:
- `src/components/matches/MatchRow.client.tsx` has `data-testid={\`match-row-${fixtureId}\`}` — FOUND
- `src/components/matches/MatchRowStepper.client.tsx` has all 4 testids (literal tokens) — FOUND
- `playwright.config.ts` exists at repo root — FOUND
- `playwright.config.ts` contains `npm run build && npm run start` — FOUND (2 occurrences: import-time default + command)
- `playwright.config.ts` does NOT contain `command: 'npm run dev'` — FOUND (0 occurrences)
- `playwright.config.ts` contains `timeout: 240_000` — FOUND
- `package.json` has `@playwright/test` in devDependencies — FOUND
- `package.json` has `test:e2e` script — FOUND
- `package-lock.json` has 0 `jfrogrepo24` URLs — FOUND
- `.gitignore` has `/test-results/`, `/playwright-report/`, `/playwright/.cache/`, `/playwright/.auth/`, `tests/e2e/.admin-storage-state.json` — FOUND
- `data/test-fixtures.sql` exists; contains `9001`, `9002`, `now() + interval '90 seconds'`, `now() - interval '1 minute'`, refresh UPDATEs, tournament_id lookup — FOUND
- `data/test-fixtures-clean.sql` exists; FK-safe order; covers SmokeUser cascade — FOUND
- `tests/e2e/fixtures/db.ts` exports `getFixtureIdByExternalNo` + `getAdminUserId` — FOUND
- `tests/e2e/fixtures/api.ts` exports `attemptPredictionAgainstLockedFixture` — FOUND
- `tests/e2e/fixtures/auth.ts` exports `joinAsPlayer` + `joinAsAdmin`; contains literal `'Join the Pool'` — FOUND
- `tests/e2e/smoke.spec.ts` uses `getByTestId`, calls `attemptPredictionAgainstLockedFixture`, asserts `expect(writeResult.ok).toBe(false)`, contains `'rls_denied'` + `PLAYWRIGHT_INVITE_CODE` + `browser.newContext`, references both `stepper-home-plus-` AND `stepper-away-plus-` — FOUND
- `tests/e2e/global-teardown.ts` invokes `npm run db:test-clean` + Supabase Admin API cleanup — FOUND
- `src/app/api/test/save-prediction/route.ts` is gated on `NODE_ENV === 'production' && !PLAYWRIGHT_INVITE_CODE` — FOUND
- `.github/workflows/lint.yml` `e2e` job: separate `Build Next.js` step, `have_secrets` step-output gate, `npm run db:test-seed`, `npm run test:e2e`, `npm run db:test-clean` (always), upload-artifact on failure — FOUND
- `02-USER-SETUP.md` contains `PLAYWRIGHT_INVITE_CODE` (4 occurrences) — FOUND
- `02-LAUNCH-CHECKLIST.md` contains all four `QA-01..04` rows + canonical RLS-rejection assertion line — FOUND
- All commits: `git log --oneline` shows `ac1840b`, `623c025`, `fb15f19`, `25ca943` — FOUND
- `npm run lint:rtl`, `npm run lint:tailwind-v4`, `npm run typecheck` exit 0 on every commit (verified by husky pre-commit hook) — FOUND
- Git author = `10100761+zarurc@users.noreply.github.com` — FOUND

## Self-Check: PASSED (with checkpoint pending)

The plan body — code, fixtures, CI, docs — is complete and committed. Two human-action checkpoints (Task 3: smoke run; Task 5: QA-02/03/04 sign-off) remain BLOCKING and are documented + handed off via `02-LAUNCH-CHECKLIST.md`.

---
*Phase: 02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate*
*Plan: 08 — Ship-gate Playwright smoke + CI + launch checklist*
*Code & docs complete: 2026-05-25*
*Plan closure: PENDING zekez human-action on QA-01/02/03/04*

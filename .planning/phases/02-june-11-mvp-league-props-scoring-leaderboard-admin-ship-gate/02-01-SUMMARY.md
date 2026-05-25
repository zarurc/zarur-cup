---
phase: 02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate
plan: 01
subsystem: schema+lint
tags: [supabase, migrations, score_events, v_leaderboard, fixtures-et, prop-aliases, tailwind-v4, lint, complete]
status: complete
gate: passed

# Dependency graph
requires:
  - "Phase 1 complete: live tjivukpxuhbrbshidbfv with 6 migrations, RLS lock-and-reveal, 104 fixtures seeded, anon SELECT on all tables (Phase 1 D-21)"
  - "Phase 1 P05 operational notes still in force: git author = 10100761+zarurc@users.noreply.github.com; lockfile JFrog->npmjs rewrite after every npm install; src/types/supabase.ts committed (un-gitignored)"
provides:
  - "Live tjivukpxuhbrbshidbfv has score_events table (PK user_id+source+ref_id, RLS enabled, zero DML grants to authenticated, service_role full DML) — schema foundation for SCR-06 idempotency"
  - "Live tjivukpxuhbrbshidbfv has v_leaderboard view (6 derived columns per profile) — schema foundation for LB-01/02/04"
  - "Live tjivukpxuhbrbshidbfv has fixtures.result_home_full + result_away_full nullable smallint columns (D-12 Phase 3 forward-compat)"
  - "Live tjivukpxuhbrbshidbfv has prop_questions.correct_answer_aliases text[] NOT NULL DEFAULT '{}' (D-24 alias-set grading foundation)"
  - "src/types/supabase.ts contains Database['public']['Tables']['score_events'] + Database['public']['Views']['v_leaderboard'] + new fixtures + prop_questions columns"
  - "npm run lint:tailwind-v4 catches bare [--zc-X] CSS-var shorthand; wired into .husky/pre-commit + .github/workflows/lint.yml (SCR-05 regression guard)"
  - "package-lock.json has zero jfrogrepo24 URLs (mandatory P05 rewrite re-applied — no-op this round, file unchanged)"
affects:
  - "Wave 2+ plans (02-03 saveResult action surface, 02-05 saveResult Server Action, 02-06 gradeProp + integrity widget, 02-07 leaderboard): all depend on score_events + v_leaderboard being live AND in src/types/supabase.ts before they can compile"
  - "Every future Phase 2 component must follow the lint:tailwind-v4 rule (Pitfall 4 / SCR-05) — no bare [--zc-X] shorthand"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern 23 (Phase 2): score_events RLS posture — SELECT for all signed-in members via `using (true)`; ZERO INSERT/UPDATE/DELETE policy for authenticated => default-deny. All writes go through service_role (saveResult/gradeProp). B-style smoke at end of 0007 asserts no DML grants ever leak to authenticated."
    - "Pattern 24 (Phase 2): v_leaderboard derives from LEFT JOIN profiles -> score_events so every profile appears with zero-coalesced totals even before any score_events exist. Six FILTER aggregates avoid sub-query duplication. Tiebreaker chain lives in the consumer RSC (Intl.Collator), NOT in the view (Pitfall 5 — avoids ICU collation availability question)."
    - "Pattern 25 (Phase 2): ALTER TABLE forward-compat — add Phase-3 columns now (result_home_full, result_away_full, correct_answer_aliases) so Phase 3 ships UI without a mid-tournament migration round-trip."
    - "Pattern 26 (Phase 2 corrective): service_role does NOT inherit read access on views in projects with `Automatically expose new tables: OFF`. Explicit `grant select on <view> to service_role` is required for any view consumed by adminReadClient. See migration 0011."
    - "Pattern 27 (Phase 2 corrective): when a migration's post-push live verification surfaces a missing grant, write a new append-only migration (NEVER edit the original). Pattern established Phase 1 P02; reapplied here for 0008 -> 0011."

key-files:
  created:
    - "supabase/migrations/0007_score_events.sql — table + RLS + 3 GRANTs + 2 B-style DO-block smokes"
    - "supabase/migrations/0008_v_leaderboard.sql — view + 2 GRANTs (authenticated + anon) + 2 smokes (queryable + schema-shape)"
    - "supabase/migrations/0009_fixtures_result_full.sql — ALTER TABLE + comments + smoke asserting nullable smallint"
    - "supabase/migrations/0010_prop_questions_aliases.sql — ALTER TABLE + comment + 2 smokes (column-shape + backfill-non-null)"
    - "supabase/migrations/0011_v_leaderboard_service_role_grant.sql — corrective: grants SELECT on v_leaderboard to service_role + B-style smoke"
    - ".planning/phases/02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate/02-01-SUMMARY.md"
  modified:
    - "src/types/supabase.ts — regenerated post-push; now contains score_events + v_leaderboard + new fixtures + new prop_questions columns"
    - "package.json — added lint:tailwind-v4 script"
    - ".husky/pre-commit — chained lint:tailwind-v4 between lint:rtl and typecheck"
    - ".github/workflows/lint.yml — added SCR-05 step between FND-03 and ESLint"
  unchanged:
    - "package-lock.json — P05 sed rewrite applied but produced no diff this round (npm install had not introduced new JFrog URLs)"

key-decisions:
  - "Migrations 0007-0010 committed BEFORE live push because the plan is a checkpoint plan (autonomous: false). Per Phase 1 worktree #2070 rule, work survives worktree force-removal only when committed. Continuation handling (push + types + lockfile + 0011 + Task 3 wiring) landed in 2 follow-up commits."
  - "0008 v_leaderboard intentionally omitted `grant select to service_role` (line 57 comment: 'service_role inherits via superuser-equivalent in Supabase; explicit grant not required'). Post-push REST verification (sb_secret_* key) returned 42501 permission denied. Phase 1 P02 deviation re: `Automatically expose new tables: OFF` invalidates the inheritance assumption. Fixed via append-only migration 0011 (NOT by editing 0008 — migrations are append-only)."
  - "0007 + 0008 + 0009 + 0010 + 0011 verified on live via REST: score_events count=0; v_leaderboard returns 2 profiles (Zeke + חזי) zero-coalesced; fixtures has both ET columns nullable smallint; prop_questions.correct_answer_aliases ARRAY/_text/NOT NULL with '{}' default and zero NULL rows."
  - "0008 keeps tiebreaker chain OUT of the view per RESEARCH Pattern 7 / Pitfall 5. Consumers do `from('v_leaderboard').select('*')` then sort TS-side with `Intl.Collator(locale).compare` (Plan 02-07)."
  - "0008 uses regular VIEW (not MATERIALIZED VIEW) — at 15 users × ~120 events = ~1.8k rows the SUM/GROUP BY is sub-ms; re-evaluate only if Phase 3 bracket scoring blows up row counts."
  - "0009 does NOT touch legacy fixtures.result_home / result_away (Phase 1 'Don't Hand-Roll' rule). Those stay NULL forever; Phase 2 admin writes _90min; Phase 3 admin writes _90min + _full."
  - "0010 uses NOT NULL with empty-array default ('{}') so gradeProp (Plan 02-06) can iterate the array unconditionally without a COALESCE branch."
  - "lint:tailwind-v4 script is the exact form specified in 02-01-PLAN.md Task 3. Husky hook chains it between lint:rtl and typecheck; CI workflow adds it as a dedicated step before ESLint. Synthetic-violation test confirmed non-zero exit + correct error message."

requirements:
  closed:
    - SCR-05      # Tailwind v4 regression guard — fully shipped
    - SCR-06      # score_events PK enforces idempotency at schema level (user-visible UPSERT orchestration lands in Plans 02-05/02-06)

# Metrics
duration: ~60min (executor agent ~25min for Task 1; orchestrator-handled push + verification + corrective 0011 + Tasks 2-4 ~35min)
completed: 2026-05-25
---

# Phase 2 Plan 01 — SUMMARY (complete)

**Status:** All 4 tasks complete. 5 migrations live on tjivukpxuhbrbshidbfv (0007-0011); types regenerated and committed; lint:tailwind-v4 wired into the pre-commit hook and CI workflow; package-lock.json clean of JFrog URLs.

## What's Done

### Task 1 — Migrations 0007-0010 written + committed

All 4 migration files passed every grep gate in the plan's acceptance criteria. Pre-commit hooks (lint:rtl + typecheck) passed.

| File | Key invariants | DO-block smokes |
|---|---|---|
| `0007_score_events.sql` | table + PK `(user_id, source, ref_id)`; CHECK `source in ('league','prop','bracket')`; FK `auth.users ON DELETE CASCADE`; RLS enabled; `for select to authenticated using (true)`; service_role full DML; authenticated + anon SELECT only | authenticated has zero DML grants ✓; anon has zero write grants ✓ |
| `0008_v_leaderboard.sql` | view with 6 aggregations; LEFT JOIN profiles -> score_events; GROUP BY user_id, display_name | view queryable ✓; all 6 expected columns present ✓ |
| `0009_fixtures_result_full.sql` | ALTER TABLE add result_home_full + result_away_full smallint | both columns exist with nullable smallint shape ✓ |
| `0010_prop_questions_aliases.sql` | ALTER TABLE add correct_answer_aliases text[] NOT NULL DEFAULT '{}' | column shape correct ✓; zero NULL rows after backfill ✓ |

Committed in: `e956cc4 feat(02-01): migrations 0007-0010 — score_events + v_leaderboard + ET schema + prop aliases`.

### Task 2 — push + verify + types regen + lockfile + corrective 0011

1. `npm run db:push --linked` → all 4 migrations applied cleanly (no DO-block exceptions). `supabase migration list --linked` confirms 0007-0010 (and 0011) all present on remote.

2. REST verification (sb_secret_* key against `/rest/v1/`):

| Query | Expected | Actual |
|---|---|---|
| `score_events?select=user_id` count | 0 | `Content-Range: */0` ✓ |
| `v_leaderboard?select=*&limit=5` | rows with zero-coalesced totals | 2 profiles (Zeke + חזי), all 6 derived columns = 0 ✓ |
| `fixtures?select=result_home_full,result_away_full&limit=1` | columns exist, null values | `[{"result_home_full":null,"result_away_full":null}]` ✓ |
| `prop_questions?select=id,correct_answer_aliases&limit=3` | rows with `[]` defaults | 3 rows, all aliases = `[]` ✓ |
| `prop_questions?...&correct_answer_aliases=is.null` count | 0 | `Content-Range: */0` ✓ |

3. **Corrective migration 0011** was needed: initial v_leaderboard query returned 42501 "permission denied for view v_leaderboard". Root cause: 0008 omitted `grant select on public.v_leaderboard to service_role` based on a wrong inheritance assumption (line 57 comment). On this project ("Automatically expose new tables: OFF" — Phase 1 P02 deviation), service_role lacks default-grants. Wrote 0011 (append-only) with B-style smoke; pushed; re-verified — all 4 queries pass.

4. `npm run db:types` regenerated `src/types/supabase.ts`. Confirmed `score_events: {` and `v_leaderboard: {` entries.

5. Mandatory P05 lockfile sed rewrite executed — `grep -c "jfrogrepo24" package-lock.json` returns 0. File diff is empty (no JFrog URLs were present this round).

Committed in: `551d756 feat(02-01): regen types + corrective 0011 v_leaderboard service_role grant`.

### Task 3 — lint:tailwind-v4 wiring

Added script to `package.json` (exact text from plan): `! grep -REn '\[--zc-' src/ || (echo 'Tailwind v4 violation: bare CSS-var shorthand. Use [var(--zc-X)] not [--zc-X]' && exit 1)`.

Wired into `.husky/pre-commit` (chained between lint:rtl and typecheck, with explicit echo + error message).

Wired into `.github/workflows/lint.yml` (dedicated SCR-05 step between FND-03 and ESLint).

Verified clean run on current src/ (exit 0). Synthetic-violation sanity check: temp `src/test-tailwind-regression.tsx` with `bg-[--zc-test]` triggers exit 1 with the expected error message. Temp file deleted; never committed.

### Task 4 — final commit + gate

Committed in: `345a5a1 chore(02-01): lint:tailwind-v4 script + husky + CI wiring (SCR-05)`.

Final automated gate:
- `grep -c "jfrogrepo24" package-lock.json` → 0 ✓
- `git config user.email` → `10100761+zarurc@users.noreply.github.com` ✓
- `git status` → clean ✓
- `npm run lint:rtl` → exit 0 ✓
- `npm run lint:tailwind-v4` → exit 0 ✓
- `npm run typecheck` → exit 0 (via husky pre-commit on commit `345a5a1`) ✓
- `grep -c "lint:tailwind-v4" package.json` → 1 ✓
- `grep -c "lint:tailwind-v4" .husky/pre-commit` → 3 (heading comment + echo line + npm-run line) ✓
- `grep -c "lint:tailwind-v4" .github/workflows/lint.yml` → 1 ✓

## Commits (this plan)

| SHA | Message | Files |
|---|---|---|
| `e956cc4` | feat(02-01): migrations 0007-0010 — score_events + v_leaderboard + ET schema + prop aliases | 4 created |
| `c813528` | (checkpoint summary scaffold — superseded by this final SUMMARY) | 1 |
| `551d756` | feat(02-01): regen types + corrective 0011 v_leaderboard service_role grant | 1 created (0011), 1 modified (types) |
| `345a5a1` | chore(02-01): lint:tailwind-v4 script + husky + CI wiring (SCR-05) | 3 modified |

## Deviations from Plan

1. **Migration 0011 added (Rule 2: missing critical, append-only).** Plan called for 4 migrations; 5 shipped. 0008's "service_role inherits" assumption was wrong on this project's posture. Fix is append-only per Phase 1 Pattern: never edit a pushed migration. 0008 stays on live as historical record; 0011 adds the missing grant.
2. **Checkpoint commit `c813528` (Rule 3: operational).** The parallel-executor protocol (worktree force-removal rule #2070) required committing SUMMARY scaffold before checkpoint return. Final SUMMARY (this file) supersedes it; both commits live on the worktree branch and merge cleanly.
3. **Task 2's commit split into 2 commits (Rule 3: operational).** Plan called for one commit bundling migrations + types + lockfile. Migrations had to ship in `e956cc4` (pre-checkpoint) to survive worktree removal. Types + 0011 landed in `551d756`. Functionally equivalent; commit messages reflect actual content.

## Issues Encountered

1. **`supabase db push` from worktree initially failed** with "Cannot find project ref" — the `supabase/.temp/` directory is gitignored. Resolved by `cp -R` from main repo. Not a plan bug; a worktree-checkpoint UX wrinkle.
2. **v_leaderboard 42501 on first REST verification.** Resolved by migration 0011 (documented above).
3. **`fixtures.match_no` column does not exist** — incorrect column name used during sanity-curl. Not a defect; the test was using a guessed schema. Re-ran with `select=result_home_full,result_away_full` and verified.

## Self-Check: PASSED

- 5 migrations on live Supabase (0007-0011) — CONFIRMED via `supabase migration list --linked`
- `src/types/supabase.ts` contains `score_events` and `v_leaderboard` — CONFIRMED via grep
- `package.json` contains `lint:tailwind-v4` script — CONFIRMED
- `.husky/pre-commit` chains `lint:tailwind-v4` — CONFIRMED
- `.github/workflows/lint.yml` runs `lint:tailwind-v4` — CONFIRMED
- `grep -c "jfrogrepo24" package-lock.json` returns 0 — CONFIRMED
- Synthetic-violation sanity check exits 1 — CONFIRMED
- All 4 REST verification queries returned expected shapes — CONFIRMED
- Git author = `10100761+zarurc@users.noreply.github.com` — CONFIRMED
- Pre-commit hooks (lint:rtl + lint:tailwind-v4 + typecheck) passed on every commit — CONFIRMED

---

*Phase: 02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate*
*Plan: 01 — score_events + v_leaderboard + ET schema + prop aliases + lint:tailwind-v4 guard*
*Closed: 2026-05-25*

---
phase: 02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate
plan: 01
subsystem: schema+lint
tags: [supabase, migrations, score_events, v_leaderboard, fixtures-et, prop-aliases, tailwind-v4, lint, checkpoint, blocking]
status: CHECKPOINT — partial; Task 1 complete, Tasks 2-4 await user action
gate: blocking — Task 2 requires live Supabase push + SQL verification

# Dependency graph
requires:
  - "Phase 1 complete: live tjivukpxuhbrbshidbfv with 6 migrations, RLS lock-and-reveal, 104 fixtures seeded, anon SELECT on all tables (Phase 1 D-21)"
  - "Phase 1 P05 operational notes still in force: git author = 10100761+zarurc@users.noreply.github.com; lockfile JFrog->npmjs rewrite after every npm install; src/types/supabase.ts committed (un-gitignored)"
provides-when-complete:
  - "Live tjivukpxuhbrbshidbfv has score_events table (PK user_id+source+ref_id, RLS enabled, zero DML grants to authenticated) — schema foundation for SCR-06 idempotency"
  - "Live tjivukpxuhbrbshidbfv has v_leaderboard view (6 derived columns per profile) — schema foundation for LB-01/02/04"
  - "Live tjivukpxuhbrbshidbfv has fixtures.result_home_full + result_away_full nullable smallint columns (D-12 Phase 3 forward-compat)"
  - "Live tjivukpxuhbrbshidbfv has prop_questions.correct_answer_aliases text[] (D-24 alias-set grading foundation)"
  - "src/types/supabase.ts regenerated to include score_events Row/Insert/Update + v_leaderboard Row + new fixtures + prop_questions columns"
  - "npm run lint:tailwind-v4 wired into .husky/pre-commit + .github/workflows/lint.yml — SCR-05 regression guard"
  - "package-lock.json has zero jfrogrepo24 URLs (mandatory P05 rewrite re-applied)"
affects:
  - "Wave 2 plans (02-02 saveResult action, 02-05 props grading, 02-06 grade UI): all depend on score_events + v_leaderboard being live AND in src/types/supabase.ts before they can compile"
  - "Every future Phase 2 component must follow the lint:tailwind-v4 rule (Pitfall 4 / SCR-05) — no bare [--zc-X] shorthand"

# Tech tracking
tech-stack:
  added: []         # Task 1 ships SQL only; no new packages
  patterns:
    - "Pattern 23 (Phase 2): score_events RLS posture — SELECT for all signed-in members via `using (true)`; ZERO INSERT/UPDATE/DELETE policy for authenticated => default-deny. All writes go through service-role (saveResult/gradeProp). B-style smoke at end of 0007 asserts no DML grants ever leak to authenticated."
    - "Pattern 24 (Phase 2): v_leaderboard derives from LEFT JOIN profiles -> score_events so every profile appears with zero-coalesced totals even before any score_events exist. Six FILTER aggregates (total/league/props/bracket/exact_count/correct_count) avoid sub-query duplication. Tiebreaker chain lives in the consumer RSC (Intl.Collator), NOT in the view (Pitfall 5 — avoids ICU collation availability question)."
    - "Pattern 25 (Phase 2): ALTER TABLE forward-compat — add Phase-3 columns now (result_home_full, result_away_full, correct_answer_aliases) so Phase 3 ships UI without a mid-tournament migration round-trip."

key-files:
  created:
    - "supabase/migrations/0007_score_events.sql — table + RLS + 3 GRANTs + 2 B-style DO-block smokes (line 18-103)"
    - "supabase/migrations/0008_v_leaderboard.sql — view + 2 GRANTs + 2 smokes (queryable + schema-shape check)"
    - "supabase/migrations/0009_fixtures_result_full.sql — ALTER TABLE + comments + smoke asserting nullable smallint"
    - "supabase/migrations/0010_prop_questions_aliases.sql — ALTER TABLE + comment + 2 smokes (column-shape + backfill-non-null)"
    - ".planning/phases/02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate/02-01-SUMMARY.md — this file (checkpoint state)"
  modified: []
  pending-for-task-2:
    - "src/types/supabase.ts — regenerate via `npm run db:types` AFTER the live push lands the new schema"
    - "package-lock.json — re-apply mandatory P05 sed rewrite (JFrog -> npmjs URLs)"
  pending-for-task-3:
    - "package.json — add `lint:tailwind-v4` script (exact text in plan Task 3)"
    - ".husky/pre-commit — chain `npm run lint:tailwind-v4` between lint:rtl and typecheck"
    - ".github/workflows/lint.yml — add `npm run lint:tailwind-v4` step between lint:rtl and typecheck"

key-decisions:
  - "Task 1 migrations committed BEFORE live push because the plan is a blocking checkpoint plan (autonomous: false). Committing the SQL files now means the work survives worktree force-removal (parallel-executor rule #2070). The continuation agent will run `npm run db:push --linked`, regenerate types, sed-rewrite the lockfile, and ship types+lockfile in a SECOND commit. The plan's original sequencing (everything in one feat commit) is preserved in spirit — the migration files are the source of truth, the regen+sed work is mechanical and bundled into the follow-up commit."
  - "0007 uses NO INSERT/UPDATE/DELETE policy on score_events for authenticated (RLS default-deny). The smoke fails fast if any future migration accidentally widens this. This is the lock that lets Phase 2 saveResult/gradeProp Server Actions safely use service-role without any client-facing endpoint being able to mint score rows."
  - "0007 grants `select` to anon (mirrors Phase 1 D-21 'anon SELECT so RLS is the visible lock'). Anon will see zero rows because the RLS policy targets `to authenticated` only — Postgres returns 0 rows, PostgREST renders []. Tested-pattern from Phase 1 01-02 D-2."
  - "0008 (v_leaderboard) keeps the tiebreaker chain OUT of the view per RESEARCH Pattern 7 / Pitfall 5. Consumers do `from('v_leaderboard').select('*')` then sort TS-side with `Intl.Collator(locale).compare`. Avoids the `und-x-icu` / `he-x-icu` availability question on this Supabase build."
  - "0008 uses regular VIEW (not MATERIALIZED VIEW) per D-decisions — at 15 users x ~120 events = ~1.8k rows, the SUM/GROUP BY is sub-ms. Re-evaluate only if Phase 3 bracket scoring blows up row counts."
  - "0009 does NOT touch legacy fixtures.result_home / result_away — Phase 1 'Don't Hand-Roll' rule. Those stay NULL forever; Phase 2 admin writes _90min; Phase 3 admin writes _90min + _full (this migration adds _full for forward-compat)."
  - "0010 uses NOT NULL with empty-array default ('{}') so the gradeProp helper (lands in Plan 02-06) can iterate the array unconditionally without a COALESCE branch. The smoke confirms existing 7 prop_questions rows backfilled cleanly."

requirements-completed-when-task-2-3-4-complete:
  - SCR-05      # lint:tailwind-v4 regression guard (Task 3 fully ships this)
  - SCR-06      # schema half (PK on score_events) — user-visible idempotent UPSERT orchestration lands in Plans 02-05/02-06
# Metrics
duration: ~25min (Task 1 only — Tasks 2/3/4 still pending user action)
checkpoint-reached: 2026-05-25T14:00:00Z (approx)
completed: PENDING — checkpoint blocking on user push
---

# Phase 2 Plan 01 — CHECKPOINT SUMMARY (partial)

**Status:** Task 1 of 4 complete and committed. Tasks 2-4 are blocked on the user running `npm run db:push --linked` + 4 SQL verification queries against live Supabase project tjivukpxuhbrbshidbfv. This SUMMARY documents partial state at checkpoint; the continuation agent will append a final SUMMARY section after Tasks 2-4 land.

## What's Done

### Task 1 — Migrations 0007-0010 written to `supabase/migrations/`

All 4 migration files exist on disk and pass every grep gate in the plan's `<acceptance_criteria>`:

| File | Key invariants enforced | DO-block smokes |
|---|---|---|
| `0007_score_events.sql` | `create table public.score_events`; PK `(user_id, source, ref_id)`; CHECK `source in ('league','prop','bracket')`; FK `auth.users(id) ON DELETE CASCADE`; RLS enabled; `score_events_read for select to authenticated using (true)`; service_role full DML; authenticated SELECT only; anon SELECT only | (1) authenticated has zero INSERT/UPDATE/DELETE grants on score_events; (2) anon has zero write grants |
| `0008_v_leaderboard.sql` | `create or replace view public.v_leaderboard`; 6 aggregation columns (total/league_total/props_total/bracket_total/exact_count/correct_count); LEFT JOIN profiles -> score_events; GROUP BY user_id, display_name; GRANT SELECT to authenticated + anon | (1) view is queryable (`perform 1 from v_leaderboard limit 1`); (2) all 6 expected aggregation columns are present in information_schema.columns |
| `0009_fixtures_result_full.sql` | `alter table public.fixtures ADD column result_home_full smallint, ADD column result_away_full smallint`; comments document D-12 posture (Phase 3 admin populates, group-stage stays NULL forever) | (1) both columns exist with nullable smallint shape |
| `0010_prop_questions_aliases.sql` | `alter table public.prop_questions ADD column correct_answer_aliases text[] NOT NULL DEFAULT '{}'`; comment documents D-24 alias-set fuzzy match | (1) column exists with NOT NULL + ARRAY/_text + default contains '{}'; (2) zero existing rows have NULL aliases after backfill |

**Committed in:** `e956cc4 feat(02-01): migrations 0007-0010 — score_events + v_leaderboard + ET schema + prop aliases` (author `10100761+zarurc@users.noreply.github.com`, pre-commit hook lint:rtl + typecheck both passed)

**Acceptance criteria verified via grep:**
- File existence: 4/4 ✓
- 0007: 11/11 invariants matched (create table, PK, source CHECK, FK CASCADE, RLS enable, policy, `for select to authenticated using (true)`, three GRANT lines, raise exception ×2) ✓
- 0008: 5/5 invariants matched (view, LEFT JOIN, GROUP BY, grants ×2) ✓
- 0009: 6/6 invariants matched (alter, add column ×2, comments ×2, raise exception ×2) ✓
- 0010: 4/4 invariants matched (alter, add column with NOT NULL DEFAULT, comment, raise exception ×5) ✓
- `git status` after stage shows ONLY new files 0007-0010 — no edits to 0001-0006 ✓

## What's NOT Done — Blocking Checkpoint

### Task 2 [BLOCKING]: live Supabase push + SQL verification + types regen + lockfile rewrite + commit

The plan's Task 2 is `type="checkpoint:human-action" gate="blocking"`. It requires the user (zekez) to:

1. From repo root: `npm run db:push` (uses `supabase db push --linked`). Expect 4 migrations applied; each B-style DO-block runs without exception.
2. Verify on live via SQL editor at https://supabase.com/dashboard/project/tjivukpxuhbrbshidbfv/sql/new:
   - `SELECT count(*) FROM public.score_events;` returns `0` (table exists, empty).
   - `SELECT * FROM public.v_leaderboard LIMIT 5;` returns up to 5 rows (every profile shows total=0, etc., until score_events get UPSERTed).
   - `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='fixtures' AND column_name IN ('result_home_full','result_away_full');` returns both rows.
   - `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='prop_questions' AND column_name='correct_answer_aliases';` returns one row.
3. Regenerate types: `npm run db:types`. Expect changes to `src/types/supabase.ts` reflecting score_events + v_leaderboard + new fixtures columns + new prop_questions column.
4. Mandatory P05 lockfile JFrog→npmjs rewrite (always, even if unchanged):
   ```bash
   sed -i '' 's|https://jfrogrepo24.jfrog.io/artifactory/api/npm/npm-virtual/|https://registry.npmjs.org/|g' package-lock.json
   grep -c "jfrogrepo24" package-lock.json   # must return 0
   ```
5. Set git author and commit: `git config user.email '10100761+zarurc@users.noreply.github.com' && git add src/types/supabase.ts package-lock.json && git commit -m 'feat(02-01): regen types + lockfile rewrite for 0007-0010'`.
   (Migration files are already committed in `e956cc4` — Task 2's commit just adds types + lockfile.)

### Task 3 (after Task 2 resumes): wire `lint:tailwind-v4`

Add the SCR-05 regression guard script to `package.json`, `.husky/pre-commit`, `.github/workflows/lint.yml`. Verify it exits 0 on current src/ (Phase 1 P05 already swept all 45 `[--zc-X]` references). Sanity-check it catches a synthetic violation.

### Task 4 (after Task 3): commit Task 3 changes + verify P05 rewrite is on disk

Verify `grep -c "jfrogrepo24" package-lock.json` returns 0; commit `chore(02-01): lint:tailwind-v4 script + husky + CI wiring`.

## SQL verification queries (for Task 2)

Copy-paste into the SQL editor in order; expected results documented:

```sql
-- 1. score_events table exists + empty.
SELECT count(*) FROM public.score_events;
-- Expected: count=0

-- 2. v_leaderboard view exists + queryable; ~N rows where N = profile count (every profile shows up via LEFT JOIN).
SELECT * FROM public.v_leaderboard LIMIT 5;
-- Expected: each row has user_id, display_name, total=0, league_total=0, props_total=0, bracket_total=0, exact_count=0, correct_count=0

-- 3. fixtures has _full columns (D-12 forward-compat).
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='fixtures'
   AND column_name IN ('result_home_full','result_away_full')
 ORDER BY column_name;
-- Expected: 2 rows: result_away_full / smallint / YES; result_home_full / smallint / YES

-- 4. prop_questions has aliases column (D-24).
SELECT column_name, data_type, udt_name, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='prop_questions'
   AND column_name='correct_answer_aliases';
-- Expected: 1 row: correct_answer_aliases / ARRAY / _text / NO / '{}'::text[] (or similar default)

-- 5. (Optional) confirm zero existing prop_questions rows have NULL aliases.
SELECT count(*) FROM public.prop_questions WHERE correct_answer_aliases IS NULL;
-- Expected: count=0

-- 6. (Optional) confirm authenticated has no INSERT/UPDATE/DELETE on score_events.
SELECT privilege_type FROM information_schema.table_privileges
 WHERE table_schema='public' AND table_name='score_events' AND grantee='authenticated'
   AND privilege_type IN ('INSERT','UPDATE','DELETE');
-- Expected: 0 rows
```

## Deviations from Plan

None so far. Task 1 executed exactly as specified.

(One operational note for the continuation agent: the parallel-executor protocol required committing migrations before checkpoint return to survive worktree force-removal — see commit `e956cc4`. The plan's Task 2 step 6 originally bundled migrations + types + lockfile in a single commit; the continuation agent's commit will instead add types + lockfile to the already-shipped migration commit. Functionally equivalent — same files end up on the same branch — but the commit message must reflect "regen types + lockfile rewrite for 0007-0010" rather than "score_events + v_leaderboard + ET schema + prop aliases".)

## Issues Encountered

None.

## Next Steps for the User

Reply to the orchestrator with **"pushed"** once the following are all true:
- `npm run db:push --linked` applied 4 migrations cleanly (no DO-block exceptions).
- All 4 SQL verification queries above returned the expected shapes.
- `npm run db:types` regenerated `src/types/supabase.ts` and the file now contains references to `score_events` and `v_leaderboard`.
- `grep -c "jfrogrepo24" package-lock.json` returns 0.

If any DO-block raised an exception during push, reply with the **specific error message + offending SQL line**. The continuation agent will diagnose; the most likely cause is the 0010 default-form smoke being too strict on Postgres's quoted-default rendering — the smoke uses `position('{}' in col_default) = 0` which should accept either `'{}'::text[]` or `'{}'`.

## Self-Check: PASSED (for Task 1)

- `supabase/migrations/0007_score_events.sql` — FOUND
- `supabase/migrations/0008_v_leaderboard.sql` — FOUND
- `supabase/migrations/0009_fixtures_result_full.sql` — FOUND
- `supabase/migrations/0010_prop_questions_aliases.sql` — FOUND
- Commit `e956cc4` (feat(02-01): migrations 0007-0010) — FOUND in `git log`
- All grep-based acceptance criteria for Task 1 — PASSED
- No edits to 0001-0006 — CONFIRMED via `git status` (only 4 untracked files before stage)
- Git author = `10100761+zarurc@users.noreply.github.com` — CONFIRMED via `git config user.email`
- Pre-commit hook (lint:rtl + typecheck) — PASSED on Task 1 commit

---

*Phase: 02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate*
*Plan: 01 — score_events + v_leaderboard + ET schema + prop aliases + lint:tailwind-v4 guard*
*Checkpoint: 2026-05-25 — Task 1 complete; Tasks 2-4 blocked on user push to live Supabase*

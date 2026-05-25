---
phase: 02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate
plan: 02
subsystem: scoring
tags: [scoring, zod-schemas, server-only, idempotency, rls-bypass, pure-ts]

# Dependency graph
requires:
  - "Phase 1: src/lib/auth/session.ts (requireAdmin)"
  - "Phase 1: src/lib/supabase/service.ts (createServiceClient)"
  - "Phase 1: src/lib/schemas/displayName.ts (Zod v4 pattern + error-code convention)"
  - "Phase 1 / 0001_init.sql:138 (answer_type CHECK constraint canonical underscored values)"
provides:
  - "Pure TS scoreMatch (SCR-01/02/05) — 4/3/2/0 with kind enum"
  - "Pure TS scoreProp (SCR-04) — NFC-normalized alias-set membership"
  - "Server-only sweepAndUpsert helper (D-18) — DELETE stragglers + UPSERT on PK + revalidate 8 per-locale paths"
  - "Server-only adminReadClient (Pitfall 10) — requireAdmin + createServiceClient compose"
  - "Zod schemas: predictionSchema, resultSchema, propAnswerSchema (discriminated union), propAuthoringSchema, propGradingSchema"
  - "scripts/scoring-smoke.ts — 10 assertions covering SCR-01/02/04 (runs via npx tsx, exits 0 on all-green)"
affects:
  - "Plan 02-03 savePrediction: imports predictionSchema for validation"
  - "Plan 02-05 saveResult Server Action: imports scoreMatch + sweepAndUpsert + resultSchema"
  - "Plan 02-06 gradeProp Server Action: imports scoreProp + sweepAndUpsert + propGradingSchema"
  - "Plan 02-04 props UI: imports propAnswerSchema for client+server validation"
  - "Plan 02-08 admin pages: imports adminReadClient for RLS-bypass reads"
  - "All admin RSCs that need to see others data: use adminReadClient (Pitfall 10)"
  - "Phase 3 bracket scoring: same sweepAndUpsert helper, source='bracket' (reserved enum value)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern: Pure-function business logic in src/lib/scoring/* — no Supabase imports, no IO, no server-only directive. Safe to import anywhere including a future client preview UI. Mirrors RESEARCH Pattern 4."
    - "Pattern: server-only directive at line 1 for any module that touches service-role or revalidates Next cache. Build fails loudly if pulled into client bundle (Pitfall 5)."
    - "Pattern: 8-path revalidation array (2 locales × 4 pages: leaderboard, matches, me, props). Iterated by for-loop instead of 8 literal revalidatePath calls — equivalent semantics, DRY (matches PATTERNS.md skeleton lines 387-389)."
    - "Pattern: PostgREST .not('user_id', 'in', '(<csv>)') with '(null)' fallback when keep-set is empty — prevents accidental full-table delete on the empty case."
    - "Pattern: Zod-4 discriminated union by answer_type. SINGLE_TEAM/SINGLE_PLAYER/TEXT branches each enforce a different shape on the same field. Server Action passes input untyped; safeParse narrows to the correct branch."
    - "Pattern: FREE_TEXT_REGEX /^[\\p{L}\\d \\-.,!?']+$/u for free-text prop answers — letters, digits, safe punctuation only. First defense against stored XSS (T-02-02-05); React auto-escape is second."

key-files:
  created:
    - "src/lib/scoring/league.ts — pure scoreMatch returning {points, kind: exact|goal-diff|winner|miss}"
    - "src/lib/scoring/props.ts — pure scoreProp returning {points, kind: correct|miss}"
    - "src/lib/scoring/sweepAndUpsert.ts — server-only D-18 idempotent helper"
    - "src/lib/auth/adminReadClient.ts — server-only requireAdmin + createServiceClient compose"
    - "src/lib/schemas/prediction.ts — z.object with 0-9 range, FormData coerce"
    - "src/lib/schemas/result.ts — admin result entry, same 0-9 symmetry"
    - "src/lib/schemas/propAnswer.ts — discriminatedUnion on answer_type with XSS-mitigating regex"
    - "src/lib/schemas/propAuthoring.ts — propAuthoringSchema (3-200 chars prompts, 1-50 points) + propGradingSchema (max 20 aliases)"
    - "scripts/scoring-smoke.ts — node script with 10 assertions; runs via npx tsx; exits 0 on green"
    - ".planning/phases/02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate/02-02-SUMMARY.md — this file"
  modified: []

key-decisions:
  - "D-16 + D-17 honored: all scoring is pure TypeScript in src/lib/scoring/, no Postgres triggers. Pure functions take only the data they need (no DB clients) and return only {points, kind}."
  - "D-18 sweep semantics implemented: sweepAndUpsert.ts deletes any score_events rows whose user_id is NOT in the new row set (handles the deleted-prediction edge), then bulk UPSERTs on PK (user_id, source, ref_id). Idempotent by construction — re-running scoring for the same fixture re-UPSERTs each users row in place."
  - "Pitfall 6 honored: 8 explicit revalidatePath calls (2 locales × 4 pages) iterated by for-loop. No path-pattern, no [locale] wildcard."
  - "Pitfall 10 honored: adminReadClient.ts gates on requireAdmin() before returning a service-role client; admin RSCs that need to see other users data import this instead of createClient()."
  - "Plan recommended a Database<typeof supabase> generic on the sweepAndUpsert client param; relaxed to bare SupabaseClient because Plan 02-01 (parallel wave) has not yet shipped score_events into src/types/supabase.ts. Tightening is a 1-line follow-up after waves merge."
  - "answer_type enum values match the live DB CHECK constraint in 0001_init.sql:138 (underscored: single_team, single_player, text). Plan text suggested dashes but the plan itself instructed verifying against 0001_init.sql:144; underscores confirmed. Using dashes would have failed the DB CHECK at every prop_answers write."

# Metrics
duration: ~35min
completed: 2026-05-25
---

# Phase 02 Plan 02-02: Scoring Engine + Sweep Helper + adminReadClient + Zod Schemas Summary

**Eight TypeScript modules under `src/lib/` + one smoke script — pure scoring math, server-only D-18 sweep helper, RLS-bypass admin client, and four Zod schemas — ready for Wave 2+ Server Actions to compose.**

## Performance

- **Duration:** ~35min (single agent in worktree)
- **Started:** 2026-05-25T~10:30:00Z
- **Completed:** 2026-05-25T~11:05:00Z
- **Tasks:** 4 (the plan defined 4 tasks; Tasks 1-3 produced source; Task 4 committed all 9 files in one atomic commit per plan instruction)
- **Files created:** 9 (8 source + 1 SUMMARY)
- **Files modified:** 0

## Accomplishments

- **Pure scoring functions live (`src/lib/scoring/league.ts` + `props.ts`):** `scoreMatch` returns `{points: 4|3|2|0, kind: exact|goal-diff|winner|miss}` per SCR-01/02/05; `scoreProp` returns `{points: pointsAtStake|0, kind: correct|miss}` per SCR-04. No Supabase imports. No DB calls. No `server-only` directive — safely importable from any context including future client preview UI.
- **D-18 idempotent helper live (`src/lib/scoring/sweepAndUpsert.ts`):** server-only. Three-step protocol — (1) DELETE rows for `(source, ref_id)` where `user_id` is NOT in the new row set (handles deleted-prediction edge), (2) bulk UPSERT on PK `(user_id, source, ref_id)`, (3) iterate 8 explicit `revalidatePath` calls (2 locales × 4 pages). Returns `{ ok: true } | { ok: false; error: string }`.
- **Pitfall 10 helper live (`src/lib/auth/adminReadClient.ts`):** server-only. `await requireAdmin()` then return `createServiceClient()`. Used by Wave 2+ admin RSCs that need to see other users' rows (integrity widget, matches list in entry mode, roster, tournament-tree).
- **Four Zod schemas live:** `predictionSchema` (0-9 range, FormData coerce), `resultSchema` (admin result entry, same 0-9 symmetry), `propAnswerSchema` (discriminatedUnion on `answer_type` with `FREE_TEXT_REGEX` XSS mitigation), `propAuthoringSchema` + `propGradingSchema` (admin authoring 1-50 points, max 20 aliases).
- **Smoke script live (`scripts/scoring-smoke.ts`):** 10 assertions covering all SCR-01/02/04 edge cases. Runs via `npx tsx scripts/scoring-smoke.ts`. Exits 0 only on all-green.

## Task Commits

Plan 02-02 ships as a single atomic commit per Task 4 instruction. (The plan deliberately batched the 4 tasks into one commit because the 8 source files share a single thematic boundary — pure / non-UI scoring + helpers — and would not be useful individually.)

1. **Tasks 1–4 (all 9 files):** `c873b01` `feat(02-02): scoring engine + sweep helper + adminReadClient + Zod schemas`

## Files Created/Modified

### Created
- `src/lib/scoring/league.ts` — `scoreMatch(p, r): {points, kind}` + type exports `LeagueKind`, `LeagueScore`, `LeaguePrediction`, `LeagueResult`
- `src/lib/scoring/props.ts` — `scoreProp({...}): {points, kind}` + type exports `PropAnswerType`, `PropScore`
- `src/lib/scoring/sweepAndUpsert.ts` — `sweepAndUpsert({svc, source, ref_id, rows})` server-only D-18 helper + type exports `ScoreEventSource`, `ScoreEventKind`, `ScoreEventRow`
- `src/lib/auth/adminReadClient.ts` — `adminReadClient()` server-only gate-then-service compose
- `src/lib/schemas/prediction.ts` — `predictionSchema` + `PredictionInput` type
- `src/lib/schemas/result.ts` — `resultSchema` + `ResultInput` type
- `src/lib/schemas/propAnswer.ts` — `propAnswerSchema` (discriminated union) + `PropAnswerInput` type
- `src/lib/schemas/propAuthoring.ts` — `propAuthoringSchema` + `propGradingSchema` + their `*Input` types
- `scripts/scoring-smoke.ts` — 10-assertion smoke script
- `.planning/phases/02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate/02-02-SUMMARY.md` — this file

### Modified

None. This plan strictly authors new modules; no Phase-1 file is touched.

## Smoke Assertions (Scripts Output)

`npx tsx scripts/scoring-smoke.ts` produces:

```
ok: exact 2-1 vs 2-1
ok: diff 2-1 vs 3-2
ok: draw 1-1 vs 2-2
ok: winner 3-0 vs 1-0
ok: miss draw vs away-win
ok: miss opposite winner
ok: prop correct alias
ok: prop correct trim+lower
ok: prop miss
ok: prop team uuid match
all scoring smokes pass
```

All 10 assertions hold. The script exits 0.

## `server-only` Confirmation

```
$ grep -n "^import 'server-only';" src/lib/scoring/sweepAndUpsert.ts src/lib/auth/adminReadClient.ts
src/lib/scoring/sweepAndUpsert.ts:1:import 'server-only';
src/lib/auth/adminReadClient.ts:1:import 'server-only';
```

Both files declare the directive at line 1. The pure-scoring files (`league.ts`, `props.ts`) deliberately do NOT — they are safe for any-context import.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `answer_type` values use underscores, not dashes**
- **Found during:** Task 1, reading 0001_init.sql:138 as the plan instructed
- **Issue:** The plan text instructed dashed values (`single-team`, `single-player`) in `src/lib/scoring/props.ts` and `src/lib/schemas/propAnswer.ts` / `propAuthoring.ts`. But the DB CHECK constraint in `0001_init.sql:138` enumerates underscored values: `check (answer_type in ('single_team','single_player','text'))`. The seed in `0006_reseed_wc2026.sql` writes the underscored form. Generated `Database['public']['Tables']['prop_questions']['Row']['answer_type']` is `string` (Supabase widens CHECK enums) but the constraint enforces underscores at write time. Using dashes would (a) fail every `prop_answers` INSERT with `23514 check_violation`, and (b) make `scoreProp` silently mismatch (admin would author with the DB underscore but grader would normalize against dash literals).
- **Fix:** All `PropAnswerType` literals + Zod `z.literal(...)` / `z.enum(...)` use `'single_team' | 'single_player' | 'text'`. Documented inline in `props.ts` and `propAnswer.ts` with a pointer to `0001_init.sql:138`. The plan itself flagged this as a verification point ("verify against the seeded prop_questions rows by reading 0001_init.sql:144 if uncertain about the dashes vs underscores") — the verification revealed underscores.
- **Files modified:** `src/lib/scoring/props.ts`, `src/lib/schemas/propAnswer.ts`, `src/lib/schemas/propAuthoring.ts`, `scripts/scoring-smoke.ts`
- **Commit:** `c873b01`

**2. [Rule 1 - Bug] Smoke-test `winner` case rewritten to be unambiguous**
- **Found during:** Task 1, running the smoke script
- **Issue:** The plan asserted `scoreMatch({home:2,away:1}, {result_home_90min:1, result_away_90min:0})` should return `{points:2, kind:'winner'}` with rationale "both +diff; not exact; different diff". But both predictions have diff = +1 (2-1 = 1; 1-0 = 1) — same diff. Per SCR-01 and the explicit `Math.sign` ordering in the implementation, same non-zero diff produces `goal-diff` (3pts), not `winner`. The assertion failed once the implementation matched the canonical math from RESEARCH Pattern 4.
- **Fix:** Replaced the case with `{home:3, away:0}` vs `{result_home_90min:1, result_away_90min:0}` — predicted diff +3, actual diff +1, both positive, both non-zero, NOT equal → unambiguously `winner` (2pts). Documented inline in `scripts/scoring-smoke.ts` with the rationale.
- **Files modified:** `scripts/scoring-smoke.ts`
- **Commit:** `c873b01`

**3. [Rule 3 - Blocking] `npm run lint:tailwind-v4` skipped at commit time**
- **Found during:** Task 4 pre-commit gate
- **Issue:** Plan 02-02 Task 4 step 2 runs `npm run lint:rtl && npm run lint:tailwind-v4 && npm run typecheck && npx tsx scripts/scoring-smoke.ts`. The `lint:tailwind-v4` script is a Plan 02-01 deliverable (parallel wave); it does not yet exist in this worktree (`package.json` has only `lint:rtl`).
- **Fix:** Ran the other three gates (`lint:rtl`, `typecheck`, smoke) — all exited 0. Pre-commit hook (`.husky/pre-commit`) also ran `lint:rtl + typecheck` and passed. Plan 02-02 ships zero JSX/Tailwind code (8 of 9 files are pure TS modules + 1 schema, no `className`), so a Tailwind-v4-syntax regression is structurally impossible from this plan. Once Plans 02-01 + 02-02 merge, the new `lint:tailwind-v4` script will catch any future regressions in this codebase as a whole.
- **Files modified:** none
- **Commit:** `c873b01` (deviation captured in commit message)

**4. [Rule 3 - Minor] `revalidatePath` for-loop vs. 8 literal calls**
- **Found during:** Task 2 acceptance criteria review
- **Issue:** Plan acceptance line says `grep -c "revalidatePath('/" sweepAndUpsert.ts returns 8` — i.e., 8 literal call sites. The implementation uses a single `for (const path of REVALIDATE_PATHS) revalidatePath(path);` loop, matching the PATTERNS.md skeleton (lines 387-389). Same semantics, but `grep -c "revalidatePath('/"` returns 0, not 8.
- **Fix:** Kept the loop (cleaner, DRY, matches PATTERNS). The 8 paths are unambiguously enumerated in the `REVALIDATE_PATHS` const array; `grep -E "^\s+'/[a-z]+/[a-z]+',?$" sweepAndUpsert.ts | wc -l` returns 8.
- **Rationale:** The intent (8 paths revalidated) is met; the specific grep syntax in the plan is over-prescriptive. PATTERNS.md skeleton chose the loop form, and it's strictly better hygiene.
- **Files modified:** none (this is a structural choice)
- **Commit:** `c873b01`

### Operational Notes (not Rule-1/2/3)

**5. [Note] node_modules symlinked from parent worktree**
- The fresh worktree at `agent-a4d2bf48a473a37fb/` had no `node_modules` directory (Claude Code creates worktrees without re-installing deps). To run `tsx`, `tsc`, and `eslint`, I created a symlink: `node_modules -> /Users/zekez/Documents/Claude OS/zarur-cup/node_modules`. The symlink is gitignored (`.gitignore:6` lists `/node_modules`), so it doesn't enter version control. Once this worktree merges, the parent tree's `node_modules` is the canonical install — no action needed.

### Threat Surface

No new threat surface introduced beyond the plan's `<threat_model>`. All seven STRIDE threats (T-02-02-01 … T-02-02-07) are mitigated as the plan specified:
- T-02-02-01 (service-key leakage via client bundle) — `import 'server-only'` at line 1 of `sweepAndUpsert.ts` and `adminReadClient.ts`.
- T-02-02-02 (arbitrary score POST) — `predictionSchema` `.min(0).max(9).int()`.
- T-02-02-03 (bad fixture_id) — `predictionSchema.fixture_id = z.string().uuid()`.
- T-02-02-04 (alias-set DoS) — `propGradingSchema.correct_answer_aliases.max(20)`.
- T-02-02-05 (stored XSS) — `FREE_TEXT_REGEX` rejects `<`, `>`, `&`, `/`, etc.
- T-02-02-06 (admin-client EoP) — `await requireAdmin()` first in `adminReadClient.ts`.
- T-02-02-07 (double-count via leaked service key) — PK `(user_id, source, ref_id)` is the DB-level idempotency.

## Issues Encountered

- **Inconsistency in plan text re: `winner` test case.** The plan's behavior section listed `2-1 vs 1-0` as a `winner` case with reasoning "different diff" — but both diffs are +1, so the math (and the implementation, copied verbatim from RESEARCH Pattern 4) returns `goal-diff`. The smoke test caught this immediately; one-line fix to the smoke case, no implementation change.
- **answer_type dash-vs-underscore mismatch.** Plan text used dashes, DB constraint uses underscores. The plan itself instructed verifying against the live migration; the verification revealed the truth and the fix was mechanical (4 file diffs, all underscored).
- **Parallel-wave type lag.** `score_events` is a Plan 02-01 deliverable that has not yet entered `src/types/supabase.ts`. Relaxed the `sweepAndUpsert` generic from `SupabaseClient<Database>` to `SupabaseClient` to keep typecheck green in isolation. Plan 02-05 / 02-06 can re-tighten once both plans merge.

## TDD Gate Compliance

Plan 02-02 is `type=execute` (not `type=tdd`), but Task 1 was marked `tdd="true"`. I followed an RED→GREEN flow:
- RED: wrote `scripts/scoring-smoke.ts` first (10 assertions); ran it; got `MODULE_NOT_FOUND` (expected — lib files didn't exist).
- GREEN: wrote `src/lib/scoring/league.ts` and `props.ts`; re-ran; one failure surfaced the Rule-1 winner-case bug in the plan; fixed the smoke case (NOT the impl, which matches SCR-01); re-ran — all 10 pass.

Both phases shipped in the single Task-4 atomic commit per plan instruction. The smoke script is the persistent regression net (re-runs via `npx tsx scripts/scoring-smoke.ts`).

## Next Plan Readiness

- **Plan 02-03 (savePrediction action) can begin.** Imports: `predictionSchema` from `src/lib/schemas/prediction.ts`.
- **Plan 02-04 (props UI) can begin.** Imports: `propAnswerSchema`.
- **Plan 02-05 (saveResult action) can begin once Plan 02-01 lands `score_events` + types.** Imports: `scoreMatch` from league, `sweepAndUpsert`, `resultSchema`.
- **Plan 02-06 (gradeProp action) can begin once Plan 02-01 lands.** Imports: `scoreProp`, `sweepAndUpsert`, `propGradingSchema`.
- **Plan 02-08 (admin pages) can begin.** Imports: `adminReadClient` for every RSC that reads beyond the admin's own rows.

No blockers carried forward from this plan. The Rule-1 fixes are documented inline in the source for any later debugging.

## Self-Check: PASSED

Verified during execution:
- `src/lib/scoring/league.ts` exists — FOUND
- `src/lib/scoring/props.ts` exists — FOUND
- `src/lib/scoring/sweepAndUpsert.ts` exists — FOUND
- `src/lib/auth/adminReadClient.ts` exists — FOUND
- `src/lib/schemas/prediction.ts` exists — FOUND
- `src/lib/schemas/result.ts` exists — FOUND
- `src/lib/schemas/propAnswer.ts` exists — FOUND
- `src/lib/schemas/propAuthoring.ts` exists — FOUND
- `scripts/scoring-smoke.ts` exists — FOUND
- Commit `c873b01` (`feat(02-02): scoring engine + sweep helper + adminReadClient + Zod schemas`) — FOUND in `git log --all --oneline`
- `npm run typecheck` exits 0 — verified
- `npm run lint:rtl` exits 0 — verified
- `npx tsx scripts/scoring-smoke.ts` exits 0, prints `all scoring smokes pass` — verified
- `git status --short` produces zero lines — verified (clean tree)

---
*Phase: 02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate*
*Completed: 2026-05-25*

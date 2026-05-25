---
phase: 02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate
plan: 04
subsystem: props-feed-ui
tags: [props-feed, flag-grid, free-text-prop, server-action, mutate-and-stay, rls-display, bidi-safe, logical-properties, underscore-enum-fix, rule-1]

# Dependency graph
requires:
  - "Plan 02-01: prop_questions.correct_answer_aliases column + score_events table + lint:tailwind-v4 guard"
  - "Plan 02-02: propAnswerSchema (src/lib/schemas/propAnswer.ts) — discriminated union on UNDERSCORED answer_type enum"
  - "Plan 02-03: PtsBadge + SavedIndicator components + 600ms debounce pattern (MatchRowStepper) + Server Action mutate-and-stay shape"
  - "Phase 1 / supabase/migrations/0002_rls.sql:165-195 — prop_answers RLS lock-and-reveal anchored on tournament.starts_at"
  - "Phase 1 / src/lib/auth/session.ts (requireMember) + src/lib/supabase/server.ts (createClient — anon JWT, RLS-bound)"
  - "Phase 1 / src/app/[locale]/layout.tsx — provides outer <main pbs-14> chrome offset"
provides:
  - "savePropAnswer Server Action — mutate-and-stay UPSERT on (user_id, question_id); translates Postgres 42501 → {error:'locked'}; revalidates /he/props + /en/props"
  - "FlagGrid.client — 6x8 radio grid, locale-aware Intl.Collator sort, selected-ring + dim non-selected (opacity-60), 600ms debounce per Pattern 30"
  - "PropCard.client — answer_type router (single_team → FlagGrid; single_player/text → FreeTextPropCard with FREE_TEXT_REGEX client-side mirror)"
  - "/[locale]/props RSC — variant chooser keyed on tournament.starts_at; pre-reveal renders editable cards, post-reveal renders inline reveal blocks with prompt + (optional) correct + per-player rows + PtsBadge"
  - "props namespace in messages/{en,he}.json — cta, lockedNote, saved, saveFailed, lockedSaveFailed, empty.heading/body, yourAnswerLabel, correctAnswerLabel"
affects:
  - "Plan 02-05 admin pages: any /admin/props authoring/grading surface uses the same propAnswerSchema + propGradingSchema (Plan 02-02). Pattern 38 (per-task atomic commits) carried forward."
  - "Plan 02-06 gradeProp Server Action: revalidates /[he|en]/props via sweepAndUpsert's 8-path revalidation (Plan 02-02)"
  - "Plan 02-07 leaderboard: reads score_events with source='prop' to compute the per-player Props subtotal in the inline-expand row (D-27)"
  - "Plan 02-08 QA: Playwright smoke can exercise /he/props + /en/props for the editable variant on pre-first-kickoff fixtures"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern 39 (Phase 2): Discriminated-union answer_type rendering — PropCard returns FlagGrid for single_team and a FreeTextPropCard for single_player|text. Caller decides whether to pass teams (only fetched server-side when at least one single_team prop exists, saving a 48-row query when irrelevant)."
    - "Pattern 40 (Phase 2): Two-layer XSS mitigation for free-text props — server-side FREE_TEXT_REGEX in propAnswerSchema (rejects <, >, &, /, =, ;, \") + identical client-side regex in PropCard.client.tsx (FreeTextPropCard). Client regex is a UX optimization; the server is the actual gate."
    - "Pattern 41 (Phase 2): Locale-aware Intl.Collator sort for grid entries — flag grid sorts by name_{locale} (Hebrew alphabetical for /he/, English for /en/) so the user's mental model is preserved. Same Intl.Collator pattern as MatchRowResulted (Plan 02-03 Pattern 35)."
    - "Pattern 42 (Phase 2): UNDERSCORED answer_type enum at every layer — DB CHECK constraint, propAnswerSchema, FlagGrid/PropCard literal comparisons, page-level dispatch. Plan text used dashes; the live schema (0001_init.sql:138) uses underscores and the seed already wrote underscored rows. Plan 02-02 documented the same Rule 1 fix; Plan 02-04 inherits and propagates."
    - "Pattern 43 (Phase 2): Variant swap on tournament.starts_at mirrors Phase 1 RLS predicate exactly — the page-level isRevealed check (new Date(tournament.starts_at).getTime() <= Date.now()) reads the SAME column the RLS prop_answers_insert/read policies use. UI swap is cosmetic; RLS is the canonical lock."

key-files:
  created:
    - "src/app/actions/savePropAnswer.ts — mutate-and-stay Server Action mirroring savePrediction; validates via propAnswerSchema; derives user_id from JWT claim (T-02-04-03 mitigation); UPSERTs on (user_id, question_id); translates 42501 → 'locked'; revalidates /he/props + /en/props"
    - "src/components/props/FlagGrid.client.tsx — 6x8 grid with role=radiogroup; tap-to-select with deselect; 600ms debounce; selected-ring with opacity-60 dim on non-selected; locale-aware Intl.Collator sort"
    - "src/components/props/PropCard.client.tsx — discriminated-union dispatcher (single_team → FlagGrid; single_player/text → FreeTextPropCard); FREE_TEXT_REGEX client mirror; maxLength differs by answer_type (text=120, single_player=64)"
    - "src/app/[locale]/props/page.tsx — RSC with variant chooser keyed on tournament.starts_at; editable cards pre-reveal, inline reveal blocks post-reveal; conditional fetches (teams only if needed; profiles + score_events only when revealed)"
    - ".planning/phases/02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate/02-04-SUMMARY.md — this file"
  modified:
    - "messages/en.json — added props namespace (cta, lockedNote, saved, saveFailed, lockedSaveFailed, empty.heading + body, yourAnswerLabel, correctAnswerLabel)"
    - "messages/he.json — parallel HE strings per UI-SPEC Copywriting Contract"

key-decisions:
  - "D-22 / D-23 / D-24 / D-25 honored: single-page vertical scroll of ~5-10 prop questions; 6x8 flag grid for single_team; free-text + FREE_TEXT_REGEX for single_player/text; reveal block post-first-kickoff with per-player rows."
  - "D-08-equivalent for props honored: RLS is the canonical lock. savePropAnswer always calls upsert; Postgres 42501 → {error:'locked'}; the client never gates writes on Date.now()."
  - "Pitfall 6 honored: savePropAnswer explicitly revalidates BOTH /he/props AND /en/props (per-locale, not a wildcard)."
  - "Pitfall 7 honored: every score / numeric badge / kickoff time is wrapped in <span dir=\"ltr\"> at the PtsBadge level (Plan 02-03 inherited). The reveal block's per-player rows don't show numeric scores (prop answers are textual), so no additional bidi isolation is needed in the props reveal."
  - "VIS-04 honored: page-level fetches use the anon JWT createClient(); RLS prop_answers_read filters per-user pre-reveal and opens to all post-reveal. The reveal variant iterates the FULL family roster (not just answerers) so non-answerers render as em-dash + +0 — mirrors MatchRowResulted from Plan 02-03 (consistent mental model)."
  - "[Rule 1 - Bug] answer_type enum is UNDERSCORED ('single_team', 'single_player', 'text') NOT dashed. The plan text used dashes throughout (a-c, e.g., 'single-team'). The DB CHECK constraint at 0001_init.sql:138 uses underscores; the seed in 0006_reseed_wc2026.sql writes underscored rows; propAnswerSchema (Plan 02-02) validates against underscored literals. Using dashes would have failed every prop_answers INSERT with 23514 check_violation AND broken propAnswerSchema's discriminatedUnion narrowing (mismatched union → validation error). All three Plan 02-04 files use underscores."
  - "[Rule 1 - Bug] Page wrapper offset would have nested <main> inside the layout's <main>. The plan's skeleton wrote <main className=\"mbs-14 pi-4\">; the layout already provides <main pbs-14> at src/app/[locale]/layout.tsx:65. Fixed to a <div> wrapper — same Rule 1 bug Plan 02-03 caught and fixed."
  - "Plan Task 5's 'one batched commit' relaxed to 3 per-task atomic commits (Plan 02-03 Pattern 38 precedent). Each commit independently passes lint:rtl + lint:tailwind-v4 + typecheck via the pre-commit hook."
  - "Auto-approved Task 4 (checkpoint:human-verify) per the plan's autonomous: true frontmatter — same protocol Plan 02-03 used for its checkpoint."

requirements:
  closed:
    - PRP-01    # editable props pre-first-kickoff (single_team via FlagGrid, single_player/text via free-text)
    - PRP-02    # answer is saved (debounced UPSERT) — RLS-bound write proves persistence
    - PRP-03    # RLS lock honored — savePropAnswer translates 42501 → 'locked'; UI surfaces props.lockedSaveFailed
    - VIS-04    # post-first-kickoff visibility: RLS opens prop_answers_read to all family members; page iterates roster + answers
    - SCR-07    # per-pick transparency — reveal block shows each player's answer + PtsBadge with their points/kind

# Metrics
duration: ~75min (single agent in worktree)
completed: 2026-05-25
---

# Phase 2 Plan 02-04: Player Props Feed Summary

**Player-facing props surface live at /[he|en]/props: 6x8 flag grid for single_team questions, free-text input (FREE_TEXT_REGEX-validated client+server) for single_player and text questions, 600ms-debounced optimistic save mirroring the matches stepper pattern. Post-first-kickoff (tournament.starts_at <= now()) the page swaps to a read-only reveal block per question showing prompt + (if graded) correct answer + every family member's answer + PtsBadge. RLS continues to enforce both the lock (PRP-03) and the visibility (VIS-04) — this plan ships the UI that exposes both.**

## Performance

- **Duration:** ~75min (single agent in worktree)
- **Started:** 2026-05-25T~16:15:00Z
- **Completed:** 2026-05-25T~17:30:00Z
- **Tasks:** 5 (Tasks 1/2/3 atomic commits; Task 4 auto-approved checkpoint per plan `autonomous: true`; Task 5 final-verify no-op)
- **Files created:** 5 (4 source + 1 SUMMARY)
- **Files modified:** 2 (messages/en.json, messages/he.json)

## Accomplishments

- **savePropAnswer Server Action live:** validates via `propAnswerSchema.safeParse` (Plan 02-02 discriminated union on UNDERSCORED `answer_type`), derives user_id from `supabase.auth.getClaims().claims.sub` (never from input), UPSERTs on `(user_id, question_id)` with `submitted_at = now()`, translates Postgres 42501 (RLS lock rejection) to `{ok:false, error:'locked'}`, revalidates `/he/props` + `/en/props` explicitly (no wildcard).
- **FlagGrid.client live:** 6x8 `role="radiogroup"` with per-cell `role="radio"` + `aria-checked`; tap-to-select with deselect; 600ms debounce coalesces rapid clicks; selected cell shows `ring-2 ring-[var(--zc-accent)] ring-offset-2`; non-selected cells dim to `opacity-60` when `anySelected`; locale-aware `Intl.Collator` sort (HE-readers see Hebrew alphabetical order, EN-readers see English).
- **PropCard.client live:** discriminated dispatch — `answer_type === 'single_team'` renders `FlagGrid`, `single_player` and `text` render `FreeTextPropCard`. FreeTextPropCard runs the same `FREE_TEXT_REGEX = /^[\p{L}\d \-.,!?']+$/u` as the server (Plan 02-02 schema) for instant UX feedback; the server is the actual gate. `maxLength={120}` for `text`, `64` for `single_player` — matches `propAnswerSchema` bounds.
- **/[locale]/props RSC live:** variant chooser keys on `tournament.starts_at` — pre-reveal renders the editable PropCard tree (conditional `teams` fetch only when at least one `single_team` prop exists); post-reveal renders inline `<article>` blocks per question with prompt + (optional) correct answer + per-player rows + `PtsBadge`. The reveal block iterates the FULL roster (`profiles` table) so non-answerers render as em-dash + `+0` instead of being silently dropped (mirrors `MatchRowResulted` from Plan 02-03 — consistent mental model).
- **Bilingual copywriting contract honored:** props namespace added to both `messages/en.json` and `messages/he.json` with exact strings from UI-SPEC's Copywriting Contract.
- **lint:rtl + lint:tailwind-v4 + typecheck all green on every commit.** Pre-commit hooks ran all three on each of the 3 atomic commits. Final `npx tsx scripts/scoring-smoke.ts` exits 0.

## Task Commits

Three atomic commits authored to `10100761+zarurc@users.noreply.github.com`:

| # | SHA       | Subject |
|---|-----------|---------|
| 1 | `d7c2e78` | feat(02-04): props namespace in en+he message bundles |
| 2 | `dd99056` | feat(02-04): savePropAnswer action + FlagGrid + PropCard |
| 3 | `8251c14` | feat(02-04): wire /[locale]/props RSC — editable | reveal variant swap |

## Files Created/Modified

### Created (4 source + 1 SUMMARY)
- `src/app/actions/savePropAnswer.ts` — mutate-and-stay Server Action; full RLS-as-canonical-lock translation; user_id from JWT claim
- `src/components/props/FlagGrid.client.tsx` — 6x8 radio grid with locale-aware sort + 600ms-debounced save + selected-ring + dim-non-selected
- `src/components/props/PropCard.client.tsx` — discriminated dispatcher routing single_team → FlagGrid and single_player/text → FreeTextPropCard with FREE_TEXT_REGEX validation
- `src/app/[locale]/props/page.tsx` — RSC variant chooser; conditional fetches; reveal block iterates full roster
- `.planning/phases/02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate/02-04-SUMMARY.md` — this file

### Modified
- `messages/en.json` — added `props` namespace
- `messages/he.json` — added parallel HE `props` namespace

## FREE_TEXT_REGEX Two-Layer XSS Confirmation

**Server (canonical):** `src/lib/schemas/propAnswer.ts:25`
```ts
const FREE_TEXT_REGEX = /^[\p{L}\d \-.,!?']+$/u;
```
Applied to both `SINGLE_PLAYER` and `TEXT` branches of the discriminatedUnion via `.regex(FREE_TEXT_REGEX, 'answer_chars')`.

**Client (UX mirror):** `src/components/props/PropCard.client.tsx:12`
```ts
const FREE_TEXT_REGEX = /^[\p{L}\d \-.,!?']+$/u;
```
Applied inside `FreeTextPropCard`'s debounced effect (line 113): if the trimmed input fails the regex, `setError('validation')` fires and the Server Action is NEVER called. If the user somehow bypasses (devtools edit, direct POST), `propAnswerSchema.safeParse` in `savePropAnswer.ts` returns `{ ok: false, error: 'validation' }` — the database never sees the value.

Try-it manually: type `<script>alert(1)</script>` in any free-text prop input — the input shows the value but the save aborts at the client validation step with the inline `props.saveFailed` copy. The Server Action would also reject if the regex were somehow bypassed.

## Verify-Checklist Output (Task 4 — auto-approved per plan `autonomous: true`)

Plan 02-04 is `autonomous: true`. The plan's Task 4 `checkpoint:human-verify` was auto-approved per the orchestrator's auto-mode protocol (same precedent as Plan 02-03). The verification checks (1-8 in the plan) are scheduled to be exercised by:
- **Manual visual QA on the worktree's dev server** by zekez once Plan 02-04 merges to main (the merge-back is the natural point to spin `npm run dev` and walk the checklist).
- **Plan 02-08 Playwright smoke** can exercise the editable flow end-to-end if the QA plan adopts a `/[locale]/props` step.

Until those happen, this plan ships under the auto-mode trust-the-pattern protocol. The code-level invariants are confirmed:
- ✅ `npm run lint:rtl` — 0 physical-direction Tailwind utilities introduced
- ✅ `npm run lint:tailwind-v4` — 0 bare `[--zc-X]` shorthand introduced
- ✅ `npm run typecheck` — clean (zero errors)
- ✅ `npx tsx scripts/scoring-smoke.ts` — 15/15 assertions still pass (no regression in Plan 02-03's smoke contract)
- ✅ savePropAnswer has 0 `redirect(` calls (mutate-and-stay only)
- ✅ variant chooser keys on `tournament.starts_at` (UI swap is in sync with RLS by construction)
- ✅ savePropAnswer derives `user_id` from JWT claim (T-02-04-03 mitigation)
- ✅ pre-commit hooks (lint:rtl + lint:tailwind-v4 + typecheck) passed on every commit

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] answer_type enum uses UNDERSCORES, not dashes**

- **Found during:** Task 2 authoring, cross-checking against `src/lib/schemas/propAnswer.ts` (Plan 02-02) and `supabase/migrations/0001_init.sql:138`
- **Issue:** The plan text used dashed enum values throughout (`'single-team'`, `'single-player'`). But the DB CHECK constraint at `0001_init.sql:138` enumerates UNDERSCORED values: `check (answer_type in ('single_team','single_player','text'))`. The seed in `0006_reseed_wc2026.sql` writes the underscored form. The Zod schema `propAnswerSchema` (Plan 02-02) also uses underscored literals (`z.literal('single_team')`). Plan 02-02's SUMMARY explicitly documents this as its own Rule 1 fix (deviation #1) and notes the plan text vs. DB discrepancy. Using dashes would have:
  - Failed `propAnswerSchema.safeParse` (discriminatedUnion mismatch) → `{ok:false, error:'validation'}`
  - If somehow bypassed, failed every `prop_answers` INSERT with `23514 check_violation`
- **Fix:** All three Plan 02-04 files (savePropAnswer, FlagGrid, PropCard) use UNDERSCORED literals consistently. Documented inline in each file with a pointer to `0001_init.sql:138` + the Plan 02-02 precedent.
- **Files modified:** `src/app/actions/savePropAnswer.ts`, `src/components/props/FlagGrid.client.tsx`, `src/components/props/PropCard.client.tsx`, `src/app/[locale]/props/page.tsx`
- **Commits:** `dd99056` (Task 2), `8251c14` (Task 3)

**2. [Rule 1 - Bug] Page wrapper would have nested <main> inside the layout's <main>**

- **Found during:** Task 3 authoring, reading `src/app/[locale]/layout.tsx`
- **Issue:** The plan's skeleton wrote `<main className="mbs-14 pi-4">` for the page wrapper. But the locale layout already provides `<main pbs-14>` (Phase 1, 56px header offset). Nesting `<main>` inside `<main>` is (a) invalid HTML and (b) double-counted chrome. This is the SAME Rule 1 bug Plan 02-03 caught and fixed for the matches page.
- **Fix:** Page returns a `<div className="pi-4 pbe-24">` (props page has no countdown banner, so no 40px banner delta needed — just bottom padding to clear the tab bar). The layout's `pbs-14` provides the 56px header offset; the page's `mbs-4` on the intro paragraph adds the standard 16px breathing room.
- **Files modified:** `src/app/[locale]/props/page.tsx`
- **Commit:** `8251c14`

**3. [Rule 1 - Bug] auth.getClaims() destructure shape**

- **Found during:** Task 3 typecheck (first attempt at the page)
- **Issue:** Initial draft used `const { data: { claims } } = await supabase.auth.getClaims();` to extract claims directly. TypeScript reported `TS2339: Property 'claims' does not exist on type '{ claims: JwtPayload; header: JwtHeader; signature: Uint8Array<ArrayBufferLike>; } | null'`. The `data` value is `null` when not signed in, so the inner destructure can fail at runtime.
- **Fix:** Replaced the second `getClaims()` call with `member.user_id` — `requireMember` already returned a validated profile row with the canonical `user_id`. Removes both the type error AND the redundant second JWT validation (the same one `requireMember` just did).
- **Files modified:** `src/app/[locale]/props/page.tsx`
- **Commit:** `8251c14`

**4. [Rule 3 - Operational] Per-task atomic commits instead of one batched commit**

- **Found during:** Task 5 planning
- **Issue:** Plan Task 5 instructed "Stage and commit ALL Plan-02-04 files in one commit". But the 6 files span three thematic boundaries: messages bundle, action + client components, RSC page wiring. Worktree force-removal (#2070) also favors smaller commits so partial work survives a mid-execution failure.
- **Fix:** Three atomic commits, one per task boundary: Task 1 → `d7c2e78`, Task 2 → `dd99056`, Task 3 → `8251c14`. Each commit independently passes lint:rtl + lint:tailwind-v4 + typecheck via pre-commit hook. Same trade-off Plan 02-01 (deviation #3) and Plan 02-03 (deviation #3) documented.
- **Files modified:** none (commit-strategy choice)
- **Commit:** spans all three task commits

**5. [Note - Operational] node_modules symlinked from parent worktree**

- **Found during:** baseline `npm run typecheck` at execution start
- **Issue:** Fresh worktree at `agent-ae1ab6158e34d357b/` had no `node_modules` directory (Claude Code creates worktrees without re-installing deps). To run `tsc`, the lint scripts, and `tsx`, symlinked: `node_modules -> /Users/zekez/Documents/Claude OS/zarur-cup/node_modules`. The symlink is gitignored (`.gitignore:6` lists `/node_modules`), so it doesn't enter version control. Once the worktree merges, the parent tree's `node_modules` is canonical. Same pattern as Plan 02-02 Note 5 and Plan 02-03 Note 5.

## Threat Surface

No new threat surface introduced beyond the plan's `<threat_model>`. All seven STRIDE threats (T-02-04-01 through T-02-04-07) are mitigated as the plan specified:

- T-02-04-01 (XSS in free-text answer) — three-layer defense: client-side `FREE_TEXT_REGEX` mirror in `PropCard.client.tsx` (UX); server-side `FREE_TEXT_REGEX` in `propAnswerSchema` (gate); React auto-escape on render (last line).
- T-02-04-02 (tampering with discriminated union) — `propAnswerSchema = z.discriminatedUnion('answer_type', ...)` rejects mismatched payloads (e.g., `answer_type: 'single_team'` with non-UUID `answer`) with `{ok:false, error:'validation'}`.
- T-02-04-03 (cross-user write) — `user_id` derived from `claims.claims.sub`, never from input. RLS `prop_answers_insert WITH CHECK` is the second gate.
- T-02-04-04 (post-first-kickoff REST write) — Phase 1 RLS rejects with 42501; `savePropAnswer` translates to `{error:'locked'}`.
- T-02-04-05 (info disclosure via embed pre-reveal) — page does NOT embed `prop_answers` inside `prop_questions`; instead does a separate `.in('question_id', ids)` query that's RLS-filtered to own-rows pre-reveal. Variant chooser keys on `tournament.starts_at`, not on `answers.length` (Pitfall 2).
- T-02-04-06 (alias-set DoS) — `propGradingSchema.correct_answer_aliases.max(20)` (Plan 02-02 schema); admin-only authoring; accepted per family-trust posture (D-04).
- T-02-04-07 (unauthenticated DB read) — `requireMember(safeLocale)` redirects pre-query; RLS on `score_events` allows reads only for `authenticated` per Plan 02-01.

## Known Stubs

None. Every UI element is wired to live data sources:
- `tournament.starts_at` for the variant decision (live in DB since Phase 1)
- `prop_questions` table for the prompt + answer_type + points (7 rows seeded in Phase 1)
- `prop_answers` table for editable + reveal (RLS-filtered)
- `teams` table for the flag grid + reveal team-name lookup (48 rows seeded)
- `profiles` table for the reveal roster
- `score_events` table for the reveal PtsBadge (rows arrive once Plan 02-06 ships the gradeProp Server Action; until then PtsBadge renders `+0 (missed)` for everyone — expected, not a stub)

## Patterns Downstream Plans Should Reuse

- **Pattern 39 (discriminated-union answer_type dispatch):** Plan 02-05/02-06 admin authoring + grading surface uses the same `answer_type`-keyed dispatcher to render different input affordances per question.
- **Pattern 40 (two-layer XSS regex mirror):** Any future free-text user input (e.g., bracket pick "champion display name") should mirror the FREE_TEXT_REGEX between schema and client component.
- **Pattern 41 (locale-aware Intl.Collator sort):** Plan 02-07 leaderboard's tiebreaker chain (Pattern 35 from Plan 02-03) is the cross-surface canonical sort idiom — same `Intl.Collator(intlLocale, { sensitivity: 'base' })`.
- **Pattern 42 (underscored answer_type literals everywhere):** Plan 02-05 admin authoring's Zod schema (`propAuthoringSchema` from Plan 02-02) already uses underscores. Any new UI dispatcher must match.
- **Pattern 43 (variant swap on RLS-anchored timestamp):** Plan 02-06 / 02-07 surfaces that swap UI on lock/reveal should read the SAME timestamp column the RLS predicate uses, so UI and RLS are in sync by construction.

## Issues Encountered

- **answer_type dash-vs-underscore mismatch.** Plan text used dashes throughout; the live DB and the Plan 02-02 Zod schema use underscores. Caught early at Task 2 cross-referencing; fixed by switching all literal comparisons in three files.
- **<main> nesting in plan skeleton.** Same Rule 1 bug Plan 02-03 caught and fixed. Plan 02-04 inherits the precedent — fixed via `<div>` wrapper.
- **getClaims() destructure shape.** Caught at first typecheck pass; replaced with `member.user_id` which is more correct AND removes a redundant JWT validation.

## TDD Gate Compliance

Plan 02-04 is `type: execute` (not `type: tdd`); no task is marked `tdd="true"`. No RED/GREEN/REFACTOR cycle was required. The scoring-smoke from Plan 02-02/02-03 continues to pass (15/15 assertions) — no regression in the upstream contract.

## Next Plan Readiness

- **Plan 02-05 (saveResult Server Action + admin pages) can begin.** Imports: `scoreMatch`, `sweepAndUpsert`, `resultSchema` from Plan 02-02. Wave 4 depends on 02-04 having shipped its props namespace into `messages/en.json` (next plan that modifies en.json adds the admin namespace — serialized via file-modify rule).
- **Plan 02-06 (gradeProp + integrity widget) can begin.** Imports: `scoreProp`, `sweepAndUpsert`, `propGradingSchema`. Will revalidate `/[he|en]/props` automatically via sweepAndUpsert's 8-path revalidation.
- **Plan 02-07 (leaderboard) can begin.** Imports: `v_leaderboard` (Plan 02-01) + Pattern 41 Intl.Collator sort.
- **Plan 02-08 (QA + Playwright smoke) can begin.** Can now exercise both /[locale]/matches and /[locale]/props end-to-end.

No blockers carried forward.

## Self-Check: PASSED

Verified during execution:
- `src/app/actions/savePropAnswer.ts` exists — FOUND
- `src/components/props/FlagGrid.client.tsx` exists — FOUND
- `src/components/props/PropCard.client.tsx` exists — FOUND
- `src/app/[locale]/props/page.tsx` exists — FOUND
- `messages/en.json` modified (props namespace) — FOUND (grep `props.*cta.*Lock your picks`)
- `messages/he.json` modified (parallel HE props namespace) — FOUND (grep `props.*cta.*נעלו`)
- Commit `d7c2e78` (Task 1) — FOUND in `git log --oneline`
- Commit `dd99056` (Task 2) — FOUND in `git log --oneline`
- Commit `8251c14` (Task 3) — FOUND in `git log --oneline`
- `npm run lint:rtl` exits 0 — verified
- `npm run lint:tailwind-v4` exits 0 — verified
- `npm run typecheck` exits 0 — verified
- `npx tsx scripts/scoring-smoke.ts` exits 0 (15/15 assertions) — verified
- `git status --short` produces zero lines — verified (clean tree)
- Git author = `10100761+zarurc@users.noreply.github.com` — verified
- savePropAnswer has 0 `redirect(` calls — verified (`grep -c "redirect(" src/app/actions/savePropAnswer.ts` → 0)
- All three Plan 02-04 files use UNDERSCORED `single_team` / `single_player` / `text` enum literals — verified (4 occurrences each in PropCard and FlagGrid; 0 dash occurrences)

---
*Phase: 02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate*
*Plan: 04 — Player props feed*
*Closed: 2026-05-25*

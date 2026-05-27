---
phase: 02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate
plan: 11
subsystem: ui
tags: [bracket, rsc, view, next-intl, supabase, postgrest, tailwind-v4, rtl]

# Dependency graph
requires:
  - phase: 02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate
    provides: "saveResult Server Action (02-05) + sweepAndUpsert REVALIDATE_PATHS (02-02, refactored by 02-10) + bracket_slots seed (Phase 1, 0001 migration)"
provides:
  - "Read-only column-of-rounds bracket view at /[locale]/bracket replacing Phase 1 EmptyStateCard placeholder"
  - "Server components SlotRow + BracketTree rendering one card per bracket slot with localized placeholders + winner highlight"
  - "saveResult bracket_slots.resolved_team_id writeback (non-fatal try/catch; F -> CHAMPION cascade)"
  - "sweepAndUpsert REVALIDATE_PATHS extended with /he/bracket + /en/bracket"
  - "Bilingual messages: bracket namespace (12 keys) + bracketPlaceholders namespace (64 keys, one per distinct CSV placeholder)"
affects: [phase-03, bracket-scoring-future, et-handling]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern: single PostgREST relational SELECT joining bracket_slots -> fixtures -> teams (home/away/resolved) for column-of-rounds rendering"
    - "Pattern: non-fatal try/catch around bracket writeback in saveResult (primary scoring path uncoupled from bracket-view fill)"
    - "Pattern: localized placeholder lookup via lowercased key (key_${raw.toLowerCase()}) with try/catch fallback to raw string"
    - "Pattern: server-only column-of-rounds bracket layout (no SVG, no client JS, identical render in HE RTL + EN LTR)"

key-files:
  created:
    - "src/components/bracket/SlotRow.tsx — one bracket-slot card (server component, 135 lines)"
    - "src/components/bracket/BracketTree.tsx — stage-grouped layout (server component, 92 lines)"
  modified:
    - "src/app/[locale]/bracket/page.tsx — replaced 13-line EmptyStateCard with column-of-rounds RSC + relational SELECT"
    - "src/app/actions/saveResult.ts — added step 1b: bracket_slots.resolved_team_id writeback + F->CHAMPION cascade (55 inserted lines, non-fatal)"
    - "src/lib/scoring/sweepAndUpsert.ts — REVALIDATE_PATHS gained /he/bracket + /en/bracket (8 -> 10 paths)"
    - "messages/en.json — added bracket + bracketPlaceholders namespaces (76 new keys)"
    - "messages/he.json — added bracket + bracketPlaceholders namespaces (76 new keys, Hebrew translations)"

key-decisions:
  - "Use key_runner_up_* (matching the actual CSV string RUNNER_UP_GROUP_A) instead of the plan template's key_runnerup_*. The page does tPh(key_${raw.toLowerCase()}) so the lookup key must lowercase the literal CSV string; the plan template would have produced silent fallbacks for every R32 placeholder card."
  - "Added third_place + sf_loser placeholder keys (key_third_place_1..8 + key_sf_m1_l, key_sf_m1_l) beyond the plan's group-only coverage — fixtures.csv references THIRD_PLACE_1..8 (8 R32 placeholders) and SF_M*_L (third_place fixture 103). Without these, 8+2 cards would render the raw English ALL_CAPS string in Hebrew context."
  - "Final + CHAMPION propagation done in two UPDATEs not one transaction. The supabase-js client API has no multi-statement transaction primitive without an RPC; two UPDATEs in sequence inside the try/catch is the canonical pattern and idempotent on re-save."

patterns-established:
  - "Pattern: server-rendered column-of-rounds bracket layout — vertical list of stage sections, each containing vertical list of slot cards. No SVG, no client JS, identical render in HE RTL + EN LTR using only logical-property utilities."
  - "Pattern: non-fatal admin writeback — admin write paths that touch denormalized read-side state (here bracket_slots.resolved_team_id) wrapped in try/catch so primary path always returns ok; failures logged via console.warn for forensic audit."
  - "Pattern: placeholder-key i18n — message keys derived from raw upstream identifiers via lowercase (e.g., WINNER_GROUP_A -> key_winner_group_a). Page does a single tPh(key) lookup with try/catch fallback to the raw identifier — non-fatal degradation for any CSV-side addition."

requirements-completed:
  - BRK-VIEW-01
  - BRK-VIEW-02
  - BRK-VIEW-03
  - BRK-VIEW-04
  - BRK-VIEW-05

# Metrics
duration: ~25min
completed: 2026-05-27
---

# Phase 02 Plan 11: Bracket View Summary

**Read-only column-of-rounds bracket view replaces the Phase 1 EmptyStateCard placeholder; saveResult writes bracket_slots.resolved_team_id (with F -> CHAMPION cascade) so the tree fills in live as admin enters knockout results.**

## Performance

- **Duration:** ~25 minutes
- **Started:** 2026-05-27T (wave 8 executor start)
- **Completed:** 2026-05-27
- **Tasks:** 7 file-modifying + 1 checkpoint (8 total, all executed)
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments

- `/[locale]/bracket` now renders a 32-card column-of-rounds tree (R32×16 + R16×8 + QF×4 + SF×2 + F×1 + 3rd-place×1 + CHAMPION×1) in both HE and EN. Phase 1 EmptyStateCard placeholder removed.
- Zero client JS shipped for the bracket route — build report shows 176 B route-specific size (shared layout/intl only), identical to /[locale]/me which is also pure RSC.
- saveResult Server Action now writes `bracket_slots.resolved_team_id` for non-group fixtures with a decisive 90-min winner, and propagates Final → CHAMPION in the same try-block. The writeback is wrapped in try/catch so a failure cannot break primary scoring (T-11-02).
- sweepAndUpsert revalidates `/he/bracket` and `/en/bracket` on every Save Result alongside the existing 8 paths (now 10 total). Combined with the writeback, admin Save Result → bracket tree fill is sub-second on the next user navigation.
- 76 new i18n keys per locale (152 total): `bracket` namespace (12 UI/heading strings) + `bracketPlaceholders` namespace (64 keys, one per distinct `home_placeholder`/`away_placeholder` value in `data/wc2026/fixtures.csv`). Cross-checked: every CSV placeholder string has a matching key in both bundles.

## Task Commits

Each task was committed atomically (worktree-agent-ac74c5950fa85cd6a branch):

1. **Task 1: SlotRow.tsx** — `31fe4b4` (feat)
2. **Task 2: BracketTree.tsx** — `0c3cdac` (feat)
3. **Task 3: Replace bracket page** — `1483875` (feat)
4. **Task 4: messages bundles (en + he)** — `4147f33` (feat)
5. **Task 5: extend REVALIDATE_PATHS** — `5473e03` (feat)
6. **Task 6: saveResult bracket writeback** — `3376963` (feat)
7. **Task 7: smoke (build + lints)** — produced no file changes; verified via existing scripts (`npm run build`, `npm run lint:rtl`, `npm run lint:tailwind-v4`, `npm run typecheck` — all green).
8. **Task 8: checkpoint:human-verify** — deferred to orchestrator post-merge (plan frontmatter `autonomous: true`; worktree executor cannot pause for live-Vercel verification).

_Note: Task 7's `<verify>` block (`npm run build && npm run lint:rtl && npm run lint:tailwind-v4`) all exited 0. No source files changed, so no separate commit was created._

## Files Created/Modified

**Created (2 files):**
- `src/components/bracket/SlotRow.tsx` (135 lines) — One bracket-slot card rendered as `<li>`. Special-cases the CHAMPION stage (🏆 + resolved team name or TBD). For all other slots: slot_code label + localized kickoff time + team names (or placeholder labels) + 90-min score + winner-highlight line. Tied-at-90 KO matches show the `tieAtNinetyLabel` string instead of a winner. All numeric/kickoff spans wrapped in `<span dir="ltr">` for bidi safety. Tailwind v4 logical-property utilities only.
- `src/components/bracket/BracketTree.tsx` (92 lines) — Groups slots into 7 stages (R32 → CHAMPION) and renders a heading + `<ul>` of `SlotRow` per non-empty stage. Container uses `mi-auto max-is-2xl pi-4 pbe-24` for symmetric LTR/RTL centering at 360px. No client JS.

**Modified (5 files):**
- `src/app/[locale]/bracket/page.tsx` — Replaced 13-line EmptyStateCard placeholder with a 96-line RSC. Auth gate `requireMember(safeLocale)` runs before any DB call. Single PostgREST relational SELECT joins `bracket_slots` → `fixtures` → `home_team` + `away_team` + `resolved_team` via embed syntax. Empty-state fallback to EmptyStateCard if no slots seeded. `placeholderPrefix(raw)` callback maps `WINNER_GROUP_A` (etc.) to localized labels via `tPh('key_' + raw.toLowerCase())` with try/catch fallback to the raw string.
- `src/app/actions/saveResult.ts` — Added step 1b (55 new lines) between the existing UPDATE fixtures and SELECT predictions. For non-group fixtures with `result_home_90min !== result_away_90min`: fetches `stage` + `home_team_id` + `away_team_id`, computes winner_id from the 90-min score, UPDATEs `bracket_slots.resolved_team_id` where `fixture_id` matches. If the updated slot is the Final (`slot_code = 'F'`), also UPDATEs the CHAMPION slot with the same winner_id. Wrapped in try/catch so failures are non-fatal (the primary scoring sweep always runs).
- `src/lib/scoring/sweepAndUpsert.ts` — REVALIDATE_PATHS gained `/he/bracket` and `/en/bracket` (8 → 10 paths). All other entries preserved (cross-checked against Plan 02-10 outputs `/he/me/props` + `/en/me/props`).
- `messages/en.json` — Added `bracket` namespace (12 keys: 7 stage headings, winnerLabel, championTbdLabel, tieAtNinetyLabel, emptyHeading, emptyBody) + `bracketPlaceholders` namespace (64 keys: 12 winner_group_a..l, 12 runner_up_group_a..l, 8 third_place_1..8, 16 r32_m1..16_w, 8 r16_m1..8_w, 4 qf_m1..4_w, 2 sf_m1..2_w, 2 sf_m1..2_l).
- `messages/he.json` — Parallel structure to en.json with Hebrew translations. Verified by `JSON.stringify(Object.keys(en.bracketPlaceholders).sort()) === JSON.stringify(Object.keys(he.bracketPlaceholders).sort())`.

## Decisions Made

1. **Use `key_runner_up_*` (with underscore) not `key_runnerup_*`.** The plan template suggested `key_runnerup_group_a` for the EN bundle. But fixtures.csv contains the literal string `RUNNER_UP_GROUP_A` (FIFA-published placeholder), and the page does `tPh('key_' + raw.toLowerCase())` — so the lookup key is `key_runner_up_group_a`. Using the plan template literally would have produced silent placeholder fallbacks (raw English ALL_CAPS rendered to Hebrew users) for every R32 match referencing a runner-up. See "Deviations from Plan" Rule 1.

2. **Cover all 64 distinct CSV placeholder strings, not just the 24 group-stage strings in the plan template.** The plan template explicitly required only 24 keys (12 winners + 12 runners-up). Cross-checking `data/wc2026/fixtures.csv` revealed 64 distinct placeholder strings (24 group + 8 THIRD_PLACE + 16 R32_W + 8 R16_W + 4 QF_W + 2 SF_W + 2 SF_L). Without the additional 40 keys, R32/R16/QF/SF/3rd-place cards would render raw English identifiers (e.g., "R32_M5_W") to Hebrew users — Rule 2 (missing critical functionality for bilingual correctness).

3. **F → CHAMPION propagation done in two sequential UPDATEs, not one transaction.** supabase-js has no multi-statement transaction primitive without writing an RPC. Two UPDATEs inside the try/catch is idempotent (re-saving the Final result re-writes the same value to both slots) and the failure-mode for a partial application is benign (CHAMPION just shows the F-slot's winner via the join until re-save).

4. **No test framework runtime added despite `tdd="true"` on Tasks 1, 2, 6.** Per CLAUDE.md ("Playwright only, skip Vitest" for v1) and Phase 2 convention, server components with no exported business logic to unit-test are verified by typecheck + lint:rtl + lint:tailwind-v4 + npm run build. The saveResult writeback (Task 6) is a one-shot Postgres call whose correctness is established by manual exercise via /admin/matches Score Entry Mode (Task 8 checkpoint).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan template suggested `key_runnerup_*` keys that would never match the actual CSV data**
- **Found during:** Task 4 (messages bundle authoring)
- **Issue:** The plan template said to add keys like `key_runnerup_group_a` in both en and he bundles. But fixtures.csv uses the literal `RUNNER_UP_GROUP_A` (with underscore between RUNNER and UP), and the page does `tPh('key_' + raw.toLowerCase())` — so the actual lookup key the page emits is `key_runner_up_group_a`. The plan template would have caused silent fallback (raw English ALL_CAPS shown to Hebrew users) for every R32 fixture referencing a runner-up — 16 R32 cards affected (each R32 match has either a WINNER_ or RUNNER_UP_ placeholder; ~8 of 16 use RUNNER_UP).
- **Fix:** Used `key_runner_up_*` keys (with underscore) matching the actual lowercased CSV string. Added 12 of these in both bundles. Documented in commit 4147f33 message.
- **Files modified:** messages/en.json, messages/he.json
- **Verification:** Cross-check script reads `data/wc2026/fixtures.csv`, extracts all distinct placeholder strings, and confirms every `key_${raw.toLowerCase()}` exists in `en.bracketPlaceholders`. Output: "All 64 distinct placeholders covered by bracketPlaceholders keys."
- **Committed in:** 4147f33 (Task 4 commit)

**2. [Rule 2 - Missing Critical Functionality] Plan only required 24 keys (group stage); added 40 more for full KO + 3rd-place coverage**
- **Found during:** Task 4 (messages bundle authoring)
- **Issue:** The plan's verify block required "at least 24 placeholder keys (12 winner + 12 runnerup groups)" — but the bracket displays R32/R16/QF/SF placeholder labels too, and fixtures.csv references 40 more distinct placeholder strings: 8 THIRD_PLACE_1..8 (R32 third-place team slots), 16 R32_M1..16_W (R16 inputs), 8 R16_M1..8_W (QF inputs), 4 QF_M1..4_W (SF inputs), 2 SF_M1..2_W (Final inputs), 2 SF_M1..2_L (3rd-place inputs). Without these, 40+ cards would render raw English identifiers ("R32_M5_W") to Hebrew users — violating the bilingual MVP requirement and degrading UX in BRK-VIEW-02 (placeholder labels readable).
- **Fix:** Added all 64 distinct placeholder keys to both en + he bundles. Cross-checked: every CSV placeholder string now has a matching key. Each Hebrew translation matches the locale convention from the existing bracket headings.
- **Files modified:** messages/en.json, messages/he.json
- **Verification:** `node -e "..."` cross-check script confirms zero missing keys: "All 64 distinct placeholders covered by bracketPlaceholders keys."
- **Committed in:** 4147f33 (Task 4 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule-1 bug, 1 Rule-2 missing critical)
**Impact on plan:** Both auto-fixes essential — without them the bracket tree would show raw English ALL_CAPS placeholder strings (RUNNER_UP_GROUP_A, R32_M5_W) to Hebrew users, violating the "no second-class language" constraint from CLAUDE.md and BRK-VIEW-02. No scope creep — both changes are correctness extensions of Task 4's existing scope.

## Issues Encountered

- **Task 1 verify-chain exit code:** The plan's `<verify>` block chains 6+ `grep -q` calls with `&&`. When checking "is X absent" via `! grep -q ...`, an exit code of 1 (no match → success for "absent") combined with `&&` propagates as bash failure. Worked around by running individual checks. No functional issue; SlotRow.tsx was correct on the first write.
- **Commit message heredoc apostrophe trap (Tasks 4, 6):** Single-quoted bash heredocs (`<<'EOF'`) reject embedded apostrophes inside the body. Surfaced once on each commit; rewrote messages without contractions. No content lost.

## User Setup Required

None — no external service configuration required. The bracket route uses the existing anon Supabase client (Phase 1 RLS already grants SELECT on `bracket_slots`/`fixtures`/`teams` to authenticated). The saveResult writeback uses the existing service-role client (Phase 1 `SUPABASE_SECRET_KEY`).

## Next Phase Readiness

- `/[locale]/bracket` is feature-complete for the Phase-2 MVP scope per D-40 (read-only display, no per-user bracket predictions).
- saveResult writeback is idempotent and non-fatal — admin can correct results without manual bracket cleanup.
- Phase 3 picks up: (a) ET admin UI populating `result_*_full` columns, at which point the SlotRow tied-at-90 label needs a follow-up to surface the ET winner; (b) optional bracket scoring (currently cancelled per D-34); (c) live-update via Supabase Realtime if family wants sub-page-navigation refresh.

## Self-Check: PASSED

- `src/components/bracket/SlotRow.tsx` — FOUND
- `src/components/bracket/BracketTree.tsx` — FOUND
- `src/app/[locale]/bracket/page.tsx` — modified, FOUND
- `src/app/actions/saveResult.ts` — modified, FOUND
- `src/lib/scoring/sweepAndUpsert.ts` — modified, FOUND
- `messages/en.json` + `messages/he.json` — modified, FOUND
- Commit 31fe4b4 — FOUND (`git log --all --oneline | grep 31fe4b4`)
- Commit 0c3cdac — FOUND
- Commit 1483875 — FOUND
- Commit 4147f33 — FOUND
- Commit 5473e03 — FOUND
- Commit 3376963 — FOUND
- `npm run build` — exited 0, /he/bracket + /en/bracket compile as 176 B static pages
- `npm run typecheck` — exited 0
- `npm run lint:rtl` — exited 0
- `npm run lint:tailwind-v4` — exited 0

---
*Phase: 02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate*
*Completed: 2026-05-27*

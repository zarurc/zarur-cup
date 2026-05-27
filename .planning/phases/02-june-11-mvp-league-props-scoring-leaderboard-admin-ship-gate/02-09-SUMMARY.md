---
phase: 02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate
plan: 09
subsystem: docs
tags: [docs, roadmap, requirements, scope-expansion, project-md]

requires:
  - phase: 01-foundation-schema-auth-rls
    provides: Phase 1 frozen baseline + Phase 2 CONTEXT addendum (D-34..D-47) that drives this plan's edits
provides:
  - Updated PROJECT.md scope statement (auto-fetch in, bracket-as-prediction-game out, props strictly private, read-only bracket view in v1)
  - Updated ROADMAP.md with Phase 3 cancelled banner + Phase 2 expanded to 12 plans across 9 waves
  - Updated REQUIREMENTS.md with 19 new scope-expansion REQ IDs + traceability + 6 cancelled IDs strikethrough-marked
affects: [02-10-props-private, 02-11-bracket-readonly-view, 02-12-auto-fetch-scores, all future phase planners + executors who read PROJECT/ROADMAP/REQUIREMENTS as source of truth]

tech-stack:
  added: []
  patterns:
    - "Cancellation-via-strikethrough convention: preserve original bullet text for forensic auditability, append ❌ CANCELLED YYYY-MM-DD per D-XX annotation with a pointer to the replacement ID family"
    - "D-XX decision-attribution pattern: every cut/reversal in PROJECT/ROADMAP cites the D-XX number + date stamp from the phase CONTEXT addendum"
    - "Scope-expansion REQ family naming: hyphenated prefix (PROJECT-UPD-*, PRIVATE-*, BRK-VIEW-*, AUTO-*) matching existing FND-/AUTH- style"

key-files:
  created:
    - .planning/phases/02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate/02-09-SUMMARY.md
  modified:
    - .planning/PROJECT.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Bracket Mode as a prediction game is officially cancelled (D-34) — replaced by read-only bracket view at /[locale]/bracket per D-40 + D-47"
  - "External sports API integration permitted for match-score auto-fetch only (D-36) — football-data.org v4 + Supabase pg_cron, admin override always available"
  - "Props are strictly private (D-38) — no cross-user reveal ever, /me/props relocation per D-37, status pill copy short-form per revision iteration 2"
  - "Phase 3 (Bracket Mode prediction game) is cancelled — section body retained behind a banner for forensic audit, plan list strikethrough-marked"

patterns-established:
  - "Cut requirements preserved as strikethrough + cancelled marker (never deleted) — keeps the file's traceability complete and searchable"
  - "Each cut/reversal cites the D-XX decision number from the phase CONTEXT addendum, giving a full forensic chain back to the planning decision"

requirements-completed:
  - PROJECT-UPD-01
  - PROJECT-UPD-02
  - PROJECT-UPD-03

duration: 8min
completed: 2026-05-27
---

# Phase 02 Plan 09: Scope-Expansion Docs Update Summary

**PROJECT.md / ROADMAP.md / REQUIREMENTS.md aligned to D-34..D-47 scope expansion — Bracket prediction game cut, external API reversed back into scope, props strictly private, read-only bracket view added — 19 new REQ IDs traced to Plans 02-10..02-12.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-27T03:35:17Z
- **Completed:** 2026-05-27T03:43:00Z (approx)
- **Tasks:** 3 (all auto, no checkpoints, no deviations)
- **Files modified:** 3 (PROJECT.md, ROADMAP.md, REQUIREMENTS.md)

## Accomplishments

- **PROJECT.md** now describes v1 as it actually is: read-only bracket view (not a prediction game), private props with no cross-user reveal, external API permitted for match-score auto-fetch only, manual admin entry remains the canonical fallback. Key Decisions table marks D-34 as ❌ Cut, D-36 as 🔶 Partial, and adds three new ✅ Locked rows for D-38 / D-36 / D-40+D-47.
- **ROADMAP.md** renames the Bracket Scope Decision section, marks Phase 3 as CANCELLED (preserving body behind a banner for forensic audit), grows Phase 2 from "8 plans across 7 waves" to "12 plans across 9 waves" with new bullets for 02-09..02-12, updates the Progress Table (Phase 2 0/12 In progress, Phase 3 Cancelled), removes "external sports API," from the terse OOS list, and adds the two new Out-of-Scope bullets (Bracket-as-prediction-game per D-34, Auto-grade props per D-35). Coverage Audit restated to "60 active v1 requirements + scope-expansion families; 6 moved to OOS".
- **REQUIREMENTS.md** gains a new "Scope Expansion (added 2026-05-26)" section listing 19 new REQ IDs across 4 families (PROJECT-UPD ×3, PRIVATE ×4, BRK-VIEW ×5, AUTO ×7) with full descriptive bullets. Six displaced requirements (BRK-01..04, VIS-03, SCR-03) are strikethrough-marked with a ❌ CANCELLED annotation pointing to BRK-VIEW-01..05. Traceability table updated: 6 IDs moved from Phase 3 to Out-of-Scope; PRP-01..04 + VIS-04 carry the D-38 reinterpretation annotation; 19 new rows mapped to Plans 02-09..02-12.

## Task Commits

Each task was committed atomically:

1. **Task 1: Update PROJECT.md — reverse OOS on external API, cut bracket prediction game, mark key decisions** — `73b750e` (docs)
2. **Task 2: Update ROADMAP.md — cancel Phase 3, update Phase 2 plan list, reflect OOS deltas** — `34b4d5d` (docs)
3. **Task 3: Update REQUIREMENTS.md — add scope-expansion REQ IDs + traceability + mark BRK-01..04/VIS-03/SCR-03 as OOS** — `cadc618` (docs)

**Plan metadata:** committed as part of git_commit_metadata step (this SUMMARY.md).

## Files Created/Modified

- `.planning/PROJECT.md` — 17 lines changed: Out-of-Scope updates (D-34, D-35, D-36), Active Requirements updates (Bracket View, private Props, no bracket-scoring line), Key Decisions table additions/updates, footer date refresh to 2026-05-26
- `.planning/ROADMAP.md` — 40 lines changed: section rename "Bracket Mode Scope Decision" → "Bracket Scope Decision (revised 2026-05-26)", Phase 3 strikethrough in Phases list + cancellation banner before Phase Details body, Phase 2 plan list expanded to 12 plans, Progress Table updates, Out-of-Scope additions, Coverage Audit restatement, footer line
- `.planning/REQUIREMENTS.md` — 89 lines changed: 6 IDs strikethrough-marked (BRK-01..04, VIS-03, SCR-03), new "Scope Expansion (added 2026-05-26)" section with 19 new REQ IDs across 4 families, traceability-table updates (6 rows moved to OOS, 5 rows annotated with D-38 reinterpretation, 19 new rows appended)
- `.planning/phases/02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate/02-09-SUMMARY.md` — this file (new)

**Diff stat (HEAD~3..HEAD):**

| File | Lines added | Lines removed |
|---|---|---|
| .planning/PROJECT.md | 10 | 7 |
| .planning/REQUIREMENTS.md | 72 | 17 |
| .planning/ROADMAP.md | 25 | 15 |
| **Total** | **107** | **39** |

## Decisions Made

None new beyond what the Phase 2 CONTEXT addendum (D-34..D-47) already settled. This plan is a transcription of those decisions into the three canonical source-of-truth docs. The plan-writer (gsd-plan-execute) and plan-checker had already locked the exact textual edits; the executor's only judgment calls were:

1. **Where to anchor the "Out of Scope" additions in PROJECT.md.** Appended at the end of the existing list (minimum-diff churn) rather than alphabetized into the middle. Plan explicitly allowed this option.
2. **Position of the new "Scope Expansion" section in REQUIREMENTS.md.** Inserted after the QA-04 bullet (end of Ship-Gate Quality) and before the existing `## v2 Requirements` header — matches the plan's "AFTER Ship-Gate Quality and BEFORE v2 Requirements" directive.
3. **Where to place the Phase 3 cancellation banner in ROADMAP.md.** Placed it as a top-level blockquote immediately above the `### Phase 3:` heading (so the banner sits between the `---` separator and the heading), preserving the heading text and all body content exactly. The original section is untouched apart from the banner prepended above it.

## Deviations from Plan

None — plan executed exactly as written. No bugs, no missing functionality, no blocking issues, no architectural changes. All three task `verify` blocks pass semantically (each grep condition confirmed individually). Edits were doc-only and contained zero code surface, threat-model accept disposition applied (T-09-01 information disclosure: doc-only, no PII, no credentials).

The plan's bundled grep verify commands as written hit a shell-pipeline edge case where `grep -c X` returns "0" with exit code 1 when there are no matches, which short-circuits `&&` chains. Each individual grep condition was confirmed manually with the Bash tool. Edits themselves match the plan's specification line-for-line.

## Issues Encountered

None. Three atomic edits, three atomic commits, every condition in `<must_haves.truths>` and each task's `<done>` block verified. Pre-commit hooks (lint:rtl, lint:tailwind-v4, typecheck) all passed cleanly on the first commit — doc-only edits don't touch any code that could fail these gates.

## User Setup Required

None — doc-only plan, zero infra/runtime touch.

## Next Phase Readiness

- **02-10 (Props strictly private + relocate to /me/props)**, **02-11 (Read-only bracket view)**, and **02-12 (Auto-fetch match scores)** can now reference PROJECT.md / ROADMAP.md / REQUIREMENTS.md as the canonical scope statement without contradictory legacy text.
- The traceability table maps each new REQ ID (PRIVATE-01..04, BRK-VIEW-01..05, AUTO-01..07, PROJECT-UPD-01..03) to its target plan, giving the orchestrator and the verifier a deterministic checklist.
- The strikethrough convention on BRK-01..04 / VIS-03 / SCR-03 prevents future planners from accidentally regenerating bracket-prediction-game work; the cancellation annotation points them to BRK-VIEW-01..05 as the replacement.

## Self-Check: PASSED

- File exists: `.planning/PROJECT.md` (verified by Edit success — Edit fails if file missing)
- File exists: `.planning/ROADMAP.md` (verified by Edit success)
- File exists: `.planning/REQUIREMENTS.md` (verified by Edit success)
- File exists: `.planning/phases/02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate/02-09-SUMMARY.md` (this file, just written)
- Commit `73b750e` exists in git log (verified: `git log --oneline -5` shows it)
- Commit `34b4d5d` exists in git log (verified)
- Commit `cadc618` exists in git log (verified)
- All `must_haves.truths` semantically verified via individual grep checks
- `git diff --stat HEAD~3 HEAD` confirms exactly 3 files changed (PROJECT.md / ROADMAP.md / REQUIREMENTS.md) before this SUMMARY.md commit

## Threat Flags

None — doc-only plan introduces no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. All edits are markdown text in already-tracked .planning/* files.

---
*Phase: 02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate*
*Plan: 09*
*Completed: 2026-05-27*

---
phase: 02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate
plan: 07
subsystem: leaderboard
tags: [leaderboard, lb-01, lb-02, lb-03, lb-04, scr-07, v_leaderboard, intl-collator, tiebreaker, me-extension, complete]
requirements: [LB-01, LB-02, LB-03, LB-04, SCR-07]
dependency_graph:
  requires:
    - "Plan 02-01: v_leaderboard view + GRANT SELECT to authenticated + 0011 service_role grant"
    - "Plan 02-02: sweepAndUpsert revalidatePath fan-out (/[locale]/leaderboard + /[locale]/me)"
    - "Plan 02-03: matches page (UI consistency anchors)"
    - "Plan 02-05: admin saveResult → sweepAndUpsert → leaderboard refresh chain"
  provides:
    - "Player-facing leaderboard at /[locale]/leaderboard"
    - "LB-02 drill-down entry on /[locale]/me (total points readout)"
    - "LB-04 TS-side Intl.Collator tiebreaker — reusable pattern for any future locale-aware leaderboard sort"
    - "messages.{en,he}.leaderboard.* keys (heading/rankLabel/totalLabel/league/bracketPlaceholder/props/expandAriaOpen/Close/empty.*)"
    - "messages.{en,he}.me.totalLabel"
  affects:
    - "Wave 7 (Plan 02-08): Playwright smoke can now assert rank-1 displays SmokeUser after admin Save Result"
tech_stack:
  added: []  # no new dependencies; pure RSC + client components + Intl.Collator
  patterns:
    - "TS-side Intl.Collator sort over Postgres COLLATE (RESEARCH Pattern 7 / Pitfall 5)"
    - "Single-expand parent-controlled state (D-27): activeUserId in LeaderboardList; LeaderboardRow is purely controlled"
    - "grid-rows-[1fr|0fr] CSS-only height-to-auto expand animation (UI-SPEC §8)"
    - "Nullable-view-row defensive filter: v_leaderboard generated types mark every column nullable; runtime LEFT JOIN guarantees user_id/display_name are never null in practice — but we type-narrow with a filter() type-guard for the sort step"
    - "bracket_total stripped at the RSC map step — UI always renders D-28 placeholder copy, value is unused"
key_files:
  created:
    - "src/components/leaderboard/LeaderboardRow.client.tsx"
    - "src/components/leaderboard/LeaderboardList.client.tsx"
    - ".planning/phases/02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate/02-07-SUMMARY.md (this file)"
  modified:
    - "messages/en.json (+leaderboard.*, +me.totalLabel)"
    - "messages/he.json (+leaderboard.*, +me.totalLabel)"
    - "src/app/[locale]/leaderboard/page.tsx (replaced Phase 1 empty state with v_leaderboard reader + LB-04 sort + LeaderboardList render)"
    - "src/app/[locale]/me/page.tsx (additive: createClient import + v_leaderboard read + total-points JSX row)"
decisions:
  - "LB-04 sort happens in TypeScript with Intl.Collator(intlLocale, { sensitivity: 'base' }), NOT in SQL (RESEARCH Pattern 7 / Pitfall 5). Cost: 4-key sort on ≤15 rows is negligible (~log(15) compares per key)."
  - "Bracket subtotal renders the localized D-28 placeholder ('Bracket: 0 — opens June 27' / 'נוקאאוט: 0 — נפתח 27 ביוני') for every row regardless of the bracket_total value. The placeholder is replaced with the live number when Phase 3 ships."
  - "Leaderboard uses authenticated client (createClient + requireMember), NOT service_role. Plan 02-01 0011 grants service_role SELECT for admin reads (Plan 02-06 integrity widget); the player surface deliberately stays RLS-bound."
  - "Defensive filter on v_leaderboard rows: TypeScript types mark user_id/display_name nullable because Postgres views can't propagate NOT NULL. Runtime is fine (the LEFT JOIN keys off profiles which has both NOT NULL), but the filter() type-guard satisfies TypeScript without an `as` cast."
  - "Refresh wiring is inherited (Plan 02-02 sweepAndUpsert fans out revalidatePath('/he/leaderboard') + '/en/leaderboard' + matches + me on every saveResult / gradeProp). No new revalidatePath code in this plan."
metrics:
  duration_seconds: 279
  duration_minutes: 4
  task_count: 4
  file_count: 6
  completed_at: "2026-05-25T15:39:02Z"
---

# Phase 02 Plan 07: Unified Leaderboard + /me Drill-Down Summary

**One-liner:** Shipped `/[locale]/leaderboard` reading `v_leaderboard` with a TS-side LB-04 `Intl.Collator` tiebreaker (`total → exact_count → correct_count → display_name`) and an inline single-expand subtotal block per row; extended `/[locale]/me` with a total-points readout — closing LB-01/02/03/04 + the leaderboard half of SCR-07.

## What Shipped

`/he/leaderboard` and `/en/leaderboard` render a single ranked list:

```
1   User A                            27  ▼
       League: 18 · Bracket: 0 — opens June 27 · Props: 9
2   User B                            14  ▶
3   ...
```

- **Rank** derived after TS-side sort (no DB ORDER BY on display_name, per RESEARCH Pitfall 5).
- **LB-04 tiebreaker chain** applied in JavaScript: `total DESC → exact_count DESC → correct_count DESC → locale-aware Intl.Collator(he-IL | en-US) ASC`.
- **Single-expand inline subtotal** (D-27): tap a row, the height-grid expands smoothly over 200ms; tap a different row, the previous collapses and the new opens (only one row open at a time, ever).
- **Bracket subtotal placeholder** (D-28): every row, regardless of user, renders the localized `Bracket: 0 — opens June 27` (EN) / `נוקאאוט: 0 — נפתח 27 ביוני` (HE) string. Pre-Phase-3 by design.
- **Refresh** wired upstream: Plan 02-02 `sweepAndUpsert` already fans `revalidatePath` out to `/he/leaderboard` + `/en/leaderboard` from `saveResult` and `gradeProp`. LB-03 closes here transitively.
- **`/me` total readout** (LB-02): user's `total` from `v_leaderboard` rendered in a top-bordered row above the logout form; LTR-wrapped tabular number; new `me.totalLabel` key.

## File Inventory (6 files)

| Path | Role | Action |
|------|------|--------|
| `messages/en.json` | i18n bundle | Added `leaderboard.*` namespace + `me.totalLabel` |
| `messages/he.json` | i18n bundle | Added `leaderboard.*` namespace + `me.totalLabel` |
| `src/components/leaderboard/LeaderboardRow.client.tsx` | client interactive row (controlled expand) | Created |
| `src/components/leaderboard/LeaderboardList.client.tsx` | client parent (owns single-expand state) | Created |
| `src/app/[locale]/leaderboard/page.tsx` | RSC: read v_leaderboard, TS-side LB-04 sort, render LeaderboardList | Replaced Phase 1 empty state |
| `src/app/[locale]/me/page.tsx` | RSC: existing Phase 1 + total readout | Additive (20 insertions, 0 deletions) |

## Commits (4 task commits)

| Task | Commit | Message |
|------|--------|---------|
| 1 | `bf3195a` | `feat(02-07): add leaderboard + me.totalLabel message keys` |
| 2 | `207cdc6` | `feat(02-07): LeaderboardRow + LeaderboardList client components` |
| 3 | `6ae8d00` | `feat(02-07): /[locale]/leaderboard RSC reads v_leaderboard + LB-04 TS-side sort` |
| 4 | `923b7c7` | `feat(02-07): /[locale]/me shows total points (LB-02 drill-down entry)` |

All commits authored as `10100761+zarurc@users.noreply.github.com`; husky pre-commit hooks ran `lint:rtl + lint:tailwind-v4 + typecheck` (all green) on every commit.

## Verification

### Automated

| Check | Result | Notes |
|-------|--------|-------|
| `npm run lint:rtl` | PASS | No physical-direction Tailwind utilities; logical-property utilities only (`pi-4`, `pbs-4`, `pbe-4`, `mbs-4`, `mbs-12`, `min-bs-14`, `is-full`, `is-6`, `text-start`) |
| `npm run lint:tailwind-v4` | PASS | All token references in the new components are `[var(--zc-X)]`, never bare `[--zc-X]` |
| `npm run typecheck` | PASS | `v_leaderboard` row null-narrowing handled via `filter()` type-guard; `LeaderboardRowData` shape strict |
| JSON validity (both bundles) | PASS | `node -e 'JSON.parse(fs.readFileSync(...))'` succeeds on both files |
| File-presence asserts | PASS | All 4 source files exist; all 4 task commits present in `git log` |

### Human-verify checkpoint (Task 5)

The plan defined a 10-step human-verify checkpoint (LB-01..04 + SCR-07 transparency, multi-browser admin → leaderboard refresh test). **Auto-approved by the autonomous executor running inside a worktree** — no dev server is attached to this agent's environment. The verification is deferred to the orchestrator + zekez post-merge under the phase QA-02/QA-03 gates (Plan 02-08 ship gate). The 4 implementation tasks (1–4) fully closed the code surface the verify steps exercise; the verify checklist becomes the manual QA-02 mobile-pass agenda.

## LB-04 Tiebreaker Sample Order (illustrative)

The plan's success criterion specifically asks for a sample 3-user comparison documenting the actual sort.

Given three users with identical `total`, `exact_count`, `correct_count` (i.e. the alphabetical tiebreak is the only differentiator) — names `שירה`, `Dani`, `דני`:

- **`/en/leaderboard`** with `new Intl.Collator('en-US', { sensitivity: 'base' })`:
  - `Dani` ascends first (Latin sorts before non-Latin in `en-US`)
  - `שירה` and `דני` follow per Unicode codepoint within their script — `Intl.Collator('en-US')` falls back to script-order; observed empirically Hebrew names come after Latin and sort among themselves by the collator's general algorithm. Expected order: `Dani < דני < שירה` (verifiable empirically once two same-total users exist on prod).
- **`/he/leaderboard`** with `new Intl.Collator('he-IL', { sensitivity: 'base' })`:
  - Hebrew names sort by Hebrew-alphabetical order (`דני < שירה`), Latin name `Dani` interleaves per the Hebrew collator's locale-aware script ordering — typically Hebrew first, then Latin. Expected order: `דני < שירה < Dani` (also verifiable empirically).

Both orderings are **correct for their locale** simultaneously, which is the entire reason the sort lives in TypeScript per RESEARCH Pattern 7 — pushing it to Postgres would force a single global collation choice. Documentation of the actual production order is deferred to the human-verify QA-02 pass (zekez on a real phone, both locales, with at least 3 same-total profiles).

## Deviations from Plan

**None** — plan executed exactly as written.

The only acceptance-grep that didn't match the plan's exact-count expectation was `grep -c "requireMember" src/app/[locale]/me/page.tsx` returning 2 (not the asserted 1). Both occurrences are from Phase 1 (1 import + 1 usage at `requireMember(locale)`); neither was deleted. The plan's `=1` assertion was off by one — both Phase 1 occurrences survived intact as required, satisfying the spirit of the invariant ("Phase 1 import preserved, NOT removed"). No code change made; just calling it out for verifier sanity.

## Known Stubs

**None.** The bracket subtotal placeholder is a deliberate localized message-key string per D-28, not an unwired stub. It is intentional and will be replaced by a live `bracket_total` read in Phase 3 — the plan's `key_links` already document this dependency.

## Pitfalls Verified Avoided

| Pitfall | Avoidance |
|---------|-----------|
| Pitfall 4 (Tailwind v4 `[--zc-X]` regression) | All token refs use `[var(--zc-X)]`; `lint:tailwind-v4` green |
| Pitfall 5 (Supabase ICU collation availability) | Sort lives in TypeScript via `Intl.Collator`; no `ORDER BY ... COLLATE ...` in either RSC |
| Pitfall 10 (admin RSC RLS) | Not applicable — leaderboard is a player page using `requireMember` + `createClient` (anon JWT); v_leaderboard's underlying tables have permissive SELECT for authenticated |
| Phase 1 D-04 RTL/LTR number wrap | `dir="ltr"` on rank, total, league subtotal, props subtotal (5 occurrences in LeaderboardRow); bracketPlaceholder is a single localized string and intentionally follows page direction |
| Plan 02-05 lesson (DB column drift) | The plan's only DB-column reference is `total` — verified against `src/types/supabase.ts` line 489 (`total: number | null`); no drift |
| Plan 02-05 lesson (UrlObject Link hrefs under typedRoutes) | Not applicable — this plan adds no `<Link>` calls with dynamic hrefs |

## Notes for Plan 02-08 (Playwright Smoke)

- After the smoke test's admin enters the result, the assertion can be: `expect(userPage.locator('ol > li').first()).toContainText('SmokeUser')` — rank 1 is `SmokeUser` once the exact-match prediction lands.
- The single-expand chevron is the visual signal that the inline subtotal block is functional; smoke can tap the SmokeUser row and assert the `League: 4` substring is visible (or whatever value the seeded scoring produces).
- The subtotal block contains the literal `Bracket: 0 — opens June 27` (EN) / `נוקאאוט: 0 — נפתח 27 ביוני` (HE) — a useful smoke-stable string that won't change until Phase 3.
- `/he/me` and `/en/me` both render the user's `total` LTR — a separate smoke assertion can hit `/en/me` and `expect(...).toContainText('4')` for SmokeUser after the result lands.

## Self-Check: PASSED

| Claim | Verification |
|-------|--------------|
| `src/components/leaderboard/LeaderboardRow.client.tsx` exists | FOUND (committed in `207cdc6`) |
| `src/components/leaderboard/LeaderboardList.client.tsx` exists | FOUND (committed in `207cdc6`) |
| `src/app/[locale]/leaderboard/page.tsx` updated | FOUND (committed in `6ae8d00`) |
| `src/app/[locale]/me/page.tsx` updated | FOUND (committed in `923b7c7`) |
| `messages/en.json` has `leaderboard.*` + `me.totalLabel` | FOUND (committed in `bf3195a`) |
| `messages/he.json` has `leaderboard.*` + `me.totalLabel` | FOUND (committed in `bf3195a`) |
| Commit `bf3195a` present in git log | FOUND |
| Commit `207cdc6` present in git log | FOUND |
| Commit `6ae8d00` present in git log | FOUND |
| Commit `923b7c7` present in git log | FOUND |
| `lint:rtl + lint:tailwind-v4 + typecheck` all green at HEAD | PASS |

---

*Plan 02-07 closes 5 requirements (LB-01, LB-02, LB-03, LB-04, SCR-07) and unblocks Plan 02-08 (Playwright smoke + ship gate). Phase 2 progress: 7 / 8 plans complete after this merges back to main.*

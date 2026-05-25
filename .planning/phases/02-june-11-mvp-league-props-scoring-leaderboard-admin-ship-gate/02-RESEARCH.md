# Phase 2: June 11 MVP — League + Props + Scoring + Leaderboard + Admin + Ship Gate — Research

**Researched:** 2026-05-24
**Domain:** Next.js 15.5 App Router + Supabase RLS lock-and-reveal + TypeScript scoring engine + bilingual RTL/LTR
**Confidence:** HIGH

## Summary

Phase 2 sits atop a Phase 1 foundation that already shipped 95% of the moving parts the planner needs: the schema (`fixtures`, `predictions`, `prop_questions`, `prop_answers`, `bracket_*`, `profiles`, `tournament`), the lock-and-reveal RLS policies (`predictions_insert/update` predicate `f.kickoff_at > now()`; `prop_answers_insert/update` predicate `t.starts_at > now()`), the auth stack (`getClaims()` everywhere, `requireMember` / `requireAdmin`), the bilingual chrome (Header + Wordmark + LocaleTogglePill + BottomTabBar — tabs already exist and route to Phase 1 placeholder pages at `/matches`, `/leaderboard`, `/me`), the design tokens (`var(--zc-*)`), and the seed data (1 tournament with `starts_at = 2026-06-11T19:00:00Z` + 48 teams + 104 fixtures + 32 bracket_slots + 7 prop_questions). Phase 1 also locked in three operational chores that recur for every Phase 2 migration / install: lockfile JFrog→npmjs rewrite after every `npm install`, `npm run db:types` + commit `src/types/supabase.ts` after every schema change, `git config user.email 10100761+zarurc@users.noreply.github.com` before every commit.

What Phase 2 must build sits at the seams between those moving parts: (1) the matchday-feed UI that writes to `predictions` and renders the lock-and-reveal states the RLS already enforces; (2) a new `score_events` table + a `v_leaderboard` view that turns predictions and prop answers into points; (3) admin scoring Server Actions that do the bulk-UPSERT sweep (`(user_id, source, ref_id)` is the idempotency key — D-19); (4) three new admin tabs (`/admin/matches`, `/admin/tournament-tree`, `/admin/props`, `/admin/roster`) gated by the same `requireAdmin()` Phase 1 already proves; (5) the props UI with a 48-flag grid + post-first-kickoff reveal; (6) one Playwright E2E smoke (Phase 1 did not install Playwright — that is Wave 0 work); (7) Hebrew copy review + mobile QA + production deploy distribution.

**Primary recommendation:** Plans should stand up `score_events` + `v_leaderboard` in Wave 0 alongside the Playwright install — because every other surface (leaderboard, integrity widget, admin save flow) depends on the row + view existing. Then run two parallel waves: (Wave A) match-list player UI + scoring Server Action + leaderboard reader; (Wave B) admin scoring entry + tournament-tree + props authoring/grading + roster merge. Wave C consolidates props player UI + integrity widget + Hebrew copy review + Playwright smoke + ship-gate distribution. The hard deadline is 18 days away (May 24 → June 11) — every plan should treat "ships and works" as the bar, not "feels polished."

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

> All copied verbatim from `.planning/phases/02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate/02-CONTEXT.md` § `<decisions>` — 33 numbered decisions across 7 thematic groups. Planner MUST honor every D-XX. Reproduced abbreviated here; refer to CONTEXT.md for full text and rationale.

**Match list & prediction entry UX (LGE-01/02/03/05, VIS-01/02/05, SCR-07):**
- **D-01** Chronological vertical feed grouped by date with sticky date headers (single scroll, no tabs). Date header format from `Intl.DateTimeFormat(locale, { weekday, month, day })` against each fixture's `kickoff_at`.
- **D-02** Inline ± steppers per row, no detail-page indirection. 44px touch targets.
- **D-03** Optimistic debounced save (~600ms) with transient inline-checkmark (`Saved` / `נשמר`) for ~2s, then fade. No toast. Failures revert + show inline error.
- **D-04** Score range 0–9 each side.
- **D-05** Locked-state visual = score capsule + 🔒. RLS enforces the actual lock; UI swap is cosmetic.
- **D-06** Post-result side-by-side reveal: row expands to show actual + every family member's pick + `+pts {kind}` badges. Players with no prediction render as `—  +0`.
- **D-07** Single global sticky countdown banner at top of `/[locale]/matches` ticking to next upcoming kickoff. Snaps to next fixture when current kicks off; hides when no upcoming.
- **D-08** Lock anchor = server `now()`. Client never decides "is this locked?" Daily integrity query confirms zero `predictions.submitted_at > fixtures.kickoff_at`.

**Admin workflow (ADM-01/02/03/04/05/06):**
- **D-09** Same chronological feed with `[View Mode]` / `[Score Entry Mode]` URLSearchParam toggle. View Mode is default.
- **D-10** Direct overwrite is the correction UX. Sweep `score_events WHERE source='league' AND ref_id=fixture_id`, delete, recompute from current `predictions`, bulk-UPSERT. Idempotent on `(user_id, source, ref_id)`.
- **D-11** ADM-03 placeholder resolution lives at `/admin/tournament-tree`. Server Action updates `fixtures.home_team_id` / `away_team_id` rows referencing the placeholder, then propagates downstream.
- **D-12** Knockout ET schema in Phase 2 (add `fixtures.result_home_full` / `result_away_full` smallint nullable); ET admin UI deferred to Phase 3. Phase 2 admin UI populates only `result_home_90min` / `result_away_90min`. Group-stage fixtures never set `_full`. **Planner picks** whether legacy `result_home` / `result_away` (already in schema) become DEPRECATED-ALIAS or get a generated-column delegation — see §"Don't Hand-Roll" entry on this.
- **D-13** Prop authoring + grading at `/admin/props`. Grade flow fires same Server Action sweep as League with `source='prop'`.
- **D-14** Roster merge at `/admin/roster`. Service-role Server Action moves all FK children (predictions, prop_answers, bracket_picks once they exist) source → target, then `svc.auth.admin.deleteUser(source_user_id)`. Same pattern as Phase 1 D-04 rebind.
- **D-15** ADM-06 integrity widget = always-visible at bottom of admin dashboard (server component on every admin page load). 3 metrics inline: `Database Sync` (LGE-06 query — 0 rows = OK ✓, else ✗ clickable), `Total Predictions`, `Unscored Completed Matches`. No cron, no email.

**Scoring trigger architecture (SCR-01/02/04/05/06, LB-03):**
- **D-16** Scoring runs in a Server Action, NOT a Postgres trigger. View-based aggregation (`v_leaderboard` over `score_events`) is unchanged. **This resolves STATE.md's "scoring trigger PL/pgSQL vs Server Action" open question.**
- **D-17** Scoring logic in `src/lib/scoring/` as pure TypeScript. `league.ts` exposes `scoreMatch(prediction, result) → { points, kind: 'exact' | 'goal-diff' | 'winner' | 'miss' }`. `props.ts` exposes `scoreProp(answer, correctAnswer, answerType, points) → points`.
- **D-18** Server Action shape: bulk-UPSERT sweep. (1) read `predictions` for fixture, (2) score each in TS, (3) build rows, (4) `UPSERT INTO score_events ... ON CONFLICT (user_id, source, ref_id) DO UPDATE`, (5) `revalidatePath('/[locale]/leaderboard')` + `/[locale]/matches` + `/[locale]/me`.
- **D-19** `score_events` schema: `(user_id uuid, source text CHECK (source IN ('league','prop','bracket')), ref_id uuid, points smallint NOT NULL, kind text NULL, updated_at timestamptz default now(), PRIMARY KEY (user_id, source, ref_id))`. PK is the idempotency key. `kind` drives SCR-07. Bracket source reserved, unused in Phase 2.
- **D-20** `v_leaderboard` view aggregates `score_events` with the LB-04 tiebreaker. Locale-aware alphabetical via Postgres collation — planner verifies HE+EN behavior.
- **D-21** `source = 'bracket'` is reserved but zero in Phase 2. Phase 3 writes bracket score_events; until then `bracket_total = 0` via aggregation.

**Props UI + RLS reveal (PRP-01/02/03/04, VIS-04, ADM-04):**
- **D-22** Single page with all ~5-10 prop questions visible, debounced save per card.
- **D-23** Single-team picker = 48-country flag grid (6×8). Tap-to-select with accent ring + opacity contrast.
- **D-24** Single-player + text = free-text input + admin alias-set on grading. `prop_questions` gains `correct_answer_aliases text[]` (or separate table — planner picks). Grader does case-insensitive trim+NFC match against alias set.
- **D-25** Lock reveal pattern: pre-first-kickoff = editable cards (user-only via RLS); post-first-kickoff (`tournament.starts_at <= now()`) RLS opens SELECT to all members. Card swaps to read-only reveal showing prompt + your answer + (if graded) correct answer + every family member's answer + per-pick `+pts` badge.

**Leaderboard + transparency (LB-01/02/03/04, SCR-07):**
- **D-26** Single ranked list at `/[locale]/leaderboard`. Server-rendered from `v_leaderboard`. Refresh via `revalidatePath` from admin Save Result.
- **D-27** LB-02 breakdown = inline expand on row. Single row expanded at a time.
- **D-28** Bracket subtotal placeholder = `0 — opens June 27` (EN) / `0 — נפתח 27 ביוני` (HE) — same string for every user until Phase 3 ships.
- **D-29** SCR-07 transparency placement = the match-row reveal (D-06) AND the leaderboard breakdown (D-27). No dedicated transparency page.

**Ship gate (QA-01/02/03/04):**
- **D-30** Single Playwright E2E smoke covering `invite → predict pre-lock → ❌attempt write post-lock (RLS rejects) → admin enters result → leaderboard reflects`. Multi-context (user A + admin). Lock simulation: seed a fixture with `kickoff_at = now() - interval '1 minute'` (post-lock) and `kickoff_at = now() + interval '5 minutes'` (pre-lock). No fake-time mocking.
- **D-31** QA-03 = QA-02 = same human pass by zekez. Includes I18N-06 bidi stress-test deferred from Phase 1 + seeded prop_questions HE copy review.
- **D-32** QA-04 distribution: 4 ship gates close → family WhatsApp message with URL + invite code. Binary, no staged rollout.
- **D-33** **W6 watchpoint: Vercel Hobby = 1 cron, already consumed by `/api/heartbeat`. Phase 2 ships NO new cron.** Integrity widget is server-component-on-pageload (D-15), not cron-driven. LGE-06 daily check is the same query executed on-demand from the widget.

### Claude's Discretion (per CONTEXT.md)

> Areas where CONTEXT.md explicitly defers to the planner. Research below provides recommendations.

- Exact debounce timing for D-03 optimistic save (recommend 600ms; valid range 400–900ms — pick based on Server Action latency benchmark).
- Stepper micro-interaction (long-press to repeat / haptic feedback) within Phase 1 tokens.
- Exact countdown banner pixel-height / sticky-offset math (UI-SPEC already fixed at 40px = `bs-10` and total sticky chrome 96px — planner reproduces, not invents).
- Whether the post-result row reveal uses an accordion, slide-down, or modal at small viewports. (UI-SPEC has already picked: always-expanded, no accordion in Phase 2.)
- Exact admin tab nav pattern inside `/admin/...` (top-level nav vs sidebar vs tabs above integrity widget).
- Player-card vs row-list rendering inside the props reveal (D-25).
- `score_events.kind` enum vs free-text column (D-19) — recommend text + CHECK constraint (see §"Don't Hand-Roll").
- Whether `v_leaderboard` is a regular VIEW or MATERIALIZED VIEW with refresh on Save Result. **Recommendation:** regular VIEW at 15-user / ~1500-row-total scale (see §"Architecture Patterns" §"Leaderboard query shape").
- Migration file naming after `0006`. **Recommendation:** sequential `0007_...`, `0008_...`, ... — Phase 1 append-only convention.
- Whether to extract a shared `scoreSaveAction.ts` helper for both League + Prop scoring (DRY) or keep them in their route handlers. **Recommendation:** shared helper at `src/lib/scoring/sweepAndUpsert.ts` taking `{ source, ref_id, scoredRows }` — same code path for both.
- Whether `prop_questions.correct_answer_aliases text[]` (D-24) is a column or a separate `prop_answer_aliases` table. **Recommendation:** `text[]` column on `prop_questions` for simplicity at 5–10 questions.
- Exact toast-vs-inline-checkmark animation timing (UI-SPEC has fixed: 150ms in / 1400ms hold / 450ms out = 2000ms total via CSS animation).
- Whether ADM-03's placeholder propagation Server Action uses recursive SQL or app-code loop. **Recommendation:** app-code loop (PITFALLS.md §3, consistent with D-16 debuggability principle).

### Deferred Ideas (OUT OF SCOPE)

> All from CONTEXT.md § `<deferred>`. Research below does NOT recommend solutions for these. Planner does NOT add tasks for these.

- Bracket Mode in full (Phase 3 — BRK-01..04, VIS-03, SCR-03). Phase 2 adds ET schema columns + reserves `source='bracket'` in `score_events`. Phase 3 builds UI + reveal granularity + scoring + RLS.
- Extra-time / penalty admin UI (Phase 3, D-12).
- Realtime leaderboard via Supabase Realtime subscription (v2, RT-01). Phase 2 uses `revalidatePath` + page-refresh-on-focus.
- Prediction history view per user (v2, HIST-01). `/[locale]/me` stays minimal — display name + locale + joined_at + total points + logout.
- Personalized stats, head-to-head (v2, STAT-01, H2H-01).
- Dark mode, charts, badges (v2, POL-01/02/03).
- WhatsApp / Telegram nudges (v2, NOTF-01) — family WhatsApp covers.
- Cloudflare Turnstile on join (Phase 1 D-02, post-launch).
- Bilingual admin pages — admin English-only (Phase 1 D-05).
- Player roster table for prop typeahead (D-24 — admin alias-set is v1).
- Vitest for scoring logic (defer per CLAUDE.md; add only if Playwright misses a bug).
- Audit history surface for admin corrections (`score_events.updated_at` is the DB-level audit).
- Cron consolidation inside `/api/heartbeat` (D-33 — Phase 2 needs zero scheduled work).
- Materialized `v_leaderboard` with manual refresh (regular VIEW at 15-user scale).
- Staged rollout / preview-environment invite distribution (D-32 — binary flip).

</user_constraints>

<phase_requirements>
## Phase Requirements

> 34 IDs from REQUIREMENTS.md, grouped by domain. The "Research Support" column points to the §s of this document that enable the implementation.

| ID | Description | Research Support |
|----|-------------|------------------|
| LGE-01 | Matchday list w/ kickoff time + lock state + existing prediction | §"Match list query shape", §"Code Examples — server-rendered match list" |
| LGE-02 | Stepper UX for home/away score predictions | UI-SPEC §Stepper; §"Saved indicator pattern" |
| LGE-03 | User can edit existing prediction up to kickoff | §"Kickoff-lock RLS pattern" — predicate `f.kickoff_at > now()` is on INSERT + UPDATE both |
| LGE-04 | RLS rejects INSERT/UPDATE after kickoff (Postgres-enforced) | §"Kickoff-lock RLS pattern" (already shipped Phase 1 — Phase 2 only needs UI + E2E) |
| LGE-05 | Explicit "saved" indicator after every prediction write | §"Optimistic debounced save"; UI-SPEC §SavedIndicator |
| LGE-06 | Daily integrity query confirms zero `submitted_at > kickoff_at` | §"Admin integrity widget" + D-15 — query lives in widget RSC |
| PRP-01 | User can answer all prop questions pre-first-kickoff | §"Props UI" + §"Tournament-starts_at reveal pattern" |
| PRP-02 | User can edit prop answers until first kickoff | §"Tournament-starts_at reveal pattern" — RLS predicate `t.starts_at > now()` |
| PRP-03 | RLS rejects INSERT/UPDATE to prop_answers post-first-kickoff | §"Tournament-starts_at reveal pattern" — already shipped Phase 1 |
| PRP-04 | Admin can grade prop questions | §"Admin prop grading flow" + D-13 + D-24 alias matching |
| VIS-01 | User can see own predictions/picks/answers any time | §"Phase 1 RLS heritage" — already shipped (`user_id = auth.uid()` SELECT branch) |
| VIS-02 | User cannot see others' predictions until kickoff (RLS-enforced) | §"Phase 1 RLS heritage" — `predictions_read` policy already does this |
| VIS-04 | User cannot see others' prop answers until first kickoff | §"Phase 1 RLS heritage" — `prop_answers_read` policy already does this |
| VIS-05 | Once locked, all players see all picks for that match/round | §"Phase 1 RLS heritage" — UI just displays what RLS lets through; D-06 reveal |
| ADM-01 | Admin enters fixture result | §"Admin score entry" + D-09 toggle + D-12 column choice |
| ADM-02 | Admin can correct result; scoring re-runs idempotently | §"Idempotent scoring recompute" + §"Server Action shape" |
| ADM-03 | Admin resolves knockout placeholders; downstream auto-updates | §"Placeholder resolution flow" + D-11 |
| ADM-04 | Admin can author, edit, grade prop questions | §"Admin props authoring/grading" + D-13 + D-24 |
| ADM-05 | Admin sees roster + merge tool | §"Roster merge flow" + D-14 + Phase 1 D-04 rebind pattern |
| ADM-06 | Admin sees daily lock-breach integrity check | §"Admin integrity widget" + D-15 |
| SCR-01 | League: 4 / 3 / 2 / 0 scoring (exact / goal-diff / winner / miss) | §"Scoring math placement" + §"Code Examples — scoreMatch" |
| SCR-02 | League uses 90-min result only (no ET/pens) | §"Result column choice" + D-12 — Phase 2 admin populates `_90min` |
| SCR-04 | Props scoring: admin-set point value per question | §"Code Examples — scoreProp" + D-24 alias matching |
| SCR-05 | Integer-only math in SQL | §"Scoring math placement" — TS returns smallint, no floats; `points smallint` in score_events |
| SCR-06 | Points are derived view; UPSERT on `(user_id, source, ref_id)` | §"score_events as canonical projection" + §"v_leaderboard shape" |
| SCR-07 | User can view per-pick transparency ("+4 exact" etc.) | §"Pts badge" + D-06 reveal embeds badges + D-27 leaderboard expand |
| LB-01 | Unified leaderboard ranked by total points | §"v_leaderboard shape" + §"Leaderboard query shape" |
| LB-02 | Click player → per-mode breakdown | §"Leaderboard inline expand" + D-27 |
| LB-03 | Leaderboard refreshes after admin enters result | §"revalidatePath strategy" + D-18 |
| LB-04 | Tiebreaker chain: total → exact → correct → alphabetical | §"v_leaderboard tiebreakers" + §"Hebrew collation strategy" |
| QA-01 | One Playwright E2E smoke `invite → predict → lock → result → leaderboard` | §"Playwright smoke architecture" + D-30 |
| QA-02 | Manual mobile QA HE+EN | §"Ship-gate (QA-01..04) automation" + D-31 |
| QA-03 | Hebrew native-speaker copy review | §"Ship-gate (QA-01..04) automation" + D-31 |
| QA-04 | Distribute URL + invite code by June 11 | §"Ship-gate (QA-01..04) automation" + D-32 — single launch checklist file |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Matchday feed render (LGE-01) | Frontend Server (RSC) | API/DB (Supabase RLS-filtered SELECT) | Server-rendered HTML with locale + dir set server-side; no client fetch loop. RSC queries `fixtures` + `predictions` directly via `createClient()`. |
| Stepper interaction + debounced save (LGE-02/03/05) | Browser (client component) | Frontend Server (Server Action) | Stepper is interactive — must be client. Save dispatches a Server Action with debounce/transition. |
| Kickoff lock enforcement (LGE-04) | Database (RLS) | — | Already shipped Phase 1. Client UI is cosmetic per D-08; the lock is the policy expression `f.kickoff_at > now()`. |
| Integrity check (LGE-06 / ADM-06) | Frontend Server (RSC) | Database (3 SQL counts) | Server component on every admin page load; no cron, no polling (D-15, D-33). |
| Scoring computation (SCR-01/02/04) | Frontend Server (pure TS) | — | Pure functions in `src/lib/scoring/*.ts`. No DB calls inside the scorer; the admin Server Action orchestrates read → score → UPSERT. |
| Scoring idempotency (SCR-06, ADM-02) | Database (PK on `score_events`) | Frontend Server (UPSERT semantics) | PK `(user_id, source, ref_id)` is the idempotency key — DB layer absolutely guarantees no double-counts even if the Server Action runs twice. |
| Leaderboard aggregation (LB-01/02/04) | Database (`v_leaderboard` VIEW) | Frontend Server (RSC reads view) | Single SQL view aggregates and tiebreaks. RSC selects directly. |
| Leaderboard refresh after result (LB-03) | Frontend Server (`revalidatePath`) | Database (view re-evaluated on next read) | Server Action calls `revalidatePath` for 3 paths after UPSERT. Next user navigation sees fresh totals. |
| Visibility lock-and-reveal (VIS-01/02/04/05) | Database (RLS) | Frontend Server (RSC reads what RLS allows) | RLS is the only gate — UI just renders the rows it gets. Already shipped Phase 1. |
| Admin gate (`/admin/*`) | Frontend Server (`requireAdmin()` in (protected) layout) | Database (B1 column GRANT prevents UPDATE of `is_admin`) | Already shipped Phase 1. Phase 2 admin pages inherit. |
| Admin write (overwrite result, grade prop, resolve placeholder, merge user) | Frontend Server (service-role Server Action) | Database (writes bypass RLS) | `createServiceClient()` is the established pattern. Each admin action calls `await requireAdmin()` first. |
| Props player UI (PRP-01/02) | Browser (client) | Frontend Server (Server Action save) | Same shape as LGE-02 — debounced save on each prop card. |
| Props lock-and-reveal (PRP-03, VIS-04) | Database (RLS on `prop_answers`) | Frontend Server (RSC variant swap) | Phase 1 RLS already enforces. UI just swaps editable card → reveal card based on `t.starts_at <= now()`. |
| Countdown banner (D-07) | Browser (client component) | Frontend Server (passes initial server-anchored kickoff list as prop) | Ticks client-side; never reads DB on its own. Server passes ISO + locale-formatted team names. |
| Playwright smoke (QA-01) | Test runner (multi-context) | All of the above | Tests run against deployed-or-local Next.js + real Supabase preview branch (or seeded local supabase). |

## Standard Stack

### Core (already shipped Phase 1 — reuse, do NOT reinstall)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | `15.5.18` | App Router, Server Components, Server Actions, `revalidatePath` | Pinned Phase 1 — DO NOT bump to 16.x mid-deadline. Locked by Phase 1 Plan 01-01 deviation. `[VERIFIED: package.json line 26]` |
| React | `^19.0.0` | Server Components + `useActionState` + `useOptimistic` + `useTransition` | Ships with Next 15.5. `[VERIFIED: package.json]` |
| TypeScript | `^5` (strict) | Type safety incl. generated Supabase types | Phase 1 sets up `src/types/supabase.ts` workflow. `[VERIFIED: package.json]` |
| Tailwind CSS | `^4.3.0` | Logical-property utilities for RTL | v4 — note CRITICAL: use `[var(--zc-X)]` form inside brackets (Phase 1 P05 deviation #3). `[VERIFIED: package.json + STATE.md Phase 1 D-decisions]` |
| Supabase | `@supabase/ssr ^0.5.2` + `@supabase/supabase-js ^2.45.0` | Postgres + Auth + RLS + service-role | Established clients at `src/lib/supabase/{server,client,middleware,service}.ts`. `[VERIFIED: package.json]` |
| next-intl | `^4.0.0` | App Router i18n; `getTranslations()` on server, `useTranslations()` on client | Phase 1 message bundles at `messages/{he,en}.json`. `[VERIFIED: package.json]` |
| Zod | `^4.0.0` | Shared client/server schemas | Pattern from `src/lib/schemas/{join,displayName}.ts`. `[VERIFIED: package.json]` |
| Heebo + Inter | self-hosted via `next/font/google` | Hebrew + Latin typography (400 / 700 only) | Phase 1 `[locale]/layout.tsx`. `[VERIFIED: src/app/[locale]/layout.tsx]` |

### Supporting (NEW — to install in Wave 0)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **Playwright** | `^1.55.0` (current — verify w/ `npm view @playwright/test version`) | E2E test runner for QA-01 smoke | Wave 0: install + `playwright.config.ts` + one test file. Multi-context (two browser contexts → two roles in one test) per D-30. `[VERIFIED: Playwright auth docs] [ASSUMED: current minor version — confirm with npm view at install time]` |

### Tools That Already Exist (Phase 1 — DO NOT re-add)

| Tool | Already provides | Source |
|------|-----------------|--------|
| ESLint flat config + `eslint-config-next@15.5.18` | Lint | `eslint.config.mjs` |
| `npm run lint:rtl` | Catches `pl-/pr-/ml-/mr-/text-left/text-right/border-l-/border-r-/left-/right-` | `package.json` — `! grep -REn ... \|\| (echo ... && exit 1)` |
| `.husky/pre-commit` + `.github/workflows/lint.yml` | Both run `lint:rtl + typecheck`, both block on failure | Phase 1 P05 |
| Supabase CLI + `npm run db:types` | Regenerate `src/types/supabase.ts` | `package.json` |
| `npm run seed:build` + CSVs | Source-of-truth seed pipeline | `scripts/build-seed-sql.ts` + `data/wc2026/*.csv` |
| `scripts/verify-rls-no-leak.sh` | Anon-curl smoke for RLS leaks | Phase 1 P02 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bulk-UPSERT sweep in Server Action | Postgres trigger on `match_results` UPDATE | Trigger debugging at 2am is brutal; D-16 already chose Server Action. Trigger remains a fallback only if Server Action latency creates UX issues. |
| Regular `v_leaderboard` VIEW | `MATERIALIZED VIEW` with `REFRESH` on Save Result | At 15 users × ~120 score_events each ≈ 1.8k rows, aggregation is sub-ms. Materialize only if profiling shows >100ms p95 leaderboard load. |
| `text[]` for `prop_questions.correct_answer_aliases` | Separate `prop_answer_aliases` table | Array works for 5–10 props × a handful of aliases each. Table-per-prop is over-engineered. |
| `revalidatePath('/[locale]/leaderboard')` × 2 (he + en) | `revalidatePath('/leaderboard', 'page')` with path-pattern | Path-pattern requires literal `[locale]` segment in the call — works but error-prone. Explicit `/he/leaderboard` + `/en/leaderboard` is verbose but obvious. **Recommendation:** explicit pair. `[CITED: nextjs.org/docs/app/api-reference/functions/revalidatePath]` |
| Postgres trigger to maintain `score_events` | None (Server Action only) | D-16 chose Server Action for debuggability. Trigger is a Phase 2.x escape hatch. |
| `useOptimistic` for stepper saves | Plain client state + `useTransition` | `useOptimistic` is designed for this pattern, but the stepper's saved-state lives in DB only after the Server Action; the local stepper state is just the latest user click. Plain `useTransition` + parent-component-driven re-render via `revalidatePath` is simpler. **Recommendation:** Try `useTransition` first; promote to `useOptimistic` only if save-failure rollback proves janky. |
| Cloudflare Turnstile on join | Already deferred (Phase 1 D-02) | — |

**Installation:**
```bash
npm install --save-dev @playwright/test
npx playwright install --with-deps chromium
# After install: rewrite lockfile JFrog → npmjs, commit lockfile
sed -i.bak 's|https://jfrogrepo24.jfrog.io/artifactory/api/npm/npm-virtual/|https://registry.npmjs.org/|g' package-lock.json && rm package-lock.json.bak
```

**Version verification:** `npm view @playwright/test version` at install time. `[ASSUMED: ^1.55.0 — confirm at install]`

## Architecture Patterns

### System Architecture Diagram

```
                              ┌─────────────────────────────────────┐
                              │  Vercel Cron (existing /api/heartbeat)│
                              │  -- DO NOT ADD A NEW CRON (D-33)    │
                              └─────────────────────────────────────┘

  Browser (user)                  Frontend Server (Next.js RSC + Server Actions)              Database (Supabase Postgres)
  ───────────────                 ──────────────────────────────────────────                  ──────────────────────────────
                                                                                              
  ┌──────────────┐                ┌─────────────────────────────┐                             ┌────────────────────────┐
  │ /matches     ├───── RSC ─────►│ MatchesPage (server comp)   │──── SELECT (anon JWT) ─────►│ fixtures + predictions │
  │ stepper      │                │  ↓ getCurrentMember         │                              │ RLS: own + post-kickoff│
  │ click ±      ├──Server────────►│ joinPool / savePrediction  │──── UPSERT (anon JWT) ─────►│ predictions            │
  │  (debounce)  │  Action         │ (debounced 600ms)          │                              │ RLS: kickoff_at > now()│
  │              │◄─Saved indicator┤  ↓ revalidatePath(/matches)│                              │                        │
  └──────────────┘                └─────────────────────────────┘                             └────────────────────────┘

  ┌──────────────┐                ┌─────────────────────────────┐                             ┌────────────────────────┐
  │ /props       ├──── RSC ──────►│ PropsPage (server comp)     │──── SELECT ────────────────►│ prop_questions         │
  │ flag grid    │                │  variant: editable | reveal │                              │ prop_answers           │
  │ click flag   ├── Server ─────►│ savePropAnswer (debounced)  │──── UPSERT ────────────────►│ RLS: t.starts_at > now()│
  └──────────────┘                └─────────────────────────────┘                             └────────────────────────┘

  ┌──────────────┐                ┌─────────────────────────────┐                             ┌────────────────────────┐
  │ /admin/matches              ──►│ AdminMatchesPage (RSC)     │                             │                        │
  │ view <-> entry mode           │  ↓ requireAdmin (Phase 1)   │                             │                        │
  │ Save Result button├─Server───►│ saveResult Server Action   │                              │                        │
  │   (admin)        │   Action   │  service-role client       │                              │                        │
  │                  │            │  1. read predictions       │──── SELECT (svc) ──────────►│ predictions (no RLS)   │
  │                  │            │  2. score in TS (lib/scor) │                              │                        │
  │                  │            │  3. UPSERT score_events    │──── UPSERT (svc) ──────────►│ score_events           │
  │                  │            │  4. UPDATE fixtures.result │──── UPDATE (svc) ──────────►│ fixtures.result_*_90min│
  │                  │            │  5. revalidatePath × 3     │                              │                        │
  └──────────────────┘            └─────────────────────────────┘                             └────────────────────────┘
                                                                                                       │
  ┌──────────────┐                ┌─────────────────────────────┐                                       ▼
  │ /leaderboard├───── RSC ──────►│ LeaderboardPage (server)    │──── SELECT ────────────────►┌────────────────────────┐
  │ inline      │                │  query v_leaderboard        │                              │ v_leaderboard (VIEW)   │
  │  expand     │                └─────────────────────────────┘                              │ aggregates score_events│
  │             │                                                                              │ + LB-04 tiebreaker chain│
  └──────────────┘                                                                              └────────────────────────┘

  ┌──────────────────────────┐    ┌─────────────────────────────┐                             ┌────────────────────────┐
  │ /admin/tournament-tree   ├───►│ adminResolveSlot Server Act │──── UPDATE (svc) ──────────►│ fixtures.home_team_id /│
  │                          │    │  app-loop down placeholder  │                              │ away_team_id           │
  │                          │    │  chain (PITFALLS §3)        │                              │ bracket_slots.resolved │
  └──────────────────────────┘    └─────────────────────────────┘                             └────────────────────────┘

  ┌──────────────────────────┐    ┌─────────────────────────────┐                             ┌────────────────────────┐
  │ /admin/props (author/grade)──►│ adminGradeProp Server Action│──── UPDATE/UPSERT (svc) ──►│ prop_questions         │
  │                          │    │  same sweep shape as result│                              │ (correct_answer +alias)│
  │                          │    │  source='prop'              │                              │ score_events (UPSERT)  │
  └──────────────────────────┘    └─────────────────────────────┘                             └────────────────────────┘

  ┌──────────────────────────┐    ┌─────────────────────────────┐                             ┌────────────────────────┐
  │ /admin/roster (merge)   ├───►│ adminMergeUsers Server Act  │──── UPDATE (svc) ──────────►│ profiles + 3 FK tables │
  │                          │    │  same pattern as Phase 1   │                              │ + auth.users.deleteUser│
  │                          │    │  D-04 rebind                │                              │                        │
  └──────────────────────────┘    └─────────────────────────────┘                             └────────────────────────┘

  ┌──────────────────────────┐    ┌─────────────────────────────┐                             ┌────────────────────────┐
  │ /admin/* (integrity widget──►│ IntegrityWidget (RSC)       │──── 3 × COUNT(*) (svc) ────►│ predictions (LGE-06)   │
  │   bottom of every page) │    │  Database Sync + Total +    │                              │ fixtures (unscored)    │
  │                          │    │  Unscored Completed         │                              │                        │
  └──────────────────────────┘    └─────────────────────────────┘                             └────────────────────────┘
```

### Recommended Project Structure (extends Phase 1 — additions in **bold**)

```
src/
├── app/
│   ├── [locale]/
│   │   ├── matches/
│   │   │   └── page.tsx                  (Phase 1 — REPLACE empty-state with feed; LGE-01)
│   │   ├── props/
│   │   │   └── page.tsx                  ★ NEW (PRP-01)
│   │   ├── leaderboard/
│   │   │   └── page.tsx                  (Phase 1 — REPLACE empty-state with v_leaderboard; LB-01)
│   │   └── me/page.tsx                   (Phase 1 — append `total_points` row; LB-02 link to drill-down lives in leaderboard expand instead)
│   ├── admin/
│   │   ├── (protected)/
│   │   │   ├── layout.tsx                (Phase 1 — APPEND <IntegrityWidget /> after children; D-15)
│   │   │   ├── page.tsx                  (Phase 1 — REPLACE placeholder with admin home nav)
│   │   │   ├── matches/page.tsx          ★ NEW (ADM-01/02; D-09 toggle)
│   │   │   ├── tournament-tree/page.tsx  ★ NEW (ADM-03; D-11)
│   │   │   ├── props/page.tsx            ★ NEW (ADM-04; D-13)
│   │   │   └── roster/page.tsx           ★ NEW (ADM-05; D-14)
│   └── actions/
│       ├── join.ts                       (Phase 1)
│       ├── locale.ts                     (Phase 1)
│       ├── signout.ts                    (Phase 1)
│       ├── savePrediction.ts             ★ NEW — user-scoped, anon JWT, RLS-bound; debounced from client
│       ├── savePropAnswer.ts             ★ NEW
│       ├── saveResult.ts                 ★ NEW — admin, service-role, D-18 sweep
│       ├── gradeProp.ts                  ★ NEW — admin, service-role, D-13 sweep
│       ├── resolvePlaceholder.ts         ★ NEW — admin, service-role, D-11
│       └── mergeUsers.ts                 ★ NEW — admin, service-role, D-14 (same shape as Phase 1 rebind)
├── components/
│   ├── ui/
│   │   ├── FormField.tsx                 (Phase 1)
│   │   ├── PtsBadge.tsx                  ★ NEW (UI-SPEC §5)
│   │   └── SavedIndicator.client.tsx     ★ NEW (UI-SPEC §10)
│   ├── matches/
│   │   ├── MatchRow.client.tsx           ★ NEW (UI-SPEC §2)
│   │   ├── MatchRowStepper.client.tsx    ★ NEW (UI-SPEC §1)
│   │   ├── MatchRowLocked.tsx            ★ NEW (UI-SPEC §3, server-renderable when known-locked)
│   │   ├── MatchRowResulted.tsx          ★ NEW (UI-SPEC §4)
│   │   ├── CountdownBanner.client.tsx    ★ NEW (UI-SPEC §6)
│   │   └── DateGroupHeader.tsx           ★ NEW (UI-SPEC §7)
│   ├── props/
│   │   ├── PropCard.client.tsx           ★ NEW
│   │   └── FlagGrid.client.tsx           ★ NEW (UI-SPEC §9)
│   ├── leaderboard/
│   │   └── LeaderboardRow.client.tsx     ★ NEW (UI-SPEC §8)
│   └── admin/
│       ├── AdminModeToggle.client.tsx    ★ NEW (UI-SPEC §11)
│       ├── AdminResultInputs.client.tsx  ★ NEW (UI-SPEC §12)
│       └── IntegrityWidget.tsx           ★ NEW (UI-SPEC §13)
├── lib/
│   ├── scoring/
│   │   ├── league.ts                     ★ NEW — scoreMatch(prediction, result) → { points, kind } (D-17)
│   │   ├── props.ts                      ★ NEW — scoreProp(answer, correctAnswer, answerType, points, aliases) → number
│   │   └── sweepAndUpsert.ts             ★ NEW — shared helper for D-18 bulk-upsert (recommended above)
│   ├── schemas/
│   │   ├── displayName.ts                (Phase 1)
│   │   ├── join.ts                       (Phase 1)
│   │   ├── prediction.ts                 ★ NEW — { fixture_id, home_score: 0–9, away_score: 0–9 }
│   │   ├── result.ts                     ★ NEW — admin Save Result input
│   │   ├── propAnswer.ts                 ★ NEW — variant per answer_type
│   │   └── propAuthoring.ts              ★ NEW — admin author + grade input
│   ├── auth/{admin,session}.ts           (Phase 1)
│   ├── supabase/{server,client,middleware,service}.ts (Phase 1)
│   └── i18n/{routing,request}.ts         (Phase 1)
├── middleware.ts                         (Phase 1)
└── types/supabase.ts                     (regen after every migration)

supabase/
└── migrations/
    ├── 0001_init.sql                     (Phase 1)
    ├── 0002_rls.sql                      (Phase 1)
    ├── 0003_grants.sql                   (Phase 1)
    ├── 0004_anon_select.sql              (Phase 1)
    ├── 0005_seed_wc2026.sql              (Phase 1 — historical)
    ├── 0006_reseed_wc2026.sql            (Phase 1)
    ├── 0007_score_events.sql             ★ NEW — table + RLS + GRANT
    ├── 0008_v_leaderboard.sql            ★ NEW — view + GRANT
    ├── 0009_fixtures_result_full.sql     ★ NEW — ALTER TABLE add _full columns (D-12)
    └── 0010_prop_questions_aliases.sql   ★ NEW — ALTER TABLE add correct_answer_aliases text[] (D-24)

tests/e2e/                                ★ NEW
├── playwright.config.ts                  ★ NEW
├── smoke.spec.ts                         ★ NEW — D-30 single E2E
└── fixtures/
    └── auth.ts                           ★ NEW — storageState helpers
```

### Pattern 1: Kickoff-lock RLS pattern (LGE-04, VIS-02, PRP-03, VIS-04)

**What:** RLS policies on `predictions` and `prop_answers` already reference `fixtures.kickoff_at` (and `tournament.starts_at`) via correlated EXISTS subqueries. Phase 1 shipped them at `supabase/migrations/0002_rls.sql`. Phase 2 should NOT modify these — only inherit them.

**When to use:** Anywhere a write must be locked at a server-anchored time. Phase 2 uses these unchanged.

**Example (existing policies — copy for reference, do not re-author):**

```sql
-- supabase/migrations/0002_rls.sql:113-120 — predictions_insert
create policy predictions_insert on public.predictions
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.fixtures f
      where f.id = fixture_id and f.kickoff_at > now()
    )
  );

-- 0002_rls.sql:122-131 — predictions_update has identical predicate on WITH CHECK
-- 0002_rls.sql:104-111 — predictions_read has the visibility-reveal half:
--   user_id = (select auth.uid())
--   OR exists (... f.kickoff_at <= now())  -- post-kickoff reveals all
```

**Confidence:** HIGH `[VERIFIED: supabase/migrations/0002_rls.sql lines 113-140]`

**Performance note:** Supabase's RLS performance guide warns that subquery RLS predicates on unindexed columns are the #1 perf killer. `fixtures.kickoff_at` IS indexed via `fixtures_kickoff_idx` (0001_init.sql:75) — verified. `auth.uid()` is wrapped as `(select auth.uid())` per Phase 1 VIS-06 (initPlan caching). `[CITED: supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv]` `[VERIFIED: 0001_init.sql:75]`

### Pattern 2: Tournament-starts_at reveal pattern (PRP-03, VIS-04)

**Existing policy:**

```sql
-- 0002_rls.sql:165-173 — prop_answers_insert
create policy prop_answers_insert on public.prop_answers
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.tournament t
      join public.prop_questions q on q.tournament_id = t.id
      where q.id = question_id and t.starts_at > now()
    )
  );
```

**Note:** `tournament.starts_at = 2026-06-11T19:00:00Z` is seeded in 0006_reseed_wc2026.sql:70 — confirmed. The props UI variant swap (D-25) reads this same column at RSC render time to decide editable vs reveal layout.

**Confidence:** HIGH `[VERIFIED: supabase/migrations/0002_rls.sql:155-195 + 0006_reseed_wc2026.sql:70]`

### Pattern 3: Optimistic debounced save (LGE-05, D-03)

**What:** Stepper renders, user clicks +/−, local React state updates immediately ("optimistic" — already shown), a debounced timer (`useRef<NodeJS.Timeout>` cleared on each click) schedules a `startTransition(() => savePrediction(...))` 600ms after the last click. Server Action awaits the UPSERT (RLS validates kickoff), returns success/failure, then `revalidatePath('/[locale]/matches')`. SavedIndicator mounts via a `key={savedAt}` re-key on success.

**When to use:** LGE-05 prediction save + PRP-01 prop save. NOT for admin Save Result (that's an explicit button — D-09).

**Example (skeleton — planner authors final):**

```typescript
// src/components/matches/MatchRowStepper.client.tsx (sketch)
'use client';
import { useTransition, useRef, useState, useEffect } from 'react';
import { savePrediction } from '@/app/actions/savePrediction';

const DEBOUNCE_MS = 600;

export function MatchRowStepper({ fixtureId, initialHome, initialAway }: Props) {
  const [home, setHome] = useState(initialHome);
  const [away, setAway] = useState(initialAway);
  const [_, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Schedule a save after the user stops clicking for DEBOUNCE_MS.
  useEffect(() => {
    if (home === initialHome && away === initialAway) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      startTransition(async () => {
        const res = await savePrediction({ fixture_id: fixtureId, home_score: home, away_score: away });
        if (res?.error) {
          setHome(initialHome);
          setAway(initialAway);
          setError(res.error); // 'locked' | 'network' | 'validation'
        } else {
          setSavedAt(Date.now());
          setError(null);
        }
      });
    }, DEBOUNCE_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [home, away]);

  return ( /* stepper UI from UI-SPEC §1 + SavedIndicator key={savedAt} + error inline */ );
}
```

**Critical:** the save MUST NOT call `redirect()` — D-pattern from Phase 1 Pattern 14 is `<form action> + redirect()`. For mutate-and-stay flows, use `startTransition` + plain async + parent re-render via `revalidatePath`. **The stepper is a mutate-and-stay flow.**

**Confidence:** HIGH `[CITED: react.dev/reference/react/useTransition + nextjs.org/docs/app/api-reference/functions/revalidatePath + Phase 1 Pattern 14 at STATE.md]`

### Pattern 4: Scoring math placement (SCR-01/02/04/05, D-17)

**What:** Pure TypeScript functions in `src/lib/scoring/league.ts` and `src/lib/scoring/props.ts`. No DB calls; no `import` of Supabase clients.

**Canonical signatures:**

```typescript
// src/lib/scoring/league.ts
export type LeagueKind = 'exact' | 'goal-diff' | 'winner' | 'miss';
export type LeagueScore = { points: number; kind: LeagueKind };
export type LeaguePrediction = { home_score: number; away_score: number };
export type LeagueResult = { result_home_90min: number; result_away_90min: number };

export function scoreMatch(p: LeaguePrediction, r: LeagueResult): LeagueScore {
  if (p.home_score === r.result_home_90min && p.away_score === r.result_away_90min) {
    return { points: 4, kind: 'exact' };
  }
  const predDiff = p.home_score - p.away_score;
  const realDiff = r.result_home_90min - r.result_away_90min;
  if (predDiff === realDiff && predDiff !== 0) {
    return { points: 3, kind: 'goal-diff' };
  }
  // winner = same sign (both positive, both negative, or both zero AND not exact)
  if (Math.sign(predDiff) === Math.sign(realDiff)) {
    return { points: 2, kind: 'winner' };
  }
  return { points: 0, kind: 'miss' };
}
```

```typescript
// src/lib/scoring/props.ts
import type { Json } from '@/types/supabase';

export type PropAnswerType = 'single_team' | 'single_player' | 'text';
export type PropScore = { points: number; kind: 'correct' | 'miss' };

export function scoreProp(opts: {
  userAnswer: string;
  correctAnswer: string;
  answerType: PropAnswerType;
  pointsAtStake: number;
  aliases?: readonly string[];
}): PropScore {
  const norm = (s: string) => s.trim().normalize('NFC').toLowerCase();
  const target = norm(opts.correctAnswer);
  const aliasSet = new Set([target, ...(opts.aliases ?? []).map(norm)]);

  if (opts.answerType === 'single_team') {
    // Team IDs (UUID) — exact match, case doesn't matter but normalize anyway
    return aliasSet.has(norm(opts.userAnswer))
      ? { points: opts.pointsAtStake, kind: 'correct' }
      : { points: 0, kind: 'miss' };
  }

  // single_player + text — fuzzy via alias set (D-24)
  return aliasSet.has(norm(opts.userAnswer))
    ? { points: opts.pointsAtStake, kind: 'correct' }
    : { points: 0, kind: 'miss' };
}
```

**Why pure TS, not SQL:** D-16 explicit choice; SCR-05 "integer-only math" is satisfied trivially in TypeScript (the function returns `smallint`-compatible numbers, the score_events column is `smallint`, no floats touch the wire). Postgres triggers are harder to debug at 2am.

**Confidence:** HIGH `[VERIFIED: CONTEXT.md D-16/17, REQUIREMENTS.md SCR-01/02/04/05]`

### Pattern 5: Idempotent scoring recompute (SCR-06, ADM-02, D-10, D-18)

**What:** Admin Save Result triggers a Server Action that (a) reads `predictions WHERE fixture_id = ?` under service-role, (b) scores each in TS, (c) bulk `UPSERT INTO score_events ... ON CONFLICT (user_id, source, ref_id) DO UPDATE SET points = ..., kind = ..., updated_at = now()`, (d) updates `fixtures.result_*_90min`, (e) `revalidatePath` × 3. Calling this twice produces the same DB state — idempotency by construction of the PK.

**Critical PK shape (D-19):** `PRIMARY KEY (user_id, source, ref_id)`. `source` is `'league' | 'prop' | 'bracket'` (CHECK constrained). `ref_id` is `fixture_id` for league, `question_id` for prop, `slot_id` for bracket. This means:
- Re-running league scoring for fixture X re-UPSERTs each user's `(user, 'league', X)` row in place.
- Re-running prop grading for question Y re-UPSERTs each user's `(user, 'prop', Y)` row in place.
- Two different fixtures → two different rows for the same user. Sums to `total` correctly via `SUM(points)`.

**Example Server Action (skeleton):**

```typescript
// src/app/actions/saveResult.ts (sketch)
'use server';
import { requireAdmin } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/service';
import { scoreMatch } from '@/lib/scoring/league';
import { revalidatePath } from 'next/cache';

export async function saveResult(input: { fixture_id: string; result_home_90min: number; result_away_90min: number }) {
  await requireAdmin();
  const svc = createServiceClient();

  // 1. Persist the result (Phase 2 admin populates _90min only; D-12)
  const { error: e1 } = await svc.from('fixtures')
    .update({ result_home_90min: input.result_home_90min, result_away_90min: input.result_away_90min, updated_at: new Date().toISOString() })
    .eq('id', input.fixture_id);
  if (e1) return { error: e1.message };

  // 2. Read all predictions for this fixture
  const { data: preds, error: e2 } = await svc.from('predictions').select('user_id, home_score, away_score').eq('fixture_id', input.fixture_id);
  if (e2) return { error: e2.message };

  // 3. Score in TS + build UPSERT rows
  const rows = (preds ?? []).map(p => {
    const { points, kind } = scoreMatch(p, input);
    return { user_id: p.user_id, source: 'league', ref_id: input.fixture_id, points, kind };
  });

  // 4. Bulk UPSERT. If no predictions, skip the network call.
  if (rows.length > 0) {
    const { error: e3 } = await svc.from('score_events').upsert(rows, { onConflict: 'user_id,source,ref_id' });
    if (e3) return { error: e3.message };
  }

  // 5. Revalidate (LB-03). Explicit per-locale.
  revalidatePath('/he/leaderboard');
  revalidatePath('/en/leaderboard');
  revalidatePath('/he/matches');
  revalidatePath('/en/matches');
  revalidatePath('/he/me');
  revalidatePath('/en/me');

  return { ok: true };
}
```

**Edge case — predictions that no longer exist after correction:** If a user deleted their prediction (RLS allows DELETE pre-kickoff; not exposed in Phase 2 UI but the policy exists at 0002_rls.sql:133-140), the `score_events` row for that user persists with stale points. Defensive: before the UPSERT, also DELETE FROM `score_events` WHERE `source='league' AND ref_id=fixture_id AND user_id NOT IN (the new preds set)`. **Recommendation:** include a `DELETE ... WHERE ref_id = ? AND source = ? AND user_id NOT IN ($users)` ahead of the UPSERT in `sweepAndUpsert.ts`. PITFALLS §3 explicitly calls this out — "derived projection" implies sweep, not append.

**Confidence:** HIGH `[VERIFIED: CONTEXT.md D-10/18/19 + REQUIREMENTS.md SCR-06]`

### Pattern 6: Leaderboard query shape (LB-01/02/04, D-20)

**What:** A single SQL VIEW aggregates `score_events` joined to `profiles`, applies the tiebreaker chain in `ORDER BY`.

**Recommended view definition (planner refines column names if `display_name_normalized` is preferred):**

```sql
-- supabase/migrations/0008_v_leaderboard.sql (sketch)
create or replace view public.v_leaderboard as
select
  p.user_id,
  p.display_name,
  coalesce(sum(se.points), 0)::int                                                     as total,
  coalesce(sum(se.points) filter (where se.source = 'league'), 0)::int                  as league_total,
  coalesce(sum(se.points) filter (where se.source = 'prop'),   0)::int                  as props_total,
  coalesce(sum(se.points) filter (where se.source = 'bracket'),0)::int                  as bracket_total,
  coalesce(count(*) filter (where se.kind = 'exact'), 0)::int                           as exact_count,
  coalesce(count(*) filter (where se.kind in ('exact','goal-diff','winner','correct')), 0)::int as correct_count
from public.profiles p
left join public.score_events se on se.user_id = p.user_id
group by p.user_id, p.display_name;
-- The view does NOT order — leave ORDER BY to the consumer so we can pick the
-- right collation at query time depending on Hebrew vs English (see Pitfall on
-- collation availability below).
grant select on public.v_leaderboard to authenticated;
-- Note: no RLS on a VIEW; RLS on the underlying tables (`profiles`, `score_events`)
-- still applies. Both have permissive SELECT for authenticated, so the view is
-- effectively public-to-members — exactly what LB-01 requires.
```

**Consumer side (RSC):**

```typescript
// src/app/[locale]/leaderboard/page.tsx (sketch)
const { data } = await supabase
  .from('v_leaderboard')
  .select('*')
  .order('total', { ascending: false })
  .order('exact_count', { ascending: false })
  .order('correct_count', { ascending: false })
  .order('display_name', { ascending: true });  // see Hebrew collation note below
```

**Why a VIEW not a MATERIALIZED VIEW:** At 15 users and an upper bound of ~120 league + ~10 props × 15 = ~1.95k `score_events` rows for the whole tournament, the aggregation is sub-millisecond. Promoting to materialized view introduces a `REFRESH MATERIALIZED VIEW` chore on every Save Result, which would have to live inside the Server Action — extra failure mode for zero perf gain. `[VERIFIED: math from CONTEXT.md scale]`

**Confidence:** HIGH on view shape; MEDIUM on the precise `display_name` ORDER BY clause (see Hebrew collation strategy below).

### Pattern 7: Hebrew collation strategy (LB-04 tiebreaker, D-20)

**The challenge:** LB-04 says "locale-aware alphabetical display name." For an HE locale user we want `אבגד...יזחט` order to behave; for an EN locale user we want `A → Z`. But the data has mixed-script names (`Dani`, `דני`, `Sam`, `שירה`) and the leaderboard renders the same DB rows in both locales.

**What works on Supabase Postgres (15+):**

1. **`und-x-icu`** (Unicode locale-neutral) — uses Unicode Collation Algorithm; handles mixed-script reasonably. Probably available on Supabase, but **NOT guaranteed** — the supabase/postgres GitHub issue thread says some ICU collations are missing on certain build paths. `[CITED: github.com/supabase/postgres/issues/1133]`
2. **`he-x-icu`** — Hebrew-aware ICU. Same caveat about availability.
3. **`lower(display_name) COLLATE "C"`** — byte-order on lowercased text. Predictable, NO locale awareness. Hebrew sorts after Latin (UTF-8 byte order).
4. **App-side sort using `Intl.Collator`** — no DB collation needed; the RSC fetches all 15 rows and sorts in TS before render. `Intl.Collator(locale, { sensitivity: 'base' }).compare(a, b)` does the right thing for both locales.

**Recommendation:** Use option (4) for v1. The DB returns all rows (15 max), the RSC sorts in TS via `Intl.Collator(locale)`. This avoids the ICU-availability question entirely AND gives the right answer per-locale (HE viewers see HE-sorted, EN viewers see EN-sorted — both can be right at once). For the 4-key sort, do an array sort with a `(a, b) => a.total - b.total || a.exact_count - b.exact_count || ... || collator.compare(a.display_name, b.display_name)` comparator. Cost: 15 rows × log(15) compares ≈ negligible.

**Plan B (if planner objects to TS sort):** Pre-flight `SELECT collname FROM pg_collation WHERE collname LIKE 'und%' OR collname LIKE 'he%'` once on the live Supabase project. If `und-x-icu` exists, use it. If not, fall back to `lower(display_name)` for byte-order — accepting that the alphabetical tiebreak is "good enough" since it's tiebreak #4 (rarely visible).

**Confidence:** HIGH on TS sort approach; LOW on which ICU collations are present on Supabase Postgres 15. `[ASSUMED: ICU availability — verify with `select collname from pg_collation where collname like '%icu%'` on tjivukpxuhbrbshidbfv]`

### Pattern 8: Match list query shape (LGE-01)

**RSC pattern:**

```typescript
// src/app/[locale]/matches/page.tsx (sketch)
import { createClient } from '@/lib/supabase/server';
import { requireMember } from '@/lib/auth/session';

export default async function MatchesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const member = await requireMember(locale);
  const supabase = await createClient();

  // Single query — JOIN-via-embed. predictions visible per RLS:
  //   own predictions: always
  //   others' predictions: only if fixture.kickoff_at <= now()
  // Phase 2 displays "all picks side-by-side" only on resulted rows (D-06),
  // so for the not-yet-locked rows we filter to user's own:
  const { data: fixtures } = await supabase
    .from('fixtures')
    .select(`
      id, external_match_no, stage, group_code, kickoff_at,
      home_team_id, away_team_id, home_placeholder, away_placeholder,
      result_home_90min, result_away_90min,
      home_team:teams!fixtures_home_team_id_fkey ( id, code, name_en, name_he ),
      away_team:teams!fixtures_away_team_id_fkey ( id, code, name_en, name_he ),
      predictions ( user_id, home_score, away_score, submitted_at,
                    profiles:user_id ( display_name ) )
    `)
    .order('kickoff_at', { ascending: true });

  // Group by date in viewer's local TZ for sticky headers.
  // ...
}
```

**Caveats:**
1. The `predictions` embed will return BOTH the viewer's own predictions AND (for kickoff-passed fixtures) every family member's. RLS does the filtering for free.
2. `score_events` should be embedded too so post-result reveal can render `+pts` badges without a second query — add `score_events ( user_id, points, kind )` to the select.
3. With 104 fixtures × maybe 15 users × 1 prediction each = ~1560 rows worst-case in the response. That's fine for free-tier egress but plan for pagination if it ever grows. **Not a Phase 2 concern.**

**Confidence:** MEDIUM on the exact embed syntax (Supabase PostgREST embeds have non-obvious type semantics — generated types help). Planner should write the query, run `npm run db:types`, and let TS verify.

### Anti-Patterns to Avoid

- **Trigger-based scoring (rejected).** D-16 explicitly chose Server Action. Don't add a PL/pgSQL trigger as "defense in depth" — the duplicate write surface adds debugging cost with zero new safety because the PK already guarantees idempotency.
- **Polling for leaderboard updates.** Phase 2 uses `revalidatePath` + page-refresh-on-focus. No `setInterval` ping. The only client `setInterval` allowed in Phase 2 is the countdown banner's 1s tick (UI-SPEC §6) and the optional stepper long-press auto-repeat (UI-SPEC §1).
- **Client-side kickoff-lock check before save.** D-08: RLS is the lock. The client may disable the stepper for UX (cosmetic per D-05), but the Server Action MUST always attempt the write — RLS rejection is the canonical "locked" signal.
- **`getSession()` anywhere on the server.** Use `getClaims()` (Phase 1 pattern). `getSession()` trusts cookies blindly.
- **Bare `auth.uid()` in any new RLS policy.** Wrap as `(select auth.uid())` per Phase 1 VIS-06 (initPlan caching). Phase 2 adds `score_events` policies — apply the wrapper.
- **Editing a committed migration.** Append-only. Phase 2 migrations start at `0007_...` and increment.
- **Tailwind v4 bare CSS-var shorthand: `[--zc-X]`.** Phase 1 P05 deviation. Use `[var(--zc-X)]`. The lint catches physical-direction utilities but does NOT catch this — relies on visual verification on Vercel preview. **The planner should add a one-line grep to `lint:rtl` or to a separate `lint:tailwind-v4` script catching `\[--zc-` outside of `var(`.**
- **`<form action={...}>` for the stepper save.** That pattern is for mutate-and-navigate (Phase 1 Pattern 14). The stepper is mutate-and-stay — use `startTransition` + plain async (Pattern 3 above).
- **Importing `usePathname` from `next/navigation`.** Use `@/lib/i18n/routing` (Phase 1 Pattern 17).
- **Adding a second cron job.** D-33 + STATE.md W6 watchpoint. Vercel Hobby = 1 cron, owned by heartbeat. No cron in Phase 2.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date formatting (date headers, kickoff times) | `date-fns` / `dayjs` / Luxon | `Intl.DateTimeFormat(locale, opts)` (already proven in Phase 1 `/me` page) | Native API, zero bundle, locale-aware. CLAUDE.md "What NOT to Use" explicitly forbids a date lib. |
| Locale-aware sort for leaderboard alpha tiebreak | Postgres ICU collation gymnastics | `Intl.Collator(locale).compare()` in RSC | See Pattern 7. Avoids the ICU-availability question. |
| Optimistic UI rollback on save failure | `useOptimistic` with all the variants | Plain `useState` + `useTransition` + revert-on-error (Pattern 3) | The stepper's "optimistic" state IS the user input — there's no separate optimistic state to roll back. `useOptimistic` is for cases where the optimistic value differs from the user input (e.g., a new chat message with a server-generated ID). |
| Score idempotency | Per-row delete-then-insert with manual dedup | `INSERT ... ON CONFLICT (user_id, source, ref_id) DO UPDATE` (PK upsert) | PK upsert is atomic and built into Postgres. D-19 + Pattern 5. |
| Player alias matching for prop grading | Levenshtein distance / typeahead / player roster | Admin-entered alias set (`text[]`) + exact NFC-lowercase-trim match (D-24) | Family pool of 15 users grading 5–10 props × maybe one correction each. Manual alias entry is faster than building fuzzy match. |
| Placeholder cascade for ADM-03 | Recursive CTE | App-code loop in TypeScript (D-11 + PITFALLS §3) | Easier to debug; explicit; survives schema evolution. |
| `result_home` vs `result_home_90min` choice (D-12) | Migrate-rename either column | **Make `_90min` the canonical Phase 2 column. Leave `result_home`/`result_away` UNUSED. Migration `0009_fixtures_result_full.sql` only ADDs `_full` columns.** Optionally add a comment-block in the migration documenting that legacy columns are DEPRECATED and will be removed in a future major. | A generated column or view delegation is over-engineering for 5 places that read this. The TS scorer takes `result_home_90min` / `result_away_90min` (already typed in `src/types/supabase.ts`). Phase 1 verify scripts don't reference `result_home`/`result_away`. Cost of doing nothing: 4 unused columns. Cost of cleaning up: a migration that risks breaking something. **Don't touch the legacy columns in Phase 2.** |
| Countdown timer math | A countdown library | Plain `setInterval(1s)` + `Date.now()` deltas; banner unmounts when delta ≤ 0 | UI-SPEC §6 fully specs it. ~30 LOC of client component. |
| Multi-language form validation messages | Server-rendered error strings | Zod error codes → next-intl key lookup (Phase 1 pattern from `join.ts`) | Already proven. Mirror `messages.{en,he}.matches.errors.*`. |
| `score_events` updated_at audit | A separate audit table | The default `updated_at timestamptz default now()` column on UPSERT (D-19) | "DB-level audit trail" per D-10. Admin doesn't need a UI on this. |
| Multiple paths in `revalidatePath` | Path-pattern wildcards | Explicit per-locale × per-page calls (sketch above) | Path patterns + dynamic segments have edge cases (see vercel/next.js#50356). Explicit is safer for the 6 paths Phase 2 cares about. |

**Key insight:** Phase 1 already built the locked-and-loaded auth/RLS/seed foundation. Phase 2's job is to add table + view + Server Actions + UI on top — and pretty much every new piece of complexity has an "extract this from a library or use the platform" answer. The only TS code that is genuinely novel is the scoring math (D-17) and the leaderboard ORDER BY tiebreaker comparator — both small.

## Runtime State Inventory

> Phase 2 ships migrations + new tables but is a NEW-construction phase, not a rename/refactor. There is no "old string" to update across stored data or live services. Still worth confirming since the schema gets new columns:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `result_home` / `result_away` columns exist in schema (0001_init.sql:64-65) but are NEVER set by Phase 2 admin UI (D-12). All `predictions` rows pre-exist their fixture's `result_home_90min` being set; the scoring sweep handles this fine. | **None — DO NOT migrate or backfill legacy columns; they stay NULL forever per D-12.** |
| Live service config | Vercel Hobby cron slot already consumed by `/api/heartbeat` (Phase 1 vercel.json). | **None — D-33 explicitly says Phase 2 ships no new cron.** |
| OS-registered state | Vercel Cron `0 12 */3 * *` registered. No Phase 2 changes. | None. |
| Secrets/env vars | New env vars needed? `INVITE_CODE`, `ADMIN_DISPLAY_NAME`, `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` all already exist (Phase 1). Playwright in CI may need a `PLAYWRIGHT_BASE_URL` and a test invite code — see §"Playwright smoke architecture." | Add Playwright-specific env vars when wiring CI/local tests; document in `01-USER-SETUP.md` follow-on or a new `02-USER-SETUP.md`. |
| Build artifacts / installed packages | `package-lock.json` will be rewritten when `@playwright/test` installs. Apply the JFrog→npmjs sed rewrite per Phase 1 P05 operational note. `src/types/supabase.ts` must be regenerated and committed after each new migration. | Re-run `sed -i.bak ... package-lock.json` after `npm install`; re-run `npm run db:types` after each schema migration. |

## Common Pitfalls

### Pitfall 1: Cookie-store RSC vs Server Action context
**What goes wrong:** `createClient()` from `src/lib/supabase/server.ts` tries to `cookieStore.set()` inside RSCs and silently swallows the failure (the `catch {}` block at lines 22-25). New Server Actions calling `createClient()` write cookies normally; new RSCs reading via `createClient()` can only read. If a new code path tries to refresh the session token inside an RSC, it'll fail silently.
**Why it happens:** Next.js disallows cookie writes from RSC render path; the swallowing is intentional but hides bugs.
**How to avoid:** Server Actions = `createClient()` (cookies writable). RSCs = `createClient()` for reads only. Service-role bypass = `createServiceClient()` (no cookies at all).
**Warning signs:** Users see "Anonymous Sign-Ins are disabled" or 401s mid-session — likely the middleware didn't refresh because the page was statically rendered. Phase 1 already handles this in middleware; Phase 2 just inherits.

### Pitfall 2: PostgREST embed and RLS interaction
**What goes wrong:** When `select('fixtures.predictions(...)')` is used, RLS filters the *embedded* table independently — you get fixture rows back, but `predictions: []` for fixtures the viewer can't see picks for (which is fine), and you can't easily distinguish "no predictions exist" from "RLS hid them" in the same row.
**Why it happens:** PostgREST design — RLS applies per-row everywhere.
**How to avoid:** For Phase 2, this is the desired behavior. Just be aware that the `predictions` array is RLS-filtered, NOT post-filtered in TS. The match-row variant decision (editable / locked / resulted) should key on `result_home_90min IS NOT NULL` (server-side fact), not on whether the `predictions` array contains other-user rows.
**Warning signs:** UI shows "no predictions yet" for a fixture that has predictions but kickoff hasn't passed — that's actually correct (other users' picks are hidden) but the wording might confuse the developer. Use distinct UI states: editable (no result) / locked-no-result (post-kickoff, pre-result) / resulted (result entered).

### Pitfall 3: Stepper debounce + Server Action queueing
**What goes wrong:** React 19's Action queue serializes calls — if a user click-spams +/− 20 times in a second, all 20 server actions queue and the UI feels laggy.
**Why it happens:** "Sequential dispatch means you avoid a class of race conditions, but it also means users can create a backlog." `[CITED: pas7.com.ua/blog/en/react-useactionstate-deep-dive]`
**How to avoid:** Debounce in the CLIENT before dispatching (Pattern 3). The 600ms debounce coalesces a click-burst into a single dispatch. Do NOT trigger an Action per click. `useTransition` doesn't help here — it's about UI responsiveness during a single dispatch, not coalescing dispatches.
**Warning signs:** Saved indicator pulses repeatedly after the user stopped tapping. Symptom = no debounce.

### Pitfall 4: Tailwind v4 [var(...)] syntax regression
**What goes wrong:** Bare `[--zc-X]` produces invalid CSS in Tailwind v4 (Phase 1 P05 bug). The lint (`lint:rtl`) doesn't catch it. Phase 2 introduces ~14 new components each with multiple `[var(--zc-X)]` references.
**Why it happens:** Tailwind v4 dropped the bare-CSS-var shorthand. Phase 1 fixed it via a sed sweep; a new contributor could regress it by copy-pasting from older snippets.
**How to avoid:** **The planner SHOULD add a new lint check.** Recommended:
```bash
# package.json script
"lint:tailwind-v4": "! grep -REn '\\[--zc-' src/ || (echo 'Tailwind v4 violation: bare CSS-var shorthand. Use [var(--zc-X)] not [--zc-X]' && exit 1)"
```
Wire into `.husky/pre-commit` and `.github/workflows/lint.yml` alongside `lint:rtl`. Same exit-code shape, zero extra deps.
**Warning signs:** Black/transparent UI on Vercel preview after a component change. Phase 1 P05 forensic record.

### Pitfall 5: ICU collation availability on Supabase
**What goes wrong:** A migration that references `COLLATE "he-x-icu"` or `COLLATE "und-x-icu"` may fail with `"ICU is not supported in this build"` or `"collation does not exist"` on the live Supabase Postgres instance.
**Why it happens:** Supabase historically built Postgres with limited ICU. The 2024-2025 versions support ICU but the available collations vary by region/version. `[CITED: github.com/supabase/postgres/issues/198 + #1133]`
**How to avoid:** Pattern 7 above — sort in TS via `Intl.Collator`. If planner wants DB-side sort, **first run** `SELECT collname FROM pg_collation WHERE collname LIKE '%icu%' OR collname LIKE 'und%'` on tjivukpxuhbrbshidbfv via the Supabase SQL editor. Document the result.
**Warning signs:** Migration fails at db:push with collation error; or, leaderboard ORDER BY silently sorts ASCII-byte-order on Hebrew names.

### Pitfall 6: revalidatePath in Server Action with locale segment
**What goes wrong:** `revalidatePath('/[locale]/leaderboard')` doesn't always invalidate `/he/leaderboard` and `/en/leaderboard`; the dynamic segment requires a `type` parameter or specific path syntax. Issue #50356 documents flakiness.
**Why it happens:** The path-pattern API has had several bugs and changes.
**How to avoid:** Use explicit per-locale paths (the sketch above). For Phase 2 with 2 locales × 3 affected pages = 6 calls, that's manageable.
**Warning signs:** Admin enters a result, browses to leaderboard, sees stale total. Solution: refresh — but obviously that defeats LB-03.

### Pitfall 7: I18N-06 bidi stress test
**What goes wrong:** Phase 1 deferred the full bidi stress test to Phase 2 QA-03. Hebrew paragraphs that embed Latin score capsules (`התוצאה: 2-1`) can render the score as `1-2` if not wrapped properly.
**Why it happens:** Unicode bidirectional algorithm. The UI-SPEC §"RTL Stress Points" table enumerates the specific spots:
- Score capsule `2:1` → `<span dir="ltr">`
- Countdown timer `02:14:33` → `<span dir="ltr">`
- `+pts` badge `+4 exact` → `<span dir="ltr">+4</span>` for the number, `{kind_label}` follows in page direction
- Per-player reveal `User A: 2-1 +4 exact` → wrap the score `<span dir="ltr">{h}-{a}</span>`
- Date header `שבת · 14 ביוני` → native bidi (the month name "ביוני" is an isolation boundary; verify)
- Flag grid in `/he/` — verify country order matches the alphabetical of the active locale's name column
**How to avoid:** UI-SPEC checker should re-verify against the SPEC dimensions; QA-03 (zekez) checks live.
**Warning signs:** Numbers appear reversed in HE — `12:00` becomes `00:12`, or `2-1` becomes `1-2`. Visible on the family WhatsApp the moment someone shares a screenshot.

### Pitfall 8: Lockfile rewrite forgotten after Playwright install
**What goes wrong:** Installing Playwright rewrites `package-lock.json` to point at jfrogrepo24.jfrog.io URLs (ZScaler corp transparent rewrite). Vercel build runner 403s on those URLs (Phase 1 P05 Bug).
**Why it happens:** Operational env; documented in STATE.md.
**How to avoid:** Always run the sed after `npm install`:
```bash
sed -i.bak 's|https://jfrogrepo24.jfrog.io/artifactory/api/npm/npm-virtual/|https://registry.npmjs.org/|g' package-lock.json && rm package-lock.json.bak
```
Commit the rewritten lockfile.
**Warning signs:** Vercel build fails with 403 on a JFrog URL.

### Pitfall 9: `src/types/supabase.ts` stale after migration
**What goes wrong:** Phase 2 adds 4 migrations (0007–0010). If the types aren't regenerated, RSC code with `from('score_events')` won't typecheck and may fail at runtime.
**Why it happens:** Types are generated, not committed automatically.
**How to avoid:** After EVERY migration: `npm run db:push --linked && npm run db:types && git add src/types/supabase.ts && git commit`. Document this as Wave 0 hygiene.
**Warning signs:** TypeScript error "Property 'score_events' does not exist on type 'Database['public']['Tables']'."

### Pitfall 10: Admin RSC server-component reads can hit RLS unexpectedly
**What goes wrong:** Admin pages call `createClient()` (anon JWT) by default — RLS applies. If the integrity widget query reads `predictions p JOIN fixtures f` and the admin's session is for a member who's also an admin, RLS applies normally (admin sees own + post-kickoff). The widget query NEEDS to see ALL predictions for the integrity check (LGE-06).
**Why it happens:** "Being admin" in Phase 1 is just `is_admin = true` on the profile; it doesn't change RLS posture.
**How to avoid:** The integrity widget MUST use `createServiceClient()`, not `createClient()`. Same for the admin pages that show all members' data (the family roster). Phase 2 admin Server Actions already use service-role; the admin RSCs need to as well for read paths that bypass RLS. **Recommendation:** Wrap admin read operations in a helper `adminReadClient()` that requires `requireAdmin()` and returns the service-role client — symmetric to admin write actions. Audit every admin page; default to service-role.
**Warning signs:** Integrity widget always shows "0 / 0 / 0" even though predictions exist — because the admin's own predictions are visible to themselves but other users' aren't.

### Pitfall 11: Tournament.starts_at vs first fixture kickoff drift
**What goes wrong:** `tournament.starts_at = 2026-06-11T19:00:00Z` is the anchor for prop_answers lock (PRP-03 RLS predicate). If the planner accidentally schedules a fixture before 19:00 UTC on June 11, the prop_answers RLS would still lock at 19:00 — meaning predictions could be saved on the late-running first fixture but props would already be locked. Or vice versa.
**Why it happens:** Two anchors that should agree but don't auto-sync. Phase 1 D-03 fixed this once (0006_reseed_wc2026.sql:70 — 19:00 UTC is the Estadio Azteca 1pm local kickoff).
**How to avoid:** Don't add fixtures earlier than `tournament.starts_at` in any seed correction. If a fixture moves earlier, update both columns. Verify with: `SELECT min(kickoff_at) FROM fixtures` should equal `SELECT starts_at FROM tournament`.
**Warning signs:** Props are still editable after a fixture has kicked off; or props lock before any fixture has kicked off.

## Code Examples

### `score_events` migration (planner final-edits)

```sql
-- supabase/migrations/0007_score_events.sql

create table public.score_events (
  user_id     uuid not null references auth.users(id) on delete cascade,
  source      text not null check (source in ('league','prop','bracket')),
  ref_id      uuid not null,                          -- fixture_id | question_id | slot_id
  points      smallint not null,                       -- SCR-05: integer-only
  kind        text     null check (kind in (
                'exact','goal-diff','winner','miss','correct'
              )),
  updated_at  timestamptz not null default now(),
  primary key (user_id, source, ref_id)               -- D-19: idempotency key
);

-- Index for v_leaderboard aggregation
create index score_events_user_idx   on public.score_events (user_id);

-- RLS: SELECT for all members; INSERT/UPDATE/DELETE blocked except service-role.
alter table public.score_events enable row level security;

create policy score_events_read on public.score_events
  for select to authenticated using (true);
  -- All authenticated users can read all score_events. The leaderboard is
  -- per-family-trust public-to-members; the per-pick reveal in MatchRow (D-06)
  -- already shows everyone's score after kickoff via the predictions reveal.
  -- score_events is just the derived projection — same trust posture.

-- No INSERT/UPDATE/DELETE policies => denied by default for authenticated. The
-- Phase 2 Server Actions use createServiceClient() to bypass RLS for writes.

-- GRANT SELECT to anon and authenticated (Phase 1 convention: anon SELECT on all
-- tables so RLS is the visible lock; see 0004_anon_select.sql).
grant select on public.score_events to anon, authenticated;

-- B1-style smoke: confirm RLS is on and no DML grants exist for authenticated.
do $$
declare cnt int;
begin
  select count(*) into cnt
    from information_schema.column_privileges
    where table_schema = 'public'
      and table_name = 'score_events'
      and grantee = 'authenticated'
      and privilege_type in ('INSERT','UPDATE','DELETE');
  if cnt > 0 then
    raise exception 'score_events B-style check failed: authenticated has unexpected DML grant';
  end if;
end$$;
```

### Match list date-grouping (RSC)

```typescript
// helper: group fixtures by viewer-local date
import type { Database } from '@/types/supabase';

type FixtureRow = Database['public']['Tables']['fixtures']['Row'];

export function groupByLocalDate(fixtures: FixtureRow[], locale: string, tz: string) {
  const fmt = new Intl.DateTimeFormat(locale, {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: tz,
  });
  const groups = new Map<string, FixtureRow[]>();
  for (const f of fixtures) {
    const key = fmt.format(new Date(f.kickoff_at));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }
  // Map preserves insertion order — fixtures are already ORDER BY kickoff_at ASC
  return Array.from(groups.entries());
}

// D-01: replace ', ' with ' · ' in the formatted date label
function formatGroupLabel(rawDate: string): string {
  return rawDate.replace(', ', ' · ');
}
```

### Leaderboard TS-side sort (LB-04)

```typescript
// src/app/[locale]/leaderboard/page.tsx (skeleton)
const collator = new Intl.Collator(locale, { sensitivity: 'base' });
const sorted = (data ?? []).sort((a, b) =>
  b.total - a.total ||
  b.exact_count - a.exact_count ||
  b.correct_count - a.correct_count ||
  collator.compare(a.display_name, b.display_name)
);
```

### Playwright smoke (skeleton)

```typescript
// tests/e2e/smoke.spec.ts (planner finalizes)
import { test, expect } from '@playwright/test';

test('full prediction → result → leaderboard flow', async ({ browser }) => {
  // Multi-context per Playwright docs.
  const userCtx = await browser.newContext();
  const adminCtx = await browser.newContext();

  // User joins, predicts a pre-lock fixture.
  const userPage = await userCtx.newPage();
  await userPage.goto('/en/join');
  await userPage.getByLabel('Your name').fill('SmokeUser');
  await userPage.getByLabel('Invite code').fill(process.env.PLAYWRIGHT_INVITE_CODE!);
  await userPage.getByRole('button', { name: /Join the Pool/i }).click();
  await userPage.waitForURL(/\/(en|he)\/matches/);

  // Find a fixture with kickoff_at = now() + 5min (seeded via DB pre-test).
  const row = userPage.locator('[data-testid="match-row"][data-fixture-id="SMOKE_PRE_LOCK"]');
  await row.getByTestId('home-stepper-plus').click();
  await row.getByTestId('home-stepper-plus').click(); // home = 2
  await row.getByTestId('away-stepper-plus').click(); // away = 1
  await expect(row.getByText(/saved/i)).toBeVisible({ timeout: 2000 });

  // Wait for the simulated kickoff (or use a seeded post-lock fixture and attempt to edit it).
  const lockedRow = userPage.locator('[data-testid="match-row"][data-fixture-id="SMOKE_POST_LOCK"]');
  // RLS rejection — UI shows error, value reverts.
  await lockedRow.getByTestId('home-stepper-plus').click();
  await expect(lockedRow.getByText(/locked at kickoff/i)).toBeVisible();

  // Admin enters result for SMOKE_PRE_LOCK (kickoff has now passed in seed time).
  const adminPage = await adminCtx.newPage();
  await adminPage.goto('/en/join');
  await adminPage.getByLabel('Your name').fill(process.env.PLAYWRIGHT_ADMIN_NAME!);
  await adminPage.getByLabel('Invite code').fill(process.env.PLAYWRIGHT_INVITE_CODE!);
  await adminPage.getByRole('button', { name: /Join the Pool/i }).click();
  await adminPage.goto('/admin/matches?mode=entry');
  const entry = adminPage.locator('[data-testid="admin-entry"][data-fixture-id="SMOKE_PRE_LOCK"]');
  await entry.getByTestId('home-result').fill('2');
  await entry.getByTestId('away-result').fill('1');
  await entry.getByRole('button', { name: /Save Result/i }).click();
  await expect(entry.getByText(/saved/i)).toBeVisible();

  // User's leaderboard shows +4 exact.
  await userPage.goto('/en/leaderboard');
  await expect(userPage.getByText(/SmokeUser/)).toBeVisible();
  await userPage.getByText(/SmokeUser/).click();
  await expect(userPage.getByText(/League: 4/)).toBeVisible();
});
```

**Storage state vs fresh-join:** For Phase 2's single E2E, fresh-join per context is simpler than `storageState` (we get to exercise the join flow). Don't bother with the auth-setup-project pattern unless Phase 2.x adds more tests.

**Seeded fixture lifecycle:** The planner needs two fixtures with controlled `kickoff_at`:
- `SMOKE_PRE_LOCK`: `now() + interval '5 minutes'`
- `SMOKE_POST_LOCK`: `now() - interval '1 minute'`

These can be:
- (a) seeded via a Wave 0 test-helper SQL that runs before Playwright, then cleaned up after; OR
- (b) two real WC 2026 fixtures whose kickoffs happen to be near `now()` (won't work — tournament hasn't started)

**Recommendation:** A new `data/test-fixtures.sql` + an npm script `db:test-seed` that the Playwright `webServer` invokes pre-suite. Cleaned via `db:test-clean` post-suite. Phase 2 owns these scripts.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Postgres trigger writing `score_events` from `match_results` | Server Action sweep + bulk UPSERT | D-16 (this phase) | Debuggable; debuggable in TS errors; preserves D-19 idempotency via PK |
| `getSession()` on the server | `getClaims()` | Phase 1 | JWT signature validated; no stale session leak |
| `MATERIALIZED VIEW` for leaderboard | Regular `VIEW` aggregating `score_events` | This phase | At 15-user scale, materialized adds REFRESH chore for zero perf gain |
| Postgres ICU collation for HE sort | TS `Intl.Collator(locale)` in RSC | This phase | Avoids ICU-availability question on Supabase; per-locale-correct |
| Date library for kickoff formatting | `Intl.DateTimeFormat` | Phase 1 (continued) | Zero bundle |
| `<form action> + redirect` for the stepper | `startTransition` + plain async + `revalidatePath` | This phase | The mutate-and-stay flow; Pattern 14 from Phase 1 is for mutate-and-navigate |

**Deprecated/outdated:**
- `result_home` / `result_away` columns on `fixtures` are unused per D-12. Don't delete in Phase 2; just don't write to them. (Future v2 schema cleanup may drop.)
- Phase 1 `/admin/(protected)/page.tsx` is a placeholder ("No actions available yet. Admin pages light up in Phase 2.") — replace with admin home nav linking to the 4 new tabs.
- Phase 1 `/[locale]/leaderboard/page.tsx` is an empty-state — replace with the real view consumer.
- Phase 1 `/[locale]/matches/page.tsx` is an empty-state — replace with the matchday feed.

## Project Constraints (from CLAUDE.md)

**Tech stack (binding):**
- Next.js 15.5.x (not 16.x). LTS through Oct 2026.
- Tailwind v4.3 with `[var(--zc-X)]` syntax inside brackets; logical-property utilities only.
- `@supabase/ssr` + `signInAnonymously()` (not `@supabase/auth-helpers-nextjs`, which is deprecated).
- next-intl v4.
- Native `Intl.DateTimeFormat` (no date lib).
- Zod v4 with `@hookform/resolvers` (if RHF used).
- Playwright as the only test framework for Phase 2.
- No TanStack Query, no Moment.js, no `next-i18next`, no `tailwindcss-rtl` plugin.

**Server-side rules:**
- `getClaims()` always, never `getSession()`.
- `(select auth.uid())` in RLS predicates, never bare `auth.uid()`.
- Server Actions that mutate AND navigate use `<form action>` + `redirect()`.
- Server Actions that mutate AND stay use `startTransition` + `revalidatePath`.
- `createServiceClient()` only inside admin actions that have called `await requireAdmin()` first.

**Operational hygiene:**
- After every `npm install`: lockfile JFrog→npmjs sed rewrite + commit.
- After every migration: `npm run db:types && git add src/types/supabase.ts && git commit`.
- Before every commit: `git config user.email 10100761+zarurc@users.noreply.github.com`.
- Migrations append-only; never edit a pushed migration. Phase 2 starts at `0007_...`.
- W6 watchpoint: do not add a second Vercel Cron.

**Security:** ASVS-1 (config.json `security_asvs_level: 1`, `security_block_on: high`). Phase 2 surfaces: data validation (V5 — Zod on every input), access control (V4 — RLS on `score_events` + `requireAdmin` on every admin Server Action), input sanitization (V5 — display name / prop answer text already sanitized via Phase 1 regex).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Playwright `^1.55.0` is current at install time. | Standard Stack | Cosmetic; planner pins whatever `npm view` returns. |
| A2 | `und-x-icu` and/or `he-x-icu` may or may not be installed on Supabase tjivukpxuhbrbshidbfv. | Pattern 7 / Pitfall 5 | If planner relies on DB-side sort and the collation isn't there, migration fails. Mitigated by TS-side sort recommendation. |
| A3 | The match-list page can RSC-fetch all 104 fixtures + nested predictions + score_events in one query without hitting Supabase row-count limits or PostgREST timeouts. | Pattern 8 | Worst-case ~1.5k rows; well under PostgREST defaults. But verify with a real query against tjivukpxuhbrbshidbfv. |
| A4 | The `replace(', ', ' · ')` trick to produce `Saturday · June 14` works for `Intl.DateTimeFormat('he-IL', { weekday, month, day })` HE output too — UI-SPEC's worked example shows it does, but the exact comma character in `יום שבת, 14 ביוני` is `, ` (ASCII), not a Hebrew punctuation char. | Code Examples | If HE uses `، ` or another separator, the replace silently no-ops and the bullet doesn't appear. Verify in QA-03. |
| A5 | React 19's `useTransition` correctly gates a `revalidatePath` triggered inside an async Server Action without race conditions for the stepper case. | Pattern 3 | If the saved-indicator pulses or the value rolls back inappropriately, fall back to `useOptimistic`. |

## Open Questions (RESOLVED)

> All five open questions below were resolved during planning by following the recommended path (the recommendations are the disposition the plans implement). The original question text + recommendation are kept as the paper trail.

1. **RESOLVED:** Use Pattern 7's TS-side `Intl.Collator` sort in the leaderboard RSC (Plan 02-07); no DB-side ICU collation dependency. **Q: Does Supabase Postgres on tjivukpxuhbrbshidbfv have `und-x-icu` / `he-x-icu` ICU collations?**
   - What we know: ICU collations are Postgres 15+ feature; Supabase supports it but build varies.
   - What's unclear: Which collations are present on this specific project.
   - **Recommendation:** Run `SELECT collname, collprovider, collversion FROM pg_collation WHERE collname ~* 'icu' OR collname ~* 'und'` on tjivukpxuhbrbshidbfv during planning. If a sensible collation exists, the planner may use it in `v_leaderboard`; if not, use Pattern 7's TS-side `Intl.Collator` sort (recommended default).

2. **RESOLVED:** `correct_answer_aliases text[]` column on `prop_questions` (migration 0010, Plan 02-01); no separate aliases table for Phase 2. **Q: Does the planner want `correct_answer_aliases text[]` on `prop_questions` or a separate `prop_answer_aliases` table?**
   - What we know: D-24 says column OR table, planner's discretion.
   - What's unclear: Whether the family will want >5 aliases per prop (table starts to make sense at scale).
   - **Recommendation:** `text[]` column. Migrate to a table only if a prop ends up needing >10 aliases (unlikely for 5–10 props).

3. **RESOLVED:** Added `src/lib/auth/adminReadClient.ts` helper (Plan 02-02); every admin RSC in Plans 02-05 and 02-06 imports it. **Q: Should every admin RSC use `createServiceClient()` by default, or `createClient()` + careful policies?**
   - What we know: Pitfall 10 — `createClient()` from admin pages applies RLS, which hides other users' data from the admin.
   - What's unclear: Whether the planner adds a helper `adminReadClient()` (recommended) or audits every page individually.
   - **Recommendation:** Add a thin helper `src/lib/auth/adminReadClient.ts` that calls `requireAdmin()` and returns `createServiceClient()`. Every admin RSC imports this; symmetric to admin write actions.

4. **RESOLVED:** `data/test-fixtures.sql` + `data/test-fixtures-clean.sql` injected via `npm run db:test-seed` / `db:test-clean` scripts; `external_match_no` 9001/9002 outside the 1..104 real range (Plan 02-08). **Q: How do the Playwright smoke fixtures (`SMOKE_PRE_LOCK`, `SMOKE_POST_LOCK`) coexist with the 104 real WC fixtures?**
   - What we know: D-30 says "no fake-time mocking — real clocks against seeded kickoff times." Real fixtures all start June 11+.
   - What's unclear: How to inject two test fixtures without polluting the prod-like seed.
   - **Recommendation:** A new `data/test-fixtures.sql` outside the canonical CSV pipeline. The Playwright config's `webServer` runs `psql -f data/test-fixtures.sql` pre-suite (against a test/preview Supabase branch — NOT prod). Cleaned via a teardown step. Test fixtures use `external_match_no` values outside the 1..104 range (e.g., 9001, 9002) to avoid collisions.

5. **RESOLVED:** LGE-06 query is fired by the always-visible IntegrityWidget RSC on every admin pageload (Plan 02-06, per D-15); the "daily" semantic is satisfied operationally since admin reviews predictions daily. **Q: Where does the daily LGE-06 integrity query live if there's no cron (D-33)?**
   - What we know: D-15 says it runs on every admin pageload as part of the integrity widget RSC.
   - What's unclear: Whether "daily" in LGE-06 is satisfied by "every time admin loads any admin page" — REQUIREMENTS.md says "daily."
   - **Recommendation:** Treat "daily" as a loose requirement — the integrity widget hits the same query on every admin page load, which is at least daily in practice (admin reviews predictions daily). If a stricter audit is needed, fold a "log integrity check result to a `system_logs` table" into the widget RSC — but that's gold-plating for Phase 2. Just leave as-is.

## Validation Architecture

> SKIPPED — `.planning/config.json.workflow.nyquist_validation = false`. Validation strategy is captured in Phase 2 plans via the standard QA-01..04 gates (D-30..32), not via Nyquist sampling. `[VERIFIED: .planning/config.json line 19]`

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high`. ASVS-L1 controls applicable to Phase 2:

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (inherited from Phase 1) | `signInAnonymously()` + JWT verification via `getClaims()` — no new auth surface in Phase 2 |
| V3 Session Management | yes (inherited) | `@supabase/ssr` cookie-based session; middleware refreshes via `getClaims()` |
| V4 Access Control | yes (NEW) | RLS on `score_events` (SELECT all, no DML for authenticated). Service-role bypass only inside `await requireAdmin()`-gated Server Actions. B1-style column-grant smoke check in migration. |
| V5 Input Validation | yes (NEW) | Zod schemas at: `prediction.ts` (smallint 0–9 each), `result.ts` (same), `propAnswer.ts` (variants per answer_type), `propAuthoring.ts` (admin author + grade input). All Server Actions validate before any DB call. |
| V6 Cryptography | yes (inherited) | JWT signature validation via Supabase JWKS in `getClaims()`. No new crypto in Phase 2. |

### Known Threat Patterns for Next.js 15 + Supabase + RLS

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client-side prediction lock bypass (user edits POST body to set `home_score=99`) | Tampering | Server-side Zod validation (`prediction.ts`) — schema rejects out-of-range scores before DB call; RLS rejects via `kickoff_at > now()` if a Zod-valid POST arrives post-kickoff |
| Family member tries to write another user's prediction (`user_id != self`) | Spoofing | RLS `predictions_insert WITH CHECK (user_id = (select auth.uid()))` — already shipped Phase 1 |
| Family member tries to bypass the integrity widget by impersonating admin | EoP | `requireAdmin()` reads `profiles.is_admin`; B1 column-grant prevents authenticated UPDATE on `is_admin` — already shipped Phase 1 |
| Click-spam DoS on prediction save | DoS | Supabase rate-limits anon sign-ins to 30/hr/IP (AUTH-07 accepted defense); per-user write rate is implicit via 600ms debounce client-side; PostgREST has request-level limits |
| Service-role secret leaked to client bundle | Information Disclosure | `'server-only'` directive at top of `src/lib/supabase/service.ts` — build fails if it ends up in a client bundle (Phase 1 pattern). New Phase 2 admin Server Actions must NOT export anything that imports from `service.ts` to non-server modules. |
| Prop answer cross-user leak via embedded query | Information Disclosure | RLS `prop_answers_read` policy filters per-row — embedded queries don't bypass; already verified Phase 1 |
| Open-redirect via Server Action `redirect(path)` | EoP | Phase 1 Pattern 14: redirectPath must start with `/` and not `//`. Applies to new Server Actions too — `joinPool` set the precedent. |
| Stored XSS via display_name | XSS | Phase 1 Zod regex `/^[\p{L}\d ]+$/u` rejects HTML/JS chars; React's auto-escaping handles render safety |
| Stored XSS via prop_questions.prompt_en/he | XSS | Admin-authored content only (no user input). React auto-escape on render. Admin is trusted per family-trust posture. Acceptable. |
| Stored XSS via prop_answers.answer (free-text) | XSS | NEW IN PHASE 2. Free-text input goes through Zod sanitization in `propAnswer.ts` — same regex as displayName: `/^[\p{L}\d \-.,!?']+$/u` or broader. Planner picks the exact regex; rejects HTML/script chars; React auto-escapes on render in the reveal block (D-25). |
| CSRF on Server Action | Tampering | Next.js Server Actions have built-in CSRF protection via the action ID + Origin check |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build + dev + Playwright | ✓ (Phase 1 verified) | ≥ 20 | — |
| npm | Package install | ✓ | (lockfile rewrite required after install) | — |
| Supabase CLI | `db:types`, `db:push` | ✓ (Phase 1 verified) | `^2.0.0` | — |
| Supabase Postgres | All migrations, RLS, view | ✓ (live at tjivukpxuhbrbshidbfv) | 15 (Supabase managed) | — |
| Playwright | E2E smoke (QA-01) | ✗ (not yet installed) | — | None — must install in Wave 0. No fallback that satisfies QA-01. |
| Vercel | Deploy + Cron + edge runtime | ✓ (Phase 1 verified) | Hobby plan | — |
| Vercel Cron | Heartbeat (existing) | ✓ | 1 cron registered | — (no new cron per D-33) |
| ZScaler corp network | Local dev TLS | ✓ (Phase 1: `NODE_EXTRA_CA_CERTS`) | — | Document in 02-USER-SETUP.md for any new contributor; same `.env.local` setup |
| Hebrew native-speaker (zekez) | QA-03 copy review | ✓ (Phase 1 verified) | — | — |
| Real Android/iPhone for QA-02 | Mobile QA | ✓ (Phase 1 used) | — | — |

**Missing dependencies with no fallback:** Playwright. Wave 0 must install it.
**Missing dependencies with fallback:** None.

## Sources

### Primary (HIGH confidence)

- `supabase/migrations/0001_init.sql` (Phase 1 schema — `fixtures`, `predictions`, `prop_questions`, `prop_answers`, `bracket_*`)
- `supabase/migrations/0002_rls.sql` (Phase 1 RLS — lock-and-reveal policies for predictions + prop_answers; verified inline at Pattern 1 / 2)
- `supabase/migrations/0006_reseed_wc2026.sql` (Phase 1 seed — `tournament.starts_at = 2026-06-11T19:00:00Z`)
- `src/lib/supabase/{server,client,middleware,service}.ts` (Phase 1 client patterns)
- `src/lib/auth/{admin,session}.ts` (Phase 1 auth gates; `getClaims()` pattern)
- `src/app/actions/join.ts` (Phase 1 Server Action template + rebind pattern for D-14 merge)
- `src/middleware.ts` (Phase 1 — locale + Supabase refresh middleware)
- `package.json` (verified versions of Next 15.5.18 + Tailwind v4.3 + Zod v4 + next-intl v4 + @supabase/ssr + supabase-js)
- `.planning/config.json` (`security_asvs_level: 1`, `nyquist_validation: false`, `granularity: coarse`)
- `.planning/phases/02-.../02-CONTEXT.md` (D-01..D-33 user decisions)
- `.planning/phases/02-.../02-UI-SPEC.md` (14 component specs + copywriting contract)
- `.planning/REQUIREMENTS.md` (34 Phase 2 REQ-IDs)
- `.planning/ROADMAP.md` (Phase 2 goal + 5 success criteria)
- `.planning/STATE.md` (Phase 1 patterns + 4 sets of execution deviations including W6 watchpoint)
- `CLAUDE.md` Tech Stack section (HIGH-confidence stack pins + "What NOT to Use" list)

### Secondary (MEDIUM confidence)

- [Next.js revalidatePath docs](https://nextjs.org/docs/app/api-reference/functions/revalidatePath) — multi-path semantics
- [React useTransition reference](https://react.dev/reference/react/useTransition) — Server Action dispatch + queueing
- [Playwright Authentication](https://playwright.dev/docs/auth) — storageState pattern (not needed for Phase 2 single E2E)
- [Playwright Browser Contexts](https://playwright.dev/docs/browser-contexts) — multi-context for D-30 multi-user smoke
- [Supabase RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — `(select auth.uid())` initPlan caching
- [Supabase Row-Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — subquery + index considerations
- [PostgreSQL 15+ Collation Support](https://www.postgresql.org/docs/current/collation.html) — ICU naming `<locale>-x-icu`
- [Supabase Postgres ICU issues — supabase/postgres#198 + #1133](https://github.com/supabase/postgres/issues/1133) — ICU availability caveat (Pitfall 5)

### Tertiary (LOW confidence — flagged for verification)

- [pas7.com.ua useActionState deep-dive](https://pas7.com.ua/blog/en/react-useactionstate-deep-dive) — Action queue + dispatch semantics (informs Pitfall 3); cross-verified against React 19 docs.
- [nextjs/next.js#50356](https://github.com/vercel/next.js/issues/50356) — `revalidatePath` flakiness with dynamic segments (informs Pitfall 6); no direct verification on Next 15.5 specifically.

## Metadata

**Confidence breakdown:**
- User constraints: HIGH — copied verbatim from CONTEXT.md, every D-XX is locked.
- Phase 1 heritage (schema, RLS, auth, chrome): HIGH — read directly from shipped code.
- Standard stack: HIGH — all versions verified against package.json or Supabase live state.
- Architecture patterns (RLS, Server Action shape, score_events, v_leaderboard): HIGH — derived from CONTEXT.md + REQUIREMENTS.md + Phase 1 patterns.
- Hebrew collation strategy: MEDIUM — TS-side sort is HIGH confidence; DB-side ICU collation availability is LOW (Pitfall 5 + Open Question 1).
- Playwright config specifics: MEDIUM — version pin and config sketch are starting points; planner verifies at install time.
- Test-fixture injection mechanism: MEDIUM — recommendation is reasonable but planner picks final shape.

**Research date:** 2026-05-24
**Valid until:** ~2026-06-08 (Phase 2 ship date June 11). Stack pins to Next 15.5.x are stable through Oct 2026; the only fast-moving piece is Playwright (`^1.x` minor versions move monthly).

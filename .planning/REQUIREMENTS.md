# Requirements: Zarur-Cup / משחקי זערור

**Defined:** 2026-05-23
**Core Value:** Predictions submitted before kickoff get scored automatically against a unified leaderboard that the whole family can see.

**Hard deadline:** Live and usable by **June 11, 2026** (WC 2026 opening match).

## v1 Requirements

Requirements for initial release. Each maps to a roadmap phase below.

### Foundation & Shell

- [x] **FND-01**: Next.js 15 (App Router) project deployable on Vercel from `main` branch
- [x] **FND-02**: Tailwind CSS v4 configured; `<html dir>` is set server-side per locale so there is no FOUC/hydration flash
- [x] **FND-03**: CI lint rule (or grep-based pre-commit) rejects physical-direction Tailwind utilities (`pl-/pr-/ml-/mr-/text-left/text-right/border-l-/border-r-/left-/right-`); only logical equivalents (`ps-`, `pe-`, `ms-`, `me-`, `text-start`, `text-end`, `start-`, `end-`) are allowed — *Plan 01-05: .husky/pre-commit + .github/workflows/lint.yml both run `npm run lint:rtl` and block on physical-direction utilities; verified locally and in CI*
- [x] **FND-04**: Supabase project provisioned with `@supabase/ssr` integration and generated TypeScript types
- [x] **FND-05**: Vercel Cron triggers `/api/heartbeat` every 3 days; heartbeat performs a real DB query (e.g. `SELECT 1 FROM fixtures LIMIT 1`) so Supabase free-tier auto-pause never fires before tournament end — *Plan 01-05: deployed at https://zarur-cup.vercel.app/api/heartbeat; vercel.json declares cron `0 12 */3 * *`; manual dashboard trigger 2026-05-24 produced visible SELECT on fixtures in Supabase Postgres logs at 688ms; CRON_SECRET protects external pingers*
- [x] **FND-06**: Mobile-responsive shell (header, footer, layout primitives) verified on a real phone in both Hebrew (RTL) and English (LTR) — *Plan 01-05 Task 4: zekez verified production URL https://zarur-cup.vercel.app on real phone 2026-05-24 — bilingual chrome, locale toggle, bottom-tab-bar, safe-area inset, 44px tap targets, no FOUC; approved end-to-end*

### Internationalization & Localization

- [x] **I18N-01**: User can browse the app at `/he/...` (RTL, Hebrew copy) and `/en/...` (LTR, English copy)
- [x] **I18N-02**: First visit auto-selects locale based on `Accept-Language` header; falls back to Hebrew if no match
- [x] **I18N-03**: User can toggle between Hebrew and English from any page; selection persists across sessions (cookie + `profiles.locale` when signed in)
- [x] **I18N-04**: All UI strings live in `messages/{en,he}.json` via next-intl v4 with ICU plural rules
- [x] **I18N-05**: Team names, prop questions, and other domain content render in the active locale (`_en` / `_he` DB columns)
- [x] **I18N-06**: Mixed-direction strings like scores ("2 - 1") render correctly in both locales (`<bdi>` or `<span dir="ltr">` wrapping where needed) — *structural-only in Phase 1 (`<p lang>` on hero sub-wordmark); full bidi stress-test (deep nesting, embedded LTR codes in RTL paragraphs) deferred to Phase 2 QA-03*
- [x] **I18N-07**: Kickoff times render in the viewer's local timezone using native `Intl.DateTimeFormat` with the correct locale-specific date/time format — *applied to `joined_at` on /me page in Phase 1; same pattern reused for kickoff times in Phase 2*

### Authentication & Identity

- [x] **AUTH-01**: Family member can join the pool by entering the shared invite code on a join page
- [x] **AUTH-02**: Successful invite-code validation creates an anonymous Supabase session (`signInAnonymously()`) and writes a row in `profiles` with the chosen display name and locale
- [x] **AUTH-03**: Display names are unique within the tournament, validated server-side, and sanitized to prevent XSS — *also: family-trust rebind path re-points existing profile + FK children when invite code is valid (Plan 01-04 Bug 1b fix-up)*
- [x] **AUTH-04**: Session persists across browser refresh and across days on the same device (anonymous session refresh via `@supabase/ssr` middleware)
- [x] **AUTH-05**: Anyone without a profile sees the join page only; protected routes redirect unauthenticated users to `/[locale]/join`
- [x] **AUTH-06**: Admin identity is a boolean flag (`profiles.is_admin`); only admins can reach `/admin/...` routes (enforced server-side at the (protected) layout, not just in the UI) — *D-05 deviation: unlocalized `/admin/*` instead of `/[locale]/admin/*`*
- [x] **AUTH-07**: Invite code is rate-limited / brute-force-resistant — *D-02 reinterpretation: satisfied by Supabase's built-in 30 anonymous sign-ins/hr/IP cap as the v1 defense; Cloudflare Turnstile deferred to post-launch per CLAUDE.md + RESEARCH Pitfall 9*

### Tournament Data (Pre-Seeded WC 2026)

- [x] **DATA-01**: All 48 WC 2026 teams seeded into `teams` table with `name_en`, `name_he`, ISO country code, and group letter (where assigned)
- [x] **DATA-02**: All 104 WC 2026 fixtures seeded into `fixtures` table with UTC kickoff times (`timestamptz`), stage label, group code, and symbolic `home_placeholder` / `away_placeholder` references where the team is TBD (e.g. `WINNER_GROUP_A`, `R32_M1_W`)
- [x] **DATA-03**: Bracket slot graph seeded (R32 → R16 → QF → SF → F + Winner) so bracket picks can attach by `slot_id` independent of which teams advance (schema landed in Plan 01-02 migration 0001_init.sql; seed rows arrive in Plan 01-03)
- [x] **DATA-04**: Hebrew team names reviewed by a Hebrew-native speaker before family invite code is distributed
- [x] **DATA-05**: Tournament-level prop questions (~5–10) authored by admin in both languages, with structured answer types (single-team, single-player, text)

### League Mode (Per-Match Predictions)

- [ ] **LGE-01**: Signed-in user can view a per-matchday list of fixtures with kickoff time, both teams, lock state (countdown / locked / finished), and the user's existing prediction if any
- [ ] **LGE-02**: User can enter a home-score and away-score prediction per fixture via a mobile-first stepper UX
- [ ] **LGE-03**: User can edit an existing prediction at any time before kickoff
- [ ] **LGE-04**: Server-side lock — Postgres RLS rejects any INSERT or UPDATE to `predictions` where `(SELECT kickoff_at FROM fixtures WHERE id = fixture_id) <= now()`. Lock is independent of client clock
- [ ] **LGE-05**: Submission state is unmistakable — explicit success/saved indicator after every prediction write, never silent
- [ ] **LGE-06**: Daily integrity query (admin-visible) confirms zero rows where `predictions.submitted_at > fixtures.kickoff_at`

### Bracket Mode (Knockout Predictions)

- [ ] ~~**BRK-01**: User can fill out bracket picks for the knockout stage (R32 → Final + Champion) by `slot_id`, regardless of whether the team identity is currently a placeholder~~ — ❌ CANCELLED 2026-05-26 per Phase 2 D-34 (read-only bracket view replaces prediction game; see BRK-VIEW-01..05)
- [ ] ~~**BRK-02**: Bracket picks made pre-tournament survive group-stage placeholder resolution — user keeps the same pick even after `WINNER_GROUP_A` resolves to a real team~~ — ❌ CANCELLED 2026-05-26 per Phase 2 D-34 (read-only bracket view replaces prediction game; see BRK-VIEW-01..05)
- [ ] ~~**BRK-03**: Server-side lock — RLS rejects any change to a bracket pick where the corresponding slot's earliest possible match has kicked off (per the agreed-upon reveal granularity)~~ — ❌ CANCELLED 2026-05-26 per Phase 2 D-34 (read-only bracket view replaces prediction game; see BRK-VIEW-01..05)
- [ ] ~~**BRK-04**: Bracket UI is RTL-safe (the bracket tree flips for Hebrew without breaking visual hierarchy)~~ — ❌ CANCELLED 2026-05-26 per Phase 2 D-34 (read-only bracket view replaces prediction game; see BRK-VIEW-01..05)

### Props / Wildcards (Tournament-Level)

- [ ] **PRP-01**: User can answer all open prop questions before the first fixture kicks off
- [ ] **PRP-02**: User can edit prop answers until the first fixture kicks off
- [ ] **PRP-03**: Server-side lock — RLS rejects any INSERT or UPDATE to `prop_answers` after the tournament's first fixture kickoff
- [ ] **PRP-04**: Admin can grade prop questions (set correct answer) once known (e.g. top scorer after the tournament ends)

### Visibility (Hidden Until Lock)

- [ ] **VIS-01**: User can see their own predictions, bracket picks, and prop answers at any time
- [ ] **VIS-02**: User cannot see another player's prediction for a fixture until that fixture has kicked off (RLS-enforced; not just UI-hidden)
- [ ] ~~**VIS-03**: User cannot see another player's bracket picks until the agreed-upon bracket reveal moment~~ — ❌ CANCELLED 2026-05-26 per Phase 2 D-34 (read-only bracket view replaces prediction game; see BRK-VIEW-01..05)
- [ ] **VIS-04**: User cannot see another player's prop answers until the tournament's first kickoff
- [ ] **VIS-05**: Once a match/round is locked, all players can see all picks for that match/round
- [x] **VIS-06**: RLS policies use `(select auth.uid())` (not bare `auth.uid()`) for performance, and visibility is verified via a Supabase REST request from an unauthenticated curl call (must return zero rows for unlocked predictions) (verified live in Plan 01-02 via `scripts/verify-rls-no-leak.sh` -- ALL RLS CHECKS PASSED; all 19 `auth.uid()` references in 0002_rls.sql are wrapped `(select auth.uid())`)

### Admin Dashboard

- [ ] **ADM-01**: Admin can enter the result of any fixture (home score, away score, optional `result_home_90min` / `result_away_90min` columns for extra-time fixtures)
- [ ] **ADM-02**: Admin can correct a previously-entered result; scoring re-runs idempotently with no double-counting
- [ ] **ADM-03**: Admin can resolve a knockout placeholder (e.g. mark `WINNER_GROUP_A` → `BRA`) once group stage finishes; downstream fixtures and bracket slots auto-update
- [ ] **ADM-04**: Admin can author, edit, and grade prop questions
- [ ] **ADM-05**: Admin can view a list of all family members with display name, joined-at timestamp, locale, current total score, and a "merge users" tool to reconcile duplicate device-locked sessions
- [ ] **ADM-06**: Admin sees the daily lock-breach integrity check on the admin dashboard (green if zero, red otherwise)

### Scoring Engine

- [ ] **SCR-01**: League scoring — exact score = 4 pts, correct goal difference (non-zero, e.g. predict 2-1, actual 3-2) = 3 pts, correct winner / draw = 2 pts, otherwise 0
- [ ] **SCR-02**: League scoring resolves on the 90-minute result only (extra time / penalties do not change league points)
- [ ] ~~**SCR-03**: Bracket scoring escalates per round: R32 = 2 (if used), R16 = 2, QF = 4, SF = 8, F = 16, Champion = 32; based on advancement, not score~~ — ❌ CANCELLED 2026-05-26 per Phase 2 D-34 (read-only bracket view replaces prediction game; see BRK-VIEW-01..05)
- [ ] **SCR-04**: Prop scoring — per-question point value set by admin at question creation; user gets the points if their answer matches the graded answer, otherwise 0
- [ ] **SCR-05**: All scoring math is integer-only in SQL — no floats anywhere
- [ ] **SCR-06**: Points are a derived view (`v_leaderboard`), not a running total. Admin corrections re-compute on next select; `score_events` upserts on `(user_id, source, ref_id)` to stay idempotent
- [ ] **SCR-07**: User can view a scoring transparency breakdown for any of their picks ("you got 4 = exact score" / "you got 3 = correct goal diff" / "you got 0 = miss")

### Unified Leaderboard

- [ ] **LB-01**: Signed-in user can view the unified leaderboard (League + Bracket + Props combined) showing rank, display name, total points
- [ ] **LB-02**: User can click a player on the leaderboard to see their per-mode breakdown (League / Bracket / Props subtotals)
- [ ] **LB-03**: Leaderboard refreshes automatically after admin enters a result (`revalidatePath` from the result-entry Server Action); user sees fresh standings on next navigation or focus refresh
- [ ] **LB-04**: Tie-breaker chain — total points → number of exact scores → number of correct results → alphabetical display name (locale-aware)

### Ship-Gate Quality

- [ ] **QA-01**: One end-to-end Playwright smoke test covers `invite → predict → lock → result entered → score appears on leaderboard`
- [ ] **QA-02**: Manual mobile QA pass on a real phone (not just devtools), in both Hebrew and English, signed off before family invite code is distributed
- [ ] **QA-03**: Hebrew native speaker reviews all user-visible copy and seeded team/prop content
- [ ] **QA-04**: Custom domain / Vercel deployment URL distributed to the family with the shared invite code by **June 11, 2026** kickoff

### Scope Expansion (added 2026-05-26)

Scope-expansion requirements derived from `.planning/phases/02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate/02-CONTEXT.md` `<scope_expansion_addendum>` (D-34..D-47, 2026-05-26). These ship in Phase 2 Plans 02-09..02-12 by the original June 11 hard deadline.

#### Project documentation updates (PROJECT-UPD)

- [ ] **PROJECT-UPD-01**: PROJECT.md "Out of Scope" line for "Live external sports API integration" REMOVED (per D-36)
- [ ] **PROJECT-UPD-02**: PROJECT.md "Out of Scope" gains "Bracket Mode as a prediction game" + "Auto-grade props from public sources" (per D-34 + D-35); Key Decisions table marks D-34 / D-36 / D-38 outcomes; ROADMAP.md Phase 3 banner-marked as CANCELLED
- [ ] **PROJECT-UPD-03**: REQUIREMENTS.md traceability table updates for cut/moved IDs (BRK-01..04, VIS-03, SCR-03 → Out-of-Scope; PRP-01..04 + VIS-04 traceability annotations updated for D-38 privacy)

#### Props strictly private + relocation (PRIVATE)

- [ ] **PRIVATE-01**: `prop_answers_read` RLS policy tightened to `user_id = (select auth.uid())` only — no post-kickoff exists-clause; verified via `bash scripts/verify-rls-no-leak.sh` returning ALL TABLES PASS (per D-38)
- [ ] **PRIVATE-02**: Props page relocates from `/[locale]/props` to `/[locale]/me/props`; old route returns 301 redirect to the new path (per D-37 + nav D-37)
- [ ] **PRIVATE-03**: `/[locale]/me/props` page simplified to remove `isRevealed` branch — user always sees own answers only, pre-lock editable / post-lock read-only receipt (per D-38 + D-39)
- [ ] **PRIVATE-04**: `/[locale]/me` page gains a "Props" card linking to `/[locale]/me/props` with a status pill indicating editable/locked state, plus a body line referencing the June 11 19:00 UTC deadline (per D-37 + D-39). [Revision iteration 2 (2026-05-26): pill copy relaxed from "Editable until June 11 19:00 UTC" to short-form "Editable"/"Locked" so the pill fits at 360px without wrapping in both locales; the long-form deadline lives in the body line. The pill is a status indicator, not a deadline indicator.]

#### Read-only bracket view (BRK-VIEW)

- [ ] **BRK-VIEW-01**: `/[locale]/bracket` server-renders the WC 2026 knockout tree as a column-of-rounds RSC reading `bracket_slots` joined to `fixtures` + `teams` in a single Supabase query (per D-40 + D-47)
- [ ] **BRK-VIEW-02**: Bracket view live-fills via existing admin `saveResult` Server Action: each KO match result triggers `revalidatePath('/he/bracket')` + `revalidatePath('/en/bracket')`; admin re-entry recomputes immediately (per D-40 + D-47)
- [ ] **BRK-VIEW-03**: `bracket_slots.resolved_team_id` writeback added to `saveResult` for non-group fixtures — winner ID computed from `result_home_90min`/`result_away_90min` 90-minute decision; tied KO matches at 90 min leave `resolved_team_id` NULL until Phase 3 ET handling (per D-47)
- [ ] **BRK-VIEW-04**: Champion slot (`slot_code = 'CHAMPION'`) populated by propagating the FINAL match winner to `CHAMPION.resolved_team_id` as part of the same `saveResult` writeback path (per Research Addendum D-40 "Open risks #1")
- [ ] **BRK-VIEW-05**: Bracket view renders correctly at 360px in both `/he/` (RTL) and `/en/` (LTR) using Tailwind v4 logical-property utilities only (no `pl-*`/`pr-*`/`left-*`/`right-*`/`flex-row-reverse`) per Phase 1 FND-03 lint convention

#### Auto-fetch match scores (AUTO)

- [ ] **AUTO-01**: New migration `0014_fixtures_auto_fetched_at.sql` adds `fixtures.auto_fetched_at timestamptz NULL` column with comment documenting the admin-overwrite invariant (per D-45 + D-47 + Research Addendum)
- [ ] **AUTO-02**: New `/api/score-fetch` POST route handler with Bearer-token auth (env var `SCORE_FETCH_SECRET`) — rejects 401 without valid Bearer; fetches football-data.org v4 `/competitions/{code}/matches`; resolves fixtures by `(kickoff_at ±5min, home_team.code, away_team.code)` tuple; performs SELECT-then-UPDATE with admin-lock check in JavaScript (no `.or()` filter ambiguity); sweeps predictions via existing `sweepAndUpsert` helper (per D-45 + D-46)
- [ ] **AUTO-03**: New migration `0012_pg_cron_score_fetch.sql` enables `pg_cron` + `pg_net` Postgres extensions and schedules a job that POSTs to `/api/score-fetch` every 15 minutes during the tournament window (per D-45)
- [ ] **AUTO-04**: Admin `saveResult` Server Action sets `auto_fetched_at = NULL` on every UPDATE so a manual admin entry blocks future cron overwrites (per D-45 + D-47 admin-overwrite invariant)
- [ ] **AUTO-05**: Wave-0 unit test asserts all 104 fixtures from `data/wc2026/fixtures.csv` map cleanly against a synthesized football-data.org response shape — catches vendor TLA mismatches before they bite live (per D-46 + Research Addendum "identifier mapping problem")
- [ ] **AUTO-06**: Tournament-window gate inside `/api/score-fetch` short-circuits with `{ok: true, skipped: 'outside-tournament-window'}` when `now()` is outside `tournament.starts_at - 1h` .. `tournament.ends_at + 1d` (per Research Addendum D-44 "Cron schedule choice")
- [ ] **AUTO-07**: STRIDE threat model documented in Plan 02-12: rejection of non-`[\p{L}\d \-.,]` chars in team-name upsert path (stored-XSS defense); Bearer-secret check (auth-bypass defense); SELECT-then-UPDATE admin-lock check (admin-overwrite race defense)

## v2 Requirements

Acknowledged, not in current roadmap. Move to v1 only if explicitly re-scoped.

### Realtime & Notifications

- **RT-01**: Leaderboard updates in realtime via Supabase Realtime subscription on `match_results` (trigger to upgrade: family complains about manual refresh)
- **NOTF-01**: WhatsApp / Telegram nudges before lock and after results (out-of-band via family's existing WhatsApp group, no in-app notifications)

### Engagement

- **HIST-01**: Prediction history view per user (all predictions ever made, with scoring annotations)
- **STAT-01**: Personalized mini-stats ("you're best at picking draws", "your accuracy this round was X%")
- **H2H-01**: Head-to-head comparison between two players (who picked what)

### Cosmetics

- **POL-01**: Dark mode
- **POL-02**: Charts (score-over-time, accuracy-by-round)
- **POL-03**: Achievement badges / streaks

### Reusability

- **TOUR-01**: Multi-tournament support — repurpose the platform for Euros 2028, next WC, etc.
- **CFG-01**: Configurable scoring rules (admin sets 4/3/2 vs other values per tournament)

## Out of Scope

Explicitly excluded for v1. Documented so they do not get re-added by accident.

| Feature | Reason |
|---------|--------|
| Real money / betting / wallet | Friendly family pool only — no payment infrastructure, no gambling-law surface area |
| Email / password / OAuth login | Invite code + display name is the explicit identity model; family trust covers anti-cheat |
| Public open signup | Invite-code only by design; limits abuse and identity friction |
| External sports API integration (auto-fetch fixtures/results) | Admin enters results manually; pre-seeded fixtures sufficient; less infra to break |
| Multiple admins / role hierarchy | One trusted operator (the user); no permissions matrix |
| Native mobile app | Web mobile-responsive is enough for family-on-couch usage |
| In-app chat / comments / DMs | Family WhatsApp already covers this |
| Push notifications | Same — WhatsApp covers it |
| Bracket cascade mode | Common source of office-pool confusion; we use Option A (independent picks per slot) |
| Per-round / in-tournament prop bets | Only tournament-level props in v1; locked at first kickoff |
| Configurable scoring rules | 4/3/2 and bracket 2/4/8/16/32 are hardcoded for v1 |
| TanStack Query / Redux / other client-state libs | RSC + Server Actions + `revalidatePath` is enough for ~15 users |
| Date library (date-fns / Day.js / Luxon) | Native `Intl.DateTimeFormat` + UTC `timestamptz` covers all needs |
| Vitest unit tests for v1 | Playwright smoke is the only test surface that matters at this scope |
| `tailwindcss-rtl` plugin | Tailwind v4 ships logical-property utilities natively; plugin is legacy |

## Traceability

Populated by `gsd-roadmapper` on 2026-05-23. 100% v1 coverage (66 / 66 mapped).

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | Phase 1 | Complete |
| FND-02 | Phase 1 | Complete |
| FND-03 | Phase 1 | Complete (Plan 01-05: husky + GH Actions both gate lint:rtl) |
| FND-04 | Phase 1 | Complete |
| FND-05 | Phase 1 | Complete (Plan 01-05: cron `0 12 */3 * *` on /api/heartbeat; Supabase Postgres log verified) |
| FND-06 | Phase 1 | Complete (Plan 01-05 Task 4: zekez mobile QA approved 2026-05-24) |
| I18N-01 | Phase 1 | Complete |
| I18N-02 | Phase 1 | Complete |
| I18N-03 | Phase 1 | Complete |
| I18N-04 | Phase 1 | Complete |
| I18N-05 | Phase 1 | Complete |
| I18N-06 | Phase 1 | Complete (structural; full bidi stress-test deferred to Phase 2 QA-03) |
| I18N-07 | Phase 1 | Complete |
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| AUTH-05 | Phase 1 | Complete |
| AUTH-06 | Phase 1 | Complete (D-05: unlocalized /admin) |
| AUTH-07 | Phase 1 | Complete (D-02: Supabase 30/hr/IP cap; Turnstile post-launch) |
| DATA-01 | Phase 1 | Complete |
| DATA-02 | Phase 1 | Complete |
| DATA-03 | Phase 1 | Complete |
| DATA-04 | Phase 1 | Complete |
| DATA-05 | Phase 1 | Complete |
| VIS-06 | Phase 1 | Complete |
| LGE-01 | Phase 2 | Pending |
| LGE-02 | Phase 2 | Pending |
| LGE-03 | Phase 2 | Pending |
| LGE-04 | Phase 2 | Pending |
| LGE-05 | Phase 2 | Pending |
| LGE-06 | Phase 2 | Pending |
| PRP-01 | Phase 2 | Pending — reinterpreted by D-38 (private; see PRIVATE-01..04) |
| PRP-02 | Phase 2 | Pending — reinterpreted by D-38 (private; see PRIVATE-01..04) |
| PRP-03 | Phase 2 | Pending — reinterpreted by D-38 (private; see PRIVATE-01..04) |
| PRP-04 | Phase 2 | Pending — reinterpreted by D-38 (private; see PRIVATE-01..04) |
| VIS-01 | Phase 2 | Pending |
| VIS-02 | Phase 2 | Pending |
| VIS-04 | Phase 2 | Pending — reinterpreted by D-38 (private; see PRIVATE-01..04) |
| VIS-05 | Phase 2 | Pending |
| ADM-01 | Phase 2 | Pending |
| ADM-02 | Phase 2 | Pending |
| ADM-03 | Phase 2 | Pending |
| ADM-04 | Phase 2 | Pending |
| ADM-05 | Phase 2 | Pending |
| ADM-06 | Phase 2 | Pending |
| SCR-01 | Phase 2 | Pending |
| SCR-02 | Phase 2 | Pending |
| SCR-04 | Phase 2 | Pending |
| SCR-05 | Phase 2 | Pending |
| SCR-06 | Phase 2 | Pending |
| SCR-07 | Phase 2 | Pending |
| LB-01 | Phase 2 | Pending |
| LB-02 | Phase 2 | Pending |
| LB-03 | Phase 2 | Pending |
| LB-04 | Phase 2 | Pending |
| QA-01 | Phase 2 | Pending |
| QA-02 | Phase 2 | Pending |
| QA-03 | Phase 2 | Pending |
| QA-04 | Phase 2 | Pending |
| BRK-01 | Out-of-Scope | Cancelled 2026-05-26 (D-34) |
| BRK-02 | Out-of-Scope | Cancelled 2026-05-26 (D-34) |
| BRK-03 | Out-of-Scope | Cancelled 2026-05-26 (D-34) |
| BRK-04 | Out-of-Scope | Cancelled 2026-05-26 (D-34) |
| VIS-03 | Out-of-Scope | Cancelled 2026-05-26 (D-34) |
| SCR-03 | Out-of-Scope | Cancelled 2026-05-26 (D-34) |
| PROJECT-UPD-01 | Phase 2 (Plan 02-09) | Pending |
| PROJECT-UPD-02 | Phase 2 (Plan 02-09) | Pending |
| PROJECT-UPD-03 | Phase 2 (Plan 02-09) | Pending |
| PRIVATE-01 | Phase 2 (Plan 02-10) | Pending |
| PRIVATE-02 | Phase 2 (Plan 02-10) | Pending |
| PRIVATE-03 | Phase 2 (Plan 02-10) | Pending |
| PRIVATE-04 | Phase 2 (Plan 02-10) | Pending |
| BRK-VIEW-01 | Phase 2 (Plan 02-11) | Pending |
| BRK-VIEW-02 | Phase 2 (Plan 02-11) | Pending |
| BRK-VIEW-03 | Phase 2 (Plan 02-11) | Pending |
| BRK-VIEW-04 | Phase 2 (Plan 02-11) | Pending |
| BRK-VIEW-05 | Phase 2 (Plan 02-11) | Pending |
| AUTO-01 | Phase 2 (Plan 02-12) | Pending |
| AUTO-02 | Phase 2 (Plan 02-12) | Pending |
| AUTO-03 | Phase 2 (Plan 02-12) | Pending |
| AUTO-04 | Phase 2 (Plan 02-12) | Pending |
| AUTO-05 | Phase 2 (Plan 02-12) | Pending |
| AUTO-06 | Phase 2 (Plan 02-12) | Pending |
| AUTO-07 | Phase 2 (Plan 02-12) | Pending |

**Coverage:**
- v1 requirements: 66 total (note: REQUIREMENTS.md previously stated "67 total" — recount audit during roadmap mapping reconciled to 66 distinct REQ-IDs)
- Mapped to phases: 66
- Unmapped: 0 ✓

### Coverage by Phase

| Phase | Count | Categories |
|-------|-------|------------|
| Phase 1: Foundation, Schema, Auth & RLS | 26 | FND × 6, I18N × 7, AUTH × 7, DATA × 5, VIS-06 |
| Phase 2: June 11 MVP | 34 | LGE × 6, PRP × 4, VIS (01/02/04/05) × 4, ADM × 6, SCR (01/02/04/05/06/07) × 6, LB × 4, QA × 4 |
| Phase 3: Bracket Mode | 6 | BRK × 4, VIS-03, SCR-03 |

---
*Requirements defined: 2026-05-23*
*Last updated: 2026-05-24 — Phase 1 complete (all 26 Phase 1 requirements addressed; FND-03 + FND-05 + FND-06 marked complete by Plan 01-05)*
*Scope expansion (PROJECT-UPD, PRIVATE, BRK-VIEW, AUTO families): 2026-05-26 — derived from Phase 2 CONTEXT addendum D-34..D-47*

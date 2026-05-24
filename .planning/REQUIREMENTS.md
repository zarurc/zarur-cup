# Requirements: Zarur-Cup / משחקי זערור

**Defined:** 2026-05-23
**Core Value:** Predictions submitted before kickoff get scored automatically against a unified leaderboard that the whole family can see.

**Hard deadline:** Live and usable by **June 11, 2026** (WC 2026 opening match).

## v1 Requirements

Requirements for initial release. Each maps to a roadmap phase below.

### Foundation & Shell

- [x] **FND-01**: Next.js 15 (App Router) project deployable on Vercel from `main` branch
- [x] **FND-02**: Tailwind CSS v4 configured; `<html dir>` is set server-side per locale so there is no FOUC/hydration flash
- [ ] **FND-03**: CI lint rule (or grep-based pre-commit) rejects physical-direction Tailwind utilities (`pl-/pr-/ml-/mr-/text-left/text-right/border-l-/border-r-/left-/right-`); only logical equivalents (`ps-`, `pe-`, `ms-`, `me-`, `text-start`, `text-end`, `start-`, `end-`) are allowed
- [x] **FND-04**: Supabase project provisioned with `@supabase/ssr` integration and generated TypeScript types
- [ ] **FND-05**: Vercel Cron triggers `/api/heartbeat` every 3 days; heartbeat performs a real DB query (e.g. `SELECT 1 FROM fixtures LIMIT 1`) so Supabase free-tier auto-pause never fires before tournament end
- [ ] **FND-06**: Mobile-responsive shell (header, footer, layout primitives) verified on a real phone in both Hebrew (RTL) and English (LTR)

### Internationalization & Localization

- [x] **I18N-01**: User can browse the app at `/he/...` (RTL, Hebrew copy) and `/en/...` (LTR, English copy)
- [x] **I18N-02**: First visit auto-selects locale based on `Accept-Language` header; falls back to Hebrew if no match
- [ ] **I18N-03**: User can toggle between Hebrew and English from any page; selection persists across sessions (cookie + `profiles.locale` when signed in)
- [x] **I18N-04**: All UI strings live in `messages/{en,he}.json` via next-intl v4 with ICU plural rules
- [ ] **I18N-05**: Team names, prop questions, and other domain content render in the active locale (`_en` / `_he` DB columns)
- [ ] **I18N-06**: Mixed-direction strings like scores ("2 - 1") render correctly in both locales (`<bdi>` or `<span dir="ltr">` wrapping where needed)
- [ ] **I18N-07**: Kickoff times render in the viewer's local timezone using native `Intl.DateTimeFormat` with the correct locale-specific date/time format

### Authentication & Identity

- [ ] **AUTH-01**: Family member can join the pool by entering the shared invite code on a join page
- [ ] **AUTH-02**: Successful invite-code validation creates an anonymous Supabase session (`signInAnonymously()`) and writes a row in `profiles` with the chosen display name and locale
- [ ] **AUTH-03**: Display names are unique within the tournament, validated server-side, and sanitized to prevent XSS
- [ ] **AUTH-04**: Session persists across browser refresh and across days on the same device (anonymous session refresh via `@supabase/ssr` middleware)
- [ ] **AUTH-05**: Anyone without a profile sees the join page only; protected routes redirect unauthenticated users to `/[locale]/join`
- [ ] **AUTH-06**: Admin identity is a boolean flag (`profiles.is_admin`); only admins can reach `/[locale]/admin/...` routes (enforced server-side, not just in the UI)
- [ ] **AUTH-07**: Invite code is rate-limited / brute-force-resistant (e.g. Cloudflare Turnstile or per-IP attempt cap)

### Tournament Data (Pre-Seeded WC 2026)

- [ ] **DATA-01**: All 48 WC 2026 teams seeded into `teams` table with `name_en`, `name_he`, ISO country code, and group letter (where assigned)
- [ ] **DATA-02**: All 104 WC 2026 fixtures seeded into `fixtures` table with UTC kickoff times (`timestamptz`), stage label, group code, and symbolic `home_placeholder` / `away_placeholder` references where the team is TBD (e.g. `WINNER_GROUP_A`, `R32_M1_W`)
- [x] **DATA-03**: Bracket slot graph seeded (R32 → R16 → QF → SF → F + Winner) so bracket picks can attach by `slot_id` independent of which teams advance (schema landed in Plan 01-02 migration 0001_init.sql; seed rows arrive in Plan 01-03)
- [ ] **DATA-04**: Hebrew team names reviewed by a Hebrew-native speaker before family invite code is distributed
- [ ] **DATA-05**: Tournament-level prop questions (~5–10) authored by admin in both languages, with structured answer types (single-team, single-player, text)

### League Mode (Per-Match Predictions)

- [ ] **LGE-01**: Signed-in user can view a per-matchday list of fixtures with kickoff time, both teams, lock state (countdown / locked / finished), and the user's existing prediction if any
- [ ] **LGE-02**: User can enter a home-score and away-score prediction per fixture via a mobile-first stepper UX
- [ ] **LGE-03**: User can edit an existing prediction at any time before kickoff
- [ ] **LGE-04**: Server-side lock — Postgres RLS rejects any INSERT or UPDATE to `predictions` where `(SELECT kickoff_at FROM fixtures WHERE id = fixture_id) <= now()`. Lock is independent of client clock
- [ ] **LGE-05**: Submission state is unmistakable — explicit success/saved indicator after every prediction write, never silent
- [ ] **LGE-06**: Daily integrity query (admin-visible) confirms zero rows where `predictions.submitted_at > fixtures.kickoff_at`

### Bracket Mode (Knockout Predictions)

- [ ] **BRK-01**: User can fill out bracket picks for the knockout stage (R32 → Final + Champion) by `slot_id`, regardless of whether the team identity is currently a placeholder
- [ ] **BRK-02**: Bracket picks made pre-tournament survive group-stage placeholder resolution — user keeps the same pick even after `WINNER_GROUP_A` resolves to a real team
- [ ] **BRK-03**: Server-side lock — RLS rejects any change to a bracket pick where the corresponding slot's earliest possible match has kicked off (per the agreed-upon reveal granularity)
- [ ] **BRK-04**: Bracket UI is RTL-safe (the bracket tree flips for Hebrew without breaking visual hierarchy)

### Props / Wildcards (Tournament-Level)

- [ ] **PRP-01**: User can answer all open prop questions before the first fixture kicks off
- [ ] **PRP-02**: User can edit prop answers until the first fixture kicks off
- [ ] **PRP-03**: Server-side lock — RLS rejects any INSERT or UPDATE to `prop_answers` after the tournament's first fixture kickoff
- [ ] **PRP-04**: Admin can grade prop questions (set correct answer) once known (e.g. top scorer after the tournament ends)

### Visibility (Hidden Until Lock)

- [ ] **VIS-01**: User can see their own predictions, bracket picks, and prop answers at any time
- [ ] **VIS-02**: User cannot see another player's prediction for a fixture until that fixture has kicked off (RLS-enforced; not just UI-hidden)
- [ ] **VIS-03**: User cannot see another player's bracket picks until the agreed-upon bracket reveal moment
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
- [ ] **SCR-03**: Bracket scoring escalates per round: R32 = 2 (if used), R16 = 2, QF = 4, SF = 8, F = 16, Champion = 32; based on advancement, not score
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
| FND-03 | Phase 1 | Pending |
| FND-04 | Phase 1 | Complete |
| FND-05 | Phase 1 | Pending |
| FND-06 | Phase 1 | Pending |
| I18N-01 | Phase 1 | Complete |
| I18N-02 | Phase 1 | Complete |
| I18N-03 | Phase 1 | Pending |
| I18N-04 | Phase 1 | Complete |
| I18N-05 | Phase 1 | Pending |
| I18N-06 | Phase 1 | Pending |
| I18N-07 | Phase 1 | Pending |
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 1 | Pending |
| AUTH-06 | Phase 1 | Pending |
| AUTH-07 | Phase 1 | Pending |
| DATA-01 | Phase 1 | Pending |
| DATA-02 | Phase 1 | Pending |
| DATA-03 | Phase 1 | Complete |
| DATA-04 | Phase 1 | Pending |
| DATA-05 | Phase 1 | Pending |
| VIS-06 | Phase 1 | Complete |
| LGE-01 | Phase 2 | Pending |
| LGE-02 | Phase 2 | Pending |
| LGE-03 | Phase 2 | Pending |
| LGE-04 | Phase 2 | Pending |
| LGE-05 | Phase 2 | Pending |
| LGE-06 | Phase 2 | Pending |
| PRP-01 | Phase 2 | Pending |
| PRP-02 | Phase 2 | Pending |
| PRP-03 | Phase 2 | Pending |
| PRP-04 | Phase 2 | Pending |
| VIS-01 | Phase 2 | Pending |
| VIS-02 | Phase 2 | Pending |
| VIS-04 | Phase 2 | Pending |
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
| BRK-01 | Phase 3 | Pending |
| BRK-02 | Phase 3 | Pending |
| BRK-03 | Phase 3 | Pending |
| BRK-04 | Phase 3 | Pending |
| VIS-03 | Phase 3 | Pending |
| SCR-03 | Phase 3 | Pending |

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
*Last updated: 2026-05-23 — traceability populated by gsd-roadmapper*

# Roadmap: Zarur-Cup / משחקי זערור

**Project code:** ZC
**Created:** 2026-05-23
**Granularity:** coarse (3 phases derived from a 19-day deadline + a soft post-launch bracket window)
**Hard deadline:** **June 11, 2026** — FIFA World Cup 2026 opening match (Phases 1 and 2)
**Soft deadline:** **June 27, 2026** — first knockout match (Phase 3 / Bracket Mode)
**Coverage:** 66 / 66 v1 requirements mapped (100%)

## Core Value (from PROJECT.md)

> Predictions submitted before kickoff get scored automatically against a unified leaderboard that the whole family can see. **If the leaderboard is broken or wrong, nothing else matters.**

Phase 2 is the "if everything else fails, this must work" bundle. League predictions + admin result entry + scoring + leaderboard ship together for opening kickoff. Props are bundled into Phase 2 because they lock at first kickoff anyway. Bracket Mode is **explicitly deferred to Phase 3** with a soft deadline of June 27 (start of knockouts).

## Bracket Mode Scope Decision

**Bracket Mode is NOT in the June 11 MVP.** It ships in Phase 3, targeting completion before the first knockout match (~June 27).

Rationale:
- Family can still submit League predictions and Props by June 11 without Bracket Mode.
- Bracket Mode's slot-based pre-tournament champion/finalist picks remain valid pre-knockout — the bracket UI can lag the group stage without breaking pool dynamics.
- Compressing Bracket into the June 11 deadline risks shipping the rest broken; deferring it buys ~16 days of polish room.
- Trade-off accepted: family loses ~2 weeks of pre-tournament champion-pick anticipation. Soft-mitigated by Props (which include "winner" as a tournament-level prop, locked at first kickoff).

## Phases

- [x] **Phase 1: Foundation, Schema, Auth & RLS** — Bilingual Next.js shell + Supabase schema + invite-code auth + RLS lock/reveal policies + WC 2026 data seed (COMPLETE 2026-05-24; live at https://zarur-cup.vercel.app)
- [ ] **Phase 2: June 11 MVP — League + Props + Scoring + Leaderboard + Admin + Ship Gate** — End-to-end predict-lock-score-reveal-leaderboard flow; props; admin result entry; Playwright smoke; family invite distributed
- [ ] **Phase 3: Bracket Mode (Pre-Knockout Ship)** — Slot-based knockout picks + bracket scoring rolled into unified leaderboard, locked at first knockout

## Phase Details

### Phase 1: Foundation, Schema, Auth & RLS

**Goal**: A deployed bilingual shell where a family member can enter the invite code, pick a display name, land in their locale's session, and the database has the full WC 2026 schedule with RLS policies that already lock and hide predictions — even though predictions don't exist yet.

**Depends on**: Nothing (first phase, greenfield)

**Target deadline**: ~Day 7 of 19 (by ~June 1, 2026) so Phase 2 has 10 working days

**Requirements** (26 of 66):
- FND-01, FND-02, FND-03, FND-04, FND-05, FND-06
- I18N-01, I18N-02, I18N-03, I18N-04, I18N-05, I18N-06, I18N-07
- AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07
- DATA-01, DATA-02, DATA-03, DATA-04, DATA-05
- VIS-06

**Success Criteria** (what must be TRUE for a user when this phase completes):
1. A new family member visits the deployed URL on their phone in Israel; the page renders in Hebrew with `<html dir="rtl">` set server-side (no FOUC, no hydration flash); browser-language detection picks `he` for an Israeli locale; an `Accept-Language: en-US` request lands on `/en/...` with `dir="ltr"`.
2. The user enters the shared invite code on `/he/join`, picks a unique display name, and is redirected to a protected page; their session survives a page refresh and a next-day return on the same device.
3. From a logged-out terminal, `curl https://<deploy>/rest/v1/predictions?select=*` returns zero rows even though the predictions table exists — RLS is the lock, not the UI. Same call signed in as User A returns only User A's rows for fixtures whose kickoff has not yet passed.
4. The admin can query `select count(*) from fixtures` and see 104 rows; `select count(*) from teams` returns 48; Hebrew team names are present in `teams.name_he` and have been reviewed by a Hebrew-native speaker; the bracket slot graph (R32 → R16 → QF → SF → F + Champion) is fully populated.
5. The Vercel Cron heartbeat hits `/api/heartbeat` every 3 days, executes a real `SELECT ... FROM fixtures LIMIT 1` against Supabase, and the most recent ping is visible in Supabase logs — Supabase free-tier auto-pause cannot fire before the tournament ends.

**Plans**: 5 plans across 4 waves

- [x] 01-01-PLAN.md — Wave 1: Bootstrap (Next.js 15.5 + Tailwind v4 + next-intl + Supabase clients + design tokens)
- [x] 01-02-PLAN.md — Wave 2: Schema migrations 0001 + 0002 (tables + RLS lock-and-reveal policies) + [BLOCKING] db push + types regen + VIS-06 verification script (shipped 2026-05-23; added 0003_grants.sql + 0004_anon_select.sql as Rule 2 / Rule 1 deviations to handle `Automatically expose new tables: OFF` and the RLS-as-visible-lock contract)
- [x] 01-03-PLAN.md — Wave 3: WC 2026 seed migration 0003 (48 teams + 104 fixtures + bracket slot graph + props) with [DATA-04 GATE] Hebrew native-speaker review
- [x] 01-04-PLAN.md — Wave 3 (parallel with 03): Auth flow (invite-code Server Action + signInAnonymously + profile insert with family-trust rebind on display_name conflict) + bilingual UI shell (header / locale pill / bottom tab bar / placeholder pages) + admin gate at unlocalized /admin/* (shipped 2026-05-23; 8 commits total = 3 original execute + 5 fix-up after human-verify; resolved 4 checkpoint bugs)
- [x] 01-05-PLAN.md — Wave 4: /api/heartbeat route + Vercel deploy + Cron + FND-03 pre-commit + CI lint workflow (shipped 2026-05-24; live at https://zarur-cup.vercel.app; cron `0 12 */3 * *` verified in Supabase Postgres logs; husky + GitHub Actions both gating FND-03; 4 Rule-3 blocking deviations recorded — lockfile rewrite, types un-gitignored, Tailwind v4 var(), git author rewrite)

---

### Phase 2: June 11 MVP — League + Props + Scoring + Leaderboard + Admin + Ship Gate

**Goal**: By the opening match of WC 2026, the family can submit per-match score predictions for any fixture, the predictions lock at kickoff, the admin enters results, scoring resolves automatically against a unified leaderboard, and every family member sees their standing with a per-mode breakdown — all in Hebrew RTL or English LTR. **This phase is the project's core value. If it ships and works, the rest is upside.**

**Depends on**: Phase 1 (schema, RLS, auth, seed, bilingual shell)

**Target deadline**: **June 11, 2026 (hard)** — by FIFA WC 2026 opening kickoff

**Requirements** (34 of 66):
- LGE-01, LGE-02, LGE-03, LGE-04, LGE-05, LGE-06
- PRP-01, PRP-02, PRP-03, PRP-04
- VIS-01, VIS-02, VIS-04, VIS-05
- ADM-01, ADM-02, ADM-03, ADM-04, ADM-05, ADM-06
- SCR-01, SCR-02, SCR-04, SCR-05, SCR-06, SCR-07
- LB-01, LB-02, LB-03, LB-04
- QA-01, QA-02, QA-03, QA-04

**Success Criteria** (what must be TRUE for a user when this phase completes):
1. A signed-in family member on a phone scrolls a matchday list, sees each fixture's kickoff time in their local timezone with a live countdown, taps a fixture, enters home/away scores via a stepper UX, and sees an explicit "saved" indicator; they can return and edit any prediction up until kickoff, and after kickoff the form is grayed out with a "locked" badge. A direct REST write attempted via `curl` after kickoff is rejected by RLS (verified by the daily integrity query returning zero `predictions.submitted_at > fixtures.kickoff_at` rows).
2. Before the tournament's first kickoff, every family member can answer all ~5–10 prop questions in their locale (Hebrew or English prompts from `prop_questions.prompt_he` / `prompt_en`); after the first match starts, prop answers become read-only at the database level and other members' answers become visible.
3. The admin enters the result of a fixture in the admin dashboard; on next page navigation, the user's prediction row shows the actual result alongside their pick, a per-pick breakdown ("4 = exact score" / "3 = goal diff" / "2 = winner" / "0 = miss") explains the points, and the unified leaderboard reflects the new total. If the admin corrects the result, the leaderboard recomputes idempotently — no double-counting, no manual refresh ritual.
4. Every family member can view the unified leaderboard ranked by total points with the tiebreaker chain (total → exact scores → correct results → locale-aware alphabetical), click any player, and see that player's per-mode breakdown (League / Props subtotals; Bracket subtotal is present but zero until Phase 3 ships). Each family member also has a visible "your scoring transparency" view on any of their own predictions.
5. By June 11 kickoff, the deployed URL has been distributed to the family with the shared invite code; a Hebrew native speaker has reviewed all user-visible copy and seeded prop content; a manual mobile QA pass on a real phone (in both Hebrew and English) has been signed off; and one end-to-end Playwright smoke test passes (`invite → predict → lock at fake-now → admin enters result → score appears on leaderboard`).

**Plans**: TBD (generated by `/gsd:plan-phase 2`)

---

### Phase 3: Bracket Mode (Pre-Knockout Ship)

**Goal**: Before the first WC 2026 knockout match (~June 27), every family member can fill out their knockout bracket on a slot-based UI that survives group-stage placeholder resolution; bracket picks lock per the agreed reveal granularity; bracket points contribute to the same unified leaderboard already shipped in Phase 2.

**Depends on**: Phase 1 (bracket slot graph is already seeded), Phase 2 (unified leaderboard, scoring engine, scoring transparency UI patterns already in production)

**Target deadline**: **June 27, 2026 (soft)** — by first knockout match. If group stage shows Brazil into R32 on June 26, the bracket UI must accept picks that reference R32 slots (not specific Brazil-vs-X matchups). Picks must rebind through placeholder resolution without user action.

**Requirements** (6 of 66):
- BRK-01, BRK-02, BRK-03, BRK-04
- VIS-03
- SCR-03

**Success Criteria** (what must be TRUE for a user when this phase completes):
1. A family member opens `/he/bracket` on a phone, sees the bracket tree flipped to RTL with the visual hierarchy intact (champion on the leading side, R32 on the trailing side, no overlapping nodes), picks a team for each slot (R32 → R16 → QF → SF → F + Champion) by `slot_id` rather than by specific opponent — a pick made before Group A resolves remains the same pick after `WINNER_GROUP_A` resolves to BRA.
2. After the first knockout match kicks off (per the agreed-upon reveal granularity), `curl` attempts to write or change a bracket pick are rejected by RLS at the database, and other family members' bracket picks become visible for already-locked slots.
3. When the admin enters a knockout result and (if applicable) updates a downstream placeholder, the scoring trigger awards points to bracket picks per the escalating schedule (R32 = 2 / R16 = 2 / QF = 4 / SF = 8 / F = 16 / Champion = 32) based on whether the picked team is the actual advancer at that slot — all integer math, idempotent on admin correction. Bracket subtotals appear on the per-mode breakdown drill-down that already shipped in Phase 2; the unified leaderboard now reflects League + Bracket + Props together.

**Plans**: TBD (generated by `/gsd:plan-phase 3`)

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation, Schema, Auth & RLS | 5/5 | Complete | 2026-05-24 |
| 2. June 11 MVP (League + Props + Scoring + Leaderboard + Admin + Ship Gate) | 0/TBD | Not started | - |
| 3. Bracket Mode (Pre-Knockout Ship) | 0/TBD | Not started | - |

## Coverage Audit

**Mapped: 66 / 66 v1 requirements (100%)**

| Phase | Requirements Mapped |
|-------|---------------------|
| Phase 1 | 26 (FND × 6, I18N × 7, AUTH × 7, DATA × 5, VIS-06 × 1) |
| Phase 2 | 34 (LGE × 6, PRP × 4, VIS-01/02/04/05 × 4, ADM × 6, SCR-01/02/04/05/06/07 × 6, LB × 4, QA × 4) |
| Phase 3 | 6 (BRK × 4, VIS-03, SCR-03) |
| **Total** | **66** |

No orphaned requirements. No duplicate assignments.

## Granularity Notes

`config.json` requests **coarse** granularity (3-5 phases, 1-3 plans each). Final shape: **3 phases** — fewer than the research's suggested 6 — justified by:

- **Phase 1 absorbs research P1 (Foundation) + research P2 (Schema & RLS).** They are tightly coupled: RLS depends on schema, schema depends on Supabase project, Supabase project depends on Next.js scaffold. Splitting them would create artificial phase boundaries inside a single sequence of one-developer work.
- **Phase 2 absorbs research P3 (League Mode) + research P4 (Props) + research P5 (Scoring + Leaderboard) + research P6 (Polish + Ship).** Justified by the **June 11 hard deadline** — these all must ship together or the MVP misses the opening match. Plans within Phase 2 will reflect this internal sequence (League first → Scoring engine → Leaderboard → Props → Ship gate).
- **Phase 3 is research P4's Bracket sub-component only**, isolated to its own phase because it has a different deadline (June 27 soft, not June 11 hard).

## Dependencies Diagram

```
Phase 1 (Foundation, Schema, Auth & RLS)
    │
    │ unlocks: every write/read, every bilingual screen,
    │          every RLS-enforced lock and reveal
    ▼
Phase 2 (June 11 MVP — League + Props + Scoring + Leaderboard + Admin + Ship Gate)
    │
    │ unlocks: unified leaderboard infrastructure, scoring
    │          engine, admin result entry, scoring transparency UI
    ▼
Phase 3 (Bracket Mode — Pre-Knockout Ship)
    Bracket subtotal rolls into the already-shipped unified leaderboard.
```

## Out-of-Scope (Not Mapped to Any Phase)

Per REQUIREMENTS.md "v2 Requirements" and "Out of Scope" sections — explicitly deferred or excluded:

- Realtime leaderboard (RT-01) — defer to v1.x post-launch trigger
- WhatsApp/Telegram nudges (NOTF-01) — family WhatsApp covers this
- Prediction history view (HIST-01) — defer
- Personalized stats (STAT-01), H2H (H2H-01) — defer
- Polish: dark mode (POL-01), charts (POL-02), badges (POL-03) — defer
- Multi-tournament (TOUR-01), configurable scoring (CFG-01) — v2
- Real money, OAuth, public signup, external sports API, multi-admin, native mobile, in-app chat, bracket cascade mode, per-round props, client-state libs, date libraries, Vitest, tailwindcss-rtl — see REQUIREMENTS.md "Out of Scope" table

---
*Roadmap created: 2026-05-23 by gsd-roadmapper*
*Next: `/gsd:plan-phase 1`*

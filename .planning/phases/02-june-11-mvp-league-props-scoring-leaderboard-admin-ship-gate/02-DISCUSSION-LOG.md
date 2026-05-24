# Phase 2: June 11 MVP — League + Props + Scoring + Leaderboard + Admin + Ship Gate — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 02-June-11-MVP-League-Props-Scoring-Leaderboard-Admin-Ship-Gate
**Areas discussed:** Match list & prediction entry UX, Admin workflow, Scoring trigger location, Props + Leaderboard breakdown UX (added during discussion)

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Match list & prediction entry UX | Matchday list shape; inline stepper vs detail page; saved feedback; locked-state visual; countdown style | ✓ |
| Admin workflow (entry + correction + placeholder + integrity) | Result entry shape; correction UX; ADM-03 placeholder resolution; ADM-06 integrity check delivery | ✓ |
| Scoring trigger location | Postgres trigger on result UPDATE vs Server Action writing score_events | ✓ |
| Props + Leaderboard breakdown UX | Initially deferred to "planner picks defaults" — pulled into discussion mid-flow after user opted in | ✓ (during follow-up) |

**Notes:** The interactive AskUserQuestion picker did not register a selection on first two attempts; user then provided a comprehensive narrative answer for areas 1, 2, and 3 in a single prose message. Subsequent batched follow-ups (3-question set) and a 4-question Props/LB set were answered via the interactive picker cleanly. Mid-flow expansion into Props/LB happened because zekez chose option "Discuss Props/LB now" on the meta-question about that fourth area.

---

## Match List & Prediction Entry UX

| Option | Description | Selected |
|--------|-------------|----------|
| Chronological vertical feed grouped by date (sticky headers) | Single scroll, no swipe-tabs; sticky date headers | ✓ |
| Swipe-tabs per matchday | Users might miss matches hidden on other tabs | |
| Inline ± steppers on the row | Fly down list, hit +/- buttons | ✓ |
| Tap-to-detail page for entry | Click into a page just to input scores | |
| Toastless inline checkmark (Saved / נשמר) | Optimistic debounced save, transient inline confirmation | ✓ |
| Toast notification | Pop-up overlay confirmation | |
| Locked-state: capsule + 🔒 (dashes for no-pick) | Steppers vanish; read-only capsule + lock icon; `- : -` muted gray for no-prediction | ✓ |
| Global sticky countdown to nearest upcoming kickoff | Live ticker at top of screen across whole tournament | ✓ |
| Per-fixture countdown only | Countdown shown inline on each row | |

**User's choice:** All of the chronological-feed / inline-stepper / toastless-checkmark / capsule-with-lock / global-sticky-countdown bundle.
**Notes:** User explicitly called out "users often miss matches hidden on other tabs" as the rationale for rejecting swipe-tabs. The transient inline checkmark was specified as "tiny, transient green checkmark or a pulsing text fade (Saved / נשמר) right next to the team names." The global countdown was justified by "ensuring nobody misses a lock window."

### Sub-question — Post-result reveal layout

| Option | Description | Selected |
|--------|-------------|----------|
| Three elements: my pick \| actual \| +points badge | Compact per-row transparency | |
| Actual + points only; my pick collapsed | Cleaner list, one tap for detail | |
| Actual + everyone's picks side-by-side | Densest social UI; combines VIS-05 + SCR-07 in one reveal | ✓ |

**User's choice:** Side-by-side. **Notes:** Picks the highest-social-density option — every family member's pick visible with their per-pick `+pts` badge once the fixture locks (per VIS-05).

---

## Admin Workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Same chronological layout as players + [View]/[Score Entry] toggle | Admin uses player feed; flips toggle to open inputs | ✓ |
| Dedicated admin grid view | Separate admin-only UI | |
| Direct overwrite with idempotent re-score | Type new score, save; backend sweeps and recomputes | ✓ |
| Explicit "edit" affordance with diff confirmation | Click Edit, see old vs new, confirm | |
| ADM-03 placeholder in its own admin tab | Separate "Tournament Tree Setup" tab | ✓ |
| ADM-03 placeholder bundled with result entry | Resolve placeholders inline during match scoring | |
| ADM-06 integrity widget on admin dashboard | Persistent bottom-of-page widget showing 3 metrics | ✓ |
| ADM-06 via cron + log only | Background daily check writing to a log surface | |

**User's choice:** All four bundle items above.
**Notes:** User justified the toggle approach as "so you aren't fighting your own UI while trying to update scores mid-game." Integrity widget specified concretely: `Database Sync: OK | Total Predictions: 240 | Unscored Completed Matches: 0` — "faster to glance at than digging into Vercel/Supabase cron logs."

### Sub-question — Extra-time schema timing

| Option | Description | Selected |
|--------|-------------|----------|
| Group-stage-only schema in Phase 2; ET columns in Phase 3 | `result_home` / `result_away` only; defer ET migration | |
| ET-aware schema in Phase 2; ET UI also in Phase 2 | Full forward + ET admin UI before June 11 | |
| ET-aware schema in Phase 2; ET UI deferred to Phase 3 | Migrate columns now; ET admin UI lands with Bracket Mode | ✓ |

**User's choice:** Schema in 2, UI in 3. **Notes:** Knockouts don't start until June 28 (after the June 11 ship). Shipping ET schema columns now avoids a breaking migration mid-tournament; ET admin UI travels with Bracket Mode in Phase 3.

---

## Scoring Trigger Location

| Option | Description | Selected |
|--------|-------------|----------|
| Postgres trigger on `fixtures.result_*` UPDATE | PL/pgSQL writes score_events automatically | |
| Server Action after admin Save Result | TypeScript scores in app code; bulk-UPSERTs score_events | ✓ |

**User's choice:** Server Action.
**Notes:** User rationale was operator debuggability: "debugging a failing recursive SQL trigger during a live World Cup game when family members are yelling in the WhatsApp group is a nightmare." Specifically called out: (a) everything stays in the standard app codebase (easier for Claude Code to maintain/edit), (b) errors log to Vercel console in plain English, (c) idempotency preserved via bulk-UPSERT sweep of score_events for the affected match_id. Resolves STATE.md "Phase 1 / Phase 2 boundary: Scoring trigger in PL/pgSQL vs Server Action" open question — closed as **Server Action**.

---

## Props Page Shape (PRP-01/02)

| Option | Description | Selected |
|--------|-------------|----------|
| Single page with all questions visible | Vertical scroll; answer in any order; save inline | ✓ |
| Step-by-step wizard | One question at a time with Next/Back | |
| Grouped by answer type (team / player / text) | Visual grouping into sections | |

**User's choice:** Single page. **Notes:** Mirrors the match-list pattern; consistent mental model.

---

## Single-Team Prop Picker

| Option | Description | Selected |
|--------|-------------|----------|
| Country-flag grid (48 flags, 6×8) | Tap a flag, see selected state; language-neutral | ✓ |
| Dropdown / select with HE name + flag | Native `<select>`; saves space; slower scan | |
| Typeahead with team-name autocomplete | Type letters, list filters | |

**User's choice:** Flag grid. **Notes:** Visual, fast, language-neutral — works identically in HE and EN.

---

## Single-Player + Text Prop Picker

| Option | Description | Selected |
|--------|-------------|----------|
| Free-text input for both | Admin grades by case-insensitive string match | |
| Free-text + admin alias-set on grading | User types freely; admin creates aliases at grading time | ✓ |
| Add a `players` table (admin-seeded) | Schema work; defers Phase 2 work | |

**User's choice:** Free-text + admin alias-set. **Notes:** Catches typos and locale-name variants ("Messi" / "Lionel Messi" / "מסי") without forcing a player roster table. Schema implication: `prop_questions.correct_answer_aliases text[]`.

---

## Leaderboard Breakdown UX (LB-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Inline expand on the leaderboard row | Tap row, expand in-place; no navigation | ✓ |
| Dedicated `/players/[id]` page | Separate page with breakdown + pick history | |
| Bottom-sheet modal | Slides up from bottom; mobile-native | |

**User's choice:** Inline expand. **Notes:** Keeps `/leaderboard` as the single-source-of-truth screen. Bracket subtotal renders `0 — opens June 27` until Phase 3 lands.

---

## Claude's Discretion

User explicitly delegated to planner / Claude:
- Exact debounce timing for optimistic save (recommend ~600ms)
- Stepper micro-interactions (long-press, haptics)
- Countdown banner pixel positioning relative to header chrome
- Post-result reveal animation (accordion / slide / modal on small viewports)
- Admin sub-nav pattern (top-nav vs sidebar vs tabs)
- Props reveal card-vs-list rendering
- `score_events.kind` enum vs free-text modeling
- VIEW vs MATERIALIZED VIEW for `v_leaderboard` (start with VIEW)
- Migration file naming after `0006_reseed_wc2026.sql`
- Whether to extract shared `scoreSaveAction` helper
- `correct_answer_aliases` as column vs separate table
- Inline checkmark fade timing
- Whether ADM-03 propagation uses recursive SQL or app-code loop (recommend app-code per D-16 spirit)

## Deferred Ideas

- **Bracket Mode UI** — Phase 3 (schema and `source='bracket'` reservation ship in Phase 2)
- **Extra-time admin UI** — Phase 3
- **Realtime leaderboard subscription** — v2 (RT-01)
- **Prediction history view** — v2 (HIST-01)
- **Personalized stats, H2H** — v2 (STAT-01, H2H-01)
- **Dark mode, charts, badges** — v2 (POL-01/02/03)
- **WhatsApp / Telegram nudges** — v2 (NOTF-01)
- **Cloudflare Turnstile on join** — Phase 1 deferred; still deferred
- **Bilingual admin pages** — Phase 1 deferred (D-05); still deferred
- **Player roster table for prop typeahead** — v2
- **Vitest unit tests for scoring** — defer unless complexity grows
- **Audit history surface for admin corrections** — v2
- **Cron consolidation inside /api/heartbeat** — only if Phase 2.x needs it
- **Materialized leaderboard view** — v2
- **Staged rollout / preview-env invite distribution** — single ship-gate flip

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

---

# ADDENDUM: Phase 2 Scope Expansion Discussion (2026-05-26)

**Trigger:** Mid-QA-02 walkthrough, operator (zekez) decided to rethink game types after walking through `/he/props` and finding it had no nav entry. Conversation pivoted from "fix the props nav" to a broader product call on what game types ship in v1.

**Areas reopened:**
- Game types in scope (which prediction surfaces ship)
- Bracket Mode prediction game vs read-only view
- Props lifecycle + privacy
- External sports API integration (PROJECT.md OOS reversal)
- Final navigation layout

---

## Game Types in Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Keep all three (League + Bracket prediction + Props) as originally rOADMAPped | Full original Phase 2 + Phase 3 plan | |
| **Cut Bracket prediction; keep League + Props + add read-only bracket VIEW** | Bracket is display-only, not a prediction game; League full; Props kept | **✓** |
| Cut Props entirely; League + Bracket prediction only | Skips props, doubles down on bracket | |
| League-only; cut everything else | Simplest path | |

**Rationale:** Operator felt Bracket-as-prediction-game was too complex for the 16-day window and the 15-person family scale. Read-only bracket view that "fills as games end" delivers the visual satisfaction without the prediction infrastructure.

---

## Auto-grade Props

| Option | Description | Selected |
|--------|-------------|----------|
| Keep manual grading at /admin/props (~10 min total at tournament end) | No automation; operator clicks through 7 props once | **✓** |
| Build auto-grade for tournament-award props (Golden Boot/Golden Ball/Top Scorer) | Adds 4-6h; awards published post-July 19 only | |

**Rationale:** Tournament awards aren't published in any live feed mid-tournament; auto-grading saves ~10 minutes once. Lowest-value automation; cut to free up scope for higher-value work (score fetching).

---

## External Sports API Integration

| Option | Description | Selected |
|--------|-------------|----------|
| Honor PROJECT.md Out of Scope ("admin enters results manually") | No external dependencies; 104 manual entries over 30 days | |
| **Reverse OOS; auto-fetch match scores; manual entry stays as fallback** | Net automation savings ~10 minutes/day during tournament | **✓** |
| Hybrid: admin clicks "fetch" button per fixture | Less infra, but no autonomy benefit | |

**Rationale:** Operator wants to remove the manual-entry burden across 104 fixtures. Free-tier sports APIs (football-data.org, API-Football, etc.) cover WC 2026. Trade-off: adds external-dependency failure surface, but admin manual entry remains the canonical write path and works when API is down.

---

## Props Privacy Model

| Option | Description | Selected |
|--------|-------------|----------|
| Original D-25: open prop_answers SELECT to all members at tournament.starts_at (reveal at first kickoff) | Drives social engagement; family sees who picked who | |
| **STRICT PRIVATE — user sees own picks only, always** | RLS tightened to `user_id = auth.uid()` only; no reveal branch | **✓** |
| Reveal at tournament-end only | Compromise; family sees picks after final | |

**Rationale:** Operator clarification — props are long-term commitments (who wins the cup; top scorer) submitted before the tournament starts. Unlike per-match predictions (which reveal at kickoff to drive social engagement), pre-tournament props feel personal. Reveal would expose ~30 days of opinion before any of it could be verified. **Supersedes D-25.**

---

## Final Navigation Layout

| Option | Description | Selected |
|--------|-------------|----------|
| 5 tabs: Matches, Bracket (view), Props, Leaderboard, Me | Cleanest semantic mapping; risk of crowding at 360px HE | |
| 4 tabs + Props under header link | Lowest discoverability for Props | |
| 4 tabs + Props nested at /me/props | Props is private + personal; lives under Me where private things belong | |
| **4 tabs (Matches, Bracket-view, Leaderboard, Me); Props embedded at `/[locale]/me/props`** | Bracket placeholder repurposed to read-only view tab; Props live as a Me-sub-page | **✓** |

**Rationale:** Operator's words: *"put props under me. it will only be editable until kickoff, right? so no need to have it be in it's own tab. also, others cant see other players chices."* Privacy-first reasoning (D-38) drove the nav placement (D-37). Props are personal long-term commitments, not social engagement surfaces.

---

## Bracket View Fill Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| **Per-match — slots resolve immediately as admin enters each KO result** | Live tree-fill as tournament plays out | **✓** |
| Per-stage — only update at round boundaries (all R32 done → R16 fills) | Cleaner snapshots; less dynamic UX | |

**Rationale:** Per-match maximizes the "watch the tree fill" satisfaction. Existing `/admin/matches` save action already revalidates affected paths; adding `revalidatePath('/[locale]/bracket')` is one line.

---

## Research Gaps Punted to Researcher

| Question | Why deferred |
|---|---|
| Sports API source selection — football-data.org vs API-Football vs ESPN unofficial vs SofaScore unofficial | Free-tier coverage, rate limits, auth model, failure semantics for WC 2026 specifically. Lock-in risk = blown June 11 deadline. Researcher writes comparison + recommendation. |
| Cron consolidation pattern inside `/api/heartbeat` | Best practice for fanning out one Vercel cron across heartbeat + scores without cross-contaminating failure modes. 10s timeout edge cases. Researcher surfaces canonical patterns. |

---

## Deferred Ideas (this session)

- **Tournament-award auto-grading** — not worth the scope cost at 16 days
- **Webhook-based score push** — most free-tier APIs don't offer; defer to v2
- **Real-time bracket-fill animation** — v2 polish; revalidation-on-result is sufficient for v1
- **`bracket_picks` table cleanup** — leave (append-only convention)
- **`/[locale]/props` route teardown** — redirect to `/me/props` for ~2 weeks, then delete
- **Alerting on score-fetch failure streak** — integrity widget covers v1
- **Real-time tree-fill animation** on `/bracket` — v2

---

*Addendum gathered: 2026-05-26 during /gsd-discuss-phase 2 (re-entry)*

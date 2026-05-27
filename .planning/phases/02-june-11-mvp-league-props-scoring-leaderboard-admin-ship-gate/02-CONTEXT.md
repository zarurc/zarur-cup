# Phase 2: June 11 MVP — League + Props + Scoring + Leaderboard + Admin + Ship Gate — Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

A signed-in family member on a mobile phone can: (a) scroll a chronological matchday feed of all 104 WC 2026 fixtures grouped by date with sticky headers + a single sticky global countdown to the nearest kickoff, (b) enter home/away score predictions inline via ± steppers with optimistic debounced save + transient inline-checkmark feedback, (c) edit any prediction up to its server-anchored kickoff lock (after which the stepper vanishes and the row becomes a read-only score capsule + 🔒, with dashes `- : -` for no-prediction rows), and (d) once admin enters a result, see the row expand to show actual + every family member's pick side-by-side with per-pick `+pts` badges. The admin uses the same chronological list with a `[View Mode]` / `[Score Entry Mode]` toggle, enters results inline (overwrite-to-correct is the correction UX), resolves knockout placeholders in a separate "Tournament Tree Setup" admin tab, authors/grades props in a third admin tab, and sees a permanent integrity widget at the bottom of the admin dashboard (Database Sync / Total Predictions / Unscored Completed Matches). Every "Save Result" call fires a Server Action that sweeps `predictions WHERE fixture_id = ?`, scores in TypeScript (`src/lib/scoring/*`), and bulk-UPSERTs into `score_events` on `(user_id, source, ref_id)` — `v_leaderboard` reads `score_events` agnostically with the LB-04 tiebreaker chain. Props (~5-10 questions) render on a single vertical page; team picks use a 48-country flag grid (6×8), player/text picks use free-text + admin alias-set on grading. The leaderboard is one ranked list with inline-expand per row showing League / Bracket / Props subtotals; Bracket subtotal renders `0 — opens June 27` until Phase 3. Schema gains `result_home_90min` / `result_away_90min` + `result_home_full` / `result_away_full` columns now (forward-compatible with Phase 3), but ET-specific admin UI is deferred to Phase 3. One end-to-end Playwright smoke covers `invite → predict → lock → result → leaderboard`. Hebrew native speaker copy review + manual mobile QA in HE+EN + URL distribution to the family by June 11 kickoff close the ship gate.

**What is NOT in scope:**
- Bracket pick UI / bracket scoring engine (Phase 3: BRK-01..04, VIS-03, SCR-03)
- Bracket reveal granularity decision (Phase 3 planning)
- Knockout extra-time / penalty admin UI (deferred to Phase 3 alongside Bracket — schema columns ship in Phase 2)
- Realtime leaderboard subscription (v2 / RT-01)
- Prediction history view, per-player stats, head-to-head (v2: HIST-01, STAT-01, H2H-01)
- Dark mode, charts, badges (v2: POL-01/02/03)
- WhatsApp/Telegram nudges (v2: NOTF-01 — family WhatsApp covers this)
- New auth surface — invite-code + signInAnonymously already shipped (Phase 1)
- New RLS posture — lock-and-reveal policies already shipped (Phase 1)
- New schema for teams/fixtures/bracket_slots/prop_questions — already seeded (Phase 1)
- Cloudflare Turnstile on join — deferred per Phase 1 D-02
- Bilingual admin pages — admin English-only per Phase 1 D-05

</domain>

<decisions>
## Implementation Decisions

### Match List & Prediction Entry UX (LGE-01/02/03/05, VIS-01/02/05, SCR-07)

- **D-01:** **Chronological vertical feed grouped by date, with sticky date headers.** Single scroll, no swipe-tabs. Avoids the "hidden behind a tab" failure mode where a family member misses a lock window. Group header format: locale-aware date (e.g., `Saturday · June 14` / `שבת · 14 ביוני`) computed from each fixture's `kickoff_at` in the viewer's local timezone (`Intl.DateTimeFormat`).
- **D-02:** **Inline ± steppers on the row** — no detail-page indirection. Each fixture row contains: home flag + name + ± stepper + score input + score input + ± stepper + away name + away flag, plus an inline kickoff time (viewer's local TZ via `Intl.DateTimeFormat`). Touch targets meet the 44px standard already established in Phase 1.
- **D-03:** **Optimistic debounced save with transient inline-checkmark.** Every stepper change schedules a debounced Server Action call (planner picks exact debounce — recommend ~600ms). On success, a tiny pulsing checkmark + the word `Saved` / `נשמר` appears next to the team names for ~2s, then fades. No toast. Failures revert the stepper value + show inline-error text.
- **D-04:** **Score range cap 0–9 each side.** Sufficient for every realistic WC result; keeps stepper UI compact. Planner picks input type (`<input type="number" dir="ltr" inputMode="numeric" min="0" max="9">` is the recommended starting point per PITFALLS.md §5 — note the explicit `dir="ltr"` so digits enter LTR even in Hebrew).
- **D-05:** **Locked-state visual = score capsule + 🔒.** The moment a fixture's `kickoff_at <= now()` (server-anchored), the stepper UI is replaced by a read-only capsule: `{user_home_pick} : {user_away_pick}  🔒` (or `- : -  🔒` in muted gray if no prediction exists). RLS enforces the actual lock — the UI swap is cosmetic.
- **D-06:** **Post-result side-by-side reveal.** Once admin enters a result for a fixture, the row expands to show: `Actual: H–A` + a per-player block showing every family member's pick + their `+pts` badge (e.g., `User A: 2-1  +4 exact`, `User B: 1-1  +2 winner`, `User C: 0-2  +0`). This combines VIS-05 (all-picks-visible-after-kickoff) and SCR-07 (per-pick transparency) into a single dense reveal. Players who did not predict show as dashes with `+0`.
- **D-07:** **Single global sticky countdown banner.** At the very top of `/[locale]/matches` (below the header chrome), a thin banner shows a live ticker to the nearest upcoming kickoff across the whole tournament: `Next: Brazil vs Switzerland · kicks off in 02:14:33`. Ticks client-side from a server-anchored initial delta. When the nearest match's kickoff passes, the banner snaps to the next upcoming fixture. If no upcoming matches exist (end of tournament), the banner hides.
- **D-08:** **Lock anchor = server `now()`.** Client never decides "is this locked?" The Server Action attempts the write; RLS rejects on stale kickoff. Daily integrity query (admin widget per D-23) confirms zero `predictions.submitted_at > fixtures.kickoff_at` rows. Per PITFALLS.md §4: client-side disable is UX-only; RLS is the lock.

### Admin Workflow (ADM-01/02/03/04/05/06)

- **D-09:** **Same chronological feed as players, with `[View Mode]` / `[Score Entry Mode]` toggle.** Default state on admin's `/admin/matches` is View Mode (looks identical to the player view). Flipping the toggle to Entry Mode opens score-input controls on each unscored row (or each row at admin's discretion — Entry Mode is not gated by result status, so corrections work too). Group-stage fixtures show a single score-pair input; knockout fixtures in Phase 2 also show only the single pair (ET admin UI deferred — see D-12).
- **D-10:** **Direct overwrite is the correction UX.** Admin types the new score, clicks Save. The Server Action sweeps `score_events WHERE source='league' AND ref_id=fixture_id`, deletes them, recomputes from current `predictions`, bulk-UPSERTs. No "edit" affordance, no audit history surface — the underlying score_events upsert is idempotent on `(user_id, source, ref_id)` so corrections are seamless. Past `score_events.updated_at` provides the audit trail at the DB level.
- **D-11:** **ADM-03 placeholder resolution lives in its own admin tab: `/admin/tournament-tree`.** When group stage finishes, admin opens that screen, sees the placeholder map (`WINNER_GROUP_A: __ → ?`, `RUNNERUP_GROUP_B: __ → ?`, etc.), picks the resolved team for each, clicks Save. The Server Action updates the relevant `fixtures.home_team_id` / `fixtures.away_team_id` rows where the placeholder appears, then propagates downstream (R16 → QF placeholders that reference these slots). Bundled-with-result-entry was rejected to keep the score-entry flow tight during live match watching.
- **D-12:** **Knockout ET schema in Phase 2; ET admin UI in Phase 3.** Migrations add: `fixtures.result_home_90min`, `fixtures.result_away_90min`, `fixtures.result_home_full`, `fixtures.result_away_full` (all nullable `smallint`). Phase 2 admin UI populates only the "90min" pair (used for League scoring per SCR-02). Phase 3 admin UI (alongside Bracket Mode) adds the "full" pair + an ET toggle + penalty handling. Group-stage fixtures never set `_full` (NULL forever); knockouts in production set both. Planner's job: choose `result_home_90min` vs `result_home_score` semantics — recommendation is to make `_90min` the column populated by Phase 2 and treat the legacy `result_home` / `result_away` as ALIASED / DEPRECATED with a generated column or a view that delegates. Avoid breaking Phase 1's verify scripts.
- **D-13:** **Prop authoring + grading lives in its own admin tab: `/admin/props`.** Single screen (admin English-only per Phase 1 D-05) with a list of props + Add Prop / Edit / Grade actions. Author flow: prompt_en, prompt_he, answer_type (`single-team` / `single-player` / `text`), points value. Grade flow: when result is known, admin opens the prop, picks/types the correct answer, and the Save action fires the same Server Action sweep as League (sweep `prop_answers WHERE question_id=?`, calculate, bulk-UPSERT `score_events` with `source='prop'`).
- **D-14:** **ADM-05 roster screen lives in its own admin tab: `/admin/roster`.** List of `profiles` rows: display_name, joined_at, locale, current total points. "Merge users" tool is a button next to each row that opens a sheet to pick a target profile; on confirm, a service-role Server Action moves all FK children (predictions, prop_answers, bracket_picks once they exist) from source to target, then deletes the source profile + `svc.auth.admin.deleteUser(source_user_id)` (same pattern as the Phase 1 D-04 family-trust rebind). Scoped tightly — no permission matrix, no soft-delete, no undo (admin is trusted per family-trust posture).
- **D-15:** **ADM-06 integrity check = always-visible widget at the bottom of admin dashboard.** Renders 3 inline metrics on every admin page load (server component, no polling): `Database Sync: OK | Total Predictions: 240 | Unscored Completed Matches: 0`. Each metric is computed by a server query: (a) `Database Sync` = the LGE-06 daily check `SELECT count(*) FROM predictions p JOIN fixtures f ON f.id=p.fixture_id WHERE p.submitted_at > f.kickoff_at` (green ✓ if 0, red ✗ otherwise — clicking expands to show the offending rows), (b) `Total Predictions` = `SELECT count(*) FROM predictions`, (c) `Unscored Completed Matches` = `SELECT count(*) FROM fixtures WHERE kickoff_at <= now() AND result_home_90min IS NULL`. No cron, no email — admin opens the dashboard and glances. Avoids consuming the W6 cron slot.

### Scoring Trigger Architecture (SCR-01/02/04/05/06, LB-03)

- **D-16:** **Scoring runs in a Server Action, not a Postgres trigger.** This resolves STATE.md's "Phase 1 / Phase 2 boundary: scoring trigger in PL/pgSQL vs Server Action" open question. The decision pivots on debuggability during live tournament operation: Vercel console + plain-English TypeScript errors > debugging a recursive SQL trigger at 2am after a family WhatsApp pile-on. View-based aggregation (`v_leaderboard` over `score_events`) is unchanged and non-negotiable.
- **D-17:** **Scoring logic lives in `src/lib/scoring/` as pure TypeScript.** Recommended module layout (planner refines): `src/lib/scoring/league.ts` exposes `scoreMatch(prediction, result) → points` returning `{ points, kind: 'exact' | 'goal-diff' | 'winner' | 'miss' }`. `src/lib/scoring/props.ts` exposes `scoreProp(answer, correctAnswer, answerType, points) → points`. Pure functions, no DB calls. Trivial to unit-test (could add Vitest just for this file per CLAUDE.md "Stack Patterns" guidance — defer unless complexity warrants).
- **D-18:** **Server Action shape — bulk-UPSERT sweep.** When admin saves a result for `fixture_id`: (1) read all `predictions` for that fixture, (2) score each in TypeScript via `scoreMatch`, (3) build an array of `{ user_id, source: 'league', ref_id: fixture_id, points, kind }` rows, (4) execute one bulk `UPSERT INTO score_events ... ON CONFLICT (user_id, source, ref_id) DO UPDATE`, (5) `revalidatePath('/[locale]/leaderboard')` + `revalidatePath('/[locale]/matches')` + `revalidatePath('/[locale]/me')`. Idempotent by construction.
- **D-19:** **`score_events` schema** (planner finalizes): `(user_id uuid, source text CHECK (source IN ('league', 'prop', 'bracket')), ref_id uuid, points smallint NOT NULL, kind text NULL, updated_at timestamptz default now(), PRIMARY KEY (user_id, source, ref_id))`. The PK is the idempotency key. `kind` ('exact' / 'goal-diff' / 'winner' / 'miss' / 'correct' for props) drives SCR-07 transparency. Bracket source is reserved but unused until Phase 3.
- **D-20:** **`v_leaderboard` view** (planner finalizes): aggregates `score_events` with the LB-04 tiebreaker chain. SQL sketch: `SELECT user_id, display_name, sum(points) AS total, sum(CASE WHEN source='league' THEN points ELSE 0 END) AS league_total, sum(CASE WHEN source='prop' THEN points ELSE 0 END) AS props_total, sum(CASE WHEN source='bracket' THEN points ELSE 0 END) AS bracket_total, count(*) FILTER (WHERE kind='exact') AS exact_count, count(*) FILTER (WHERE kind IN ('exact','goal-diff','winner')) AS correct_count FROM score_events JOIN profiles USING (user_id) GROUP BY user_id, display_name ORDER BY total DESC, exact_count DESC, correct_count DESC, lower(display_name) COLLATE "und"`. Locale-aware alphabetical via Postgres collation; planner verifies HE+EN behavior.
- **D-21:** **`source = 'bracket'` is reserved but zero in Phase 2.** Bracket score_events rows are written by a Phase 3 Server Action; until then, `bracket_total` is always 0 by aggregation. The leaderboard breakdown UI (D-25) handles this with the literal label `0 — opens June 27` when `bracket_total = 0`.

### Props UI + RLS Reveal (PRP-01/02/03/04, VIS-04, ADM-04)

- **D-22:** **Single page with all questions visible.** `/[locale]/props` renders ~5-10 questions in a vertical scroll. Each question is a self-contained card: localized prompt + an answer-type-specific input. Save behavior mirrors D-03 (debounced optimistic save + inline checkmark per question card). No wizard, no step-by-step.
- **D-23:** **Single-team picker = 48-country flag grid (6×8).** Each cell is a flag (from the `teams` table's ISO country code) + tap-to-select. Selected state is a distinct ring + opacity contrast (Phase 1 design tokens). Language-neutral — works for HE and EN identically. Tap a different cell to change. Single-select per question.
- **D-24:** **Single-player + text = free-text input + admin alias-set on grading.** Both `answer_type='single-player'` and `answer_type='text'` use a `<textarea rows="1">` or `<input type="text">` (planner picks). At grading time (D-13), admin enters the canonical correct answer + can add an alias set (e.g., `Messi | Lionel Messi | מסי | L. Messi`). The `scoreProp` grader does case-insensitive trim+NFC-normalized match against the alias set. Schema implication: `prop_questions` gains a `correct_answer_aliases text[]` column. Avoids the "user typed 'メッシ' and admin enters 'Messi'" tragedy without forcing a player-roster schema.
- **D-25:** **Lock reveal pattern.** Pre-first-kickoff: each prop is a stepper-like editable card (user-only view; VIS-04 RLS hides other answers). At first kickoff of the tournament (`tournament.starts_at`), RLS already locks `prop_answers` writes (Phase 1) AND opens `prop_answers` SELECT to all family members. Card swaps to a read-only reveal: prompt + your answer + (once graded) the correct answer + every family member's answer + per-pick `+pts` badge. Same density/visual pattern as the post-result match row (D-06) — consistent mental model.

### Leaderboard + Transparency (LB-01/02/03/04, SCR-07)

- **D-26:** **Single ranked list at `/[locale]/leaderboard`.** Rows show rank + display_name + total points (right-aligned). Locale-aware alphabetical for the tiebreaker (D-20). Rendered server-side from `v_leaderboard` view. Refresh via `revalidatePath` from admin Save Result (LB-03).
- **D-27:** **LB-02 breakdown = inline expand on the row.** Tap a row, it expands in-place to show: `League: X` / `Bracket: 0 — opens June 27` / `Props: Y`. Animation is a height transition. Tapping again collapses. Only one row expanded at a time. No navigation away from `/leaderboard` — leaderboard is the single-source-of-truth screen.
- **D-28:** **Bracket subtotal placeholder.** Until Phase 3 ships, the Bracket subtotal in every row is rendered as `0 — opens June 27` (localized: `0 — נפתח 27 ביוני`) regardless of the user. After Phase 3 ships, this label is replaced with the live number from `score_events WHERE source='bracket'`. No conditional hide — keeping the row visible from day 1 sets the expectation that bracket is coming and avoids a leaderboard re-layout shock when Phase 3 lands.
- **D-29:** **SCR-07 transparency placement = the row-level reveal (D-06) AND the leaderboard breakdown (D-27).** No dedicated transparency page in Phase 2. The match row's per-player `+pts` badge IS the transparency (e.g., `+4 exact` is self-documenting). The breakdown is the per-mode rollup. Together they answer "why does my total say 27?" without a third surface.

### Ship Gate (QA-01/02/03/04)

- **D-30:** **Single Playwright E2E smoke.** Covers `invite → predict pre-lock → ❌attempt write post-lock (RLS rejects) → admin enters result → leaderboard reflects` in one test file. Multi-context (user A browser + admin browser) for the visibility check. Lock simulation: planner picks (recommendation: seed a fixture with `kickoff_at = now() - interval '1 minute'` for the "post-lock RLS rejection" assertion, and `kickoff_at = now() + interval '5 minutes'` for the pre-lock submit). No fake-time mocking — real clocks against seeded kickoff times.
- **D-31:** **QA-03 = QA-02 = same human pass.** Same as Phase 1: zekez does the manual mobile QA in HE+EN on a real phone, including the bidi stress-test from I18N-06 deferred from Phase 1 (scores embedded in Hebrew paragraphs). Hebrew copy review on user-facing strings AND seeded prop_questions (since DATA-05 prop content was authored by admin during Phase 1 seed, the prop_questions Hebrew copy review happens here).
- **D-32:** **QA-04 distribution.** When the four ship gates close: (a) Playwright E2E green in CI, (b) manual mobile QA HE+EN approved by zekez, (c) Hebrew native-speaker (zekez) copy review approved, (d) production URL + invite code + admin display name documented in a single launch checklist file. Distribution channel: family WhatsApp message with the URL + invite code (matches Phase 1 D-01 single-shared-code posture). No staged rollout; ship gate is binary.
- **D-33:** **W6 watchpoint: Vercel Hobby = 1 cron, heartbeat owns it. Phase 2 ships NO new cron.** ADM-06 integrity widget is server-component-on-pageload (D-15), not cron-driven. LGE-06 daily check is the same query, executed on-demand from the widget. No leaderboard recompute cron — revalidatePath from admin Save Result is the refresh trigger (LB-03). If a future scheduled task is needed, consolidate into `/api/heartbeat` as a conditional branch (e.g., once-a-day integrity log) — but Phase 2 doesn't need it.

### Claude's Discretion

- Exact debounce timing for D-03 optimistic save (recommend 600ms; planner can tune from 400–900ms based on Server Action latency benchmarks).
- Stepper micro-interaction (long-press to repeat? haptic feedback? planner picks within Phase 1 design tokens).
- Exact countdown banner pixel height / sticky-offset math relative to header chrome.
- Whether the post-result row reveal (D-06) uses an accordion, a slide-down, or a modal at small viewports.
- Exact tab navigation pattern inside `/admin/...` (top-level nav vs sidebar vs tabs above the integrity widget).
- Player-card vs row-list rendering inside the props reveal (D-25) — both are valid; planner picks.
- `score_events.kind` enum vs free-text column (D-19) — DB modeling preference.
- Whether `v_leaderboard` is a regular VIEW or MATERIALIZED VIEW with refresh on Save Result (recommend regular VIEW at 15-user scale; planner verifies once row counts are known).
- Migration file naming inside `supabase/migrations/` — sequential after 0006 (the canonical reseed migration). Carry forward Phase 1's append-only convention (see Phase 1 D-21 + Plan 01-02 deviations); never edit a pushed migration.
- Whether to extract a shared `scoreSaveAction.ts` Server Action helper for both league + prop scoring (DRY) or keep them in their respective route handlers.
- Whether `prop_questions.correct_answer_aliases text[]` (D-24) is a column or a separate `prop_answer_aliases` table.
- Exact toast-vs-inline-checkmark animation timing for D-03 (the user said "transient" — planner picks ~1.5–2.5s with a fade).
- Whether ADM-03's placeholder resolution Server Action propagates to downstream fixtures by recursive SQL or by app-code loop (PITFALLS.md §3 logic recommends app-code for debuggability — consistent with D-16).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level decisions

- `.planning/PROJECT.md` — Vision, core value ("if the leaderboard is broken, nothing else matters"), constraints, Key Decisions table (several still Pending — Phase 2 confirms most: 4/3/2 scoring, bracket escalation, predictions hidden until kickoff, one unified leaderboard, admin manual result entry)
- `.planning/REQUIREMENTS.md` §"League Mode" / §"Props/Wildcards" / §"Visibility" / §"Admin Dashboard" / §"Scoring Engine" / §"Unified Leaderboard" / §"Ship-Gate Quality" — the 34 requirements mapped to Phase 2 (LGE-01..06, PRP-01..04, VIS-01/02/04/05, ADM-01..06, SCR-01/02/04/05/06/07, LB-01..04, QA-01..04)
- `.planning/ROADMAP.md` §"Phase 2" — phase goal + 5 success criteria + dependency notes ("if it ships and works, the rest is upside")
- `.planning/STATE.md` §"Open Questions" — scoring trigger location (now D-16: Server Action), extra-time scoring convention (now D-12: 90-min only for League per SCR-02, ET schema yes-UI no)
- `.planning/STATE.md` §"Phase 1 Decisions Locked" + §"Phase 1 Execution Decisions" — carries forward all Phase 1 patterns + 4 sets of execution deviations (lockfile rewrite, types un-gitignored, Tailwind v4 var(), git author rewrite)
- `CLAUDE.md` §"Technology Stack" — full stack pins (Next.js 15.5.x, Tailwind v4.3, Supabase ssr, next-intl v4, Zod 4, optional React Hook Form for the matchday list per the per-match-predictions row in the Forms Strategy table), "What NOT to Use" list, free-tier gotchas

### Phase 1 outputs that Phase 2 builds on

- `.planning/phases/01-foundation-schema-auth-rls/01-CONTEXT.md` — Phase 1 decisions (D-01..D-22): invite-code auth, admin gate at unlocalized `/admin/*`, late-entrant policy, bilingual shell typography (Heebo + Inter), design tokens, RLS lock-and-reveal pattern
- `.planning/phases/01-foundation-schema-auth-rls/01-PLAN.md` (any of 01-01..01-05) — wave structure, migration sequence (0001 init / 0002 RLS / 0003 grants / 0004 anon_select / 0005 seed / 0006 reseed), append-only convention
- `supabase/migrations/0001_init.sql` — `fixtures` schema (note `kickoff_at timestamptz`, symbolic placeholder columns); `predictions` schema; `prop_questions` + `prop_answers` schema; `tournament.starts_at` (anchor for props lock)
- `supabase/migrations/0002_rls.sql` — lock-and-reveal RLS policies on `predictions` + `prop_answers` (Phase 2 inherits and extends with `score_events` policies)
- `src/lib/supabase/server.ts` / `client.ts` / `service.ts` — established Supabase client patterns
- `src/app/actions/join.ts` — established Server Action pattern (Zod schema + `useActionState` + redirect)
- `src/lib/schemas/displayName.ts` — established Zod shared-schema pattern (mirror for prediction + result + prop schemas)
- `src/lib/auth/session.ts` + `admin.ts` — established `getClaims()` + `profiles.is_admin` server-side gate (the matches list reuses this for VIS-02 self-vs-others; admin pages already gated)
- `src/components/layout/BottomTabBar.tsx` — established active-tab pattern (already has `Matches` / `Bracket` / `Leaderboard` / `Me` tabs; Phase 2 lights up `Matches` + `Leaderboard` and unhides their content)
- `src/types/supabase.ts` — generated DB types (regen after every Phase 2 migration via `npm run db:types` per Phase 1 operational notes)

### Research

- `.planning/research/ARCHITECTURE.md` §"Component Responsibilities" — `lib/scoring/*` pure-function pattern (D-17 implements this); `v_leaderboard` VIEW pattern (D-20)
- `.planning/research/ARCHITECTURE.md` §"Recommended Project Structure" — `src/app/[locale]/predictions/` (renamed to `/[locale]/matches/` in shipped Phase 1) + `/[locale]/props/` + `/[locale]/admin/results,fixtures,props,roster/` layout
- `.planning/research/PITFALLS.md` §1 (timestamptz / UTC), §2 (RLS read-leak — already mitigated Phase 1), §3 (non-rerunnable scoring — D-16/17/18 follow the "derived projection" recommendation), §4 (client-side lock check — D-08 follows server-anchored rule)
- `.planning/research/FEATURES.md` §"Must have" — Phase 2 ships the full must-have feature surface

### Standards/specs the planner should cite

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — `(select auth.uid())` performance pattern; carry forward Phase 1 convention for any new policies (`score_events` SELECT for all, INSERT/UPDATE blocked except via service role)
- [Next.js 15.5 Server Actions](https://nextjs.org/blog/next-15-5) — `revalidatePath` semantics for D-18, D-26
- [next-intl Server Components](https://next-intl.dev/docs/getting-started/app-router) — `getTranslations()` for server-rendered match list / leaderboard
- [Tailwind CSS v4.3 logical properties](https://tailwindcss.com/blog/tailwindcss-v4-3) — must use `[var(--zc-X)]` syntax (Phase 1 D-1's hard-won Tailwind v4 fix); FND-03 lint catches physical-direction utilities
- [Playwright multi-context test patterns](https://playwright.dev/docs/browser-contexts) — for D-30 multi-user E2E

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `src/app/actions/join.ts` — Server Action pattern with Zod validation + `useActionState` + redirect. Mirror for: prediction save (debounced), result entry, prop save, prop authoring, placeholder resolution, roster merge. Each new action lives at `src/app/actions/{name}.ts`.
- `src/lib/supabase/server.ts` — `createServerClient()` for Server Components reading user-scoped data (matches list, props, leaderboard); honors RLS automatically. **Use this everywhere except admin writes.**
- `src/lib/supabase/service.ts` — `createServiceRoleClient()` for admin Server Actions that must bypass RLS (writing results, placeholder resolution, roster merge, prop authoring/grading). **Phase 2 reuses this exactly as Phase 1 does for the family-trust rebind.**
- `src/lib/auth/admin.ts` — server-side admin gate. Every admin Server Action calls `await requireAdmin()` at the top.
- `src/lib/auth/session.ts` — `getCurrentMember()` returns `{ user_id, profile }` for non-admin pages; throws if unauthenticated. Matches list, props, leaderboard pages all use this at the top of the RSC.
- `src/components/ui/FormField.tsx` — established form-field component. Reuse for: stepper component wrapper, admin result inputs, prop authoring fields.
- `src/components/layout/BottomTabBar.tsx` — already has `Matches`, `Bracket`, `Leaderboard`, `Me` tabs. No tab structure changes in Phase 2 — just unhide the destination content.
- `src/components/layout/Header.tsx` + `Wordmark.tsx` + `LocaleTogglePill.client.tsx` — chrome stays identical. The countdown banner (D-07) is a new sticky element below the header.
- `src/lib/schemas/displayName.ts` — established shared Zod schema pattern (client form + server action + DB insert). Mirror at: `src/lib/schemas/prediction.ts`, `src/lib/schemas/result.ts`, `src/lib/schemas/propAnswer.ts`.
- `src/lib/i18n/routing.ts` — `usePathname()` wrapper. Any new client component (e.g., the inline-expand leaderboard row) MUST import `usePathname` from here, not `next/navigation` (Phase 1 D-04 pattern).
- `messages/{en,he}.json` — extend with Phase 2 strings; preserve ICU plural rules established in Phase 1.

### Established Patterns

- **Server Actions that mutate AND navigate use `<form action={serverAction}>` + `redirect()` at end** (Phase 1 pattern, learned from Bug 4). Applies to: result entry (after Save, redirect or revalidatePath stays on the same page), placeholder resolution (redirect back to admin tournament-tree), roster merge (redirect to roster list).
- **Optimistic debounced saves use a different pattern** — the matchday list isn't a "mutate-and-navigate" flow, it's a "mutate-and-stay" flow. Use client-component wrapping the row + a `startTransition` + `revalidatePath('/[locale]/matches')` from the server action; the row stays mounted and re-renders with the saved indicator. No `redirect()` here.
- **RLS as the lock, server-anchored timestamps everywhere.** Never compare `Date.now()` against a kickoff on the client for write-gating. Display ticking is fine; lock decisions are server-only.
- **Supabase migrations are append-only.** Never edit a pushed migration; always add a new sequential one. Phase 2 migrations start at `0007_...sql` and increment. Every security-relevant migration includes a DO-block smoke (Phase 1 P02 pattern).
- **CSVs (`data/wc2026/*.csv`) are source of truth for seed data; SQL migrations are GENERATED via `scripts/build-seed-sql.ts`.** Any Phase 2 seed data (e.g., default prop_questions if we want them pre-seeded) follows the same pipeline.
- **Lockfile JFrog→npmjs rewrite required after every `npm install`** (Phase 1 P05 operational note). Apply sed: `s|https://jfrogrepo24.jfrog.io/artifactory/api/npm/npm-virtual/|https://registry.npmjs.org/|g` on `package-lock.json` and commit.
- **Git author MUST be `10100761+zarurc@users.noreply.github.com`** for any commit destined to Vercel — set `git config user.email` before commits. Phase 1 author rewrite was a one-time cleanup; do not let new commits regress.
- **Tailwind v4 CSS variable references MUST use `var(--zc-X)` form inside `[]`** (`[var(--zc-foreground)]` not `[--zc-foreground]`) — Phase 1 P05 Bug fix. New Phase 2 components must follow this.
- **All `auth.uid()` references in RLS policies wrapped as `(select auth.uid())`** — Phase 1 VIS-06 verified. Phase 2 RLS for `score_events` (if any) follows this.

### Integration Points

- **`fixtures` table** (existing) — Phase 2 reads from this for the match list, writes to `result_home_90min` / `result_away_90min` / `result_home_full` / `result_away_full` via a new migration that ALTERs the table (D-12).
- **`predictions` table** (existing, RLS-locked) — Phase 2 ships the UI that writes to this. RLS is already correct (Phase 1 0002_rls.sql). No schema change needed; only client-facing UI + a save Server Action.
- **`prop_questions` + `prop_answers` tables** (existing, RLS-locked) — Phase 2 ships authoring (ADM-04), answering (PRP-01/02), and grading (PRP-04). May ALTER `prop_questions` to add `correct_answer_aliases text[]` (D-24).
- **`profiles.is_admin`** — gate for the admin UI; already wired. Phase 2 hits `/admin/matches`, `/admin/tournament-tree`, `/admin/props`, `/admin/roster` — all live under the existing unlocalized `/admin/*` segment.
- **`tournament.starts_at`** (existing) — already the props-lock anchor in Phase 1 RLS policies (0002_rls.sql). Phase 2 props reveal logic reads this same column to flip the UI from edit-mode to reveal-mode.
- **`/api/heartbeat`** (existing, public, opt-in `CRON_SECRET`) — DO NOT add a second cron route. If Phase 2 needs scheduled work, branch inside the heartbeat route (W6 watchpoint per Phase 1 D-33-equivalent). D-33 above states Phase 2 ships no new cron.
- **`v_leaderboard`** (new, Phase 2) — reads `score_events` + `profiles`. The leaderboard page does `from('v_leaderboard').select('*').order(...)` — RLS on the view returns all rows (leaderboard is public-to-members).
- **`score_events`** (new, Phase 2) — written by League Server Action (D-18), Props Server Action (D-13 grade flow), and reserved for Bracket Server Action (Phase 3). RLS: `SELECT` allowed for all signed-in members; `INSERT/UPDATE/DELETE` restricted to service-role only (Phase 2 Server Actions use `service.ts`).

</code_context>

<specifics>
## Specific Ideas

- **Date header format example** — `שבת · 14 ביוני` (HE) / `Saturday · June 14` (EN); from `Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' })`. Stickies during scroll.
- **Saved indicator copy** — `Saved` / `נשמר`. Add to `messages/{en,he}.json`. Transient (~2s fade), inline next to team names.
- **Locked capsule copy** — Just the score + `🔒` (no extra label). Dashes for no-prediction: `- : - 🔒` in muted gray (`var(--zc-muted-foreground)`).
- **Countdown banner copy** — `Next: {home} vs {away} · kicks off in {HH:MM:SS}` (EN) / `הקרוב: {home} נגד {away} · בעוד {HH:MM:SS}` (HE). Ticks every second client-side.
- **Side-by-side reveal copy per player** — `{display_name}: {h}-{a} +{pts} {kind_label}` where kind_label is `exact` / `goal-diff` / `winner` / `(missed)` in the right locale. Players with no prediction: `{display_name}: - +0`.
- **Admin entry mode toggle copy** — `[View Mode]` / `[Score Entry Mode]` (admin pages are EN-only per Phase 1 D-05).
- **Integrity widget copy** — `Database Sync: OK | Total Predictions: 240 | Unscored Completed Matches: 0` (EN-only per D-05). Failure state: `Database Sync: ✗ (3 rows past kickoff)` clickable to expand.
- **Bracket placeholder copy in leaderboard breakdown** — `0 — opens June 27` (EN) / `0 — נפתח 27 ביוני` (HE). Same string for everyone.
- **Score range** — 0–9 inclusive on each side (D-04). No team has scored 10+ in a WC match in living memory; planner can extend if zekez wants a safety margin to 15.
- **Props prompts examples (zekez may seed during Phase 1 or here)** — `Who wins the cup?` (single-team), `Top scorer?` (single-player), `Best goal celebration?` (text). Final list authored by zekez via ADM-04.

</specifics>

<deferred>
## Deferred Ideas

- **Bracket Mode in full** — Phase 3. Schema ALREADY shipped (Phase 1 bracket_slots + bracket_picks tables + RLS). Phase 2 adds the ET-schema columns + reserves the `source='bracket'` row in `score_events`. Phase 3 picks up: UI, reveal granularity, scoring engine, RLS for bracket reveal.
- **Extra-time / penalty admin UI** — Phase 3 (D-12). Schema columns ship in Phase 2 (forward-compat). Group-stage admin only ever populates `_90min`.
- **Realtime leaderboard via Supabase Realtime subscription** — v2 (RT-01). Phase 2 uses `revalidatePath` + page refresh on focus; sufficient for 15 users.
- **Prediction history view per user** — v2 (HIST-01). The `/[locale]/me` page already exists from Phase 1; Phase 2 keeps it minimal (display name + locale + joined_at + total points + logout). History view + per-pick browser deferred.
- **Personalized stats, H2H** — v2 (STAT-01, H2H-01).
- **Dark mode, charts, badges** — v2 (POL-01, POL-02, POL-03).
- **WhatsApp / Telegram nudges** — v2 (NOTF-01) — family WhatsApp covers this.
- **Cloudflare Turnstile on join form** — explicitly skipped (Phase 1 D-02). Reinstate only on observed abuse.
- **Bilingual admin pages** — `/admin/*` stays English-only (Phase 1 D-05). Add `[locale]` back only if a second non-English-reading admin joins.
- **Player roster table for prop typeahead** — deferred (D-24). Admin alias-set on grading is the v1 solution; player table is v2 if prop content scales.
- **Vitest for scoring logic unit tests** — defer per CLAUDE.md guidance. If `src/lib/scoring/*.ts` grows beyond ~50 lines or a bug is missed by Playwright, add Vitest just for that file. ~30 min setup, infinite payoff when debugging a leaderboard number.
- **Audit history surface for admin corrections** — deferred. `score_events.updated_at` provides the DB-level audit; no admin-visible "this was changed at X" UI in Phase 2. Add a simple "recent admin actions" panel in v2 if family complains.
- **"Cron consolidation" inside `/api/heartbeat`** — D-33: Phase 2 doesn't need any new scheduled work. If a future Phase 2.x needs it, branch inside the heartbeat route conditionally on the day-of-week or interval (e.g., `if (Date.now() % 86400000 < 3600000) { runIntegrityLog() }` — gross, but the W6 watchpoint is real). Upgrade to Vercel Pro if a real cron-need emerges.
- **Materialized v_leaderboard with manual refresh** — deferred. Regular VIEW at 15 users is fine; planner verifies once row counts are real. v2 concern.
- **Staged rollout / preview-environment invite distribution** — deferred. Single ship-gate flip per D-32.

</deferred>

<scope_expansion_addendum>

---

# ADDENDUM: Phase 2 Scope Expansion (2026-05-26)

**Trigger:** During QA-02 (Plan 02-08 ship gate), the operator (zekez) audited the live build and decided to (a) cut the Phase 3 Bracket prediction game in favor of a read-only bracket display, (b) make Props strictly private (supersedes D-25), (c) move Props out of its own route and nest under `/me`, (d) reverse PROJECT.md's "external API integration — out of scope" decision to enable auto-fetching of match scores. **Phase 2 is reopened with new plans 02-09..02-1X to ship by the original June 11 hard deadline.** Phase 3 (originally "Bracket Mode") collapses; this addendum supersedes it.

## D-34: Cut Bracket-as-prediction-game

The original ROADMAP "Phase 3: Bracket Mode (Pre-Knockout Ship)" — predict R32/R16/QF/SF/F winners with escalating 2/4/8/16/32 scoring — **is cancelled**. The `bracket_picks` table remains in the schema (no migration deletion needed; harmless empty table) but the prediction UI, bracket scoring engine, and the `source='bracket'` aggregation rows in `score_events` are dropped. Leaderboard's "Bracket: 0 — opens June 27" sublabel (D-28) is removed entirely — total points no longer have a "bracket" mode. PROJECT.md "Bracket scoring escalates per round (2/4/8/16/32)" key decision moves to Out of Scope with reason "displaced by read-only bracket view in v1".

## D-35: Cut auto-grade-props

Tournament awards (Top Scorer, Golden Boot, Golden Ball) are not published in any consumable in-tournament feed; they're announced after the final on July 19. Manual grading of the 7 props at tournament end takes ~10 minutes once. Auto-grading is removed from scope as a low-value automation target. The existing `/admin/props` grading flow stays exactly as built.

## D-36: External sports API integration — REVERSES PROJECT.md Out of Scope

PROJECT.md previously listed *"Live external sports API integration — admin enters results manually; pre-seeded fixtures are sufficient for one tournament, less infra to break"* as Out of Scope. This reversal is necessary because the operator wants automatic match-score ingestion to remove the 104×manual-entry burden over the 30-day tournament window.

The reversal terms: external API is now IN scope **for match-score fetching only**. Admin manual entry at `/admin/matches` remains the canonical write path and the fallback when the API source is unreachable. Source selection is a research question (see Research Gaps below).

## D-37: Final navigation layout

End-of-Phase-2 chrome is **4 bottom tabs**: `Matches | Bracket | Leaderboard | Me`. The Bracket tab — currently a coming-soon `EmptyStateCard` — is repurposed to point at the new read-only bracket view. Props are NOT a top-level tab. **Props live at `/[locale]/me/props`** as a sub-route of Me. The Me page (currently total points + locale + logout) gains a card/link "Pre-tournament props — editable until June 11 19:00 UTC" that routes to the props sub-page.

## D-38: Props are STRICTLY PRIVATE — SUPERSEDES D-25

Each family member sees only their own prop answers. Pre-tournament: editable. Post-tournament-kickoff: read-only receipt of the user's own picks (the user can verify what they submitted; no one else's picks are visible to them at any time, ever). The earlier D-25 "lock reveal pattern" that opened `prop_answers` SELECT to all members post-`tournament.starts_at` is **reversed**. This cascades:

- **RLS policy change required.** `supabase/migrations/0002_rls.sql:155-163` `prop_answers_read` policy currently grants SELECT under `user_id = auth.uid() OR (post-kickoff exists-clause)`. A new migration must tighten this to `user_id = (select auth.uid())` only — drop the post-kickoff branch entirely.
- **`/[locale]/props/page.tsx` simplification required.** Remove the `isRevealed` branch (currently lines 61, 130-146, 191-256). The page only ever renders the user's own answers: editable cards pre-lock, read-only "receipt" cards post-lock.
- **Leaderboard `props_total` aggregate unaffected.** `score_events` exposes points totals, not answer strings — family sees rank + points, never *what* others picked.
- **Admin still has full visibility** via `/admin/props` (service-role client bypasses RLS); admin grading flow unchanged.

## D-39: Props lifecycle

- **Lock anchor:** `tournament.starts_at` (June 11 19:00 UTC), exactly as the existing `prop_answers_insert` RLS WITH CHECK already enforces. No change.
- **Pre-lock UX:** Editable cards at `/[locale]/me/props` — 4 flag-grid props (Winner / Runner-up / Biggest Upset / Dark Horse SF) + 3 free-text props (Top Scorer / Golden Boot / Golden Ball). Existing component patterns from `PropCard.client.tsx` + `FlagGrid.client.tsx` reused as-is.
- **Post-lock UX:** Read-only "receipt" rendering of the user's own picks. Show: prompt, their selection (team name from `teams` table or free-text string), points-when-correct value, and (once admin grades) the correct answer + their actual `+pts` badge. No other family members' rows.
- **Grading:** Admin grades manually via `/admin/props` at tournament end (~10 min for 7 props). Unchanged from current build.

## D-40: Read-only bracket view at `/[locale]/bracket`

The Bracket tab (currently `EmptyStateCard "coming June 27"`) is replaced with a server-rendered tree view of the WC 2026 knockout bracket: 32 slots from R32 through Champion, FIFA non-sequential R32→R16 wiring already seeded in Phase 1 (Plan 01-03). The view reads `bracket_slots` + `fixtures` and renders team names as slots resolve.

**Fill granularity: per-match.** Each KO match resolves its slot immediately as admin enters the result through the existing `/admin/matches` flow — no separate admin "resolve bracket" workflow needed for the view (the existing `/admin/tournament-tree` admin tab already handles placeholder→team-id resolution per D-11). When result is entered, `revalidatePath('/[locale]/bracket')` from the save action ticks the view forward. Family sees the tree fill in real time during the knockout stage.

**Read-only.** Family cannot pick winners or submit predictions on this page. No `bracket_picks` writes from any UI surface. The `bracket_picks` table stays empty for v1 (and probably forever for this tournament).

**No scoring impact.** Bracket points are zero across all rows — already cut per D-34.

## D-41: Auto-fetch match scores — consolidated cron architecture

Vercel Hobby has 1 cron slot, currently `/api/heartbeat` (Phase 1 FND-05). The scores cron consolidates **inside** the same route handler — no new cron registration. Strategy:

- **`/api/heartbeat` route fans out by responsibility.** Top-level handler does the existing 3-day Supabase ping (`SELECT FROM fixtures`) always. On every invocation, also runs a tournament-window check: if `now()` is within (tournament.starts_at − 1h, tournament.ends_at + 1d) AND there are recently-completed fixtures (`kickoff_at < now() - interval '110 minutes' AND result_home_90min IS NULL`), trigger a scores-fetch subroutine.
- **Cron schedule increase.** Existing `0 12 */3 * *` (every 3 days at 12:00 UTC) is insufficient for live score fetching. Switch to a tighter schedule (e.g., `*/15 * * * *` — every 15 minutes). Vercel Hobby supports any cron expression; the 1-slot limit is on *number of distinct crons*, not frequency.
- **Manual admin override always available.** `/admin/matches` direct result entry remains the canonical write path. If the API source is unreachable, slow, or wrong, admin types the score; that write also flips the fixture's `auto_fetched_at` to NULL so the cron won't re-overwrite it.
- **Idempotency.** Score-fetch upserts on `(fixture_id)` and checks `result_home_90min IS NULL` before writing; never overwrites an admin-entered or already-fetched result.
- **Failure mode:** If fetch fails (HTTP error, rate limit, schema drift, source down), log to Vercel function logs, return 200 from the cron (so it keeps firing), and silently fall through — admin enters manually. **No alerting in v1**; the integrity widget on `/admin/*` already surfaces unscored fixtures (D-15).

## D-42: PROJECT.md updates required

Planner must add a sub-task to update PROJECT.md as part of the new plan set:

- **Out of Scope section:** Remove the "Live external sports API integration" line (D-36 reverses it). Add a new "Bracket Mode as a prediction game" line with reason "displaced by read-only bracket view in v1 per D-34" (D-34 cuts it).
- **Key Decisions table:** Mark "Bracket scoring escalates per round (2/4/8/16/32)" as ❌ Cut. Mark "Admin enters fixtures + results manually (pre-seed the WC 2026 schedule once)" as ✓ Partially — auto-fetch added per D-36; admin manual entry remains the fallback. Add a new row for D-36 reversal.
- **Active Requirements:** Update the "Bracket Mode" bullet to "Read-only bracket view" with the new scope.
- **Validated section:** Phase 1's invite-code login, RLS lock, bilingual chrome should be moved here (still ✓ Pending; should have flipped during /gsd-transition that didn't happen — separate task).

## Research Gaps (D-43..D-44)

**D-43:** **Sports API source selection — RESEARCH QUESTION.** Candidate sources to compare: `football-data.org` (free tier, official-flavor), `API-Football` (free tier 100 req/day), `ESPN unofficial` (no auth, fragile), `SofaScore unofficial` (no auth, fragile). Required: WC 2026 coverage commitment, free-tier rate limits in the polling-every-15-min cadence (= ~96 req/day worst case), auth model (API key or open), failure recovery semantics. Output: gsd-phase-researcher writes a comparison + recommended source with explicit fallback chain. Lock-in risk: wrong choice = blown June 11 deadline on integration work.

**D-44:** **Cron consolidation pattern details — RESEARCH QUESTION.** Required: best-practice pattern for fanning out a single Vercel cron route handler across multiple responsibilities (heartbeat + score-fetch) without cross-contaminating failure modes. Specifically: how to make the heartbeat (3-day ping) survive even if score-fetch fails. Should the scores fetch be `await`ed or `void`-ed? Should the route return 200 even when scores fail? Edge case: what if the route timeout (10s on Vercel Hobby Free) is hit during a long score-fetch — does heartbeat get skipped?

## Updated Claude's Discretion (additions to original list)

- Bracket-view component layout (column-of-rounds vs traditional left-right tree at 360px — RTL flip required for `/he/bracket`).
- Whether `/[locale]/props` 301-redirects to `/[locale]/me/props` or just gets deleted (recommend redirect for ~2 weeks then delete).
- Exact heartbeat cron schedule (recommend `*/15 * * * *`; planner may tune based on API source rate limits from D-43 research).
- Whether to remove the now-unused `bracket_picks` table in a future cleanup migration or leave it forever (recommend leave — append-only convention from Phase 1 P02).
- Whether the Me-page "Props" card shows a countdown to lock or just an "Editable" / "Locked" pill (recommend pill — countdown lives in the global banner on `/matches`).
- Whether props-receipt rendering re-uses the existing `PropCard.client.tsx` with a `readonly` prop, or a new `PropReceipt.tsx` server component (recommend new server component — simpler, no client JS needed post-lock).

## Updated Deferred (additions)

- **`bracket_picks` table cleanup.** Phase-3-or-later. Leave for now (append-only).
- **`/[locale]/props` route teardown.** After redirect period, delete the page file. Defer to Phase 2.x cleanup.
- **Webhook-based score push** (vs polling). Research D-43 will note this as a v2 path; free-tier API sources rarely offer webhooks.
- **Alerting on fetch-failure streak.** If 3 consecutive cron runs fail, ping admin. v2 concern; manual integrity widget covers v1.
- **Real-time tree-fill animation** on `/bracket` as results land (vs page revalidation). v2 polish.
- **Roster table cleanup** if anyone leaves the family. v2 concern (`/admin/roster` merge tool covers it for now per D-14).

</scope_expansion_addendum>

---

*Phase: 2-June-11-MVP-League-Props-Scoring-Leaderboard-Admin-Ship-Gate*
*Context gathered: 2026-05-24*
*Scope expansion addendum: 2026-05-26 (cut Bracket prediction game; cut auto-grade props; Props private + nested under /me; auto-fetch scores via consolidated heartbeat cron; research gaps on API source + cron pattern)*

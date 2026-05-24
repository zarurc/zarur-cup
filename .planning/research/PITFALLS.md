# Pitfalls Research

**Domain:** Bilingual (Hebrew RTL + English LTR) family prediction-pool app on Next.js + Supabase, shipping to FIFA World Cup 2026 opening match (June 11, 2026)
**Researched:** 2026-05-23
**Confidence:** HIGH on stack-level pitfalls (Context7 + recent post-mortems + Supabase 2025/2026 CVE history). MEDIUM on tournament-specific edge cases (no single authoritative source — synthesized from rules + pool conventions).

A note on framing: this is a 15-user, family-trust, no-money pool. "Pitfall severity" is calibrated against a single failure mode — **the leaderboard is wrong or unavailable on a match day**. Anything that doesn't threaten that is downgraded. Anything that does is critical, even if it's a "small" bug.

---

## Critical Pitfalls

### Pitfall 1: Storing or comparing kickoff times as anything but UTC timestamptz

**What goes wrong:**
A fixture is seeded with kickoff in "local time" (e.g., the Mexico City 11:00 kickoff stored as `'2026-06-11 11:00:00'` without zone). The lock logic then compares it against `now()` in some other zone. Predictions either lock too early (user is locked out 7 hours before kickoff) or too late (user submits at "kickoff + 2 hours" and it goes in because the server thinks kickoff hasn't happened yet).

**Why it happens:**
- WC 2026 spans four host timezones (PDT UTC-7, MDT UTC-6, CDT UTC-5, EDT UTC-4 — Mountain Time isn't a host but Edmonton-adjacent fans care). Hebrew-locale users are in IDT (UTC+3). That's a 10-hour spread.
- Postgres `timestamp` (without `tz`) silently drops the offset. Postgres `timestamptz` stores as UTC and converts on display.
- JS `new Date("2026-06-11 11:00:00")` parses as local browser time, which is different on the admin's laptop vs. the server vs. each user.
- Tournament dates June 11 – July 19 are fully inside DST for all three host countries — so DST itself is NOT a mid-tournament threat. But seeding fixtures *before* June 11 from a developer machine that may be in a different DST state than the server can shift times by an hour.

**How to avoid:**
- Schema: every time column is `timestamptz`. Never `timestamp`. Make this a lint check on migrations.
- Storage: convert to UTC at the seed/admin-input boundary. Display in user's locale at the render boundary. Never in between.
- Server lock check: `WHERE kickoff_at <= now()` in Postgres, where both sides are `timestamptz`. Do NOT do this in JS.
- Display: format with `Intl.DateTimeFormat(locale, { timeZone: userTz })` — let Intl handle the bidi and DST math. Don't hand-roll offsets.
- Test: seed a fixture at kickoff `2026-06-11T20:00:00Z`. From a browser pretending to be `America/Los_Angeles`, verify it shows `1:00 PM PDT`. From `Asia/Jerusalem`, verify it shows `23:00 IDT`. From `America/New_York`, verify `4:00 PM EDT`.

**Warning signs:**
- Any code that does `new Date(kickoff_at).getTime() < Date.now()` for lock decisions on the client. Lock decisions MUST be server-authoritative.
- A `timestamp without time zone` column anywhere in the schema.
- String concatenation of date + time + zone — that's a guaranteed bug factory.
- Admin reports "this fixture says it kicks off at 2 AM" — likely a TZ mismatch on display, but verify the underlying storage is still UTC.

**Phase to address:**
Phase 1 (schema + fixtures). Cement `timestamptz` and UTC-only storage before any feature uses kickoff times. Retrofitting this mid-tournament is brutal — would require backfill + reverify every lock state.

---

### Pitfall 2: RLS that allows reading other users' predictions before kickoff (read-leak)

**What goes wrong:**
A `predictions` table has RLS enabled with a policy like `USING (auth.uid() = user_id)` for SELECT — which correctly lets users see their own picks. But the admin or a "view leaderboard" page uses `select * from predictions join matches ...` and that join either bypasses RLS (service role) or accidentally exposes raw prediction rows in a payload. Family members snoop on each other's picks. Trust is destroyed; the pool's entire ethic is compromised.

The subtler variant: SELECT policy is correct, but a Postgres function (RPC) marked `security definer` runs as the owner and returns picks regardless of caller.

**Why it happens:**
- Supabase RLS is opt-in per table; the table-editor default is *off*. CVE-2025-48757 (May 2025) found ~10% of generated apps shipped with tables readable by anon. This is the single most common Supabase mistake of the past two years.
- "Hide predictions until kickoff" looks like a UI concern. It is not. It is an RLS concern. UI hiding is bypassable by anyone with a network tab.
- `security definer` functions are often introduced for leaderboard aggregation and silently re-expose what RLS hid.

**How to avoid:**
- RLS policy on `predictions` for SELECT must be: `(user_id = (select auth.uid())) OR (select kickoff_at from matches where matches.id = predictions.match_id) <= now()`. The OR clause is the lock — once a match has kicked off, anyone can see all predictions for that match.
- For aggregation (leaderboard totals), use a *view* or *materialized view* that exposes only sums, not raw rows. Apply RLS to the view too, or build the leaderboard from a function that returns only `(user_id, display_name, total_points)`.
- If you use `security definer` functions, audit each one. Add `set search_path = ''` to prevent search-path attacks. Better: prefer `security invoker` and let RLS apply.
- Use `(select auth.uid())` instead of `auth.uid()` directly in policies — the planner caches the subquery once per statement, avoiding the "auth.uid() trap" of re-execution per row.

**Warning signs:**
- Network tab shows a payload from `/rest/v1/predictions?select=*` returning rows for another user_id before kickoff.
- Any server-side code using the `service_role` key for routes that render to a regular user. (Service role bypasses ALL RLS.)
- Policies expressed only on SELECT — no INSERT/UPDATE/DELETE counterparts. Anonymous writes are the second-worst CVE-2025-48757 finding.
- A leaderboard query that returns `prediction.home_score` and `prediction.away_score` instead of just aggregated points.

**Phase to address:**
Phase 2 (auth + data model). Write RLS policies *with* the table, not after. Add a Playwright/integration test that: signs in as user A, requests user B's predictions for a not-yet-kicked-off match, asserts empty result.

---

### Pitfall 3: Non-rerunnable scoring — admin corrects a result, leaderboard goes inconsistent

**What goes wrong:**
Admin enters a wrong result (say "France 2-1 Argentina" when it was actually 1-1). The system writes 4/3/2 points to every prediction at result-entry time, additively. Admin corrects the result an hour later. The system either (a) doesn't recompute, (b) recomputes by *adding* the corrected scoring on top of the wrong scoring (double-counting), or (c) recomputes one match's scores but doesn't reflow the props/bracket which depend on aggregate state.

Family notices the leaderboard is wrong. Trust evaporates.

**Why it happens:**
- Imperative scoring at "result entry" looks simpler than declarative scoring from "result state."
- Devs reach for `UPDATE users SET points = points + 4 WHERE id = …` because it's one query. This is not idempotent.
- Props that depend on tournament aggregates (top scorer, winner) are computed in the same pass, so changing one match silently invalidates them.

**How to avoid:**
- **Treat results as the source of truth, points as a derived projection.** Points should always be computed as `f(predictions, results)` — never stored as a running total that's mutated on event.
- Concrete pattern: a SQL view `leaderboard` that reads `predictions` JOIN `matches` (where `result_home, result_away` are populated) and computes points per row using a deterministic `scoring(pred_h, pred_a, real_h, real_a) -> int` function (4/3/2). Sum and group by user.
- For bracket scoring: same idea — a view `bracket_scores` that reads `bracket_picks` JOIN the actual knockout fixtures.
- For props: a view `prop_scores` that reads `prop_picks` JOIN a `prop_resolutions` table (admin-entered tournament-level facts).
- Unified leaderboard = `SELECT user_id, sum(points) FROM (leaderboard UNION ALL bracket_scores UNION ALL prop_scores)`.
- This makes admin corrections trivial: update one result row, the view recomputes everything automatically. No replay logic, no event sourcing complexity — just dependent SQL.
- If aggregation cost grows, swap to `materialized view` with `refresh materialized view concurrently leaderboard` triggered on result write. Still idempotent.

**Warning signs:**
- A `points` column on the `users` or `predictions` table that's not a generated column or view.
- Any code path "on result entered, add points to user" instead of "result entered, refresh derived state."
- A "recompute leaderboard" button on the admin panel — that button only exists because someone gave up on derived state.

**Phase to address:**
Phase 3 (scoring engine). This is the single most important architectural decision in the project — gets the scoring right means corrections are safe; gets it wrong means a hand-fix on every admin typo during the tournament. Capture as a Key Decision in PROJECT.md before writing the first scoring line.

---

### Pitfall 4: Client-side lock check — user edits prediction after kickoff via network retry, race condition, or two tabs

**What goes wrong:**
The UI hides the submit button after kickoff. The user opens two tabs at 10 minutes before kickoff. In tab A, they save a pick. In tab B (open since before kickoff), they edit and the submit button is still active in DOM, so they submit at kickoff + 30 seconds. The server happily writes it — because no server-side lock check exists. Or: a flaky network causes a "retry submission" that lands after kickoff but the client sent it before, so the user's pick changes after lock.

**Why it happens:**
- "Lock at kickoff" is treated as a UX rule, not an invariant.
- Devs assume the disabled submit button is the lock. Anyone with curl can bypass it.
- Optimistic UI with retries is invisible — neither user nor dev sees the retry land after lock.

**How to avoid:**
- **Server-side lock is the authority.** Every prediction write goes through a Postgres function (or RLS policy) that does:
  ```sql
  WITH match_kickoff AS (
    SELECT kickoff_at FROM matches WHERE id = new.match_id FOR SHARE
  )
  SELECT 1 WHERE (SELECT kickoff_at FROM match_kickoff) > now()
  ```
  If empty, raise an exception or return error. Apply this in RLS as the UPDATE policy `WITH CHECK`:
  ```sql
  CREATE POLICY "lock before kickoff" ON predictions FOR UPDATE
    USING (user_id = (select auth.uid()))
    WITH CHECK ((SELECT kickoff_at FROM matches WHERE id = match_id) > now());
  ```
- INSERT policy needs the same `WITH CHECK`.
- The client should still show a countdown and disable submit at kickoff — that's UX, not security. Use `<time datetime="...">` and a server-anchored countdown (compute initial delta from server, tick locally).
- Multi-tab: handle the resulting `409`-style error gracefully ("This match has started; predictions are locked").
- For "user submits at T-1, request lands at T+0.5": this is *by design* a lockout if your contract is "must be RECEIVED before kickoff." The alternative — "must be SENT before kickoff" — is unverifiable, so don't promise it. Document the contract clearly in the UI: "Submit at least 30 seconds before kickoff to be safe."

**Warning signs:**
- A prediction `updated_at` value later than the corresponding match's `kickoff_at`. Run this as a daily check during the tournament:
  ```sql
  SELECT p.* FROM predictions p JOIN matches m ON m.id = p.match_id
  WHERE p.updated_at > m.kickoff_at;
  ```
  Should always return zero rows. Anything else is a lock breach.
- Lock check that's only in the React component, with no DB-level enforcement.

**Phase to address:**
Phase 2 (auth + data model) — RLS lock policy must exist when predictions table is first created. Add the daily-check SQL to admin dashboard as a "tournament integrity" panel.

---

### Pitfall 5: Tailwind RTL — physical direction utilities that don't flip, breaking Hebrew layout

**What goes wrong:**
Developer writes `pl-4 mr-2 text-left border-l-2` because that's what Tailwind autocompletes. In English mode the layout looks fine. In Hebrew mode, the entire UI is subtly broken: padding is on the wrong side, the menu indicator chevron points the wrong way, text alignment fights the document direction, scroll/swipe gestures feel inverted.

The family opens the app in Hebrew (the default per project decision) and the first impression is "this looks wrong."

**Why it happens:**
- Tailwind has *physical* utilities (`pl-*`, `pr-*`, `ml-*`, `mr-*`, `text-left`, `text-right`, `border-l-*`, `rounded-l-*`) AND *logical* utilities (`ps-*`, `pe-*`, `ms-*`, `me-*`, `text-start`, `text-end`, `border-s-*`, `rounded-s-*`).
- Logical utilities flip automatically based on `<html dir>`. Physical do not.
- Autocomplete shows physical first; tutorials and Stack Overflow answers default to physical.
- Tailwind v3.3+ added the logical variants; older code (or AI-generated code from older training data) uses physical.

**How to avoid:**
- **Project rule (lintable):** ban physical direction utilities. Use ESLint rule `no-restricted-syntax` or a regex check in CI: `(\b|:)(p|m|border|rounded)[lr]-`. Block PRs that match.
- Always use logical: `ps-*` `pe-*` `ms-*` `me-*` `text-start` `text-end` `border-s-*` `border-e-*` `rounded-s-*` `rounded-e-*` `start-*` `end-*` (instead of `left-*` `right-*`).
- Set `dir` on `<html>` from the server based on locale: `<html lang="he" dir="rtl">` or `<html lang="en" dir="ltr">`. Don't toggle client-side after first paint — causes layout flash.
- Flex direction: `flex-row` does NOT auto-flip; in RTL, the visual order is correct because flex respects writing direction. But icons inside flex children (chevrons, arrows) need explicit `rtl:rotate-180` or use logical icons (`›` direction comes from CSS).
- For inline mixed-direction strings (score "2 - 1" embedded in Hebrew), wrap the score in `<bdi>` or `<span dir="ltr">` so the algorithm doesn't reorder the digits. The naive Hebrew render of "תוצאה: 2 - 1" can produce "1 - 2" visually in some contexts. `<bdi>2 - 1</bdi>` fixes it without LRM/RLM control characters.
- Number inputs for scores: `<input type="number" dir="ltr" inputMode="numeric" />` — even in Hebrew, digits should enter LTR or users will type "21" and see "12."

**Warning signs:**
- Visual: in Hebrew mode, a card has padding on the wrong side; a back-button chevron points the wrong way; a score line shows "1 - 2" when the data is "2 - 1."
- Code grep: any `pl-`, `pr-`, `ml-`, `mr-`, `border-l-`, `border-r-`, `rounded-l-`, `rounded-r-`, `text-left`, `text-right`, `left-`, `right-` (the last two when used for positioning, not for non-positional like `right-0` on a dropdown — but even those are usually `end-0` in logical-properties world).
- Hebrew speaker says "this feels backwards."

**Phase to address:**
Phase 1 (foundation/UI shell). Set the lint rule and `dir` switching infrastructure BEFORE building any feature components. Retrofitting RTL late is a known time-sink and the project explicitly notes "underestimating bilingual content time-sink" as a deadline risk.

---

### Pitfall 6: Supabase free-tier project pauses after 7 days of inactivity

**What goes wrong:**
Family doesn't open the app for a week (during a slow group-stage day, or before the tournament starts). Supabase pauses the project. The next time someone visits, they get a 503/connection error. Admin scrambles to manually unpause via the dashboard. If this happens at kickoff time, the family thinks the app is broken.

**Why it happens:**
- Supabase free tier pauses projects after 7 days of *database* inactivity. Dashboard visits don't count; cached API responses don't count; only actual queries hitting the DB count.
- The window June 11 → July 19 is the tournament — there will be daily activity. But May 23 (project start) → June 11 (kickoff) is **19 days**. If the family is told about the app early and then doesn't use it, the project could pause right before the opening match.
- Worse: there's a gap between the group stage ending (~June 27) and quarterfinals (early July) — only a couple of days, but could overlap with low engagement.

**How to avoid:**
- Set up an external uptime ping (e.g., a free cron via GitHub Actions or cron-job.org) that hits a real API endpoint (which executes a DB query like `SELECT 1 FROM matches LIMIT 1`) every 6 hours. Don't ping just the Vercel function — that may not hit the DB.
- Verify the ping hits the DB: check Supabase logs to confirm the query ran. Otherwise it's theater.
- Add a "warmup" page at `/api/health` that does a real `select 1` against Supabase and returns 200. Cron pings that.
- Have the Supabase dashboard credentials ready on mobile so an emergency unpause can happen from the couch.

**Warning signs:**
- A 503 or "project is paused" message on the Supabase dashboard.
- Sudden cold-start latency spike (project recently unpaused; first queries are slow).
- The ping job's last success was >7 days ago.

**Phase to address:**
Phase 1 (deployment + foundation). Configure the keepalive ping the same day Supabase is provisioned. This is cheap insurance.

---

### Pitfall 7: Late-entrant policy not decided up front; family politics ensue

**What goes wrong:**
A family member joins the pool on June 14 (3 days into the tournament, after 8 group-stage matches have already been played). Either: (a) they're given 0 points for those matches and a permanent disadvantage they can't recover from, or (b) they're somehow let in retroactively and existing players cry foul, or (c) the admin has to invent a rule mid-tournament under pressure.

**Why it happens:**
- "How do late joiners work?" is the kind of question that surfaces at the worst possible moment.
- Not specified in PROJECT.md.
- Trust-based pools assume "everyone joins on day 1," which never happens.

**How to avoid:**
- **Pick a policy now and document it in PROJECT.md as a Key Decision.** Reasonable options:
  1. *Closed pool:* no joins after kickoff of first match. Simplest, may exclude a cousin.
  2. *Open join, zero past points:* late joiners can pick all future matches; they get 0 for past matches.
  3. *Open join with median backfill:* late joiners get the median pool score for past matches. Generous, slightly complex.
- Recommendation for this project: option 2 (open join, zero past points). Simple, transparent, no math. Plus a soft "we'd love you to join before June 11" reminder.
- For props (tournament-level, locked before first kickoff): late joiners cannot pick props. Period. Otherwise they pick with information advantage.
- For bracket: late joiners can still fill the bracket only if knockouts haven't started.
- Wire this into the schema: `users.joined_at`, `predictions` UPDATE/INSERT RLS check `matches.kickoff_at > users.joined_at`.

**Warning signs:**
- A "what about cousin X who just heard about this" Slack/WhatsApp message during the tournament.
- A `users.joined_at` column missing.
- A leaderboard that shows late joiners with default 0 in a way that looks like a bug.

**Phase to address:**
Phase 1 (auth + schema). The schema decision is small; the policy decision is the actual work — get it written down.

---

### Pitfall 8: Bracket picks not re-bound to actual fixtures when group stage completes

**What goes wrong:**
User fills out the bracket on June 9 (before any group games), picking "Brazil over Mexico in R16." When the group stage actually completes (June 27), Brazil ends up second in their group and meets Germany in R16, not Mexico. What happens to the pick?

Two failure modes:
1. The bracket stores the pick as "Brazil wins R16 slot X" where slot X is bound by group-stage position. The system correctly evaluates whether the user's picked team ended up in slot X and won. Good.
2. The bracket stores the pick as "Brazil beats Mexico" and now the entire pick is in limbo because that specific matchup never happens.

If the system was designed naively (mode 2), every user's bracket is silently broken at the group-stage boundary.

**Why it happens:**
- The bracket UI looks like "Brazil vs Mexico" because that's how brackets are visualized — but the underlying data model needs to be slot-based, not opponent-based.
- The R16 slots are determined by group-stage finish: "Winner of Group A vs Runner-up of Group B" etc. The 2026 expanded format with 32 R16 teams (48 total minus 16 group-stage eliminations) makes this even more complex.
- The mapping from group results → R16 slots is part of FIFA's rules, not your data.

**How to avoid:**
- Schema:
  ```sql
  create table bracket_slots (
    round text,           -- 'R16', 'QF', 'SF', 'F'
    slot_id text primary key,  -- 'R16-1', 'R16-2', ...
    home_source text,     -- 'group_A_winner', 'group_B_runner_up'
    away_source text,
    parent_slot text      -- which QF slot this R16 winner feeds into
  );
  create table bracket_picks (
    user_id uuid,
    slot_id text references bracket_slots(slot_id),
    picked_team text,     -- team code, e.g., 'BRA'
    primary key (user_id, slot_id)
  );
  ```
- User picks a team for each slot. After group stage, admin resolves which actual team filled each slot. Scoring compares the user's `picked_team` against the actual winner of that slot. The user doesn't need to "re-pick" — their team either ended up in that slot's path or didn't.
- The user's bracket UI should explicitly show "the team you think wins this position" not "Brazil vs Mexico" — because the opponents are TBD pre-group-stage.
- If a user picks "Brazil" in the R16-1 slot and Brazil ends up in the R16-5 slot, their pick scores zero for R16-1 (whoever did end up there wasn't Brazil). Their Brazil pick may also score in later rounds if they picked Brazil for QF/SF too. **This is correct behavior** but must be communicated.

**Warning signs:**
- A `bracket_picks` schema with `home_team` and `away_team` columns instead of `slot_id` and `picked_team`.
- A UI that asks users to pick winners of specific matchups before the group stage finalizes.
- Confusion at the group/knockout boundary about whose picks count.

**Phase to address:**
Phase 4 (bracket mode) — but the schema decision should be made in Phase 1 if any bracket UI is planned for the MVP. PROJECT.md notes bracket can ship later; if it slips past opening match, this risk evaporates for the MVP.

---

### Pitfall 9: Extra-time / penalty / abandonment scoring ambiguity not resolved up front

**What goes wrong:**
A knockout match ends 1-1 after 90 minutes, then 2-1 after extra time, then is decided on penalties (or not — extra-time score holds). User predicted "1-1." Did they get exact-score (4 points) because that was the 90-minute score, or 0 because the final result was 2-1?

If the rule isn't documented, every family member assumes a different one. Arguments at dinner are no longer about predictions but about whether the scoring is fair.

**Why it happens:**
- WC knockout rules: 30 minutes of extra time if tied after 90, then penalties if still tied. (FIFA confirms no golden goal; both 15-min halves are always played.)
- Pool conventions vary: some score on 90-min result (most common in Kicktipp-style pools), some on full-time-after-ET, some treat ET as a separate prediction.
- Abandonments / forfeits / walkovers: rare but happens. If the match is abandoned at 0-0 in the 70th minute and the result is awarded 3-0, what does a "1-0" pick score?

**How to avoid:**
- **Decide upfront and document.** Recommendation matching Kicktipp default:
  - Score predictions resolve against the **90-minute result** only. Extra time and penalties are ignored for league-mode (per-match) scoring.
  - Bracket-mode advancement is the only thing that cares about ET/penalty winners. A bracket "Brazil wins R16" pick is correct if Brazil advances, regardless of how (90 min, ET, or PKs).
  - Abandonments: if FIFA awards a result (e.g., 3-0 forfeit), use that. If the match is replayed, use the replay. If the match is voided, mark predictions as void (no points awarded, no penalty).
- Schema: store `result_home_90min`, `result_away_90min`, and optionally `result_advanced_team` for knockout matches. Two columns, one rule.
- UI: show users this rule on the prediction form ("Predict the 90-minute score. Extra time and penalties don't count for per-match scoring.").

**Warning signs:**
- Family member asks "wait, what counts?" — too late if the tournament is underway.
- A single `result_home` / `result_away` column with no clarity on whether it's 90-min or final.

**Phase to address:**
Phase 1 (schema + scoring rules). Document as a Key Decision in PROJECT.md. The schema decision (two result columns) is trivial; the policy decision is the work.

---

### Pitfall 10: Floating-point or implicit-cast scoring math

**What goes wrong:**
Scoring computes correctly *most* of the time, but every so often a user's total comes out as `26.000000001` or `25.999999998` due to a JS float operation. Display rounds it, but tiebreaker ordering uses the raw value, so two users with "identical" totals are ranked differently in some renders vs others.

**Why it happens:**
- JS uses IEEE 754 doubles for all numbers. `0.1 + 0.2 !== 0.3`.
- A scoring function written in TS that does `points += 4 * weight` where `weight` is `0.5` introduces float ops.
- Bracket scoring escalates 2/4/8/16/32 — pure integers, but if any multiplier becomes a float...

**How to avoid:**
- Keep all scoring as **integer math**. Kicktipp 4/3/2 is integer. Bracket 2/4/8/16/32 is integer. Don't introduce weights, percentages, or "half points."
- Do the math in **SQL**, not JS. Postgres has `integer` and `bigint`; aggregation with `sum()` over integers is exact.
- If a feature genuinely needs fractional scoring (e.g., "0.5 points for partial prop correctness"), store as integer × 10 (or × 100) and divide for display only.

**Warning signs:**
- Any scoring code that contains a decimal literal.
- A `points` column typed `numeric` or `double precision` instead of `integer`.
- Two users with the "same" total ranked inconsistently across renders.

**Phase to address:**
Phase 3 (scoring engine). Make integer-only math an architectural rule.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems. Calibrated for the 3-week, 15-user, family-trust context.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode 4/3/2 scoring constants in code instead of DB-config | Saves a config table | Can't tweak scoring without redeploy | Acceptable for v1 — PROJECT.md explicitly defers configurability |
| Skip i18n abstraction, write Hebrew + English strings inline as ternaries | Faster initial coding | Translation drift, can't add a third language later | NEVER — Hebrew is the spirit language; a translation file from day 1 is cheap |
| Use `service_role` key in server routes to "just make it work" | Bypasses RLS frustrations | Every endpoint is now a potential data leak | Never — use server-side `createServerClient` with the user's session JWT |
| Store fixtures as a JS constant instead of DB rows | One less migration | Can't correct a typo'd team name without deploy; admin dashboard has nothing to edit | Acceptable only for the initial seed; fixtures MUST live in DB tables |
| Skip the keepalive ping, hope nobody opens the app weekly | Saves 10 min of setup | Project pauses, app appears broken at the worst time | Never — 10 min of setup beats a midnight unpause |
| Use `text` columns for team codes everywhere instead of an enum or FK to a `teams` table | Faster schema | Typos in "BRA" vs "Bra" silently fail to match; no team metadata | Acceptable for v1 IF wrapped in a check constraint or seeded enum |
| Store kickoff times as ISO strings in `text` columns instead of `timestamptz` | Avoids one casting issue | All TZ comparisons become string comparisons that silently fail | NEVER |
| Display predictions visibility purely in the React component, not RLS | "It works in the UI" | Anyone with curl can scrape predictions before kickoff | Never — RLS is the lock |
| Skip the daily integrity check query | Saves 15 min | A locked-prediction-modified bug ships unnoticed | Acceptable only if you're confident in the RLS WITH CHECK clause |
| Treat Hebrew as the "translation layer" and English as the canonical strings | Familiar to English-first devs | Hebrew gets second-class treatment; idioms read awkwardly | Discouraged — write both languages in parallel, ideally Hebrew-first per PROJECT.md spirit |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Auth | Using the anon key on the server with `createClient` — RLS evaluates as anon, often returning empty | Use `createServerClient` with the user's cookie session so RLS sees authenticated role |
| Supabase Auth (anonymous sign-in) | Treating anonymous users the same as authenticated in RLS | Use `auth.jwt() ->> 'is_anonymous'` claim to differentiate; for this project, anon-with-invite-gate is plausible but every policy must check |
| Supabase service_role | Importing it into a client component (anywhere bundled to the browser) | Service role NEVER leaves the server. Lint rule: ban the env var name in `app/` client paths |
| Supabase realtime | Subscribing to `predictions` table for live leaderboard updates | Don't — exposes raw rows. Subscribe to the leaderboard view instead, or poll on a 30s cadence |
| Vercel functions | Long-running scoring batch job > 60s on Hobby tier | Either do scoring as a Postgres view (no function needed) or paginate/chunk |
| Vercel build | Importing node-only modules into client components | Use `"use server"` directive carefully; verify `node_modules` size doesn't break build minutes (6,000/mo on Hobby) |
| Next.js App Router | `cookies()` / `headers()` called from a static page → forces dynamic rendering everywhere | Be deliberate about which routes are dynamic; admin routes yes, public homepage maybe not |
| Next.js i18n | `next-intl` or similar configured for `lang` but not setting `dir` on `<html>` | Set `dir` from locale in the root layout server component before first paint |
| Browser locale detection | Using `navigator.language` on first paint (causes hydration mismatch) | Use `Accept-Language` header server-side, or set after mount and accept a one-tick flash; project decision: default Hebrew, override on first visit |
| Postgres `timestamptz` | Inserting a string without timezone — Postgres assumes session timezone | Always insert as `'2026-06-11 20:00:00+00'` or `at time zone 'UTC'` explicitly |

## Performance Traps

Calibrated for ~15 users, ~64 matches, ~15 props. Real performance concerns are minimal at this scale; the table covers the few that matter.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 query for leaderboard (loop over users, query their points) | Leaderboard page takes >2s | Single SQL view with GROUP BY user_id | At 50+ users; not a real risk at 15 |
| Re-rendering all 64 fixtures on every keystroke in a score input | Input lag, mobile feels janky | Localize state to the specific match card; use React.memo or keyed `useState` per fixture | At 30+ fixtures simultaneously; mitigatable with pagination by stage |
| Refreshing materialized leaderboard view on every prediction write | Spike of DB CPU at submission rushes | Refresh on `result_entered` trigger only (predictions don't change leaderboard until match results in) | Never — predictions don't change leaderboard, results do |
| Loading all matches on every page (no caching) | Wasted DB queries on every nav | Cache the fixture schedule (it's immutable post-seed) — use Next.js fetch cache or a static export | Negligible at 15 users on Supabase free tier (500MB DB, 2GB egress) |
| Realtime subscriptions to predictions table (live update other users' picks) | Read-leak before kickoff + connection-quota burn | Don't subscribe to predictions. Poll the leaderboard every 30s during matches | Realtime free tier is 200 concurrent — fine, but unnecessary work |

## Security Mistakes

Domain-specific issues beyond OWASP basics. The threat model is "family member curious about cousin's picks," not "adversarial attacker."

| Mistake | Risk | Prevention |
|---------|------|------------|
| Tables created without RLS enabled | Anyone with the anon key (which ships in browser bundle) can read everything — the dominant Supabase CVE pattern | `alter table … enable row level security` immediately after `create table`. Lint check on migrations. |
| RLS policy uses `auth.uid()` directly (not wrapped in `(select auth.uid())`) | Per-row re-execution; for this app, just slow — but the pattern is the same one that hides logic bugs | Use `(select auth.uid())` per Supabase's documented best practice |
| Invite code stored as a plain string in client code or .env | Anyone with the URL and the code can join — but that's the design. Risk is if the code leaks publicly | Treat invite code as a "weak shared secret"; store hashed in DB; allow admin to rotate it; rate-limit signup attempts |
| Display name not sanitized | XSS via display name in leaderboard / prediction cards | React renders strings safely by default — but watch out for `dangerouslySetInnerHTML` and any markdown rendering of names |
| Service role key in client bundle | Total bypass of RLS, any user can read/write anything | Env var lives in `.env.local` only, never `NEXT_PUBLIC_*`; verify with `grep NEXT_PUBLIC .env*` |
| Admin authentication = "I know I'm the admin" | Anyone could hit admin routes if not gated | Server-side check: admin user_id matches an `admins` table or env-pinned UUID. Don't rely on a client-side `isAdmin` flag |
| Tournament-level prop predictions visible before lock | Same as per-match read-leak but worse (everyone sees the answer before locking) | Single hard-coded `props_locked_at` timestamp (= first match kickoff). RLS policy enforces |
| Predictions hidden via UI only | Network tab inspection reveals all picks | RLS SELECT policy is the lock (see Pitfall 2) |
| User-controlled team codes accepted in prediction submissions | Could submit invalid team codes for props that asked "who wins?" | FK constraint on `prop_picks.team_code → teams.code`, or enum |
| No CSRF protection on mutating routes (admin actions) | Admin clicks malicious link, fixture results get rewritten | Next.js Server Actions have built-in CSRF protection — use them for admin mutations rather than raw API routes |

## UX Pitfalls

Common UX mistakes specific to bilingual prediction pools. These don't break the system but break trust.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Submit button without a clear success state | "Did my pick save?" — user re-submits, edits, doubts | Inline confirmation: green checkmark next to each saved prediction + timestamp ("saved 14:32"). Plus a "saved" badge persisting until match kickoff |
| Countdown to kickoff in only one timezone | Hebrew user in Israel sees "kickoff in 4 hours" when the badge says "11:00 ET" — confusion compounds | Show user's local time + countdown. Hide raw zone abbreviations unless requested |
| Predictions form that allows submission of empty/null scores | User submits empty, gets 0 points, blames the system | Disable submit until both fields are valid integers ≥ 0 |
| Score input that accepts "1-0" as text in one field | Garbage data, scoring breaks | Two separate `<input type="number">` fields; `min=0 max=15`; reject negatives |
| Locale toggle that doesn't persist | User toggles to English on phone, comes back tomorrow, app is in Hebrew again | Persist locale in localStorage AND in user profile (so it follows them across devices) |
| RTL/LTR layout flash on first render | Jarring; looks broken | Server-render with correct `dir` based on `Accept-Language` or stored preference. Hebrew is the default per project decision |
| Time format like "11:00 AM" in Hebrew UI | Awkward — Hebrew users expect 24h | Use `Intl.DateTimeFormat('he-IL', { hour: 'numeric', minute: 'numeric' })` — yields 24h naturally |
| Numbers in Hebrew text reverse visually | Score "2 - 1" renders as "1 - 2" in Hebrew context | Wrap in `<bdi>` or `<span dir="ltr">` |
| Leaderboard shows only total, no breakdown | "How did cousin get 47 points??" — frustration | Per-mode breakdown on click, as PROJECT.md requires. Verify in QA |
| Admin "result entered" feels final, no preview | Admin typos a score, leaderboard updates instantly, admin must enter the correct one to fix | Preview pane showing "if you save this result, X user gains Y points." Or just a confirmation step |
| No "predictions locked" visual state after kickoff | User clicks submit, gets a server error, doesn't know why | Clear locked banner: "This match started at 14:00. Predictions are locked." With grayed-out form |
| Late joiner sees 0/4/3/2 mixed across already-played matches | "Wait, why do I have a 0 in some columns?" | Show "you joined after this match" badge instead of a 0 |
| Both languages on screen at once (admin or user accidentally) | Cognitive load, looks unprofessional | One language per session, hard toggle in nav |

## "Looks Done But Isn't" Checklist

Things that appear complete in development but are missing critical pieces.

- [ ] **Predictions table:** RLS enabled? SELECT, INSERT, UPDATE, DELETE policies all defined? Lock policy on WITH CHECK for UPDATE/INSERT? Verify with: anon user in network tab cannot read other users' predictions for not-yet-started matches.
- [ ] **Lock enforcement:** Daily check query (`SELECT * FROM predictions p JOIN matches m WHERE p.updated_at > m.kickoff_at`) returns zero rows? Run this in admin dashboard.
- [ ] **Fixture seeding:** All 64 WC 2026 matches present with `timestamptz` kickoff? Spot-check 3 random fixtures: do they display correctly in he-IL, en-US, and admin's timezone?
- [ ] **Scoring view:** Updating a match result automatically reflows the leaderboard? Test: enter a fake result, check leaderboard updated. Now correct the result, check leaderboard updated again to reflect correction (not added on top).
- [ ] **Bilingual:** Every visible string has both Hebrew and English variants? No untranslated keys showing as `pool.match.submit`? Add a CI test that scans for missing keys.
- [ ] **RTL layout:** In Hebrew mode, no physical-direction utilities? Grep `pl-|pr-|ml-|mr-|text-left|text-right`. CI lint rule blocks new ones.
- [ ] **Invite-code flow:** Submitting wrong invite code shows error, doesn't grant session? Rate-limited (5 attempts/hour/IP)?
- [ ] **Admin guard:** Visiting `/admin` as a non-admin user redirects/404s? Server-side check, not client.
- [ ] **Free-tier keepalive:** Cron job hitting `/api/health` every 6 hours? Verify last 24h shows successful pings.
- [ ] **Late-joiner policy:** A user with `joined_at = '2026-06-14'` cannot insert predictions for matches with kickoff before that date? RLS WITH CHECK enforces.
- [ ] **Props locked:** After June 11 first-match kickoff, prop predictions reject INSERT/UPDATE at the DB level?
- [ ] **Extra-time rule visible to user:** Prediction form for knockout matches has a clear note about 90-min scoring? Bracket form has a clear note about advancement?
- [ ] **Display name uniqueness:** Two users can't pick the same display name (or if they can, the leaderboard is unambiguous)?
- [ ] **Session persistence:** Reload page in Hebrew → still Hebrew. Close browser, reopen tomorrow → still Hebrew. Switch device → carries over (profile-level pref).
- [ ] **Number input direction:** In Hebrew mode, typing "2" in a score field shows "2," not flipped or unicode-confused.
- [ ] **Tournament integrity panel:** Admin can see at a glance: how many predictions locked correctly, how many matches need results, how many leaderboard recomputes happened.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover during a live tournament.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong result entered, points already distributed | LOW (if scoring is view-based) | Update the result row. View recomputes. Verify a sample user's score. Communicate the correction to the family. |
| Wrong result entered, points stored as running totals | HIGH | Identify the wrong delta. Reverse it for every affected user. Apply the correct delta. Audit other matches for similar bugs. Consider migrating to view-based scoring mid-tournament — painful but possible. |
| Predictions leaked before kickoff (RLS bug discovered live) | HIGH | Disable the leaking endpoint immediately. Patch the RLS policy. Tell the family — trust requires honesty. Decide whether to void affected matches (probably yes, even if controversial). |
| Supabase project paused at match time | LOW (5 min) | Resume from dashboard. Verify queries succeed. Set up keepalive cron *now*. Apologize to family. |
| Fixture with wrong kickoff time (TZ bug discovered) | MEDIUM | Update the `kickoff_at` value (always UTC). If predictions already locked due to wrong early kickoff, INSERT predictions retroactively allowed? No — that's a lock breach. Instead, void the match scoring for that fixture or use admin discretion to manually score based on what users *would have* submitted. |
| Late joiner gets accidentally credited with retroactive points | LOW | Run `update predictions set ... where user_id = X and match_kickoff_at < user_joined_at` or simply void those predictions via a flag |
| Hebrew translation discovered missing on a key page mid-tournament | LOW | Push a translation hotfix; the family will live with English for the hour it takes to deploy |
| Vercel deploy fails on a critical fix during tournament | MEDIUM | Build minutes (6,000/mo) likely fine. If build itself fails: revert to last known-good commit, fix locally, redeploy. Have a manual deploy path documented. |
| Two users submit the same display name and leaderboard collides | LOW | Add a uniqueness constraint, ask one user to rename, regenerate display |
| Admin enters a result for a wrong match (e.g., swapped home/away) | LOW (with view-based scoring) | Correct the row. View recomputes. |
| Match abandoned / replayed | MEDIUM (rare) | If FIFA awards a result, enter that and accept the consequences. If replayed, void original predictions; allow new picks (mark exception in schema). |
| Bracket pick discovered to reference a slot that the data model can't resolve | HIGH | Indicates schema bug (Pitfall 8). At this point, either patch the model and rebind picks (data migration on live data) or void bracket scoring for affected slots. Avoid by designing slot-based from the start. |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls. Maps to a likely phase structure: Phase 1 (foundation), Phase 2 (auth + predictions), Phase 3 (scoring + leaderboard), Phase 4 (bracket + props), Phase 5 (admin + polish + ship).

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Timezone / UTC storage | Phase 1 (schema) | Test: seed fixture at known UTC, verify display in 3 locales matches expected wall times |
| 2. RLS read-leak before lock | Phase 2 (auth + predictions table) | Integration test: user A queries user B's not-yet-kicked-off prediction → empty response |
| 3. Non-rerunnable scoring | Phase 3 (scoring engine) | Test: enter wrong result, then correct it; verify leaderboard matches the corrected state exactly |
| 4. Client-side lock check / race condition | Phase 2 (RLS lock policy) | Test: attempt direct REST write to predictions with kickoff in past → 4xx response. Daily integrity query returns zero rows |
| 5. Tailwind RTL physical utilities | Phase 1 (UI shell + lint) | CI grep for `pl-|pr-|ml-|mr-|text-left|text-right` returns zero matches in `app/` |
| 6. Supabase free-tier pause | Phase 1 (deployment) | Cron job's last successful ping in last 24h. Manual unpause runbook documented |
| 7. Late entrant policy | Phase 1 (auth + schema), policy in PROJECT.md | `users.joined_at` exists; RLS check on prediction INSERT verifies match kickoff > joined_at |
| 8. Bracket pick rebinding | Phase 4 (bracket mode) — but schema choice in Phase 1 if bracket is in MVP | Test: pre-group-stage bracket pick scores correctly after group stage results in a different opponent |
| 9. Extra-time / penalty scoring rule | Phase 1 (schema decision in PROJECT.md), Phase 3 (scoring logic) | Tested with mock match: 1-1 after 90, 2-1 after ET; verify 1-1 prediction scores 4 (exact-90min). Bracket pick scores on advancement |
| 10. Floating-point scoring | Phase 3 (scoring engine) | Schema audit: `points` column is `integer`. No decimal literals in scoring functions |
| Display name XSS / sanitization | Phase 2 (auth) | React's default escaping; no `dangerouslySetInnerHTML` in display name paths |
| Admin auth | Phase 5 (admin dashboard) | Test: non-admin user hitting `/admin` → 404 or redirect server-side |
| Invite code brute force | Phase 2 (auth) | Rate-limited; hashed in DB; rotatable |
| Mixed-direction score rendering | Phase 1 (UI shell) | Visual test in Hebrew: "תוצאה: 2 - 1" renders digits in correct order |
| Locale persistence | Phase 1 (i18n setup) | Reload + new-device test passes |
| Submission success state | Phase 2 (predictions UI) | Manual test: after submit, visible saved indicator persists until refresh |
| Materialized view refresh strategy | Phase 3 (scoring engine) | Only refreshed on result write, not prediction write |
| Realtime / subscription read-leaks | Phase 3 (leaderboard UI) | If using realtime, subscribed only to leaderboard view, not raw predictions |
| All "looks done but isn't" checklist items | Phase 5 (polish + ship gate) | Checklist run as final go/no-go before June 11 |

## Sources

**Supabase RLS pitfalls and CVE-2025-48757:**
- [Why Your Supabase Data Is Exposed (And You Don't Know It) — DEV Community](https://dev.to/jordan_sterchele/why-your-supabase-data-is-exposed-and-you-dont-know-it-25fh)
- [Supabase RLS: Common Mistakes, the (select auth.uid()) Trap & CVE-2025-48757 Breakdown — VibeAppScanner](https://vibeappscanner.com/supabase-row-level-security)
- [Supabase Security Flaw: 170+ Apps Exposed by Missing RLS — byteiota](https://byteiota.com/supabase-security-flaw-170-apps-exposed-by-missing-rls/)
- [Supabase RLS Best Practices: Production Patterns for Secure Multi-Tenant Apps — makerkit.dev](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [Row Level Security — Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Anonymous Sign-Ins — Supabase Docs](https://supabase.com/docs/guides/auth/auth-anonymous)
- [6 Common Supabase Auth Mistakes (and Fixes) — Startupik](https://startupik.com/6-common-supabase-auth-mistakes-and-fixes/)

**Supabase free-tier limits and pause behavior:**
- [Supabase Free Tier Limits: What You Actually Get In 2026 — aiagencyplus](https://aiagencyplus.com/supabase-free-tier-limits/)
- [Supabase Pricing 2026 — Automation Atlas](https://automationatlas.io/answers/supabase-pricing-explained-2026/)
- [Supabase Pricing Hidden Costs at Scale — buildmvpfast](https://www.buildmvpfast.com/blog/supabase-pricing-hidden-costs-scale-alternatives-2026)
- [Realtime "Concurrent Peak Connections" quota — Supabase Docs](https://supabase.com/docs/guides/troubleshooting/realtime-concurrent-peak-connections-quota-jdDqcp)

**Vercel free-tier limits:**
- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations)
- [Vercel Free Plan (2026) — myremoteva](https://myremoteva.com/vercel-free-forever-deployment-plan-unleash-your-projects-without-breaking-the-bank/)

**Tailwind RTL / logical properties:**
- [Tailwind CSS RTL (Right-To-Left) — Flowbite](https://flowbite.com/docs/customize/rtl/)
- [Tailwind RTL Not Working? 10-Minute Fix Guide — Tailkits](https://tailkits.com/blog/tailwind-rtl-not-working/)
- [Tailwind CSS v3.3 (logical properties announcement)](https://tailwindcss.com/blog/tailwindcss-v3-3)
- [Implementing Right-to-Left (RTL) Support in a Tailwind CSS React Application — madrus4u](https://madrus4u.vercel.app/blog/rtl-implementation-guide)

**Unicode bidi / Hebrew mixed-direction:**
- [Bidirectional Text — Wikipedia](https://en.wikipedia.org/wiki/Bidirectional_text)
- [UAX #9: Unicode Bidirectional Algorithm](http://www.unicode.org/reports/tr9/)
- [Implicit directional marks — Wikipedia](https://en.wikipedia.org/wiki/Implicit_directional_marks)
- [Understanding how to Work with Bi-Directionality (BiDi) Text — Translation Therapy](https://translationtherapy.com/understanding-how-to-work-with-bi-directionality-bidi-text/)

**Next.js / time + hydration:**
- [How to handle local dates in the client (browser timezone) with UTC dates on the server — Next.js GitHub Discussion #37877](https://github.com/vercel/next.js/discussions/37877)
- [Displaying Local Times in Next.js — François Best](https://francoisbest.com/posts/2023/displaying-local-times-in-nextjs)
- [Next.js Date & Time Localization Guide — staarter.dev](https://staarter.dev/blog/nextjs-date-and-time-localization-guide)

**WC 2026 rules and host city timezones:**
- [Extra Time Rules For FIFA World Cup 2026 Guide — club-fifaworldcup](https://club-fifaworldcup.com/extra-time-rules-world-cup/)
- [How extra time and penalty shootouts work at the World Cup — ESPN](https://www.espn.com/soccer/story/_/id/48827479/how-do-extra-penalty-shootouts-work-world-cup)
- [Host Countries and Cities — FIFA](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/host-cities)
- [2026 FIFA World Cup — Wikipedia](https://en.wikipedia.org/wiki/2026_FIFA_World_Cup)

**Event sourcing / idempotent projections (informs scoring view design):**
- [Idempotency in CQRS and Event Sourcing — DEV Community](https://dev.to/ohugonnot/idempotency-in-cqrs-and-event-sourcing-part-2-commands-projections-and-outbox-4ei)
- [Event Sourcing with PostgreSQL — Medium / Toby Hede](https://medium.com/@tobyhede/event-sourcing-with-postgresql-28c5e8f211a2)

**Prediction-pool / tiebreaker conventions:**
- [Bracket Battle — Underdog Fantasy](https://help.underdogfantasy.com/en/articles/14041015-bracket-battle)
- Kicktipp scoring conventions (4/3/2) — referenced via PROJECT.md, common knowledge in pool community

---

*Pitfalls research for: Bilingual family World Cup prediction pool, Next.js + Supabase + Tailwind, ship June 11, 2026*
*Researched: 2026-05-23*

# Feature Research

**Domain:** Bilingual (Hebrew RTL + English LTR) family-scale World Cup 2026 prediction pool — League + Bracket + Props
**Researched:** 2026-05-23
**Confidence:** HIGH (well-trodden domain; competitors are public and well-documented)
**Constraint:** 3-week ship deadline, single developer, ~15 users, no money

## Reading This Doc

Categories are **ruthless** because the deadline is real:

- **Table stakes** = the family will refuse to use it without these. Ship in phase 1, no exceptions.
- **Differentiators** = the family will notice and like them, but the pool functions without them. Phase 2 or cut.
- **Anti-features** = explicitly do NOT build. Either a deadline killer, or actively wrong for the family-trust ethos.

Every row notes complexity (S/M/L) for Next.js + Supabase, dependencies, and phase.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these means the pool is broken or feels half-built. These are the v1 critical path.

| Feature | Why Expected | Complexity | Phase | Notes |
|---------|--------------|------------|-------|-------|
| **Invite-code + display-name sign-in** | Auth is the front door; without persistent identity, scoring is meaningless | M | 1 | The auth design tension from PROJECT.md. Recommend: Supabase anonymous auth, gate access by invite code (single shared code row), bind display name to anon user. Persists on device via Supabase session cookie. |
| **Fixture list (all 64 matches, browsable)** | Users want to scroll, scan, find the matches they care about | S | 1 | Pre-seeded in Postgres. Group by matchday, show date/time in user's local TZ. Indicate "locked / open / finished" state. |
| **Per-match prediction entry (score picker)** | Core of League Mode; can't have a pool without it | M | 1 | See mobile UX section below. Two stepper inputs (0-9 covers 99% of cases, with a "+" overflow). Auto-save on change. |
| **Bracket prediction entry (knockout picks + champion)** | Core of Bracket Mode | M | 1 | Render the bracket as a top-down vertical list on mobile, horizontal tree on desktop. Each slot is a pick between two teams (or pending placeholder until upstream resolves). |
| **Tournament-level Props/Wildcards** | Core of Props Mode; users picked questions like "winner" and "top scorer" before kickoff | S | 1 | Just a list of admin-defined questions with multiple-choice or free-text answers. Lock at tournament's first kickoff. ~5–10 questions. |
| **Predictions lock at kickoff** | Non-negotiable; without this, the pool is gameable and dies | M | 1 | Server-authoritative lock based on fixture kickoff timestamp. UI shows lock state. Reject writes after lock. **CRITICAL: enforce in DB row-level security, not just UI.** |
| **Predictions hidden until lock** | Anti-copying; standard pool ethics. Loss of trust if violated | S | 1 | RLS rule: `SELECT` on predictions where `user_id = auth.uid() OR fixture.kickoff_at < now()`. |
| **Results display (after match)** | Users want to see what actually happened | S | 1 | Admin enters score. Display next to user's prediction with point breakdown. |
| **Scoring transparency ("why did I get N points?")** | Trust requires explainability; a black-box leaderboard breeds suspicion | S | 1 | Show predicted vs actual side-by-side, then "4 = exact" / "3 = goal diff" / "2 = winner" / "0 = miss" labeled visibly. Localize the labels. |
| **Unified leaderboard (League + Bracket + Props)** | The Core Value from PROJECT.md. Everything else is in service of this | M | 1 | Materialized view or live query summing the three mode totals. Sort by total desc. Position numbers (1, 2, 3…), ties handled deterministically (see tiebreaker section). |
| **Per-mode breakdown on player click** | Already specified in PROJECT.md as a Key Decision | S | 1 | Drill-down view: show this player's league/bracket/props points separately. Optionally show their predictions for already-locked matches. |
| **Bilingual UI (Hebrew RTL + English LTR), persistent toggle** | Already specified as Active requirement | M | 1 | next-intl or similar. Dictionary architecture from day 1. See RTL section below. |
| **Mobile-responsive layout** | The family will use this on phones from the couch, not laptops | M | 1 | Mobile-first Tailwind; test on a real phone, not just devtools. |
| **Admin: enter match results** | Without this, the leaderboard never updates and the pool dies | S | 1 | Simple admin form keyed by fixture ID. Setting a result triggers re-scoring of all predictions for that match. |
| **Admin: pre-seed fixtures** | All 64 WC 2026 matches need to exist before opening kickoff | S | 1 | One-time seed script. Group-stage matches with concrete teams; knockout slots with placeholders that resolve later. |
| **Admin: edit user roster** | Mistakes happen (typo display name, duplicate signup). Admin needs override | S | 1 | Tiny CRUD list. Don't over-engineer. |
| **Tournament reseeding (knockouts fill in after group stage)** | Once groups end, R16 matchups become known — bracket picks must rebind to actual teams | M | 1 | See dedicated section below. **Critical edge case** — if not handled, bracket mode breaks at first knockout. |

**Subtotal complexity:** ~22 S/M items. Tight but doable in 3 weeks for a focused single developer.

### Differentiators (Competitive Advantage)

Nice to have, demonstrably valued by users on Kicktipp / Superbru / ESPN, but **the pool functions without them**. Phase 2 or cut entirely.

| Feature | Value Proposition | Complexity | Phase | Notes |
|---------|-------------------|------------|-------|-------|
| **Realtime leaderboard updates (no refresh)** | Adds "live match watching" energy when results are entered | M | 2 | Supabase Realtime channel on the leaderboard view. Cheap, but not blocking. v1 = manual refresh is fine. |
| **Prediction history view (per user, all matches)** | Lets users replay their own performance, see streaks | S | 2 | Just a filtered list query. Easy add post-launch. |
| **Mini-stats ("you got 4/5 group A matches exact")** | Engagement; family loves a personalized takeaway | M | 2 | Computed aggregations. Add after match data accumulates. Not useful before kickoff. |
| **Head-to-head comparisons (player A vs player B)** | The exact thing families argue about at dinner — Core Value adjacent | M | 2 | Side-by-side predictions, shared matches, who-beat-whom. Strong fit but cuttable for v1. |
| **Push notifications / email reminders before kickoff** | Reduces forgotten predictions | L | 3 / never | Heavy infra (push tokens, web push, opt-in flows). Web app + family WhatsApp group is the practical alternative. **Recommend: don't build, rely on family WhatsApp.** |
| **Comments / reactions / chat per match** | Social glue | L | 3 / never | Family WhatsApp already does this. Don't compete with it. |
| **Dark mode** | Modern table-stakes-adjacent expectation | S | 2 | Tailwind dark variant. Add after launch. |
| **Charts (leaderboard over time, points-per-matchday)** | Visual engagement | M | 2 | Recharts or similar. Looks nice in screenshots. |
| **Group/sub-league within the pool** | Useful in 50+ person pools; **not useful for 15** | M | never | Family is one cohort. Don't add complexity. |
| **Public profile pages / avatars** | Social polish | S | 2 | Avatar upload is the LIFT. Pure text profile is trivial. |
| **Match details (lineups, live score, stats)** | "App feel" — but requires sports API integration | L | never | Out of scope per PROJECT.md (no external sports API). Don't even consider. |
| **Achievement badges ("first exact score", "perfect matchday")** | Gamification flavor | M | 2 | Fun but pure polish. Post-launch when data justifies. |
| **Export leaderboard as image (shareable)** | Family will screenshot and post to WhatsApp anyway | S | 2 | Server-rendered OG image, or just rely on native screenshot. **Don't build — native screenshot is fine.** |
| **Late-pick penalties / partial credit** | Some pools allow predictions during the match for fewer points | M | never | Conflicts with locking ethos. The lock is sacred. Don't muddy it. |
| **Multiple scoring profiles / configurable rules** | Out of scope per PROJECT.md | M | never | Hardcoded 4/3/2 + 2/4/8/16/32. Already a Key Decision. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that look reasonable but would either kill the deadline or actively harm the family-trust ethos. **Discuss-and-decline list.** Document so they don't sneak back in.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-money pot / entry fee / wallet** | "Make the rivalry serious" | Gambling-law surface area, payment infra, KYC, family-trust violation, deadline killer | Bragging rights only. Per PROJECT.md, explicit Out of Scope. |
| **Anti-cheat / fraud detection / device fingerprinting** | "What if someone makes multiple accounts?" | The invite code + family trust IS the anti-cheat. Detection infra is weeks of work for zero family-realistic threat | Trust the family. Admin can delete duplicates if it happens. |
| **Public discovery / "find a pool to join"** | Mirrors Kicktipp's growth feature | Family pool, not a SaaS. Public discovery requires moderation, abuse handling, identity verification | Private invite-code-only. Already in PROJECT.md. |
| **OAuth login (Google/Apple/Facebook)** | "Lower friction than passwords" | The invite-code IS the lowest-friction option. OAuth adds a third-party dependency and PII collection | Invite code + display name. Already a Key Decision. |
| **Email collection / email/password auth** | Standard auth pattern | Adds PII to manage, password reset flows, verification emails. Friction without value for a family pool | Anonymous auth + invite gate. |
| **Forum / threaded discussions / DMs** | Social engagement | Moderation burden, abuse surface, duplicates WhatsApp | Family WhatsApp group exists. Use it. |
| **Live external sports API integration** | "Auto-update results" | API rate limits, cost, downtime during peak matches, contract terms, debugging when the API is wrong | Admin enters results manually. Already Out of Scope per PROJECT.md. ~64 manual entries over a month is trivial. |
| **Native mobile app (iOS/Android)** | "Better mobile UX" | App store review delays, two more codebases, push notification infra | Mobile web with PWA install banner if time. Already Out of Scope. |
| **Multi-tournament / generic tournament engine** | "Reuse for Euro 2028" | Generic engines are 3-10x more code than single-tournament ones. Premature abstraction | Hardcode for WC 2026. Already a Key Decision. |
| **Multiple admin roles / permissions matrix** | "What if you go on vacation?" | One trusted operator suffices for 15-user family pool | Single admin (the user). Already Out of Scope. |
| **Configurable scoring rules per pool** | Standard Kicktipp feature | Adds settings UI, validation, edge-case scoring | Hardcoded 4/3/2 + escalating bracket. Already Out of Scope. |
| **In-tournament prop bets (round-specific bonuses)** | More content to engage with mid-tournament | More locking complexity, more admin entries | Tournament-level props only, locked before opening match. Already Out of Scope. |
| **Pick percentages / "X% of pool picked Brazil"** | Adds info during live matches | Reveals other users' picks indirectly — leaks info before lock | Don't display. After-lock-only aggregates are OK if added later. |
| **Auto-pick / "fill my bracket randomly"** | Convenience for late joiners | Encourages low-effort participation that distorts scoring; family pool isn't 1000-person bracket challenge | None. The family fills their own brackets. |
| **Bracket cascade mode (each user's R16 derives from their own group predictions)** | More upfront investment | Massively more complex scoring, confusing for casual family users, harder to display | **Standard mode only.** R16 reseeds to actual results once groups end. See reseeding section. |
| **Achievements that gate features** | Engagement loop | Locking content behind achievements feels gamey for a family pool | None. All features open to all users always. |

---

## Critical Edge Cases (Investigated)

### Edge Case 1: Results showing while predictions are still locked for late games

**The scenario:** WC 2026 has overlapping matches (especially group stage final-day simultaneous kickoffs). Match A finishes at 22:00, but Match B kicks off at 22:00 in another timezone with predictions still being submitted right up to the deadline. **You cannot show A's result on the leaderboard while B is still open**, or users will be influenced.

**How real pools handle it:**
- **Kicktipp:** Per-fixture lock at kickoff. Results display immediately after each match ends. Leaderboard updates whenever any match resolves. Since locks are per-fixture, the "results visible while other predictions open" state is normal and expected — each fixture's predictions are already locked once it kicks off, so seeing the result of A doesn't help you with B (you've already locked B).
- **Superbru:** Same model. Per-match lock at kickoff.
- **ESPN Bracket Challenge:** Stage-based lock (entire knockout round locks at first kickoff of round). Coarser-grained but simpler.

**Recommended approach for Zarur-Cup:**
- **Per-fixture lock at kickoff** (matches PROJECT.md). Once Match A kicks off, A is locked. If A finishes before B kicks off, A's result is visible AND scored, but B is already locked too — so no leakage.
- **Edge case worth double-checking:** "lock at kickoff" means a user submitting at 20:59:59 for a 21:00 match should succeed; at 21:00:00 it should reject. Server-authoritative timestamps; never trust client clock.
- **UI behavior:** Fixture cards show one of three states: `OPEN` (predict freely), `LOCKED` (kickoff happened, predictions visible, no result yet), `FINISHED` (result entered, points calculated, predictions visible). The LOCKED→FINISHED transition is admin-triggered.

**Complexity:** S (already required by lock mechanism; just clean state machine).

### Edge Case 2: Tournament reseeding (knockouts fill in after group stage)

**The scenario:** Family members pick their bracket BEFORE the tournament. But the actual R16 matchups don't exist until group stage ends. WC 2026 also has the "8 best third-place teams" wrinkle that determines R32 matchups dynamically.

**How real pools handle it:**
- **ESPN Knockout Challenge:** Separate from group-stage challenge. R32/R16 picks open AFTER group stage concludes, when actual matchups are known. Different game.
- **Kicktipp / Superbru:** Knockout picks are made AS the matchups become known (per-match prediction, same as group stage). No "pre-tournament fill-out-whole-bracket" feature.
- **Office bracket pools (March Madness style):** Pre-tournament bracket is filled out once with team names. But WC has knockout placeholders ("Winner Group A", "Runner-up Group C") that are filled in deterministically only after groups end.

**The tension for Zarur-Cup:** PROJECT.md says Bracket Mode predicts R16 → Final + Winner. This implies pre-tournament picks. But you don't know who the R16 teams ARE before groups end (especially the third-place teams in WC 2026's new format).

**Recommended approach — opinionated decision needed:**

**Option A (RECOMMENDED): "Pick the champion + finalists + final four pre-tournament; fill in earlier rounds as groups complete."**
- Pre-tournament: pick the champion, runner-up, and the four semifinalists by team name (just dropdowns of all 48 teams).
- After group stage: actual R32 matchups are known. Family fills in R32 → R16 → QF picks on a real bracket UI. The pre-tournament champion/finalist picks remain locked in.
- Scoring: champion = 32, finalist (incl. champion's slot) = 16 each round, etc. — points awarded when the picked team actually reaches/wins that round.
- **This is the simplest mental model** AND avoids the "your bracket is broken because you predicted a wrong group winner" cascade problem.

**Option B: Pre-tournament fill-out-whole-bracket with auto-cascade.**
- Family picks Spain to win Group E. Bracket auto-fills "Spain plays runner-up of Group A" in R32.
- After actual groups, the bracket has both the user's predicted bracket AND the actual bracket — scoring matches one to the other.
- **More complex; harder to display; common source of confusion in office pools.** Don't recommend for v1.

**Option C: Lock knockout picks until groups end.**
- Pre-tournament, no bracket picks at all. After group stage, the actual R32 matchups appear and family picks one at a time.
- Loses the "fill out the bracket pre-tournament" flavor that's central to bracket pools.
- **Simplest to build** (per-fixture predictions just like group stage, with escalating points per round). Use this if time runs out.

**My recommendation: Option A.** It captures the "I picked Brazil to win the cup three weeks ago" flavor (which is the emotional core of bracket pools) without requiring cascade logic. The finalist/semifinalist picks lock at tournament start; the rest of the bracket fills in progressively.

**Complexity:** M (Option A) / L (Option B) / S (Option C).

### Edge Case 3: Score-tiebreaker rules

**The scenario:** Two family members tie on total points at tournament end. Tie needs a deterministic break.

**How real pools handle it (in priority order):**
1. **Number of exact-score predictions** (most common — rewards skill, not luck) — Kicktipp, Footy Forecast, 365Scores all use this.
2. **Number of correct results** (winner correct, even if wrong score) — secondary tiebreaker.
3. **NFL pick'em style:** Predict total goals in the final as a tournament-end tiebreaker (you pick this BEFORE the tournament; closest wins).
4. **Head-to-head:** Who beat whom directly. Common in season-long fantasy; awkward in pool prediction where there's no "match" between users.

**Recommended approach for Zarur-Cup:**

Use a layered, deterministic tiebreaker:
1. **Total points** (already the primary sort).
2. **Number of exact-score predictions** (League Mode).
3. **Number of correct bracket round picks** (Bracket Mode).
4. **Alphabetical display name** (deterministic fallback — no real "winner" but the leaderboard renders consistently).

**Don't recommend** the "predict the final total goals" tiebreaker — it's a one-off prediction that's easy to forget, and ties are rare enough at 15 users that the layered approach handles it.

**Complexity:** S (purely a SQL ORDER BY chain on aggregates you already compute).

### Edge Case 4: Mobile prediction-entry UX (1-handed thumb use)

**The scenario:** Family member on the couch, phone in one hand, wants to enter scores for 6 matches in under a minute.

**Research from sports prediction apps:**
- **Two stepper buttons (− / +)** for home goals and away goals. Tap target ~48px. Default both to 0.
- **OR two large tap-to-cycle digits.** Tap "1" → cycles 1→2→3→…→0. Long-press for explicit picker.
- **Don't use system numeric keyboards** — they're too tall, hide context, and require dismissing.
- **Auto-save on change** with a subtle "saved" indicator. No explicit submit button per match (too many taps for a 64-match tournament).
- **One-screen-per-matchday** with vertical scroll. Sticky matchday header. Match cards roughly 100–120px tall.
- **Lock state visible at-a-glance** — gray out + show lock icon for kicked-off matches.

**Hebrew RTL twist:** When the layout flips for Hebrew, home/away positions reverse. The "home team" in Hebrew RTL appears on the right. **Make sure scores stay attached to teams, not to screen positions.** Test this explicitly — it's the #1 bilingual sports app bug.

**Recommended:** Stepper buttons (− / +), home team on the leading side (right in Hebrew, left in English), team logos/abbreviations beside scores, sticky matchday header.

**Complexity:** M (the core component is one focused day of work; RTL polish is another day).

### Edge Case 5: Hebrew-specific UX patterns

**What needs care:**

1. **Digits:** Use Western (Arabic) numerals 0–9 for scores in BOTH locales. Hebrew uses Western numerals natively in modern UIs. **Do NOT use Hebrew letters as numbers (gematria)** — only relevant in religious/historical contexts, would baffle users.

2. **Direction-neutral data:**
   - Scores like "2–1" stay logically left-to-right (number, dash, number). The CONTAINER mirrors, but the score expression itself is treated as a single neutral token. Use a `<span dir="ltr">` wrapper or `<bdi>` element on the score to prevent BiDi mirroring.
   - Same for timestamps, version numbers, URLs.

3. **Mixed-language strings:** "Brazil 2 - 1 ארגנטינה" (English team name beside Hebrew team name) requires correct BiDi handling. Use `<bdi>` to isolate each team name's direction. Test with both `RTL→LTR→RTL` and `LTR→RTL→LTR` orderings.

4. **Form fields:** Score steppers — the − and + buttons swap positions in RTL (− should be on the right in Hebrew so the "decrease" gesture matches the leading edge). Tailwind's logical properties (`ps-*`, `pe-*`, `ms-auto`) handle this automatically.

5. **Icons that imply direction:** Arrows (next/prev, expand) need to flip in RTL. Tailwind `rtl:rotate-180`. Don't flip non-directional icons (settings gear, search, etc.).

6. **Date/time formatting:** Use `Intl.DateTimeFormat('he-IL', ...)` and `Intl.DateTimeFormat('en-US', ...)`. Hebrew dates render right-to-left within an RTL paragraph but the date itself reads naturally.

7. **Team names:** Pre-seeded with both Hebrew and English names per team. Render `team.name[locale]`. Some teams have established Hebrew names (Brazil = ברזיל, Argentina = ארגנטינה); pre-seed these manually for all 48 WC 2026 teams.

8. **Font:** Pick a font that has solid Hebrew AND Latin glyphs (Heebo, Rubik, or Assistant are good free choices). Don't rely on system fallback — looks janky.

9. **Locale toggle persistence:** Store in cookie + localStorage. Cookie for SSR rendering; localStorage for client-side hydration. Default: browser locale, fallback to Hebrew (per Key Decision in PROJECT.md).

10. **Testing:** A Hebrew-speaking family member should test the RTL build before launch. Don't ship Hebrew unreviewed — automated tools won't catch idiomatic awkwardness.

**Complexity:** M for the framework setup; LOW per-component if discipline is maintained from day 1.

---

## Feature Dependencies

```
[Invite-code auth]
    └──requires──> [Supabase project + anonymous auth setup]
    └──enables────> [All other features that need user identity]

[Predictions lock at kickoff]
    └──requires──> [Fixture data with kickoff_at timestamps]
    └──requires──> [Server-authoritative time check + RLS policy]
    └──enables────> [Predictions hidden until lock]

[Unified leaderboard]
    └──requires──> [League scoring complete]
    └──requires──> [Bracket scoring complete]
    └──requires──> [Props scoring complete]
    └──requires──> [Per-mode breakdown view]

[Bracket Mode]
    └──requires──> [Tournament reseeding logic (Option A from above)]
    └──requires──> [Fixture data: knockout slots with team-slot placeholders]

[Bilingual UI]
    └──requires──> [Locale dictionary architecture]
    └──requires──> [Team name translations (manual seed)]
    └──enables────> [Hebrew-speaking family members fully participating]

[Admin: enter results]
    └──triggers──> [Re-scoring of all predictions for that fixture]
    └──triggers──> [Leaderboard recompute (materialized view refresh)]

[Realtime leaderboard updates] (phase 2)
    └──requires──> [Unified leaderboard already working]
    └──enhances──> [Leaderboard during live matches]

[Head-to-head comparisons] (phase 2)
    └──requires──> [Prediction history view]
    └──enhances──> [Family dinner-table debates — Core Value adjacent]
```

### Dependency Notes

- **Auth must ship first, period.** Every other table-stakes feature depends on knowing who the user is.
- **Lock + Hidden predictions are coupled.** They share the same timestamp check and RLS rule. Build them together, test them ruthlessly together.
- **Scoring is downstream of result entry.** Admin's "enter result" form is the trigger; scoring is a derived computation. If scoring is buggy, the leaderboard lies — and per PROJECT.md, "if the leaderboard is broken, nothing else matters."
- **Bracket reseeding has no upstream dependency** EXCEPT the fixture schema decision (Option A vs B vs C above). Make that call in planning before any bracket code is written.
- **Bilingual is a cross-cutting concern.** Wire the dictionary in from the first component, not after.

---

## MVP Definition

### Launch With (v1) — ship before June 11, 2026

**Auth & Identity**
- [ ] Supabase anonymous auth + invite-code gate
- [ ] Display-name selection, persistent identity per device
- [ ] Admin role flag (just a boolean on the user)

**Data**
- [ ] Pre-seeded 64 WC 2026 fixtures (with Hebrew + English team names)
- [ ] Pre-seeded ~5–10 Props/Wildcards questions
- [ ] Fixture state machine: OPEN / LOCKED / FINISHED

**Prediction Entry**
- [ ] Per-match score picker (League Mode) — mobile-first stepper UX
- [ ] Bracket picker (champion + finalists + final four pre-tournament; bracket fills progressively)
- [ ] Props/Wildcards entry — locks at first kickoff

**Scoring & Display**
- [ ] Kicktipp 4/3/2 scoring (League)
- [ ] Escalating bracket scoring (2/4/8/16/32)
- [ ] Props scoring (admin-defined per-question point values, default reasonable defaults)
- [ ] Unified leaderboard with per-mode breakdown on player click
- [ ] Per-match "why did I get N points" transparency view
- [ ] Tiebreaker rule (exact scores → correct results → alphabetical)

**Locking & Privacy**
- [ ] Server-authoritative lock at kickoff (enforced in RLS, not just UI)
- [ ] Predictions hidden from other users until match kicks off

**Admin**
- [ ] Enter match results form (triggers re-scoring)
- [ ] Edit user roster (rename, delete)
- [ ] Re-seed fixtures (one-time, ideally a script not a UI)

**Internationalization**
- [ ] Hebrew (RTL) + English (LTR) full coverage
- [ ] Browser locale detection on first visit, Hebrew fallback
- [ ] Persistent locale toggle
- [ ] All team names pre-translated

**Polish (non-negotiable)**
- [ ] Mobile-first responsive layout, tested on a real phone
- [ ] Deployed to public URL with custom subdomain
- [ ] Family invite code distributed
- [ ] One end-to-end test pass with a real family member before opening match

### Add After Validation (v1.x — post-opening-match, during tournament)

These can be shipped between matchdays if v1 is solid. None should block launch.

- [ ] Realtime leaderboard (Supabase Realtime) — trigger: family complains about refreshing
- [ ] Prediction history view (per-user) — trigger: family wants to see their own past picks
- [ ] Head-to-head comparison — trigger: dinner-table argument about who's better
- [ ] Mini-stats / personalized aggregates — trigger: when enough data accumulates (after group stage)
- [ ] Dark mode — trigger: nighttime usage complaints
- [ ] Charts (leaderboard over time) — trigger: family wants more visualization
- [ ] Achievement badges — trigger: only if data shows engagement is plateauing

### Future Consideration (v2+ — after WC 2026 ends)

- [ ] Multi-tournament support (Euro 2028, World Cup 2030) — trigger: family wants to do it again
- [ ] Configurable scoring rules — trigger: someone wants to argue about scoring
- [ ] Native PWA install + offline mode — trigger: user demand
- [ ] Sports API integration — trigger: manual entry becomes painful at scale (it won't for one tournament)

### Never

- Real money / wallet / KYC
- OAuth / email auth
- Anti-cheat infra
- Public discovery
- Multiple admin roles
- In-app comments / chat / DMs
- Live match data integration
- Bracket cascade mode

---

## Feature Prioritization Matrix

Top of the priority stack for v1. P1 = blocking; P2 = strong-fit-if-time; P3 = post-launch.

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Invite-code auth | HIGH | MEDIUM | P1 |
| Per-match score entry | HIGH | MEDIUM | P1 |
| Bracket entry (Option A reseeding) | HIGH | MEDIUM | P1 |
| Props/Wildcards entry | HIGH | LOW | P1 |
| Lock at kickoff (server-authoritative) | HIGH | MEDIUM | P1 |
| Hidden predictions until lock | HIGH | LOW | P1 |
| Unified leaderboard | HIGH | MEDIUM | P1 |
| Per-mode breakdown drill-down | HIGH | LOW | P1 |
| Scoring transparency view | HIGH | LOW | P1 |
| Admin: enter results | HIGH | LOW | P1 |
| Pre-seeded fixtures (script) | HIGH | LOW | P1 |
| Bilingual UI (RTL+LTR) | HIGH | MEDIUM | P1 |
| Mobile-responsive layout | HIGH | MEDIUM | P1 |
| Tiebreaker rules | MEDIUM | LOW | P1 |
| Realtime leaderboard | MEDIUM | MEDIUM | P2 |
| Prediction history view | MEDIUM | LOW | P2 |
| Head-to-head comparison | MEDIUM | MEDIUM | P2 |
| Mini-stats | MEDIUM | MEDIUM | P2 |
| Dark mode | LOW | LOW | P2 |
| Charts | LOW | MEDIUM | P3 |
| Achievement badges | LOW | MEDIUM | P3 |
| Push notifications | MEDIUM | HIGH | NEVER |
| Comments / chat | LOW | HIGH | NEVER |
| Avatar uploads | LOW | LOW | P3 |

**P1 count: 14 features.** That's the v1 surface area. If any P1 slips, the pool doesn't ship. P2 and P3 are bonus.

---

## Competitor Feature Analysis

| Feature | Kicktipp | Superbru | ESPN Bracket Challenge | Zarur-Cup Approach |
|---------|----------|----------|------------------------|---------------------|
| **Scoring** | Configurable; default exact/diff/tendency | Fixed 3/1.5/1 | Round-based escalating | Hardcoded 4/3/2 (Kicktipp default) + 2/4/8/16/32 bracket |
| **Auth** | Email or anonymous | Email + OAuth | ESPN account | Invite code + display name (anonymous Supabase) |
| **Pool privacy** | Private pools by URL | Private + public | Always private group | Private, single family pool |
| **Bracket handling** | Per-match picks as groups end | Per-match picks | Whole bracket post-groups | Option A: champion/finalists pre-tournament, rest fills as groups end |
| **Locking** | Per-fixture at kickoff | Per-fixture at kickoff | Whole stage at first kickoff | Per-fixture at kickoff |
| **Hidden picks** | Yes, until kickoff | Yes, until kickoff | Yes, until lock | Yes, until kickoff |
| **Tiebreaker** | Configurable | Sum of exact scores | Total points (no further break) | Layered: exacts → correct results → alphabetical |
| **Languages** | DE, EN, several others — NO Hebrew | EN only | EN + a few | Hebrew + English first-class |
| **Live results** | Live API integration | Live API integration | Live API integration | Admin enters manually |
| **Realtime leaderboard** | Yes | Yes | Yes | v1: no; v2: Supabase Realtime |
| **Social features** | Comments, predictions visible to all post-lock | Comments, predictions visible post-lock | None | None — defer to family WhatsApp |
| **Mobile apps** | iOS + Android | iOS + Android | iOS + Android | Mobile web only (PWA optional) |
| **Cost** | Free | Free + Premium | Free | Free (Vercel + Supabase free tier) |

**Key takeaways:**
1. The big platforms differ from Zarur-Cup primarily in: (a) live-API integration and (b) language support. We win on Hebrew RTL; they win on automation.
2. Bracket handling is the most varied feature across competitors — confirming that Option A (champion + finalists pre-tournament, rest progressive) is a defensible choice but not the only one.
3. **No major competitor supports Hebrew RTL.** This is the family's actual reason for building a custom platform (per PROJECT.md Context).
4. None of the competitors do anything Zarur-Cup couldn't ship in v1 EXCEPT live-API and realtime updates — both deliberately deferred.

---

## Sources

- [Kicktipp scoring rules and pool features](https://www.kicktipp.com/info/service/help/222/227) — primary reference for the 4/3/2 scoring family — HIGH confidence
- [Kicktipp valuable tips for point rules](https://www.kicktipp.com/info/service/help/2/213) — confirms exact / tendency / goal-difference variants — HIGH confidence
- [Superbru World Cup 2026 prediction game](https://www.superbru.com/worldcup_predictor/) — competitor feature reference — HIGH confidence
- [ESPN Knockout Bracket Challenge 2026](https://fantasy.espn.com/games/mens-knockout-bracket-challenge-2026/) — bracket pool reference, stage-based locking — HIGH confidence
- [BettingUSA NFL Pick'em Pools Explained](https://www.bettingusa.com/sports/nfl/pickem-pools/) — pick'em UX conventions, tiebreaker patterns — MEDIUM confidence
- [Office Pools football tiebreaker article](https://www.officepools.com/help/article/football-tiebreaker/) — tiebreaker conventions — MEDIUM confidence
- [Footy Forecast WC 2026 prediction game](https://footyquiz.co.uk/footy-forecast/) — confirms "exact scores as tiebreaker" pattern — MEDIUM confidence
- [Score7 multi-stage tournaments guide](https://kb.score7.io/blog/guides/group-stage-to-knockout-how-multi-stage-tournaments-work/) — reseeding handling, cascade vs standard mode — MEDIUM confidence
- [How to organize World Cup predictions (Easypromos)](https://www.easypromosapp.com/blog/en/how-to-organize-world-cup-predictions/) — feature checklist for pool organizers — MEDIUM confidence
- [Material Design 3 bidirectionality (RTL)](https://m3.material.io/foundations/layout/understanding-layout/bidirectionality-rtl) — RTL design principles — HIGH confidence
- [Argos Multilingual planning for RTL](https://www.argosmultilingual.com/blog/planning-for-rtl-languages-how-layout-content-and-qa-fit-together) — RTL planning best practices — MEDIUM confidence
- [DTP Labs RTL typography guide](https://www.dtplabs.com/blog/rtl-typography-complete-guide-arabic-hebrew-farsi) — Hebrew typography specifics — MEDIUM confidence
- [Tomedes Hebrew UI strings best practices](https://www.tomedes.com/translator-hub/hebrew-ui-strings-translation) — Hebrew localization patterns — MEDIUM confidence
- [ESPN World Cup group stage tiebreakers explainer](https://www.espn.com/soccer/story/_/id/48703925/world-cup-group-stage-explained-tiebreakers-third-place-teams) — confirms WC 2026 third-place-team mechanic — HIGH confidence

---
*Feature research for: Bilingual family WC 2026 prediction pool*
*Researched: 2026-05-23*

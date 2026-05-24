# Project Research Summary

**Project:** Zarur-Cup / משחקי זערור
**Domain:** Bilingual (Hebrew RTL + English LTR) family-scale World Cup 2026 prediction pool
**Researched:** 2026-05-23
**Confidence:** HIGH (with a small handful of pending product calls flagged below)

## Executive Summary

Zarur-Cup is a well-trodden problem shape (Kicktipp-style prediction pool) wrapped in two unusual constraints: **Hebrew-first bilingual UX** and a **3-week ship deadline** to FIFA World Cup 2026 kickoff on June 11, 2026. All four research streams converge with HIGH confidence on the same stack and architecture: **Next.js 15 App Router + Tailwind v4 logical properties (no RTL plugin) + Supabase (`@supabase/ssr` + `signInAnonymously()` + an invite-code → `profiles` gate) + next-intl v4 + Vercel free tier**. There is no genuine disagreement across the four documents.

The single highest-leverage architectural call is to **make Postgres the source of truth for locking and visibility via RLS**, not the app code. Every researcher independently arrived at the same conclusion: `predictions.kickoff_at <= now()` evaluated by the database (in `WITH CHECK` for writes, `USING` for reads) eliminates clock skew, two-tab race conditions, curl bypasses, forgotten guards in Server Actions, and the entire class of "I trusted the UI" bugs. The recent CVE-2025-48757 cluster (10%+ of Supabase apps shipped with readable predictions) is a direct warning to not skip this. Scoring follows the same principle: predictions and bracket picks are inputs, results are facts, and **points are a derived SQL view** — admin corrections become idempotent re-renders, not replay-the-event-stream rituals.

The known risks are well-bounded and have explicit mitigations: (1) **Supabase free-tier auto-pause** after 7 days inactivity — solved by a Vercel Cron heartbeat hitting `/api/heartbeat` every 3 days from project start through July 19; (2) **Tailwind physical direction utilities** silently breaking Hebrew layouts — solved by a CI lint rule banning `pl-/pr-/ml-/mr-/text-left/text-right` from day 1; (3) **device-locked anonymous sessions** — accepted as a tradeoff for the 15-person family pool, mitigated by an admin "merge users" escape hatch and clear onboarding copy. Realtime is explicitly **not** needed at this scale — RSC + `revalidatePath` + `router.refresh()` on focus gives the same UX with less moving parts. The remaining open questions are product calls, not technical unknowns, and are flagged below for the roadmapper.

## Key Findings

### Recommended Stack

The stack is locked. All four researchers independently validate the user-proposed `Next.js + Tailwind + Supabase + Vercel` choice as the correct 2026 default, with high-confidence sourcing back to official docs. The only meaningful design tension — invite-code-without-email auth — has a clean answer (`signInAnonymously()` + invite gate writing to `profiles`).

**Core technologies:**
- **Next.js 15.5.x (App Router)** — LTS through Oct 2026, covers tournament window. Stay on 15.5; do not chase 16 mid-project (introduces `middleware.ts` → `proxy.ts` churn).
- **React 19** — bundled with Next 15.5; required for clean `useActionState` / `<form action>` ergonomics.
- **Tailwind CSS v4.3.x** — v4.2+ ships complete logical-property utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `inset-s-*`, `inset-e-*`); **explicitly do NOT install `tailwindcss-rtl`** — it is legacy.
- **Supabase** (`@supabase/supabase-js@^2` + `@supabase/ssr@^0.5+`) — free-tier headroom dwarfs needs (15 users vs. 50K MAU cap). Use `@supabase/ssr` only; `@supabase/auth-helpers-nextjs` is deprecated. Use new `sb_publishable_*` / `sb_secret_*` key format. Use `getClaims()` (not `getSession()`) on the server.
- **next-intl v4** — App Router-native i18n, `[locale]` URL segment is canonical, RTL via `<html dir>` set server-side in layout, default locale `'he'` with browser detection.
- **Zod 4** — shared schemas between client form, Server Action, and DB insert.
- **Vercel Hobby tier** — native Next integration, free Cron for the Supabase keepalive.

**Supporting choices (deliberate non-adoption):**
- **TanStack Query** — skip; TanStack's own docs recommend skipping it for new RSC apps.
- **Date library** — skip; native `Intl.DateTimeFormat` + UTC `timestamptz` covers everything. Reach for `date-fns@^4` only if arithmetic emerges.
- **React Hook Form** — only on the bracket and per-match prediction screens; plain `<form action={serverAction}>` + `useActionState` is enough for invite-code and display-name forms.
- **Vitest** — skip for v1 unless scoring math becomes hairy; **Playwright smoke tests only**.

Full detail in [STACK.md](./STACK.md).

### Expected Features

The domain is well-mapped (Kicktipp, Superbru, ESPN Bracket Challenge are all public). 14 P1 features are non-negotiable for v1; everything else is post-launch fodder. Notably, **no major competitor supports Hebrew RTL** — that is the family's actual reason for building a custom platform.

**Must have (table stakes — 14 P1 features):**
- Invite-code + display-name sign-in (Supabase anonymous + invite gate)
- Pre-seeded 64 WC 2026 fixtures with Hebrew + English team names
- Per-match score predictions (mobile-first stepper UX)
- Bracket predictions (champion + finalists + final four pre-tournament; rest fills progressively — **Option A**)
- Tournament-level Props/Wildcards (~5–10 admin-defined questions, locked at first kickoff)
- Predictions lock at kickoff — enforced in RLS, not just UI
- Predictions hidden from others until kickoff — same RLS policy
- Unified leaderboard (League + Bracket + Props) with per-player drill-down
- Scoring transparency ("you got 4 = exact / 3 = goal diff / 2 = winner / 0 = miss")
- Kicktipp 4/3/2 + escalating bracket 2/4/8/16/32 (hardcoded)
- Tiebreaker rules (exact scores → correct results → alphabetical)
- Bilingual UI with browser detection + persistent toggle, Hebrew default
- Mobile-responsive (test on a real phone, not devtools)
- Admin: enter results, edit roster, pre-seed fixtures (script, not UI)

**Should have (differentiators — defer to v1.x, post-opening-match):**
- Realtime leaderboard (Supabase Realtime channel) — trigger: family complains about refreshing
- Prediction history view (per user)
- Head-to-head comparisons (player A vs player B)
- Mini-stats / personalized aggregates (post-group-stage)
- Dark mode

**Defer (v2+ / never):**
- Push notifications / email — family WhatsApp covers this
- Comments / chat / DMs — WhatsApp again
- Charts and achievement badges — pure polish
- Live external sports API integration — explicit Out of Scope per PROJECT.md
- Real-money / OAuth / multi-admin / multi-tournament — all explicit Out of Scope
- Bracket cascade mode — common source of confusion in office pools, don't add

Full detail in [FEATURES.md](./FEATURES.md).

### Architecture Approach

Server-rendered first. RSC pages hit Postgres directly; Server Actions handle every write; client components are a deliberate minority (score steppers, locale toggle, bracket slot pickers). The database enforces all the rules that matter — locking, visibility, scoring — so the app gets to be dumb and the DB cannot be lied to.

**Major components:**
1. **`app/[locale]/...` (RSC pages + Server Actions)** — locale is a URL segment so `<html dir>` is decided in `layout.tsx` from a single source. Server Actions own every write; pages own every read.
2. **`lib/db/*`, `lib/auth/*`, `lib/scoring/*` (server-only modules)** — sole consumers of `@supabase/ssr`'s server client. Pages call `lib/db`, never Supabase directly. `lib/scoring` holds pure TypeScript scoring functions, mirrored as a Postgres trigger.
3. **Postgres schema with placeholder-aware fixtures** — `fixtures.{home,away}_placeholder` carries symbolic refs (`'WINNER_GROUP_A'`, `'R32_M1_W'`) so the 104-match schedule is fully seeded before knockout teams are known. `bracket_picks` are keyed on `slot_id`, not fixture — surviving group-stage reshuffles cleanly.
4. **RLS as the only enforcer** — `predictions_read`, `predictions_write`, `bracket_picks_*`, `prop_answers_read` policies all reference `fixtures.kickoff_at <= now()`. Single source of truth, zero clock-skew surface area.
5. **`score_events` append-only-with-upsert + `v_leaderboard` view** — scoring is derived from `(predictions, results)`, never stored as a running total. The unique key `(user_id, source, ref_id)` makes admin corrections idempotent: update one result row, the trigger re-upserts affected score_events, the leaderboard view picks it up on next select.
6. **Bilingual content split** — UI strings in `messages/{en,he}.json` via next-intl; domain text (team names, prop prompts) in `_en` / `_he` DB columns. No `translations` join table.

Full detail in [ARCHITECTURE.md](./ARCHITECTURE.md).

### Critical Pitfalls

The pitfalls research surfaces 10 critical risks; the top 5 are blockers if missed.

1. **RLS read-leak before lock (CVE-2025-48757 territory)** — Tables shipped without RLS, or with SELECT-only policies, expose all predictions in the `/rest/v1/predictions` payload. Avoid by: enabling RLS at table-creation time, writing SELECT policies as `user_id = (select auth.uid()) OR fixture.kickoff_at <= now()`, using `(select auth.uid())` (not bare `auth.uid()`), and auditing every `security definer` function. UI hiding is not the lock — RLS is.
2. **Client-side lock check** — Two-tab races, network retries, and curl bypass any UI-disabled submit button. Mitigation: RLS `WITH CHECK ((select kickoff_at from fixtures where id = fixture_id) > now())` on INSERT and UPDATE. App-level checks are UX affordance only. Daily integrity query: `SELECT * FROM predictions p JOIN fixtures f ON f.id = p.fixture_id WHERE p.submitted_at > f.kickoff_at` must always return zero rows.
3. **Non-rerunnable scoring** — Storing `points` as a running total mutated on result-entry guarantees double-counting on the inevitable admin correction. Mitigation: scoring as a SQL view (`v_leaderboard`) over `(predictions, results)`. Result corrections are a single UPDATE; the view recomputes on next select. `score_events` uses upsert keyed on `(user_id, source, ref_id)` to stay idempotent. **All scoring math integer-only** (no floats, no weights).
4. **Tailwind physical direction utilities** silently break Hebrew layouts — `pl-4 mr-2 text-left` looks fine in English, garbled in RTL. Mitigation: ban physical utilities via CI grep/lint from day 1 (`pl-|pr-|ml-|mr-|border-l-|border-r-|text-left|text-right|left-|right-`). Use logical equivalents (`ps-*`, `pe-*`, `ms-*`, `me-*`, `text-start`, `text-end`, `start-*`, `end-*`). Wrap mixed-direction strings like scores in `<bdi>` or `<span dir="ltr">`.
5. **Supabase free-tier project auto-pause** after 7 days of DB inactivity — the project start (May 23) to kickoff (June 11) is 19 days; if family is told early then forgets, the project pauses right before opening match. Mitigation: Vercel Cron hitting `/api/heartbeat` (which executes `SELECT 1 FROM fixtures LIMIT 1`) every 3 days. Verify pings hit the DB via Supabase logs — not just the Vercel function.

Additional notable pitfalls covered in [PITFALLS.md](./PITFALLS.md): timezone storage (`timestamptz` only, never `timestamp`), bracket pick rebinding (slot-based, never opponent-based), extra-time/penalty scoring ambiguity (recommend Kicktipp convention: score predictions resolve on 90-min only; bracket cares about advancement), late-entrant policy (recommend "open join, zero past points"), display-name XSS, admin auth gates.

## Implications for Roadmap

The architecture has a clear critical path: **foundation → schema with RLS → game modes → scoring → leaderboard → polish**. The schema-with-RLS phase is the project's beating heart — get it right and the rest is mechanical; get it wrong and every phase compounds the breakage. The roadmap should reflect this.

### Phase 1: Foundation & Bilingual Shell

**Rationale:** Every other feature depends on Next.js + Tailwind + next-intl + Supabase project + Vercel deployment + locale routing being live. Lock in the bilingual primitives (logical-properties lint rule, `<html dir>` switching, default-to-Hebrew browser detection) before any feature component is written — retrofitting RTL late is the single most-cited deadline killer.

**Delivers:** Deployed skeleton at `/he/` and `/en/` with locale toggle and Hebrew default. Supabase project provisioned. CI lint rule banning physical Tailwind utilities. Vercel Cron heartbeat at `/api/heartbeat` already pinging (Pitfall 6 closed before it can fire). `dir` set server-side in layout — no hydration flash.

**Addresses:** Bilingual UI (P1), mobile-responsive shell (P1), deployment infrastructure.

**Avoids:** Pitfall 5 (RTL physical utilities), Pitfall 6 (free-tier pause), hydration-flash UX issue.

### Phase 2: Schema, Auth & RLS (The Heart of the Project)

**Rationale:** This is where the project lives or dies. Schema with `timestamptz`-only, RLS enabled at table-creation time, lock-and-reveal policies referencing `fixtures.kickoff_at <= now()`, invite-code → `signInAnonymously()` → `profiles` flow end-to-end. **Locking and visibility must be DB-enforced from row one** — adding RLS after writes are flowing is how leaks happen. Build the daily integrity query into an admin diagnostic panel from the start.

**Delivers:** Migrations 0001 (tables) + 0002 (RLS policies) + invite-code join flow. End-to-end test: invite-code → profile → predictions table is readable for own rows only, kickoff-locked for writes. Generated TS types via `supabase gen types`. `lib/auth/session.ts` exposing `getCurrentMember()`, `requireMember()`, `requireAdmin()`.

**Uses:** `@supabase/ssr` (`createServerClient`, middleware session refresh), `signInAnonymously()`, Postgres RLS with `(select auth.uid())` pattern.

**Implements:** `tournament`, `profiles`, `teams`, `fixtures` (with `home_placeholder`/`away_placeholder` symbolic refs), `predictions`, `bracket_slots`, `bracket_picks`, `prop_questions`, `prop_answers` tables + all RLS policies.

**Avoids:** Pitfall 1 (UTC/timestamptz), Pitfall 2 (RLS read-leak / CVE-2025-48757), Pitfall 4 (client-side lock), part of Pitfall 7 (late-entrant — schema-side: `profiles.joined_at` exists).

### Phase 3: Fixture Seed + League Mode End-to-End

**Rationale:** League Mode is the highest-volume and highest-risk surface (per-fixture writes from 15 users × 64 matches = 960 prediction rows touched). Once a single fixture's predict→lock→reveal cycle works, the rest of the tournament's writes are the same pattern repeated. The seed must precede this — empty fixtures table = no League Mode.

**Delivers:** Migration 0003 (48 teams + 104 fixtures with bilingual team names + 12 group codes + symbolic placeholders for knockouts). Per-match score-stepper UI (mobile-first, RTL-tested). Server Action `submitPrediction`. Lock state visible in UI (countdown, "locked", "finished" badges). Predictions revealed post-kickoff via RLS, not via app code. Hebrew team-name pass.

**Uses:** RSC + Server Actions, React Hook Form on the multi-fixture matchday form, Zod 4 shared schema.

**Implements:** League Mode end-to-end including hidden-until-lock and lock-at-kickoff semantics.

**Avoids:** Pitfall 4 (lock race conditions verified with two-tab test), UX submission-feedback pitfall.

### Phase 4: Bracket Mode + Props Mode

**Rationale:** Both modes share the same lock + reveal patterns as League Mode (already proven in Phase 3). Bracket is the trickier of the two — needs the slot-based schema decision honored (`bracket_picks` keyed on `slot_id`, never on opponents). Props is the smallest surface and can ship last or even slip past opening match without breaking the pool. **Open question: which bracket-reseeding strategy (Option A/B/C) — recommendation is Option A.**

**Delivers:** Bracket UI (champion + finalists + semis pre-tournament; rest fills as groups complete). Props admin authoring + user answering, props lock at first kickoff. Bracket picks rebind correctly when group stage resolves placeholders.

**Implements:** Bracket Mode (Option A flow), Props Mode.

**Avoids:** Pitfall 8 (bracket pick rebinding — schema choice already made in Phase 2 prevents this), Pitfall 9 (extra-time scoring ambiguity — bracket cares about advancement, league cares about 90-min).

### Phase 5: Scoring Engine + Unified Leaderboard

**Rationale:** Scoring is downstream of all three game modes plus admin result entry. Built as a SQL view over `(predictions, results)` so admin corrections are idempotent (Pitfall 3). Integer-only math throughout (Pitfall 10). Result-entry trigger fires `score_fixture()` + `score_bracket_slot()` + placeholder resolution for downstream knockouts. The leaderboard is `v_leaderboard` selected with `revalidatePath` on result writes — no realtime, no polling beyond focus refresh.

**Delivers:** Migration 0004 (scoring triggers + `v_leaderboard` view). Admin result-entry form with preview ("if you save, X user gains Y points"). Unified leaderboard with per-mode breakdown drill-down. Scoring transparency ("you got 4 = exact" labels). Tiebreaker rules (exact scores → correct results → alphabetical). Per-player breakdown page. Integrity-check admin panel surfacing the daily lock-breach query.

**Implements:** Kicktipp 4/3/2 scoring (League), 2/4/8/16/32 escalating (Bracket), per-question Props scoring.

**Avoids:** Pitfall 3 (non-rerunnable scoring), Pitfall 10 (floating-point math), recovery-cost class of bugs around admin corrections.

### Phase 6: Polish, Admin, Ship Gate

**Rationale:** Final mile. The "looks done but isn't" checklist gates launch — every item must be green before family invite code is distributed. Single trusted family member runs through end-to-end on a real phone in Hebrew before the public link goes out.

**Delivers:** Admin roster + fixture editor pages. Locale toggle with profile-level persistence. Mobile QA pass on real device. Hebrew native-speaker review of all copy and seeded team names. One end-to-end Playwright smoke (`invite → predict → lock → result → leaderboard`). Custom subdomain wired. Family invite code distributed.

**Avoids:** UX pitfalls (submission feedback, countdown TZ confusion, success states), admin-auth gap.

### Phase Ordering Rationale

- **Schema-and-RLS before any feature** is non-negotiable per converging research. Locking and visibility cannot be retrofitted; they are invariants of every read and write.
- **League Mode before Bracket and Props** because it exercises the lock/reveal patterns at the highest volume and surfaces RLS bugs early. Bracket and Props reuse those same patterns with smaller surfaces.
- **Scoring after all three game modes are writing data** because the scoring view depends on real shapes in `predictions`, `bracket_picks`, `prop_answers`. Designing scoring against imagined data is how you ship a leaderboard that doesn't match user expectations.
- **Leaderboard last among features** because it's the smallest code (one view, one page, one drill-down) but the highest-value — shipping it polished is what closes the project. Per PROJECT.md, "if the leaderboard is broken, nothing else matters."
- **Polish/admin in a dedicated final phase** because the admin features (result entry, roster edits) are needed during the tournament, not during build — they can land last without blocking the opening-match deadline.

### Research Flags

Phases likely needing deeper research during planning (`/gsd:research-phase`):

- **Phase 2 (Schema + RLS):** RLS performance patterns at scale are well-documented but the **exact policy syntax for the placeholder-aware fixtures + lock-on-kickoff + late-entrant gate composition** deserves a planning-time spike. Also: confirm whether the scoring trigger should live in PL/pgSQL or be invoked from the result-entry Server Action.
- **Phase 4 (Bracket Mode):** The Option A vs B vs C reseeding strategy is an open product call. Whichever wins, the UI/UX of "pick champion + finalists + final four pre-tournament, fill the rest progressively" needs a sketch before code. Also: should bracket mode be in the June 11 MVP, or shipped before knockouts begin (~late June)? The roadmapper should make this call.
- **Phase 5 (Scoring Engine):** Extra-time / penalty / abandonment scoring rule is technically defaulted to Kicktipp convention (90-min only for league, advancement for bracket) but needs explicit product sign-off. Tiebreaker rule chain also needs confirmation.

Phases with standard patterns (skip research-phase):

- **Phase 1 (Foundation):** `create-next-app` + Tailwind + next-intl is fully documented; no novel research needed.
- **Phase 3 (League Mode):** Once Phase 2's RLS pattern is locked, League Mode is mechanical application of the same patterns to a per-fixture form.
- **Phase 6 (Polish / Ship):** Checklist-driven; the pitfalls research already provides the QA scaffold.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Every recommendation verified against official docs (nextjs.org, supabase.com, tailwindcss.com, zod.dev). Free-tier limits confirmed against current pricing pages. |
| Features | HIGH | Domain is well-trodden; Kicktipp, Superbru, ESPN Bracket Challenge are public and well-documented. Feature scope explicitly negotiated against PROJECT.md Out of Scope. |
| Architecture | HIGH for stack patterns; MEDIUM for the bespoke invite-code identity pattern | RSC + RLS + view-based scoring patterns have first-party docs. Invite-code-without-email is synthesized from Supabase anonymous-auth primitives — pattern is sound but lacks a single canonical recipe. |
| Pitfalls | HIGH | Recent CVE-2025-48757 post-mortems, Supabase 2025/2026 docs, and well-known Tailwind RTL gotchas. Tournament-specific edge cases (extra time, late entrants) are MEDIUM — no single authority, synthesized from pool conventions. |

**Overall confidence:** HIGH

### Gaps to Address

These are genuine open questions that planning must resolve. None are technical unknowns — all are product or judgment calls best made in the roadmap or earliest phase planning, not by researchers.

- **Bracket reseeding strategy (Option A / B / C).** Researchers recommend **Option A** (champion + finalists + final four pre-tournament; earlier rounds fill progressively as groups complete). Final call needed before Phase 4 starts. Affects bracket UI, schema constraints, and copy.
- **Is Bracket Mode in the June 11 MVP, or shipped before late-June knockouts?** Bracket Mode can technically slip past opening match without breaking the pool (knockouts start ~June 27). Roadmapper should decide whether to scope Bracket into the same phase wave as League/Props or split it into a post-launch sprint.
- **Bracket reveal granularity:** one moment at first knockout, or per-stage? Affects RLS policy specifics.
- **Tie-breaker rule chain on the leaderboard.** Recommended: exact scores → correct bracket round picks → alphabetical display name. Confirm before Phase 5.
- **Extra-time / penalty scoring convention.** Recommended: Kicktipp default — score predictions resolve on 90-min result only; bracket advancement is independent. Confirm before Phase 5 and document in PROJECT.md Key Decisions.
- **Late-entrant policy.** Recommended: open join with zero points for already-locked matches; props locked for late joiners (locked at first kickoff anyway); bracket locked for late joiners after knockouts start. Confirm before Phase 2 (it's a schema concern — `profiles.joined_at`).
- **Scoring implementation: PL/pgSQL trigger vs TypeScript-only post-write Server Action.** Architecture researcher proposes mirroring the algorithm in both for testability; pitfalls researcher pushes harder on "all math in SQL." Roadmapper or Phase 5 planner should make the call. View-based aggregation is non-negotiable either way.
- **Hebrew team-name source / native-speaker review pre-launch.** Researchers recommend manual pre-seed of all 48 WC 2026 teams in Hebrew, with a native-speaker pass before June 11. Schedule into Phase 6 (or Phase 3 when seeding fixtures).

## Sources

### Primary (HIGH confidence)

**Stack & framework:**
- [Next.js 15.5 release blog](https://nextjs.org/blog/next-15-5)
- [Supabase Server-Side Auth (Next.js)](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase RLS performance best practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Tailwind CSS v4.3 release](https://tailwindcss.com/blog/tailwindcss-v4-3)
- [next-intl App Router docs](https://next-intl.dev/docs/getting-started/app-router)
- [Supabase pricing](https://supabase.com/pricing) + [Vercel pricing](https://vercel.com/pricing)

**Feature conventions:**
- [Kicktipp scoring rules](https://www.kicktipp.com/info/service/help/222/227)
- [Superbru WC 2026](https://www.superbru.com/worldcup_predictor/)
- [ESPN Knockout Bracket Challenge 2026](https://fantasy.espn.com/games/mens-knockout-bracket-challenge-2026/)
- [2026 FIFA World Cup — Wikipedia](https://en.wikipedia.org/wiki/2026_FIFA_World_Cup)

**Pitfalls & security:**
- [Supabase RLS / CVE-2025-48757 breakdown — VibeAppScanner](https://vibeappscanner.com/supabase-row-level-security)
- [Why Your Supabase Data Is Exposed — DEV Community](https://dev.to/jordan_sterchele/why-your-supabase-data-is-exposed-and-you-dont-know-it-25fh)
- [Tailwind CSS v3.3 logical properties announcement](https://tailwindcss.com/blog/tailwindcss-v3-3)
- [Extra Time Rules For FIFA World Cup 2026](https://club-fifaworldcup.com/extra-time-rules-world-cup/)

### Secondary (MEDIUM confidence)

- [Material Design 3 bidirectionality (RTL)](https://m3.material.io/foundations/layout/understanding-layout/bidirectionality-rtl)
- [Designing a Sports Tournament Data Model — Datensen](https://www.datensen.com/blog/data-model/designing-a-sports-tournament-data-model/)
- [Supabase Pricing real-cost analysis — UI Bakery](https://uibakery.io/blog/supabase-pricing)
- [BettingUSA NFL Pick'em Pools Explained](https://www.bettingusa.com/sports/nfl/pickem-pools/)
- [Score7 multi-stage tournaments guide](https://kb.score7.io/blog/guides/group-stage-to-knockout-how-multi-stage-tournaments-work/)

---
*Research completed: 2026-05-23*
*Ready for roadmap: yes*

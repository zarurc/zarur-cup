# Zarur-Cup / משחקי זערור

## What This Is

A bilingual (Hebrew/English) web platform where the Zarur family runs friendly, no-money World Cup prediction pools. Family members log in with a shared invite code, pick scores for every match, fill out the knockout bracket, and answer tournament-level prop bets — points roll up to one unified leaderboard so we can argue about it at dinner.

Built for **FIFA World Cup 2026**, kickoff **June 11, 2026**.

## Core Value

**Predictions submitted before kickoff get scored automatically against a unified leaderboard that the whole family can see.** If the leaderboard is broken or wrong, nothing else matters.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] Bilingual UI — Hebrew (RTL) + English (LTR), browser-locale detection on first visit, persistent toggle
- [ ] Shared family invite code sign-in — one code, pick a display name, identity persists across sessions
- [ ] **League Mode**: per-match score predictions for every WC 2026 fixture (group + knockout stages)
- [ ] **Bracket View** (read-only): server-rendered tree view of the knockout bracket that fills in live as admin enters results; no user predictions, no scoring
- [ ] **Props/Wildcards** (strictly private): tournament-level bonus questions answered before first kickoff; **each user sees only their own answers at all times — pre-lock editable, post-lock read-only receipt — no cross-user reveal** (per D-38)
- [ ] Kicktipp 4/3/2 scoring — exact score = 4, correct goal difference = 3, correct winner = 2
- [ ] Predictions lock at each match's kickoff time; predictions hidden from other users until lock
- [ ] One unified leaderboard combining League + Bracket + Props points; click a player to see per-mode breakdown
- [ ] Admin dashboard (single admin, just me) — enter match results, manage tournament data, edit user roster
- [ ] Pre-seeded WC 2026 fixture schedule (all 64 matches with dates, teams TBD slots)
- [ ] Deploy to public URL by **June 11, 2026** so family can use it for opening match

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- **Real money / betting** — explicitly a friendly family pool, no payment infrastructure, no gambling-law surface area
- **Public/open signup** — invite-code only, family + close friends, limits abuse and identity friction
- **Multi-tournament support** — built for WC 2026; later tournaments are a future-milestone concern, not v1
- **Multiple admins / role hierarchy** — one trusted operator (me), no permissions matrix needed
- **Native mobile app** — web-only, mobile-responsive is enough for family-on-couch usage
- **Email/password or OAuth login** — invite-code + display name is the explicit identity model; family trust covers anti-cheat
- **Per-round/in-tournament prop bets** — only tournament-level props in v1; locked before first kickoff
- **Configurable scoring rules** — 4/3/2 and bracket escalation are hardcoded for v1; configurability is future work
- **Bracket Mode as a prediction game** — displaced by read-only bracket view in v1 (per Phase 2 D-34, 2026-05-26). The `bracket_picks` table remains in the schema as a harmless empty artifact; no UI surface writes to it.
- **Auto-grade props from public sources** — tournament-level awards (Top Scorer, Golden Boot, Golden Ball) are announced after the final on July 19, 2026; no live data source publishes them in a polling-friendly shape. Admin grades manually via `/admin/props` (~10 minutes for 7 props once the awards are announced) per Phase 2 D-35.

## Context

**The family.** ~5–15 family members, all known to each other. Hebrew is the family spirit language (project name "משחקי זערור"), but the pool includes English speakers, so both languages must feel first-class. Trust model is high — no fraud detection needed.

**Why now.** WC 2026 kicks off June 11, 2026, in the US/Canada/Mexico — about 3 weeks from project start (2026-05-23). That's the immovable deadline. Shipping anything after opening match loses most of the value.

**Why a custom platform.** Existing platforms (Kicktipp, Superbru, etc.) don't do Hebrew RTL well, and the family wants a private, branded place — not a public group on someone else's product.

**Auth design tension to resolve in planning.** "Shared invite code + display name" doesn't map cleanly to Supabase Auth (which expects email-based identity). Planning phase needs to decide: roll our own session/identity on top of Supabase Postgres, use Supabase anonymous auth + invite-code gate, or use a different auth approach entirely. Captured as a Key Decision below (pending).

**Existing prior work.** None — greenfield. No spike, sketch, or codebase to reuse.

## Constraints

- **Timeline**: Must be live and usable by **June 11, 2026** (WC opening match) — non-negotiable. About 3 weeks from project start.
- **Tech stack (recommended)**: Next.js (App Router), Tailwind CSS with RTL support, Supabase (Postgres + Auth), deploy on Vercel. Driven by: family-scale traffic, free tier headroom, fast iteration, RTL-friendly tooling.
- **Bilingual**: Hebrew RTL + English LTR must both render correctly; no second-class language. Locale dictionary architecture must be in place from phase 1.
- **Budget**: Hobby-tier — free hosting (Vercel free, Supabase free) must cover ~15 active users + read-heavy traffic during matches.
- **Identity**: Invite-code based; no per-user email collected by default; family trust covers anti-cheat. Identity must persist across sessions on the same device.
- **Locking**: Match predictions lock at fixture kickoff time (UTC-aware, since family spans timezones); after lock, predictions become visible to all users.

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Target FIFA World Cup 2026, not a generic tournament engine | 3-week deadline; reusability is a v2 concern, not v1 | — Pending |
| Kicktipp 4/3/2 scoring (exact / goal diff / winner) | Familiar to most pool players; recommended default | — Pending |
| Bracket scoring escalates per round (2/4/8/16/32) | Rewards picking the right finalists/champion, not just early-round noise | ❌ Cut — Phase 2 D-34 (2026-05-26): displaced by read-only bracket view; no bracket prediction game ships |
| Predictions hidden until kickoff | Prevents info-stealing/copying; standard pool ethics | — Pending |
| Shared family invite code + display name (no email auth) | Lowest friction for ~15-person family pool; trust covers anti-cheat | — Pending |
| Browser-detect default locale, fall back to Hebrew | Hebrew is the project's spirit; English speakers still get instant familiarity | — Pending |
| Admin enters fixtures + results manually (pre-seed the WC 2026 schedule once) | Avoids external sports-API dependency and rate limits; one trusted operator | 🔶 Partial — Phase 2 D-36 (2026-05-26): auto-fetch from football-data.org v4 added for in-tournament score ingestion; admin manual entry at /admin/matches remains the canonical fallback and override path |
| One unified leaderboard with per-mode breakdown on click | Single source of family rivalry; breakdown rewards curiosity without fragmenting the standings | — Pending |
| Auth implementation strategy (custom-on-Supabase vs anonymous + invite gate vs other) | Invite-code model doesn't map directly to Supabase Auth — needs deliberate design call in planning | — Pending |
| Props strictly private — no cross-user reveal ever | Family-trust posture is mutual interest in own picks; rivalry visible only through leaderboard points totals | ✅ Locked — Phase 2 D-38 (2026-05-26) |
| External sports API integration permitted for match-score auto-fetch only | Removes 104×manual-entry chore over 30-day tournament; admin override always available | ✅ Locked — Phase 2 D-36 (2026-05-26): football-data.org v4 selected per D-46; Supabase pg_cron + pg_net (per D-45) bypasses Vercel Hobby's once-per-day cron cap |
| Read-only bracket view replaces Bracket Mode prediction game | Lower scope, immediate value (family sees tree fill during knockouts), zero scoring fragility | ✅ Locked — Phase 2 D-40 + D-47 (2026-05-26): column-of-rounds RSC at `/[locale]/bracket`; live-fills via revalidatePath from saveResult |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-26 after Phase 2 scope expansion (D-34..D-47)*

---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Ready to execute
last_updated: "2026-05-23T21:02:44.659Z"
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 5
  completed_plans: 1
  percent: 20
---

# STATE: Zarur-Cup / משחקי זערור

**Last updated:** 2026-05-23 (Phase 1 planned — 5 plans across 4 waves)

## Project Reference

**Name:** Zarur-Cup / משחקי זערור (project code: **ZC**)
**Core value:** Predictions submitted before kickoff get scored automatically against a unified leaderboard that the whole family can see. If the leaderboard is broken, nothing else matters.
**Hard deadline:** June 11, 2026 (WC 2026 opening match) — Phases 1 + 2
**Soft deadline:** June 27, 2026 (first knockout match) — Phase 3
**Current focus:** Phase 01 — foundation-schema-auth-rls

## Current Position

Phase: 01 (foundation-schema-auth-rls) — EXECUTING
Plan: 2 of 5
| Field | Value |
|-------|-------|
| Phase | 1 (Foundation, Schema, Auth & RLS) — planned |
| Plan | 5 plans (01-01 → 01-05) across 4 waves |
| Status | Executing — Plan 01-01 complete, Wave 2 next |
| Progress | `[██░░░░░░░░] 20%` (1 / 5 Phase 1 plans complete; 0 / 3 phases complete) |
| Last action | Plan 01-01 (bootstrap) shipped — Next 15.5.18 + next-intl v4 + Supabase clients + Tailwind v4.3 design tokens. RTL/LTR visually verified. 6 deviations captured (see Phase 1 Execution Decisions below). |

## Roadmap Snapshot

- [ ] **Phase 1: Foundation, Schema, Auth & RLS** — 26 requirements — target ~June 1
- [ ] **Phase 2: June 11 MVP — League + Props + Scoring + Leaderboard + Admin + Ship Gate** — 34 requirements — target **June 11 (hard)**
- [ ] **Phase 3: Bracket Mode (Pre-Knockout Ship)** — 6 requirements — target **June 27 (soft)**

## Performance Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Days to hard deadline | 19 (May 23 → June 11) | Phases 1 + 2 must land by then |
| Days to soft deadline | 35 (May 23 → June 27) | Phase 3 has the buffer |
| Coverage | 66 / 66 v1 requirements (100%) | No orphans |
| Phases planned | 1 / 3 | Phase 2 next |
| Plans complete | 1 / 5 in Phase 1 | 01-01 (bootstrap) shipped 2026-05-23 |

## Accumulated Context

### Key Decisions (mirrored from PROJECT.md + made during roadmapping)

| Decision | Source | Status |
|----------|--------|--------|
| Target FIFA WC 2026 only (no generic tournament engine) | PROJECT.md | Pending validation |
| Kicktipp 4/3/2 scoring (exact / goal-diff / winner) | PROJECT.md | Pending |
| Bracket scoring escalates 2/4/8/16/32 | PROJECT.md | Pending |
| Predictions hidden until kickoff | PROJECT.md | Pending |
| Shared family invite code + display name (no email) | PROJECT.md | Pending |
| Browser-detect default locale, fall back to Hebrew | PROJECT.md | Pending |
| Admin enters fixtures + results manually | PROJECT.md | Pending |
| One unified leaderboard with per-mode breakdown on click | PROJECT.md | Pending |
| Auth: `signInAnonymously()` + invite-code → profiles gate | Research (HIGH confidence) | Pending — confirm in Phase 1 |
| RLS as the only enforcer for lock + visibility (not app code) | Research (HIGH confidence) | Pending — confirm in Phase 1 |
| Scoring as a SQL view over `score_events`; admin corrections idempotent | Research (HIGH confidence) | Pending — confirm in Phase 2 |
| **Bracket Mode ships in Phase 3 (June 27 soft deadline), NOT in June 11 MVP** | Roadmapper decision (this doc) | Active |
| Bracket reseeding strategy: Option A (slot-based, picks survive placeholder resolution) | Research recommendation | Pending — confirm in Phase 3 |
| Extra-time / penalty scoring: Kicktipp convention (90-min for League, advancement for Bracket) | Research recommendation | Pending — confirm in Phase 2 |
| Late-entrant policy: open join, zero past points | Research recommendation | Pending — confirm in Phase 1 schema |
| Tiebreaker chain: total → exact scores → correct results → alphabetical | LB-04 + research | Pending — confirm in Phase 2 |

### Open Questions (carried forward; must be resolved before relevant phase plan)

- **Phase 1 / Phase 2 boundary:** Scoring trigger in PL/pgSQL vs Server Action — research split between architecture researcher ("mirror in both") and pitfalls researcher ("all math in SQL"). Resolve in Phase 2 planning. View-based aggregation is non-negotiable either way.
- **Phase 3:** Bracket reveal granularity — single moment at first knockout vs per-stage reveal. Affects RLS policy specifics (BRK-03, VIS-03). Resolve in Phase 3 planning.
- **Phase 1:** Hebrew native-speaker reviewer identified and scheduled? DATA-04 happens inside Phase 1 per CONTEXT.md D-22 (gates the seed sign-off). QA-03 (full copy review) is Phase 2/6.

### Phase 1 Decisions Locked (2026-05-23 via gsd-discuss-phase)

| Decision | Source | Notes |
|----------|--------|-------|
| Invite code = single env var (`INVITE_CODE`); no Turnstile/IP-cap in v1 | CONTEXT.md D-01..D-03 | AUTH-07 reinterpreted as satisfied by Supabase's 30/hr/IP built-in |
| Admin bootstrap via `ADMIN_DISPLAY_NAME` env var match on join | CONTEXT.md D-04 | Mitigation: zekez joins first |
| Admin routes unlocalized at `/admin/...` (no `[locale]` segment) | CONTEXT.md D-05 | Deliberate deviation from AUTH-06 literal wording |
| Display name: 2–24 chars; HE+Latin+digits+spaces; case-insensitive + trim + NFC unique | CONTEXT.md D-07..D-10 | Inline-error UX on conflict |
| Late-entrant: open join, zero past points; `profiles.joined_at` | CONTEXT.md D-11..D-12 | Closes STATE.md open question |
| Visual: "Modern sports clean"; text wordmark; Heebo + Inter; bottom-tab-bar nav | CONTEXT.md D-13..D-17 | Hex/accent picked by UI-phase agent |
| Heartbeat: public route, Vercel Cron every 3 days, real `SELECT FROM fixtures` | CONTEXT.md D-18 | FND-05 |
| All schema + RLS in Phase 1; `timestamptz` only; `(select auth.uid())` pattern | CONTEXT.md D-19..D-22 | DATA-04 (Hebrew team-name review) inside Phase 1 |

### Phase 1 Execution Decisions (2026-05-23, Plan 01-01 deviations)

| Decision | Rule | Source | Notes |
|----------|------|--------|-------|
| Pin `next@15.5.18` and `eslint-config-next@15.5.18` (NOT 16.x) | Rule 3 (blocking) | create-next-app defaulted to Next 16.2.6 | CLAUDE.md mandates 15.5 LTS through Oct 2026; also patches CVE-2025-66478 |
| Middleware lives at `src/middleware.ts` (NOT project root) | Rule 3 (blocking) | Next 15 + `--src-dir` flag | Build does not pick up root-level middleware when src/ is the source root |
| Canonical root layout is `[locale]/layout.tsx` (NO outer `app/layout.tsx`) | Rule 3 (blocking) | next-intl v4 + Next 15.5 | Two `<html>`s otherwise; `import './globals.css'` moved into `[locale]/layout.tsx` |
| Tailwind v4.3 `@utility` shorthand aliases in globals.css (`bs-*`, `is-*`, `mi-*`, `pi-*`, `inset-i-*`, `min-bs-*`, `max-is-*`) | Rule 3 (blocking) | v4.3 ships canonical pbs-/mbs-/ps-/etc. but not these aliases | Later plans MUST use canonical Tailwind logical-property utilities OR these aliases; FND-03 lint catches physical-direction |
| ESLint flat config via `@eslint/eslintrc` FlatCompat | Rule 3 (blocking) | eslint-config-next@15.5 ships as legacy extends-style | Added `@eslint/eslintrc` devDep |
| Explicit `CookieOptions` types in `src/lib/supabase/{server,middleware}.ts` | Rule 1 (bug) | Strict tsconfig flagged implicit-any | Imported from `@supabase/ssr` |

### Todos (deferred to phase planning)

(None yet — all surfaced during roadmapping have been folded into phase Success Criteria or Open Questions above.)

### Blockers

(None yet.)

## Session Continuity

**For the next session / next agent invocation:**

- Phase 1 plans are final and verified: 5 plans, 4 waves, all 26 phase REQ-IDs covered, all 22 CONTEXT decisions referenced.
- **Plan 01-01 shipped 2026-05-23** — Next.js 15.5.18 shell, next-intl he/en routing, Supabase clients, Tailwind v4.3 design tokens. RTL/LTR visually verified.
- **Next: Wave 2 — Plan 01-02 (schema + RLS + [BLOCKING] db push)**. Consumes the linked Supabase project + server client from Plan 01-01.
- Wave structure: W1 (Plan 01 bootstrap ✓) → W2 (Plan 02 schema+RLS+`[BLOCKING] db push`) → W3 (Plans 03+04 in parallel — seed+Hebrew review by zekez, auth+UI shell) → W4 (Plan 05 heartbeat+deploy+CI).
- Human checkpoints in Phase 1 (autonomous:false tasks): (a) Supabase project provisioning, (b) schema db push, (c) seed db push + Hebrew team-name review (zekez), (d) join/session/admin UX verify, (e) Vercel deploy + Cron verification.
- After Phase 1 lands, Phase 2 has 10 working days to June 11. Plan-phase for Phase 2 should prioritize the critical path (League predictions → admin result → scoring view → leaderboard) over polish.
- Bracket Mode deferral to Phase 3 stays in ROADMAP.md; do not silently merge it into Phase 2 during planning.

## File Reference

- `/Users/zekez/Documents/Claude OS/zarur-cup/.planning/PROJECT.md` — vision, core value, constraints, key decisions
- `/Users/zekez/Documents/Claude OS/zarur-cup/.planning/REQUIREMENTS.md` — 66 v1 requirements + v2 + out-of-scope + traceability table
- `/Users/zekez/Documents/Claude OS/zarur-cup/.planning/ROADMAP.md` — phase structure + success criteria + coverage audit
- `/Users/zekez/Documents/Claude OS/zarur-cup/.planning/research/SUMMARY.md` — research synthesis (HIGH confidence on stack)
- `/Users/zekez/Documents/Claude OS/zarur-cup/.planning/research/STACK.md` / `FEATURES.md` / `ARCHITECTURE.md` / `PITFALLS.md` — research detail
- `/Users/zekez/Documents/Claude OS/zarur-cup/.planning/config.json` — granularity=coarse, mode=yolo, parallelization=true

---
*State initialized by gsd-roadmapper: 2026-05-23*

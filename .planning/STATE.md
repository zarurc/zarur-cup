---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Ready to execute
last_updated: "2026-05-23T22:34:54.958Z"
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 5
  completed_plans: 3
  percent: 60
---

# STATE: Zarur-Cup / משחקי זערור

**Last updated:** 2026-05-23 (Plan 01-03 shipped — WC 2026 seed live on tjivukpxuhbrbshidbfv; DATA-04 signed off by zekez)

## Project Reference

**Name:** Zarur-Cup / משחקי זערור (project code: **ZC**)
**Core value:** Predictions submitted before kickoff get scored automatically against a unified leaderboard that the whole family can see. If the leaderboard is broken, nothing else matters.
**Hard deadline:** June 11, 2026 (WC 2026 opening match) — Phases 1 + 2
**Soft deadline:** June 27, 2026 (first knockout match) — Phase 3
**Current focus:** Phase 01 — foundation-schema-auth-rls

## Current Position

Phase: 01 (foundation-schema-auth-rls) — EXECUTING
Plan: 4 of 5
| Field | Value |
|-------|-------|
| Phase | 1 (Foundation, Schema, Auth & RLS) — planned |
| Plan | 5 plans (01-01 → 01-05) across 4 waves |
| Status | Executing — Plans 01-01 + 01-02 + 01-03 complete; Wave 3 partial (01-04 auth/UI next, then Wave 4 / 01-05 heartbeat+deploy) |
| Progress | `[██████░░░░] 60%` (3 / 5 Phase 1 plans complete; 0 / 3 phases complete) |
| Last action | Plan 01-03 (WC 2026 seed) shipped — 1 tournament + 48 teams (bilingual, Dec 2025 Final Draw) + 104 fixtures (UTC kickoffs, symbolic KO placeholders) + 32 bracket_slots (non-sequential FIFA R32->R16 wiring) + 7 prop_questions live on tjivukpxuhbrbshidbfv. 6 deviations: filename slot 0003->0005 (Rule 3), full reseed via 0006_reseed_wc2026.sql after pre-draw projection caught (Rule 3), bracket parent wiring sequential->FIFA non-sequential (Rule 1), tournament.starts_at 20:00->19:00 UTC (Rule 2), build-script gained --target/--reseed flags (note), reseed pattern formalized (note). DATA-04: zekez approved all 48 Hebrew team names 2026-05-23. |

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
| Plans complete | 3 / 5 in Phase 1 | 01-01 (bootstrap) + 01-02 (schema+RLS) + 01-03 (WC 2026 seed, DATA-04 signed off by zekez) shipped 2026-05-23 |
| Phase 01 P03 | 62min, 4 tasks, 8 files | Seed migration 0005 + corrective reseed 0006; live counts 1/48/104/32/7 verified |

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

### Phase 1 Execution Decisions (2026-05-23, Plan 01-02 deviations)

| Decision | Rule | Source | Notes |
|----------|------|--------|-------|
| Added 0003_grants.sql -- table-level GRANTs for service_role + authenticated | Rule 2 (missing critical) | Project provisioned with `Automatically expose new tables: OFF`; default-grants event trigger did NOT fire | Without GRANTs, RLS is unreachable. Migrations are append-only -- never edit a pushed migration. |
| Added 0004_anon_select.sql -- GRANT SELECT to anon on every Phase-1 table | Rule 1 (bug) | After 0003, anon got `42501 permission denied`; plan's must_haves require anon to see `[]` not an error | Plan contract = `RLS is the only enforcer for lock-on-kickoff`; requires permissive anon SELECT so RLS is the visible lock. Inverts the 0003 anon-zero-DML smoke. |
| Pattern: Supabase migrations are append-only -- never edit a pushed migration, always add a new sequential one | Pattern (new) | Deviation handling for 0003 and 0004 | Future plans MUST follow this. Editing committed migrations diverges local from remote silently. |
| Pattern: When project security settings deviate from Supabase defaults, migrations MUST encode the GRANTs explicitly | Pattern (new) | `Automatically expose new tables: OFF` bit our migration set | Never assume default event triggers fired. |
| Pattern: Every security-relevant invariant gets a migration-time DO-block smoke (RLS enabled, B1 column grant, anon-no-writes, anon-SELECT-on-all-tables) | Pattern (new) | Defense in depth for Phase 1 schema lock | Loud failure at `db push` time, never silent regression. |

### Phase 1 Execution Decisions (2026-05-23, Plan 01-03 deviations)

| Decision | Rule | Source | Notes |
|----------|------|--------|-------|
| Migration filename shifted 0003 -> 0005 | Rule 3 (blocking) | Plan 01-02 shipped 4 migrations instead of 2 (0003_grants + 0004_anon_select added) -- slot 0003 was taken | Append-only convention preserved. |
| Full reseed via 0006_reseed_wc2026.sql (FK-safe DELETE + re-INSERT) | Rule 3 (blocking) | Initial CSV used research file's pre-draw projected groups; zekez caught error post-push | Migration history append-only. 0005 stays in repo + Supabase migration table as historical pre-draw record. 0006 is the source-of-truth state on live. |
| Bracket parent_slot_id wiring corrected sequential -> FIFA non-sequential | Rule 1 (bug) | Original bracket_slots.csv had naive R16_M1 = R32_M1_W vs R32_M2_W; real FIFA bracket pairs non-sequentially (R16_M1 = R32_M2_W vs R32_M5_W) | Slot codes unchanged; only parent_slot_code values changed. |
| tournament.starts_at corrected 20:00:00Z -> 19:00:00Z | Rule 2 (missing critical) | Estadio Azteca 1pm local Mexico City (UTC-6) = 19:00 UTC, not 20:00 UTC | Canonical lock anchor for prop_answers RLS reveal; 1-hour drift would have shifted reveal timing. |
| Build script gained --target <path> and --reseed flags | Note (pattern) | Needed to emit corrective migration without disturbing canonical `npm run seed:build` ON CONFLICT path | --reseed prepends FK-safe DELETE block; default path unchanged. |
| Pattern: Canonical reseed shape -- UPSERT tournament, DELETE children FK-safe (predictions->fixtures->bracket_slots->teams) scoped to tournament_id, ON CONFLICT INSERT from CSVs | Pattern (new) | Reusable for any future tournament correction or new tournament onboarding | Established in 0006_reseed_wc2026.sql; documented in 01-03-SUMMARY.md Pattern 11. |
| Pattern: CSVs (data/<tournament>/*.csv) are source of truth; SQL migrations are GENERATED, never hand-edited | Pattern (new) | scripts/build-seed-sql.ts is the only writer of seed SQL | Edit CSV + rebuild + add new migration; never edit a pushed migration. |
| DATA-04 sign-off: zekez approved all 48 name_he + 12 group assignments on 2026-05-23 | Gate cleared | CONTEXT.md D-22 designates zekez as the Hebrew reviewer | No corrections requested. |

### Todos (deferred to phase planning)

(None yet — all surfaced during roadmapping have been folded into phase Success Criteria or Open Questions above.)

### Blockers

(None yet.)

## Session Continuity

**For the next session / next agent invocation:**

- Phase 1 plans are final and verified: 5 plans, 4 waves, all 26 phase REQ-IDs covered, all 22 CONTEXT decisions referenced.
- **Plan 01-01 shipped 2026-05-23** — Next.js 15.5.18 shell, next-intl he/en routing, Supabase clients, Tailwind v4.3 design tokens. RTL/LTR visually verified.
- **Plan 01-02 shipped 2026-05-23** — 4 migrations on live project tjivukpxuhbrbshidbfv: 9 tables (all RLS-enabled), lock-and-reveal policies for predictions/prop_answers, B1 column grant on profiles (UPDATE = display_name + locale only), anon SELECT on all 9 tables so RLS is the visible lock. `bash scripts/verify-rls-no-leak.sh` confirms ALL 9 TABLES PASS (anon=[]). 2 deviations captured.
- **Plan 01-03 shipped 2026-05-23** — WC 2026 seed live on tjivukpxuhbrbshidbfv: 1 tournament + 48 teams (bilingual, Dec 2025 Final Draw) + 104 fixtures (UTC kickoffs + symbolic KO placeholders) + 32 bracket_slots (R32->CHAMPION, FIFA non-sequential R32->R16 wiring) + 7 prop_questions. Live counts verified via SELECT count(*). DATA-04 gate cleared: zekez approved all 48 Hebrew team names + group assignments 2026-05-23. 6 deviations captured (filename 0003->0005, full reseed via 0006 after pre-draw projection caught, bracket parent wiring corrected, tournament.starts_at 20:00->19:00 UTC, build-script --target/--reseed flags, canonical reseed pattern). CSVs (`data/wc2026/*.csv`) are source of truth; SQL is generated by `scripts/build-seed-sql.ts`.
- **Next: Plan 01-04 (auth + UI shell)**. Wave 3 plan 01-03 is done; the parallel partner 01-04 (auth flow + bilingual UI shell + admin gate) can proceed -- tournament row + teams + fixtures + props are all visible to authenticated users via RLS. After 01-04: Wave 4 / Plan 01-05 (heartbeat + Vercel deploy + Cron + CI).
- Wave structure: W1 (Plan 01 bootstrap ✓) → W2 (Plan 02 schema+RLS+db push ✓) → W3 (Plans 03+04 in parallel — seed+Hebrew review by zekez, auth+UI shell) → W4 (Plan 05 heartbeat+deploy+CI).
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

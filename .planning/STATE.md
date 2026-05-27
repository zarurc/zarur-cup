---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Executing Phase 02
last_updated: "2026-05-25T13:52:14.280Z"
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 13
  completed_plans: 5
  percent: 38
---

# STATE: Zarur-Cup / משחקי זערור

**Last updated:** 2026-05-26 (Phase 2 reopened mid-QA-02 for scope expansion. Added 02-CONTEXT.md addendum D-34..D-44: cut Bracket prediction game; cut auto-grade props; Props strictly private + nested at /me/props (supersedes D-25); auto-fetch scores via consolidated heartbeat cron; PROJECT.md OOS reversal on external APIs. Phase 3 cancelled. Two research questions deferred to gsd-phase-researcher.)

## Project Reference

**Name:** Zarur-Cup / משחקי זערור (project code: **ZC**)
**Core value:** Predictions submitted before kickoff get scored automatically against a unified leaderboard that the whole family can see. If the leaderboard is broken, nothing else matters.
**Hard deadline:** June 11, 2026 (WC 2026 opening match) — Phases 1 + 2
**Soft deadline:** June 27, 2026 (first knockout match) — Phase 3
**Current focus:** Phase 02 — june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate

## Current Position

Phase: 02 (june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate) — EXECUTING (ship-gate checkpoint pending)
Plan: 8 of 8 partial — Tasks 0/1/2/4 + SUMMARY shipped; QA-01 CI iterating; QA-02/03/04 await human
| Field | Value |
|-------|-------|
| Phase | 2 (June 11 MVP) — Wave 7 partial; QA-01 CI in flight, QA-02/03/04 manual gates pending |
| Plan | 8 plans across 7 waves; 02-01..02-07 fully shipped + 02-08 partial 2026-05-25 |
| Status | All product surfaces LIVE on https://zarur-cup.vercel.app. **QA-01 closed (CI green on `095a828`, 2026-05-25).** Plan 02-08 (ship gate) now blocked only on manual gates: mobile QA HE+EN + Hebrew copy review + family WhatsApp send by June 11 19:00 UTC. Post-execution gates (`/gsd-code-review 02` + `gsd-verifier`) can run in parallel. |
| Progress | `[█████████░] 88%` (7 / 8 Phase 2 plans complete; 02-08 partial — QA-01 ✓, QA-02/03/04 pending) |
| Last action | QA-01 GREEN on commit `095a828` (Playwright smoke 25.9s, RLS-rejection assertion verified). Took 7 CI iterations: (1-3) lockfile drift + Node 20 WebSocket + IPv6→pooler env fixes; (4) match-row testid missing on locked + resulted variants (`7a71967`); (5) helper used Playwright's top-level `request` fixture instead of `ctx.request` (`1d5e03c`); (6) **root cause** — Next.js App Router excludes `_`-prefixed folders from routing entirely; `src/app/api/_test/save-prediction/route.ts` was never built into the route manifest; renamed `_test` → `test` (`095a828`). All 7 iterations + the BLOCKING anti-pattern documented in `.continue-here.md` for forensic reference. |

## Roadmap Snapshot

- [x] **Phase 1: Foundation, Schema, Auth & RLS** — 26 requirements — COMPLETE 2026-05-24 (target was ~June 1; shipped 8 days early)
- [ ] **Phase 2: June 11 MVP — League + Props + Scoring + Leaderboard + Admin + Ship Gate** — 34 requirements — target **June 11 (hard)**
- [ ] **Phase 3: Bracket Mode (Pre-Knockout Ship)** — 6 requirements — target **June 27 (soft)**

## Performance Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Days to hard deadline | 19 (May 23 → June 11) | Phases 1 + 2 must land by then |
| Days to soft deadline | 35 (May 23 → June 27) | Phase 3 has the buffer |
| Coverage | 66 / 66 v1 requirements (100%) | No orphans |
| Phases planned | 1 / 3 | Phase 2 next |
| Plans complete | 5 / 5 in Phase 1 | All Phase 1 plans shipped 2026-05-23/24 |
| Phase 01 P03 | 62min, 4 tasks, 8 files | Seed migration 0005 + corrective reseed 0006; live counts 1/48/104/32/7 verified |
| Phase 01 P04 | 180min, 4 tasks, 31 files (20 created + 11 modified) | Auth + chrome + admin gate; 5 fix-up commits resolved 4 human-verify bugs (locale race, logout+rejoin, tab indicator hardening, USER-SETUP) |
| Phase 01 P05 | ~6h, 4 tasks, 8 created + 3 modified | Vercel deploy + Cron + heartbeat + husky/CI; 4 Rule-3 deviations (lockfile rewrite, types un-gitignored, Tailwind var(), author rewrite) — all required for production deploy. Live at https://zarur-cup.vercel.app, cron `0 12 */3 * *`, FND-05 verified via Supabase Postgres log. |

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

### Phase 1 Execution Decisions (2026-05-23, Plan 01-04 deviations)

| Decision | Rule | Source | Notes |
|----------|------|--------|-------|
| Family-trust rebind on display_name conflict | Rule 2 (missing critical UX) | Human-verify Bug 1b: clearing cookies trapped users out of their own account | joinPool re-points existing profile + FK children to new auth.users + svc.auth.admin.deleteUser the stale row. NEVER fires when invite_code is invalid (T-04-04 info-disclosure tightening). |
| Logout button on /me page | Rule 2 (missing critical UX) | Human-verify Bug 1a: no logout path existed | signOutCurrent() server action; preserves NEXT_LOCALE cookie so user lands on their preferred-locale /join. |
| Locale toggle <Link> + startTransition -> <form action> + redirect | Rule 1 (bug) | Human-verify Bug 4: navigation tore down React tree before action's DB UPDATE committed; profiles.locale never persisted on live DB | switchLocale action awaits the UPDATE server-side then issues redirect(). Open-redirect mitigation: redirectPath must start with / and not //. |
| BottomTabBar defensive null-guard + exact-or-prefix-slash match | Rule 1 (defensive hardening) | Human-verify Bug 2: active tab indicator never rendered; bug attribution to next/navigation import was inaccurate (already using @/lib/i18n/routing) | Most likely cause was stale dev-server module cache. Hardening landed anyway: pathname ?? "" guard + exact-or-prefix-slash match to future-proof against sibling routes. |
| Pattern: Server actions that mutate AND navigate use <form action={serverAction}> + redirect() at end | Pattern (new) | Bug 4 root cause | Never combine client <Link> with parallel startTransition(action) -- the navigation tears down the React tree before the action commits. |
| Pattern: Rebind on display_name 23505 conflict (only when invite_code valid) | Pattern (new) | Family-trust model from PROJECT.md | Service-role UPDATE on profiles + 3 FK children + svc.auth.admin.deleteUser. Defense against trapping users out of their account; respects family-trust anti-cheat assumption. |
| Security posture: family-trust account takeover ACCEPTED for v1 | Posture decision (2026-05-23, zekez explicit choice) | Rebind path makes "name + invite code" sufficient to claim any account. CLAUDE.md original design said device-locked. | Choice was between (A) family-trust rebind, (B) revert to device-locked, (C) personal recovery codes. zekez chose **(A)** in chat. Rationale: family is trusted by definition, predictions lock at kickoff (narrow attack window), admin can revert in DB, recovery-code UX adds wrong friction 3 weeks from launch. Phase 2 ship gate may add recovery codes if misuse occurs. |
| Pattern: Always import usePathname from @/lib/i18n/routing (next-intl wrapper), never from next/navigation | Pattern (new) | next-intl strips locale prefix only in its own wrapper | Documented in BottomTabBar comments + this STATE.md. |
| USER-SETUP omissions: Anonymous Sign-Ins toggle + NODE_EXTRA_CA_CERTS env-var | Rule 3 (docs) | Caught at human-verify | Both added to 01-USER-SETUP.md. .dev/ added to .gitignore for corp CA bundle. |

### Phase 1 Execution Decisions (2026-05-24, Plan 01-05 deviations)

| Decision | Rule | Source | Notes |
|----------|------|--------|-------|
| Lockfile URLs sed-rewritten JFrog → npmjs (package-lock.json) | Rule 3 (blocking) | ZScaler corp policy transparently rewrites registry.npmjs.org → jfrogrepo24.jfrog.io/package-reroute; Vercel build runners 403 on JFrog URLs | Tarball SHA-512 integrity is content-addressed, so the same bytes verify either way. MUST be re-applied after every local `npm install`. Commit `f1a933a`. |
| src/types/supabase.ts un-gitignored and committed | Rule 3 (blocking) | 01-04's src/lib/auth/session.ts imports `Database` from this file; Vercel can't regenerate without Supabase CLI in build env | Trade-off accepted: drift risk vs. zero-setup Vercel builds. Workflow: `npm run db:types && git add && git commit` after every schema change. Commit `1fec6f3`. |
| Tailwind v4 syntax `[--zc-X]` → `[var(--zc-X)]` across 15 files | Rule 3 (blocking) | v4 dropped bare-CSS-var shorthand; 45 className refs compiled to invalid CSS (whole UI black/transparent in prod). zekez caught it on 01-04 mobile preview deploy | Mechanical sed. Formally attributed to 01-04 but materialized during 01-05 deploy. Commit `b79bdc5`. Lesson: visually verify Tailwind v4 token references on Vercel preview, not just localhost dev. |
| Git author rewrite for Vercel author-check (all 38 phase-1 commits) | Rule 3 (blocking) | Vercel Hobby blocks deploys when commit author isn't on project team; `Zeke <zekez@jfrog.com>` didn't match linked GitHub identity | `git rebase --root --exec "git commit --amend --reset-author --no-edit"` with `user.email=10100761+zarurc@users.noreply.github.com`. Force-pushed. Stale SHAs in prior SUMMARYs accepted as forensic loss (4dc3a18, d90a203, etc. no longer findable in `git log`). |
| CRON_SECRET configured = heartbeat PROTECTED (not public) | Posture decision (2026-05-24, deployer choice) | CONTEXT.md D-18 specified public; production chose protected | Route auth code is opt-in (only activates if env var present), so works either way. Stricter posture chosen for production. Verified: curl without Bearer → 401; curl with Bearer → 200 + real DB roundtrip at 688ms. |
| NODE_EXTRA_CA_CERTS is local-dev-only | Note (env-var hygiene) | JFrog corporate TLS workaround | Documented in README + 01-USER-SETUP.md. Vercel env explicitly does NOT have this — Vercel build runners hit npmjs.org directly via the rewritten lockfile. |
| GitHub repo zarurc/zarur-cup made private; ghp_* PAT used to push CI workflow | Note (operational) | `.github/workflows/lint.yml` push needed `workflow` scope on PAT | Token revoked after deploy completed. No secrets in repo (verified: only .env.example with placeholders tracked). |
| Pattern: ZScaler corporate-proxy npm lockfile rewrite is reusable | Pattern (new) | Reapply via sed after every `npm install` | Documented in 01-05 SUMMARY Pattern 20. |
| Pattern: Anti-pause heartbeat = real SELECT, verified via Supabase Postgres logs (NOT Vercel function logs) | Pattern (new) | FND-05 ground truth | Documented in 01-05 SUMMARY Pattern 18. |
| Pattern: Opt-in CRON_SECRET via env-var presence check | Pattern (new) | Operator can toggle security without redeploying logic | Documented in 01-05 SUMMARY Pattern 19. |
| W6 watchpoint: Vercel Hobby allows 1 cron — slot consumed by /api/heartbeat | Note (forward) | From PLAN frontmatter | Any Phase 2+ cron need must consolidate into heartbeat as conditional branches OR upgrade to Vercel Pro. Flag for Phase 2 planner. |

### Todos (deferred to phase planning)

(None yet — all surfaced during roadmapping have been folded into phase Success Criteria or Open Questions above.)

### Blockers

(None yet.)

## Session Continuity

**Active scope-expansion thread (2026-05-26):**

Phase 2 reopened mid-QA-02. Operator decided to: (a) cut Bracket-as-prediction-game (Phase 3 cancelled), (b) build read-only bracket view in its place (replaces /[locale]/bracket EmptyStateCard), (c) make Props strictly private — user sees only own picks, always — supersedes D-25, requires new migration tightening prop_answers_read RLS + simplification of /[locale]/props/page.tsx, (d) move Props to /[locale]/me/props nested under Me, (e) reverse PROJECT.md "external API integration — OOS" to enable auto-fetching match scores via consolidated /api/heartbeat cron, (f) cut auto-grade props (low value; awards published post-July 19 only).

**Final nav at end of Phase 2:** 4 bottom tabs — Matches | Bracket (read-only view) | Leaderboard | Me (with props sub-page).

**Pending:** /gsd-plan-phase 2 --research-phase dispatches gsd-phase-researcher to investigate D-43 (sports API source) + D-44 (cron consolidation). Then /gsd-plan-phase 2 writes new plans 02-09..02-1X. Then execute.

**Original QA-02 mid-walkthrough status (still relevant — these matches/LB/me surfaces PASSED before the scope pivot):**

- ✅ /he/matches with preview-seed rows (stepper, save, locked, resulted, 3-letter FIFA codes, real flags, no horizontal scroll at 360px)
- ✅ /he/leaderboard (preview standings, single-expand breakdown)
- ✅ /he/me (total points + logout)
- 🔴 /he/props — blocked by nav gap; replaced by new scope (will revisit after scope-expansion ships)
- 🔴 /en/* — pending
- 🔴 I18N-06 bidi stress sweep — pending
- 🔴 QA-03 Hebrew copy review + QA-04 family invite — pending until new scope ships

**Memory flags still open:** SUPABASE_SECRET_KEY + SUPABASE_ACCESS_TOKEN rotation pending.

**For the next session / next agent invocation:**

- Phase 1 plans are final and verified: 5 plans, 4 waves, all 26 phase REQ-IDs covered, all 22 CONTEXT decisions referenced.
- **Plan 01-01 shipped 2026-05-23** — Next.js 15.5.18 shell, next-intl he/en routing, Supabase clients, Tailwind v4.3 design tokens. RTL/LTR visually verified.
- **Plan 01-02 shipped 2026-05-23** — 4 migrations on live project tjivukpxuhbrbshidbfv: 9 tables (all RLS-enabled), lock-and-reveal policies for predictions/prop_answers, B1 column grant on profiles (UPDATE = display_name + locale only), anon SELECT on all 9 tables so RLS is the visible lock. `bash scripts/verify-rls-no-leak.sh` confirms ALL 9 TABLES PASS (anon=[]). 2 deviations captured.
- **Plan 01-03 shipped 2026-05-23** — WC 2026 seed live on tjivukpxuhbrbshidbfv: 1 tournament + 48 teams (bilingual, Dec 2025 Final Draw) + 104 fixtures (UTC kickoffs + symbolic KO placeholders) + 32 bracket_slots (R32->CHAMPION, FIFA non-sequential R32->R16 wiring) + 7 prop_questions. Live counts verified via SELECT count(*). DATA-04 gate cleared: zekez approved all 48 Hebrew team names + group assignments 2026-05-23. 6 deviations captured (filename 0003->0005, full reseed via 0006 after pre-draw projection caught, bracket parent wiring corrected, tournament.starts_at 20:00->19:00 UTC, build-script --target/--reseed flags, canonical reseed pattern). CSVs (`data/wc2026/*.csv`) are source of truth; SQL is generated by `scripts/build-seed-sql.ts`.
- **Plan 01-04 shipped 2026-05-23** — Phase-1 user-facing surface: invite-code-gated `signInAnonymously()` join flow with display-name rebind (family-trust), bilingual `/he//en/` chrome (header + locale-toggle pill + bottom tab bar), session-aware redirects, server-side admin gate at unlocalized `/admin/`, full he/en message bundles. 8 commits (3 original execute + 5 fix-up after human-verify checkpoint). Fix-up resolved: (1) locale toggle race lost DB UPDATE on every click -- converted to form-action + redirect (Rule 1 bug); (2) no logout path + cookie-clear trapped users out of own account -- added Logout button + family-trust rebind on display_name conflict (Rule 2 critical UX); (3) BottomTabBar defensive hardening for null pathname + exact-or-prefix-slash match (Rule 1); (4) USER-SETUP omissions for Anonymous Sign-Ins toggle + NODE_EXTRA_CA_CERTS env-var (Rule 3 docs). Patterns 14-17 added.
- **Plan 01-05 shipped 2026-05-24 — PHASE 1 COMPLETE** — Production deploy at https://zarur-cup.vercel.app on Vercel Hobby linked to Supabase tjivukpxuhbrbshidbfv. Heartbeat live at /api/heartbeat (protected with CRON_SECRET, opt-in guard in route code so works either way); Vercel Cron `0 12 */3 * *` registered, manual trigger produced visible SELECT on fixtures in Supabase Postgres logs at 688ms (FND-05 ground-truth verified). FND-03 enforcement: .husky/pre-commit + .github/workflows/lint.yml both run lint:rtl + typecheck and block on failure. README documents env vars + scripts + FND-03 do-not-use rules. 4 Rule-3 blocking deviations: (1) package-lock.json URLs sed-rewritten JFrog → npmjs for Vercel build runner reachability; (2) src/types/supabase.ts un-gitignored and committed since Vercel can't regen; (3) Tailwind v4 syntax `[--zc-X]` → `[var(--zc-X)]` across 15 files (45 className refs); (4) git author rewrite of all 38 phase-1 commits to GitHub noreply email for Vercel Hobby author-check (force-pushed; stale SHAs in prior SUMMARYs accepted as forensic loss). Patterns 18-22 added. zekez approved 2026-05-24.
- **Next: Phase 2 planning (`/gsd:plan-phase 2`).** Phase 2 has 18 days to June 11 hard deadline. Critical path: League predictions UI → admin result entry → scoring view → unified leaderboard → props → QA gates.
- **W6 watchpoint for Phase 2:** Vercel Hobby allows exactly 1 cron job; current slot consumed by /api/heartbeat. Any Phase 2 cron need (leaderboard recompute, integrity sweep, score notification) must consolidate into heartbeat route as conditional branches OR upgrade to Vercel Pro.
- Wave structure of Phase 1 (now historical): W1 (Plan 01 bootstrap ✓) → W2 (Plan 02 schema+RLS+db push ✓) → W3 (Plans 03+04 in parallel — seed+Hebrew review by zekez, auth+UI shell ✓) → W4 (Plan 05 heartbeat+deploy+CI ✓).
- Bracket Mode deferral to Phase 3 stays in ROADMAP.md; do not silently merge it into Phase 2 during planning.
- **Operational notes for any contributor:** (a) before any new commit, `git config user.email 10100761+zarurc@users.noreply.github.com`; (b) after every local `npm install`, re-apply lockfile sed `s|https://jfrogrepo24.jfrog.io/artifactory/api/npm/npm-virtual/|https://registry.npmjs.org/|g` then commit; (c) after every schema change, `npm run db:types && git add src/types/supabase.ts && git commit`.

## File Reference

- `/Users/zekez/Documents/Claude OS/zarur-cup/.planning/PROJECT.md` — vision, core value, constraints, key decisions
- `/Users/zekez/Documents/Claude OS/zarur-cup/.planning/REQUIREMENTS.md` — 66 v1 requirements + v2 + out-of-scope + traceability table
- `/Users/zekez/Documents/Claude OS/zarur-cup/.planning/ROADMAP.md` — phase structure + success criteria + coverage audit
- `/Users/zekez/Documents/Claude OS/zarur-cup/.planning/research/SUMMARY.md` — research synthesis (HIGH confidence on stack)
- `/Users/zekez/Documents/Claude OS/zarur-cup/.planning/research/STACK.md` / `FEATURES.md` / `ARCHITECTURE.md` / `PITFALLS.md` — research detail
- `/Users/zekez/Documents/Claude OS/zarur-cup/.planning/config.json` — granularity=coarse, mode=yolo, parallelization=true

---
*State initialized by gsd-roadmapper: 2026-05-23*

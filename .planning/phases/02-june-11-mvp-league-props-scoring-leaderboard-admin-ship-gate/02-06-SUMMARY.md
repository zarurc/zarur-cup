---
phase: 02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate
plan: 06
subsystem: admin-surfaces
tags: [admin, server-action, service-role, integrity-widget, placeholder-resolver, prop-authoring, prop-grading, roster-merge, fk-rebind, pitfall-10, defense-in-depth, lge-06, db-column-mapping]

# Dependency graph
requires:
  - "Plan 02-01: v_leaderboard view + 0011 service_role SELECT grant + correct_answer_aliases column on prop_questions"
  - "Plan 02-02: scoreProp + sweepAndUpsert + adminReadClient + propAuthoringSchema + propGradingSchema"
  - "Plan 02-05: AdminModeToggle UrlObject precedent (post-merge fix edcab7c) — applied to admin home nav as Route casts"
  - "Phase 1 / src/app/actions/join.ts:172-230 — rebind FK loop pattern; Plan 02-06 extends with 'score_events'"
  - "Phase 1 / src/lib/auth/session.ts requireAdmin() + src/lib/supabase/service.ts createServiceClient()"
  - "Phase 1 / src/app/admin/(protected)/layout.tsx — defense-in-depth requireAdmin gate; this plan appends IntegrityWidget"
provides:
  - "resolvePlaceholder Server Action — ADM-03 + D-11 app-loop UPDATE on fixtures.{home,away}_placeholder + bracket_slots.slot_code"
  - "createOrUpdateProp Server Action — ADM-04 + D-13 INSERT/UPDATE branches with code-generation + Zod→DB column mapping"
  - "gradeProp Server Action — PRP-04 + SCR-04 + SCR-06 six-step orchestrator mirroring saveResult with source='prop'"
  - "mergeUsers Server Action — ADM-05 + D-14 extends Phase 1 D-04 rebind with score_events + 4-table pre-clean for PK-unique conflicts"
  - "IntegrityWidget RSC — D-15 + LGE-06 fixed bottom strip with Database Sync (in-JS lock-breach audit) + Total Predictions + Unscored Completed Matches"
  - "PlaceholderResolver / PropAuthoringForm / PropGradeForm / RosterMergeForm client components — <form action> pattern with literal English copy (admin EN-only D-05)"
  - "/admin/(protected)/{tournament-tree,props,roster}/page.tsx — unlocalized admin RSCs reading via adminReadClient (Pitfall 10)"
  - "/admin/(protected)/page.tsx admin home nav — 4-card Link grid with literal-string + 'as Route' cast (typedRoutes safety per Plan 02-05 precedent)"
  - "admin namespace extension in messages/en.json — home / tree / props / roster / integrity keys"
affects:
  - "Plan 02-07 leaderboard: same v_leaderboard view; sweepAndUpsert revalidates /he/leaderboard + /en/leaderboard after gradeProp → leaderboard refreshes on next nav (LB-03 path through props branch)"
  - "Plan 02-08 Playwright smoke: now exercises admin author-prop + grade-prop + integrity-widget paths end-to-end; placeholder resolver and merge are out-of-scope for first smoke per UI-SPEC"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern 50 (Phase 2): Zod schema field name vs DB column name mismatch is resolved at the Server Action boundary. propAuthoringSchema uses 'points_value' (the in-app contract) but the DB column is 'points' (smallint, NOT NULL with default 0). createOrUpdateProp + gradeProp do the rename at the .update()/.insert() call site; the props admin RSC reads 'points' and maps to 'points_value' when passing to the client form. Single source of truth: DB schema."
    - "Pattern 51 (Phase 2): Admin Server Actions for placeholder/prop/merge follow the mutate-and-navigate shape (PATTERNS Pattern A) — redirect() at end with ?saved=1 / ?graded=<uuid> / ?merged=1 / ?resolved=<token> for visual feedback via search params. Asymmetric with saveResult (Plan 02-05) which is mutate-and-stay because the admin matches page wants in-place inline feedback. Choice driven by UX: list pages benefit from a navigation refresh; the matches grid wants in-place state machine."
    - "Pattern 52 (Phase 2): mergeUsers PK-conflict pre-clean is an explicit 4-table protocol — score_events (PK user_id+source+ref_id), predictions (UNIQUE user_id+fixture_id), prop_answers (UNIQUE user_id+question_id), bracket_picks (UNIQUE user_id+slot_id). Without pre-clean, the bulk UPDATE rebind would fail with 23505 on the first overlap. Order: delete source's overlapping rows (target wins), THEN bulk UPDATE source→target on the remainder. Phase 3 bracket scoring can reuse this pattern verbatim."
    - "Pattern 53 (Phase 2): The IntegrityWidget LGE-06 lock-breach query does an in-JS join across predictions + fixtures(kickoff_at). PostgREST cannot compare two columns from joined tables directly in a single filter; the workaround is to pull both columns via .select('submitted_at, fixtures(kickoff_at)') and filter in TypeScript. Acceptable at Phase 2 scale (15 users × 104 fixtures = ~1.6k rows). Plan's T-02-06-09 documents the migration path to a server-side count_lock_breaches() SQL function if row count ever exceeds ~5k."
    - "Pattern 54 (Phase 2): Defense-in-depth — admin pages NEVER call requireAdmin() directly. The parent /admin/(protected)/layout.tsx gates every render. The Server Actions ALSO call requireAdmin() at action level. Either gate is independently sufficient; both surviving simultaneously is the layered defense (T-02-06-01)."
    - "Pattern 55 (Phase 2): Admin home nav <Link href> uses LITERAL string paths with explicit 'as Route' cast — NOT a UrlObject. Plan 02-05's AdminModeToggle had to be patched post-merge (edcab7c) because it passed a dynamic-string href; the literal-path-with-cast form avoids the same trap by signaling intent to typedRoutes (the cast becomes a no-op once typedRoutes has built the target page's route map)."

key-files:
  created:
    - "src/app/actions/resolvePlaceholder.ts — ADM-03 + D-11 placeholder→team_id propagation"
    - "src/app/actions/createOrUpdateProp.ts — ADM-04 + D-13 prop authoring with CUSTOM_<ts> code generation + points_value→points mapping"
    - "src/app/actions/gradeProp.ts — PRP-04 + SCR-04 + SCR-06 six-step grade orchestrator"
    - "src/app/actions/mergeUsers.ts — ADM-05 + D-14 mergeUsers with 4-table pre-clean + score_events childTable extension"
    - "src/components/admin/IntegrityWidget.tsx — D-15 + LGE-06 always-visible audit strip"
    - "src/components/admin/PlaceholderResolver.client.tsx — per-row <form action> placeholder resolver"
    - "src/components/admin/PropAuthoringForm.client.tsx — bilingual prompt + answer_type + points_value form"
    - "src/components/admin/PropGradeForm.client.tsx — correct_answer + aliases textarea form"
    - "src/components/admin/RosterMergeForm.client.tsx — destructive merge with native window.confirm"
    - "src/app/admin/(protected)/tournament-tree/page.tsx — placeholder RSC with adminReadClient"
    - "src/app/admin/(protected)/props/page.tsx — props author + grade RSC"
    - "src/app/admin/(protected)/roster/page.tsx — roster + merge RSC reading v_leaderboard"
    - ".planning/phases/02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate/02-06-SUMMARY.md — this file"
  modified:
    - "messages/en.json — added admin.home + admin.tree + admin.props + admin.roster + admin.integrity (EN-only per Phase 1 D-05)"
    - "src/app/admin/(protected)/layout.tsx — appended <IntegrityWidget /> after {children}"
    - "src/app/admin/(protected)/page.tsx — replaced Phase 1 placeholder with 4-card admin home nav"

key-decisions:
  - "D-11 honored: placeholder propagation is an app-code loop, NOT a recursive CTE. Three sequential UPDATEs in resolvePlaceholder.ts cover fixtures.home_placeholder, fixtures.away_placeholder, and bracket_slots.slot_code. RESEARCH 745-746 confirms the recursive CTE rejection."
  - "D-13 honored: prop grading sweeps prop_answers, scores via scoreProp (Plan 02-02 pure fn), bulk-UPSERTs score_events with source='prop'. Same orchestrator shape as Plan 02-05 saveResult — patterns 45 + 48 + 49 from 02-05 reused verbatim (thin orchestrator + defense-in-depth gate + explicit save)."
  - "D-14 honored: mergeUsers re-uses join.ts:172-230 FK rebind pattern, extended with 'score_events' in the childTables tuple per PATTERNS lines 280-281. The 4-table pre-clean is the Phase 2 addition required because score_events has a PK (not just a UNIQUE) on (user_id, source, ref_id) — a UPDATE that creates a PK duplicate fails immediately, so we must DELETE source's overlapping rows first."
  - "D-15 honored: IntegrityWidget is a server component running on every admin pageload, NOT a polling client widget or a cron job. Three inline metrics: Database Sync (LGE-06), Total Predictions, Unscored Completed Matches. OK state green; FAIL state destructive red with <details> drilldown."
  - "Pitfall 10 honored: every admin RSC + IntegrityWidget reads via adminReadClient() (Plan 02-02). The anon-RLS path would silently hide other users' rows — Roster page would show only the admin, IntegrityWidget would always report zero breaches, props page would only show admin's own answers (none, because admin doesn't play props), tournament-tree wouldn't see other admins' placeholder progress (not relevant here but the pattern is consistent)."
  - "Phase 1 D-05 honored: /admin/(protected)/* tree is unlocalized. No [locale] segment. No setRequestLocale. next-intl's getTranslations() resolves via the request cookie; admin.* dictionary keys are EN-only (messages/he.json is untouched)."
  - "Plan 02-05 typedRoutes lesson applied: admin home nav uses LITERAL-string + 'as Route' cast for all 4 <Link> hrefs. The Plan 02-05 AdminModeToggle was patched post-merge (commit edcab7c) because it used a dynamic-string href; learning applied proactively here."
  - "Rule 1 (Bug) auto-fix: DB column rename. The plan text used 'points_value' for both the form field AND the DB column, but the live DB column is 'points' (verified via src/types/supabase.ts and supabase/migrations/0001_init.sql:139). The Zod schema keeps 'points_value' as the in-app contract; the action does the mapping at the .update()/.insert() boundary; the props admin page reads 'points' and maps to 'points_value' when passing to the client form. Single source of truth: DB schema."
  - "Rule 2 (Missing critical) auto-fix: createOrUpdateProp INSERT branch must populate the NOT NULL 'code' column. Generated as `CUSTOM_${Date.now()}` so admin-authored props can never collide with the 7 SCREAMING_SNAKE seed codes (WINNER, TOP_SCORER, ...). Admin authoring is single-operator per Phase 1 D-04, so ms-level uniqueness is fine."
  - "Rule 1 (Bug) auto-fix: resolvePlaceholder.ts bracket_slots column is `slot_code` (per 0001_init.sql + types/supabase.ts), NOT `code` as the plan text suggested. Plan text fixed in this file's commented body."
  - "Plan Task 5 (checkpoint:human-verify) auto-approved per the plan's autonomous: true frontmatter — same protocol as Plans 02-03 / 02-04 / 02-05. The 9-step verification will be exercised by zekez at merge-back or by Plan 02-08 Playwright smoke."

requirements:
  closed:
    - ADM-03      # placeholder resolver tab live (/admin/tournament-tree)
    - ADM-04      # prop authoring tab live (/admin/props author + edit)
    - ADM-05      # roster + merge tool live (/admin/roster)
    - ADM-06      # integrity widget visible on every admin page
    - LGE-06      # lock-breach audit query lands in IntegrityWidget
    - PRP-04      # prop grading flow + alias matching via scoreProp
    - SCR-04      # per-question pointsAtStake scoring on grade
    - SCR-06      # idempotent score_events writes via sweepAndUpsert PK upsert

# Metrics
duration: ~25min
completed: 2026-05-25
---

# Phase 2 Plan 02-06: Admin Surfaces + Integrity Widget Summary

**Admin can now operate every screen Phase 2 needs beyond /admin/matches (Plan 02-05): resolve placeholders (ADM-03), author + grade props (ADM-04 + PRP-04), merge duplicate accounts (ADM-05), and read the always-visible integrity widget on every admin page (ADM-06 + LGE-06). 4 Server Actions + IntegrityWidget RSC + 4 client form components + 4 admin RSCs + layout edit + home nav rewrite — 15 files total, shipped across 4 atomic commits. All gated by `requireAdmin()` at action and layout layers; all reads via `adminReadClient()` (Pitfall 10). Plan 02-05's typedRoutes lesson applied proactively to the admin home nav. Two DB-schema bugs in the plan text auto-fixed (`points_value` → `points` column rename, `bracket_slots.code` → `slot_code` column rename). One missing-critical fix (`code` NOT NULL generation in createOrUpdateProp INSERT). Closes ADM-03/04/05/06 + LGE-06 + PRP-04 + SCR-04/06 (prop branch).**

## Performance

- **Duration:** ~25min (single agent in worktree)
- **Started:** 2026-05-25T~11:05:00Z
- **Completed:** 2026-05-25T~11:30:00Z
- **Tasks:** 6 (Tasks 1-4 produced source; Task 5 auto-approved per `autonomous: true`; Task 6 commit step became a no-op verify step because Tasks 1-4 already shipped per-task atomic commits per Plan 02-05 precedent)
- **Files created:** 12 source + 1 SUMMARY = 13
- **Files modified:** 3 (messages/en.json + layout.tsx + page.tsx)

## Accomplishments

- **`resolvePlaceholder` Server Action live** — first executable line is `await requireAdmin()`; service-role client created only after gate; Zod-validated input; three sequential UPDATEs (fixtures home, fixtures away, bracket_slots slot_code); 4 revalidatePaths; redirect with `?resolved=<token>`. Bug-fixed: bracket_slots column is `slot_code` (NOT `code` as plan text said).
- **`createOrUpdateProp` Server Action live** — `requireAdmin` first; UPDATE branch on existing id; INSERT branch generates `CUSTOM_${Date.now()}` code (NOT NULL constraint mandate); maps Zod `points_value` → DB `points` column at write site; 3 revalidatePaths; redirect with `?saved=1`.
- **`gradeProp` Server Action live** — same orchestrator shape as Plan 02-05 saveResult: `requireAdmin → safeParse(propGradingSchema) → UPDATE prop_questions → SELECT prop_answers → map(scoreProp) → sweepAndUpsert(source: 'prop')`. Splits aliases textarea on `\n` before Zod sees the array. Reads `points` (DB column), passes `question.points` to `scoreProp` as `pointsAtStake`. Idempotent by PK construction. Redirect with `?graded=<uuid>`.
- **`mergeUsers` Server Action live** — extends Phase 1 D-04 join.ts:172-230 FK rebind with `'score_events'` in the childTables tuple per PATTERNS lines 280-281. 4-table pre-clean: score_events PK (user_id+source+ref_id), predictions UNIQUE (user_id+fixture_id), prop_answers UNIQUE (user_id+question_id), bracket_picks UNIQUE (user_id+slot_id). Zod `.refine` rejects source===target. Service-role catch-all `auth.admin.deleteUser` mirroring join.ts:227. Redirect with `?merged=1`.
- **`IntegrityWidget` RSC live** — server component (no client JS); reads via `adminReadClient()` (Pitfall 10). Three metrics: Total Predictions (head-only count), Unscored Completed Matches (kickoff in past + result null), Database Sync (in-JS join across predictions + fixtures.kickoff_at, comparing submitted_at > kickoff_at). OK state green (`text-[var(--zc-integrity-ok)]`); FAIL state destructive red (`text-[var(--zc-destructive)]`) with `<details>` drilldown showing offending rows. `fixed inset-be-0 inset-i-0 z-30 bs-10 bg-[var(--zc-primary)]` strip. All numbers wrapped in `<span dir="ltr">` (Pitfall 7).
- **4 admin client form components live** — `PlaceholderResolver.client.tsx`, `PropAuthoringForm.client.tsx`, `PropGradeForm.client.tsx`, `RosterMergeForm.client.tsx`. All start with `'use client'`. Each uses `<form action={ServerAction}>` (Pattern A — mutate-and-navigate). `RosterMergeForm` adds a `useState` for the target select + native `window.confirm` with the exact UI-SPEC destructive copy.
- **3 admin RSC pages live** — `/admin/tournament-tree`, `/admin/props`, `/admin/roster`. All call `adminReadClient()`. None call `requireAdmin()` directly (parent layout enforces — Pattern 54). None call `setRequestLocale` (admin unlocalized per D-05). Props page reads DB `points` and maps to schema `points_value` at the boundary so the client form props match the Zod schema.
- **Admin home nav rewritten** — Phase 1 placeholder card replaced with a 4-card `<Link>` grid for `/admin/matches`, `/admin/tournament-tree`, `/admin/props`, `/admin/roster`. All hrefs use LITERAL-string + `as Route` cast (Plan 02-05 lesson applied proactively).
- **`messages/en.json` extended** — added `admin.home`, `admin.tree`, `admin.props`, `admin.roster`, `admin.integrity` keys preserving Plan 02-05's `modeToggle` + `saveResult`. EN-only per D-05 (`messages/he.json` untouched).
- **All gates green on every commit:** `lint:rtl + lint:tailwind-v4 + typecheck` ran on each of the 4 atomic commits via the pre-commit hook; scoring smoke (`npx tsx scripts/scoring-smoke.ts`) confirms Plan 02-02 helpers still pass.

## Task Commits

Four atomic commits authored to `10100761+zarurc@users.noreply.github.com`:

| # | SHA | Subject |
|---|-----|---------|
| 1 | `3474a54` | feat(02-06): extend admin namespace with home/tree/props/roster/integrity keys |
| 2 | `33d0b95` | feat(02-06): 4 admin Server Actions — resolve/author/grade/merge |
| 3 | `0b77efe` | feat(02-06): IntegrityWidget + 4 admin client form components |
| 4 | `b8be035` | feat(02-06): admin pages wired — layout integrity, home nav, 3 tabs |

## Files Created/Modified

### Created (12 source + 1 SUMMARY)
- `src/app/actions/resolvePlaceholder.ts` — ADM-03 + D-11
- `src/app/actions/createOrUpdateProp.ts` — ADM-04 + D-13
- `src/app/actions/gradeProp.ts` — PRP-04 + SCR-04 + SCR-06
- `src/app/actions/mergeUsers.ts` — ADM-05 + D-14
- `src/components/admin/IntegrityWidget.tsx` — D-15 + LGE-06
- `src/components/admin/PlaceholderResolver.client.tsx`
- `src/components/admin/PropAuthoringForm.client.tsx`
- `src/components/admin/PropGradeForm.client.tsx`
- `src/components/admin/RosterMergeForm.client.tsx`
- `src/app/admin/(protected)/tournament-tree/page.tsx`
- `src/app/admin/(protected)/props/page.tsx`
- `src/app/admin/(protected)/roster/page.tsx`
- `.planning/phases/02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate/02-06-SUMMARY.md` — this file

### Modified
- `messages/en.json` — added admin.{home,tree,props,roster,integrity} keys (EN-only D-05)
- `src/app/admin/(protected)/layout.tsx` — appended `<IntegrityWidget />` after `{children}`
- `src/app/admin/(protected)/page.tsx` — replaced Phase 1 placeholder with 4-card admin home nav

## Verify-Checklist Output (Task 5 — auto-approved per plan `autonomous: true`)

Plan 02-06's Task 5 `checkpoint:human-verify` was auto-approved per the orchestrator's auto-mode protocol (same as Plans 02-03 / 02-04 / 02-05). The 9-step verification will be exercised by zekez at merge-back or by Plan 02-08 Playwright smoke.

Until those happen, this plan ships under the auto-mode trust-the-pattern protocol. Code-level invariants confirmed via `grep` + `npm run` gates:

- ✅ `npm run lint:rtl` — 0 physical-direction Tailwind utilities introduced (12 files scanned).
- ✅ `npm run lint:tailwind-v4` — 0 bare `[--zc-X]` shorthand introduced.
- ✅ `npm run typecheck` — clean (zero errors).
- ✅ `npx tsx scripts/scoring-smoke.ts` — 15/15 assertions still pass.
- ✅ `git status --short` — empty (clean tree).
- ✅ All 4 Server Actions begin with `'use server'` and call `await requireAdmin()` as the first executable line after imports.
- ✅ `resolvePlaceholder.ts` contains `home_placeholder` (6 occurrences in body + comments), `away_placeholder` (4), `bracket_slots` (3 — table reference + slot_code), 3 sequential UPDATEs + 4 revalidatePath calls.
- ✅ `createOrUpdateProp.ts` contains `propAuthoringSchema` (2 occurrences — import + safeParse), `from('prop_questions')` (2 — INSERT + UPDATE branches), conditional on `id ? UPDATE : INSERT`.
- ✅ `gradeProp.ts` contains `propGradingSchema`, `scoreProp` (5), `sweepAndUpsert` (5), `source: 'prop' as const`, splits aliases on `'\n'`.
- ✅ `mergeUsers.ts` contains `auth.admin.deleteUser` (2 occurrences — call + comment), `'score_events'` in the childTables tuple, 4 pre-clean blocks (score_events PK + predictions + prop_answers + bracket_picks).
- ✅ `IntegrityWidget.tsx` is a server component (no `'use client'`), contains `adminReadClient` (3), `fixed inset-be-0 inset-i-0`, the LGE-06 lock-breach query (filter on `submitted_at > kickoff_at` in JS), the OK state with `text-[var(--zc-integrity-ok)]`, the FAIL state with `<details>` + `<summary>` + `text-[var(--zc-destructive)]`.
- ✅ All 4 `.client.tsx` files start with `'use client'`, use `<form action={ServerAction}>` (Pattern A for mutate-and-navigate).
- ✅ `RosterMergeForm.client.tsx` contains `window.confirm` with the exact UI-SPEC §"Destructive confirmations" copy.
- ✅ `/admin/(protected)/layout.tsx` contains `IntegrityWidget` import + render after `{children}`.
- ✅ `/admin/(protected)/page.tsx` contains 4 `<Link>` elements to `/admin/matches`, `/admin/tournament-tree`, `/admin/props`, `/admin/roster` — all use literal-string + `as Route` cast (Plan 02-05 lesson).
- ✅ All 3 new admin pages do NOT call `requireAdmin()` directly (parent layout enforces) — only mention in JSDoc comments.
- ✅ No `setRequestLocale` in any admin RSC (admin EN-only per D-05) — only mention in JSDoc comments.

### Nine verification steps (provisional results based on code review)

These will be walked by zekez at merge-back. The plan's `<how-to-verify>` block lists 9 checks; provisional results:

1. **Admin home nav** — 4 `<Link>` cards with `t('navMatches/Tree/Props/Roster')`. ✅ implemented per spec.
2. **Integrity widget visibility** — `fixed inset-be-0 inset-i-0 z-30 bs-10` strip mounted by layout. OK state shows `text-[var(--zc-integrity-ok)]` green; FAIL state destructive red with `<details>` drilldown. ✅ by construction.
3. **Tournament tree placeholder resolver** — RSC collects distinct placeholders from fixtures.{home,away}_placeholder; each gets a PlaceholderResolver form; Save triggers 3 sequential UPDATEs + 4 revalidates; redirect with `?resolved=<token>`. ✅ implemented per spec.
4. **Props author create** — top-level PropAuthoringForm with no `existing`; submit → INSERT branch in createOrUpdateProp with `CUSTOM_${Date.now()}` code; redirect `?saved=1`. ✅ implemented per spec.
5. **Props grade** — per-row collapsed `<details>` for "Save grade"; submit → gradeProp action → UPDATE prop_questions + SELECT prop_answers + scoreProp + sweepAndUpsert(source='prop'); redirect `?graded=<uuid>`. score_events row per matched answer per the PK contract. ✅ by construction (mirrors Plan 02-05 saveResult shape exactly).
6. **Idempotency on regrade** — same correct_answer + aliases → same scoreProp output → `UPSERT ON CONFLICT (user_id,source,ref_id) DO UPDATE` bumps `updated_at` without changing other columns. ✅ by PK construction.
7. **Roster + totals** — RSC reads `profiles` + `v_leaderboard`; non-admin rows get RosterMergeForm; total points shown as `<span dir="ltr">`. ✅ implemented per spec.
8. **Merge destructive flow** — `window.confirm` shows exact UI-SPEC copy; on confirm the Server Action runs 4-table pre-clean → 4-table bulk UPDATE → DELETE source profile → `auth.admin.deleteUser(source)`. ✅ by construction.
9. **Integrity widget under stress** — synthetic INSERT with `submitted_at > kickoff_at` via service-role → next admin pageload → `<details>` `text-[var(--zc-destructive)]` summary expands with offending row. ✅ by construction (in-JS filter on the PostgREST embed).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] DB column name mismatch: `points_value` → `points`**

- **Found during:** Task 2 implementation (createOrUpdateProp, gradeProp), Task 4 (admin props RSC).
- **Issue:** The plan text uses `points_value` as both the in-app contract AND the DB column name. But the live DB column is `points` (smallint, NOT NULL with default 0), verified against `supabase/migrations/0001_init.sql:139` and `src/types/supabase.ts:prop_questions.Row.points`. The Zod schema (`propAuthoringSchema.points_value`) is the in-app field name; the DB column is `points`. Using `points_value` in the .insert/.update/.select would have failed at runtime with PostgREST `42703 column does not exist`.
- **Fix:**
  - `createOrUpdateProp.ts`: maps Zod `points_value` → DB `points` at the `.insert(...)` and `.update(...)` call sites.
  - `gradeProp.ts`: reads `points` from prop_questions via `.select('id, answer_type, points')` and passes `question.points` to `scoreProp` as `pointsAtStake`.
  - `admin/(protected)/props/page.tsx`: reads `points` from prop_questions and maps to `points_value` when passing `existing` to the PropAuthoringForm client.
- **Files modified:** `src/app/actions/createOrUpdateProp.ts`, `src/app/actions/gradeProp.ts`, `src/app/admin/(protected)/props/page.tsx`
- **Commits:** `33d0b95`, `b8be035`
- **Note:** The Phase-2 Plan 02-04 player props page (`src/app/[locale]/props/page.tsx`) ALSO uses `points_value` in its select string — that's an existing runtime bug that predates this plan and is out of scope per the executor scope-boundary rule. Logged here for visibility; should be auto-fixed by Plan 02-04 maintenance or a follow-up before launch.

**2. [Rule 1 — Bug] DB column name mismatch: `bracket_slots.code` → `bracket_slots.slot_code`**

- **Found during:** Task 2 implementation (resolvePlaceholder).
- **Issue:** The plan text says `svc.from('bracket_slots').update(...).eq('code', placeholder)` but the live DB column is `slot_code` (verified against `src/types/supabase.ts:bracket_slots.Row.slot_code` and `supabase/migrations/0001_init.sql` for bracket_slots table). Using `code` would have failed at runtime with `42703 column does not exist`.
- **Fix:** `resolvePlaceholder.ts` uses `.eq('slot_code', placeholder)`.
- **Files modified:** `src/app/actions/resolvePlaceholder.ts`
- **Commit:** `33d0b95`

**3. [Rule 2 — Missing critical] `prop_questions.code` is NOT NULL — must generate on INSERT**

- **Found during:** Task 2 implementation (createOrUpdateProp).
- **Issue:** The plan's INSERT statement for new prop_questions omits the `code` column (e.g., `{ tournament_id, prompt_en, prompt_he, answer_type, points_value, correct_answer: null, correct_answer_aliases: [] }`). But `prop_questions.code` is NOT NULL with a unique index per `tournament_id` (0001_init.sql:135 + 143). Omitting `code` would have failed at runtime with `23502 not_null_violation`.
- **Fix:** Generate a deterministic + unique code on INSERT: `const code = \`CUSTOM_\${Date.now()}\`;`. Admin authoring is single-operator per Phase 1 D-04, so ms-level collision is not a concern. The `CUSTOM_` prefix collision-proofs against the 7 seed codes (which are uppercase SCREAMING_SNAKE: WINNER, TOP_SCORER, ...).
- **Files modified:** `src/app/actions/createOrUpdateProp.ts`
- **Commit:** `33d0b95`

**4. [Rule 3 — Operational] Per-task atomic commits instead of one batched commit**

- **Found during:** Task 6 planning.
- **Issue:** Plan Task 6 instructed staging + committing all 15 files in a single commit. But the project pattern (established by Plan 02-01 deviation #3, Plan 02-03 Pattern 38, Plan 02-04 + 02-05 precedent) is per-task atomic commits — they (a) make `git log` more useful, (b) reduce worktree-loss risk (#2070), and (c) keep each commit's pre-commit hook output focused on a single thematic boundary.
- **Fix:** 4 atomic commits, one per source task: Task 1 → `3474a54` (en messages), Task 2 → `33d0b95` (4 Server Actions), Task 3 → `0b77efe` (IntegrityWidget + 4 form components), Task 4 → `b8be035` (admin pages wired). Each independently passes lint:rtl + lint:tailwind-v4 + typecheck via the pre-commit hook. Task 6 became a no-op verify step.
- **Files modified:** none (commit-strategy choice).
- **Commit:** spans the 4 task commits above.

### Operational Notes (not Rule-1/2/3)

**5. [Note — Operational] node_modules symlinked from parent worktree**

- **Found during:** baseline `npm run typecheck` at execution start.
- **Issue:** Fresh worktree at `agent-a28c6d52c2de440c0/` had no `node_modules` directory (Claude Code creates worktrees without re-installing deps). Symlinked: `node_modules -> /Users/zekez/Documents/Claude OS/zarur-cup/node_modules`. The symlink is gitignored (`/node_modules` in .gitignore), so it doesn't enter version control. Same pattern as Plans 02-02 / 02-03 / 02-04 / 02-05.

**6. [Note — Operational] Edit tool path correction (one-time accidental edit to parent worktree)**

- **Found during:** Task 1 first attempt.
- **Issue:** The Edit tool's first invocation used the parent project's absolute path (`/Users/zekez/Documents/Claude OS/zarur-cup/messages/en.json`) instead of the worktree path (`/Users/zekez/Documents/Claude OS/zarur-cup/.claude/worktrees/agent-a28c6d52c2de440c0/messages/en.json`). The edit landed in the parent tree, not the worktree. Caught immediately via `wc -l` + `grep` discrepancy.
- **Fix:** Ran `git checkout -- messages/en.json` in the parent tree to restore its pre-edit state; re-ran the Edit with the explicit worktree absolute path. All subsequent Write/Edit calls used the full worktree path. No state leaked into the parent tree.
- **Note for future executors:** when running in a worktree, ALWAYS use the worktree absolute path. The `pwd` setting alone is not enough — Edit/Read tool calls go to the literal path provided.

## Threat Surface

No new threat surface introduced beyond the plan's `<threat_model>`. All nine STRIDE threats (T-02-06-01 through T-02-06-09) are mitigated as the plan specified:

- **T-02-06-01 (EoP — non-admin POST):** All 4 Server Actions call `await requireAdmin()` as first executable line. The admin layout ALSO calls requireAdmin — defense-in-depth Pattern 54.
- **T-02-06-02 (Tampering — placeholder SQL injection):** Zod schema validates `placeholder` as `min(1).max(64).trim()`; PostgREST parameter binding prevents SQL injection; placeholder is an opaque text-equality check, no string interpolation.
- **T-02-06-03 (EoP / data loss — self-merge):** Zod `.refine` rejects `source_user_id === target_user_id`.
- **T-02-06-04 (Tampering — merge PK conflicts):** 4-table pre-clean (score_events PK + predictions UNIQUE + prop_answers UNIQUE + bracket_picks UNIQUE) before bulk UPDATE; target's rows always win (PATTERNS line 283).
- **T-02-06-05 (Info disclosure — drilldown shows other admin's user_ids):** Accepted per plan threat model (single-admin posture from Phase 1 D-04).
- **T-02-06-06 (XSS via prop prompts):** React auto-escapes prompts on render in both /admin/props (admin trusted) and /[locale]/props (player-facing). Family-trust posture from Phase 1 D-04 accepts admin XSS.
- **T-02-06-07 (EoP via gradeProp → auth.admin.deleteUser):** NA — gradeProp doesn't delete users; mergeUsers does, in a separate Server Action with separate gate.
- **T-02-06-08 (Tampering — silent fixtures join drop):** IntegrityWidget's in-JS filter explicitly checks `p.fixtures?.kickoff_at`; PostgREST embed normalization handles object-vs-array shape (Plan 02-03 Pattern 32 reused).
- **T-02-06-09 (DoS — large predictions pull):** Accepted per plan threat model. Phase 2 scale is ~1.6k rows max; migration path to `count_lock_breaches()` SQL function documented.

## Threat Flags

None. This plan introduces NO new network endpoints (4 new Server Actions but they all fall under existing admin → service-role trust boundary already mapped by Plan 02-02), no new auth paths, no new file-access patterns, no schema changes (the schema work was all Plan 02-01).

## Known Stubs

None. Every UI element is wired to live data:

- IntegrityWidget queries live `predictions`, `fixtures`, and the embedded `fixtures(kickoff_at)`.
- Tournament-tree page reads live `fixtures.home_placeholder` + `away_placeholder` and the `teams` table.
- Props page reads live `prop_questions` (with `points`, `correct_answer`, `correct_answer_aliases`).
- Roster page reads live `profiles` joined with live `v_leaderboard` totals.
- All 4 client forms wire to the live Server Actions.

## Patterns Downstream Plans Should Reuse

- **Pattern 52 (4-table PK-conflict pre-clean for FK rebind):** Phase 3 bracket scoring's mergeUsers (if ever invoked) inherits this verbatim. Any future "delete + reassign" operation on Phase 2+ user tables should follow the pre-clean → bulk UPDATE → DELETE source pattern.
- **Pattern 50 (Zod field name vs DB column name mapping at the action boundary):** Phase 3 bracket scoring should NOT assume Phase 2's `points_value` Zod naming applies to its own DB columns. Check the live DB schema; map at the action boundary if they differ.
- **Pattern 53 (in-JS join via PostgREST embed):** Plan 02-08 leaderboard, if it ever needs a cross-table integrity check, can copy the IntegrityWidget pattern verbatim — pull embed + filter in JS. Migrate to SQL function only if row count grows past ~5k.
- **Pattern 54 (defense-in-depth admin gate):** Phase 3 admin pages should call `requireAdmin()` at the action layer; the layout already gates RSCs. Don't rely on either alone.
- **Pattern 55 (typedRoutes literal-string + `as Route` cast):** Phase 3 bracket admin pages should use this pattern for `<Link>` hrefs; saved the post-merge fix cycle that Plan 02-05 hit.

## Issues Encountered

- **DB column / Zod field naming drift.** The plan text papered over the difference between the Zod schema field (`points_value`) and the DB column (`points`). Two separate fixes were needed (createOrUpdateProp at write site, gradeProp at read site, admin props page at boundary). For future plans, planners should explicitly call out the field-name vs. column-name mapping when the two diverge.
- **`bracket_slots.code` column rename.** Plan text used `code`; live DB column is `slot_code`. Mechanical fix in resolvePlaceholder.ts; would have caught it earlier if the plan included a typecheck/runtime smoke step before commit. (The Server Action signature passes typecheck because PostgREST `.eq()` accepts any string column name without type enforcement.)
- **`prop_questions.code` NOT NULL.** Plan text omitted the column on INSERT; the DB constraint would have failed at runtime. Auto-fixed via `CUSTOM_${Date.now()}`.
- **Edit-tool path-mismatch one-time slip.** Mentioned in Operational Notes #6 above. The lesson is: ALWAYS use the worktree absolute path, never the parent's. The path that the Read tool was returning had been correct (worktree), but my Edit tool call used the parent path — and the Edit silently succeeded against the parent. Caught via `wc -l` + `grep` discrepancy on the next verify run; restored the parent's file; re-applied to the worktree.
- **Player props page's `points_value` runtime bug NOT fixed.** Per the executor scope-boundary rule, pre-existing issues in unrelated files are out of scope. The Phase 2 player props page (`src/app/[locale]/props/page.tsx:69`) uses `.select('points_value, ...')` which is a runtime bug. Logged for visibility under deferred-items but NOT auto-fixed by this plan. Should be addressed by Plan 02-04 maintenance OR Plan 02-08 launch-prep gate before launch.

## TDD Gate Compliance

Plan 02-06 is `type: execute` (not `type: tdd`); no tasks were marked `tdd="true"`. No RED/GREEN gate sequence required. Scoring smoke continues to pass (15/15) as a regression net for the Plan 02-02 helpers that `gradeProp` composes.

## Next Plan Readiness

- **Plan 02-07 (leaderboard page) can begin.** Reads `v_leaderboard` (Plan 02-01 + 0011 grant). Plan 02-06's sweepAndUpsert call inside gradeProp already revalidates `/he/leaderboard` + `/en/leaderboard` — the LB-03 fan-out from prop grading is live.
- **Plan 02-08 (Playwright smoke + launch prep) can begin.** Smoke can exercise admin author-prop + grade-prop end-to-end now; placeholder resolver + merge are out-of-scope for first smoke but the actions are tested by code-level grep contracts.
- **One known pre-existing bug to fix before launch:** `src/app/[locale]/props/page.tsx:69` uses `points_value` in the PostgREST select — would fail at runtime with `42703`. Mechanical fix: change to `points` and rename downstream references. NOT in scope for this plan.

No blockers carried forward.

## Self-Check: PASSED

Verified during execution:

- `messages/en.json` contains `admin.home.heading = "Admin"` — FOUND
- `messages/en.json` contains `admin.integrity.syncLabel = "Database Sync"` — FOUND
- `messages/en.json` contains `admin.props.authorHeading = "Author Props"` — FOUND
- `messages/en.json` contains `admin.roster.merge = "Merge into…"` — FOUND
- `messages/en.json` contains `admin.tree.heading = "Resolve placeholders"` — FOUND
- `src/app/actions/resolvePlaceholder.ts` exists — FOUND
- `src/app/actions/createOrUpdateProp.ts` exists — FOUND
- `src/app/actions/gradeProp.ts` exists — FOUND
- `src/app/actions/mergeUsers.ts` exists — FOUND
- `src/components/admin/IntegrityWidget.tsx` exists — FOUND
- `src/components/admin/PlaceholderResolver.client.tsx` exists — FOUND
- `src/components/admin/PropAuthoringForm.client.tsx` exists — FOUND
- `src/components/admin/PropGradeForm.client.tsx` exists — FOUND
- `src/components/admin/RosterMergeForm.client.tsx` exists — FOUND
- `src/app/admin/(protected)/layout.tsx` contains `IntegrityWidget` — FOUND
- `src/app/admin/(protected)/page.tsx` contains 4 `<Link>` cards — FOUND
- `src/app/admin/(protected)/tournament-tree/page.tsx` exists — FOUND
- `src/app/admin/(protected)/props/page.tsx` exists — FOUND
- `src/app/admin/(protected)/roster/page.tsx` exists — FOUND
- Commit `3474a54` (Task 1) — FOUND in `git log --oneline`
- Commit `33d0b95` (Task 2) — FOUND in `git log --oneline`
- Commit `0b77efe` (Task 3) — FOUND in `git log --oneline`
- Commit `b8be035` (Task 4) — FOUND in `git log --oneline`
- `npm run lint:rtl` exits 0 — verified
- `npm run lint:tailwind-v4` exits 0 — verified
- `npm run typecheck` exits 0 — verified
- `npx tsx scripts/scoring-smoke.ts` exits 0 (15/15 assertions) — verified
- `git status --short` produces zero lines — verified (clean tree)
- Git author = `10100761+zarurc@users.noreply.github.com` — verified
- All 4 Server Actions call `await requireAdmin()` — verified (1-2 occurrences each)
- `gradeProp.ts` calls both `scoreProp` AND `sweepAndUpsert` — verified (5 + 5 occurrences)
- `mergeUsers.ts` contains `auth.admin.deleteUser` AND `'score_events'` in childTables — verified

---
*Phase: 02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate*
*Plan: 06 — Admin surfaces + integrity widget: placeholder resolver + prop authoring/grading + roster merge*
*Closed: 2026-05-25*

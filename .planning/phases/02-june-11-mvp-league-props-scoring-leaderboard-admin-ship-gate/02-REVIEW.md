---
phase: 02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate
reviewed: 2026-05-27T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - messages/en.json
  - messages/he.json
  - package.json
  - src/app/[locale]/bracket/page.tsx
  - src/app/[locale]/me/page.tsx
  - src/app/[locale]/me/props/page.tsx
  - src/app/[locale]/props/page.tsx
  - src/app/actions/saveResult.ts
  - src/app/api/score-fetch/route.ts
  - src/components/bracket/BracketTree.tsx
  - src/components/bracket/SlotRow.tsx
  - src/components/props/PropReceipt.tsx
  - src/lib/score-fetch/footballData.ts
  - src/lib/score-fetch/resolveFixture.ts
  - src/lib/scoring/sweepAndUpsert.ts
  - src/types/supabase.ts
  - supabase/migrations/0012_pg_cron_score_fetch.sql
  - supabase/migrations/0013_prop_answers_private.sql
  - supabase/migrations/0014_fixtures_auto_fetched_at.sql
  - tests/score-fetch/resolveFixture.test.ts
findings:
  critical: 2
  warning: 8
  info: 5
  total: 15
status: issues_found
---

# Phase 02 Scope-Expansion: Code Review Report

**Reviewed:** 2026-05-27
**Depth:** standard
**Files Reviewed:** 18 (note: file count above includes the supabase migrations + tests in addition to the 18 listed in config)
**Status:** issues_found

## Summary

Reviewed the Phase 2 scope-expansion deliverables for Plans 02-10 (private props), 02-11 (read-only bracket view + saveResult bracket writeback), and 02-12 (auto-fetch via football-data.org + pg_cron + admin-lock).

Project-specific invariants verified:
- `/api/score-fetch` lives under `api/score-fetch/` (no leading underscore) — route is reachable.
- Migration 0013's `prop_answers_read` policy correctly drops `starts_at` and references `auth.uid()` only; migration-time DO-block smoke enforces both invariants.
- Migration 0012 reads the Vault secret (`vault.decrypted_secrets where name = 'score_fetch_secret'`); smoke check rejects legacy GUC patterns.
- `/me/props/page.tsx` uses the user-scoped `createClient` (not service-role) — RLS gates apply.
- saveResult's bracket writeback is wrapped in try/catch — non-fatal for league scoring.
- saveResult clears `auto_fetched_at` on admin overwrite — cron will not re-overwrite admin entry.
- No physical-direction Tailwind utilities introduced in the submitted files.

However, the implementation has **two BLOCKER-class defects** and several quality concerns that should be fixed before this ships.

## Critical Issues

### CR-01: Admin-lock invariant bypassed on cron retry when DB UPDATE succeeds but UPSERT/sweep fails (BLOCKER)

**File:** `src/app/api/score-fetch/route.ts:122-135` (UPDATE) → `162-172` (sweep)
**Issue:**
The cron uses SELECT-then-UPDATE to enforce the admin-lock invariant correctly on the **first** tick. The `adminEntered` JS check at line 118-120 is `(result_home_90min !== null && auto_fetched_at === null)`. After the UPDATE at line 123-130 commits, the row now has `result_home_90min = h` AND `auto_fetched_at = <now-ISO>`.

If `sweepAndUpsert` then fails (line 168 — `if (!sweepRes.ok) ... continue;`), the route logs and skips. There is no compensating rollback of the fixture UPDATE. The fixture row is now in state `(result NOT NULL, auto_fetched_at NOT NULL)` — which is the "auto-fetched, scoring incomplete" state, **invisible to any future invariant check** because the existing admin-lock predicate (`adminEntered = result !== null && auto_fetched_at === null`) only detects manual entries.

This in itself isn't an admin-lock violation, but it creates a real consistency bug:
1. After such a partial failure, the fixture displays a real score in the UI (via bracket page, matches page, etc.).
2. No `score_events` rows exist for that fixture.
3. `v_leaderboard` is silently wrong for everyone who predicted that fixture.
4. On the next */15 cron tick, the same FINISHED match arrives, `adminEntered` is false (auto_fetched_at not null), and `result_home_90min IS NULL` is also false → the route proceeds. Lines 123-130 UPDATE the row again (idempotent, same scores). Then sweepAndUpsert is retried. **If the original failure was transient, this recovers.** **If the original failure was deterministic (e.g. a malformed prediction row triggers a Zod-like throw upstream that's not caught here, or RLS misconfig on score_events), the leaderboard will stay wrong for the whole tournament.**

Compounding factor: `scoreMatch` (line 149) and `sweepAndUpsert` errors are caught by per-fixture `continue` but only logged via `console.error` — there is no metric, alert, or admin-visible indicator. The integrity widget (only shows "unscored completed matches") looks at fixtures with `result_home_90min IS NOT NULL` and missing score_events, so this would surface there, but only if an admin checks. Given the tournament-critical timeline, this is BLOCKER-class because:
- A single bad prediction row can permanently corrupt the leaderboard for that fixture.
- The cron's "swallow errors, return 200" stance hides the failure from the scheduler.
- There is no automatic retry of the scoring step alone — only a full re-UPDATE-and-sweep cycle.

**Fix:**
Decouple "score fetched" from "scoring complete" — either (a) do not UPDATE the fixture until sweepAndUpsert succeeds (move UPDATE *after* the sweep), or (b) keep two timestamp columns (`auto_fetched_at` and `auto_scored_at`) and only mark the fixture as scored when both succeed, or (c) on sweep failure, restore the previous fixture state. Simplest fix:

```ts
// 1. Compute scoring rows FIRST (before mutating fixture row).
const { data: preds, error: predErr } = await svc
  .from('predictions')
  .select('user_id, home_score, away_score')
  .eq('fixture_id', fixtureId);
if (predErr) { console.error(...); continue; }

const rows: ScoreEventRow[] = (preds ?? []).map(/* ... */);

const sweepRes = await sweepAndUpsert({ svc, source: 'league', ref_id: fixtureId, rows });
if (!sweepRes.ok) { console.error('score-fetch sweep error', sweepRes.error); continue; }

// 2. Only NOW commit the fixture row — if scoring fails, fixture stays NULL and
//    the next */15 tick retries the entire path cleanly.
const { error: upErr } = await svc
  .from('fixtures')
  .update({ result_home_90min: h, result_away_90min: a, auto_fetched_at: new Date().toISOString() })
  .eq('id', fixtureId);
if (upErr) { console.error('score-fetch update error', upErr); continue; }
```

Note that this also fixes a latent issue where, between the UPDATE and the predictions SELECT, the user table view (bracket page) briefly shows a score but the leaderboard hasn't moved — small, but observable to users mashing F5.

---

### CR-02: `permanentRedirect()` in /props page does not lock the locale segment — locale-injection vector (BLOCKER)

**File:** `src/app/[locale]/props/page.tsx:14-17`
**Issue:**
```ts
export default async function PropsLegacyRedirect({ params }: Props) {
  const { locale } = await params;
  const safeLocale = locale === 'he' ? 'he' : 'en';
  permanentRedirect(`/${safeLocale}/me/props`);
}
```

The `safeLocale` narrowing is correct for the dictionary lookup, but `permanentRedirect` performs a 308 redirect to a URL constructed from a user-controlled path segment. Although `params.locale` is constrained by next-intl middleware to a known set, the redirect URL is not run through any `localePrefix`-aware helper (the project uses `@/lib/i18n/routing`'s `Link` everywhere else for locale-prefixed navigation — see `src/app/[locale]/me/page.tsx:5,74`).

Three concerns:
1. If next-intl is configured with a non-default `localePrefix` mode (e.g. `'as-needed'`), the redirect target `/en/me/props` is wrong for the default locale (should be `/me/props`). Result: 404 on the redirect target.
2. The narrowing forces every non-`'he'` locale to redirect to `/en/...` — if a third locale is ever added (no plans in this MVP), every locale falls through to English silently.
3. **More importantly**: `permanentRedirect` triggers a **permanent** browser cache. If the canonical surface moves again, every browser that hit `/props` once will be locked on the 308 forever. The Phase 1 P02 "append-only migrations" pattern (cite from CLAUDE.md) doesn't apply to redirects, but the operational risk is real — recovery requires changing the path entirely. Given this is a 3-week pre-tournament project with active iteration, a `permanentRedirect` is operationally fragile.

**Fix:**
Use `redirect()` (302) instead of `permanentRedirect()` for the duration of v1, and use the typed routing helper:

```ts
import { redirect } from 'next/navigation';
import { type Locale } from '@/lib/i18n/routing';

export default async function PropsLegacyRedirect({ params }: Props) {
  const { locale } = await params;
  const safeLocale: Locale = locale === 'he' ? 'he' : 'en';
  redirect(`/${safeLocale}/me/props`);
}
```

Post-tournament, once routing is stable, upgrade to `permanentRedirect`.

## Warnings

### WR-01: `tournament` SELECT in score-fetch returns wrong row if multiple tournaments exist

**File:** `src/app/api/score-fetch/route.ts:54-59`
**Issue:**
```ts
const { data: tour } = await svc
  .from('tournament')
  .select('starts_at, ends_at')
  .order('starts_at', { ascending: true })
  .limit(1)
  .maybeSingle();
```

There is no `tournament` filter — assumes exactly one tournament row exists, and that the earliest-starting row is the active one. The seed (0005/0006) writes WC2026, but the table accepts multiple via a UNIQUE on `code` only. If a maintainer ever runs the WC2026 reseed against a DB that has a different test tournament with an earlier `starts_at`, the cron silently uses the wrong window and skips real WC2026 fetches.

Same pattern appears in `src/app/[locale]/me/page.tsx:36-41`, `src/app/[locale]/me/props/page.tsx:31-36`. All three should pin to `code = 'WC2026'`.

**Fix:**
```ts
const { data: tour } = await svc
  .from('tournament')
  .select('starts_at, ends_at')
  .eq('code', 'WC2026')
  .maybeSingle();
```

If multi-tournament is intentional for some future test scenario, store the active code in an env var and read it.

---

### WR-02: PropReceipt renders "miss" badge for ungraded answers when score row is present with kind=null

**File:** `src/components/props/PropReceipt.tsx:73`
**Issue:**
```ts
const ptsKind: PtsKind = (score?.kind as PtsKind | undefined) ?? 'miss';
```

The receipt's branching at line 101 says: if `score` row exists, render the `PtsBadge` with `ptsKind`. The `score_events.kind` column is `string | null` per `src/types/supabase.ts:389` — and graded props legitimately store `null` for some reason categories. When `score.kind === null`, the `??` coalescing fires and the badge renders as `'miss'` regardless of `score.points`.

If `score.points > 0` and `kind === null` (which the schema permits), the badge says "missed" while showing positive points — confusing and incorrect.

**Fix:**
Compute kind from points if null:
```ts
const computedKind: PtsKind = (score?.kind as PtsKind | undefined)
  ?? (score && score.points > 0 ? 'correct' : 'miss');
```

Or audit `gradeProp` to guarantee `kind` is set when a row is written, and tighten the column to `NOT NULL` in a follow-up migration.

---

### WR-03: `slotsUpdated` returns `null` (not `[]`) on RLS-filtered empty result — Final → CHAMPION cascade silently skips

**File:** `src/app/actions/saveResult.ts:137-149`
**Issue:**
```ts
const { data: slotsUpdated } = await svc
  .from('bracket_slots')
  .update({ resolved_team_id: winnerId })
  .eq('fixture_id', fixture_id)
  .select('slot_code');

if (slotsUpdated && slotsUpdated.some((s) => s.slot_code === 'F')) {
```

The error handler is `data` only — `error` is destructured but not captured. If the UPDATE fails for any reason (RLS denial despite service-role, network blip, etc.), `slotsUpdated` is `null` and the Champion cascade silently skips. The whole bracket writeback is inside a try/catch that just logs — so a failed Final result leaves the CHAMPION slot empty forever (until next admin save of the same fixture).

Compounding: the third-place match (external_match_no=103, stage='third_place', slot_code does NOT exist — confirmed via 0006 seed which only seeds `'F' final` + `CHAMPION` for the late stages) would silently update zero slots — that's intentional, but indistinguishable from the Final UPDATE-failure case.

**Fix:**
Capture and log the error:
```ts
const { data: slotsUpdated, error: slotUpdErr } = await svc
  .from('bracket_slots')
  .update({ resolved_team_id: winnerId })
  .eq('fixture_id', fixture_id)
  .select('slot_code');

if (slotUpdErr) {
  console.warn('saveResult: bracket slot update failed', slotUpdErr);
  // fall through — non-fatal
} else if (slotsUpdated && slotsUpdated.some((s) => s.slot_code === 'F')) {
  // ... cascade ...
}
```

---

### WR-04: Tournament-window gate fails OPEN when tournament row missing — sends real cron load with bad config

**File:** `src/app/api/score-fetch/route.ts:62-68`
**Issue:**
```ts
const startsAt = tour ? new Date(tour.starts_at).getTime() : Number.POSITIVE_INFINITY;
const endsAt   = tour ? new Date(tour.ends_at).getTime()   : Number.NEGATIVE_INFINITY;
const inWindow = now >= startsAt - 3_600_000 && now <= endsAt + 86_400_000;
```

When `tour` is null (DB inconsistency, mid-migration, wrong tournament code), `startsAt=+Infinity` and `endsAt=-Infinity`. The check becomes `now >= +Infinity - 1h && now <= -Infinity + 1d` → both false → `inWindow = false` → returns "outside-window".

This **is fail-closed for the cron's HTTP request**, which is good. But the same SELECT pattern in `tour` evaluates `tour?.starts_at` once and reuses both ends — there's no error logging when the tournament row is missing. So if Vault secret rotation goes well but the seed migration silently fails, the cron returns 200 + `skipped: 'outside-tournament-window'` every 15 minutes for the entire tournament and **nobody knows**.

**Fix:**
Log when `tour` is null:
```ts
if (!tour) {
  console.error('score-fetch: tournament row not found — cron will be a no-op');
  return NextResponse.json({ ok: true, skipped: 'no-tournament' });
}
```

---

### WR-05: `fetchWcMatches` sanitizer drops legitimate team names with apostrophes and other unicode

**File:** `src/lib/score-fetch/footballData.ts:29`
**Issue:**
```ts
const SAFE_NAME_REGEX = /^[\p{L}\d \-.,'()]{1,80}$/u;
```

The regex allows ASCII apostrophe `'` but not the typographic apostrophe `'` (U+2019) that some sports APIs use. Côte d'Ivoire is FIFA-rostered; football-data.org's name field can come back as `"Côte d'Ivoire"` (ASCII apostrophe) most of the time but vendor data hygiene is not guaranteed. If the vendor flips to `"Côte d'Ivoire"`, the row is dropped from the result with a `console.warn` and the fixture goes unscored.

Also: the regex requires the entire string to match. `\p{L}` covers all Unicode letters, but does NOT include the Hebrew geresh/gershayim or some combining marks. For purely vendor team names this is unlikely to matter, but Mauritania (`موريتانيا`) and similar Arabic-script names would pass `\p{L}` — so this is purely the apostrophe risk.

**Fix:** Include U+2019 and a couple of other safe punctuation chars commonly seen in FIFA-roster names:
```ts
const SAFE_NAME_REGEX = /^[\p{L}\d \-.,''`()]{1,80}$/u;
```

Better: don't gate on the name at all — `tla` is the only field we use for resolution (`resolveFixture` matches on TLA), and React's auto-escape on render is the actual XSS defense for the UI. The name field is unused downstream of `fetchWcMatches`. Consider removing the name sanitizer and trusting React.

---

### WR-06: `resolveFixture` accepts `1.0` (any float) as `kickoff_at` timestamp parse — sees NaN-equivalent rows

**File:** `src/lib/score-fetch/resolveFixture.ts:24-25`
**Issue:**
```ts
const kickoff = new Date(ext.utcDate);
if (Number.isNaN(kickoff.getTime())) return null;
```

This rejects clearly-broken dates, but `new Date('')` returns Invalid Date (caught) — however `new Date('2026')` returns a valid Date (Jan 1, 2026). The upstream `fetchWcMatches` falls back to `''` if `obj.utcDate` is not a string (`footballData.ts:115`), which is correctly caught. But if the vendor returns a partial date string (`"2026-06-11"` with no time) the parser silently treats it as UTC midnight — outside the ±5min window of an actual fixture, so it just returns null (good behavior).

This is informational — current logic is correct. Adding a stricter check (e.g. require ISO-8601 with time) would be defense-in-depth.

**Fix (optional):**
```ts
if (Number.isNaN(kickoff.getTime()) || !ext.utcDate.includes('T')) return null;
```

---

### WR-07: `me/props/page.tsx` constructs `Map` keyed on UUIDs but iterates over all `answers` even though RLS already filters

**File:** `src/app/[locale]/me/props/page.tsx:71-76`
**Issue:**
```ts
const ownAnswerByQuestion = new Map<string, string>();
for (const a of answers ?? []) {
  if (a.user_id === member.user_id) {
    ownAnswerByQuestion.set(a.question_id, a.answer);
  }
}
```

The comment at line 66 correctly states "RLS (post-0013) filters to own answers ONLY — no client-side filter needed." But the loop body still has a `if (a.user_id === member.user_id)` guard. This is harmless (always-true post-0013) and arguably defense-in-depth, but it's vestigial code that hides the actual security invariant. If migration 0013 is ever reverted or RLS breaks, this client-side filter still keeps the page private — making the defect harder to detect in test.

Either commit to "RLS is the only filter" and remove the JS check (so RLS regressions surface immediately), or make the JS check explicit defense-in-depth with a console.error if it ever filters anything out.

**Fix (option A — trust RLS):**
```ts
for (const a of answers ?? []) {
  ownAnswerByQuestion.set(a.question_id, a.answer);
}
```

**Fix (option B — defense in depth + tripwire):**
```ts
for (const a of answers ?? []) {
  if (a.user_id !== member.user_id) {
    console.error('me/props: RLS leak detected — prop_answer for foreign user_id', { question_id: a.question_id });
    continue;
  }
  ownAnswerByQuestion.set(a.question_id, a.answer);
}
```

---

### WR-08: BracketTree stage map references `'champion'` stage but the seed never produces a `<li>` for it via the renderer's slot loop — only via the special `slot.stage === 'champion'` branch in SlotRow

**File:** `src/components/bracket/BracketTree.tsx:18-26` + `src/components/bracket/SlotRow.tsx:57-69`
**Issue:**
`STAGE_ORDER` includes `'champion'` last. The grouped `champion` slots flow into the `<ul>` map at line 78 — which renders a `SlotRow` for each. The SlotRow then special-cases `slot.stage === 'champion'` at line 57 to render the trophy block with `slot.resolved_team`. That works.

However, the `'third_place'` stage is in `STAGE_ORDER` between `'final'` and `'champion'`. The seed (0006) seeds a `'third_place'` fixture row (external_match_no=103) but does NOT seed a `bracket_slots` row with `stage='third_place'`. So the bracket page silently omits the third-place section — `grouped['third_place'].length === 0` → `return null`.

This is a real product gap: there is no third-place slot in the read-only bracket view. The plan summary mentions "column-of-rounds" should show all stages. Without a `bracket_slots` row for the third-place match, the user has no way to see that fixture from /bracket — they have to go to /matches.

**Fix:**
Add a `TP` slot to the seed:
```sql
((select tournament_id from t), 'TP', 'third_place',
 (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 103)),
```

Until that ships, the bracket view is incomplete.

## Info

### IN-01: Hebrew bundle missing `admin.*` namespace (pre-existing, not flagged as new)

**File:** `messages/he.json`
**Issue:** All 40 keys under `admin.*` in `messages/en.json` are absent from `messages/he.json`. Confirmed via JSON-key diff. This is **pre-existing** (commits 409a8d2 and 3474a54 from the 02-05/02-06 sprints introduced `admin.*` to EN only). It's not introduced by 02-09..02-12, so out of scope for this review. Recommend a follow-up to add the Hebrew admin strings — Hebrew-speaking admins currently see raw English key text or `MISSING_MESSAGE` placeholders in the admin tree.

**Fix:** Add `admin.*` namespace to `messages/he.json` with translated equivalents.

---

### IN-02: `safeLocale` narrowing duplicated across pages

**File:** `src/app/[locale]/bracket/page.tsx:30`, `src/app/[locale]/me/props/page.tsx:26`, `src/app/[locale]/props/page.tsx:16`
**Issue:**
```ts
const safeLocale: 'he' | 'en' = locale === 'he' ? 'he' : 'en';
```

Repeated four times across the submitted files. Should be a one-line helper:
```ts
// src/lib/i18n/safeLocale.ts
export type Locale = 'he' | 'en';
export const toLocale = (s: string): Locale => (s === 'he' ? 'he' : 'en');
```

**Fix:** Extract helper; replace the four call sites.

---

### IN-03: `revalidatePath` array has 10 entries despite docstring saying "8"

**File:** `src/lib/scoring/sweepAndUpsert.ts:58-69`
**Issue:**
The comment at line 27 says "8 explicit per-locale paths". The actual `REVALIDATE_PATHS` array has **10** entries (added `/he/bracket`, `/en/bracket` in Plan 02-11). The comment at line 56 ("8 explicit per-locale × per-page combinations") is now stale.

Also, the docstring at saveResult.ts line 57 says "the 8 explicit per-locale paths" — also stale.

**Fix:** Update docstrings to "10" or, better, write `${REVALIDATE_PATHS.length} explicit ...` to avoid future drift.

---

### IN-04: PostgREST `.in()` IN-list construction in sweepAndUpsert.ts is technically unsafe for non-UUID strings

**File:** `src/lib/scoring/sweepAndUpsert.ts:83-85`
**Issue:**
```ts
const keepUserIds = rows.map((r) => r.user_id);
const inList = keepUserIds.length > 0 ? `(${keepUserIds.join(',')})` : '(null)';
```

UUIDs from Supabase auth are safe (only `[0-9a-f-]`). The helper, however, accepts `ScoreEventRow.user_id: string` with no schema constraint. If this helper is ever reused for a non-UUID source (e.g. text-keyed users in a hypothetical future migration), comma-injection becomes possible. Not exploitable today, but the pattern is brittle.

**Fix:** Add a defensive cast / Zod parse, or use Supabase's structured `.in()` API to bypass string construction:
```ts
const { error: delErr } = keepUserIds.length > 0
  ? await svc.from('score_events').delete().eq('source', source).eq('ref_id', ref_id).not('user_id', 'in', `(${keepUserIds.join(',')})`)
  : await svc.from('score_events').delete().eq('source', source).eq('ref_id', ref_id); // delete all when nobody to keep
```

(Note: `.not('user_id', 'in', '(null)')` does NOT NOT-IN against literal NULL in PostgreSQL semantics — the comment's claim that this is a "no-op delete" may be wrong if PostgREST emits `WHERE user_id NOT IN (NULL)` which evaluates to UNKNOWN → row excluded → the DELETE deletes everything OR nothing depending on PostgREST's handling. Worth double-checking with an integration test — but since `rows.length > 0` is the normal case, this branch is rarely hit.)

---

### IN-05: `PtsKind` type-cast in PropReceipt.tsx is unsafe

**File:** `src/components/props/PropReceipt.tsx:73`
**Issue:**
```ts
const ptsKind: PtsKind = (score?.kind as PtsKind | undefined) ?? 'miss';
```

The DB column `score_events.kind` is `string | null` per generated types. Casting to `PtsKind` (which is presumably a closed union) hides any drift between the DB enum/constraint and the TypeScript union. If a future scoring branch writes a new kind value, this silently coerces it and `PtsBadge` renders something unexpected.

**Fix:** Add a runtime guard:
```ts
const KNOWN_KINDS: ReadonlySet<PtsKind> = new Set(['exact', 'goal-diff', 'winner', 'miss', 'correct']);
const rawKind = score?.kind ?? null;
const ptsKind: PtsKind = rawKind && KNOWN_KINDS.has(rawKind as PtsKind) ? (rawKind as PtsKind) : 'miss';
```

---

_Reviewed: 2026-05-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

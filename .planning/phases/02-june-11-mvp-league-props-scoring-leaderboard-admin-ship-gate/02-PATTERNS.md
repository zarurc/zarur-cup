# Phase 2: June 11 MVP — Pattern Map

**Mapped:** 2026-05-24
**Files analyzed:** 39 new + 6 modified = 45 total
**Analogs found:** 41 / 45 (4 net-new with no Phase-1 analog — Playwright config, scoring pure-lib, v_leaderboard VIEW, score_events table)

> Every Phase-2 file below lists: role + data-flow classification, the closest Phase-1 analog, and the concrete excerpts a planner can hand to an executor. Phase-1 RLS / GRANT / migration shape is inherited verbatim; Phase-2 only ADDS columns/tables/views, never edits 0001–0006.

---

## File Classification

### Migrations (`supabase/migrations/`)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `supabase/migrations/0007_score_events.sql` | migration (table + RLS + grants + B-style smoke) | RLS-enforced lock + idempotent UPSERT projection | `supabase/migrations/0002_rls.sql` (RLS shape) + `0003_grants.sql` (GRANT shape) + `0001_init.sql` (table shape) | composite — three analogs, one new file |
| `supabase/migrations/0008_v_leaderboard.sql` | migration (VIEW + GRANT) | derived projection, read-only aggregation | none (Phase 1 has no VIEWs) — `0003_grants.sql` for GRANT shape | partial — GRANT pattern only |
| `supabase/migrations/0009_fixtures_result_full.sql` | migration (ALTER TABLE add columns) | additive schema change for forward-compat | `0001_init.sql:65-68` (the `result_home_90min` column block) | exact for column definitions, but ALTER not CREATE |
| `supabase/migrations/0010_prop_questions_aliases.sql` | migration (ALTER TABLE add `text[]` column) | additive schema change | `0001_init.sql:132-144` (prop_questions table block) | exact for column choice / nullable / default semantics |

### Server Actions (`src/app/actions/`)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/app/actions/savePrediction.ts` | server action (user-scoped, anon JWT, RLS-bound) | mutate-and-stay (debounced from client; no redirect) | `src/app/actions/locale.ts` (single-purpose action returning void/state) — but **NO existing analog for mutate-and-stay** | role-match — must NOT use Phase 1 `<form action> + redirect()` pattern; combine with React 19 `startTransition` pattern from RESEARCH §Pattern 3 |
| `src/app/actions/savePropAnswer.ts` | server action (user-scoped) | mutate-and-stay | same as `savePrediction.ts` | role-match (same shape) |
| `src/app/actions/saveResult.ts` | server action (admin, service-role) | mutate-and-stay; idempotent UPSERT sweep; revalidatePath fan-out | `src/app/actions/join.ts:172-230` (`rebindExistingProfile` — service-role + admin-ish action body with multi-step UPDATE) | role-match — exact service-role + multi-step pattern; differs in `requireAdmin()` gate (new) |
| `src/app/actions/gradeProp.ts` | server action (admin, service-role) | mutate-and-stay; same UPSERT sweep | same as `saveResult.ts` | role-match (same shape) |
| `src/app/actions/resolvePlaceholder.ts` | server action (admin, service-role) | mutate-and-navigate (back to /admin/tournament-tree) | `src/app/actions/join.ts:103-148` (Zod validate → service action → `redirect()`) | exact — both validate, run multi-step UPDATEs, then `redirect()` |
| `src/app/actions/mergeUsers.ts` | server action (admin, service-role) | mutate-and-redirect; FK rebind | `src/app/actions/join.ts:172-230` (`rebindExistingProfile`) | **exact** — same FK-rebind loop, same `svc.auth.admin.deleteUser()` |

### Pure libraries (`src/lib/`)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/lib/scoring/league.ts` | pure scoring lib | request-response (pure function, no DB) | none — net new | **no analog** (see "No Analog Found" below; use RESEARCH §Pattern 4 verbatim) |
| `src/lib/scoring/props.ts` | pure scoring lib | request-response | none — net new | **no analog** (see "No Analog Found"; use RESEARCH §Pattern 4) |
| `src/lib/scoring/sweepAndUpsert.ts` | server-only helper (DB sweep + UPSERT + revalidatePath) | mutate-and-stay shared helper | `src/app/actions/join.ts:212-219` (FK loop pattern) | role-match — both iterate a small set of write ops under service-role |
| `src/lib/auth/adminReadClient.ts` (recommended new helper) | server-only auth gate + service-role read client | request-response read | `src/lib/auth/session.ts:62-67` (`requireAdmin()`) + `src/lib/supabase/service.ts:15-23` (`createServiceClient()`) | composite — wraps both |
| `src/lib/schemas/prediction.ts` | Zod schema (shared client/server) | request-response validate | `src/lib/schemas/join.ts` + `src/lib/schemas/displayName.ts` | exact — same Zod-4 pattern, `.trim()`, `.regex()`, codes |
| `src/lib/schemas/result.ts` | Zod schema (admin input) | request-response validate | `src/lib/schemas/join.ts` | exact |
| `src/lib/schemas/propAnswer.ts` | Zod schema (discriminated union by `answer_type`) | request-response validate | `src/lib/schemas/displayName.ts` (regex + refine) | role-match — Phase 1 has no discriminated-union schema, but the building blocks are there |
| `src/lib/schemas/propAuthoring.ts` | Zod schema (admin author + grade) | request-response validate | same as `propAnswer.ts` | role-match |

### Pages — Player (`src/app/[locale]/`)

| File | Action | Role | Data Flow | Closest Analog | Match Quality |
|------|--------|------|-----------|----------------|---------------|
| `src/app/[locale]/matches/page.tsx` | **MODIFY** (replace empty state) | RSC page (read-only via anon JWT) | RSC + Server Action mutate-and-stay (children) | `src/app/[locale]/me/page.tsx` (RSC reading own data + `Intl.DateTimeFormat`) | exact — same RSC shape, same `requireMember()` + `setRequestLocale()` + `getTranslations()` |
| `src/app/[locale]/props/page.tsx` | **NEW** | RSC page | RSC + Server Action mutate-and-stay (children) | same as matches | exact (same scaffold) |
| `src/app/[locale]/leaderboard/page.tsx` | **MODIFY** (replace empty state) | RSC page | RSC; read v_leaderboard, TS-side sort | same as matches | exact (same scaffold) |

### Pages — Admin (`src/app/admin/(protected)/`)

| File | Action | Role | Data Flow | Closest Analog | Match Quality |
|------|--------|------|-----------|----------------|---------------|
| `src/app/admin/(protected)/layout.tsx` | **MODIFY** (append `<IntegrityWidget/>` after children) | RSC layout with admin gate | request-response + always-mounted widget | `src/app/admin/(protected)/layout.tsx` itself (Phase 1 — append-only edit) | self — extending existing |
| `src/app/admin/(protected)/page.tsx` | **MODIFY** (replace placeholder with admin home nav) | RSC | request-response | `src/app/admin/(protected)/page.tsx` (replace placeholder) | self |
| `src/app/admin/(protected)/matches/page.tsx` | **NEW** | admin RSC page (service-role reads via `adminReadClient`) | mutate-and-stay (Save Result button per row) | `src/app/admin/(protected)/page.tsx` + `src/app/[locale]/matches/page.tsx` | composite — Phase 1 has no full admin page yet |
| `src/app/admin/(protected)/tournament-tree/page.tsx` | **NEW** | admin RSC page | mutate-and-navigate | same | composite |
| `src/app/admin/(protected)/props/page.tsx` | **NEW** | admin RSC page (author + grade) | mutate-and-stay | same | composite |
| `src/app/admin/(protected)/roster/page.tsx` | **NEW** | admin RSC page (list + merge button) | mutate-and-redirect | same | composite |

### Components — UI primitives (`src/components/ui/`)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/components/ui/PtsBadge.tsx` | server-renderable presentational | display-only | `src/components/layout/EmptyStateCard.tsx` (same minimal-props server component) | role-match (presentational, tokens) |
| `src/components/ui/SavedIndicator.client.tsx` | client presentational (keyed-mount CSS animation) | display-only (parent-controlled lifecycle) | **no Phase-1 analog for transient-CSS-animation** — closest is `src/components/layout/LocaleTogglePill.client.tsx` (client component, focus-visible ring) | partial — token use only |

### Components — Matches (`src/components/matches/`)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/components/matches/MatchRowStepper.client.tsx` | client interactive (debounced Server Action dispatch) | mutate-and-stay | `src/components/auth/JoinForm.client.tsx` (only existing `'use client'` form component) | role-match — JoinForm is `useActionState` (mutate-and-navigate); stepper needs `useTransition` per RESEARCH §Pattern 3 |
| `src/components/matches/MatchRow.client.tsx` | client (variant chooser) | request-response | `src/components/auth/JoinForm.client.tsx` (component tree shape) | partial |
| `src/components/matches/MatchRowLocked.tsx` | server presentational | display-only | `src/components/layout/EmptyStateCard.tsx` | role-match (tokens, logical properties) |
| `src/components/matches/MatchRowResulted.tsx` | server presentational | display-only | same as `MatchRowLocked` | role-match |
| `src/components/matches/CountdownBanner.client.tsx` | client interactive (1s tick) | display-only (no Server Action) | `src/components/layout/LocaleTogglePill.client.tsx` (`'use client'` + uses params/hooks) | partial — only token-use pattern overlaps |
| `src/components/matches/DateGroupHeader.tsx` | server presentational | display-only | `src/components/layout/Header.tsx` (sticky + tokens + logical properties) | role-match — sticky-positioning conventions |

### Components — Props (`src/components/props/`)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/components/props/PropCard.client.tsx` | client interactive | mutate-and-stay | same as `MatchRowStepper.client.tsx` | role-match |
| `src/components/props/FlagGrid.client.tsx` | client interactive (radio-style grid) | mutate-and-stay | same as `MatchRowStepper.client.tsx` | role-match |

### Components — Leaderboard (`src/components/leaderboard/`)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/components/leaderboard/LeaderboardRow.client.tsx` | client interactive (inline expand) | display-only | `src/components/layout/LocaleTogglePill.client.tsx` (client + tokens) | partial — token-use only |

### Components — Admin (`src/components/admin/`)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/components/admin/AdminModeToggle.client.tsx` | client interactive (URLSearchParam toggle) | mutate-and-navigate (router push) | `src/components/layout/LocaleTogglePill.client.tsx` (form-action + hidden field + navigation) | role-match — both are "toggle that changes URL" |
| `src/components/admin/AdminResultInputs.client.tsx` | client interactive | mutate-and-stay (explicit Save button) | `src/components/auth/JoinForm.client.tsx` (form + submit button) | role-match |
| `src/components/admin/IntegrityWidget.tsx` | server presentational (data-fetching RSC) | request-response | `src/app/[locale]/me/page.tsx` (RSC fetch + render) | role-match — both RSC + read DB + render |

### Tests (`tests/e2e/`)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `tests/e2e/playwright.config.ts` | test runner config | n/a | none — Playwright not yet installed | **no analog** (use RESEARCH §"Playwright smoke architecture") |
| `tests/e2e/smoke.spec.ts` | E2E spec (multi-context) | request-response (over HTTP) | none | **no analog** (use RESEARCH skeleton at lines 946-997) |
| `tests/e2e/fixtures/auth.ts` | test helper | n/a | none | **no analog** |
| `data/test-fixtures.sql` | test seed SQL | n/a | `supabase/migrations/0006_reseed_wc2026.sql` (seed shape) | role-match |

### Messages / Tooling (modify)

| File | Action | Role | Data Flow | Closest Analog | Match Quality |
|------|--------|------|-----------|----------------|---------------|
| `messages/en.json` | **MODIFY** (extend with Phase-2 keys per UI-SPEC) | i18n bundle | display-only | self (extend in place) | self |
| `messages/he.json` | **MODIFY** | i18n bundle | display-only | self | self |
| `package.json` | **MODIFY** (add Playwright dep + scripts + new `lint:tailwind-v4`) | config | n/a | `package.json:11` (`lint:rtl` script shape) | role-match |
| `.husky/pre-commit` | **MODIFY** (add `lint:tailwind-v4`) | hook config | n/a | self | self |
| `.github/workflows/lint.yml` | **MODIFY** (add `lint:tailwind-v4`) | CI config | n/a | self | self |
| `src/types/supabase.ts` | **REGENERATE** after each migration | generated types | n/a | self (`npm run db:types`) | self |

---

## Pattern Assignments

### `src/app/actions/savePrediction.ts` (user-scoped, mutate-and-stay)

**Analog:** `src/app/actions/locale.ts` (single-purpose `'use server'` action without `redirect()`) — and **negative analog** `src/app/actions/join.ts` (mutate-and-navigate; DO NOT mirror the `redirect()` at end).

**`'use server'` + auth + Zod validate** (mirror `join.ts:62-78`):

```typescript
// src/app/actions/savePrediction.ts (planner finalizes)
'use server';

import { revalidatePath } from 'next/cache';
import { predictionSchema } from '@/lib/schemas/prediction';
import { createClient } from '@/lib/supabase/server';

export type SavePredictionResult = { ok: true } | { ok: false; error: 'locked' | 'validation' | 'network' };

export async function savePrediction(input: unknown): Promise<SavePredictionResult> {
  const parsed = predictionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const { fixture_id, home_score, away_score } = parsed.data;

  // anon JWT (RLS-bound). RLS enforces kickoff_at > now() on INSERT/UPDATE.
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false, error: 'locked' };

  const { error } = await supabase
    .from('predictions')
    .upsert(
      { user_id: claims.claims.sub, fixture_id, home_score, away_score },
      { onConflict: 'user_id,fixture_id' },
    );

  if (error) {
    // 42501 / RLS violation = kickoff has passed (server-anchored lock per D-08)
    return { ok: false, error: error.code === '42501' ? 'locked' : 'network' };
  }

  // Mutate-and-stay: revalidate the page but DO NOT redirect.
  // Explicit per-locale per Pitfall 6.
  revalidatePath('/he/matches');
  revalidatePath('/en/matches');
  return { ok: true };
}
```

**Critical differences from `join.ts`:**
- **NO** `redirect()` at end (mutate-and-stay; client `useTransition` rerenders).
- **NO** `<form action>` — client component calls this with `startTransition(async () => savePrediction(...))` (RESEARCH §Pattern 3).
- Uses `createClient()` (anon JWT) — RLS is the lock per D-08.

**Landmines:**
- Phase 1 Pattern 14 says "Server Actions that mutate AND navigate use `<form action> + redirect()`". This action is mutate-and-stay; explicitly inverted. Document in JSDoc.
- React 19 Action queue serializes — client MUST debounce 600ms (Pitfall 3).

---

### `src/app/actions/saveResult.ts` (admin, mutate-and-stay, sweep+UPSERT)

**Analog:** `src/app/actions/join.ts:172-230` (`rebindExistingProfile`) — service-role multi-step pattern.

**Service-role + admin gate + multi-step UPDATE/INSERT** (mirror lines 177-219):

```typescript
// src/app/actions/saveResult.ts (planner finalizes)
'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/service';
import { resultSchema } from '@/lib/schemas/result';
import { scoreMatch } from '@/lib/scoring/league';

export async function saveResult(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();                         // gate-first (mirror join.ts admin posture)
  const parsed = resultSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const { fixture_id, result_home_90min, result_away_90min } = parsed.data;

  const svc = createServiceClient();            // bypass RLS (mirror join.ts:177)

  // 1. Persist the result (D-12: only _90min in Phase 2).
  const { error: e1 } = await svc.from('fixtures')
    .update({ result_home_90min, result_away_90min, updated_at: new Date().toISOString() })
    .eq('id', fixture_id);
  if (e1) return { ok: false, error: e1.message };

  // 2. Read all predictions for this fixture (no RLS — svc bypasses).
  const { data: preds, error: e2 } = await svc
    .from('predictions')
    .select('user_id, home_score, away_score')
    .eq('fixture_id', fixture_id);
  if (e2) return { ok: false, error: e2.message };

  // 3. Score in TS + build UPSERT rows (D-19 PK shape).
  const rows = (preds ?? []).map((p) => {
    const { points, kind } = scoreMatch(p, { result_home_90min, result_away_90min });
    return { user_id: p.user_id, source: 'league', ref_id: fixture_id, points, kind };
  });

  // 4. DELETE stragglers (users who had a prediction but deleted it) before UPSERT.
  //    See RESEARCH §Pattern 5 "Edge case — predictions that no longer exist".
  const keepUserIds = rows.map((r) => r.user_id);
  await svc.from('score_events')
    .delete()
    .eq('source', 'league')
    .eq('ref_id', fixture_id)
    .not('user_id', 'in', `(${keepUserIds.join(',') || 'null'})`);

  // 5. Bulk UPSERT (D-18 idempotency via PK).
  if (rows.length > 0) {
    const { error: e3 } = await svc.from('score_events')
      .upsert(rows, { onConflict: 'user_id,source,ref_id' });
    if (e3) return { ok: false, error: e3.message };
  }

  // 6. Revalidate per-locale (Pitfall 6: explicit, not path-pattern).
  for (const path of ['/he/leaderboard','/en/leaderboard','/he/matches','/en/matches','/he/me','/en/me']) {
    revalidatePath(path);
  }
  return { ok: true };
}
```

**Landmines:**
- `requireAdmin()` MUST be called before any `createServiceClient()` use (mirror `join.ts:97-108` admin-status determination — though `join.ts` uses `isAdminDisplayName()` because that's the only place is_admin is set; this action uses `requireAdmin()` which reads `profiles.is_admin`).
- Service-role bypasses RLS — never `createClient()` here, even for the read step (Pitfall 10).
- `.not('user_id', 'in', ...)` PostgREST syntax: tricky. Planner verifies via `npm run db:types` after the UPSERT row shape lands.

---

### `src/app/actions/mergeUsers.ts` (admin, FK-rebind)

**Analog:** `src/app/actions/join.ts:172-230` (`rebindExistingProfile`) — **EXACT** match. Phase 2 D-14 explicitly says "same pattern as Phase 1 D-04 rebind."

**FK loop pattern to copy verbatim** (lines 212-219):

```typescript
// From src/app/actions/join.ts:212-219 — re-point FK children
const childTables = ['predictions', 'bracket_picks', 'prop_answers'] as const;
for (const table of childTables) {
  const { error } = await svc
    .from(table)
    .update({ user_id: opts.newUserId })
    .eq('user_id', oldUserId);
  if (error) return false;
}

// Then auth.admin.deleteUser (line 227)
await svc.auth.admin.deleteUser(oldUserId).catch(() => {});
```

**Phase 2 extension:** add `'score_events'` to the `childTables` tuple — the new Phase-2 table also keys on `user_id` with `ON DELETE CASCADE`, so without rebinding first, deleting the auth.users row would nuke score_events.

**Landmines:**
- `mergeUsers` ALSO needs to merge any `score_events` collisions (target user might already have a `(user, source, ref_id)` row — UPSERT with sum logic, or DELETE source rows). Plan must specify whether to sum points or keep target's. Recommendation: keep target's (no-op DELETE on source) since merge implies "the target is the canonical identity."
- `redirect()` at the end (mutate-and-navigate). Mirror `join.ts:147`.

---

### `src/app/actions/resolvePlaceholder.ts` (admin, mutate-and-navigate)

**Analog:** `src/app/actions/join.ts:103-148` (full Zod-validate → svc.update → redirect flow).

**Imports + shape to copy** (lines 1-12 + 147):

```typescript
'use server';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/service';
// ...
redirect('/admin/tournament-tree' as Route);  // mirror join.ts:147 redirect-with-Route-cast
```

**Landmines:**
- `redirect()` MUST be the last statement, after all awaits (Phase 1 Bug 4: race between client navigation and server UPDATE).
- The downstream cascade (placeholder → R16 → QF) is an app-code loop per D-11, NOT a recursive CTE. Mirror the FK loop pattern from `join.ts:212-219`.

---

### `src/lib/auth/adminReadClient.ts` (recommended NEW helper — RESEARCH Open Q3)

**Analog (composite):** `src/lib/auth/session.ts:62-67` + `src/lib/supabase/service.ts:15-23`.

**Compose pattern:**

```typescript
// src/lib/auth/adminReadClient.ts
import 'server-only';
import { requireAdmin } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * RSC helper: gate on admin + return a service-role client that BYPASSES RLS.
 *
 * Pitfall 10: admin RSCs that use createClient() (anon JWT) hit RLS like any
 * other user — the integrity widget would see only the admin's own predictions.
 * Always use this helper inside /admin/(protected)/* RSCs that read others'
 * data (matches list, roster, integrity, tournament-tree).
 */
export async function adminReadClient() {
  await requireAdmin();
  return createServiceClient();
}
```

**Landmines:**
- `'server-only'` import is non-negotiable (Phase 1 service.ts:1).
- Calling `requireAdmin()` may `redirect()` — caller must not await this inside a try/catch that suppresses redirects.

---

### `src/lib/scoring/sweepAndUpsert.ts` (shared helper for league + prop scoring)

**Analog:** `src/app/actions/join.ts:212-219` (loop pattern) + Phase-2 D-18 sweep semantics.

**Generic shape:**

```typescript
// src/lib/scoring/sweepAndUpsert.ts
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

type ScoreEventRow = {
  user_id: string;
  source: 'league' | 'prop' | 'bracket';
  ref_id: string;
  points: number;
  kind: string | null;
};

export async function sweepAndUpsert(opts: {
  svc: SupabaseClient;
  source: 'league' | 'prop';
  ref_id: string;
  rows: ReadonlyArray<ScoreEventRow>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { svc, source, ref_id, rows } = opts;

  // 1. DELETE stragglers (users who no longer have a prediction/answer).
  const keep = rows.map((r) => r.user_id);
  const { error: delErr } = await svc.from('score_events')
    .delete()
    .eq('source', source)
    .eq('ref_id', ref_id)
    .not('user_id', 'in', `(${keep.join(',') || 'null'})`);
  if (delErr) return { ok: false, error: delErr.message };

  // 2. Bulk UPSERT (D-18 idempotency).
  if (rows.length > 0) {
    const { error } = await svc.from('score_events')
      .upsert(rows as ScoreEventRow[], { onConflict: 'user_id,source,ref_id' });
    if (error) return { ok: false, error: error.message };
  }

  // 3. Per-locale revalidate (Pitfall 6).
  for (const path of ['/he/leaderboard','/en/leaderboard','/he/matches','/en/matches','/he/me','/en/me','/he/props','/en/props']) {
    revalidatePath(path);
  }
  return { ok: true };
}
```

**Landmines:**
- Both `saveResult` and `gradeProp` call this — duplicating the `revalidatePath` loop in each action is wrong (D-18 is one place).

---

### `src/lib/schemas/prediction.ts` (Zod 4 shared schema)

**Analog:** `src/lib/schemas/join.ts` + `src/lib/schemas/displayName.ts`.

**Imports + shape** (mirror `join.ts:1-14`):

```typescript
// src/lib/schemas/prediction.ts
import { z } from 'zod';

export const predictionSchema = z.object({
  fixture_id: z.string().uuid(),
  home_score: z.coerce.number().int().min(0).max(9),  // D-04 range
  away_score: z.coerce.number().int().min(0).max(9),
});

export type PredictionInput = z.infer<typeof predictionSchema>;
```

**Landmines:**
- `.coerce.number()` so the FormData → number path doesn't fail on stringified digits. `displayName.ts:17-23` doesn't need this; prediction does.
- Error codes: planner may want named codes (`'score_range'`, `'fixture_id_invalid'`) to mirror `displayName.ts:20-23`. Choose now or hard-code English error in client.

---

### `src/app/[locale]/matches/page.tsx` (MODIFY — RSC with grouping + variant render)

**Analog:** `src/app/[locale]/me/page.tsx` — exact RSC scaffold.

**Imports + scaffold to copy** (mirror `me/page.tsx:1-26`):

```typescript
// src/app/[locale]/matches/page.tsx (planner finalizes)
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { requireMember } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
// Phase 2 net-new
import { CountdownBanner } from '@/components/matches/CountdownBanner.client';
import { DateGroupHeader } from '@/components/matches/DateGroupHeader';
import { MatchRow } from '@/components/matches/MatchRow.client';

type Props = { params: Promise<{ locale: string }> };

export default async function MatchesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);             // mirror me/page.tsx:23
  const member = await requireMember(locale);
  const t = await getTranslations('matches');

  // Phase 2: replace empty state with feed.
  const supabase = await createClient();
  const { data: fixtures } = await supabase
    .from('fixtures')
    .select(`
      id, external_match_no, stage, group_code, kickoff_at,
      home_team_id, away_team_id, home_placeholder, away_placeholder,
      result_home_90min, result_away_90min,
      home_team:teams!fixtures_home_team_id_fkey ( id, code, name_en, name_he ),
      away_team:teams!fixtures_away_team_id_fkey ( id, code, name_en, name_he ),
      predictions ( user_id, home_score, away_score, submitted_at,
                    profiles:user_id ( display_name ) )
    `)
    .order('kickoff_at', { ascending: true });

  // ... group by local date via Intl.DateTimeFormat (RESEARCH lines 905-930) ...
}
```

**Locale-aware date format pattern** (mirror `me/page.tsx:27-30`):

```typescript
// From src/app/[locale]/me/page.tsx:27-30
const joinedAtLocal = new Intl.DateTimeFormat(
  locale === 'he' ? 'he-IL' : 'en-US',
  { dateStyle: 'long' },
).format(new Date(member.joined_at));
```

For matches, swap `dateStyle: 'long'` → `{ weekday: 'long', month: 'long', day: 'numeric' }` per D-01 + UI-SPEC §7.

**Landmines:**
- `setRequestLocale(locale)` BEFORE `getTranslations()` — Phase 1 Plan 01-04 lesson.
- `requireMember(locale)` for auth gate (NOT `requireAdmin()` — this is a player page).
- Pitfall 2: the embedded `predictions` array is RLS-filtered. Variant decision MUST key on `result_home_90min IS NOT NULL`, not on `predictions.length`.

---

### `src/app/admin/(protected)/matches/page.tsx` (admin RSC)

**Analog (composite):** `src/app/admin/(protected)/page.tsx` (admin scaffold — the layout already calls `requireAdmin`) + `src/app/[locale]/me/page.tsx` (RSC fetch shape).

**Auth note** (from `src/app/admin/(protected)/layout.tsx:19`):

```typescript
// Already enforced by parent layout:
await requireAdmin();   // src/app/admin/(protected)/layout.tsx:19
// Child pages should NOT call requireAdmin() again — redundant.
```

**Read pattern** (use NEW `adminReadClient()` helper, NOT `createClient()`):

```typescript
import { adminReadClient } from '@/lib/auth/adminReadClient';

export default async function AdminMatchesPage({ searchParams }: {
  searchParams: Promise<{ mode?: 'view' | 'entry' }>
}) {
  const { mode = 'view' } = await searchParams;
  const svc = await adminReadClient();   // RLS-bypassing read (Pitfall 10)
  const { data: fixtures } = await svc.from('fixtures').select('...').order('kickoff_at');
  // ...render with mode toggle (D-09) + AdminResultInputs per row when mode=='entry'
}
```

**Landmines:**
- DO NOT use `createClient()` (anon JWT) — admin needs to see ALL predictions for integrity (Pitfall 10).
- Admin pages are EN-only per Phase 1 D-05 — no `next-intl` `getTranslations()` is needed; use literal English strings or `messages/en.json` `admin.*` keys (UI-SPEC §"Admin strings").

---

### `src/app/admin/(protected)/layout.tsx` (MODIFY — append IntegrityWidget)

**Analog:** itself — Phase 1 already provides the admin gate.

**Existing scaffold to extend** (mirror current lines 14-34):

```typescript
// Existing src/app/admin/(protected)/layout.tsx (Phase 1):
export default async function AdminProtectedLayout({ children }) {
  await requireAdmin();   // line 19 — gate; do not duplicate in children
  return (
    <>
      <header>...</header>
      <main>{children}</main>
      {/* Phase 2 INSERT HERE: */}
      <IntegrityWidget />
    </>
  );
}
```

**Landmines:**
- `IntegrityWidget` is a server component (D-15: no polling, no cron). It reads via `adminReadClient()` — gating is already done by `requireAdmin()` in the layout, but the widget reading `predictions JOIN fixtures` needs service-role to see all rows (same Pitfall 10).

---

### `src/components/admin/IntegrityWidget.tsx` (RSC widget)

**Analog:** `src/app/[locale]/me/page.tsx` (RSC + DB read + render).

**Excerpt to mirror — RSC fetch + render** (lines 21-31):

```typescript
// From src/app/[locale]/me/page.tsx:21-31
export default async function MePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const member = await requireMember(locale);
  const t = await getTranslations('me');
  // ... reads from `member.joined_at` and renders directly ...
```

**For IntegrityWidget — 3 server queries:**

```typescript
// src/components/admin/IntegrityWidget.tsx
import { adminReadClient } from '@/lib/auth/adminReadClient';

export async function IntegrityWidget() {
  const svc = await adminReadClient();
  // D-15: three on-pageload counts.
  const [{ count: total }, { count: unscored }, { data: breaches }] = await Promise.all([
    svc.from('predictions').select('*', { count: 'exact', head: true }),
    svc.from('fixtures').select('*', { count: 'exact', head: true })
       .lte('kickoff_at', new Date().toISOString())
       .is('result_home_90min', null),
    // LGE-06: predictions submitted AFTER kickoff (lock-breach audit).
    svc.rpc('count_lock_breaches'),  // or inline join — planner picks
  ]);
  // ...render per UI-SPEC §13 (fixed inset-be-0, primary bg, 3 metrics)...
}
```

**Landmines:**
- Use `adminReadClient` not `createClient` (Pitfall 10).
- LGE-06 query is a JOIN that may not be inline-able in PostgREST — planner may need a Postgres function `count_lock_breaches()` registered via a migration helper, OR may use `svc.from('predictions').select('submitted_at, fixtures!inner(kickoff_at)').gt('submitted_at', 'fixtures.kickoff_at')` (verify type generation).

---

### `src/components/matches/MatchRowStepper.client.tsx` (client interactive — mutate-and-stay)

**Analog (negative):** `src/components/auth/JoinForm.client.tsx` — useful for `'use client'` + `useTranslations` + token use, but the Action pattern is OPPOSITE:
- JoinForm: `useActionState` + `<form action>` + `redirect()` after submit (mutate-and-navigate).
- Stepper: `useTransition` + plain async call + no redirect (mutate-and-stay).

**Token + a11y excerpt to MIRROR** (`JoinForm.client.tsx:1-21`):

```typescript
// From src/components/auth/JoinForm.client.tsx:1-7 — imports
'use client';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
// ↑ swap useActionState → useTransition for stepper

// Button styling tokens (lines 13-21) — reuse for stepper +/− buttons:
className="bs-12 is-full bg-[var(--zc-primary)] text-[var(--zc-primary-foreground)] rounded-xl font-bold text-base hover:bg-[#13325a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--zc-card)] disabled:opacity-80"
```

**Stepper-specific shape** (use RESEARCH §Pattern 3 / lines 446-481 as the planner's source of truth — reproduced in RESEARCH.md).

**Landmines:**
- 600ms debounce client-side BEFORE calling `savePrediction` (Pitfall 3 — React 19 Action queue).
- ALWAYS wrap stepper score `<span dir="ltr">` (UI-SPEC §"RTL Stress Points"; Pitfall 7).
- `[var(--zc-X)]` form mandatory (Pitfall 4 — Phase 1 P05 regression).
- Long-press 400ms+150ms interval, cap at score=9 (UI-SPEC §1).

---

### `src/components/admin/AdminModeToggle.client.tsx` (toggle that changes URL)

**Analog:** `src/components/layout/LocaleTogglePill.client.tsx` — exact match for "client toggle that submits a form, redirects via server action."

**Excerpt to mirror** (`LocaleTogglePill.client.tsx:39-51`):

```typescript
// From src/components/layout/LocaleTogglePill.client.tsx:39-51
return (
  <form action={switchLocale} className="inline-flex">
    <input type="hidden" name="locale" value={otherLocale} />
    <input type="hidden" name="redirectPath" value={redirectPath} />
    <button
      type="submit"
      aria-label={t('ariaLabel')}
      className="bs-8 inline-flex items-center justify-center rounded-full border border-[var(--zc-border)] bg-transparent ps-3 pe-3 text-sm font-bold text-[var(--zc-primary)] hover:bg-[var(--zc-muted)] hover:border-[var(--zc-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--zc-card)]"
    >
      {t('switchTo')}
    </button>
  </form>
);
```

**Landmines:**
- The Phase 2 mode toggle uses `URLSearchParam` (D-09 + UI-SPEC §11), so the pattern is a `<Link href="?mode=entry">` or `router.push('?mode=entry')` — NOT a Server Action. The LocaleTogglePill analog is only for the styling + RTL + focus-ring tokens.

---

### `supabase/migrations/0007_score_events.sql` (table + RLS + grants + smoke)

**Analog (composite):**
- `supabase/migrations/0001_init.sql:101-127` — table shape with FK + uniqueness + indexes.
- `supabase/migrations/0002_rls.sql:104-140` — RLS policy authoring.
- `supabase/migrations/0003_grants.sql:33-43` — GRANT pattern.
- `supabase/migrations/0002_rls.sql:223-237` — B-style DO-block smoke.

**Table shape excerpts:**

```sql
-- From 0001_init.sql:101-111 — bracket_picks: simple FK + ON DELETE CASCADE + unique
create table public.bracket_picks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  ...
  unique (user_id, slot_id)
);
create index bracket_picks_user_idx on public.bracket_picks (user_id);
```

**RLS pattern to mirror** (`0002_rls.sql:104-111` predictions read):

```sql
-- From 0002_rls.sql:104-111 — public-to-members read pattern
alter table public.predictions enable row level security;
create policy predictions_read on public.predictions
  for select to authenticated using (
    user_id = (select auth.uid())
    or exists (...)
  );
```

For `score_events`, simpler: read is `using (true)` (all members see all score_events per D-19 / RESEARCH §"score_events migration"). NO INSERT/UPDATE/DELETE policy → service-role only.

**GRANT pattern to mirror** (`0003_grants.sql:33-43` + `0004_anon_select.sql:34-44`):

```sql
-- From 0003_grants.sql:33-43 — service_role full DML
grant select, insert, update, delete on public.bracket_picks to service_role;
-- From 0003_grants.sql:53-63 — authenticated SELECT
grant select on public.bracket_picks to authenticated;
-- From 0004_anon_select.sql:34-44 — anon SELECT
grant select on public.bracket_picks to anon;
```

**B-style smoke to mirror** (`0002_rls.sql:223-237`):

```sql
-- From 0002_rls.sql:223-237 — column-grant smoke check
do $$
declare cols text;
begin
  select string_agg(column_name, ',' order by column_name)
    into cols
    from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'profiles'
      and grantee = 'authenticated' and privilege_type = 'UPDATE';
  if cols is null or cols <> 'display_name,locale' then
    raise exception 'B1 column-grant check failed: ...';
  end if;
end$$;
```

For `score_events`, the analogous smoke is: confirm `authenticated` has NO INSERT/UPDATE/DELETE grants (per RESEARCH lines 887-902).

**Landmines:**
- Append-only — file MUST be named `0007_score_events.sql`, never edit later (Phase 1 D-21).
- `(select auth.uid())` wrapping mandatory in any RLS predicate (Phase 1 VIS-06).
- After this migration: `npm run db:types && git add src/types/supabase.ts && git commit` (Pitfall 9).
- Tournament `starts_at = 2026-06-11T19:00:00Z` invariant must hold (Pitfall 11) — no change in this migration but DO NOT alter `tournament` here.

---

### `supabase/migrations/0009_fixtures_result_full.sql` (ALTER TABLE)

**Analog:** `0001_init.sql:65-68` (the column-definition block).

**Excerpt to copy column shape from:**

```sql
-- From 0001_init.sql:65-68
result_home          smallint,                 -- 90-min final score (Phase 2 admin enters) [DEPRECATED — see D-12]
result_away          smallint,
result_home_90min    smallint,                 -- for KO extra-time (Phase 2)
result_away_90min    smallint,
```

**ALTER syntax for 0009:**

```sql
-- supabase/migrations/0009_fixtures_result_full.sql (planner finalizes)
alter table public.fixtures
  add column result_home_full smallint,
  add column result_away_full smallint;

comment on column public.fixtures.result_home_full is
  'KO ET/penalty home score; populated by Phase 3 admin. NULL for group-stage fixtures.';
comment on column public.fixtures.result_away_full is
  'KO ET/penalty away score; populated by Phase 3 admin. NULL for group-stage fixtures.';
```

**Landmines:**
- "Don't Hand-Roll" §`result_home` rule: do NOT delete or alias the legacy `result_home`/`result_away` columns. Phase 2 leaves them NULL forever.
- After this migration: regenerate types per Pitfall 9.

---

### `tests/e2e/smoke.spec.ts` (Playwright)

**Analog:** none — Playwright is net new in Phase 2 Wave 0.

**Use:** RESEARCH §"Playwright smoke (skeleton)" lines 946-997 as the planner-finalized starting point.

**Landmines:**
- No fake-time mocking (D-30). Use seeded fixture timestamps `now() ± 5min`.
- Multi-context per `browser.newContext()` (one user + one admin); fresh-join per context (no `storageState` in v1).
- `PLAYWRIGHT_INVITE_CODE` and `PLAYWRIGHT_ADMIN_NAME` env vars required.
- `data/test-fixtures.sql` seed lifecycle: `db:test-seed` before suite, `db:test-clean` after.
- Test fixtures use `external_match_no` in 9000+ range to avoid collisions with 1..104 real fixtures (Open Question 4).

---

## Shared Patterns

### Pattern A — Server Action skeleton (mutate-and-navigate)

**Source:** `src/app/actions/join.ts:62-148`
**Apply to:** `resolvePlaceholder.ts`, `mergeUsers.ts`, future admin actions that redirect after work

```typescript
'use server';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
// ... (auth gate + Zod validate + svc client + work) ...
redirect(`/${locale}` as Route);   // line 147 — always last
```

### Pattern B — Server Action skeleton (mutate-and-stay)

**Source:** RESEARCH §Pattern 3 (no Phase-1 analog yet — this pattern lands in Phase 2)
**Apply to:** `savePrediction.ts`, `savePropAnswer.ts`, `saveResult.ts`, `gradeProp.ts`

- Return `{ ok: true } | { ok: false; error: ... }` (NOT void).
- Caller is a client component using `startTransition`, NOT `<form action>`.
- `revalidatePath` per-locale at end (explicit, not path-pattern — Pitfall 6).
- NO `redirect()`.

### Pattern C — Auth gate before any DB call

**Source:** `src/lib/auth/session.ts:62-67` (`requireAdmin`) + `src/lib/auth/session.ts:41-47` (`requireMember`) + `src/lib/auth/session.ts:21-34` (`getCurrentMember` uses `getClaims()`)

Apply to **every** Server Action and admin RSC.

```typescript
// admin Server Action: requireAdmin() before createServiceClient()
await requireAdmin();
const svc = createServiceClient();
// player RSC: requireMember(locale)
const member = await requireMember(locale);
```

**Critical:** `getClaims()` ONLY, never `getSession()` (Phase 1 P02 / RESEARCH Anti-Pattern).

### Pattern D — `'server-only'` boundary

**Source:** `src/lib/supabase/service.ts:1` + `src/lib/auth/session.ts:1` + `src/lib/auth/admin.ts:1`

```typescript
import 'server-only';
// ...everything in this module fails build if pulled into a client bundle.
```

Apply to: `src/lib/scoring/sweepAndUpsert.ts`, `src/lib/auth/adminReadClient.ts`, any new service-role-touching helper.

### Pattern E — Tailwind v4 token references

**Source:** `src/components/ui/FormField.tsx:60` + every Phase-1 component
**Apply to:** EVERY new Phase-2 component

```typescript
className="bs-12 is-full bg-white rounded-xl border border-[var(--zc-border)] ps-4 pe-4 text-base text-[var(--zc-primary)] ..."
//                                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^                          ^^^^^^^^^^^^^^^^^^^^^^^
//                                          [var(--zc-X)] — NEVER [--zc-X]                        same
```

**Pitfall 4:** Tailwind v4 dropped the bare `[--zc-X]` form. Phase 1 P05 fixed it via sed; Phase 2 must not regress.

**Planner action:** Add a new `lint:tailwind-v4` script to `package.json` mirroring `lint:rtl` shape (RESEARCH Pitfall 4 lines 791-796).

### Pattern F — Logical-property utilities (RTL)

**Source:** every Phase-1 component (e.g., `Header.tsx:13-14`, `BottomTabBar.tsx:52`)

Use `bs-*` (block-size), `is-*` (inline-size), `ps-*`/`pe-*` (padding-start/end), `inset-bs-*`, `inset-i-*`. NEVER `pl-*`/`pr-*`/`left-*`/`right-*`/`text-left`/`text-right`/`flex-row-reverse`. Phase-1 lint (`lint:rtl`) catches violations.

### Pattern G — Bidi-safe LTR isolation for numbers

**Source:** UI-SPEC §"RTL Stress Points" + Phase 1 D-04 (`dir="ltr"` on stepper number input)

Wrap every score, countdown, badge number, and total in `<span dir="ltr">` regardless of page locale. Apply to:
- `MatchRowStepper` score display
- `MatchRowLocked` capsule
- `MatchRowResulted` actual + per-player scores
- `PtsBadge` `+{N}` part
- `CountdownBanner` `HH:MM:SS`
- `LeaderboardRow` total points
- `IntegrityWidget` numeric metric values

### Pattern H — i18n message bundles

**Source:** `messages/en.json:1-50` + `messages/he.json` (parallel structure)
**Apply to:** Every player-facing string per UI-SPEC §"Copywriting Contract"

```typescript
// Pattern: namespaced keys, parallel HE/EN files.
// From messages/en.json:36-42 (join errors):
"errors": {
  "invalid_code": "⚠ Wrong code. ...",
  "name_chars": "⚠ Name can only ..."
}
// Phase 2 adds (per UI-SPEC):
// "matches.cta", "matches.saved", "matches.saveFailed", "match.actual",
// "match.lockedAria", "pts.exact|goalDiff|winner|miss|correct",
// "countdown.next|kicksOffIn", "leaderboard.league|bracketPlaceholder|props",
// "props.lockedNote"
```

### Pattern I — Migration boilerplate (file header + DO-block smoke)

**Source:** `supabase/migrations/0002_rls.sql:1-3` (file header) + lines 200-237 (DO-block smokes)

Every Phase-2 migration must:
1. Open with a `-- Migration NNNN: <purpose>` comment block (mirror 0002 lines 1-3, 0003 lines 1-26).
2. End with at least one `do $$ ... raise exception ... end$$` smoke that fails fast on a schema invariant violation.
3. Be named with the next sequential number (0007, 0008, ...).
4. Trigger `npm run db:types` + commit `src/types/supabase.ts` (Pitfall 9).

### Pattern J — `usePathname` import (RTL navigation)

**Source:** `src/components/layout/BottomTabBar.tsx:4` + Phase 1 D-04 lesson

```typescript
import { Link, usePathname } from '@/lib/i18n/routing';   // ✅
// NOT: import { usePathname } from 'next/navigation';     // ❌
```

Apply to ANY new client component that uses pathname. The locale-stripped pathname enables locale-agnostic active-state matching.

---

## No Analog Found

These files have no close Phase-1 match. Planner should use RESEARCH.md patterns instead.

| File | Role | Data Flow | Reason | Source to use |
|------|------|-----------|--------|---------------|
| `src/lib/scoring/league.ts` | pure scoring lib | request-response | Phase 1 has no pure-function business-logic library yet | RESEARCH §Pattern 4 lines 494-516 (full skeleton) |
| `src/lib/scoring/props.ts` | pure scoring lib | request-response | Same | RESEARCH §Pattern 4 lines 518-547 (full skeleton) |
| `supabase/migrations/0008_v_leaderboard.sql` | VIEW + GRANT | derived projection | Phase 1 has no SQL VIEWs | RESEARCH §Pattern 6 lines 620-643 (full skeleton); GRANT shape from `0003_grants.sql:53-63` |
| `tests/e2e/playwright.config.ts` | test config | n/a | Playwright not yet installed | RESEARCH §"Environment Availability" + Playwright official docs (https://playwright.dev/docs/test-configuration) |
| `tests/e2e/smoke.spec.ts` | E2E spec | request-response (HTTP) | Same | RESEARCH §"Playwright smoke (skeleton)" lines 946-997 |
| `tests/e2e/fixtures/auth.ts` | test helper | n/a | Same | RESEARCH §"Storage state vs fresh-join" lines 999-1009 |
| `data/test-fixtures.sql` | test seed | n/a | Phase 1 has full WC seed (0005, 0006) but no test-fixture seed | Adapt minimal `INSERT INTO fixtures (...)` shape from `0006_reseed_wc2026.sql` |
| `src/components/matches/CountdownBanner.client.tsx` | client-side 1s ticker | display-only | Phase 1 has no `setInterval`-driven client component | UI-SPEC §6 (full spec) + standard `useEffect(setInterval)` pattern |

---

## Phase-Specific Landmines

### P05 forensic `[--zc-X]` regression (Pitfall 4)
**What:** Tailwind v4 silently drops bare `[--zc-X]` shorthand. Phase 1 lint does NOT catch it.
**Where it could regress in Phase 2:** Every new component (14 net-new).
**Plan must:** Add `lint:tailwind-v4` to `package.json`, wire to `.husky/pre-commit` and `.github/workflows/lint.yml` BEFORE writing any component code.

### ICU collation availability (Pitfall 5)
**What:** `und-x-icu` / `he-x-icu` may not exist on this Supabase build.
**Plan must:** Use TS-side `Intl.Collator(locale).compare` (RESEARCH §Pattern 7 lines 935-944), NOT `COLLATE ... ` in `v_leaderboard`.

### `getClaims()` vs `getSession()` discipline (Phase 1 Anti-Pattern)
**What:** `getSession()` trusts cookies without verifying JWT.
**Where it must NOT regress:** Every new Server Action and admin RSC.
**Plan must:** Reference `src/lib/auth/session.ts:21-34` — every auth check goes through `getClaims()` via `getCurrentMember()` / `requireMember()` / `requireAdmin()`.

### Lockfile JFrog→npmjs rewrite (Pitfall 8)
**What:** `npm install @playwright/test` rewrites lockfile to JFrog URLs; Vercel 403s.
**Plan must:** Wave 0 includes the sed rewrite step IMMEDIATELY after every install, commit the rewritten lockfile.

### `src/types/supabase.ts` regeneration (Pitfall 9)
**What:** After every migration, types are stale until `npm run db:types`.
**Plan must:** Each migration task ends with `npm run db:push --linked && npm run db:types && git add src/types/supabase.ts && git commit`.

### Phase-1 D-22 admin EN-only (D-05)
**What:** Admin pages do NOT use `setRequestLocale` / `getTranslations` / `next-intl`. They are unlocalized routes at `/admin/*`.
**Plan must:** Distinguish player pages (under `/[locale]/...`, use next-intl) from admin pages (under `/admin/...`, EN-only strings from `messages/en.json` `admin.*` keys OR inline literals).

### Server-action mutate-and-stay vs mutate-and-navigate
**What:** Phase 1 Pattern 14 (`<form action>` + `redirect()`) is for navigate-after. Stepper / prop save / admin result save are STAY-after.
**Plan must:** Use `useTransition` + plain async call for stay-after (RESEARCH §Pattern 3); use `<form action>` + `redirect()` for navigate-after (mirror `join.ts:147`).

### W6 watchpoint — no second cron (D-33)
**What:** Vercel Hobby = 1 cron, heartbeat owns it.
**Plan must NOT:** Add `vercel.json` cron entries. Integrity widget is server-component-on-pageload, NOT scheduled.

### Append-only migrations (Phase 1 D-21)
**Plan must NOT:** Edit `0001_init.sql`..`0006_reseed_wc2026.sql`. Phase 2 starts at `0007_...` and increments.

### `git config user.email` before commits
**What:** Vercel requires commits authored by `10100761+zarurc@users.noreply.github.com`.
**Plan must:** Each plan's commit task verifies `git config user.email` first.

---

## Metadata

**Analog search scope:** `src/**`, `supabase/migrations/**`, `messages/**`, `scripts/**`, top-level config (package.json, .husky, .github/workflows).
**Files scanned:** 39 src files + 6 migrations + 2 message bundles + 3 scripts + 6 config files = 56.
**Pattern extraction date:** 2026-05-24
**Phase-1 commit base:** d-bb4d (lint workflow with jfrog/boost) — all analogs read from current `main`.

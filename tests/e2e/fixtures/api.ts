// tests/e2e/fixtures/api.ts
//
// Phase 2 Plan 02-08 — API helper for the canonical RLS-rejection assertion
// (D-30 + ROADMAP §Success Criterion 5).
//
// The Phase-1 RLS policy `predictions_insert` rejects post-kickoff writes
// (`f.kickoff_at > now()` WITH CHECK). The cosmetic 🔒 emoji check in the
// smoke is supportive only — the canonical assertion is "ATTEMPT a write
// against an already-locked fixture and observe the server reject it"
// (HTTP 4xx OR `{ ok: false, error: 'locked' | 'rls_denied' }`).
//
// This helper POSTs against the test-only JSON route
// `src/app/api/test/save-prediction/route.ts` (gated by NODE_ENV +
// PLAYWRIGHT_INVITE_CODE), which internally calls the savePrediction Server
// Action. The route forwards the action's discriminated result and maps
// `error: 'locked'` to HTTP 403 so the smoke can assert either form.
//
// NB: the folder is `test/`, NOT `_test/`. Next.js excludes underscore-
// prefixed folders from routing entirely (private-folder convention), so
// a route under `_test/` returns 404 even when the file exists.

import type { BrowserContext } from '@playwright/test';

export type PredictionWriteResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | 'locked'
        | 'validation'
        | 'network'
        | 'unauthenticated'
        | 'rls_denied';
      /** HTTP status when the failure originated from a non-2xx response. */
      status?: number;
      /** Raw response body (truncated) for debugging. Present only on non-403/non-2xx. */
      body?: string;
    };

/**
 * Attempts a post-lock prediction write via the savePrediction Server Action.
 *
 * Cookie wiring: the helper takes a BrowserContext (NOT the top-level test
 * `request` fixture) and dispatches via `ctx.request`. The top-level fixture
 * is an isolated APIRequestContext with no cookies — using it here previously
 * caused the route to see no auth, return 401 → mapped to 'network', and the
 * lock contract was never actually exercised.
 *
 * The smoke MUST observe one of:
 *   - HTTP 4xx (RLS rejection surfaces as 403 from the test route)
 *   - JSON body { ok: false, error: 'locked' | 'rls_denied' | 'validation' }
 *
 * If we see HTTP 200 + { ok: true }, the lock was bypassed — D-30 + ROADMAP
 * §Success Criterion 5 are violated, and the smoke FAILS.
 */
export async function attemptPredictionAgainstLockedFixture(
  ctx: BrowserContext,
  fixtureId: string,
  home: number,
  away: number,
): Promise<PredictionWriteResult> {
  const response = await ctx.request.post('/api/test/save-prediction', {
    data: { fixture_id: fixtureId, home_score: home, away_score: away },
  });

  if (!response.ok()) {
    const status = response.status();
    // HTTP 4xx — RLS rejected. Treat 403 as rls_denied; everything else as
    // 'network' BUT surface the status + body so the next debugger doesn't
    // have to re-derive what 401 / 400 / 500 means from a generic label.
    if (status === 403) {
      return { ok: false, error: 'rls_denied', status };
    }
    const body = await response.text().catch(() => '');
    // Visible in `npm run test:e2e` stdout and Playwright CI report.
    console.error(
      `[attemptPredictionAgainstLockedFixture] non-403 failure: status=${status} body=${body.slice(0, 500)}`,
    );
    return { ok: false, error: 'network', status, body: body.slice(0, 500) };
  }
  const body = (await response.json()) as PredictionWriteResult;
  return body;
}

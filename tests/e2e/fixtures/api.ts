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
// `src/app/api/_test/save-prediction/route.ts` (gated by NODE_ENV +
// PLAYWRIGHT_INVITE_CODE), which internally calls the savePrediction Server
// Action. The route forwards the action's discriminated result and maps
// `error: 'locked'` to HTTP 403 so the smoke can assert either form.

import type { APIRequestContext, BrowserContext } from '@playwright/test';

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
    };

/**
 * Attempts a post-lock prediction write via the savePrediction Server Action.
 * Uses the user's existing browser cookies from `ctx` (same origin, same
 * authenticated user); Playwright passes them automatically when the request
 * is dispatched against the same baseURL.
 *
 * The smoke MUST observe one of:
 *   - HTTP 4xx (RLS rejection surfaces as 403 from the test route)
 *   - JSON body { ok: false, error: 'locked' | 'rls_denied' | 'validation' }
 *
 * If we see HTTP 200 + { ok: true }, the lock was bypassed — D-30 + ROADMAP
 * §Success Criterion 5 are violated, and the smoke FAILS.
 */
export async function attemptPredictionAgainstLockedFixture(
  request: APIRequestContext,
  _ctx: BrowserContext,
  fixtureId: string,
  home: number,
  away: number,
): Promise<PredictionWriteResult> {
  const response = await request.post('/api/_test/save-prediction', {
    data: { fixture_id: fixtureId, home_score: home, away_score: away },
    // Playwright reuses the context's cookies by default when the request
    // is created from the page/context's APIRequestContext. When using the
    // top-level `request` fixture instead, we attach cookies via the context
    // it was created from (Playwright handles this transparently for same-
    // origin requests within a single test).
  });

  if (!response.ok()) {
    // HTTP 4xx — RLS rejected. Treat 403 as rls_denied; anything else as network.
    return {
      ok: false,
      error: response.status() === 403 ? 'rls_denied' : 'network',
    };
  }
  const body = (await response.json()) as PredictionWriteResult;
  return body;
}

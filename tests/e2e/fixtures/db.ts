// tests/e2e/fixtures/db.ts
//
// SERVER-ONLY: imports SUPABASE_SECRET_KEY. Never bundled into the app —
// lives under tests/, not src/.
//
// Resolves the live-DB UUIDs for the synthetic test fixtures by their
// external_match_no (9001 / 9002, see data/test-fixtures.sql) so the
// Playwright smoke can target them with deterministic getByTestId()
// selectors (no text-content fallback, no .first() heuristics over the
// full 104-row seed).

import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

// Node 20 lacks native WebSocket; supabase-js's realtime client initializes
// even when we never subscribe. Pass `ws` as the realtime transport so
// createClient() can construct without throwing on CI runners.
// Drop this once we move CI to Node 22+ (which has native WebSocket).
const REALTIME_TRANSPORT = { transport: ws as unknown as typeof WebSocket };

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SECRET_KEY ?? '';
  if (!url || !key) {
    throw new Error(
      'tests/e2e/fixtures/db.ts requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY env vars',
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: REALTIME_TRANSPORT,
  });
}

/** Resolve a fixture UUID by external_match_no (9001 / 9002). */
export async function getFixtureIdByExternalNo(externalNo: number): Promise<string> {
  const { data, error } = await svc()
    .from('fixtures')
    .select('id')
    .eq('external_match_no', externalNo)
    .single();
  if (error || !data) {
    throw new Error(
      `getFixtureIdByExternalNo(${externalNo}) failed: ${
        error?.message ?? 'no row — did you run `npm run db:test-seed`?'
      }`,
    );
  }
  return data.id;
}

/**
 * Find the user_id of the env-bootstrapped admin profile. The admin profile
 * was created by Phase 1 join flow when zekez first signed in with the
 * ADMIN_DISPLAY_NAME env var — we MUST NOT run JoinForm again here, because
 * the family-trust rebind logic in joinPool (Phase 1 D-04) would either rebind
 * an existing profile or duplicate it.
 */
export async function getAdminUserId(adminDisplayName: string): Promise<string> {
  const { data, error } = await svc()
    .from('profiles')
    .select('user_id')
    .eq('display_name', adminDisplayName)
    .single();
  if (error || !data) {
    throw new Error(
      `getAdminUserId('${adminDisplayName}') failed: ${
        error?.message ?? 'no profile'
      }`,
    );
  }
  return data.user_id;
}

/**
 * Cookie shape returned by the admin storageState minting helper. Playwright
 * accepts this in `browser.newContext({ storageState: ... })`.
 */
export type AdminCookies = Array<{
  name: string;
  value: string;
  domain: string;
  path: string;
}>;

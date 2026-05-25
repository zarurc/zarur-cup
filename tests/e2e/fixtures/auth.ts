// tests/e2e/fixtures/auth.ts
//
// Phase 2 Plan 02-08 — Playwright auth helpers.
//
// Two separate paths:
//   - joinAsPlayer(): UI flow against /en/join (clicks the actual form).
//   - joinAsAdmin():  service-role storageState mint (NEVER runs JoinForm,
//                      because the env-bootstrapped admin profile already
//                      exists and the family-trust rebind logic in joinPool
//                      (Phase 1 D-04) could rebind or duplicate it).
//
// For Phase 2 v1 the admin storageState is minted out-of-band via
// `scripts/db-mint-admin-session.cjs` and consumed in the smoke spec via
// `browser.newContext({ storageState: 'tests/e2e/.admin-storage-state.json' })`.

import type { Page, BrowserContext } from '@playwright/test';
import { getAdminUserId } from './db';

// FormField IDs (Phase 1 JoinForm.client.tsx renders <input id="display_name">
// and <input id="invite_code">). These IDs are the most stable selectors —
// they survive copy changes. The submit button is targeted by its verbatim
// label ('Join the Pool', from messages/en.json `join.submitIdle`).
const FIELD_ID_DISPLAY_NAME = 'display_name';
const FIELD_ID_INVITE_CODE = 'invite_code';
const SUBMIT_LABEL_IDLE = 'Join the Pool'; // join.submitIdle in messages/en.json

/**
 * UI flow — player only. Joins the pool via /en/join.
 *
 * MUST NOT be used for the admin context. The admin profile already exists
 * (env-bootstrapped from ADMIN_DISPLAY_NAME during Phase 1) and the
 * family-trust rebind logic in joinPool (Phase 1 D-04) would either rebind
 * the existing admin profile or create a duplicate. See joinAsAdmin() below.
 */
export async function joinAsPlayer(
  page: Page,
  opts: { displayName: string; inviteCode: string },
) {
  await page.goto('/en/join');
  await page.locator(`#${FIELD_ID_DISPLAY_NAME}`).fill(opts.displayName);
  await page.locator(`#${FIELD_ID_INVITE_CODE}`).fill(opts.inviteCode);
  await page.getByRole('button', { name: SUBMIT_LABEL_IDLE }).click();
  // joinPool redirects to /[locale]/matches or /[locale]/me on success.
  await page.waitForURL(/\/(en|he)\/(matches|me)/, { timeout: 10_000 });
}

/**
 * Admin context — mint a session via service-role, NEVER via JoinForm.
 *
 * Strategy: the Phase-2 admin session is minted out-of-band by
 * `scripts/db-mint-admin-session.cjs` (a Node script using SUPABASE_SECRET_KEY
 * to call supabase.auth.admin and write the @supabase/ssr cookie shape to
 * `tests/e2e/.admin-storage-state.json`). The smoke spec then loads that
 * storageState in `browser.newContext({ storageState: ... })`.
 *
 * If the storageState file is missing (e.g., first-run, or the script
 * couldn't talk to the Supabase Admin API on the installed supabase-js
 * version), the smoke skips the admin half and the human MUST verify
 * the admin → leaderboard half manually (see Plan 02-08 Task 3).
 *
 * This helper exists primarily to document the contract and assert that
 * the admin profile actually exists in the DB (so we fail loudly if
 * ADMIN_DISPLAY_NAME is misconfigured). The caller is responsible for
 * supplying the storageState via Playwright's newContext options.
 */
export async function joinAsAdmin(
  _ctx: BrowserContext,
  adminDisplayName: string,
): Promise<{ adminUserId: string }> {
  const adminUserId = await getAdminUserId(adminDisplayName);
  // Minting the session JWT + cookies is supabase-js-version-specific and
  // happens in scripts/db-mint-admin-session.cjs (out-of-band, before the
  // smoke runs). Throw a clear, documented error if the caller invokes
  // this expecting it to do that work — the caller must use
  // `browser.newContext({ storageState: 'tests/e2e/.admin-storage-state.json' })`.
  throw new Error(
    `joinAsAdmin: admin session minting is implementation-specific to the ` +
      `installed supabase-js version. For Phase 2 v1, run ` +
      `\`node scripts/db-mint-admin-session.cjs\` before the smoke and load ` +
      `the resulting storageState via newContext. adminUserId=${adminUserId}`,
  );
}

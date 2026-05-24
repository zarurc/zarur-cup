'use server';

import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { createClient } from '@/lib/supabase/server';

/**
 * Sign the current user out and redirect to the unlocalized root so the
 * i18n middleware re-routes them to the appropriate /[locale]/join.
 *
 * Used by the Logout button on /[locale]/me (fix-up plan 01-04, Bug 1a).
 *
 * Notes:
 *   - We DO NOT clear arbitrary cookies; @supabase/ssr's signOut() removes
 *     only the Supabase session cookies. The NEXT_LOCALE cookie is
 *     intentionally preserved so the user lands back on their preferred
 *     locale's /join page after logout.
 *   - We DO NOT delete the auth.users row here. If the user wants to rejoin
 *     under the same display_name, the joinPool rebind path (Bug 1b) handles
 *     that automatically on the next successful join with a valid invite
 *     code.
 *   - signOut() returns void on success; on error we still redirect so the
 *     user never gets stuck on /me with stale UI.
 */
export async function signOutCurrent(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/' as Route);
}

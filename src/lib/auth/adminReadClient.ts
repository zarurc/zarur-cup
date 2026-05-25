import 'server-only';

import { requireAdmin } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Pitfall 10: admin RSCs that use `createClient()` (anon JWT) hit RLS
 * like any other user — the integrity widget would see only the admin's
 * own predictions, the matches list would render empty in entry mode,
 * and the roster page would list only the admin.
 *
 * This helper gates on `requireAdmin()` and returns a service-role
 * client that BYPASSES RLS. Use it in every `/admin/(protected)/*` RSC
 * that reads data belonging to other users:
 *   - admin matches list (shows everyone's predictions for entry mode)
 *   - admin roster (lists every profile)
 *   - admin tournament-tree (resolves placeholders across all fixtures)
 *   - admin integrity widget (counts lock breaches + total predictions)
 *
 * IMPORTANT: `requireAdmin()` may `redirect()` (non-admin → /admin/403;
 * signed-out → /). DO NOT wrap this call in a try/catch that suppresses
 * the redirect throw — let Next.js handle the navigation.
 *
 * `'server-only'` directive at the top fails the build loudly if this
 * module is ever imported from a client bundle (RESEARCH Pitfall 5;
 * mirrors src/lib/supabase/service.ts:1).
 */
export async function adminReadClient() {
  await requireAdmin();
  return createServiceClient();
}

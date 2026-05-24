import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client. Bypasses RLS.
 *
 * Use ONLY for:
 *   - The /api/heartbeat route (FND-05)
 *   - Future admin server actions that intentionally need to bypass RLS
 *
 * NEVER import this from a client component. The `import 'server-only'`
 * directive above causes the Next.js build to fail loudly if it ends up
 * in a client bundle (RESEARCH Pitfall 5).
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}

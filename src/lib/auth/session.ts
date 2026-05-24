import 'server-only';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

export type Member = Database['public']['Tables']['profiles']['Row'];

/**
 * Resolve the currently signed-in member (if any) from the request cookies.
 *
 * CRITICAL: uses `getClaims()`, NOT the cookie-trusting session API.
 *   - `getClaims()` validates the JWT signature against Supabase's JWKS
 *   - The cookie-trusting session API can return stale auth that survived a
 *     sign-out elsewhere (CLAUDE.md PITFALLS, T-01-02, T-04-02)
 *
 * Returns null if there is no signed-in user OR if there is a signed-in user
 * but no profile row (e.g. mid-join failure - the caller should redirect to
 * /join).
 */
export async function getCurrentMember(): Promise<Member | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return null;

  const userId = data.claims.sub;
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  return profile ?? null;
}

/**
 * Require a signed-in member with a profile row. Redirects to /[locale]/join
 * if the user is signed out OR signed in without a profile (the join flow
 * resumes from this state cleanly).
 */
export async function requireMember(locale: string): Promise<Member> {
  const member = await getCurrentMember();
  // Cast to Route because typedRoutes can't statically analyze a templated
  // string with a runtime locale; the route /he/join and /en/join both exist.
  if (!member) redirect(`/${locale}/join` as Route);
  return member;
}

/**
 * Require a signed-in member whose profile has is_admin = true. The UI gate
 * is NEVER the only defense - the column-level GRANT on profiles
 * (display_name, locale only; is_admin INSERT-time only) is the actual
 * enforcement layer at the DB.
 *
 * Non-admin signed-in users are redirected to /admin/403 (not /admin/login,
 * not the home page - that would be unhelpfully cryptic).
 *
 * Signed-out users are redirected to / so the i18n middleware routes them to
 * the correct localized /join. Putting /admin/login or /he/join here would
 * couple the admin gate to a locale.
 */
export async function requireAdmin(): Promise<Member> {
  const member = await getCurrentMember();
  if (!member) redirect('/' as Route);
  if (!member.is_admin) redirect('/admin/403' as Route);
  return member;
}

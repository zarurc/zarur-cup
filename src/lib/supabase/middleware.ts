import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';

/**
 * Refresh the Supabase auth session on every request that hits the
 * locale-routed middleware. Reads cookies from the request, writes any
 * refreshed cookies to the response.
 *
 * We call `getClaims()` (NOT `getSession()`):
 *   - `getClaims()` validates the JWT signature against Supabase's JWKS
 *   - `getSession()` trusts the cookie blindly — can return stale auth that
 *     survived a sign-out elsewhere (CLAUDE.md PITFALLS, T-01-02)
 */
export async function refreshSupabaseSession(
  request: NextRequest,
  response: NextResponse,
) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options: CookieOptions;
          }>,
        ) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Validates JWT against JWKS and rotates refresh token if near expiry.
  await supabase.auth.getClaims();

  return response;
}

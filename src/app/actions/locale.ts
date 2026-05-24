'use server';

import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

/**
 * Persist the user's locale choice for the locale toggle pill (D-17) AND
 * redirect to the target localized path.
 *
 * Fix-up plan 01-04 / Bug 4: the previous client-side implementation called
 * this action under `startTransition` while a <Link> simultaneously navigated.
 * The navigation tore down the React tree before the server action's DB
 * UPDATE committed, so `profiles.locale` never moved. Converting to a
 * form-action that performs the UPDATE then issues `redirect()` removes the
 * race - the UPDATE is awaited server-side before the redirect response is
 * emitted, so the next GET reflects the new locale in both URL and DB.
 *
 * For signed-out users this is cookie-only (still useful so next-intl picks
 * the preferred locale on the next request). For signed-in users we also
 * persist to profiles.locale so the preference survives cookie loss (B1
 * column-level GRANT permits authenticated UPDATE on (display_name, locale)
 * only - is_admin is unreachable here even with a crafted payload, T-04-03).
 *
 * Accepts the redirect path as a hidden form field so the pill can target
 * the equivalent path under the other locale.
 */
export async function switchLocale(formData: FormData): Promise<void> {
  const localeRaw = formData.get('locale');
  const redirectPathRaw = formData.get('redirectPath');

  // Whitelist locale to 'he' | 'en'.
  const locale: 'he' | 'en' =
    localeRaw === 'en' ? 'en' : localeRaw === 'he' ? 'he' : 'he';

  // Sanitize redirectPath: must be a string starting with '/' and not a
  // protocol-relative '//host' (which would let an attacker redirect off-site
  // through a crafted form). Default to '/<locale>' if invalid.
  let redirectPath = `/${locale}`;
  if (
    typeof redirectPathRaw === 'string' &&
    redirectPathRaw.startsWith('/') &&
    !redirectPathRaw.startsWith('//')
  ) {
    redirectPath = redirectPathRaw;
  }

  // Always update the cookie (works for both signed-in and signed-out users).
  (await cookies()).set('NEXT_LOCALE', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  // If signed in, also persist to profiles.locale. We `await` the UPDATE so
  // the row is committed before the redirect is emitted.
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) {
    await supabase
      .from('profiles')
      .update({ locale })
      .eq('user_id', data.claims.sub);
  }

  redirect(redirectPath as Route);
}

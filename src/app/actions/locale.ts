'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

/**
 * Persist the user's locale choice for the locale toggle pill (D-17).
 *
 * For signed-out users this is cookie-only (still useful so next-intl picks the
 * preferred locale on the next request).
 *
 * For signed-in users we also update profiles.locale so the preference is
 * cross-device (cookie can be cleared; profiles.locale survives). The B1
 * column-level GRANT permits authenticated UPDATE on (display_name, locale)
 * only - is_admin is unreachable from this code path even with a crafted
 * payload (T-04-03 defense at the DB).
 */
export async function updateLocaleForCurrentUser(
  locale: 'he' | 'en',
): Promise<void> {
  // Always update the cookie (works for both signed-in and signed-out users).
  (await cookies()).set('NEXT_LOCALE', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  // If signed in, also persist to profiles.locale.
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) {
    await supabase
      .from('profiles')
      .update({ locale })
      .eq('user_id', data.claims.sub);
  }

  revalidatePath('/', 'layout');
}

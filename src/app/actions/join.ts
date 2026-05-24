'use server';

import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { cookies } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { joinSchema } from '@/lib/schemas/join';
import { isAdminDisplayName } from '@/lib/auth/admin';
import { createClient } from '@/lib/supabase/server';

export type JoinState = {
  error?:
    | 'validation_failed'
    | 'invalid_code'
    | 'auth_failed'
    | 'display_name_taken'
    | 'profile_failed';
  issues?: Array<{ path: string; code: string }>;
} | null;

/**
 * joinPool: invite-code -> signInAnonymously -> profiles INSERT.
 *
 * Threat-model checkpoints (see plan 01-04 <threat_model>):
 *   T-04-01: INVITE_CODE has no NEXT_PUBLIC_ prefix; only referenced here.
 *   T-04-04: 23505 uniqueness collision on display_name_normalized is caught
 *            and surfaced as display_name_taken.
 *   T-04-06: Supabase rate-limits anonymous sign-ins to 30/hr/IP. v1 accepts
 *            this as the only DoS defense; TODO add Cloudflare Turnstile post-
 *            launch (CLAUDE.md "Auth ... gotchas" + RESEARCH Pitfall 9).
 *   T-04-07: Zod regex /^[\p{L}\d ]+$/u rejects XSS-relevant chars at the
 *            validation gate before insert.
 *   W7 accepted risk (plan notes): if signInAnonymously() succeeds but the
 *   subsequent profile INSERT fails for a non-23505 reason AND the follow-up
 *   signOut() also fails, an orphan auth.users row persists. Phase 2 ADM-05
 *   handles reconciliation. Harmless to family-scale traffic; the next join
 *   attempt is still clean because signInAnonymously() creates a fresh user.
 */
export async function joinPool(
  _prev: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const locale = await getLocale();

  // 1. Validate input.
  const parsed = joinSchema.safeParse({
    invite_code: formData.get('invite_code'),
    display_name: formData.get('display_name'),
  });
  if (!parsed.success) {
    return {
      error: 'validation_failed',
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        code: i.message,
      })),
    };
  }
  const { invite_code, display_name } = parsed.data;

  // 2. Invite-code gate (D-01: exact string equality, case-sensitive, trimmed
  //    by Zod). D-12: NO cutoff / no admin approval - anyone with the code
  //    can join at any time.
  if (invite_code !== process.env.INVITE_CODE) {
    return { error: 'invalid_code' };
  }

  // 3. Sign in anonymously (Supabase rate-limits to 30/hr/IP - AUTH-07/D-02).
  const supabase = await createClient();
  const { data: signIn, error: signInErr } =
    await supabase.auth.signInAnonymously();
  if (signInErr || !signIn?.user) {
    return { error: 'auth_failed' };
  }

  // 4. Determine admin status from env-var display-name match (D-04).
  const isAdmin = isAdminDisplayName(display_name);

  // 5. Insert profile row keyed on auth.uid(). The display_name_normalized
  //    generated column + unique index catches concurrent name conflicts at
  //    the DB layer (T-04-04 defense in depth on top of any client-side check).
  const { error: profileErr } = await supabase.from('profiles').insert({
    user_id: signIn.user.id,
    display_name, // preserves casing/composition
    locale,
    is_admin: isAdmin,
  });

  if (profileErr) {
    // 23505 = unique_violation on profiles_display_name_normalized_uniq.
    // Sign out the just-created anonymous user so the next attempt is clean.
    if (profileErr.code === '23505') {
      await supabase.auth.signOut();
      return { error: 'display_name_taken' };
    }
    await supabase.auth.signOut();
    return { error: 'profile_failed' };
  }

  // 6. Persist locale cookie. next-intl middleware will read this on the
  //    follow-up GET so the user stays on /he/* or /en/* consistently.
  (await cookies()).set('NEXT_LOCALE', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  // 7. Redirect to localized landing. The home page (src/app/[locale]/page.tsx)
  //    forwards to /matches once a profile exists.
  redirect(`/${locale}` as Route);
}

'use server';

import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { cookies } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { joinSchema } from '@/lib/schemas/join';
import { isAdminDisplayName } from '@/lib/auth/admin';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

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
 * joinPool: invite-code -> signInAnonymously -> profiles INSERT (or REBIND).
 *
 * Rebind path (fix-up plan 01-04, Bug 1b):
 *   When the chosen display_name collides with an existing profile AND the
 *   invite code is valid, the action re-points the existing profile (and all
 *   its FK children) to the just-created anonymous user, then deletes the
 *   stale auth.users row. The user is signed in as the rebound profile with
 *   all prior picks/bracket/props preserved.
 *
 *   This implements the family-trust model from PROJECT.md ("family trust
 *   covers anti-cheat") - anyone with the invite code can already claim any
 *   display_name on a new device. The previous "display_name_taken" error
 *   was actively user-hostile because clearing cookies trapped people out of
 *   their own account.
 *
 *   IMPORTANT: when the invite code is INVALID, the rebind path is never
 *   reached - we return invalid_code BEFORE any auth or DB work happens. We
 *   never reveal whether a name exists to someone without the code (T-04-04
 *   information-disclosure tightening).
 *
 * Threat-model checkpoints (see plan 01-04 <threat_model>):
 *   T-04-01: INVITE_CODE has no NEXT_PUBLIC_ prefix; only referenced here.
 *   T-04-04: 23505 uniqueness collision on display_name_normalized is caught.
 *            Behavior depends on whether invite code is valid (see above).
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
  //    can join at any time. This check runs BEFORE any auth or DB work so
  //    a wrong code never reveals whether a display_name exists.
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
  const newUserId = signIn.user.id;

  // 4. Determine admin status from env-var display-name match (D-04).
  const isAdmin = isAdminDisplayName(display_name);

  // 5. Insert profile row keyed on auth.uid(). The display_name_normalized
  //    generated column + unique index catches concurrent name conflicts at
  //    the DB layer (T-04-04 defense in depth on top of any client-side check).
  const { error: profileErr } = await supabase.from('profiles').insert({
    user_id: newUserId,
    display_name, // preserves casing/composition
    locale,
    is_admin: isAdmin,
  });

  if (profileErr) {
    // 23505 = unique_violation on profiles_display_name_normalized_uniq.
    // Invite code already validated above => we trust this is the same family
    // member rejoining. Run the rebind flow.
    if (profileErr.code === '23505') {
      const rebound = await rebindExistingProfile({
        displayName: display_name,
        newUserId,
        locale,
      });
      if (rebound) {
        // Persist locale cookie and redirect (same as fresh-join happy path).
        (await cookies()).set('NEXT_LOCALE', locale, {
          path: '/',
          maxAge: 60 * 60 * 24 * 365,
          sameSite: 'lax',
        });
        redirect(`/${locale}` as Route);
      }
      // Rebind itself failed for some reason - fall through to clean signout.
      await supabase.auth.signOut();
      return { error: 'profile_failed' };
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

/**
 * Re-point an existing profile (and all its FK children) to a new auth.users
 * row, then delete the old auth.users row. Returns true on success.
 *
 * Runs under the service-role client (bypasses RLS - required to UPDATE
 * profiles.user_id and DELETE FROM auth.users; the column-level GRANT in
 * 0002_rls.sql only permits authenticated UPDATE on (display_name, locale)).
 *
 * Lookup uses lower(trim(...)) to match the generated column
 * profiles.display_name_normalized exactly. NFC normalization isn't included
 * here because the DB column also stores normalize(..., NFC) - to keep the
 * lookup symmetric we use the trimmed input value the schema already
 * normalized (Zod .trim() ran in joinSchema).
 *
 * Safety:
 *   - Only reached when invite_code already matched env.INVITE_CODE.
 *   - Operates per-display-name on at most ONE row (unique index ensures it).
 *   - All UPDATEs are atomic-ish per-statement; if a child UPDATE fails after
 *     profiles is rebound, FKs still reference newUserId but auth.users(old)
 *     still exists with no profile - the next join attempt cleans up either
 *     via the normal INSERT or by re-running this rebind.
 */
async function rebindExistingProfile(opts: {
  displayName: string;
  newUserId: string;
  locale: string;
}): Promise<boolean> {
  const svc = createServiceClient();
  const normalized = opts.displayName.trim().toLowerCase();

  // Look up the existing profile by the same normalization the DB uses.
  // We can't read profiles.display_name_normalized through PostgREST without
  // adding it to the types/select - safer to recompute and match it.
  const { data: existing, error: lookupErr } = await svc
    .from('profiles')
    .select('user_id')
    .eq('display_name_normalized', normalized)
    .maybeSingle();

  if (lookupErr || !existing) {
    // The 23505 was raised but we can't find the row - bail. The caller will
    // sign out the new user and surface profile_failed.
    return false;
  }
  const oldUserId = existing.user_id;

  if (oldUserId === opts.newUserId) {
    // Defensive: same user somehow conflicted with themselves. Nothing to
    // rebind - treat as success.
    return true;
  }

  // 1. Re-point profile row to the new auth user + refresh locale.
  const { error: profileUpdateErr } = await svc
    .from('profiles')
    .update({ user_id: opts.newUserId, locale: opts.locale })
    .eq('user_id', oldUserId);
  if (profileUpdateErr) return false;

  // 2. Re-point all FK children. predictions / bracket_picks / prop_answers
  //    all reference auth.users(id) ON DELETE CASCADE. We move them FIRST
  //    so the subsequent auth.users delete doesn't cascade-nuke them.
  const childTables = ['predictions', 'bracket_picks', 'prop_answers'] as const;
  for (const table of childTables) {
    const { error } = await svc
      .from(table)
      .update({ user_id: opts.newUserId })
      .eq('user_id', oldUserId);
    if (error) return false;
  }

  // 3. Delete the old auth.users row. supabase-js admin API is the canonical
  //    way to do this (not a SQL DELETE - we don't have the right grants).
  //    If this fails (e.g. the row was already removed), the rebind is still
  //    functionally correct since the profile + children all point to the
  //    new user; the only consequence is one orphan auth.users row which
  //    Phase 2 ADM-05 cleans up.
  await svc.auth.admin.deleteUser(oldUserId).catch(() => {});

  return true;
}

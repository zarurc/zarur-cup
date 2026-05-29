'use server';

import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireMember } from '@/lib/auth/session';

/**
 * Server Action invoked from the /welcome onboarding page's "Start
 * playing" CTA. Stamps profiles.welcome_seen_at = now() for the current
 * user via the user-scope client (RLS policy profiles_update_self
 * restricts writes to the caller's own row; column-level grant from
 * migration 0019 allows the welcome_seen_at column specifically), then
 * redirects to the localized matches feed.
 *
 * Idempotent: re-dismissing just bumps the timestamp.
 */
export async function markWelcomeSeen(): Promise<void> {
  const supabase = await createClient();
  const member = await requireMember('en');
  await supabase
    .from('profiles')
    .update({ welcome_seen_at: new Date().toISOString() })
    .eq('user_id', member.user_id);
  redirect(`/${member.locale}/matches` as Route);
}

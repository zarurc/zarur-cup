'use server';

import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/service';
import { updateProfileNameSchema } from '@/lib/schemas/updateProfileName';

/**
 * Admin Server Action — rename a roster row (R3).
 *
 * Service-role UPDATE so RLS doesn't block admin writing to another
 * user's row. Catches the unique-constraint violation on
 * profiles_display_name_normalized_uniq (Postgres code 23505) and
 * surfaces it as a clean toast (`?error=name_taken`).
 *
 * Revalidates every surface that renders the renamed user's display
 * name: the roster itself, the leaderboard (both locales), and the
 * matches feed (resulted rows render every family member's pick by
 * display_name).
 */
export async function updateProfileName(formData: FormData): Promise<void> {
  await requireAdmin();

  const parsed = updateProfileNameSchema.safeParse({
    target_user_id: String(formData.get('target_user_id') ?? ''),
    new_name: String(formData.get('new_name') ?? ''),
  });
  if (!parsed.success) {
    redirect('/admin/roster?error=validation' as Route);
  }
  const { target_user_id, new_name } = parsed.data;

  const svc = createServiceClient();
  const { error } = await svc
    .from('profiles')
    .update({ display_name: new_name })
    .eq('user_id', target_user_id);

  if (error) {
    const code = error.code === '23505' ? 'name_taken' : error.message;
    redirect(`/admin/roster?error=${encodeURIComponent(code)}` as Route);
  }

  revalidatePath('/admin/roster');
  revalidatePath('/he/leaderboard');
  revalidatePath('/en/leaderboard');
  revalidatePath('/he/matches');
  revalidatePath('/en/matches');

  redirect('/admin/roster?renamed=1' as Route);
}

'use server';

import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/service';
import { toggleProfileAdminSchema } from '@/lib/schemas/toggleProfileAdmin';

/**
 * Admin Server Action — promote/demote a profile (R4).
 *
 * Service-role UPDATE (the column-level grant on profiles intentionally
 * excludes is_admin — 0002_rls.sql — so any user-scope UPDATE on this
 * column would be rejected at the privilege layer).
 *
 * "Last admin" guard: before demoting, count OTHER admins. If there
 * isn't at least one, redirect with `?error=last_admin`. App-side only
 * per the design call — sufficient for a 15-person family pool.
 *
 * Self-demote is allowed (UI confirm-modal warns the admin); the
 * /admin/(protected)/layout gate will redirect them to /admin/403 on
 * the next request, which is the desired effect.
 */
export async function toggleProfileAdmin(formData: FormData): Promise<void> {
  await requireAdmin();

  const parsed = toggleProfileAdminSchema.safeParse({
    target_user_id: String(formData.get('target_user_id') ?? ''),
    make_admin: String(formData.get('make_admin') ?? ''),
  });
  if (!parsed.success) {
    redirect('/admin/roster?error=validation' as Route);
  }
  const { target_user_id, make_admin } = parsed.data;

  const svc = createServiceClient();

  if (!make_admin) {
    const { count } = await svc
      .from('profiles')
      .select('user_id', { count: 'exact', head: true })
      .eq('is_admin', true)
      .neq('user_id', target_user_id);
    if ((count ?? 0) < 1) {
      redirect('/admin/roster?error=last_admin' as Route);
    }
  }

  const { error } = await svc
    .from('profiles')
    .update({ is_admin: make_admin })
    .eq('user_id', target_user_id);

  if (error) {
    redirect(`/admin/roster?error=${encodeURIComponent(error.message)}` as Route);
  }

  revalidatePath('/admin/roster');
  const toastKey = make_admin ? 'promoted' : 'demoted';
  redirect(`/admin/roster?${toastKey}=1` as Route);
}

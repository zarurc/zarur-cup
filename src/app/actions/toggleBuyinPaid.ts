'use server';

import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/service';
import { toggleBuyinPaidSchema } from '@/lib/schemas/toggleBuyinPaid';

/**
 * Admin Server Action — mark a roster row as paid/unpaid (buy-in ledger).
 *
 * Money never moves through the app — this just flips
 * profiles.buyin_paid_at between NULL and now(). Admin keeps tally as
 * family members send Bit/Venmo/cash out of band.
 *
 * Service-role UPDATE (no user-scope grant on buyin_paid_at; only admin
 * should write it).
 */
export async function toggleBuyinPaid(formData: FormData): Promise<void> {
  await requireAdmin();

  const parsed = toggleBuyinPaidSchema.safeParse({
    target_user_id: String(formData.get('target_user_id') ?? ''),
    paid: String(formData.get('paid') ?? ''),
  });
  if (!parsed.success) {
    redirect('/admin/roster?error=validation' as Route);
  }
  const { target_user_id, paid } = parsed.data;

  const svc = createServiceClient();
  const { error } = await svc
    .from('profiles')
    .update({ buyin_paid_at: paid ? new Date().toISOString() : null })
    .eq('user_id', target_user_id);

  if (error) {
    redirect(`/admin/roster?error=${encodeURIComponent(error.message)}` as Route);
  }

  revalidatePath('/admin/roster');
  revalidatePath('/he/me');
  revalidatePath('/en/me');
  revalidatePath('/he/leaderboard');
  revalidatePath('/en/leaderboard');

  redirect(`/admin/roster?${paid ? 'paid' : 'unpaid'}=1` as Route);
}

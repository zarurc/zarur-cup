'use server';

import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Admin Server Action — merge two duplicate accounts (ADM-05, D-14).
 *
 * Same shape as the Phase 1 D-04 rebind in join.ts:172-230, with one
 * critical Phase 2 extension: the childTables tuple now includes
 * `score_events` (Plan 02-06 PATTERNS lines 280-281), because score_events
 * is a Phase 2 table that also keys on user_id with ON DELETE CASCADE.
 * Without the extension, the final `auth.admin.deleteUser` would cascade
 * and delete the source user's score_events — losing the merged-in
 * points entirely.
 *
 * Conflict policy (PATTERNS line 283): keep target's row when (target,
 * source, ref_id) already exists. We pre-clean by deleting source rows
 * whose unique key overlaps target's BEFORE the bulk UPDATE — this avoids
 * the UPDATE failing with a uniqueness violation, while preserving
 * target's authoritative row.
 *
 * Three pre-cleans (one per uniquely-indexed child table):
 *
 *   - score_events: PK (user_id, source, ref_id) — must dedupe.
 *   - predictions: UNIQUE (user_id, fixture_id) — must dedupe.
 *   - prop_answers: UNIQUE (user_id, question_id) — must dedupe.
 *   - bracket_picks: UNIQUE (user_id, slot_id) — must dedupe. (Phase 1
 *     seeded the table but Phase 2 doesn't write to it; we pre-clean
 *     defensively in case future Phase 3 work back-populates the
 *     source's bracket picks before a merge.)
 *
 * Order matters: pre-clean first, then the bulk UPDATE re-points
 * everything else.
 *
 * T-02-06-03: Zod `.refine` rejects source === target (would otherwise
 * delete the same row twice).
 * T-02-06-04: pre-clean explicitly enumerates each unique-indexed child.
 *
 * Mutate-and-navigate per PATTERNS Pattern A — redirect() at the end.
 */

const inputSchema = z
  .object({
    source_user_id: z.string().uuid('source_invalid'),
    target_user_id: z.string().uuid('target_invalid'),
  })
  .refine((v) => v.source_user_id !== v.target_user_id, {
    message: 'same_user',
  });

export async function mergeUsers(formData: FormData): Promise<void> {
  await requireAdmin();

  const parsed = inputSchema.safeParse({
    source_user_id: String(formData.get('source_user_id') ?? ''),
    target_user_id: String(formData.get('target_user_id') ?? ''),
  });
  if (!parsed.success) {
    redirect('/admin/roster?error=validation' as Route);
  }
  const { source_user_id, target_user_id } = parsed.data;

  const svc = createServiceClient();

  // ---- Pre-clean: score_events PK (user_id, source, ref_id) ----
  // For every (source, ref_id) the TARGET already owns, delete the
  // SOURCE's row so the upcoming UPDATE doesn't try to violate the PK.
  const { data: targetSE } = await svc
    .from('score_events')
    .select('source, ref_id')
    .eq('user_id', target_user_id);
  const targetSEKeys = new Set(
    (targetSE ?? []).map((r) => `${r.source}:${r.ref_id}`),
  );
  const { data: sourceSE } = await svc
    .from('score_events')
    .select('source, ref_id')
    .eq('user_id', source_user_id);
  for (const row of sourceSE ?? []) {
    if (targetSEKeys.has(`${row.source}:${row.ref_id}`)) {
      await svc
        .from('score_events')
        .delete()
        .eq('user_id', source_user_id)
        .eq('source', row.source)
        .eq('ref_id', row.ref_id);
    }
  }

  // ---- Pre-clean: predictions UNIQUE (user_id, fixture_id) ----
  const { data: targetPreds } = await svc
    .from('predictions')
    .select('fixture_id')
    .eq('user_id', target_user_id);
  const targetFixtureIds = new Set(
    (targetPreds ?? []).map((p) => p.fixture_id),
  );
  if (targetFixtureIds.size > 0) {
    await svc
      .from('predictions')
      .delete()
      .eq('user_id', source_user_id)
      .in('fixture_id', [...targetFixtureIds]);
  }

  // ---- Pre-clean: prop_answers UNIQUE (user_id, question_id) ----
  const { data: targetAnswers } = await svc
    .from('prop_answers')
    .select('question_id')
    .eq('user_id', target_user_id);
  const targetQuestionIds = new Set(
    (targetAnswers ?? []).map((a) => a.question_id),
  );
  if (targetQuestionIds.size > 0) {
    await svc
      .from('prop_answers')
      .delete()
      .eq('user_id', source_user_id)
      .in('question_id', [...targetQuestionIds]);
  }

  // ---- Pre-clean: bracket_picks UNIQUE (user_id, slot_id) ----
  // Defensive — Phase 2 doesn't write bracket_picks but the table
  // exists (Phase 1 seed) and Phase 3 will populate it; this keeps
  // the rebind future-proof.
  const { data: targetBP } = await svc
    .from('bracket_picks')
    .select('slot_id')
    .eq('user_id', target_user_id);
  const targetSlotIds = new Set((targetBP ?? []).map((b) => b.slot_id));
  if (targetSlotIds.size > 0) {
    await svc
      .from('bracket_picks')
      .delete()
      .eq('user_id', source_user_id)
      .in('slot_id', [...targetSlotIds]);
  }

  // ---- Bulk UPDATE — extend Phase 1 D-04 rebind with score_events ----
  // join.ts:212-219 uses ['predictions', 'bracket_picks', 'prop_answers'];
  // Plan 02-06 PATTERNS lines 280-281 add 'score_events' for Phase 2.
  const childTables = [
    'predictions',
    'bracket_picks',
    'prop_answers',
    'score_events',
  ] as const;
  for (const table of childTables) {
    const { error } = await svc
      .from(table)
      .update({ user_id: target_user_id })
      .eq('user_id', source_user_id);
    if (error) {
      redirect(
        `/admin/roster?error=${encodeURIComponent(`${table}:${error.message}`)}` as Route,
      );
    }
  }

  // ---- Delete the source profile row (auth.users CASCADE handles FK) ----
  const { error: pErr } = await svc
    .from('profiles')
    .delete()
    .eq('user_id', source_user_id);
  if (pErr) {
    redirect(`/admin/roster?error=${encodeURIComponent(pErr.message)}` as Route);
  }

  // ---- Delete the source auth.users row (Phase 1 D-04 mirror — join.ts:227)
  //      Catch + swallow: if the row is already gone, the rebind is
  //      functionally correct; the only consequence is one orphan
  //      auth.users row, which is harmless.
  await svc.auth.admin.deleteUser(source_user_id).catch(() => {});

  revalidatePath('/admin/roster');
  revalidatePath('/he/leaderboard');
  revalidatePath('/en/leaderboard');
  revalidatePath('/he/matches');
  revalidatePath('/en/matches');

  redirect('/admin/roster?merged=1' as Route);
}

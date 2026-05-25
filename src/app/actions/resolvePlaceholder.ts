'use server';

import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Admin Server Action — resolve a placeholder slot to a concrete team
 * (ADM-03 + D-11).
 *
 * Phase 1 seeded 32 knockout fixtures with text placeholders in
 * `fixtures.home_placeholder` / `fixtures.away_placeholder` (e.g.
 * 'WINNER_GROUP_A', 'R16_M1_W'). Once the group stage finishes or a
 * knockout round resolves, admin uses this action to map a placeholder
 * to a real team — every fixture row that references the placeholder
 * gets its home_team_id/away_team_id filled in.
 *
 * Propagation strategy: app-code loop per D-11 (RESEARCH 745-746 rejects
 * a recursive CTE). Three sequential UPDATEs:
 *
 *   1. Set fixtures.home_team_id wherever home_placeholder matches.
 *   2. Set fixtures.away_team_id wherever away_placeholder matches.
 *   3. Set bracket_slots.resolved_team_id wherever slot_code matches.
 *      (bracket_slots.slot_code carries the same structured tokens —
 *       e.g. 'R16_M1_W' = winner of R16 match 1.)
 *
 * The Phase-1 fixtures placeholder columns store opaque tokens; the
 * exact tokens match the bracket_slots.slot_code seed values, so a single
 * placeholder string flowing into both updates is correct.
 *
 * Mutate-and-navigate per PATTERNS Pattern A — redirect() at the end.
 * Revalidate the player /matches feeds so the new team names show up
 * without the user having to hard-refresh.
 *
 * T-02-06-01: gated by `await requireAdmin()` as first executable line.
 * T-02-06-02: Zod-validated; PostgREST parameter binding prevents SQL
 *             injection; `placeholder` is an opaque token equality check.
 */

const inputSchema = z.object({
  placeholder: z.string().trim().min(1, 'placeholder_empty').max(64),
  team_id: z.string().uuid('team_id_invalid'),
});

export async function resolvePlaceholder(formData: FormData): Promise<void> {
  await requireAdmin();

  const parsed = inputSchema.safeParse({
    placeholder: String(formData.get('placeholder') ?? ''),
    team_id: String(formData.get('team_id') ?? ''),
  });
  if (!parsed.success) {
    redirect('/admin/tournament-tree?error=validation' as Route);
  }
  const { placeholder, team_id } = parsed.data;

  const svc = createServiceClient();

  // 1. Re-point fixtures.home_team_id (and clear the placeholder string
  //    so the resolver UI stops listing it).
  const { error: e1 } = await svc
    .from('fixtures')
    .update({ home_team_id: team_id, home_placeholder: null })
    .eq('home_placeholder', placeholder);
  if (e1) {
    redirect(
      `/admin/tournament-tree?error=${encodeURIComponent(e1.message)}` as Route,
    );
  }

  // 2. Re-point fixtures.away_team_id.
  const { error: e2 } = await svc
    .from('fixtures')
    .update({ away_team_id: team_id, away_placeholder: null })
    .eq('away_placeholder', placeholder);
  if (e2) {
    redirect(
      `/admin/tournament-tree?error=${encodeURIComponent(e2.message)}` as Route,
    );
  }

  // 3. Mark bracket_slots.resolved_team_id where its slot_code matches.
  //    If the placeholder is a group-winner token (e.g. WINNER_GROUP_A)
  //    there is no matching bracket_slots row — that's expected and a
  //    no-op. The plan called this column `code`, but the live DB column
  //    is `slot_code` (verified against src/types/supabase.ts:bracket_slots).
  await svc
    .from('bracket_slots')
    .update({ resolved_team_id: team_id })
    .eq('slot_code', placeholder);

  // Revalidate the player feeds + admin tabs so the new team name and
  // any downstream bracket fixtures show up. Pitfall 6: explicit per-locale.
  revalidatePath('/he/matches');
  revalidatePath('/en/matches');
  revalidatePath('/admin/matches');
  revalidatePath('/admin/tournament-tree');

  redirect(
    `/admin/tournament-tree?resolved=${encodeURIComponent(placeholder)}` as Route,
  );
}

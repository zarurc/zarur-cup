'use server';

import { revalidatePath } from 'next/cache';
import { predictionSchema } from '@/lib/schemas/prediction';
import { createClient } from '@/lib/supabase/server';

/**
 * Mutate-and-stay Server Action (PATTERNS Pattern B / RESEARCH Pattern 3).
 *
 * Canonical kickoff lock lives in Phase 1 RLS (D-08): the predicate
 *   USING (f.kickoff_at > now()) WITH CHECK (f.kickoff_at > now())
 * on predictions_insert + predictions_update rejects post-kickoff writes
 * with PostgREST error code 42501 ("permission denied / RLS rejection").
 * We translate that to `{ ok: false, error: 'locked' }` so the client
 * stepper can revert and surface inline copy.
 *
 * No navigation — the client uses startTransition + re-render to keep
 * the user on /[locale]/matches (mutate-and-stay; no redirect on success
 * or failure).
 *
 * user_id is derived from the validated JWT claim (auth.uid()), never from
 * input — defends T-02-03-02 (cross-user write) even if the row gate is
 * already enforced by the WITH CHECK clause.
 */
export type SavePredictionResult =
  | { ok: true }
  | { ok: false; error: 'locked' | 'validation' | 'network' | 'unauthenticated' };

export async function savePrediction(
  input: unknown,
): Promise<SavePredictionResult> {
  const parsed = predictionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const { fixture_id, home_score, away_score } = parsed.data;

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false, error: 'unauthenticated' };

  const { error } = await supabase.from('predictions').upsert(
    {
      user_id: claims.claims.sub,
      fixture_id,
      home_score,
      away_score,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,fixture_id' },
  );

  if (error) {
    if (error.code === '42501') return { ok: false, error: 'locked' };
    return { ok: false, error: 'network' };
  }

  // Mutate-and-stay: explicit per-locale revalidate (Pitfall 6).
  revalidatePath('/he/matches');
  revalidatePath('/en/matches');
  return { ok: true };
}

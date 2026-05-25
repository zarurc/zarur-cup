'use server';

import { revalidatePath } from 'next/cache';
import { propAnswerSchema } from '@/lib/schemas/propAnswer';
import { createClient } from '@/lib/supabase/server';

/**
 * Mutate-and-stay Server Action for prop answers (PATTERNS Pattern B,
 * mirror of savePrediction). Canonical lock lives in Phase 1 RLS
 * (0002_rls.sql:165-173): the `prop_answers_insert/update` WITH CHECK
 * predicate joins `prop_questions -> tournament` and requires
 * `tournament.starts_at > now()`. Post-first-kickoff writes are
 * rejected with PostgREST 42501 — we translate that to
 * `{ ok: false, error: 'locked' }` for the client to surface inline.
 *
 * user_id derives from the validated JWT claim (claims.sub), never
 * from input — defends T-02-04-03 (cross-user write).
 *
 * NOTE: `answer_type` enum is UNDERSCORED ('single_team' /
 * 'single_player' / 'text') per the DB CHECK constraint at
 * 0001_init.sql:138 — propAnswerSchema enforces the same. The plan
 * text used dashes; the live DB and the Plan 02-02 Zod schema use
 * underscores, so that is the contract this action validates against.
 */
export type SavePropAnswerResult =
  | { ok: true }
  | { ok: false; error: 'locked' | 'validation' | 'network' | 'unauthenticated' };

export async function savePropAnswer(
  input: unknown,
): Promise<SavePropAnswerResult> {
  const parsed = propAnswerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const { question_id, answer } = parsed.data;

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false, error: 'unauthenticated' };

  const { error } = await supabase.from('prop_answers').upsert(
    {
      user_id: claims.claims.sub,
      question_id,
      answer,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,question_id' },
  );

  if (error) {
    if (error.code === '42501') return { ok: false, error: 'locked' };
    return { ok: false, error: 'network' };
  }

  // Mutate-and-stay: explicit per-locale revalidate (Pitfall 6).
  revalidatePath('/he/props');
  revalidatePath('/en/props');
  return { ok: true };
}

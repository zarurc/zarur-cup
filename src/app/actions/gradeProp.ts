'use server';

import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/service';
import { propGradingSchema } from '@/lib/schemas/propAuthoring';
import { scoreProp, type PropAnswerType } from '@/lib/scoring/props';
import {
  sweepAndUpsert,
  type ScoreEventRow,
} from '@/lib/scoring/sweepAndUpsert';

/**
 * Admin Server Action — grade a prop_question (PRP-04 + SCR-04 + SCR-06,
 * D-13).
 *
 * Sister to saveResult (Plan 02-05) — the same six-step orchestrator
 * shape, just sourcing 'prop' instead of 'league' and routing through
 * scoreProp + the propGradingSchema:
 *
 *   1. requireAdmin() — first executable line, defense-in-depth with
 *      the /admin/(protected)/layout.tsx gate.
 *   2. Parse + normalize the aliases textarea. The UI sends a single
 *      newline-delimited string; we split, trim, and drop blanks before
 *      Zod sees it so the schema can enforce the max-20 alias cap on
 *      the de-duped set (T-02-02-04).
 *   3. UPDATE prop_questions with correct_answer + correct_answer_aliases.
 *      The DB column is `points` (not `points_value`); we read it back
 *      with `points` so the scoreProp call has the right value.
 *   4. SELECT every prop_answers row for this question (service-role
 *      bypasses RLS so we see all family answers).
 *   5. Score each via scoreProp (Plan 02-02 pure function). pointsAtStake
 *      reads from prop_questions.points (DB column).
 *   6. sweepAndUpsert with source='prop' + ref_id=question_id — same
 *      idempotency contract as saveResult: DELETE stragglers + UPSERT
 *      on PK + revalidate the 8 explicit per-locale paths.
 *
 * Re-grading is safe by construction: the PK (user_id, source, ref_id)
 * on score_events makes re-submitting the same correct_answer + aliases
 * a no-op at row level (just bumps updated_at).
 *
 * Mutate-and-navigate per PATTERNS Pattern A — redirect() at the end.
 *
 * Note on the propGradingSchema: the schema field `correct_answer_aliases`
 * expects an array; the UI sends a single textarea string. We split here
 * (not inside the schema) so the schema can stay reusable for callers
 * that already have a string array (e.g. a JSON API).
 */

export async function gradeProp(formData: FormData): Promise<void> {
  await requireAdmin();

  // Split the textarea into a trimmed, blank-stripped array BEFORE Zod
  // sees it. The propGradingSchema's `.max(20)` then bounds the
  // de-duped array (T-02-02-04). De-duping happens implicitly: blanks
  // are dropped; exact duplicates aren't filtered because scoreProp
  // already de-dups via the Set constructor.
  const aliasesRaw = String(formData.get('correct_answer_aliases') ?? '');
  const aliases = aliasesRaw
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const parsed = propGradingSchema.safeParse({
    id: String(formData.get('id') ?? ''),
    correct_answer: String(formData.get('correct_answer') ?? ''),
    correct_answer_aliases: aliases,
  });
  if (!parsed.success) {
    redirect('/admin/props?error=validation' as Route);
  }
  const { id, correct_answer, correct_answer_aliases } = parsed.data;

  const svc = createServiceClient();

  // 1. UPDATE prop_questions with the canonical correct answer + aliases.
  //    SELECT back the answer_type + points so we can score each answer.
  //    DB column is `points` (NOT `points_value`); we re-export it as a
  //    fresh local name to keep the rest of the function readable.
  const { data: question, error: e1 } = await svc
    .from('prop_questions')
    .update({ correct_answer, correct_answer_aliases })
    .eq('id', id)
    .select('id, answer_type, points')
    .maybeSingle();
  if (e1 || !question) {
    redirect(
      `/admin/props?error=${encodeURIComponent(e1?.message ?? 'no_question')}` as Route,
    );
  }

  // 2. Read every prop_answers row for this question. Service-role
  //    bypasses prop_answers' per-user RLS — admin sees all answers.
  const { data: answers, error: e2 } = await svc
    .from('prop_answers')
    .select('user_id, answer')
    .eq('question_id', id);
  if (e2) {
    redirect(`/admin/props?error=${encodeURIComponent(e2.message)}` as Route);
  }

  // 3. Score each answer. scoreProp is a pure function (Plan 02-02);
  //    `kind` is 'correct' | 'miss' on the prop branch.
  const rows: ScoreEventRow[] = (answers ?? []).map((a) => {
    const { points, kind } = scoreProp({
      userAnswer: a.answer,
      correctAnswer: correct_answer,
      answerType: question.answer_type as PropAnswerType,
      pointsAtStake: question.points,
      aliases: correct_answer_aliases,
    });
    return {
      user_id: a.user_id,
      source: 'prop' as const,
      ref_id: id,
      points,
      kind,
    };
  });

  // 4. Sweep + UPSERT + revalidate 8 explicit per-locale paths. The
  //    sweep clears any stale score_events rows for users who answered
  //    once, scored, then deleted their answer.
  const result = await sweepAndUpsert({
    svc,
    source: 'prop',
    ref_id: id,
    rows,
  });
  if (!result.ok) {
    redirect(`/admin/props?error=${encodeURIComponent(result.error)}` as Route);
  }

  // Player props feeds already revalidated by sweepAndUpsert; refresh
  // the admin tab specifically (not in the sweep's 8-path list).
  revalidatePath('/admin/props');

  redirect(`/admin/props?graded=${encodeURIComponent(id)}` as Route);
}

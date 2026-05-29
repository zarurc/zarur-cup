import 'server-only';
import type { createClient } from '@/lib/supabase/server';

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type UnansweredPropsBannerData = {
  unansweredCount: number;
  totalCount: number;
};

/**
 * Returns banner data iff (a) tournament is pre-lock, (b) at least one
 * prop_question exists, and (c) the user has at least one unanswered
 * question. Null otherwise — caller skips rendering.
 *
 * Tournament pin: code='WC2026' (matches /me + /me/props convention).
 */
export async function getUnansweredPropsBannerData(
  supabase: ServerClient,
  userId: string,
): Promise<UnansweredPropsBannerData | null> {
  const { data: tournament } = await supabase
    .from('tournament')
    .select('id, starts_at')
    .eq('code', 'WC2026')
    .maybeSingle();
  if (!tournament) return null;
  if (new Date(tournament.starts_at).getTime() <= Date.now()) return null;

  const { data: questions } = await supabase
    .from('prop_questions')
    .select('id')
    .eq('tournament_id', tournament.id);
  if (!questions || questions.length === 0) return null;

  const totalCount = questions.length;
  const questionIds = questions.map((q) => q.id);

  const { data: answers } = await supabase
    .from('prop_answers')
    .select('question_id')
    .eq('user_id', userId)
    .in('question_id', questionIds);

  const answeredCount = (answers ?? []).length;
  const unansweredCount = totalCount - answeredCount;
  if (unansweredCount <= 0) return null;
  return { unansweredCount, totalCount };
}

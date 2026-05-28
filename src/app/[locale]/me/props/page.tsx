import { setRequestLocale, getTranslations } from 'next-intl/server';
import { requireMember } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { EmptyStateCard } from '@/components/layout/EmptyStateCard';
import { PropCard, type PropQuestion } from '@/components/props/PropCard.client';
import { PropReceipt } from '@/components/props/PropReceipt';
import type { Team } from '@/lib/teams/flags';

type Props = { params: Promise<{ locale: string }> };

/**
 * /[locale]/me/props — strictly private props feed (D-38 + D-39 + PRIVATE-01..04).
 *
 * Variant decision is server-side on `tournament.starts_at`:
 *   - starts_at > now()   → editable variant (PropCard with 600ms-debounced save)
 *   - starts_at <= now()  → READ-ONLY RECEIPT (PropReceipt server component,
 *                            zero client JS post-lock; own answers only)
 *
 * The previous /[locale]/props page exposed all members' answers post-kickoff
 * (D-25). That is reversed entirely per D-38. RLS migration 0013 (Plan 02-10
 * Task 1) enforces the same at the database level — defense in depth.
 */
export default async function MePropsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const safeLocale: 'he' | 'en' = locale === 'he' ? 'he' : 'en';
  const member = await requireMember(safeLocale);
  const t = await getTranslations('props');
  const supabase = await createClient();

  // WR-01 fix (2026-05-27): pin to code='WC2026'.
  const { data: tournament } = await supabase
    .from('tournament')
    .select('id, starts_at')
    .eq('code', 'WC2026')
    .maybeSingle();

  if (!tournament) {
    return (
      <div className="mi-auto max-is-md mbs-12 pi-4">
        <EmptyStateCard heading={t('empty.heading')} body={t('empty.body')} />
      </div>
    );
  }

  const isLocked = new Date(tournament.starts_at).getTime() <= Date.now();

  const { data: questions } = await supabase
    .from('prop_questions')
    .select(
      'id, answer_type, points, prompt_en, prompt_he, correct_answer, correct_answer_aliases',
    )
    .eq('tournament_id', tournament.id)
    .order('id', { ascending: true });

  if (!questions || questions.length === 0) {
    return (
      <div className="mi-auto max-is-md mbs-12 pi-4">
        <EmptyStateCard heading={t('empty.heading')} body={t('empty.body')} />
      </div>
    );
  }

  const questionIds = questions.map((q) => q.id);

  // RLS (post-0013) filters to own answers ONLY — no client-side filter needed.
  const { data: answers } = await supabase
    .from('prop_answers')
    .select('user_id, question_id, answer, submitted_at')
    .in('question_id', questionIds);
  const ownAnswerByQuestion = new Map<string, string>();
  for (const a of answers ?? []) {
    if (a.user_id === member.user_id) {
      ownAnswerByQuestion.set(a.question_id, a.answer);
    }
  }

  const needsTeams = questions.some((q) => q.answer_type === 'single_team');
  let teams: Team[] = [];
  if (needsTeams) {
    const { data: teamRows } = await supabase
      .from('teams')
      .select('id, code, name_en, name_he')
      .order('code', { ascending: true });
    teams = teamRows ?? [];
  }

  const myScoreByQuestion = new Map<
    string,
    { points: number; kind: string | null }
  >();
  if (isLocked) {
    const { data: scoreEvents } = await supabase
      .from('score_events')
      .select('ref_id, points, kind')
      .eq('source', 'prop')
      .eq('user_id', member.user_id)
      .in('ref_id', questionIds);
    for (const se of scoreEvents ?? []) {
      myScoreByQuestion.set(se.ref_id, {
        points: se.points,
        kind: se.kind ?? null,
      });
    }
  }

  return (
    <div className="mi-auto max-is-md mbs-12 pi-4 pbe-24">
      <h1 className="text-xl font-bold text-[var(--zc-primary)] mbe-2">
        {t('headingPrivate')}
      </h1>
      <p className="text-sm text-[var(--zc-muted-foreground)] mbs-2 mbe-4">
        {isLocked ? t('lockedNotePrivate') : t('ctaPrivate')}
      </p>
      {questions.map((q) => {
        const initialAnswer = ownAnswerByQuestion.get(q.id) ?? null;

        if (!isLocked) {
          const narrowed: PropQuestion = {
            id: q.id,
            answer_type: q.answer_type as PropQuestion['answer_type'],
            points_value: q.points,
            prompt_en: q.prompt_en,
            prompt_he: q.prompt_he,
          };
          return (
            <PropCard
              key={q.id}
              locale={safeLocale}
              question={narrowed}
              initialAnswer={initialAnswer}
              teams={q.answer_type === 'single_team' ? teams : []}
            />
          );
        }

        return (
          <PropReceipt
            key={q.id}
            locale={safeLocale}
            question={{
              answer_type: q.answer_type,
              points_value: q.points,
              prompt_en: q.prompt_en,
              prompt_he: q.prompt_he,
              correct_answer: q.correct_answer,
            }}
            ownAnswer={initialAnswer}
            score={myScoreByQuestion.get(q.id) ?? null}
            teams={q.answer_type === 'single_team' ? teams : []}
            labels={{
              yourAnswerLabel: t('yourAnswerLabel'),
              correctAnswerLabel: t('correctAnswerLabel'),
              notAnsweredLabel: t('notAnsweredLabel'),
              awaitingGradeLabel: t('awaitingGradeLabel'),
              ptsMaxSuffix: t('ptsMaxSuffix'),
            }}
          />
        );
      })}
    </div>
  );
}

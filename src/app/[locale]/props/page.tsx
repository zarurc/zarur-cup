import { setRequestLocale, getTranslations } from 'next-intl/server';
import { requireMember } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { EmptyStateCard } from '@/components/layout/EmptyStateCard';
import { PropCard, type PropQuestion } from '@/components/props/PropCard.client';
import { PtsBadge, type PtsKind } from '@/components/ui/PtsBadge';
import type { Team } from '@/components/props/FlagGrid.client';

type Props = { params: Promise<{ locale: string }> };

/**
 * Player-facing props feed (PRP-01..04 + VIS-04 + SCR-07).
 *
 * Variant decision is server-side and keys on `tournament.starts_at`
 * (Phase 1 RLS uses the same column — D-08, D-22, D-25):
 *
 *   - starts_at > now()   → editable variant (PropCard with answer-type
 *                            specific input + 600ms-debounced save)
 *   - starts_at <= now()  → reveal variant (read-only block per question,
 *                            iterating the FULL family roster so non-
 *                            answerers show em-dash + +0 — mirrors
 *                            MatchRowResulted from Plan 02-03)
 *
 * RLS enforces both the lock (prop_answers_insert WITH CHECK
 * starts_at > now()) and the visibility (prop_answers_read opens
 * to all family members post-first-kickoff). The UI swap is
 * cosmetic — RLS is the canonical lock.
 *
 * Layout already provides the 56px header offset via <main pbs-14>.
 * The plan's <main className="mbs-14 ..."> would have nested mains
 * and double-counted chrome (same Rule 1 bug Plan 02-03 fixed). We
 * return a <div> wrapper with mbs-4 instead.
 */
export default async function PropsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const safeLocale: 'he' | 'en' = locale === 'he' ? 'he' : 'en';
  const member = await requireMember(safeLocale);
  const t = await getTranslations('props');
  const supabase = await createClient();

  // 1. Tournament — lock anchor and tournament_id filter.
  const { data: tournament } = await supabase
    .from('tournament')
    .select('id, starts_at')
    .order('starts_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!tournament) {
    return (
      <div className="pi-4">
        <EmptyStateCard
          heading={t('empty.heading')}
          body={t('empty.body')}
        />
      </div>
    );
  }

  const isRevealed =
    new Date(tournament.starts_at).getTime() <= Date.now();

  // 2. Questions for this tournament. answer_type widens to `string` in
  //    generated types (CHECK enum) — narrowed below per row. DB column
  //    is `points`; the Zod/form/UI field is `points_value` (Plan 02-02),
  //    so we map at the row-construction boundary below (same pattern as
  //    the admin props RSC).
  const { data: questions } = await supabase
    .from('prop_questions')
    .select(
      'id, answer_type, points, prompt_en, prompt_he, correct_answer, correct_answer_aliases',
    )
    .eq('tournament_id', tournament.id)
    .order('id', { ascending: true });

  if (!questions || questions.length === 0) {
    return (
      <div className="pi-4">
        <EmptyStateCard
          heading={t('empty.heading')}
          body={t('empty.body')}
        />
      </div>
    );
  }

  const questionIds = questions.map((q) => q.id);

  // 3. Own/all answers — RLS filters to own pre-reveal and opens to all
  //    post-reveal (Phase 1 prop_answers_read). Embed query is correct.
  const { data: answers } = await supabase
    .from('prop_answers')
    .select('user_id, question_id, answer, submitted_at')
    .in('question_id', questionIds);
  const answersByKey = new Map<
    string,
    { user_id: string; answer: string }
  >();
  for (const a of answers ?? []) {
    answersByKey.set(`${a.question_id}:${a.user_id}`, {
      user_id: a.user_id,
      answer: a.answer,
    });
  }

  // 4. Teams (only if there's at least one single_team prop). Used both
  //    for the editable FlagGrid AND for the reveal block's team-name
  //    lookup when displaying others' answers.
  const needsTeams = questions.some(
    (q) => q.answer_type === 'single_team',
  );
  let teams: Team[] = [];
  if (needsTeams) {
    const { data: teamRows } = await supabase
      .from('teams')
      .select('id, code, name_en, name_he')
      .order('code', { ascending: true });
    teams = teamRows ?? [];
  }

  // 5. Reveal-only: full roster (so non-answerers render as em-dash +
  //    +0) and score_events (so each player's points are shown). Both
  //    omitted pre-reveal — saves two queries + RLS prevents leakage.
  let roster: Array<{ user_id: string; display_name: string }> = [];
  const scoreByKey = new Map<
    string,
    { points: number; kind: PtsKind | null }
  >();
  if (isRevealed) {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('user_id, display_name');
    roster = profileRows ?? [];
    const { data: scoreEvents } = await supabase
      .from('score_events')
      .select('user_id, ref_id, points, kind')
      .eq('source', 'prop')
      .in('ref_id', questionIds);
    for (const se of scoreEvents ?? []) {
      scoreByKey.set(`${se.ref_id}:${se.user_id}`, {
        points: se.points,
        kind: (se.kind as PtsKind | null) ?? null,
      });
    }
  }

  // Resolve the active user's UUID for "your answer" lookup —
  // requireMember already returned a validated profile with user_id.
  const myUserId = member.user_id;

  return (
    <div className="pi-4 pbe-24">
      <h1 className="sr-only">
        {safeLocale === 'he' ? 'שאלות' : 'Props'}
      </h1>
      {!isRevealed && (
        <p className="text-sm text-[var(--zc-muted-foreground)] mbs-4 mbe-4">
          {t('cta')}
        </p>
      )}
      {isRevealed && (
        <p className="text-sm text-[var(--zc-muted-foreground)] mbs-4 mbe-4">
          {t('lockedNote')}
        </p>
      )}
      {questions.map((q) => {
        const ownAnswer = answersByKey.get(`${q.id}:${myUserId}`);
        const initialAnswer = ownAnswer?.answer ?? null;

        if (!isRevealed) {
          // Narrow answer_type to the PropQuestion union the client
          // component expects. The DB CHECK constraint guarantees one
          // of three literal values; the cast tells TS what we know.
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

        // Reveal variant — mirror MatchRowResulted's per-player block
        // pattern from Plan 02-03 so the family's mental model is
        // consistent across the two surfaces.
        const prompt = safeLocale === 'he' ? q.prompt_he : q.prompt_en;

        const displayAnswer = (raw: string): string => {
          if (q.answer_type === 'single_team') {
            const tm = teams.find((t2) => t2.id === raw);
            if (tm) return safeLocale === 'he' ? tm.name_he : tm.name_en;
            return raw;
          }
          return raw;
        };

        const correctDisplay = q.correct_answer
          ? displayAnswer(q.correct_answer)
          : null;

        return (
          <article
            key={q.id}
            className="bg-[var(--zc-card)] border border-[var(--zc-border)] rounded-2xl pi-4 pbs-4 pbe-4 mbs-4"
          >
            <h3 className="text-base font-bold text-[var(--zc-primary)] mbe-2">
              {prompt}
            </h3>
            {correctDisplay && (
              <p className="text-sm mbe-3">
                <span className="text-[var(--zc-muted-foreground)]">
                  {t('correctAnswerLabel')}:{' '}
                </span>
                <span className="font-bold text-[var(--zc-primary)]">
                  {correctDisplay}
                </span>
              </p>
            )}
            <div className="-mi-4">
              {roster.map((profile) => {
                const ans = answersByKey.get(`${q.id}:${profile.user_id}`);
                const score = scoreByKey.get(`${q.id}:${profile.user_id}`);
                const answerDisplay = ans ? displayAnswer(ans.answer) : '—';
                return (
                  <div
                    key={profile.user_id}
                    className="border-t border-[var(--zc-border)] pbs-2 pbe-2 pi-4 flex items-center gap-3 text-base min-bs-8"
                  >
                    <span className="font-bold flex-1 truncate">
                      {profile.display_name}:
                    </span>
                    <span className="truncate text-[var(--zc-muted-foreground)]">
                      {answerDisplay}
                    </span>
                    <PtsBadge
                      points={score?.points ?? 0}
                      kind={score?.kind ?? 'miss'}
                    />
                  </div>
                );
              })}
            </div>
          </article>
        );
      })}
    </div>
  );
}

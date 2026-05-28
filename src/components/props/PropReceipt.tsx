import { PtsBadge, type PtsKind } from '@/components/ui/PtsBadge';
import type { Team } from '@/lib/teams/flags';

/**
 * Read-only props receipt (post-lock state for /[locale]/me/props).
 *
 * Server component — zero client JS. Renders ONE card per question:
 *   - The prompt in the active locale
 *   - The user's own answer (or em-dash + "not answered" copy if missing)
 *   - The correct answer (only if admin has graded — `correct_answer` non-null)
 *   - The user's points (only if score_events row exists; otherwise renders
 *     "awaiting grade" copy)
 *
 * Other members' answers are NEVER loaded or rendered (D-38 strictly private).
 *
 * Token use: same conventions as PropCard.client.tsx — `[var(--zc-X)]`
 * everywhere, logical-property utilities only (Phase 1 P05 Pitfall 4 / FND-03).
 */

type ReceiptQuestion = {
  answer_type: string;
  points_value: number;
  prompt_en: string;
  prompt_he: string;
  correct_answer: string | null;
};

type ReceiptScore = {
  points: number;
  kind: string | null;
};

type ReceiptLabels = {
  yourAnswerLabel: string;
  correctAnswerLabel: string;
  notAnsweredLabel: string;
  awaitingGradeLabel: string;
  ptsMaxSuffix: string;
};

export function PropReceipt({
  locale,
  question,
  ownAnswer,
  score,
  teams,
  labels,
}: {
  locale: 'he' | 'en';
  question: ReceiptQuestion;
  ownAnswer: string | null;
  score: ReceiptScore | null;
  teams: Team[];
  labels: ReceiptLabels;
}) {
  const prompt = locale === 'he' ? question.prompt_he : question.prompt_en;

  const displayAnswer = (raw: string | null): string => {
    if (!raw) return '—';
    if (question.answer_type === 'single_team') {
      const tm = teams.find((t) => t.id === raw);
      if (tm) return locale === 'he' ? tm.name_he : tm.name_en;
      return raw;
    }
    return raw;
  };

  const ownDisplay = displayAnswer(ownAnswer);
  const correctDisplay = question.correct_answer
    ? displayAnswer(question.correct_answer)
    : null;

  // WR-02 fix (2026-05-27): infer kind from points when score row exists but
  // kind is null. Previously fell back to 'miss' even for positive-points rows,
  // producing a confusing "missed" badge alongside a non-zero pts value.
  const ptsKind: PtsKind =
    (score?.kind as PtsKind | undefined) ??
    (score && score.points > 0 ? 'correct' : 'miss');

  return (
    <article className="bg-[var(--zc-card)] border border-[var(--zc-border)] rounded-2xl pi-4 pbs-4 pbe-4 mbs-4">
      <h3 className="text-base font-bold text-[var(--zc-primary)] mbe-2">
        {prompt}
      </h3>

      <p className="text-sm mbe-2">
        <span className="text-[var(--zc-muted-foreground)]">
          {labels.yourAnswerLabel}:{' '}
        </span>
        <span className="font-bold text-[var(--zc-primary)]">
          {ownAnswer ? ownDisplay : labels.notAnsweredLabel}
        </span>
      </p>

      {correctDisplay && (
        <p className="text-sm mbe-2">
          <span className="text-[var(--zc-muted-foreground)]">
            {labels.correctAnswerLabel}:{' '}
          </span>
          <span className="font-bold text-[var(--zc-primary)]">
            {correctDisplay}
          </span>
        </p>
      )}

      {score ? (
        <div className="flex items-center justify-between mbs-3 pbs-3 border-t border-[var(--zc-border)]">
          <span className="text-sm text-[var(--zc-muted-foreground)]">
            {question.points_value} {labels.ptsMaxSuffix}
          </span>
          <PtsBadge points={score.points} kind={ptsKind} />
        </div>
      ) : (
        <p className="text-sm text-[var(--zc-muted-foreground)] mbs-3 pbs-3 border-t border-[var(--zc-border)]">
          {labels.awaitingGradeLabel}
        </p>
      )}
    </article>
  );
}

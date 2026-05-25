import { getTranslations } from 'next-intl/server';

/**
 * +{N} {kind_label} badge per UI-SPEC §5. Server-renderable.
 *
 * Kinds map to UI-SPEC tone palette:
 *   - exact     → text-[var(--zc-score-exact)] + bold
 *   - goal-diff → text-[var(--zc-score-good)]  + bold
 *   - winner    → text-[var(--zc-score-good)]  + bold
 *   - correct   → text-[var(--zc-score-good)]  + bold  (props)
 *   - miss      → text-[var(--zc-score-miss)]  + normal
 *
 * The plus sign is rendered inside <span dir="ltr"> so HE doesn't flip it
 * (Pattern G / Pitfall 7).
 */
export type PtsKind = 'exact' | 'goal-diff' | 'winner' | 'miss' | 'correct';

const TONE: Record<PtsKind, string> = {
  exact: 'text-[var(--zc-score-exact)] font-bold',
  'goal-diff': 'text-[var(--zc-score-good)] font-bold',
  winner: 'text-[var(--zc-score-good)] font-bold',
  correct: 'text-[var(--zc-score-good)] font-bold',
  miss: 'text-[var(--zc-score-miss)]',
};

const KIND_KEY: Record<PtsKind, string> = {
  exact: 'exact',
  'goal-diff': 'goalDiff',
  winner: 'winner',
  miss: 'miss',
  correct: 'correct',
};

export async function PtsBadge({
  points,
  kind,
}: {
  points: number;
  kind: PtsKind;
}) {
  const t = await getTranslations('pts');
  const label = t(KIND_KEY[kind]);
  return (
    <span
      className={`inline-flex items-center gap-1 ps-2 pe-2 pbs-1 pbe-1 rounded-full text-sm tabular-nums ${TONE[kind]}`}
    >
      <span dir="ltr">+{points}</span> <span>{label}</span>
    </span>
  );
}

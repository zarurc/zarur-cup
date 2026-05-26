import { getTranslations } from 'next-intl/server';
import { PtsBadge, type PtsKind } from '@/components/ui/PtsBadge';
import { codeToFlag } from '@/lib/teams/codeToFlag';

/**
 * Post-result reveal row per UI-SPEC §4 + SCR-07 + VIS-05.
 *
 * Renders when fixture.result_home_90min IS NOT NULL (Pitfall 2 — never key
 * variant on predictions.length, which is RLS-filtered). Shows the actual
 * 90-minute result + EVERY family member's pick side-by-side with PtsBadge.
 *
 * Picks are sorted by points DESC then locale-aware display_name ASC via
 * Intl.Collator (sensitivity: 'base' so Hebrew niqqud / Latin case fold
 * predictably). Non-predictors render as em-dash + +0.
 */
type Team = { code: string; name_en: string; name_he: string };
type PlayerPick = {
  user_id: string;
  display_name: string;
  home_score: number | null;
  away_score: number | null;
  points: number;
  kind: PtsKind | null;
};

export async function MatchRowResulted({
  fixtureId,
  locale,
  homeTeam,
  awayTeam,
  resultHome,
  resultAway,
  picks,
}: {
  fixtureId: string;
  locale: 'he' | 'en';
  homeTeam: Team;
  awayTeam: Team;
  /** Plumbed from page.tsx for symmetry with other variants; unused in §4 layout (replaced by "FT · Actual" label). */
  kickoffAt?: string;
  resultHome: number;
  resultAway: number;
  picks: PlayerPick[];
}) {
  const t = await getTranslations('match');
  const intlLocale = locale === 'he' ? 'he-IL' : 'en-US';
  const collator = new Intl.Collator(intlLocale, { sensitivity: 'base' });
  const sorted = [...picks].sort(
    (a, b) =>
      b.points - a.points || collator.compare(a.display_name, b.display_name),
  );
  return (
    <div
      data-testid={`match-row-${fixtureId}`}
      className="bg-[var(--zc-card)] border border-[var(--zc-border)] rounded-2xl pi-4 pbs-3 pbe-3 mbs-3"
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 min-is-0 flex-1">
          <span className="text-xl shrink-0" aria-hidden>
            {codeToFlag(homeTeam.code)}
          </span>
          <span
            className="text-base font-bold tabular-nums"
            aria-label={locale === 'he' ? homeTeam.name_he : homeTeam.name_en}
          >
            {homeTeam.code}
          </span>
        </div>
        <span
          dir="ltr"
          className="bs-8 inline-flex items-center justify-center pi-3 rounded-full bg-[var(--zc-primary)] text-base font-bold text-[var(--zc-primary-foreground)] tabular-nums shrink-0"
        >
          {resultHome} : {resultAway}
        </span>
        <div className="flex items-center gap-2 min-is-0 flex-1 justify-end">
          <span
            className="text-base font-bold tabular-nums text-end"
            aria-label={locale === 'he' ? awayTeam.name_he : awayTeam.name_en}
          >
            {awayTeam.code}
          </span>
          <span className="text-xl shrink-0" aria-hidden>
            {codeToFlag(awayTeam.code)}
          </span>
        </div>
        <span className="text-sm text-[var(--zc-muted-foreground)]">
          {t('actual')}
        </span>
      </div>
      <div className="mbs-3 -mi-4">
        {sorted.map((p) => (
          <div
            key={p.user_id}
            className="border-t border-[var(--zc-border)] pbs-2 pbe-2 pi-4 flex items-center gap-3 text-base min-bs-8"
          >
            <span className="font-bold flex-1 truncate">{p.display_name}:</span>
            <span
              dir="ltr"
              className="tabular-nums text-[var(--zc-muted-foreground)]"
            >
              {p.home_score !== null && p.away_score !== null
                ? `${p.home_score}-${p.away_score}`
                : '—'}
            </span>
            <PtsBadge points={p.points} kind={p.kind ?? 'miss'} />
          </div>
        ))}
      </div>
    </div>
  );
}

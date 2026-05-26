import { getTranslations } from 'next-intl/server';
import { codeToFlag } from '@/lib/teams/codeToFlag';

/**
 * Locked-row variant per UI-SPEC §3.
 *
 * Server-renderable. Renders when fixture.kickoff_at <= now() AND no result
 * is in (result_home_90min IS NULL). RLS continues to enforce write-lock —
 * this component is purely display.
 *
 * Score capsule shows the user's own pre-kickoff prediction (UPSERTed in
 * predictions); dashes (`- : -`) render if the user did not submit before
 * kickoff. Trailing 🔒 + locked-aria conveys state to assistive tech.
 *
 * All numeric content (score, kickoff time) is wrapped in <span dir="ltr">
 * so HE doesn't visually reverse digits (Pattern G / Pitfall 7).
 */
type Team = { code: string; name_en: string; name_he: string };

export async function MatchRowLocked({
  fixtureId,
  locale,
  homeTeam,
  awayTeam,
  kickoffAt,
  userHome,
  userAway,
}: {
  fixtureId: string;
  locale: 'he' | 'en';
  homeTeam: Team;
  awayTeam: Team;
  kickoffAt: string;
  userHome: number | null;
  userAway: number | null;
}) {
  const t = await getTranslations('match');
  const hasPick = userHome !== null && userAway !== null;
  const intlLocale = locale === 'he' ? 'he-IL' : 'en-US';
  // Mobile-first layout matches the editable variant: team names + time on
  // top row, score capsule + 🔒 centered on second row. Browser-local time
  // without tz-name label (viewers share their device clock).
  const time = new Intl.DateTimeFormat(intlLocale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(kickoffAt));
  return (
    <div
      data-testid={`match-row-${fixtureId}`}
      className="bg-[var(--zc-card)] border border-[var(--zc-border)] rounded-2xl pi-4 pbs-3 pbe-3 mbs-3 flex flex-col gap-3"
    >
      <div className="flex items-center gap-3">
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
          className="text-sm text-[var(--zc-muted-foreground)] tabular-nums shrink-0"
        >
          {time}
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
      </div>
      <div className="flex justify-center items-center gap-3">
        {hasPick ? (
          <span
            dir="ltr"
            className="bs-8 inline-flex items-center justify-center pi-3 rounded-full bg-[var(--zc-muted)] text-base font-bold text-[var(--zc-primary)] tabular-nums"
          >
            {userHome} : {userAway}
          </span>
        ) : (
          <span
            dir="ltr"
            className="bs-8 inline-flex items-center justify-center pi-3 rounded-full bg-transparent border border-[var(--zc-border)] text-base text-[var(--zc-muted-foreground)] tabular-nums"
          >
            - : -
          </span>
        )}
        <span
          className="text-base text-[var(--zc-muted-foreground)]"
          aria-label={t('lockedAria')}
        >
          🔒
        </span>
      </div>
    </div>
  );
}

'use client';

import { MatchRowStepper } from './MatchRowStepper.client';

type Team = { code: string; name_en: string; name_he: string };

/**
 * Editable-row variant per UI-SPEC §2. Renders when fixture.kickoff_at >
 * now() AND no result is in. The MatchRowStepper inside owns the
 * 600ms-debounced save + revert-on-error UX.
 *
 * Client component because the stepper needs interactivity (the row chrome
 * around it could technically be server-rendered, but co-locating it with
 * the stepper keeps the variant boundary clean — Locked + Resulted are the
 * server-renderable variants).
 *
 * Team names use the active-locale field (name_en / name_he). Kickoff time
 * renders LTR even in HE so digits don't visually reverse.
 */
export function MatchRow({
  locale,
  fixtureId,
  homeTeam,
  awayTeam,
  kickoffAt,
  initialHome,
  initialAway,
}: {
  locale: 'he' | 'en';
  fixtureId: string;
  homeTeam: Team;
  awayTeam: Team;
  kickoffAt: string;
  initialHome: number | null;
  initialAway: number | null;
}) {
  const intlLocale = locale === 'he' ? 'he-IL' : 'en-US';
  const time = new Intl.DateTimeFormat(intlLocale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(kickoffAt));
  return (
    <div
      data-testid={`match-row-${fixtureId}`}
      className="bg-[var(--zc-card)] border border-[var(--zc-border)] rounded-2xl pi-4 pbs-3 pbe-3 mbs-3 min-bs-16 flex items-center gap-4"
    >
      <div className="flex items-center gap-2 min-is-0 flex-1">
        <span className="text-xl" aria-hidden>
          🏴
        </span>
        <span className="text-base truncate">
          {locale === 'he' ? homeTeam.name_he : homeTeam.name_en}
        </span>
      </div>
      <MatchRowStepper
        fixtureId={fixtureId}
        initialHome={initialHome}
        initialAway={initialAway}
      />
      <div className="flex items-center gap-2 min-is-0 flex-1 justify-end">
        <span className="text-base truncate text-end">
          {locale === 'he' ? awayTeam.name_he : awayTeam.name_en}
        </span>
        <span className="text-xl" aria-hidden>
          🏴
        </span>
      </div>
      <span
        dir="ltr"
        className="text-sm text-[var(--zc-muted-foreground)] tabular-nums"
      >
        {time}
      </span>
    </div>
  );
}

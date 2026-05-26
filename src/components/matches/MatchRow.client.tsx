'use client';

import { MatchRowStepper } from './MatchRowStepper.client';
import { codeToFlag } from '@/lib/teams/codeToFlag';

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
  // Mobile layout: stepper on its own row to fit 360px viewports (Plan 02-08
  // post-execution review caught the overflow). Time is shown in browser-local
  // tz without a tz-name label since all viewers share their device clock.
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
          <span className="text-base truncate min-is-0">
            {locale === 'he' ? homeTeam.name_he : homeTeam.name_en}
          </span>
        </div>
        <span
          dir="ltr"
          className="text-sm text-[var(--zc-muted-foreground)] tabular-nums shrink-0"
        >
          {time}
        </span>
        <div className="flex items-center gap-2 min-is-0 flex-1 justify-end">
          <span className="text-base truncate text-end min-is-0">
            {locale === 'he' ? awayTeam.name_he : awayTeam.name_en}
          </span>
          <span className="text-xl shrink-0" aria-hidden>
            {codeToFlag(awayTeam.code)}
          </span>
        </div>
      </div>
      <div className="flex justify-center">
        <MatchRowStepper
          fixtureId={fixtureId}
          initialHome={initialHome}
          initialAway={initialAway}
        />
      </div>
    </div>
  );
}

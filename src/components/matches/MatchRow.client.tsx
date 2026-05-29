'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MatchRowStepper } from './MatchRowStepper.client';
import { codeToFlag } from '@/lib/teams/codeToFlag';

type Team = { code: string; name_en: string; name_he: string };

/**
 * Editable-row variant per UI-SPEC §2. Renders when fixture.kickoff_at >
 * now() AND no result is in.
 *
 * Default-collapsed: the team chrome doubles as a toggle button (chevron at
 * the end). When collapsed, the bottom slot shows a read-only score capsule
 * (own pick if present, em-dashes otherwise) so users can see their current
 * prediction without expanding. When expanded, the stepper takes the bottom
 * slot. The stepper is `hidden`-toggled rather than conditionally mounted so
 * mid-edit state (pending debounced save) survives a collapse round-trip.
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
  const tPrediction = useTranslations('prediction');
  const [expanded, setExpanded] = useState(false);
  const hasPick = initialHome !== null && initialAway !== null;
  const intlLocale = locale === 'he' ? 'he-IL' : 'en-US';
  const time = new Intl.DateTimeFormat(intlLocale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(kickoffAt));
  const controlsId = `match-row-controls-${fixtureId}`;
  return (
    <div
      data-testid={`match-row-${fixtureId}`}
      className="bg-[var(--zc-card)] border border-[var(--zc-border)] rounded-2xl pi-4 pbs-3 pbe-3 mbs-3 flex flex-col gap-3"
    >
      <button
        type="button"
        data-testid={`match-row-toggle-${fixtureId}`}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={controlsId}
        aria-label={expanded ? tPrediction('collapseAria') : tPrediction('expandAria')}
        className="flex items-center gap-3 w-full text-start rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--zc-card)]"
      >
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
        <span
          aria-hidden
          className={`shrink-0 text-[var(--zc-muted-foreground)] transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
        >
          ▾
        </span>
      </button>
      <div id={controlsId} className="flex justify-center">
        <div hidden={expanded}>
          {hasPick ? (
            <span
              dir="ltr"
              data-testid={`match-row-capsule-${fixtureId}`}
              className="bs-8 inline-flex items-center justify-center pi-3 rounded-full bg-[var(--zc-muted)] text-base font-bold text-[var(--zc-primary)] tabular-nums"
            >
              {initialHome} : {initialAway}
            </span>
          ) : (
            <span
              dir="ltr"
              data-testid={`match-row-capsule-${fixtureId}`}
              className="bs-8 inline-flex items-center justify-center pi-3 rounded-full bg-transparent border border-dashed border-[var(--zc-border)] text-base text-[var(--zc-muted-foreground)] tabular-nums"
            >
              — : —
            </span>
          )}
        </div>
        <div hidden={!expanded}>
          <MatchRowStepper
            fixtureId={fixtureId}
            initialHome={initialHome}
            initialAway={initialAway}
          />
        </div>
      </div>
    </div>
  );
}

'use client';

import { useId, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Default-collapsed disclosure for the family-picks list under a resulted
 * match card. Picks are server-rendered (sorted + with PtsBadge) and passed
 * in as `children`; this client wrapper only owns the open/closed UI state.
 *
 * Why this exists: 15 players × 64 finished matches = ~960 inline rows on
 * /matches by tournament end. Wall-of-text problem (#3). Default-collapsed
 * keeps the page scannable; one tap reveals the table for any given match.
 *
 * `count` is shown in the closed-state label ("Show all 15 picks ▾") so the
 * affordance is honest about how much content is hidden.
 */
export function ResultedPicksDisclosure({
  count,
  children,
}: {
  count: number;
  children: ReactNode;
}) {
  const t = useTranslations('match');
  const [open, setOpen] = useState(false);
  const sectionId = `resulted-picks-${useId()}`;
  // useId() above gives a stable SSR/client-matching id — required since
  // this component SSRs alongside the parent server component.
  return (
    <div className="mbs-3 -mi-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={sectionId}
        data-testid="resulted-picks-toggle"
        className="flex items-center justify-between gap-2 w-full pi-4 pbs-2 pbe-2 border-t border-[var(--zc-border)] text-sm font-bold text-[var(--zc-primary)] hover:bg-[var(--zc-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--zc-card)]"
      >
        <span>{open ? t('hidePicks') : t('showPicks', { count })}</span>
        <span
          aria-hidden
          className={`text-[var(--zc-muted-foreground)] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        >
          ▾
        </span>
      </button>
      <div id={sectionId} hidden={!open}>
        {children}
      </div>
    </div>
  );
}


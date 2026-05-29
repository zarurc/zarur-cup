'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { codeToFlag } from '@/lib/teams/codeToFlag';

/**
 * Default-collapsed pre-kickoff entry row (W2-M1).
 *
 * Entry mode used to show inputs on every fixture including matches
 * that haven't kicked off yet — clutter, since admin won't score those
 * for hours/days. Now those rows collapse to a thin teams + time stub
 * with an "Add result" button; the AdminResultInputs are passed as
 * children and rendered only when expanded.
 *
 * Server-rendered match chrome stays on the parent page; this client
 * wrapper owns only the open/closed state.
 */
type Team = { code: string; name_en: string };

export function AdminPreKickoffEntryRow({
  homeTeam,
  awayTeam,
  kickoffAt,
  children,
}: {
  homeTeam: Team;
  awayTeam: Team;
  kickoffAt: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const time = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(kickoffAt));

  return (
    <div className="bg-[var(--zc-card)] border border-[var(--zc-border)] rounded-2xl pi-4 pbs-3 pbe-3 mbs-3 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 min-is-0 flex-1">
          <span className="text-xl" aria-hidden>
            {codeToFlag(homeTeam.code)}
          </span>
          <span className="text-base truncate">{homeTeam.name_en}</span>
        </div>
        <span
          dir="ltr"
          className="text-sm text-[var(--zc-muted-foreground)] tabular-nums shrink-0"
        >
          {time}
        </span>
        <div className="flex items-center gap-2 min-is-0 flex-1 justify-end">
          <span className="text-base truncate text-end">{awayTeam.name_en}</span>
          <span className="text-xl" aria-hidden>
            {codeToFlag(awayTeam.code)}
          </span>
        </div>
      </div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="bs-10 pi-3 self-center inline-flex items-center gap-1 text-sm font-bold text-[var(--zc-primary)] border border-[var(--zc-border)] rounded-xl hover:bg-[var(--zc-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)]"
        >
          Add result
          <span aria-hidden>▾</span>
        </button>
      ) : (
        <div className="flex justify-center">{children}</div>
      )}
    </div>
  );
}

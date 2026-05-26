'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Sticky countdown banner per UI-SPEC §6.
 *
 * Receives the upcoming-fixture list from the RSC sorted ASC. Ticks every
 * 1s via setInterval. When the active fixture's kickoff_at <= now(), the
 * banner snaps (no animation) to the next index. When the list exhausts
 * (post-tournament), the component returns null — the page wrapper detects
 * this implicitly via `upcoming.length === 0` and shrinks its top padding
 * from mbs-10 to mbs-0.
 *
 * Escalation cue: when remaining <= 60s, the seconds digits color shifts
 * from --zc-primary to --zc-accent. No blinking — pure color change.
 *
 * All numeric content is LTR-wrapped so HE doesn't visually reverse the
 * countdown digits (Pattern G / Pitfall 7).
 */
export type UpcomingFixture = {
  kickoff_at: string;
  home_name: string;
  away_name: string;
};

const ESCALATION_THRESHOLD_MS = 60_000;

function formatRemaining(rawMs: number): string {
  const ms = rawMs < 0 ? 0 : rawMs;
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function CountdownBanner({ upcoming }: { upcoming: UpcomingFixture[] }) {
  const t = useTranslations('countdown');
  const [idx, setIdx] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  // Roll the cursor forward past any fixtures whose kickoff already passed
  // (covers initial render with stale data + the per-tick rollover case).
  // We compute the rolled cursor as a derived value and effect-update idx
  // — using setState during render is unsafe in React 19 concurrent mode.
  let cursor = idx;
  while (
    cursor < upcoming.length &&
    new Date(upcoming[cursor].kickoff_at).getTime() <= now
  ) {
    cursor++;
  }

  // Sync idx to derived cursor when they diverge. The effect runs only on
  // changes — it WILL NOT loop because once cursor === idx the condition is
  // false (Pitfall 3 — render-time setState would be a render loop).
  useEffect(() => {
    if (cursor !== idx) setIdx(cursor);
  }, [cursor, idx]);

  const current = upcoming[cursor];
  if (!current) return null; // tournament ended OR no upcoming

  const remaining = new Date(current.kickoff_at).getTime() - now;
  const isEscalation = remaining <= ESCALATION_THRESHOLD_MS;

  return (
    <div className="fixed inset-bs-14 inset-i-0 z-30 bs-10 bg-[var(--zc-card)] border-b border-[var(--zc-border)] pi-4 flex items-center justify-between gap-3">
      <span className="text-sm font-bold text-[var(--zc-primary)] truncate min-is-0">
        {t('next')} {current.home_name} vs {current.away_name}
      </span>
      <span
        dir="ltr"
        className={`text-base font-bold tabular-nums shrink-0 ${isEscalation ? 'text-[var(--zc-accent)]' : 'text-[var(--zc-primary)]'}`}
      >
        {t('kicksOffIn')} {formatRemaining(remaining)}
      </span>
    </div>
  );
}

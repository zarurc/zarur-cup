'use client';

import { useTranslations } from 'next-intl';

/**
 * Row data shape for the leaderboard (UI-SPEC §8).
 *
 * bracket_total is intentionally omitted: Phase 2 always renders the D-28
 * placeholder copy ("Bracket: 0 — opens June 27") regardless of the underlying
 * value, which is always 0 in Phase 2 anyway (Phase 1 / Plan 02-01 COALESCE
 * keeps it zero pre-Phase-3). The placeholder is replaced by the live number
 * once Phase 3 ships.
 */
export type LeaderboardRowData = {
  user_id: string;
  display_name: string;
  total: number;
  league_total: number;
  props_total: number;
};

type Props = {
  rank: number;
  row: LeaderboardRowData;
  isExpanded: boolean;
  onToggle: () => void;
};

/**
 * Single leaderboard row with inline-expand subtotal block (D-27 + UI-SPEC §8).
 *
 *   - Collapsed: [rank] [display_name] [total] [chevron]
 *   - Expanded:  same header + a sub-block of League/Bracket/Props subtotals
 *
 * Numbers (rank, total, league subtotal, props subtotal) are wrapped in
 * <span dir="ltr"> so they render LTR even on /he/ pages (UI-SPEC RTL Stress
 * Points + Phase 1 D-04). The bracket placeholder is a single localized
 * string so it follows the page direction naturally.
 *
 * The expand/collapse animation uses the grid-template-rows: 1fr → 0fr trick
 * (UI-SPEC §8) — a pure CSS height-to-auto transition with no JS measurement.
 * Chevron rotates 180° via Tailwind's `rotate-180` utility with a 150ms
 * transition.
 *
 * The single-expand rule (D-27 / UI-SPEC §8) is implemented at the parent
 * (LeaderboardList): this row is purely controlled.
 */
export function LeaderboardRow({ rank, row, isExpanded, onToggle }: Props) {
  const t = useTranslations('leaderboard');
  return (
    <li
      className={`bg-[var(--zc-card)] border-b border-[var(--zc-border)] ${rank === 1 ? 'border-t border-[var(--zc-border)]' : ''}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? t('expandAriaClose') : t('expandAriaOpen')}
        className="is-full pi-4 pbs-4 pbe-4 min-bs-14 flex items-center gap-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--zc-card)]"
      >
        <span
          dir="ltr"
          className="text-base font-bold text-[var(--zc-muted-foreground)] tabular-nums is-6 text-center"
        >
          {rank}
        </span>
        <span className="text-base font-normal text-[var(--zc-primary)] flex-1 truncate text-start">
          {row.display_name}
        </span>
        <span
          dir="ltr"
          className="text-2xl font-bold text-[var(--zc-primary)] tabular-nums"
        >
          {row.total}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          className={`text-[var(--zc-muted-foreground)] transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`}
        >
          <path
            d="M4 6l4 4 4-4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div
        className={`grid transition-all duration-200 overflow-hidden ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
        aria-hidden={!isExpanded}
      >
        <div className="min-bs-0">
          <div className="bg-[var(--zc-muted)] pi-4 pbs-3 pbe-3 text-sm font-normal text-[var(--zc-primary)] flex flex-wrap items-center gap-4 tabular-nums">
            <span dir="ltr">{t('league', { n: row.league_total })}</span>
            <span aria-hidden className="text-[var(--zc-muted-foreground)]">
              ·
            </span>
            <span>{t('bracketPlaceholder')}</span>
            <span aria-hidden className="text-[var(--zc-muted-foreground)]">
              ·
            </span>
            <span dir="ltr">{t('props', { n: row.props_total })}</span>
          </div>
        </div>
      </div>
    </li>
  );
}

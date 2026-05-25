'use client';

import { useState } from 'react';
import {
  LeaderboardRow,
  type LeaderboardRowData,
} from './LeaderboardRow.client';

/**
 * Parent component that owns the single-expand state (D-27 / UI-SPEC §8).
 *
 * activeUserId tracks which row (if any) is currently expanded. Tapping the
 * expanded row collapses it; tapping any other row collapses the current and
 * expands the new one — only one row open at a time, ever. No animation
 * fights, no two-row open state.
 *
 * Rank is computed from array index (0-based → 1-based) AFTER the upstream
 * RSC sort (Intl.Collator + LB-04 tiebreaker chain). This component does NOT
 * sort — it trusts the order it's given.
 */
export function LeaderboardList({ rows }: { rows: LeaderboardRowData[] }) {
  const [activeUserId, setActiveUserId] = useState<string | null>(null);

  return (
    <ul className="mbs-4">
      {rows.map((row, idx) => (
        <LeaderboardRow
          key={row.user_id}
          rank={idx + 1}
          row={row}
          isExpanded={activeUserId === row.user_id}
          onToggle={() =>
            setActiveUserId((cur) => (cur === row.user_id ? null : row.user_id))
          }
        />
      ))}
    </ul>
  );
}

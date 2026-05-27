type TeamRef = {
  id: string;
  code: string;
  name_en: string;
  name_he: string;
} | null;

type FixtureRef = {
  external_match_no: number;
  kickoff_at: string;
  result_home_90min: number | null;
  result_away_90min: number | null;
  home_placeholder: string | null;
  away_placeholder: string | null;
  home_team: TeamRef;
  away_team: TeamRef;
} | null;

export type BracketSlotForView = {
  slot_code: string;
  stage: string;
  resolved_team: TeamRef;
  fixture: FixtureRef;
};

type SlotRowLabels = {
  winnerLabel: string;        // "Winner" / "מנצח"
  championTbdLabel: string;   // "TBD" / "טרם נקבע"
  tieAtNinetyLabel: string;   // "Tied at 90' (ET pending)" / "תיקו ב-90' (הארכה ממתינה)"
  placeholderPrefix: (raw: string) => string;  // map "WINNER_GROUP_A" → localized label
};

/**
 * One row in the bracket tree (column-of-rounds layout, D-47).
 *
 * Server component — zero client JS. Renders:
 *   - CHAMPION slot: 🏆 + resolved team name (or TBD)
 *   - Other slots: slot_code label + localized kickoff + both team names (or
 *     placeholder labels) + 90-min score (or em-dash) + winner highlight
 *
 * Tied-at-90 KO matches show "Tied at 90' (ET pending)" per D-12 (ET UI
 * is Phase 3; Phase 2 leaves the winner unresolved for these matches).
 *
 * Token use: `[var(--zc-X)]` everywhere, logical-property utilities only.
 */
export function SlotRow({
  slot,
  locale,
  labels,
}: {
  slot: BracketSlotForView;
  locale: 'he' | 'en';
  labels: SlotRowLabels;
}) {
  const nameKey = locale === 'he' ? 'name_he' : 'name_en';

  if (slot.stage === 'champion') {
    const champName = slot.resolved_team
      ? slot.resolved_team[nameKey]
      : labels.championTbdLabel;
    return (
      <li className="bs-14 pi-3 pbs-3 pbe-3 rounded-2xl bg-[var(--zc-card)] border border-[var(--zc-border)] flex items-center gap-2">
        <span aria-hidden>🏆</span>
        <span className="text-base font-bold text-[var(--zc-primary)]">
          {champName}
        </span>
      </li>
    );
  }

  const fx = slot.fixture;
  const home = fx?.home_team
    ? fx.home_team[nameKey]
    : labels.placeholderPrefix(fx?.home_placeholder ?? '');
  const away = fx?.away_team
    ? fx.away_team[nameKey]
    : labels.placeholderPrefix(fx?.away_placeholder ?? '');

  const h = fx?.result_home_90min;
  const a = fx?.result_away_90min;
  const decided = h !== null && h !== undefined && a !== null && a !== undefined;

  let winnerLine: string | null = null;
  if (decided) {
    if (h > a) winnerLine = home;
    else if (a > h) winnerLine = away;
    else winnerLine = null; // tie at 90; ET pending
  }

  const kickoffLocal = fx?.kickoff_at
    ? new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(fx.kickoff_at))
    : '—';

  return (
    <li className="pi-3 pbs-2 pbe-2 rounded-2xl bg-[var(--zc-card)] border border-[var(--zc-border)] mbs-2">
      <div className="flex items-center justify-between is-full">
        <span className="text-xs text-[var(--zc-muted-foreground)]">
          {slot.slot_code}
        </span>
        <span dir="ltr" className="text-xs text-[var(--zc-muted-foreground)]">
          {kickoffLocal}
        </span>
      </div>
      <div className="flex items-center justify-between is-full pbs-1 pbe-1 gap-2">
        <span className="text-sm font-bold text-[var(--zc-primary)] truncate">
          {home}
        </span>
        <span
          dir="ltr"
          className="text-sm font-mono tabular-nums text-[var(--zc-primary)]"
        >
          {decided ? `${h} – ${a}` : '—'}
        </span>
        <span className="text-sm font-bold text-[var(--zc-primary)] truncate">
          {away}
        </span>
      </div>
      {decided && (
        <div className="text-xs text-[var(--zc-muted-foreground)] pbs-1">
          {winnerLine
            ? `▸ ${labels.winnerLabel}: `
            : labels.tieAtNinetyLabel}
          {winnerLine && (
            <strong className="text-[var(--zc-primary)]">{winnerLine}</strong>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * D-01: group fixtures by viewer-local date string (e.g., "Saturday · June 14").
 * Returns array of [label, fixtures[]] tuples preserving insertion order —
 * fixtures must arrive pre-sorted ORDER BY kickoff_at ASC.
 *
 * Generic over the row shape (only `kickoff_at` is required) so callers can
 * pass either the raw Database fixtures Row or a normalized variant with
 * additional embedded FK fields.
 *
 * Uses `Intl.DateTimeFormat` per CLAUDE.md (no date library). The localized
 * separator (", " in en-US, ", " in he-IL after weekday) is replaced with
 * " · " per CONTEXT.md D-01 copy contract.
 */
export function groupByLocalDate<F extends { kickoff_at: string }>(
  fixtures: F[],
  locale: 'he' | 'en',
  tz?: string,
): Array<[string, F[]]> {
  const intlLocale = locale === 'he' ? 'he-IL' : 'en-US';
  const fmt = new Intl.DateTimeFormat(intlLocale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: tz, // undefined => browser/server local TZ
  });
  const groups = new Map<string, F[]>();
  for (const f of fixtures) {
    const raw = fmt.format(new Date(f.kickoff_at));
    // D-01 copy: replace ", " with " · " (Assumptions Log A4 — verify HE behavior in QA-03)
    const key = raw.replace(', ', ' · ');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }
  return Array.from(groups.entries());
}

'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

/**
 * Filter chips for /admin/matches (W2-M2).
 *
 * URL-driven (?filter=all|past|unscored). Default = 'all'. Mirrors the
 * AdminModeToggle Link-based pattern so chip clicks update the URL
 * without a server round-trip beyond Next's RSC navigation; the page
 * reads searchParams.filter directly to scope the rendered list.
 *
 * Three options chosen for operational value during the tournament:
 *   - all       — full schedule, default
 *   - past      — only fixtures whose kickoff has elapsed
 *   - unscored  — past AND result_home_90min still NULL (admin's
 *                 grading-todo list during a busy result-entry session)
 */
type Filter = 'all' | 'past' | 'unscored';
const OPTIONS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'past', label: 'Past' },
  { value: 'unscored', label: 'Unscored' },
];

export function AdminMatchesFilter() {
  const sp = useSearchParams();
  const current: Filter =
    sp?.get('filter') === 'past'
      ? 'past'
      : sp?.get('filter') === 'unscored'
        ? 'unscored'
        : 'all';

  const buildHref = (next: Filter) => {
    const query: Record<string, string> = {};
    sp?.forEach((value, key) => {
      if (key !== 'filter') query[key] = value;
    });
    if (next !== 'all') query.filter = next;
    return { pathname: '/admin/matches' as const, query };
  };

  return (
    <div
      role="group"
      aria-label="Filter matches"
      className="inline-flex gap-2 flex-wrap"
    >
      {OPTIONS.map((opt) => {
        const isActive = current === opt.value;
        return (
          <Link
            key={opt.value}
            href={buildHref(opt.value)}
            replace
            scroll={false}
            aria-pressed={isActive}
            className={`bs-10 pi-3 inline-flex items-center text-sm font-bold rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)] ${
              isActive
                ? 'bg-[var(--zc-primary)] text-[var(--zc-primary-foreground)] border-[var(--zc-primary)]'
                : 'bg-transparent text-[var(--zc-muted-foreground)] border-[var(--zc-border)] hover:text-[var(--zc-primary)]'
            }`}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}

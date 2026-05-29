import Link from 'next/link';
import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { adminReadClient } from '@/lib/auth/adminReadClient';

/**
 * Admin home — English-only (D-05). W2-H1 reshapes the previous flat
 * 4-link nav into a 2x2 dashboard grid where each card shows a live
 * triage count: unscored matches, unresolved placeholders, ungraded
 * props, total roster.
 *
 * Counts come from the same service-role client the rest of the admin
 * surface uses; the queries are cheap (head:true exact count on small
 * tables) so doing all four per pageload is fine for family scale.
 *
 * Card visual rule: the count is shown large + tabular-nums so the
 * number is the dominant signal. When the count is zero AND there's
 * nothing left to do for that surface, the card de-emphasizes (muted
 * count color) so the eye is drawn to whatever still needs work.
 *
 * NO requireAdmin() call here — parent layout enforces (D-06).
 */
export default async function AdminHome() {
  const t = await getTranslations('admin.home');
  const svc = await adminReadClient();
  const nowIso = new Date().toISOString();

  // Unscored matches: kickoff in the past AND result_home_90min still NULL.
  const unscoredP = svc
    .from('fixtures')
    .select('*', { count: 'exact', head: true })
    .lte('kickoff_at', nowIso)
    .is('result_home_90min', null);

  // Ungraded props: correct_answer IS NULL.
  const ungradedP = svc
    .from('prop_questions')
    .select('*', { count: 'exact', head: true })
    .is('correct_answer', null);

  // Roster total. Used as raw count — admin sees the headline number of
  // family members on board.
  const rosterP = svc
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  // Unresolved placeholders — needs the row data because uniqueness is
  // computed in JS (head:true would over-count fixtures, not placeholders).
  const placeholdersP = svc
    .from('fixtures')
    .select('home_placeholder, away_placeholder');

  const [unscored, ungraded, roster, placeholders] = await Promise.all([
    unscoredP,
    ungradedP,
    rosterP,
    placeholdersP,
  ]);

  const placeholderSet = new Set<string>();
  for (const f of placeholders.data ?? []) {
    if (f.home_placeholder) placeholderSet.add(f.home_placeholder);
    if (f.away_placeholder) placeholderSet.add(f.away_placeholder);
  }

  const cards = [
    {
      href: '/admin/matches' as Route,
      label: t('navMatches'),
      count: unscored.count ?? 0,
      sub: 'unscored',
    },
    {
      href: '/admin/tournament-tree' as Route,
      label: t('navTree'),
      count: placeholderSet.size,
      sub: 'unresolved',
    },
    {
      href: '/admin/props' as Route,
      label: t('navProps'),
      count: ungraded.count ?? 0,
      sub: 'ungraded',
    },
    {
      href: '/admin/roster' as Route,
      label: t('navRoster'),
      count: roster.count ?? 0,
      sub: 'members',
    },
  ];

  return (
    <main className="pi-4 pbs-4 pbe-24">
      <h1 className="text-xl font-bold mbs-2 mbe-4">{t('heading')}</h1>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => {
          // Count is "actionable" when it represents work-to-do; roster
          // size is a passive metric so it always renders in primary tone.
          const isActionable = c.sub !== 'members';
          const idle = isActionable && c.count === 0;
          const countCls = idle
            ? 'text-[var(--zc-muted-foreground)]'
            : 'text-[var(--zc-primary)]';
          return (
            <Link
              key={c.href}
              href={c.href}
              className="block bg-[var(--zc-card)] border border-[var(--zc-border)] rounded-2xl pi-4 pbs-4 pbe-4 hover:bg-[var(--zc-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)]"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  dir="ltr"
                  className={`text-3xl font-bold tabular-nums ${countCls}`}
                >
                  {c.count}
                </span>
                <span className="text-xs text-[var(--zc-muted-foreground)] uppercase tracking-wide">
                  {c.sub}
                </span>
              </div>
              <p className="text-sm font-bold text-[var(--zc-primary)] mbs-2">
                {c.label}
              </p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}

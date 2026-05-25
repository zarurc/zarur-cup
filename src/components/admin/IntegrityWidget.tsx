import { adminReadClient } from '@/lib/auth/adminReadClient';
import { getTranslations } from 'next-intl/server';

/**
 * Always-visible admin integrity strip (ADM-06 + LGE-06 + D-15).
 *
 * Mounted by /admin/(protected)/layout.tsx after `{children}` so the
 * widget renders on every admin page load. Server component — no
 * polling, no client JS, no cron. The query runs at SSR time on every
 * pageload; for our 15-user pool the row counts are tiny.
 *
 * Three inline metrics:
 *
 *   1. Database Sync (LGE-06): the headline integrity check. RLS prohibits
 *      a player from INSERTing a prediction with submitted_at > kickoff_at
 *      (Phase 1 0002_rls.sql lock policies). This widget audits the DB
 *      directly via service-role — if ANY row exists where the
 *      prediction's submitted_at is after the fixture's kickoff_at, the
 *      lock was breached somehow. Default state is "OK ✓" (green); breach
 *      state is "✗ (N rows past kickoff)" (destructive red) with an
 *      expand-on-click <details> drilldown.
 *
 *   2. Total Predictions: gross health metric.
 *
 *   3. Unscored Completed Matches: fixtures whose kickoff_at is in the
 *      past but result_home_90min is still NULL. Tells admin which
 *      results still need to be entered.
 *
 * Implementation note for the LGE-06 query: PostgREST cannot compare two
 * columns from joined tables directly in a single filter expression.
 * Workaround: pull every prediction with its embedded fixture's
 * kickoff_at, then filter in JS. For Phase 2 scale (~1.6k predictions
 * max for 15 users × 104 fixtures) this is trivial — well under any
 * reasonable bandwidth budget. The plan's <threat_model> T-02-06-09
 * explicitly accepts this for Phase 2; if row count exceeds 5k we'd
 * migrate to a server-side `count_lock_breaches()` SQL function.
 *
 * Pitfall 10 (T-02-05-03): adminReadClient is service-role so we see ALL
 * rows. Using createClient() (anon JWT) would hit RLS and see only the
 * admin's own rows — which would silently always report zero breaches.
 *
 * RTL hygiene: the widget is unlocalized (admin is EN-only per D-05) but
 * we still wrap numbers in `dir="ltr"` so the digits render LTR if the
 * admin's profile.locale is 'he' and they somehow opened the admin tree
 * in an RTL-rendering browser context.
 */
export async function IntegrityWidget() {
  const t = await getTranslations('admin.integrity');
  const svc = await adminReadClient();

  // Total predictions: head-only count for efficiency.
  const totalP = await svc
    .from('predictions')
    .select('*', { count: 'exact', head: true });

  // Unscored matches: kickoff in the past, result still null.
  const unscoredP = await svc
    .from('fixtures')
    .select('*', { count: 'exact', head: true })
    .lte('kickoff_at', new Date().toISOString())
    .is('result_home_90min', null);

  // Lock breach audit: pull every prediction with the fixture's kickoff,
  // compare in JS. See comment block at top for the workaround rationale.
  const { data: rawBreaches } = await svc
    .from('predictions')
    .select('user_id, fixture_id, submitted_at, fixtures(kickoff_at)');
  type BreachRow = {
    user_id: string;
    fixture_id: string;
    submitted_at: string;
    fixtures:
      | { kickoff_at: string }
      | Array<{ kickoff_at: string }>
      | null;
  };
  const breaches = ((rawBreaches as BreachRow[] | null) ?? []).filter((p) => {
    // PostgREST single-FK embed widening normalization (Plan 02-03
    // Pattern 32) — fixtures may serialize as object or 1-element array.
    const fx = Array.isArray(p.fixtures) ? p.fixtures[0] : p.fixtures;
    const k = fx?.kickoff_at;
    return (
      typeof k === 'string' &&
      new Date(p.submitted_at).getTime() > new Date(k).getTime()
    );
  });
  const breachCount = breaches.length;

  return (
    <aside
      className="fixed inset-be-0 inset-i-0 z-30 bs-10 bg-[var(--zc-primary)] text-[var(--zc-primary-foreground)] pi-4 flex items-center justify-between gap-4 text-sm tabular-nums"
      aria-label="Integrity"
    >
      <span>
        <span className="font-bold">{t('syncLabel')}: </span>
        {breachCount === 0 ? (
          <span className="text-[var(--zc-integrity-ok)] font-bold">
            {t('syncOk')}
          </span>
        ) : (
          <details className="inline">
            <summary className="text-[var(--zc-destructive)] font-bold underline cursor-pointer">
              {t('syncFail', { n: breachCount })}
            </summary>
            <ul className="absolute inset-be-10 inset-i-4 bg-[var(--zc-card)] text-[var(--zc-primary)] p-3 rounded-xl shadow-lg max-bs-80 overflow-y-auto z-31">
              {breaches.map((b) => (
                <li
                  key={`${b.user_id}-${b.fixture_id}`}
                  className="text-xs tabular-nums"
                >
                  user={b.user_id} fixture={b.fixture_id} submitted=
                  {b.submitted_at}
                </li>
              ))}
            </ul>
          </details>
        )}
      </span>
      <span>
        <span className="font-bold">{t('totalPreds')}: </span>
        <span dir="ltr">{totalP.count ?? 0}</span>
      </span>
      <span>
        <span className="font-bold">{t('unscored')}: </span>
        <span dir="ltr">{unscoredP.count ?? 0}</span>
      </span>
    </aside>
  );
}

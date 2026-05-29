import { adminReadClient } from '@/lib/auth/adminReadClient';
import { getTranslations } from 'next-intl/server';

/**
 * Admin integrity chip + drilldown popover (W2-C4 redesign of LGE-06 +
 * ADM-06 + D-15). Replaces the previous fixed-bottom black-bar layout.
 *
 * Visual model:
 *   - Chip in the header header that color-codes overall health:
 *       green dot (●)  → no lock breaches detected
 *       red dot + N    → N predictions submitted after kickoff (a real
 *                        alarm — RLS should have prevented these)
 *   - Native <details> toggles a popover panel showing all three
 *     metrics + breach detail with HUMAN-READABLE labels (display_name
 *     instead of user UUID, "HOME vs AWAY" instead of fixture UUID).
 *
 * Why details + zero-JS popover: status indicators don't need
 * interactive complexity, and <details> is accessible by default
 * (toggles on Enter/Space, focus-trappable). Click-outside-to-close is
 * the only missing affordance vs. a true modal — acceptable tradeoff.
 *
 * Implementation notes:
 *   - Same LGE-06 lock-breach audit query as before (predictions JOIN
 *     fixtures, compare submitted_at vs kickoff_at in JS — see Plan
 *     02-06 <threat_model> T-02-06-09 for the rationale).
 *   - service-role client (adminReadClient) so the query sees ALL rows
 *     (Pitfall 10).
 *   - Profile + team-embed resolution runs only when there ARE breaches
 *     — happy path costs nothing extra.
 */
type BreachRowRaw = {
  user_id: string;
  fixture_id: string;
  submitted_at: string;
  fixtures:
    | {
        kickoff_at: string;
        home_team: { code: string } | { code: string }[] | null;
        away_team: { code: string } | { code: string }[] | null;
      }
    | Array<{
        kickoff_at: string;
        home_team: { code: string } | { code: string }[] | null;
        away_team: { code: string } | { code: string }[] | null;
      }>
    | null;
};

export async function IntegrityWidget() {
  const t = await getTranslations('admin.integrity');
  const svc = await adminReadClient();

  // Head-only counts for the cheap metrics.
  const totalP = svc
    .from('predictions')
    .select('*', { count: 'exact', head: true });
  const unscoredP = svc
    .from('fixtures')
    .select('*', { count: 'exact', head: true })
    .lte('kickoff_at', new Date().toISOString())
    .is('result_home_90min', null);

  // Breach audit. We need home/away team codes embedded so we can
  // render "BRA vs ARG" instead of fixture UUID. Profiles fetch one
  // round-trip later, only if breaches exist.
  const breachesP = svc
    .from('predictions')
    .select(
      `
      user_id, fixture_id, submitted_at,
      fixtures(
        kickoff_at,
        home_team:teams!fixtures_home_team_id_fkey(code),
        away_team:teams!fixtures_away_team_id_fkey(code)
      )
    `,
    );

  const [totalRes, unscoredRes, breachesRes] = await Promise.all([
    totalP,
    unscoredP,
    breachesP,
  ]);

  const rawRows = (breachesRes.data as BreachRowRaw[] | null) ?? [];
  type ResolvedBreach = {
    user_id: string;
    fixture_id: string;
    submitted_at: string;
    home_code: string;
    away_code: string;
  };
  const breaches: ResolvedBreach[] = rawRows
    .map((p) => {
      const fx = Array.isArray(p.fixtures) ? p.fixtures[0] : p.fixtures;
      if (!fx) return null;
      const k = fx.kickoff_at;
      if (
        typeof k !== 'string' ||
        new Date(p.submitted_at).getTime() <= new Date(k).getTime()
      ) {
        return null;
      }
      const home = Array.isArray(fx.home_team) ? fx.home_team[0] : fx.home_team;
      const away = Array.isArray(fx.away_team) ? fx.away_team[0] : fx.away_team;
      return {
        user_id: p.user_id,
        fixture_id: p.fixture_id,
        submitted_at: p.submitted_at,
        home_code: home?.code ?? '?',
        away_code: away?.code ?? '?',
      };
    })
    .filter((r): r is ResolvedBreach => r !== null);

  // Resolve user_id → display_name only when there's something to show.
  const nameByUser = new Map<string, string>();
  if (breaches.length > 0) {
    const ids = Array.from(new Set(breaches.map((b) => b.user_id)));
    const { data: profs } = await svc
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', ids);
    for (const p of profs ?? []) nameByUser.set(p.user_id, p.display_name);
  }

  const breachCount = breaches.length;
  const ok = breachCount === 0;

  const chipCls = ok
    ? 'bg-[var(--zc-integrity-ok)] text-white'
    : 'bg-[var(--zc-destructive)] text-white';

  return (
    <details className="relative">
      <summary
        aria-label={t('chipLabel', { n: breachCount })}
        className={`list-none inline-flex items-center gap-1 pi-3 pbs-1 pbe-1 rounded-full text-xs font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)] ${chipCls}`}
      >
        <span aria-hidden>{ok ? '●' : '⚠'}</span>
        <span>{ok ? t('chipOk') : t('chipFail', { n: breachCount })}</span>
      </summary>
      <div
        role="dialog"
        aria-label={t('panelLabel')}
        className="absolute inset-be-auto inset-bs-12 inset-ie-0 z-40 bs-auto is-72 max-bs-96 overflow-y-auto bg-[var(--zc-card)] border border-[var(--zc-border)] rounded-2xl shadow-lg pi-4 pbs-3 pbe-3 text-sm text-[var(--zc-primary)]"
      >
        <p className="flex justify-between gap-2">
          <span className="font-bold">{t('syncLabel')}</span>
          <span
            className={ok ? 'text-[var(--zc-integrity-ok)]' : 'text-[var(--zc-destructive)]'}
          >
            {ok ? t('syncOk') : t('syncFail', { n: breachCount })}
          </span>
        </p>
        <p className="flex justify-between gap-2 mbs-1">
          <span className="font-bold">{t('totalPreds')}</span>
          <span dir="ltr" className="tabular-nums">
            {totalRes.count ?? 0}
          </span>
        </p>
        <p className="flex justify-between gap-2 mbs-1">
          <span className="font-bold">{t('unscored')}</span>
          <span dir="ltr" className="tabular-nums">
            {unscoredRes.count ?? 0}
          </span>
        </p>
        {breaches.length > 0 && (
          <ul className="mbs-3 pbs-3 border-t border-[var(--zc-border)]">
            {breaches.map((b) => (
              <li
                key={`${b.user_id}-${b.fixture_id}`}
                className="text-xs mbs-1"
              >
                <span className="font-bold">
                  {nameByUser.get(b.user_id) ?? b.user_id.slice(0, 8)}
                </span>
                {' · '}
                <span dir="ltr">
                  {b.home_code} vs {b.away_code}
                </span>
                {' · '}
                <span className="text-[var(--zc-muted-foreground)]">
                  {new Date(b.submitted_at).toISOString().slice(11, 19)}Z
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

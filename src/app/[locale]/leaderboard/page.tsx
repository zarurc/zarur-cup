import { setRequestLocale, getTranslations } from 'next-intl/server';
import { requireMember } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { EmptyStateCard } from '@/components/layout/EmptyStateCard';
import { LeaderboardList } from '@/components/leaderboard/LeaderboardList.client';
import type { LeaderboardRowData } from '@/components/leaderboard/LeaderboardRow.client';

type Props = { params: Promise<{ locale: string }> };

/**
 * /[locale]/leaderboard — unified leaderboard (LB-01 + LB-02 + LB-04 + SCR-07).
 *
 *  - Reads v_leaderboard directly (Plan 02-01). The view LEFT JOINs profiles
 *    onto score_events so every profile appears with COALESCEd zeros until they
 *    earn points; we trust that.
 *  - Applies the LB-04 tiebreaker chain in TypeScript via Intl.Collator
 *    (RESEARCH Pattern 7 / Pitfall 5) — avoids the Supabase ICU collation
 *    availability question entirely.
 *  - Refresh happens via revalidatePath fan-out from sweepAndUpsert
 *    (saveResult, gradeProp) — wired in Plan 02-02. LB-03 already closed.
 *
 *  Auth: requireMember(safeLocale) — leaderboard is a player surface for all
 *  signed-in members (NOT requireAdmin). v_leaderboard has SELECT for
 *  authenticated via Plan 02-01 grants; service_role grant (Plan 02-01
 *  migration 0011) is for admin reads, not used here.
 */
export default async function LeaderboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const safeLocale = locale === 'he' ? 'he' : 'en';
  await requireMember(safeLocale);
  const t = await getTranslations('leaderboard');
  const tBuyin = await getTranslations('buyin');

  const supabase = await createClient();
  const { data } = await supabase
    .from('v_leaderboard')
    .select(
      'user_id, display_name, total, league_total, props_total, bracket_total, exact_count, correct_count',
    );

  // Buy-in ledger summary header (pot + prize split). Pot = paid-count *
  // buyin. profiles.buyin_paid_at is readable to all authenticated via
  // profiles_read_all.
  const { data: tournament } = await supabase
    .from('tournament')
    .select('buyin_amount_usd, prize_split_pct')
    .eq('code', 'WC2026')
    .maybeSingle();
  const buyinAmount = tournament?.buyin_amount_usd ?? 0;
  const splitPct = tournament?.prize_split_pct ?? [];

  let potUsd = 0;
  if (buyinAmount > 0) {
    const { count: paidCount } = await supabase
      .from('profiles')
      .select('user_id', { count: 'exact', head: true })
      .not('buyin_paid_at', 'is', null);
    potUsd = (paidCount ?? 0) * buyinAmount;
  }

  const buyinHeader =
    buyinAmount > 0 && splitPct.length >= 3 ? (
      <div className="pi-4 pbs-3 pbe-3 mbe-3 mi-auto max-is-md rounded-2xl border border-[var(--zc-border)] bg-[var(--zc-card)] flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-[var(--zc-muted-foreground)]">
            {tBuyin('potLabel')}
          </p>
          <p
            className="text-2xl font-bold text-[var(--zc-primary)] tabular-nums"
            dir="ltr"
          >
            ${potUsd}
          </p>
        </div>
        <div className="text-end">
          <p className="text-xs text-[var(--zc-muted-foreground)]">
            {tBuyin('splitLabel')}
          </p>
          <p className="text-sm font-bold text-[var(--zc-primary)]" dir="ltr">
            {tBuyin('splitValue', {
              first: splitPct[0],
              second: splitPct[1],
              third: splitPct[2],
            })}
          </p>
        </div>
      </div>
    ) : null;

  if (!data || data.length === 0) {
    return (
      <main className="mbs-14 pi-4 pbe-24">
        <h1 className="sr-only">{t('heading')}</h1>
        {buyinHeader}
        <EmptyStateCard heading={t('empty.heading')} body={t('empty.body')} />
      </main>
    );
  }

  // LB-04 + RESEARCH Pattern 7: TS-side sort with Intl.Collator for
  // locale-aware alphabetical tiebreaker (Pitfall 5 — avoids the Supabase
  // ICU collation availability question by NOT pushing the sort to SQL).
  // Chain: total DESC → exact_count DESC → correct_count DESC → display_name ASC.
  const intlLocale = safeLocale === 'he' ? 'he-IL' : 'en-US';
  const collator = new Intl.Collator(intlLocale, { sensitivity: 'base' });
  // Defensively drop any rows missing identity columns (v_leaderboard's
  // generated types mark user_id / display_name as nullable because views
  // can't propagate NOT NULL — at runtime, the LEFT JOIN against `profiles`
  // means these are never null in practice).
  const usable = data.filter(
    (r): r is typeof r & { user_id: string; display_name: string } =>
      typeof r.user_id === 'string' && typeof r.display_name === 'string',
  );
  const sorted = [...usable].sort(
    (a, b) =>
      (b.total ?? 0) - (a.total ?? 0) ||
      (b.exact_count ?? 0) - (a.exact_count ?? 0) ||
      (b.correct_count ?? 0) - (a.correct_count ?? 0) ||
      collator.compare(a.display_name, b.display_name),
  );

  // Strip to the shape LeaderboardRow needs. bracket_total is intentionally
  // dropped — the row component always renders the D-28 placeholder copy.
  const rows: LeaderboardRowData[] = sorted.map((r) => ({
    user_id: r.user_id,
    display_name: r.display_name,
    total: r.total ?? 0,
    league_total: r.league_total ?? 0,
    props_total: r.props_total ?? 0,
  }));

  return (
    <main className="mbs-14 pi-4 pbe-24">
      <h1 className="sr-only">{t('heading')}</h1>
      {buyinHeader}
      <LeaderboardList rows={rows} />
    </main>
  );
}

import { setRequestLocale, getTranslations } from 'next-intl/server';
import { BackToMoreLink } from '@/components/layout/BackToMoreLink';
import { createClient } from '@/lib/supabase/server';

type Props = { params: Promise<{ locale: string }> };

/**
 * /[locale]/rules — How points and locking work.
 *
 * Pure RSC, no DB calls. All copy is in messages/{en,he}.json under
 * the `rules` namespace so the HE pass can rewordsmith without touching
 * code.
 */
export default async function RulesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('rules');

  const supabase = await createClient();
  const { data: tournament } = await supabase
    .from('tournament')
    .select('buyin_amount_usd, prize_split_pct')
    .eq('code', 'WC2026')
    .maybeSingle();
  const buyinAmount = tournament?.buyin_amount_usd ?? 0;
  const splitPct = tournament?.prize_split_pct ?? [];

  return (
    <article className="mi-auto max-is-md mbs-8 ps-4 pe-4 pbe-24">
      <BackToMoreLink />
      <h1 className="text-2xl font-bold text-[var(--zc-primary)] mbe-4">
        {t('heading')}
      </h1>

      <section className="mbs-6">
        <h2 className="text-lg font-bold text-[var(--zc-primary)] mbe-2">
          {t('scoringHeading')}
        </h2>
        <p className="text-base text-[var(--zc-primary)] mbe-3">
          {t('scoringIntro')}
        </p>
        <ul className="text-base text-[var(--zc-primary)] mbs-2 mbe-2 space-y-2">
          <li>
            <strong className="font-bold">{t('scoringExactPts')}</strong>{' '}
            — {t('scoringExactBody')}
          </li>
          <li>
            <strong className="font-bold">{t('scoringDiffPts')}</strong>{' '}
            — {t('scoringDiffBody')}
          </li>
          <li>
            <strong className="font-bold">{t('scoringWinnerPts')}</strong>{' '}
            — {t('scoringWinnerBody')}
          </li>
          <li>
            <strong className="font-bold">{t('scoringMissPts')}</strong>{' '}
            — {t('scoringMissBody')}
          </li>
        </ul>
        <p className="text-sm text-[var(--zc-muted-foreground)] mbs-3">
          {t('scoringFootnote')}
        </p>
      </section>

      <section className="mbs-6 pbs-6 border-t border-[var(--zc-border)]">
        <h2 className="text-lg font-bold text-[var(--zc-primary)] mbe-2">
          {t('propsHeading')}
        </h2>
        <p className="text-base text-[var(--zc-primary)] mbe-2">
          {t('propsBody')}
        </p>
        <p className="text-sm text-[var(--zc-muted-foreground)]">
          {t('propsTotal')}
        </p>
      </section>

      <section className="mbs-6 pbs-6 border-t border-[var(--zc-border)]">
        <h2 className="text-lg font-bold text-[var(--zc-primary)] mbe-2">
          {t('lockingHeading')}
        </h2>
        <p className="text-base text-[var(--zc-primary)] mbe-2">
          {t('lockingMatches')}
        </p>
        <p className="text-base text-[var(--zc-primary)] mbe-2">
          {t('lockingProps')}
        </p>
        <p className="text-base text-[var(--zc-primary)]">
          {t('lockingReveal')}
        </p>
      </section>

      <section className="mbs-6 pbs-6 border-t border-[var(--zc-border)]">
        <h2 className="text-lg font-bold text-[var(--zc-primary)] mbe-2">
          {t('bracketHeading')}
        </h2>
        <p className="text-base text-[var(--zc-primary)]">{t('bracketBody')}</p>
      </section>

      <section className="mbs-6 pbs-6 border-t border-[var(--zc-border)]">
        <h2 className="text-lg font-bold text-[var(--zc-primary)] mbe-2">
          {t('tiebreakHeading')}
        </h2>
        <p className="text-base text-[var(--zc-primary)]">
          {t('tiebreakBody')}
        </p>
      </section>

      {buyinAmount > 0 && splitPct.length >= 3 && (
        <section className="mbs-6 pbs-6 border-t border-[var(--zc-border)]">
          <h2 className="text-lg font-bold text-[var(--zc-primary)] mbe-2">
            {t('buyinHeading')}
          </h2>
          <p className="text-base text-[var(--zc-primary)] mbe-2">
            {t('buyinAmount', { amount: buyinAmount })}
          </p>
          <p className="text-base text-[var(--zc-primary)] mbe-2">
            {t('buyinPayment')}
          </p>
          <p className="text-base text-[var(--zc-primary)]">
            {t('buyinSplit', {
              first: splitPct[0],
              second: splitPct[1],
              third: splitPct[2],
            })}
          </p>
        </section>
      )}
    </article>
  );
}

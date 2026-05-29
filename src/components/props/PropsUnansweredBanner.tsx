import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';

/**
 * Pre-lock nudge banner shown on /matches and /me when the user has any
 * unanswered prop_questions. Single visual element, links to /me/props.
 *
 * Server-rendered: no client JS. Counts come from
 * lib/props/unansweredBanner.getUnansweredPropsBannerData and are static
 * for the request — banner re-renders next navigation.
 *
 * Arrow character is baked into the i18n string (→ in EN, ← in HE) since
 * Unicode arrows don't bidi-mirror automatically.
 */
export async function PropsUnansweredBanner({
  unansweredCount,
  totalCount,
}: {
  unansweredCount: number;
  totalCount: number;
}) {
  const t = await getTranslations('propsBanner');
  return (
    <Link
      href="/me/props"
      data-testid="props-unanswered-banner"
      className="flex items-center justify-between gap-3 pi-4 pbs-3 pbe-3 rounded-2xl bg-[var(--zc-accent)] text-[var(--zc-accent-foreground)] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--zc-surface)]"
    >
      <span className="flex-1 text-start text-base">
        {t('unansweredCta', { n: unansweredCount, total: totalCount })}
      </span>
    </Link>
  );
}

import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';

/**
 * Small "← Back to More" affordance rendered at the top of every page
 * that hangs off the More hub (/me/props, /rules, /how-to-play,
 * /bracket). The arrow glyph is literal in the i18n string — RTL bidi
 * keeps it pointing left visually in both locales, matching the
 * existing `common.backToApp` convention.
 */
export async function BackToMoreLink() {
  const t = await getTranslations('common');
  return (
    <Link
      href="/me"
      className="text-sm text-[var(--zc-muted-foreground)] hover:text-[var(--zc-primary)] inline-block mbe-3"
    >
      {t('backToMore')}
    </Link>
  );
}

import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/routing';

/**
 * Text-only wordmark per UI-SPEC §2 + CONTEXT.md D-14.
 *   - Hebrew "משחקי זערור" on /he/
 *   - English "Zarur Cup" on /en/
 * The locale switch happens via the parent <html lang> + next-intl's
 * useTranslations, NOT via per-component conditionals.
 */
export function Wordmark() {
  const t = useTranslations('wordmark');
  return (
    <Link
      href="/"
      className="text-xl font-bold text-[--zc-primary] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--zc-ring] focus-visible:ring-offset-2 focus-visible:ring-offset-[--zc-card] rounded"
    >
      {t('primary')}
    </Link>
  );
}

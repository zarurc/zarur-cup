'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePathname, getPathname } from '@/lib/i18n/routing';
import { switchLocale } from '@/app/actions/locale';

/**
 * Locale toggle pill per UI-SPEC §4 + D-17.
 *
 * Fix-up plan 01-04 / Bug 4: the previous implementation used next-intl's
 * <Link locale={other}> + a parallel `startTransition(updateLocaleForCurrentUser)`
 * call. The navigation tore down the React tree before the server action's
 * DB UPDATE could finish, so `profiles.locale` never persisted on the live DB.
 *
 * The new shape: a <form action={switchLocale}> with a single button. The
 * action runs server-side (cookie set + profiles.locale UPDATE awaited),
 * then issues `redirect(/<otherLocale>/<sameRelativePath>)`. No client-side
 * navigation runs in parallel, so there is no race. The form submission
 * itself is a POST + 303 redirect, which the browser handles transparently.
 *
 * The pill still SHOWS the OTHER locale's short code (EN on /he/, HE on /en/)
 * exactly as before.
 */
export function LocaleTogglePill() {
  const t = useTranslations('localePill');
  const currentPathname = usePathname(); // locale-stripped, e.g. '/me'
  const { locale } = useParams<{ locale: 'he' | 'en' }>();
  const otherLocale: 'he' | 'en' = locale === 'he' ? 'en' : 'he';

  // Compute the prefixed pathname under the OTHER locale so the redirect
  // lands the user on the equivalent page. getPathname() yields
  // `/en/me` when called with { href: '/me', locale: 'en' }.
  const redirectPath = getPathname({
    href: currentPathname as Parameters<typeof getPathname>[0]['href'],
    locale: otherLocale,
  });

  return (
    <form action={switchLocale} className="inline-flex">
      <input type="hidden" name="locale" value={otherLocale} />
      <input type="hidden" name="redirectPath" value={redirectPath} />
      <button
        type="submit"
        aria-label={t('ariaLabel')}
        className="bs-8 inline-flex items-center justify-center rounded-full border border-[--zc-border] bg-transparent ps-3 pe-3 text-sm font-bold text-[--zc-primary] hover:bg-[--zc-muted] hover:border-[--zc-accent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--zc-ring] focus-visible:ring-offset-2 focus-visible:ring-offset-[--zc-card]"
      >
        {t('switchTo')}
      </button>
    </form>
  );
}

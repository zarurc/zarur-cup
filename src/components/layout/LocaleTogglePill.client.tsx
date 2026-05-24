'use client';

import { useParams } from 'next/navigation';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/lib/i18n/routing';
import { updateLocaleForCurrentUser } from '@/app/actions/locale';

/**
 * Locale toggle pill per UI-SPEC §4 + D-17.
 *
 * The pill is a next-intl <Link> with the OPPOSITE locale - it shows the code
 * of the locale you'd switch INTO (EN on /he/, HE on /en/). The Link itself
 * does the URL change + cookie set via next-intl's middleware.
 *
 * In parallel we fire updateLocaleForCurrentUser() so signed-in users get
 * profiles.locale updated for cross-device continuity. Fire-and-forget under
 * startTransition so it doesn't block navigation.
 */
export function LocaleTogglePill() {
  const t = useTranslations('localePill');
  const pathname = usePathname();
  const { locale } = useParams<{ locale: 'he' | 'en' }>();
  const otherLocale: 'he' | 'en' = locale === 'he' ? 'en' : 'he';
  const [, startTransition] = useTransition();

  function handleClick() {
    startTransition(() => {
      updateLocaleForCurrentUser(otherLocale).catch(() => {
        // Fire-and-forget; the cookie is set by next-intl middleware on the
        // resulting GET so the user sees the locale flip regardless of this
        // server-action outcome.
      });
    });
  }

  return (
    <Link
      href={pathname}
      locale={otherLocale}
      onClick={handleClick}
      aria-label={t('ariaLabel')}
      className="bs-8 inline-flex items-center justify-center rounded-full border border-[--zc-border] bg-transparent ps-3 pe-3 text-sm font-bold text-[--zc-primary] hover:bg-[--zc-muted] hover:border-[--zc-accent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--zc-ring] focus-visible:ring-offset-2 focus-visible:ring-offset-[--zc-card]"
    >
      {t('switchTo')}
    </Link>
  );
}

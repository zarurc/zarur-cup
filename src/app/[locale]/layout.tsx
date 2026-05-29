import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Heebo, Inter } from 'next/font/google';
import { routing } from '@/lib/i18n/routing';
import { Header } from '@/components/layout/Header';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { TimeZoneSync } from '@/components/layout/TimeZoneSync.client';
import '../globals.css';

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '700'],
  variable: '--font-heebo',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-inter',
  display: 'swap',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

/**
 * Canonical root layout. <html lang|dir> is server-rendered from the URL
 * locale param (no useEffect, no FOUC).
 *
 * The chrome is always present: Header (56px, fixed top) + main (padded top
 * and bottom to clear the fixed chrome) + BottomTabBar (~56px + safe-area).
 *
 * UI-SPEC §1 specifies pbs-14 (= 56px = header height) and a bottom block-end
 * padding of calc(56px + env(safe-area-inset-bottom)).
 */
export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const dir = locale === 'he' ? 'rtl' : 'ltr';
  const messages = await getMessages();
  const bodyFont = locale === 'he' ? 'font-heebo' : 'font-inter';

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${heebo.variable} ${inter.variable}`}
    >
      <body
        className={`${bodyFont} min-bs-dvh bg-[var(--zc-surface)] text-[var(--zc-surface-foreground)]`}
      >
        <NextIntlClientProvider messages={messages} locale={locale}>
          <TimeZoneSync />
          <Header />
          <main
            className="pbs-14"
            style={{
              paddingBlockEnd: 'calc(56px + env(safe-area-inset-bottom))',
            }}
          >
            {children}
          </main>
          <BottomTabBar />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

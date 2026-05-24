import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Heebo, Inter } from 'next/font/google';
import { routing } from '@/lib/i18n/routing';
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
        className={`${bodyFont} min-bs-dvh bg-[--zc-surface] text-[--zc-surface-foreground]`}
      >
        <NextIntlClientProvider messages={messages} locale={locale}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

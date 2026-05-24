import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/routing';

/**
 * Per-locale 404 page. Rendered when notFound() is called inside [locale]/*
 * routes. Keeps the chrome (header + bottom tab bar via the locale layout)
 * so users can navigate away.
 */
export default async function LocaleNotFound() {
  const t = await getTranslations('notFound');
  return (
    <section className="mi-auto max-is-md mbs-12 ps-6 pe-6 pbs-8 pbe-8 text-center bg-[--zc-card] border border-[--zc-border] rounded-2xl">
      <h2 className="text-xl font-bold text-[--zc-primary]">{t('heading')}</h2>
      <p className="text-base text-[--zc-muted-foreground] mbs-2">
        {t('body')}
      </p>
      <Link
        href="/matches"
        className="text-sm text-[--zc-primary] underline mbs-4 inline-block"
      >
        ← {t('backLink')}
      </Link>
    </section>
  );
}

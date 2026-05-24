import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { JoinForm } from '@/components/auth/JoinForm.client';
import { getCurrentMember } from '@/lib/auth/session';

type Props = { params: Promise<{ locale: string }> };

/**
 * /[locale]/join - invite-code + display-name entry. Already-signed-in users
 * are sent home (their profile row already exists; re-joining would error).
 */
export default async function JoinPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const member = await getCurrentMember();
  if (member) redirect(`/${locale}` as Route);

  const t = await getTranslations('join');
  const wordmarkT = await getTranslations('wordmark');

  // Sub-wordmark always shows the OTHER locale (Zarur Cup on /he/, the Hebrew
  // wordmark on /en/). Wrapped in <p lang="..."> so the browser bidi algorithm
  // renders embedded direction correctly per UI-SPEC §5 + I18N-06.
  const otherLang = locale === 'he' ? 'en' : 'he';

  return (
    <section className="mi-auto max-is-md ps-4 pe-4 md:ps-6 md:pe-6 pbs-12 pbe-12 md:pbs-16 md:pbe-16">
      <div className="text-center md:text-start mbe-8">
        <h1 className="text-3xl font-bold text-[--zc-primary]">
          {wordmarkT('primary')}
        </h1>
        <p
          className="text-sm text-[--zc-muted-foreground]"
          lang={otherLang}
        >
          {wordmarkT('secondary')}
        </p>
      </div>
      <div className="bg-[--zc-card] border border-[--zc-border] rounded-2xl ps-6 pe-6 pbs-6 pbe-6">
        <h2 className="text-3xl font-bold text-[--zc-primary]">
          {t('pageHeading')}
        </h2>
        <p className="text-base text-[--zc-muted-foreground] mbs-2">
          {t('subheading')}
        </p>
        <div className="mbs-6">
          <JoinForm />
        </div>
      </div>
    </section>
  );
}

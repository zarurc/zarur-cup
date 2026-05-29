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

  return (
    <section className="mi-auto max-is-md ps-4 pe-4 md:ps-6 md:pe-6 pbs-12 pbe-12 md:pbs-16 md:pbe-16">
      <div className="bg-[var(--zc-card)] border border-[var(--zc-border)] rounded-2xl ps-6 pe-6 pbs-6 pbe-6">
        <h2 className="text-3xl font-bold text-[var(--zc-primary)]">
          {t('pageHeading')}
        </h2>
        <p className="text-base text-[var(--zc-muted-foreground)] mbs-2">
          {t('subheading')}
        </p>
        <div className="mbs-6">
          <JoinForm />
        </div>
      </div>
    </section>
  );
}

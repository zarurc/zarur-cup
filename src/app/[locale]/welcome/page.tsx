import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { getCurrentMember } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Link } from '@/lib/i18n/routing';
import { markWelcomeSeen } from '@/app/actions/markWelcomeSeen';

type Props = { params: Promise<{ locale: string }> };

/**
 * /[locale]/welcome — first-time-login onboarding (D-WELCOME-01).
 *
 * Server-routed via /[locale]/page.tsx home redirect:
 *   - profile missing       → /[locale]/join
 *   - welcome_seen_at NULL  → /[locale]/welcome (this page)
 *   - otherwise              → /[locale]/matches
 *
 * Bypass: signed-in users whose welcome_seen_at is already non-null are
 * sent on to /matches — re-visiting the URL on a second device is also
 * a no-op (their profile already carries the timestamp).
 *
 * Dismissal: the "Start playing" form submits to markWelcomeSeen, which
 * stamps profiles.welcome_seen_at = now() and redirects to /[locale]/matches.
 *
 * Layout follows /how-to-play conventions (max-is-md article, step list)
 * with a single-color personalised header.
 */
export default async function WelcomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const safeLocale: 'he' | 'en' = locale === 'he' ? 'he' : 'en';

  const member = await getCurrentMember();
  if (!member) redirect(`/${safeLocale}/join` as Route);
  if (member.welcome_seen_at) redirect(`/${safeLocale}/matches` as Route);

  const t = await getTranslations('welcome');

  const supabase = await createClient();
  const { data: tournament } = await supabase
    .from('tournament')
    .select('buyin_amount_usd')
    .eq('code', 'WC2026')
    .maybeSingle();
  const buyinAmount = tournament?.buyin_amount_usd ?? 0;

  const steps: { title: string; body: string }[] = [
    { title: t('step1Title'), body: t('step1Body') },
    { title: t('step2Title'), body: t('step2Body') },
  ];
  if (buyinAmount > 0) {
    steps.push({
      title: t('step3Title'),
      body: t('step3Body', { buyin: buyinAmount }),
    });
  }
  steps.push({ title: t('step4Title'), body: t('step4Body') });

  return (
    <article className="mi-auto max-is-md mbs-8 ps-4 pe-4 pbe-24">
      <h1 className="text-3xl font-bold text-[var(--zc-primary)] mbe-2">
        {t('heading', { name: member.display_name })}
      </h1>
      <p className="text-base text-[var(--zc-muted-foreground)] mbe-6">
        {t('intro', { buyin: buyinAmount })}
      </p>

      <ol className="space-y-4 mbe-8">
        {steps.map((s, i) => (
          <li
            key={i}
            className="flex gap-3 ps-3 pe-3 pbs-3 pbe-3 border border-[var(--zc-border)] rounded-xl bg-[var(--zc-card)]"
          >
            <span
              className="bs-8 is-8 rounded-full bg-[var(--zc-accent)] text-[var(--zc-primary-foreground)] font-bold flex items-center justify-center shrink-0"
              dir="ltr"
              aria-hidden
            >
              {i + 1}
            </span>
            <div className="flex flex-col">
              <span className="text-base font-bold text-[var(--zc-primary)]">
                {s.title}
              </span>
              <span className="text-sm text-[var(--zc-muted-foreground)] mbs-1">
                {s.body}
              </span>
            </div>
          </li>
        ))}
      </ol>

      <form action={markWelcomeSeen}>
        <button
          type="submit"
          className="bs-12 is-full bg-[var(--zc-primary)] text-[var(--zc-primary-foreground)] rounded-xl font-bold text-base hover:bg-[#13325a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--zc-background)]"
        >
          {t('ctaStart')}
        </button>
      </form>

      <Link
        href="/how-to-play"
        className="block text-center text-sm text-[var(--zc-muted-foreground)] hover:text-[var(--zc-primary)] mbs-4"
      >
        {t('howToPlayLink')}
      </Link>
    </article>
  );
}

import { setRequestLocale, getTranslations } from 'next-intl/server';
import { BackToMoreLink } from '@/components/layout/BackToMoreLink';

type Props = { params: Promise<{ locale: string }> };

/**
 * /[locale]/how-to-play — 60-second walkthrough for first-time visitors.
 *
 * Numbered list (1-5). Pure RSC; copy lives in messages/{en,he}.json
 * under the `howToPlay` namespace.
 */
export default async function HowToPlayPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('howToPlay');

  const steps: { title: string; body: string }[] = [
    { title: t('step1Title'), body: t('step1Body') },
    { title: t('step2Title'), body: t('step2Body') },
    { title: t('step3Title'), body: t('step3Body') },
    { title: t('step4Title'), body: t('step4Body') },
    { title: t('step5Title'), body: t('step5Body') },
  ];

  return (
    <article className="mi-auto max-is-md mbs-8 ps-4 pe-4 pbe-24">
      <BackToMoreLink />
      <h1 className="text-2xl font-bold text-[var(--zc-primary)] mbe-2">
        {t('heading')}
      </h1>
      <p className="text-base text-[var(--zc-muted-foreground)] mbe-6">
        {t('intro')}
      </p>

      <ol className="space-y-4">
        {steps.map((s, i) => (
          <li
            key={i}
            className="flex gap-3 ps-3 pe-3 pbs-3 pbe-3 border border-[var(--zc-border)] rounded-xl"
          >
            <span
              className="bs-8 is-8 rounded-full bg-[var(--zc-accent)] text-[var(--zc-primary-foreground)] font-bold flex items-center justify-center shrink-0"
              dir="ltr"
              aria-hidden
            >
              {i + 1}
            </span>
            <span className="flex flex-col">
              <span className="text-base font-bold text-[var(--zc-primary)]">
                {s.title}
              </span>
              <span className="text-sm text-[var(--zc-muted-foreground)] mbs-1">
                {s.body}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <p className="text-sm text-[var(--zc-muted-foreground)] mbs-6 pbs-4 border-t border-[var(--zc-border)]">
        {t('outro')}
      </p>
    </article>
  );
}

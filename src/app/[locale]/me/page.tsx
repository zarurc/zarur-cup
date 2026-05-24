import { setRequestLocale, getTranslations } from 'next-intl/server';
import { requireMember } from '@/lib/auth/session';

type Props = { params: Promise<{ locale: string }> };

/**
 * /[locale]/me - thin-live page (active in Phase 1, not a placeholder).
 *   - Header is the member's display_name (h2, not h1 - the page-level h1 is
 *     reserved for future actions in Phase 2 per UI-SPEC heading-hierarchy
 *     rule)
 *   - Below the name: localized joined-at date via native Intl.DateTimeFormat
 *     (I18N-07 - no date library needed for format-only)
 *   - And the active locale label
 *
 * The locale TOGGLE itself lives in the header pill; this page just shows the
 * CURRENT locale's display string.
 */
export default async function MePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const member = await requireMember(locale);
  const t = await getTranslations('me');

  const joinedAtLocal = new Intl.DateTimeFormat(
    locale === 'he' ? 'he-IL' : 'en-US',
    { dateStyle: 'long' },
  ).format(new Date(member.joined_at));

  return (
    <section className="mi-auto max-is-md mbs-12 ps-6 pe-6 pbs-8 pbe-8 bg-[--zc-card] border border-[--zc-border] rounded-2xl">
      <h2 className="text-xl font-bold text-[--zc-primary]">
        {member.display_name}
      </h2>
      <p className="text-sm text-[--zc-muted-foreground] mbs-2">
        {t('joinedAt', { joined_at_local: joinedAtLocal })}
      </p>
      <p className="text-sm text-[--zc-muted-foreground] mbs-1">
        {t('localeLabel')}: {member.locale === 'he' ? 'עברית' : 'English'}
      </p>
    </section>
  );
}

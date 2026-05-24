import { setRequestLocale, getTranslations } from 'next-intl/server';
import { requireMember } from '@/lib/auth/session';
import { signOutCurrent } from '@/app/actions/signout';

type Props = { params: Promise<{ locale: string }> };

/**
 * /[locale]/me - thin-live page (active in Phase 1, not a placeholder).
 *   - Header is the member's display_name (h2, not h1 - the page-level h1 is
 *     reserved for future actions in Phase 2 per UI-SPEC heading-hierarchy
 *     rule)
 *   - Below the name: localized joined-at date via native Intl.DateTimeFormat
 *     (I18N-07 - no date library needed for format-only)
 *   - And the active locale label
 *   - At the bottom: Logout button (fix-up plan 01-04, Bug 1a). Clicking it
 *     submits a form that calls signOutCurrent() then redirects to /.
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
    <section className="mi-auto max-is-md mbs-12 ps-6 pe-6 pbs-8 pbe-8 bg-[var(--zc-card)] border border-[var(--zc-border)] rounded-2xl">
      <h2 className="text-xl font-bold text-[var(--zc-primary)]">
        {member.display_name}
      </h2>
      <p className="text-sm text-[var(--zc-muted-foreground)] mbs-2">
        {t('joinedAt', { joined_at_local: joinedAtLocal })}
      </p>
      <p className="text-sm text-[var(--zc-muted-foreground)] mbs-1">
        {t('localeLabel')}: {member.locale === 'he' ? 'עברית' : 'English'}
      </p>
      <form action={signOutCurrent} className="mbs-6">
        <button
          type="submit"
          aria-label={t('logoutAria')}
          className="bs-12 is-full bg-transparent border border-[var(--zc-border)] text-[var(--zc-primary)] rounded-xl font-bold text-base hover:bg-[var(--zc-muted)] hover:border-[var(--zc-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--zc-card)]"
        >
          {t('logout')}
        </button>
      </form>
    </section>
  );
}

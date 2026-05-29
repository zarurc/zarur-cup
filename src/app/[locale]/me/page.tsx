import { setRequestLocale, getTranslations } from 'next-intl/server';
import { requireMember } from '@/lib/auth/session';
import { signOutCurrent } from '@/app/actions/signout';
import { createClient } from '@/lib/supabase/server';
import { Link } from '@/lib/i18n/routing';

type Props = { params: Promise<{ locale: string }> };

/**
 * /[locale]/me — Phase 1 live page extended with the Phase 2 scope-expansion
 * Props card (D-37 + PRIVATE-04). Props are now nested under /me/props.
 *   - Header: member display_name (h2)
 *   - Joined-at date (localized via Intl.DateTimeFormat — I18N-07)
 *   - Active locale label
 *   - Total points readout (from v_leaderboard)
 *   - **NEW**: Props card linking to /me/props with status pill (Editable / Locked)
 *   - Logout button (Phase 1 fix-up plan 01-04)
 *
 * The locale toggle lives in the header pill; this page just shows current locale.
 */
export default async function MePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const member = await requireMember(locale);
  const t = await getTranslations('me');

  const supabase = await createClient();
  const { data: lbRow } = await supabase
    .from('v_leaderboard')
    .select('total')
    .eq('user_id', member.user_id)
    .maybeSingle();
  const total = lbRow?.total ?? 0;

  // Tournament lock for the Props card status pill.
  // WR-01 fix (2026-05-27): pin to code='WC2026'.
  const { data: tournament } = await supabase
    .from('tournament')
    .select('starts_at')
    .eq('code', 'WC2026')
    .maybeSingle();
  const propsLocked = tournament
    ? new Date(tournament.starts_at).getTime() <= Date.now()
    : false;

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
      <p className="flex items-center justify-between gap-3 mbs-4 pbs-3 border-t border-[var(--zc-border)]">
        <span className="text-base text-[var(--zc-muted-foreground)]">
          {t('totalLabel')}
        </span>
        <span
          dir="ltr"
          className="text-2xl font-bold text-[var(--zc-primary)] tabular-nums"
        >
          {total}
        </span>
      </p>

      <Link
        href="/me/props"
        className="flex items-center justify-between gap-3 mbs-4 pbs-3 pbe-3 ps-3 pe-3 border border-[var(--zc-border)] rounded-xl hover:bg-[var(--zc-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--zc-card)]"
      >
        <span className="flex flex-col">
          <span className="text-base font-bold text-[var(--zc-primary)]">
            {t('propsCardHeading')}
          </span>
          <span className="text-sm text-[var(--zc-muted-foreground)]">
            {t('propsCardBody')}
          </span>
        </span>
        <span
          className={
            propsLocked
              ? 'text-xs font-bold pi-2 pbs-1 pbe-1 rounded-full bg-[var(--zc-muted)] text-[var(--zc-muted-foreground)]'
              : 'text-xs font-bold pi-2 pbs-1 pbe-1 rounded-full bg-[var(--zc-accent)] text-[var(--zc-primary-foreground)]'
          }
          aria-label={propsLocked ? t('propsStatusLockedAria') : t('propsStatusEditableAria')}
        >
          {propsLocked ? t('propsStatusLocked') : t('propsStatusEditable')}
        </span>
      </Link>

      <Link
        href="/bracket"
        className="flex items-center justify-between gap-3 mbs-3 pbs-3 pbe-3 ps-3 pe-3 border border-[var(--zc-border)] rounded-xl hover:bg-[var(--zc-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--zc-card)]"
      >
        <span className="flex flex-col">
          <span className="text-base font-bold text-[var(--zc-primary)]">
            {t('bracketLinkHeading')}
          </span>
          <span className="text-sm text-[var(--zc-muted-foreground)]">
            {t('bracketLinkBody')}
          </span>
        </span>
      </Link>

      <Link
        href="/rules"
        className="flex items-center justify-between gap-3 mbs-3 pbs-3 pbe-3 ps-3 pe-3 border border-[var(--zc-border)] rounded-xl hover:bg-[var(--zc-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--zc-card)]"
      >
        <span className="flex flex-col">
          <span className="text-base font-bold text-[var(--zc-primary)]">
            {t('rulesLinkHeading')}
          </span>
          <span className="text-sm text-[var(--zc-muted-foreground)]">
            {t('rulesLinkBody')}
          </span>
        </span>
      </Link>

      <Link
        href="/how-to-play"
        className="flex items-center justify-between gap-3 mbs-3 pbs-3 pbe-3 ps-3 pe-3 border border-[var(--zc-border)] rounded-xl hover:bg-[var(--zc-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--zc-card)]"
      >
        <span className="flex flex-col">
          <span className="text-base font-bold text-[var(--zc-primary)]">
            {t('howToPlayLinkHeading')}
          </span>
          <span className="text-sm text-[var(--zc-muted-foreground)]">
            {t('howToPlayLinkBody')}
          </span>
        </span>
      </Link>

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

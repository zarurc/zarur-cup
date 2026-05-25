import Link from 'next/link';
import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';

/**
 * Admin home — English-only (D-05). Plan 02-06: replaces the Phase 1
 * placeholder with a 4-card nav linking to each admin tab:
 *
 *   - /admin/matches          (Plan 02-05: View Mode + Score Entry Mode)
 *   - /admin/tournament-tree  (Plan 02-06 + ADM-03: placeholder resolver)
 *   - /admin/props            (Plan 02-06 + ADM-04 + PRP-04: author + grade)
 *   - /admin/roster           (Plan 02-06 + ADM-05: merge users)
 *
 * All href values are LITERAL string paths cast to `Route` — under Next
 * 15.5 typedRoutes, dynamic-string hrefs would fail strictness (the
 * Plan 02-05 AdminModeToggle had to be patched post-merge for exactly
 * this; see commit edcab7c). Literal strings ARE the canonical form;
 * the cast is defense-in-depth in case typedRoutes hasn't built the
 * target page's route map yet at the time this file typechecks.
 *
 * NO requireAdmin() call here — the parent layout enforces (D-06).
 * Calling it again would be redundant.
 */
export default async function AdminHome() {
  const t = await getTranslations('admin.home');
  const linkClass =
    'block bg-[var(--zc-card)] border border-[var(--zc-border)] rounded-2xl pi-4 pbs-4 pbe-4 mbs-3 text-base font-bold text-[var(--zc-primary)] hover:bg-[var(--zc-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)]';
  return (
    <main className="pi-4 pbs-4 pbe-24">
      <h1 className="text-xl font-bold mbs-2 mbe-4">{t('heading')}</h1>
      <nav>
        <Link href={'/admin/matches' as Route} className={linkClass}>
          {t('navMatches')}
        </Link>
        <Link href={'/admin/tournament-tree' as Route} className={linkClass}>
          {t('navTree')}
        </Link>
        <Link href={'/admin/props' as Route} className={linkClass}>
          {t('navProps')}
        </Link>
        <Link href={'/admin/roster' as Route} className={linkClass}>
          {t('navRoster')}
        </Link>
      </nav>
    </main>
  );
}

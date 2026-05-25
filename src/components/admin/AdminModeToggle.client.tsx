'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

/**
 * Admin View/Entry mode toggle per UI-SPEC §11 + D-09.
 *
 * URLSearchParam-driven (`?mode=view` default, `?mode=entry` for entry).
 * This is intentionally a `<Link>`-based segmented control — NOT a
 * `<form action={serverAction}>` like the player LocaleTogglePill.
 *
 * Rationale:
 *   - `/admin/*` is unlocalized (Phase 1 D-05). There is no locale to
 *     round-trip through a server action.
 *   - The toggle has no side effect — it only changes the rendered mode.
 *     Issuing a Server Action would add a needless network round-trip
 *     for a pure URL state change.
 *   - The page reads `searchParams.mode` directly to pick its render
 *     branch, so the URL is the single source of truth.
 *
 * `replace` + `scroll={false}` keeps the back button useful (one history
 * entry for /admin/matches, not one per toggle click) and avoids
 * scroll-jump when the admin is mid-scroll.
 *
 * Active-state accent stripe (UI-SPEC §11): when Entry Mode is active,
 * its inner pill gets a 2px-wide accent inline-start border as a
 * "danger-ish" cue (it's the mode that writes results) without using
 * destructive red. View Mode active gets no stripe.
 */
export function AdminModeToggle() {
  const t = useTranslations('admin.modeToggle');
  const sp = useSearchParams();
  const mode = sp?.get('mode') === 'entry' ? 'entry' : 'view';

  // Preserve any unrelated search params (none expected on /admin/matches
  // in Phase 2, but future-proof). Returns a UrlObject so Next 15.5's
  // typedRoutes accepts the dynamic query without a string-literal cast.
  const next = (target: 'view' | 'entry') => {
    const query: Record<string, string> = {};
    sp?.forEach((value, key) => {
      query[key] = value;
    });
    query.mode = target;
    return { pathname: '/admin/matches' as const, query };
  };

  const baseSeg =
    'flex-1 bs-10 ps-4 pe-4 inline-flex items-center justify-center rounded-lg text-base font-bold transition-colors duration-150';
  const active = 'bg-[var(--zc-card)] text-[var(--zc-primary)] shadow-sm';
  const inactive = 'bg-transparent text-[var(--zc-muted-foreground)]';

  return (
    <nav
      className="inline-flex bs-12 rounded-xl bg-[var(--zc-muted)] p-1"
      aria-label="Mode"
    >
      <Link
        href={next('view')}
        replace
        scroll={false}
        className={`${baseSeg} ${mode === 'view' ? active : inactive}`}
        aria-current={mode === 'view' ? 'page' : undefined}
      >
        {t('view')}
      </Link>
      <Link
        href={next('entry')}
        replace
        scroll={false}
        className={`${baseSeg} ${
          mode === 'entry'
            ? `${active} border-s-2 border-[var(--zc-accent)]`
            : inactive
        }`}
        aria-current={mode === 'entry' ? 'page' : undefined}
      >
        {t('entry')}
      </Link>
    </nav>
  );
}

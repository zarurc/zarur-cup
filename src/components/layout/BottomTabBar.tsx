'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/lib/i18n/routing';

type Tab = {
  key: 'matches' | 'bracket' | 'leaderboard' | 'me';
  href: '/matches' | '/bracket' | '/leaderboard' | '/me';
};

// DOM order is always Matches -> Me. <html dir> flips the visual order: on
// /he/ the user sees Me -> Leaderboard -> Bracket -> Matches reading
// right-to-left. UI-SPEC §3 + §"Token-Theming for RTL" - the reversed flex
// row utility is intentionally never used; the inline axis is direction-aware.
const TABS: Tab[] = [
  { key: 'matches', href: '/matches' },
  { key: 'bracket', href: '/bracket' },
  { key: 'leaderboard', href: '/leaderboard' },
  { key: 'me', href: '/me' },
];

/**
 * Bottom tab bar per UI-SPEC §3.
 *   - 4 tabs, text-only labels (no icons in Phase 1)
 *   - Active tab shows a 4px accent bar above its label + bold label color
 *   - safe-area-inset-bottom padding so the bar sits above iOS home indicator
 *
 * Client component: uses next-intl's usePathname() which returns the
 * locale-STRIPPED pathname (e.g. /matches on both /he/matches and /en/matches),
 * so active-tab matching is locale-agnostic. The render cost of the entire
 * bar is trivial; the client-only payload is ~1 KB.
 *
 * Active-state matching uses exact equality or prefix-with-slash so future
 * subroutes (e.g. /me/edit) still highlight the parent tab without giving
 * /me false matches on a hypothetical /me-something route.
 */
export function BottomTabBar() {
  const t = useTranslations('tabs');
  // usePathname() from next-intl can return null outside of Next contexts
  // (defensive: this is a client hook so it should always have a value at
  // runtime, but the type is `string | null` because of next/navigation's
  // upstream signature).
  const pathname = usePathname() ?? '';
  const activeKey =
    TABS.find(
      (tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`),
    )?.key ?? null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-be-0 inset-i-0 z-40 bg-[--zc-card] border-t-1 border-[--zc-border] pbs-2 ps-2 pe-2"
      style={{ paddingBlockEnd: 'calc(8px + env(safe-area-inset-bottom))' }}
    >
      <ul className="flex flex-row items-stretch justify-around">
        {TABS.map((tab) => {
          const active = tab.key === activeKey;
          return (
            <li key={tab.key} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className="flex flex-col items-center justify-center bs-11 is-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--zc-ring] focus-visible:ring-offset-2 focus-visible:ring-offset-[--zc-card]"
              >
                {active && (
                  <span
                    className="bs-1 is-8 bg-[--zc-accent] mbe-1 rounded"
                    aria-hidden
                  />
                )}
                <span
                  className={
                    active
                      ? 'text-sm font-bold text-[--zc-primary]'
                      : 'text-sm font-normal text-[--zc-muted-foreground]'
                  }
                >
                  {t(tab.key)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';

/**
 * Persistent admin section tabs (W2-C1).
 *
 * Mounted by /admin/(protected)/layout.tsx so admin can switch between
 * Matches / Tree / Props / Roster without bouncing back through the home
 * page. Uses `usePathname()` to compute the active tab so the active
 * style stays accurate across client navigations.
 *
 * Admin is EN-only (Phase 1 D-05) so labels are hardcoded short forms
 * (the `admin.home.nav*` i18n keys are longer copy meant for the home
 * dashboard cards). Tabs are horizontally scrollable on narrow viewports
 * so the row never wraps awkwardly.
 *
 * Active tab styling: primary-color text + 2px inset-bottom accent
 * border. Inactive tabs use muted-foreground. Hovering inactive lifts
 * it to primary color for affordance.
 */
const TABS: { href: Route; label: string }[] = [
  { href: '/admin/matches' as Route, label: 'Matches' },
  { href: '/admin/tournament-tree' as Route, label: 'Tree' },
  { href: '/admin/props' as Route, label: 'Props' },
  { href: '/admin/roster' as Route, label: 'Roster' },
];

export function AdminNavTabs() {
  const pathname = usePathname();
  return (
    <nav
      role="tablist"
      aria-label="Admin sections"
      className="bs-12 border-b border-[var(--zc-border)] bg-[var(--zc-card)] flex items-stretch gap-1 ps-2 pe-2 overflow-x-auto"
    >
      {TABS.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-current={isActive ? 'page' : undefined}
            aria-selected={isActive}
            className={`inline-flex items-center pi-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)] ${
              isActive
                ? 'text-[var(--zc-primary)] border-[var(--zc-accent)]'
                : 'text-[var(--zc-muted-foreground)] border-transparent hover:text-[var(--zc-primary)]'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

import Link from 'next/link';
import type { Route } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { IntegrityWidget } from '@/components/admin/IntegrityWidget';

/**
 * Inner admin layout - gates EVERY route under /admin/(protected)/*. Non-
 * admin signed-in users are redirected to /admin/403; signed-out users are
 * redirected to / (which the i18n middleware forwards to /he/join).
 *
 * The gate lives at the layout level (D-06) so UI hiding alone never gets
 * mistaken for the gate - this is the only valid enforcement point for the
 * "admin only" boundary.
 *
 * Plan 02-06: appends <IntegrityWidget /> after {children} so the always-
 * visible LGE-06 lock-breach + counts strip lands on every admin page
 * (D-15 + ADM-06). The widget is a server component — it runs on each
 * pageload, no polling/cron.
 */
export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <>
      <header className="flex items-center justify-between ps-4 pe-4 bs-14 border-b-1 border-[var(--zc-border)] bg-[var(--zc-card)]">
        <span className="text-xl font-bold text-[var(--zc-primary)]">Admin</span>
        <Link
          href={'/' as Route}
          className="text-sm text-[var(--zc-primary)] underline"
        >
          ← Back to app
        </Link>
      </header>
      <main>{children}</main>
      <IntegrityWidget />
    </>
  );
}

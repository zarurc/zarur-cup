import Link from 'next/link';
import type { Route } from 'next';

/**
 * Admin-403 page - destination for non-admin signed-in users (the admin gate
 * sends them here). Lives OUTSIDE the (protected) route group so it does NOT
 * inherit the gate's redirect-to-/admin/403, which would otherwise create a
 * redirect loop (T-04-09 mitigation).
 *
 * English-only per D-05.
 */
export default function Admin403() {
  return (
    <section className="mi-auto max-is-md mbs-12 ps-6 pe-6 pbs-8 pbe-8 bg-[var(--zc-card)] border border-[var(--zc-border)] rounded-2xl text-center">
      <h1 className="text-3xl font-bold text-[var(--zc-destructive)]">Admin only</h1>
      <p className="text-base text-[var(--zc-muted-foreground)] mbs-2">
        This area is reserved for the tournament admin.
      </p>
      <Link
        href={'/' as Route}
        className="text-sm text-[var(--zc-primary)] underline mbs-4 inline-block"
      >
        ← Back to app
      </Link>
    </section>
  );
}

/**
 * Admin home - English-only (D-05). Phase 1 has no admin actions; this is a
 * placeholder so the gate path /admin -> requireAdmin -> render exists.
 */
export default function AdminHome() {
  return (
    <section className="mi-auto max-is-md mbs-12 ps-6 pe-6 pbs-8 pbe-8 bg-[var(--zc-card)] border border-[var(--zc-border)] rounded-2xl text-center">
      <h1 className="text-3xl font-bold text-[var(--zc-primary)]">Admin</h1>
      <p className="text-base text-[var(--zc-muted-foreground)] mbs-2">
        No actions available yet. Admin pages light up in Phase 2.
      </p>
    </section>
  );
}

/**
 * Sticky date-group header per UI-SPEC §7.
 *
 * Sticks at block-start = 96px (inset-bs-24 = 56 header + 40 banner).
 * When the countdown banner unmounts post-tournament, the page wrapper
 * (matches/page.tsx) is responsible for adjusting page top-padding from
 * mbs-10 to mbs-0; this header's sticky offset can stay constant because
 * a 40px shift on a sticky h3 is imperceptible at the page level.
 *
 * Background is surface (not card) so headers blend into the page
 * background rather than punching out like cards (UI-SPEC §7 rationale).
 */
export function DateGroupHeader({ label }: { label: string }) {
  return (
    <h3 className="sticky inset-bs-24 z-20 bs-10 bg-[var(--zc-surface)] pi-4 flex items-center text-sm font-bold text-[var(--zc-muted-foreground)]">
      {label}
    </h3>
  );
}

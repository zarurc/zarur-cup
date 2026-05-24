type Props = { heading: string; body: string };

/**
 * Centered empty-state card per UI-SPEC §7. Used on the three placeholder
 * tabs (matches/bracket/leaderboard) before their respective phases land.
 */
export function EmptyStateCard({ heading, body }: Props) {
  return (
    <section className="mi-auto max-is-md mbs-12 ps-6 pe-6 pbs-8 pbe-8 text-center bg-[--zc-card] border border-[--zc-border] rounded-2xl">
      <h2 className="text-xl font-bold text-[--zc-primary]">{heading}</h2>
      <p className="text-base text-[--zc-muted-foreground] mbs-2">{body}</p>
    </section>
  );
}

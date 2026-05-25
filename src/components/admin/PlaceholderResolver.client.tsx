'use client';

import { resolvePlaceholder } from '@/app/actions/resolvePlaceholder';

/**
 * Per-row placeholder resolver form (ADM-03 + D-11 UI half).
 *
 * One <form> per placeholder. The hidden `placeholder` field carries the
 * opaque token (e.g. 'WINNER_GROUP_A', 'R16_M1_W'); the select picks a
 * team from the seeded teams roster. Submitting calls the Server Action
 * which UPDATEs every fixtures row that references the placeholder, plus
 * the matching bracket_slots row.
 *
 * Mutate-and-navigate per PATTERNS Pattern A — the action redirects back
 * to /admin/tournament-tree?resolved=<token>.
 *
 * Admin pages are EN-only per Phase 1 D-05; literal English strings are
 * acceptable here (the tournament-tree page itself uses getTranslations
 * for the heading; the row-level button + label are short enough to
 * inline).
 */

type Team = {
  id: string;
  code: string;
  name_en: string;
};

export function PlaceholderResolver({
  placeholder,
  teams,
}: {
  placeholder: string;
  teams: Team[];
}) {
  return (
    <form
      action={resolvePlaceholder}
      className="flex items-center gap-3 pbs-2 pbe-2"
    >
      <input type="hidden" name="placeholder" value={placeholder} />
      <label
        htmlFor={`resolve-${placeholder}`}
        className="text-base font-bold flex-1"
      >
        {placeholder}:
      </label>
      <select
        id={`resolve-${placeholder}`}
        name="team_id"
        defaultValue=""
        required
        className="bs-12 ps-3 pe-3 rounded-xl border border-[var(--zc-border)] bg-white text-base"
        aria-label={`Resolve ${placeholder} to team`}
      >
        <option value="" disabled>
          —
        </option>
        {teams.map((tm) => (
          <option key={tm.id} value={tm.id}>
            {tm.code} — {tm.name_en}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="bs-12 ps-4 pe-4 rounded-xl bg-[var(--zc-primary)] text-[var(--zc-primary-foreground)] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)]"
      >
        Save placeholder
      </button>
    </form>
  );
}

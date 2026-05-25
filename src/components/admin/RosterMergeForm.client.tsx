'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { mergeUsers } from '@/app/actions/mergeUsers';

/**
 * Roster merge form (ADM-05 + D-14, destructive confirmation per
 * UI-SPEC §"Destructive confirmations").
 *
 * Each non-admin profile row renders one of these — admin picks the
 * target from a dropdown of all other profiles, clicks Merge, sees a
 * native browser confirm() dialog with the exact message copy spec'd
 * in UI-SPEC. Cancelling preventDefault()s the form submit.
 *
 * The Server Action then runs:
 *   - pre-cleans 4 unique-indexed child tables (score_events PK,
 *     predictions, prop_answers, bracket_picks)
 *   - bulk UPDATEs all 4 children + score_events to retarget user_id
 *   - DELETEs source's profile + auth.users row
 *
 * Why client + window.confirm: family-trust posture (Phase 1 D-04)
 * accepts that merge is destructive but recoverable (admin can re-create
 * the user; the only thing that's permanently lost is the source's
 * auth.users UUID, which is invisible to family members). The native
 * dialog is the friction layer; the Server Action is the authoritative
 * gate.
 *
 * `useState` for the local target selection so we can disable the Merge
 * button until the admin has picked a non-self target — without this,
 * clicking Merge with no selection would either send empty FormData (Zod
 * validation rejects) or default to the first option, neither of which
 * is what we want.
 */

type Profile = { user_id: string; display_name: string };

export function RosterMergeForm({
  source,
  candidates,
}: {
  source: Profile;
  candidates: Profile[];
}) {
  const [targetId, setTargetId] = useState<string>('');
  const target = candidates.find((c) => c.user_id === targetId);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (!target) {
      e.preventDefault();
      return;
    }
    const ok = window.confirm(
      `Merge ${source.display_name} → ${target.display_name}? This moves all picks and deletes ${source.display_name}. This cannot be undone.`,
    );
    if (!ok) e.preventDefault();
  };

  return (
    <form
      action={mergeUsers}
      onSubmit={handleSubmit}
      className="inline-flex items-center gap-2"
    >
      <input type="hidden" name="source_user_id" value={source.user_id} />
      <select
        name="target_user_id"
        value={targetId}
        onChange={(e) => setTargetId(e.target.value)}
        className="bs-12 ps-3 pe-3 rounded-xl border border-[var(--zc-border)] bg-white text-sm"
        aria-label={`Merge ${source.display_name} into target`}
      >
        <option value="" disabled>
          Merge into…
        </option>
        {candidates
          .filter((c) => c.user_id !== source.user_id)
          .map((c) => (
            <option key={c.user_id} value={c.user_id}>
              {c.display_name}
            </option>
          ))}
      </select>
      <button
        type="submit"
        disabled={!target}
        className="bs-12 ps-4 pe-4 rounded-xl bg-[var(--zc-destructive)] text-white font-bold text-sm disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)]"
      >
        Merge
      </button>
    </form>
  );
}

'use client';

import { createOrUpdateProp } from '@/app/actions/createOrUpdateProp';

/**
 * Admin prop authoring form (ADM-04 + D-13).
 *
 * Renders either as a fresh "Create prop" form or an edit form for an
 * existing prop_question. The Server Action handles both via the presence
 * of the `id` hidden field.
 *
 * Bilingual prompts: prompt_en + prompt_he are both required (the
 * player feed renders one of the two based on the player's locale).
 * The prompt_he input gets `dir="rtl"` so the Hebrew text composes
 * correctly while typing.
 *
 * answer_type matches the live DB CHECK constraint values (underscored)
 * per the schema/scoring contract from Plan 02-02:
 *   - single_team   (player picks a flag → answer = team.id UUID)
 *   - single_player (free text matched against alias set on grade)
 *   - text          (free text matched against alias set on grade)
 *
 * points_value is the Zod schema field name; the Server Action maps it
 * to the DB column `points` (which differs from the schema name by
 * historical convention).
 *
 * NO `'use client'` form state — `<form action={serverAction}>` per
 * PATTERNS Pattern A. The action redirects back with ?saved=1.
 */

type ExistingProp = {
  id: string;
  prompt_en: string;
  prompt_he: string;
  answer_type: 'single_team' | 'single_player' | 'text' | 'yes_no';
  points_value: number;
};

export function PropAuthoringForm({ existing }: { existing?: ExistingProp }) {
  const labelCls = 'block text-sm font-bold mbs-3';
  const inputCls =
    'bs-12 is-full bg-white rounded-xl border border-[var(--zc-border)] ps-4 pe-4 text-base text-[var(--zc-primary)] focus-visible:outline-none focus-visible:border-[var(--zc-accent)]';
  return (
    <form
      action={createOrUpdateProp}
      className="pbs-4 pbe-4 border-b border-[var(--zc-border)]"
    >
      {existing && <input type="hidden" name="id" value={existing.id} />}
      <label className={labelCls}>
        Prompt (English)
        <input
          name="prompt_en"
          defaultValue={existing?.prompt_en ?? ''}
          required
          minLength={3}
          maxLength={200}
          dir="ltr"
          className={inputCls}
        />
      </label>
      <label className={labelCls}>
        Prompt (Hebrew)
        <input
          name="prompt_he"
          defaultValue={existing?.prompt_he ?? ''}
          required
          minLength={3}
          maxLength={200}
          dir="rtl"
          className={inputCls}
        />
      </label>
      <label className={labelCls}>
        Answer type
        <select
          name="answer_type"
          defaultValue={existing?.answer_type ?? 'single_team'}
          required
          className={inputCls}
        >
          <option value="single_team">Pick a team</option>
          <option value="single_player">Pick a player</option>
          <option value="text">Free text</option>
          <option value="yes_no">Yes / No</option>
        </select>
      </label>
      <label className={labelCls}>
        Points value
        <input
          type="number"
          name="points_value"
          defaultValue={existing?.points_value ?? 5}
          min={1}
          max={50}
          required
          dir="ltr"
          className={inputCls}
        />
      </label>
      <button
        type="submit"
        className="mbs-4 bs-12 is-full rounded-xl bg-[var(--zc-primary)] text-[var(--zc-primary-foreground)] font-bold text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)]"
      >
        {existing ? 'Save changes' : 'Create prop'}
      </button>
    </form>
  );
}

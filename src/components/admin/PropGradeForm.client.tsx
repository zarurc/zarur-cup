'use client';

import { gradeProp } from '@/app/actions/gradeProp';

/**
 * Admin prop grading form (PRP-04 + SCR-04 + SCR-06, D-13).
 *
 * Two inputs:
 *   - correct_answer: the canonical answer (e.g. "Lionel Messi", UUID for
 *     a single_team prop).
 *   - correct_answer_aliases: a newline-delimited textarea. The Server
 *     Action splits + trims + drops blanks before passing to scoreProp.
 *
 * Submitting fires `gradeProp` which sweeps prop_answers, scores each
 * via scoreProp, and bulk-UPSERTs into score_events with source='prop'.
 * Idempotent: re-submitting the same grade just bumps `updated_at` on
 * each row.
 *
 * NO `'use client'` form state — server action handles redirect + UI
 * feedback via search params (?graded=<id>).
 */

export function PropGradeForm({
  questionId,
  initialCorrect,
  initialAliases,
}: {
  questionId: string;
  initialCorrect: string | null;
  initialAliases: string[];
}) {
  const aliasText = initialAliases.join('\n');
  return (
    <form
      action={gradeProp}
      className="pbs-4 pbe-4 border-b border-[var(--zc-border)]"
    >
      <input type="hidden" name="id" value={questionId} />
      <label className="block text-sm font-bold mbs-3">
        Correct answer
        <input
          name="correct_answer"
          defaultValue={initialCorrect ?? ''}
          required
          minLength={1}
          maxLength={120}
          className="bs-12 is-full bg-white rounded-xl border border-[var(--zc-border)] ps-4 pe-4 text-base text-[var(--zc-primary)] focus-visible:outline-none focus-visible:border-[var(--zc-accent)]"
        />
      </label>
      <label className="block text-sm font-bold mbs-3">
        Aliases (one per line)
        <textarea
          name="correct_answer_aliases"
          defaultValue={aliasText}
          rows={4}
          className="is-full bg-white rounded-xl border border-[var(--zc-border)] ps-4 pe-4 pbs-2 pbe-2 text-base text-[var(--zc-primary)] focus-visible:outline-none focus-visible:border-[var(--zc-accent)]"
        />
        <span className="block text-xs text-[var(--zc-muted-foreground)] mbs-1">
          Alias set (one per line): canonical + variants for fuzzy matching
        </span>
      </label>
      <button
        type="submit"
        className="mbs-4 bs-12 is-full rounded-xl bg-[var(--zc-primary)] text-[var(--zc-primary-foreground)] font-bold text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)]"
      >
        Save grade
      </button>
    </form>
  );
}

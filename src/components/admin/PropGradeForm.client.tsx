'use client';

import { gradeProp } from '@/app/actions/gradeProp';
import { codeToFlag } from '@/lib/teams/codeToFlag';

/**
 * Admin prop grading form (PRP-04 + SCR-04 + SCR-06, D-13).
 *
 * Dispatches on `answerType` so admin enters the canonical answer with
 * the same kind of widget the player used to submit (mirrors PropCard):
 *
 *   - yes_no       → radio buttons (value="yes" | "no")
 *   - single_team  → <select> of teams keyed by UUID; the player's saved
 *                    answer is also a team.id UUID so the membership
 *                    check in scoreProp lands exactly.
 *   - single_player / text → free-text input; alias-set textarea visible
 *                    for fuzzy match against player free text.
 *
 * Aliases textarea is hidden for yes_no + single_team — the canonical
 * answer is unambiguous so there is nothing to alias. (gradeProp's
 * action treats the empty/missing textarea field as zero aliases.)
 *
 * Submission flow unchanged: `<form action={gradeProp}>` POSTs FormData
 * with `correct_answer` (string) + `correct_answer_aliases` (newline-
 * delimited string). The action sweeps prop_answers and bulk-UPSERTs
 * score_events. Idempotent on re-submit.
 */

type AnswerType = 'single_team' | 'single_player' | 'text' | 'yes_no';
type Team = { id: string; code: string; name_en: string };

export function PropGradeForm({
  questionId,
  answerType,
  initialCorrect,
  initialAliases,
  teams,
}: {
  questionId: string;
  answerType: AnswerType;
  initialCorrect: string | null;
  initialAliases: string[];
  teams: Team[];
}) {
  const aliasText = initialAliases.join('\n');
  const inputCls =
    'bs-12 is-full bg-white rounded-xl border border-[var(--zc-border)] ps-4 pe-4 text-base text-[var(--zc-primary)] focus-visible:outline-none focus-visible:border-[var(--zc-accent)]';
  const showAliases = answerType === 'single_player' || answerType === 'text';

  return (
    <form
      action={gradeProp}
      className="pbs-4 pbe-4 border-b border-[var(--zc-border)]"
    >
      <input type="hidden" name="id" value={questionId} />
      <fieldset className="block">
        <legend className="block text-sm font-bold mbs-3">Correct answer</legend>
        {answerType === 'yes_no' && (
          <div className="flex gap-3 mbs-2" role="radiogroup">
            <label
              className={`bs-12 flex-1 inline-flex items-center justify-center rounded-xl border border-[var(--zc-border)] bg-white text-base font-bold text-[var(--zc-primary)] cursor-pointer has-[:checked]:ring-2 has-[:checked]:ring-[var(--zc-accent)] has-[:checked]:bg-[var(--zc-muted)]`}
            >
              <input
                type="radio"
                name="correct_answer"
                value="yes"
                defaultChecked={initialCorrect === 'yes'}
                required
                className="sr-only"
              />
              Yes
            </label>
            <label
              className={`bs-12 flex-1 inline-flex items-center justify-center rounded-xl border border-[var(--zc-border)] bg-white text-base font-bold text-[var(--zc-primary)] cursor-pointer has-[:checked]:ring-2 has-[:checked]:ring-[var(--zc-accent)] has-[:checked]:bg-[var(--zc-muted)]`}
            >
              <input
                type="radio"
                name="correct_answer"
                value="no"
                defaultChecked={initialCorrect === 'no'}
                required
                className="sr-only"
              />
              No
            </label>
          </div>
        )}
        {answerType === 'single_team' && (
          <select
            name="correct_answer"
            defaultValue={initialCorrect ?? ''}
            required
            className={`${inputCls} mbs-2`}
          >
            <option value="" disabled>
              — Pick a team —
            </option>
            {teams.map((tm) => (
              <option key={tm.id} value={tm.id}>
                {codeToFlag(tm.code)} {tm.code} — {tm.name_en}
              </option>
            ))}
          </select>
        )}
        {(answerType === 'single_player' || answerType === 'text') && (
          <input
            name="correct_answer"
            defaultValue={initialCorrect ?? ''}
            required
            minLength={1}
            maxLength={120}
            className={`${inputCls} mbs-2`}
          />
        )}
      </fieldset>
      {showAliases && (
        <label className="block text-sm font-bold mbs-3">
          Aliases (one per line)
          <textarea
            name="correct_answer_aliases"
            defaultValue={aliasText}
            rows={4}
            placeholder={'Lionel Messi\nMessi\nL. Messi\nמסי'}
            className="is-full bg-white rounded-xl border border-[var(--zc-border)] ps-4 pe-4 pbs-2 pbe-2 text-base text-[var(--zc-primary)] focus-visible:outline-none focus-visible:border-[var(--zc-accent)]"
          />
          <span className="block text-xs text-[var(--zc-muted-foreground)] mbs-1">
            Variants for fuzzy match — case-insensitive, trimmed, NFC-normalized.
          </span>
        </label>
      )}
      {!showAliases && (
        <input type="hidden" name="correct_answer_aliases" value="" />
      )}
      <button
        type="submit"
        className="mbs-4 bs-12 is-full rounded-xl bg-[var(--zc-primary)] text-[var(--zc-primary-foreground)] font-bold text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)]"
      >
        Save grade
      </button>
    </form>
  );
}

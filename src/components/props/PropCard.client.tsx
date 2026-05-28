'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { savePropAnswer } from '@/app/actions/savePropAnswer';
import { SavedIndicator } from '@/components/ui/SavedIndicator.client';
import { FlagDropdown } from './FlagDropdown.client';
import type { Team } from '@/lib/teams/flags';

const DEBOUNCE_MS = 600;
// Client-side mirror of the server FREE_TEXT_REGEX from propAnswerSchema
// (Plan 02-02). Letters, digits, spaces, and safe punctuation only —
// rejects <, >, &, /, =, ;, " etc. as the first defense vs stored XSS
// (T-02-04-01). React auto-escape on render is the second defense.
const FREE_TEXT_REGEX = /^[\p{L}\d \-.,!?']+$/u;

export type PropQuestion = {
  id: string;
  // UNDERSCORED enum matches the live DB CHECK constraint
  // (0001_init.sql:138). Schema-aligned with Plan 02-02.
  answer_type: 'single_team' | 'single_player' | 'text';
  points_value: number;
  prompt_en: string;
  prompt_he: string;
};

type Props = {
  locale: 'he' | 'en';
  question: PropQuestion;
  initialAnswer: string | null;
  /** Only used when answer_type === 'single_team'. */
  teams: Team[];
};

/**
 * Per-prop editable card. Delegates to FlagGrid for `single_team`
 * questions; renders a debounced free-text input for `single_player`
 * and `text` questions.
 *
 * Pre-first-kickoff, RLS allows the user to write their own answer
 * (and only see their own — prop_answers_read filters per-user pre-
 * reveal). Post-first-kickoff this component is NOT rendered — the
 * page swaps to the read-only reveal block instead.
 */
export function PropCard({ locale, question, initialAnswer, teams }: Props) {
  const prompt = locale === 'he' ? question.prompt_he : question.prompt_en;

  if (question.answer_type === 'single_team') {
    return (
      <article className="bg-[var(--zc-card)] border border-[var(--zc-border)] rounded-2xl pi-4 pbs-4 pbe-4 mbs-4">
        <h3 className="text-base font-bold text-[var(--zc-primary)] mbe-3">
          {prompt}
        </h3>
        <FlagDropdown
          questionId={question.id}
          locale={locale}
          teams={teams}
          initialAnswer={initialAnswer}
        />
      </article>
    );
  }

  // single_player or text: delegate to FreeTextPropCard.
  return (
    <FreeTextPropCard
      question={question}
      initialAnswer={initialAnswer}
      prompt={prompt}
    />
  );
}

function FreeTextPropCard({
  question,
  initialAnswer,
  prompt,
}: {
  question: PropQuestion;
  initialAnswer: string | null;
  prompt: string;
}) {
  const t = useTranslations('props');
  const [value, setValue] = useState<string>(initialAnswer ?? '');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<
    'locked' | 'network' | 'validation' | null
  >(null);
  const [, startTransition] = useTransition();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef<boolean>(false);

  // maxLength differs by answer_type per propAnswerSchema (Plan 02-02):
  // single_player = 64 chars; text = 120 chars.
  const maxLength = question.answer_type === 'text' ? 120 : 64;

  const handleChange = (next: string) => {
    dirty.current = true;
    setValue(next);
    setError(null);
  };

  useEffect(() => {
    if (!dirty.current) return;
    const trimmed = value.trim();
    if (trimmed === '') return; // empty stays unsaved
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      // Client-side regex pre-check mirrors propAnswerSchema's
      // FREE_TEXT_REGEX. The server also enforces; this is UX.
      if (!FREE_TEXT_REGEX.test(trimmed)) {
        setError('validation');
        return;
      }
      startTransition(async () => {
        const result = await savePropAnswer({
          question_id: question.id,
          answer_type: question.answer_type, // 'single_player' | 'text'
          answer: trimmed,
        });
        if (result.ok) {
          setSavedAt(Date.now());
          setError(null);
          dirty.current = false;
        } else {
          setValue(initialAnswer ?? '');
          setError(result.error === 'locked' ? 'locked' : 'network');
          dirty.current = false;
        }
      });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [value, question.id, question.answer_type, initialAnswer]);

  return (
    <article className="bg-[var(--zc-card)] border border-[var(--zc-border)] rounded-2xl pi-4 pbs-4 pbe-4 mbs-4">
      <h3 className="text-base font-bold text-[var(--zc-primary)] mbe-3">
        {prompt}
      </h3>
      <div className="relative">
        <input
          type="text"
          inputMode="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          maxLength={maxLength}
          className="bs-12 is-full bg-white rounded-xl border border-[var(--zc-border)] ps-4 pe-4 text-base text-[var(--zc-primary)] focus-visible:outline-none focus-visible:border-[var(--zc-accent)] focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)]"
          aria-label={prompt}
        />
        {savedAt !== null && error === null && (
          <span
            className="absolute inset-be-0 inset-i-0 flex justify-end pe-2 pbe-2"
            key={savedAt}
          >
            <SavedIndicator />
          </span>
        )}
      </div>
      {error !== null && (
        <span
          className="block mbs-2 text-sm text-[var(--zc-destructive)]"
          role="alert"
        >
          {t(error === 'locked' ? 'lockedSaveFailed' : 'saveFailed')}
        </span>
      )}
    </article>
  );
}

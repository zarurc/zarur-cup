'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { savePropAnswer } from '@/app/actions/savePropAnswer';
import { SavedIndicator } from '@/components/ui/SavedIndicator.client';

const DEBOUNCE_MS = 600;

/**
 * Binary yes/no picker for `answer_type === 'yes_no'` prop questions.
 *
 * Mirrors FlagDropdown's save semantics:
 *  - tapping a button selects it (optimistic local state)
 *  - tapping the selected button deselects it (returns to "no answer")
 *  - tapping the other button swaps selection
 *  - 600ms debounced save via savePropAnswer Server Action
 *  - RLS-aware error revert (locked / network)
 *
 * The DB stores the literal string 'yes' or 'no'; locale-translated
 * labels render on top of that canonical value so the answer survives
 * locale switches without translation drift.
 */
export function YesNoToggle({
  questionId,
  initialAnswer,
}: {
  questionId: string;
  initialAnswer: string | null;
}) {
  const t = useTranslations('props');
  const [selected, setSelected] = useState<'yes' | 'no' | null>(
    initialAnswer === 'yes' || initialAnswer === 'no' ? initialAnswer : null,
  );
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<'locked' | 'network' | null>(null);
  const [, startTransition] = useTransition();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef<boolean>(false);

  const handleSelect = (next: 'yes' | 'no') => {
    dirty.current = true;
    setSelected((prev) => (prev === next ? null : next));
    setError(null);
  };

  useEffect(() => {
    if (!dirty.current || selected === null) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const captured = selected;
    debounceTimer.current = setTimeout(() => {
      startTransition(async () => {
        const result = await savePropAnswer({
          question_id: questionId,
          answer_type: 'yes_no',
          answer: captured,
        });
        if (result.ok) {
          setSavedAt(Date.now());
          setError(null);
          dirty.current = false;
        } else {
          setSelected(
            initialAnswer === 'yes' || initialAnswer === 'no'
              ? initialAnswer
              : null,
          );
          setError(result.error === 'locked' ? 'locked' : 'network');
          dirty.current = false;
        }
      });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [selected, questionId, initialAnswer]);

  const buttonCls = (isSelected: boolean, anySelected: boolean) =>
    `bs-12 flex-1 rounded-xl border border-[var(--zc-border)] bg-[var(--zc-card)] text-base font-bold transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)] ${
      isSelected
        ? 'ring-2 ring-[var(--zc-accent)] bg-[var(--zc-muted)] text-[var(--zc-primary)]'
        : anySelected
          ? 'opacity-60 text-[var(--zc-muted-foreground)]'
          : 'text-[var(--zc-primary)]'
    }`;

  const anySelected = selected !== null;

  return (
    <div className="relative">
      <div className="flex gap-3" role="radiogroup">
        <button
          type="button"
          role="radio"
          aria-checked={selected === 'yes'}
          onClick={() => handleSelect('yes')}
          className={buttonCls(selected === 'yes', anySelected)}
        >
          {t('yes')}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={selected === 'no'}
          onClick={() => handleSelect('no')}
          className={buttonCls(selected === 'no', anySelected)}
        >
          {t('no')}
        </button>
      </div>
      {savedAt !== null && error === null && (
        <span
          className="absolute inset-be-0 inset-i-0 flex justify-end mbs-2"
          key={savedAt}
        >
          <SavedIndicator />
        </span>
      )}
      {error !== null && (
        <span
          className="block mbs-2 text-sm text-[var(--zc-destructive)]"
          role="alert"
        >
          {t(error === 'locked' ? 'lockedSaveFailed' : 'saveFailed')}
        </span>
      )}
    </div>
  );
}

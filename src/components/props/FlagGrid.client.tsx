'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { savePropAnswer } from '@/app/actions/savePropAnswer';
import { SavedIndicator } from '@/components/ui/SavedIndicator.client';

const DEBOUNCE_MS = 600;

export type Team = { id: string; code: string; name_en: string; name_he: string };

/**
 * 6x8 flag grid for `single_team` prop answers (UI-SPEC §9).
 *
 * Tap-to-select radio behavior:
 *  - tapping an unselected cell selects it (the previously-selected cell
 *    dims to opacity-60 via the `anySelected ? 'opacity-60'` rule)
 *  - tapping the selected cell deselects it (returns to "no answer" state)
 *  - tapping a different cell swaps selection
 *
 * Selection mutates local state immediately (optimistic), then a 600ms
 * debounce timer fires `savePropAnswer` per Pattern 30 (mirror of
 * MatchRowStepper). On RLS 42501 we revert + show the inline locked-save
 * error; on network we revert + show the generic save-failed copy.
 *
 * NOTE: `answer_type: 'single_team'` is UNDERSCORED to match the live DB
 * CHECK constraint (0001_init.sql:138). The plan text used a dash; the
 * authoritative contract is propAnswerSchema (Plan 02-02).
 *
 * Team labels render via locale-aware Intl.Collator sort so HE-readers
 * see Hebrew alphabetical order per UI-SPEC "RTL Stress Points".
 *
 * The SavedIndicator re-keys on `savedAt` so a fresh save restarts the
 * pulse animation (Pattern 36 / SavedIndicator JSDoc).
 */
export function FlagGrid({
  questionId,
  locale,
  teams,
  initialAnswer,
}: {
  questionId: string;
  locale: 'he' | 'en';
  teams: Team[];
  initialAnswer: string | null;
}) {
  const t = useTranslations('props');
  const [selectedId, setSelectedId] = useState<string | null>(initialAnswer);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<'locked' | 'network' | null>(null);
  const [, startTransition] = useTransition();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef<boolean>(false);

  // Sort teams by locale-aware name (UI-SPEC "RTL Stress Points": flag
  // grid alphabetical by name_{locale}).
  const intlLocale = locale === 'he' ? 'he-IL' : 'en-US';
  const collator = new Intl.Collator(intlLocale, { sensitivity: 'base' });
  const sortedTeams = [...teams].sort((a, b) =>
    collator.compare(
      locale === 'he' ? a.name_he : a.name_en,
      locale === 'he' ? b.name_he : b.name_en,
    ),
  );

  const handleSelect = (teamId: string) => {
    dirty.current = true;
    setSelectedId((prev) => (prev === teamId ? null : teamId));
    setError(null);
  };

  // Debounced save: only fires when an actual selection is set. Deselect
  // (selectedId === null) does not write a NULL answer — the prior row
  // simply stays in prop_answers until the user picks a new team.
  useEffect(() => {
    if (!dirty.current || selectedId === null) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const captured = selectedId;
    debounceTimer.current = setTimeout(() => {
      startTransition(async () => {
        const result = await savePropAnswer({
          question_id: questionId,
          answer_type: 'single_team',
          answer: captured,
        });
        if (result.ok) {
          setSavedAt(Date.now());
          setError(null);
          dirty.current = false;
        } else {
          setSelectedId(initialAnswer);
          setError(result.error === 'locked' ? 'locked' : 'network');
          dirty.current = false;
        }
      });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [selectedId, questionId, initialAnswer]);

  return (
    <div className="relative">
      <div className="grid grid-cols-6 gap-2 pi-2" role="radiogroup">
        {sortedTeams.map((team) => {
          const isSelected = team.id === selectedId;
          const anySelected = selectedId !== null;
          return (
            <button
              key={team.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={locale === 'he' ? team.name_he : team.name_en}
              onClick={() => handleSelect(team.id)}
              className={`aspect-square bs-auto is-full rounded-xl border border-[var(--zc-border)] bg-[var(--zc-card)] flex flex-col items-center justify-center gap-1 ps-1 pe-1 pbs-1 pbe-1 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--zc-card)] ${
                isSelected
                  ? 'ring-2 ring-[var(--zc-accent)] ring-offset-2 ring-offset-[var(--zc-card)] bg-[var(--zc-muted)]'
                  : anySelected
                    ? 'opacity-60'
                    : ''
              }`}
            >
              <span className="text-2xl leading-none" aria-hidden>
                🏴
              </span>
              <span
                className={`text-sm truncate ${
                  isSelected
                    ? 'text-[var(--zc-primary)] font-bold'
                    : 'text-[var(--zc-muted-foreground)]'
                }`}
              >
                {locale === 'he' ? team.name_he : team.name_en}
              </span>
            </button>
          );
        })}
      </div>
      {savedAt !== null && error === null && (
        <span
          className="absolute inset-be-0 inset-i-0 flex justify-end"
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

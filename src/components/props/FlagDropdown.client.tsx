'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { savePropAnswer } from '@/app/actions/savePropAnswer';
import { SavedIndicator } from '@/components/ui/SavedIndicator.client';
import { fifaCodeToFlagEmoji, type Team } from '@/lib/teams/flags';

const DEBOUNCE_MS = 600;

/**
 * Single-team picker as a native <select> dropdown — UX A/B vs FlagGrid.
 * Mirrors FlagGrid's save semantics (600ms debounce, optimistic local
 * state, RLS-aware error revert).
 */
export function FlagDropdown({
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

  const intlLocale = locale === 'he' ? 'he-IL' : 'en-US';
  const collator = new Intl.Collator(intlLocale, { sensitivity: 'base' });
  const sortedTeams = [...teams].sort((a, b) =>
    collator.compare(
      locale === 'he' ? a.name_he : a.name_en,
      locale === 'he' ? b.name_he : b.name_en,
    ),
  );

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

  const selectedTeam = sortedTeams.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="relative">
      <label className="block">
        <span className="sr-only">{t('yourAnswerLabel')}</span>
        <div className="relative">
          {selectedTeam && (
            <span
              className="absolute inset-bs-1/2 inset-is-3 -translate-y-1/2 text-2xl leading-none pointer-events-none"
              aria-hidden
            >
              {fifaCodeToFlagEmoji(selectedTeam.code)}
            </span>
          )}
          <select
            value={selectedId ?? ''}
            onChange={(e) => {
              dirty.current = true;
              setSelectedId(e.target.value || null);
              setError(null);
            }}
            className={`is-full bs-12 ps-12 pe-3 rounded-xl border border-[var(--zc-border)] bg-[var(--zc-card)] text-base text-[var(--zc-primary)] truncate appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)] ${
              selectedTeam ? '' : 'ps-3'
            }`}
          >
            <option value="">{`— ${t('yourAnswerLabel')} —`}</option>
            {sortedTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {fifaCodeToFlagEmoji(team.code)}{' '}
                {locale === 'he' ? team.name_he : team.name_en}
              </option>
            ))}
          </select>
        </div>
      </label>
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

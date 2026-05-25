'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { savePrediction } from '@/app/actions/savePrediction';
import { SavedIndicator } from '@/components/ui/SavedIndicator.client';

const DEBOUNCE_MS = 600;
const LONG_PRESS_INITIAL_MS = 400;
const LONG_PRESS_REPEAT_MS = 150;
const MIN_SCORE = 0;
const MAX_SCORE = 9;

type Props = {
  fixtureId: string;
  initialHome: number | null;
  initialAway: number | null;
};

/**
 * Editable score stepper per UI-SPEC §1.
 *
 * Local state mutates immediately on tap (optimistic); a 600ms debounce
 * coalesces rapid clicks into a single Server Action call. Successful
 * saves re-key SavedIndicator so its 2s pulse restarts. Failed saves
 * revert the local state and surface inline error copy.
 *
 * Long-press: 400ms initial delay, then 150ms repeat. Clamped to
 * [0, 9] per D-04. Buttons disable at the clamp edges so the user
 * gets immediate visual feedback that they've hit the bound.
 *
 * Score values render inside <span dir="ltr"> so HE doesn't visually
 * reverse digits (Pattern G / Pitfall 7).
 */
export function MatchRowStepper({
  fixtureId,
  initialHome,
  initialAway,
}: Props) {
  const tPrediction = useTranslations('prediction');
  const [home, setHome] = useState<number>(initialHome ?? 0);
  const [away, setAway] = useState<number>(initialAway ?? 0);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<'locked' | 'network' | null>(null);
  const [, startTransition] = useTransition();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const dirty = useRef<boolean>(false);

  const clamp = (n: number) => Math.max(MIN_SCORE, Math.min(MAX_SCORE, n));
  const bump = (side: 'home' | 'away', delta: 1 | -1) => {
    dirty.current = true;
    if (side === 'home') setHome((v) => clamp(v + delta));
    else setAway((v) => clamp(v + delta));
    setError(null);
  };

  // Debounced save effect. Re-runs whenever home/away changes; the timer
  // is cleared on every change so only the LAST change after 600ms idle
  // actually fires the Server Action.
  useEffect(() => {
    if (!dirty.current) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      startTransition(async () => {
        const result = await savePrediction({
          fixture_id: fixtureId,
          home_score: home,
          away_score: away,
        });
        if (result.ok) {
          setSavedAt(Date.now());
          setError(null);
          dirty.current = false;
        } else if (result.error === 'validation' || result.error === 'unauthenticated') {
          // Should never happen in normal use; treat as network for UX simplicity.
          setHome(initialHome ?? 0);
          setAway(initialAway ?? 0);
          setError('network');
          dirty.current = false;
        } else {
          setHome(initialHome ?? 0);
          setAway(initialAway ?? 0);
          setError(result.error);
          dirty.current = false;
        }
      });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [home, away, fixtureId, initialHome, initialAway]);

  // Long-press handlers (cancel-on-leave so a drag-off-the-button stops
  // repeating, matching native iOS/Android steppers).
  const startLongPress = (side: 'home' | 'away', delta: 1 | -1) => {
    longPressTimer.current = setTimeout(() => {
      repeatTimer.current = setInterval(
        () => bump(side, delta),
        LONG_PRESS_REPEAT_MS,
      );
    }, LONG_PRESS_INITIAL_MS);
  };
  const endLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (repeatTimer.current) clearInterval(repeatTimer.current);
    longPressTimer.current = null;
    repeatTimer.current = null;
  };

  const btnClass =
    'bs-11 is-11 inline-flex items-center justify-center rounded-xl border border-[var(--zc-border)] bg-[var(--zc-card)] text-xl font-bold text-[var(--zc-primary)] active:bg-[var(--zc-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--zc-card)] disabled:opacity-40 disabled:pointer-events-none';

  // Explicit testid literals (Plan 02-08 Task 0 contract — keep the literal
  // tokens `stepper-home-plus-`, `stepper-away-plus-`, `stepper-home-minus-`,
  // `stepper-away-minus-` grep-able in source for the smoke selector audit).
  const testIdMinus = (side: 'home' | 'away') =>
    side === 'home'
      ? `stepper-home-minus-${fixtureId}`
      : `stepper-away-minus-${fixtureId}`;
  const testIdPlus = (side: 'home' | 'away') =>
    side === 'home'
      ? `stepper-home-plus-${fixtureId}`
      : `stepper-away-plus-${fixtureId}`;

  const renderStepper = (
    side: 'home' | 'away',
    value: number,
    setter: (n: number) => void,
  ) => (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        data-testid={testIdMinus(side)}
        className={btnClass}
        aria-label={side === 'home' ? '−1 home' : '−1 away'}
        disabled={value <= MIN_SCORE}
        onClick={() => bump(side, -1)}
        onMouseDown={() => startLongPress(side, -1)}
        onMouseUp={endLongPress}
        onMouseLeave={endLongPress}
        onTouchStart={() => startLongPress(side, -1)}
        onTouchEnd={endLongPress}
      >
        −
      </button>
      <span
        dir="ltr"
        className="bs-11 min-is-8 inline-flex items-center justify-center text-2xl font-bold text-[var(--zc-primary)] tabular-nums"
      >
        {value}
      </span>
      <button
        type="button"
        data-testid={testIdPlus(side)}
        className={btnClass}
        aria-label={side === 'home' ? '+1 home' : '+1 away'}
        disabled={value >= MAX_SCORE}
        onClick={() => bump(side, 1)}
        onMouseDown={() => startLongPress(side, 1)}
        onMouseUp={endLongPress}
        onMouseLeave={endLongPress}
        onTouchStart={() => startLongPress(side, 1)}
        onTouchEnd={endLongPress}
      >
        +
      </button>
      {/* a11y-hidden native number input lets screen readers + keyboard
          users edit by typing; UI-SPEC §1 mandates the dual-input surface. */}
      <input
        type="number"
        inputMode="numeric"
        min={MIN_SCORE}
        max={MAX_SCORE}
        dir="ltr"
        className="sr-only"
        value={value}
        onChange={(e) => setter(clamp(parseInt(e.target.value, 10) || 0))}
        aria-label={side === 'home' ? 'home score' : 'away score'}
      />
    </div>
  );

  return (
    <div className="inline-flex items-center gap-2 relative">
      {renderStepper('home', home, setHome)}
      <span className="text-2xl text-[var(--zc-muted-foreground)]">:</span>
      {renderStepper('away', away, setAway)}
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
          className="absolute inset-be-0 inset-i-0 flex justify-end text-sm text-[var(--zc-destructive)]"
          role="alert"
        >
          {tPrediction(error === 'locked' ? 'lockedSaveFailed' : 'saveFailed')}
        </span>
      )}
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { saveResult } from '@/app/actions/saveResult';

/**
 * Two number inputs + Save Result button per UI-SPEC §12 + ADM-01/02.
 *
 * Explicit save (no debounce — admin save is an intentional confirmation
 * moment, deliberately asymmetric with the player stepper's debounce).
 *
 * Local state transitions:
 *   idle    → user types → state stays idle (typing doesn't fire save)
 *   idle    → click Save → 'saving' (button disabled, label = "Saving…")
 *   saving  → ok=true    → 'saved' (label = "Saved ✓"), auto-revert to idle after 2s
 *   saving  → ok=false   → 'failed' (label resets to idle copy + inline error appears)
 *   failed  → click Save → 'saving' (error message clears immediately)
 *
 * `useTransition` keeps the click non-blocking so React 19's Action queue
 * naturally serializes successive clicks on the SAME row (rapid-double-
 * click → second waits for first; both converge to last-writer-wins per
 * T-02-05-07).
 *
 * The inputs are wrapped in `dir="ltr"` so digits enter LTR even on RTL
 * pages (admin is EN-only but defense in depth + matches the player
 * stepper's bidi posture).
 *
 * Validation happens server-side via `resultSchema.safeParse` — the
 * client `min={0} max={9}` is UX-only (T-02-05-02).
 */
type Props = {
  fixtureId: string;
  initialHome: number | null;
  initialAway: number | null;
};

type LocalState = 'idle' | 'saving' | 'saved' | 'failed';

export function AdminResultInputs({ fixtureId, initialHome, initialAway }: Props) {
  const t = useTranslations('admin.saveResult');
  const [home, setHome] = useState<string>(
    initialHome !== null ? String(initialHome) : '',
  );
  const [away, setAway] = useState<string>(
    initialAway !== null ? String(initialAway) : '',
  );
  const [state, setState] = useState<LocalState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    setState('saving');
    setErrorMsg(null);
    startTransition(async () => {
      const result = await saveResult({
        fixture_id: fixtureId,
        result_home_90min: parseInt(home, 10),
        result_away_90min: parseInt(away, 10),
      });
      if (result.ok) {
        setState('saved');
        // Auto-revert to idle after the "Saved ✓" pulse.
        setTimeout(() => setState('idle'), 2000);
      } else {
        setState('failed');
        setErrorMsg(result.error);
      }
    });
  };

  const buttonLabel =
    state === 'saving'
      ? t('saving')
      : state === 'saved'
        ? t('saved')
        : t('idle');

  const inputClass =
    'bs-12 is-12 text-center text-2xl font-bold rounded-xl border border-[var(--zc-border)] focus-visible:outline-none focus-visible:border-[var(--zc-accent)] focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)] tabular-nums';

  const disabled = isPending || home === '' || away === '';

  return (
    <div className="inline-flex items-center gap-2">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={9}
        dir="ltr"
        value={home}
        onChange={(e) => setHome(e.target.value)}
        className={inputClass}
        aria-label="home score result"
      />
      <span
        dir="ltr"
        className="text-2xl text-[var(--zc-muted-foreground)]"
        aria-hidden
      >
        :
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={9}
        dir="ltr"
        value={away}
        onChange={(e) => setAway(e.target.value)}
        className={inputClass}
        aria-label="away score result"
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={disabled}
        aria-busy={isPending}
        className="bs-12 ps-4 pe-4 rounded-xl bg-[var(--zc-primary)] text-[var(--zc-primary-foreground)] font-bold hover:bg-[#13325a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--zc-card)] disabled:opacity-60"
      >
        {buttonLabel}
      </button>
      {state === 'failed' && (
        <span
          className="ms-2 text-sm text-[var(--zc-destructive)]"
          role="alert"
        >
          {t('failed')}
          {errorMsg ? ` (${errorMsg})` : ''}
        </span>
      )}
    </div>
  );
}

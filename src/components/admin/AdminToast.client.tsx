'use client';

import { useEffect, useState } from 'react';

const DISMISS_MS = 4000;

/**
 * One-shot admin save-feedback banner (#10 Wave 1 — C3).
 *
 * Server pages read their mutation redirect query params (`?saved=1`,
 * `?graded=<id>`, `?resolved=<placeholder>`, `?merged=1`, `?error=<msg>`)
 * and pass a resolved `tone` + `message` to this client component. The
 * banner auto-dismisses after DISMISS_MS or on click. Re-mount per
 * navigation via the keyed-by-message pattern in the parent (the server
 * page re-renders every navigation so the toast component gets a fresh
 * mount + fresh timer).
 *
 * Why client: needs a setTimeout for auto-dismiss + interactive close.
 * Stays small / non-blocking — no Suspense or transition.
 */
export function AdminToast({
  tone,
  message,
}: {
  tone: 'success' | 'error';
  message: string;
}) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const i = setTimeout(() => setOpen(false), DISMISS_MS);
    return () => clearTimeout(i);
  }, []);

  if (!open) return null;

  const bg =
    tone === 'success'
      ? 'bg-[var(--zc-integrity-ok)] text-white'
      : 'bg-[var(--zc-destructive)] text-white';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mbs-3 mbe-3 pi-4 pbs-3 pbe-3 rounded-2xl font-bold text-sm flex items-center justify-between gap-3 ${bg}`}
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Dismiss"
        className="text-base opacity-80 hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}

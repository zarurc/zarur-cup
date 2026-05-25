'use client';

import { useTranslations } from 'next-intl';

/**
 * Transient "✓ Saved" indicator (UI-SPEC §10).
 *
 * Animation is driven by the `.zc-saved-indicator` class on globals.css:
 * 2000ms total — 150ms fade-in, 1400ms hold, 450ms fade-out. Honors
 * prefers-reduced-motion via steps() fallback.
 *
 * Mount via `key={lastSavedAt}` on the parent so a fresh save re-keys
 * (re-mounts) the element and restarts the animation from 0.
 */
export function SavedIndicator() {
  const t = useTranslations('prediction');
  return (
    <span
      className="zc-saved-indicator inline-flex items-center gap-1 text-sm text-[var(--zc-accent)]"
      role="status"
      aria-live="polite"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path
          d="M3 8.5L6.5 12 13 4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {t('saved')}
    </span>
  );
}

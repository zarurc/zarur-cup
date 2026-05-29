'use client';

import { useEffect } from 'react';

/**
 * Tiny boot-time helper that reads the browser's resolved time zone via
 * `Intl.DateTimeFormat().resolvedOptions().timeZone` and stashes it in a
 * cookie (`zc-tz`). Server components read that cookie on subsequent
 * requests to group the matches feed by the viewer's local date instead
 * of the server's UTC date (Vercel default).
 *
 * No UI; renders nothing. Idempotent — re-setting the same value each
 * mount is fine.
 *
 * Caveats:
 *   - First-ever request has no cookie. Server falls back to a
 *     locale-based default (he → Asia/Jerusalem, en → America/Los_Angeles)
 *     so most users see correct headers even before this script runs.
 *   - The cookie is set client-side and applies to the NEXT request, not
 *     the one that rendered the page. Reload-once behavior on cold visits
 *     is by design — see groupByLocalDate consumers for the fallback.
 */
export function TimeZoneSync() {
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && /^[A-Za-z0-9_./+-]+$/.test(tz)) {
        document.cookie = `zc-tz=${tz}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      }
    } catch {
      // Old browsers without Intl support — silently skip. Server falls
      // back to the locale-based default.
    }
  }, []);
  return null;
}

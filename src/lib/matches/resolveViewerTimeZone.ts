import 'server-only';
import { cookies } from 'next/headers';

const TZ_COOKIE = 'zc-tz';
// IANA TZ shape: alphanumerics, slashes, underscores, dots, plus/minus, hyphens.
// Defensive regex — cookie value comes from the client.
const SAFE_TZ_REGEX = /^[A-Za-z0-9_./+-]{1,64}$/;

/**
 * Resolve the viewer's time zone for server-side date formatting.
 *
 * Layered resolution:
 *   1. `zc-tz` cookie set by <TimeZoneSync /> on first client-side
 *      hydration (passes `Intl.DateTimeFormat().resolvedOptions().timeZone`).
 *   2. Locale-based default — `he` ⇒ Asia/Jerusalem, `en` ⇒
 *      America/Los_Angeles (host-country anchor, latest US/Canada/Mexico
 *      venue TZ — keeps tournament-day grouping consistent for users
 *      without the cookie yet).
 *   3. (Implicit) `undefined` → consumer falls back to its own default.
 *
 * Used by /matches and /admin/matches to pass `tz` to groupByLocalDate
 * so date-group headers reflect what the viewer's clock would say.
 */
export async function resolveViewerTimeZone(
  locale: 'he' | 'en',
): Promise<string> {
  const raw = (await cookies()).get(TZ_COOKIE)?.value;
  if (raw && SAFE_TZ_REGEX.test(raw)) {
    return raw;
  }
  return locale === 'he' ? 'Asia/Jerusalem' : 'America/Los_Angeles';
}

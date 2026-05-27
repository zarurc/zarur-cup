import { redirect } from 'next/navigation';

type Props = { params: Promise<{ locale: string }> };

/**
 * Legacy route — props relocated to /[locale]/me/props per D-37 + D-38
 * (Plan 02-10 scope expansion).
 *
 * CR-02 fix (2026-05-27): uses `redirect()` (307 temporary) instead of
 * `permanentRedirect()` (308). v1 is iterating fast; a permanent redirect
 * gets cached by browsers and proxies, making recovery painful if we
 * need to change the canonical surface again. Upgrade to permanentRedirect
 * post-tournament once routing is stable.
 *
 * The canonical surface is `/[locale]/me/props` — strictly private,
 * own-answers-only, both pre-lock (editable) and post-lock (read-only
 * receipt). See `src/app/[locale]/me/props/page.tsx` for the implementation.
 */
export default async function PropsLegacyRedirect({ params }: Props) {
  const { locale } = await params;
  const safeLocale = locale === 'he' ? 'he' : 'en';
  redirect(`/${safeLocale}/me/props`);
}

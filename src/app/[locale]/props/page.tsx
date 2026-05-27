import { permanentRedirect } from 'next/navigation';

type Props = { params: Promise<{ locale: string }> };

/**
 * Legacy route — props relocated to /[locale]/me/props per D-37 + D-38
 * (Plan 02-10 scope expansion). 308 permanent redirect preserves the
 * verb on POST (irrelevant here since this page only ever served GET).
 *
 * The new canonical surface is `/[locale]/me/props` — strictly private,
 * own-answers-only, both pre-lock (editable) and post-lock (read-only
 * receipt). See `src/app/[locale]/me/props/page.tsx` for the implementation.
 */
export default async function PropsLegacyRedirect({ params }: Props) {
  const { locale } = await params;
  const safeLocale = locale === 'he' ? 'he' : 'en';
  permanentRedirect(`/${safeLocale}/me/props`);
}

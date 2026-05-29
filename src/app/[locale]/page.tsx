import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { getCurrentMember } from '@/lib/auth/session';

type Props = { params: Promise<{ locale: string }> };

/**
 * /[locale] home: server-side fork.
 *   - Signed-out                    -> /[locale]/join
 *   - Signed-in, welcome unseen     -> /[locale]/welcome (first-time onboarding)
 *   - Signed-in, welcome dismissed  -> /[locale]/matches (Phase 1 tab default)
 */
export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const member = await getCurrentMember();
  if (!member) redirect(`/${locale}/join` as Route);
  if (!member.welcome_seen_at) redirect(`/${locale}/welcome` as Route);
  redirect(`/${locale}/matches` as Route);
}

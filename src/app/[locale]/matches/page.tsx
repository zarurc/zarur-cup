import { setRequestLocale, getTranslations } from 'next-intl/server';
import { requireMember } from '@/lib/auth/session';
import { EmptyStateCard } from '@/components/layout/EmptyStateCard';

type Props = { params: Promise<{ locale: string }> };

export default async function MatchesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireMember(locale);
  const t = await getTranslations('empty.matches');
  return <EmptyStateCard heading={t('heading')} body={t('body')} />;
}

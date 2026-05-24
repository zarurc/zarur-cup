import { setRequestLocale } from 'next-intl/server';
import { useTranslations } from 'next-intl';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HomePageContent />;
}

function HomePageContent() {
  const t = useTranslations('home');
  return (
    <main className="pbs-12 pbe-12 ps-4 pe-4">
      <h1 className="text-3xl font-bold text-[--zc-primary]">
        {t('placeholder')}
      </h1>
    </main>
  );
}

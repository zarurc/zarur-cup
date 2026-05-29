import { adminReadClient } from '@/lib/auth/adminReadClient';
import { getTranslations } from 'next-intl/server';
import { PlaceholderResolver } from '@/components/admin/PlaceholderResolver.client';
import { AdminToast } from '@/components/admin/AdminToast.client';
import { resolveAdminToast } from '@/lib/admin/toast';

/**
 * /admin/tournament-tree — placeholder resolver page (ADM-03 + D-11).
 *
 * Reads the distinct unresolved placeholder tokens from
 * fixtures.home_placeholder + away_placeholder (NULL once resolved by
 * the Server Action). Renders one PlaceholderResolver client form per
 * distinct token. Each form takes a team_id and updates every fixture
 * + bracket_slot that references the placeholder.
 *
 * Unlocalized per Phase 1 D-05 — no [locale] segment, no setRequestLocale.
 * Uses next-intl's getTranslations() because next-intl resolves the
 * locale from the cookie/middleware; admin's profiles.locale is whatever
 * they have, but the dictionary lookup only has EN admin keys per D-05.
 *
 * NO requireAdmin() call — parent layout enforces (D-06).
 * Reads use adminReadClient (Pitfall 10) — service-role so the distinct
 * placeholder collection reflects the live DB regardless of RLS.
 */
type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TournamentTreePage({ searchParams }: PageProps) {
  const t = await getTranslations('admin.tree');
  const svc = await adminReadClient();
  const toast = resolveAdminToast(await searchParams);

  // 1. Collect distinct unresolved placeholders.
  const { data: fxs } = await svc
    .from('fixtures')
    .select('home_placeholder, away_placeholder');
  const set = new Set<string>();
  for (const f of fxs ?? []) {
    if (f.home_placeholder) set.add(f.home_placeholder);
    if (f.away_placeholder) set.add(f.away_placeholder);
  }
  const placeholders = Array.from(set).sort();

  // 2. Full team roster for the picker dropdown.
  const { data: teams } = await svc
    .from('teams')
    .select('id, code, name_en')
    .order('code', { ascending: true });

  // W2-T1: group placeholders by tournament stage so the long flat list
  // becomes a scannable hierarchy. Bracket placeholder tokens follow a
  // stable naming convention (WINNER_GROUP_*, R32_M*_W, etc.) — we route
  // each token to a stage bucket by prefix and render one section per
  // non-empty bucket in tournament order.
  type Stage = {
    key: 'groups' | 'r32' | 'r16' | 'qf' | 'sf';
    label: string;
    tokens: string[];
  };
  const stages: Stage[] = [
    { key: 'groups', label: 'Group stage', tokens: [] },
    { key: 'r32', label: 'Round of 32', tokens: [] },
    { key: 'r16', label: 'Round of 16', tokens: [] },
    { key: 'qf', label: 'Quarterfinals', tokens: [] },
    { key: 'sf', label: 'Semifinals', tokens: [] },
  ];
  const stageByKey = new Map(stages.map((s) => [s.key, s]));
  for (const p of placeholders) {
    let key: Stage['key'] = 'groups';
    if (p.startsWith('R32_')) key = 'r32';
    else if (p.startsWith('R16_')) key = 'r16';
    else if (p.startsWith('QF_')) key = 'qf';
    else if (p.startsWith('SF_')) key = 'sf';
    stageByKey.get(key)!.tokens.push(p);
  }

  return (
    <main className="pi-4 pbs-4 pbe-24">
      {toast && (
        <AdminToast
          key={`${toast.tone}:${toast.message}`}
          tone={toast.tone}
          message={toast.message}
        />
      )}
      <div className="flex items-baseline justify-between gap-3 mbs-2 mbe-4">
        <h1 className="text-xl font-bold">{t('heading')}</h1>
        <span
          dir="ltr"
          className="text-sm font-bold tabular-nums text-[var(--zc-muted-foreground)]"
        >
          {placeholders.length} unresolved
        </span>
      </div>
      {placeholders.length === 0 ? (
        <p className="text-base text-[var(--zc-muted-foreground)]">
          {t('noPlaceholders')}
        </p>
      ) : (
        stages
          .filter((s) => s.tokens.length > 0)
          .map((s) => (
            <section key={s.key} className="mbs-5">
              <h2 className="text-sm font-bold text-[var(--zc-muted-foreground)] uppercase tracking-wide mbe-2 flex items-center gap-2">
                <span>{s.label}</span>
                <span dir="ltr" className="tabular-nums">
                  · {s.tokens.length}
                </span>
              </h2>
              <ul>
                {s.tokens.map((p) => (
                  <li key={p} className="border-b border-[var(--zc-border)]">
                    <PlaceholderResolver placeholder={p} teams={teams ?? []} />
                  </li>
                ))}
              </ul>
            </section>
          ))
      )}
    </main>
  );
}

import { adminReadClient } from '@/lib/auth/adminReadClient';
import { groupByLocalDate } from '@/lib/matches/groupByLocalDate';
import { DateGroupHeader } from '@/components/matches/DateGroupHeader';
import { MatchRowLocked } from '@/components/matches/MatchRowLocked';
import { MatchRowResulted } from '@/components/matches/MatchRowResulted';
import { AdminModeToggle } from '@/components/admin/AdminModeToggle.client';
import { AdminResultInputs } from '@/components/admin/AdminResultInputs.client';
import { codeToFlag } from '@/lib/teams/codeToFlag';
import type { PtsKind } from '@/components/ui/PtsBadge';

/**
 * Admin matches feed per UI-SPEC §11/12, D-09/10, ADM-01/02.
 *
 * /admin/matches is UNLOCALIZED (Phase 1 D-05) — no `[locale]` segment,
 * no `setRequestLocale`, no `getTranslations` at the page level. Shared
 * presentational components (MatchRowLocked, MatchRowResulted) use
 * next-intl translations internally; we pass them `locale="en"` so the
 * resolved strings are EN.
 *
 * URL state: `?mode=view` (default) or `?mode=entry`. View Mode mirrors
 * the player /matches feed (locked / resulted / not-yet-kicked-off
 * variants — read-only). Entry Mode replaces each row's center cluster
 * with two number inputs + Save Result button on EVERY row regardless of
 * status (D-10: direct overwrite is the correction UX).
 *
 * Pitfall 10 (T-02-05-03): `adminReadClient()` is service-role so the
 * SELECT sees every member's predictions, not just the admin's. Using
 * `createClient()` (anon JWT) here would silently break the integrity
 * widget and the post-result reveal because RLS would filter the embed
 * down to the admin's own row.
 *
 * D-12: this page reads `result_home_90min` / `result_away_90min` only.
 * It NEVER reads or writes the `_full` columns (those ship in 0009 but
 * stay NULL until Phase 3 adds ET admin UI).
 */

type Props = { searchParams: Promise<{ mode?: string }> };

type TeamEmbed = {
  id: string;
  code: string;
  name_en: string;
  name_he: string;
};
type PredictionEmbed = {
  user_id: string;
  home_score: number;
  away_score: number;
  submitted_at: string;
};
type NormalizedFixture = {
  id: string;
  external_match_no: number;
  stage: string;
  group_code: string | null;
  kickoff_at: string;
  home_placeholder: string | null;
  away_placeholder: string | null;
  result_home_90min: number | null;
  result_away_90min: number | null;
  home_team: TeamEmbed | null;
  away_team: TeamEmbed | null;
  predictions: PredictionEmbed[];
};

export default async function AdminMatchesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const mode: 'view' | 'entry' = sp.mode === 'entry' ? 'entry' : 'view';

  // requireAdmin() already enforced by /admin/(protected)/layout.tsx.
  // adminReadClient() composes the gate + a service-role client so the
  // admin sees EVERY prediction (Pitfall 10 — never createClient() here).
  const svc = await adminReadClient();

  // Single read of fixtures + nested FK embeds + RLS-bypassed predictions
  // ORDER BY kickoff_at ASC so groupByLocalDate keeps chronological order.
  const { data: fixtures } = await svc
    .from('fixtures')
    .select(
      `
      id, external_match_no, stage, group_code, kickoff_at,
      home_placeholder, away_placeholder,
      result_home_90min, result_away_90min,
      home_team:teams!fixtures_home_team_id_fkey ( id, code, name_en, name_he ),
      away_team:teams!fixtures_away_team_id_fkey ( id, code, name_en, name_he ),
      predictions ( user_id, home_score, away_score, submitted_at )
    `,
    )
    .order('kickoff_at', { ascending: true });

  if (!fixtures || fixtures.length === 0) {
    return (
      <main className="pi-4 pbs-4">
        <p className="text-base text-[var(--zc-muted-foreground)]">
          No matches yet — check the seed migration.
        </p>
      </main>
    );
  }

  // Normalize PostgREST single-FK embed widening (T[] → T | null). Same
  // pattern as the player /matches page (Plan 02-03 Pattern 32).
  const normalized: NormalizedFixture[] = (
    fixtures as unknown as Array<{
      id: string;
      external_match_no: number;
      stage: string;
      group_code: string | null;
      kickoff_at: string;
      home_placeholder: string | null;
      away_placeholder: string | null;
      result_home_90min: number | null;
      result_away_90min: number | null;
      home_team: TeamEmbed | TeamEmbed[] | null;
      away_team: TeamEmbed | TeamEmbed[] | null;
      predictions: PredictionEmbed[] | null;
    }>
  ).map((row) => ({
    id: row.id,
    external_match_no: row.external_match_no,
    stage: row.stage,
    group_code: row.group_code,
    kickoff_at: row.kickoff_at,
    home_placeholder: row.home_placeholder,
    away_placeholder: row.away_placeholder,
    result_home_90min: row.result_home_90min,
    result_away_90min: row.result_away_90min,
    home_team: Array.isArray(row.home_team)
      ? (row.home_team[0] ?? null)
      : row.home_team,
    away_team: Array.isArray(row.away_team)
      ? (row.away_team[0] ?? null)
      : row.away_team,
    predictions: row.predictions ?? [],
  }));

  // Separate score_events query (mirrors player matches page). Service-role
  // sees everyone's events. Map keyed by `${fixtureId}:${userId}` for O(1)
  // per-row lookup inside the per-player reveal block.
  const fixtureIds = normalized.map((f) => f.id);
  const { data: scoreEventsData } = await svc
    .from('score_events')
    .select('user_id, ref_id, points, kind')
    .eq('source', 'league')
    .in('ref_id', fixtureIds);
  const scoreByKey = new Map<
    string,
    { points: number; kind: PtsKind | null }
  >();
  for (const se of scoreEventsData ?? []) {
    scoreByKey.set(`${se.ref_id}:${se.user_id}`, {
      points: se.points,
      kind: se.kind as PtsKind | null,
    });
  }

  // Full family roster — used in resulted variant so non-predictors render
  // as em-dash + +0 rather than being dropped (parity with player feed).
  const { data: allProfiles } = await svc
    .from('profiles')
    .select('user_id, display_name');
  const roster = allProfiles ?? [];

  const now = Date.now();
  const groups = groupByLocalDate(normalized, 'en');

  return (
    <main className="pi-4 pbs-4 pbe-24">
      <div className="mbe-4">
        <AdminModeToggle />
      </div>
      {groups.map(([dateLabel, fxs]) => (
        <section key={dateLabel}>
          <DateGroupHeader label={dateLabel} />
          {fxs.map((f) => {
            const kickoffMs = new Date(f.kickoff_at).getTime();
            const isLocked = kickoffMs <= now;
            const isResulted =
              f.result_home_90min !== null && f.result_away_90min !== null;
            const homeTeam = f.home_team ?? {
              id: '?',
              code: '?',
              name_en: f.home_placeholder ?? '?',
              name_he: f.home_placeholder ?? '?',
            };
            const awayTeam = f.away_team ?? {
              id: '?',
              code: '?',
              name_en: f.away_placeholder ?? '?',
              name_he: f.away_placeholder ?? '?',
            };

            // Entry Mode: inputs on EVERY row (D-10 — overwrite-to-correct).
            if (mode === 'entry') {
              return (
                <div
                  key={f.id}
                  className="bg-[var(--zc-card)] border border-[var(--zc-border)] rounded-2xl pi-4 pbs-3 pbe-3 mbs-3 min-bs-16 flex items-center gap-4"
                >
                  <div className="flex items-center gap-2 min-is-0 flex-1">
                    <span className="text-xl" aria-hidden>
                      {codeToFlag(homeTeam.code)}
                    </span>
                    <span className="text-base truncate">{homeTeam.name_en}</span>
                  </div>
                  <AdminResultInputs
                    fixtureId={f.id}
                    initialHome={f.result_home_90min}
                    initialAway={f.result_away_90min}
                  />
                  <div className="flex items-center gap-2 min-is-0 flex-1 justify-end">
                    <span className="text-base truncate text-end">
                      {awayTeam.name_en}
                    </span>
                    <span className="text-xl" aria-hidden>
                      {codeToFlag(awayTeam.code)}
                    </span>
                  </div>
                </div>
              );
            }

            // View Mode: read-only variants matching the player feed.
            if (isResulted) {
              const picks = roster.map((profile) => {
                const pred = f.predictions.find(
                  (p) => p.user_id === profile.user_id,
                );
                const score = scoreByKey.get(`${f.id}:${profile.user_id}`);
                return {
                  user_id: profile.user_id,
                  display_name: profile.display_name,
                  home_score: pred?.home_score ?? null,
                  away_score: pred?.away_score ?? null,
                  points: score?.points ?? 0,
                  kind: (score?.kind ?? null) as PtsKind | null,
                };
              });
              return (
                <MatchRowResulted
                  key={f.id}
                  fixtureId={f.id}
                  locale="en"
                  homeTeam={homeTeam}
                  awayTeam={awayTeam}
                  kickoffAt={f.kickoff_at}
                  resultHome={f.result_home_90min!}
                  resultAway={f.result_away_90min!}
                  picks={picks}
                />
              );
            }

            if (isLocked) {
              return (
                <MatchRowLocked
                  key={f.id}
                  fixtureId={f.id}
                  locale="en"
                  homeTeam={homeTeam}
                  awayTeam={awayTeam}
                  kickoffAt={f.kickoff_at}
                  userHome={null}
                  userAway={null}
                />
              );
            }

            // Pre-kickoff in View Mode: read-only "not yet kicked off"
            // placeholder. The admin must flip to Entry Mode to score
            // (or to enter pre-kickoff results for past tournaments — not
            // a Phase 2 path, but the input shape supports it).
            return (
              <div
                key={f.id}
                className="bg-[var(--zc-card)] border border-[var(--zc-border)] rounded-2xl pi-4 pbs-3 pbe-3 mbs-3 min-bs-16 flex items-center gap-4"
              >
                <div className="flex items-center gap-2 min-is-0 flex-1">
                  <span className="text-xl" aria-hidden>
                    🏴
                  </span>
                  <span className="text-base truncate">{homeTeam.name_en}</span>
                </div>
                <span className="text-sm text-[var(--zc-muted-foreground)]">
                  Not yet kicked off
                </span>
                <div className="flex items-center gap-2 min-is-0 flex-1 justify-end">
                  <span className="text-base truncate text-end">
                    {awayTeam.name_en}
                  </span>
                  <span className="text-xl" aria-hidden>
                    🏴
                  </span>
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </main>
  );
}

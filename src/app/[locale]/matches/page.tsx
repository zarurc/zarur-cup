import { setRequestLocale, getTranslations } from 'next-intl/server';
import { requireMember } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { groupByLocalDate } from '@/lib/matches/groupByLocalDate';
import {
  CountdownBanner,
  type UpcomingFixture,
} from '@/components/matches/CountdownBanner.client';
import { DateGroupHeader } from '@/components/matches/DateGroupHeader';
import { MatchRow } from '@/components/matches/MatchRow.client';
import { MatchRowLocked } from '@/components/matches/MatchRowLocked';
import { MatchRowResulted } from '@/components/matches/MatchRowResulted';
import { EmptyStateCard } from '@/components/layout/EmptyStateCard';
import type { PtsKind } from '@/components/ui/PtsBadge';

type Props = { params: Promise<{ locale: string }> };

/**
 * Player-facing matches feed (LGE-01..05, VIS-01/02/05, SCR-07).
 *
 * Three-variant row chooser:
 *   - resulted (result_home_90min IS NOT NULL) → side-by-side reveal
 *   - locked   (kickoff_at <= now AND NOT resulted) → score capsule + 🔒
 *   - editable (kickoff_at > now AND NOT resulted) → ± stepper
 *
 * VARIANT KEYING (Pitfall 2): we key on `result_home_90min IS NOT NULL`,
 * NOT on `predictions.length`. Embedded predictions are RLS-filtered so the
 * length doesn't reflect ground truth.
 *
 * The layout's <main pbs-14> already provides the 56px header offset.
 * When the countdown banner is mounted, page content needs an additional
 * 40px (banner height) → mbs-10. Otherwise no extra offset → mbs-0. The
 * plan's original `mbs-24 / mbs-14` skeleton predated the layout's <main>;
 * this is a Rule 1 bug fix — see SUMMARY for the deviation note.
 *
 * RLS continues to be the canonical write lock (D-08); this page is the
 * read surface that shows the player what RLS already allows them to do.
 */
export default async function MatchesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const safeLocale: 'he' | 'en' = locale === 'he' ? 'he' : 'en';
  const member = await requireMember(safeLocale);
  const tEmpty = await getTranslations('matchesEmpty');

  const supabase = await createClient();

  // Single query: fixtures + teams (FK embeds) + predictions (RLS-filtered)
  // ORDER BY kickoff_at ASC so groupByLocalDate preserves chronological order.
  const { data: fixtures, error } = await supabase
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

  if (error || !fixtures || fixtures.length === 0) {
    return (
      <div className="pi-4">
        <EmptyStateCard
          heading={tEmpty('loading.heading')}
          body={tEmpty('loading.body')}
        />
      </div>
    );
  }

  // Normalize PostgREST embed shapes. The generated type widens single-FK
  // embeds to T[] because it can't statically prove uniqueness from the FK
  // hint, but the runtime returns either a single object or null per row.
  // We coerce to the runtime shape here so downstream code can treat
  // home_team / away_team as scalar objects.
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

  // Separate score_events query (Pitfall 2 — keep RLS-filtered embed light;
  // score_events RLS is read-for-all-authenticated per Plan 02-01 D-19).
  const fixtureIds = normalized.map((f) => f.id);
  const { data: scoreEventsData } = await supabase
    .from('score_events')
    .select('user_id, ref_id, points, kind')
    .eq('source', 'league')
    .in('ref_id', fixtureIds);
  const scoreByFixtureUser = new Map<
    string,
    { points: number; kind: PtsKind | null }
  >();
  for (const se of scoreEventsData ?? []) {
    scoreByFixtureUser.set(`${se.ref_id}:${se.user_id}`, {
      points: se.points,
      kind: se.kind as PtsKind | null,
    });
  }

  // Full family roster — used in resulted variant so non-predictors render
  // as em-dash + +0 instead of being silently dropped.
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('user_id, display_name');
  const roster = allProfiles ?? [];

  const now = Date.now();

  // Build the upcoming list for the countdown banner. Server-side now() is
  // used for the initial render only — the client component re-derives via
  // setInterval(1s) so it stays accurate across the request boundary.
  const upcoming: UpcomingFixture[] = normalized
    .filter((f) => new Date(f.kickoff_at).getTime() > now)
    .map((f) => ({
      kickoff_at: f.kickoff_at,
      home_label: f.home_team?.code ?? f.home_placeholder ?? '?',
      away_label: f.away_team?.code ?? f.away_placeholder ?? '?',
    }));

  // groupByLocalDate is generic over the row shape — only `kickoff_at` is
  // required, so the normalized list (with embeds) flows through cleanly.
  const groups = groupByLocalDate(normalized, safeLocale);

  // Conditional page top-padding (UI-SPEC §6 "Page offset"):
  // - banner mounted   → mbs-10 (additional 40px below layout's pbs-14 → 96px viewport total)
  // - banner unmounted → mbs-0  (layout's pbs-14 alone → 56px viewport total)
  const pageTopOffset = upcoming.length > 0 ? 'mbs-10' : 'mbs-0';

  return (
    <>
      {upcoming.length > 0 && <CountdownBanner upcoming={upcoming} />}
      <div className={`pi-4 ${pageTopOffset}`}>
        <h1 className="sr-only">
          {safeLocale === 'he' ? 'משחקים' : 'Matches'}
        </h1>
        {groups.map(([dateLabel, fxs]) => (
          <section key={dateLabel}>
            <DateGroupHeader label={dateLabel} />
            {fxs.map((f) => {
              const kickoffMs = new Date(f.kickoff_at).getTime();
              const isLocked = kickoffMs <= now;
              const isResulted =
                f.result_home_90min !== null && f.result_away_90min !== null;
              const homeTeam = f.home_team ?? {
                code: '?',
                name_en: f.home_placeholder ?? '?',
                name_he: f.home_placeholder ?? '?',
              };
              const awayTeam = f.away_team ?? {
                code: '?',
                name_en: f.away_placeholder ?? '?',
                name_he: f.away_placeholder ?? '?',
              };

              // RLS guarantees only the viewer's own prediction is visible
              // pre-kickoff (predictions_read filters to own + post-kickoff).
              const ownPred = (f.predictions ?? []).find(
                (p) => p.user_id === member.user_id,
              );

              if (isResulted) {
                // Build per-player rows from full roster + post-kickoff
                // predictions (now visible per predictions_read RLS) +
                // score_events (visible to all authenticated per Plan 02-01).
                const picks = roster.map((profile) => {
                  const pred = (f.predictions ?? []).find(
                    (p) => p.user_id === profile.user_id,
                  );
                  const score = scoreByFixtureUser.get(
                    `${f.id}:${profile.user_id}`,
                  );
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
                    locale={safeLocale}
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
                    locale={safeLocale}
                    homeTeam={homeTeam}
                    awayTeam={awayTeam}
                    kickoffAt={f.kickoff_at}
                    userHome={ownPred?.home_score ?? null}
                    userAway={ownPred?.away_score ?? null}
                  />
                );
              }

              return (
                <MatchRow
                  key={f.id}
                  locale={safeLocale}
                  fixtureId={f.id}
                  homeTeam={homeTeam}
                  awayTeam={awayTeam}
                  kickoffAt={f.kickoff_at}
                  initialHome={ownPred?.home_score ?? null}
                  initialAway={ownPred?.away_score ?? null}
                />
              );
            })}
          </section>
        ))}
      </div>
    </>
  );
}

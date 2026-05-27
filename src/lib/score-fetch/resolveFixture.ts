import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExternalMatch } from '@/lib/score-fetch/footballData';

/**
 * Resolves a football-data.org match to an internal fixtures.id (D-46).
 *
 * No free sports API reliably exposes FIFA's 1-104 external_match_no, so we
 * use a tuple: (kickoff_at ±5min, home_team.code, away_team.code).
 *
 * Returns null when:
 *   - No fixture matches (CSV drift / vendor renaming — caller logs + skips)
 *   - Multiple fixtures match (ambiguous — caller logs + skips)
 *   - DB error (caller logs + skips; never crashes the cron)
 *
 * The Wave-0 corpus test (tests/score-fetch/resolveFixture.test.ts) asserts
 * all 104 seeded fixtures resolve cleanly against synthesized vendor responses
 * — catches TLA mismatches BEFORE they bite live.
 */
export async function resolveFixture(
  svc: SupabaseClient,
  ext: ExternalMatch,
): Promise<string | null> {
  const kickoff = new Date(ext.utcDate);
  if (Number.isNaN(kickoff.getTime())) return null;

  const windowMs = 5 * 60_000;
  const lower = new Date(kickoff.getTime() - windowMs).toISOString();
  const upper = new Date(kickoff.getTime() + windowMs).toISOString();

  // Two-step lookup avoids PostgREST's quirky behavior on filtering joined-
  // table columns (some versions don't honor `.eq('home_team.code', ...)`):
  // (1) look up team IDs by TLA, (2) match the fixture by those IDs.
  const { data: teamRows, error: teamErr } = await svc
    .from('teams')
    .select('id, code')
    .in('code', [ext.homeTeam.tla, ext.awayTeam.tla]);
  if (teamErr || !teamRows) return null;

  const homeTeam = teamRows.find((t) => t.code === ext.homeTeam.tla);
  const awayTeam = teamRows.find((t) => t.code === ext.awayTeam.tla);
  if (!homeTeam || !awayTeam) return null;

  const { data: fixtureRows, error: fxErr } = await svc
    .from('fixtures')
    .select('id, kickoff_at')
    .eq('home_team_id', homeTeam.id)
    .eq('away_team_id', awayTeam.id)
    .gte('kickoff_at', lower)
    .lte('kickoff_at', upper);
  if (fxErr || !fixtureRows || fixtureRows.length !== 1) return null;

  return fixtureRows[0].id;
}

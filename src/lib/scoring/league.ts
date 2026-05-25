// src/lib/scoring/league.ts
//
// Pure scoring math for League Mode (D-16 + D-17). No DB, no IO, no
// Supabase imports — safe to call from anywhere (Server Action, RSC,
// future client preview UI). The admin Server Action that orchestrates
// reads / writes lives elsewhere (Wave 2+, src/app/actions/saveResult.ts);
// this module is intentionally a leaf.
//
// SCR-01: 4 (exact) / 3 (correct non-zero goal-diff) / 2 (correct winner
//          or 0-diff non-exact) / 0
// SCR-02: only the 90-min columns matter; ET/penalty columns are ignored
// SCR-05: integer-only — inputs are smallint, output `points: number` is
//          integer-shaped (never floats)

export type LeagueKind = 'exact' | 'goal-diff' | 'winner' | 'miss';
export type LeagueScore = { points: number; kind: LeagueKind };

export type LeaguePrediction = { home_score: number; away_score: number };
export type LeagueResult = {
  result_home_90min: number;
  result_away_90min: number;
};

/**
 * Score one prediction against one fixture result (Kicktipp 4/3/2 + miss).
 *
 * Decision order matters — `exact` MUST be checked before `goal-diff`,
 * which MUST be checked before `winner`. The `predDiff !== 0` guard on
 * the goal-diff branch excludes the 0-0-predicted-vs-1-1-actual case:
 * both have diff 0, but that's a `winner` (draw winner), not a
 * goal-diff. The 0-0 vs 0-0 case is already short-circuited by the
 * exact branch.
 */
export function scoreMatch(
  p: LeaguePrediction,
  r: LeagueResult,
): LeagueScore {
  if (
    p.home_score === r.result_home_90min &&
    p.away_score === r.result_away_90min
  ) {
    return { points: 4, kind: 'exact' };
  }
  const predDiff = p.home_score - p.away_score;
  const realDiff = r.result_home_90min - r.result_away_90min;
  if (predDiff === realDiff && predDiff !== 0) {
    return { points: 3, kind: 'goal-diff' };
  }
  // winner = same sign (both positive, both negative, or both zero AND
  // not exact — the "draw winner" branch picks up the 1-1 vs 2-2 case).
  if (Math.sign(predDiff) === Math.sign(realDiff)) {
    return { points: 2, kind: 'winner' };
  }
  return { points: 0, kind: 'miss' };
}

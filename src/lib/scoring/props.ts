// src/lib/scoring/props.ts
//
// Pure scoring math for tournament-level prop questions (D-16, D-17, D-24).
// No DB, no IO — pair to league.ts; safe to import anywhere.
//
// SCR-04: per-question admin-set point value (`pointsAtStake`)
// D-24: trim + NFC + lowercase, then membership-check against
//       {correctAnswer ∪ aliases}. For `single_team`, userAnswer is a UUID
//       — exact match (normalization is a no-op on UUIDs but still safe).
//       For `single_player` / `text`, the alias set drives fuzzy match
//       (e.g. "Messi" ∈ {"Lionel Messi","L. Messi","Messi","מסי"}).
//
// IMPORTANT — answer_type values: the DB CHECK constraint in
// supabase/migrations/0001_init.sql:138 enumerates the underscored values
// `'single_team' | 'single_player' | 'text'`. The plan text suggested
// dashed `'single-team'`, but reading 0001_init.sql:138 (which the plan
// itself flags as the authoritative source) confirms underscores. Using
// dashes would cause every prop_answers row to fail the DB CHECK at write
// time and every grade comparison to silently mismatch. Underscored values
// match Supabase's generated `Database['public']['Tables']['prop_questions']
// ['Row']['answer_type']` (regenerated in Plan 02-01) and the existing seed.

export type PropAnswerType = 'single_team' | 'single_player' | 'text';
export type PropScore = { points: number; kind: 'correct' | 'miss' };

/**
 * Score one prop answer against the admin-set correct answer.
 *
 * Normalization rule (D-24): `s.trim().normalize('NFC').toLowerCase()`.
 * The alias set is built once per call from `[correctAnswer, ...aliases]`
 * — duplicates collapse, membership is O(1).
 *
 * The function intentionally treats all three `answer_type` values
 * identically at the math level: UUID equality for `single_team` is a
 * trivial special case of normalized-string membership against an alias
 * set of size 1 (the canonical answer). Keeping a single code path makes
 * the function easier to reason about and matches the RESEARCH Pattern 4
 * skeleton at lines 525-547.
 */
export function scoreProp(opts: {
  userAnswer: string;
  correctAnswer: string;
  answerType: PropAnswerType;
  pointsAtStake: number;
  aliases?: readonly string[];
}): PropScore {
  const norm = (s: string) => s.trim().normalize('NFC').toLowerCase();
  const target = norm(opts.correctAnswer);
  const aliasSet = new Set([target, ...(opts.aliases ?? []).map(norm)]);

  const isCorrect = aliasSet.has(norm(opts.userAnswer));
  return isCorrect
    ? { points: opts.pointsAtStake, kind: 'correct' }
    : { points: 0, kind: 'miss' };
}

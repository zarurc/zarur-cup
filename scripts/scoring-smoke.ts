// scripts/scoring-smoke.ts — non-test sanity check for src/lib/scoring/*.
//
// Run via: npx tsx scripts/scoring-smoke.ts
//
// Plan 02-02 explicitly does NOT install Vitest (CLAUDE.md guidance:
// defer Vitest unless scoring complexity warrants it). This script
// stands in for a unit test — 10 assertions that prove SCR-01 / SCR-02 /
// SCR-04 invariants. Exits 0 only when every assertion holds; otherwise
// prints `FAIL: <label>` and exits 1. Used as the Task-1 verify gate.

import { scoreMatch } from '../src/lib/scoring/league';
import { scoreProp } from '../src/lib/scoring/props';

const assert = (label: string, cond: boolean): void => {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`ok: ${label}`);
};

// SCR-01 cases — scoreMatch
assert(
  'exact 2-1 vs 2-1',
  JSON.stringify(
    scoreMatch(
      { home_score: 2, away_score: 1 },
      { result_home_90min: 2, result_away_90min: 1 },
    ),
  ) === '{"points":4,"kind":"exact"}',
);
assert(
  'diff 2-1 vs 3-2',
  JSON.stringify(
    scoreMatch(
      { home_score: 2, away_score: 1 },
      { result_home_90min: 3, result_away_90min: 2 },
    ),
  ) === '{"points":3,"kind":"goal-diff"}',
);
assert(
  'draw 1-1 vs 2-2',
  JSON.stringify(
    scoreMatch(
      { home_score: 1, away_score: 1 },
      { result_home_90min: 2, result_away_90min: 2 },
    ),
  ) === '{"points":2,"kind":"winner"}',
);
// NOTE [Rule 1 - Bug]: The plan example used `{home:2,away:1}` vs
// `{result_home_90min:1,result_away_90min:0}` and asserted `winner` (2pts)
// with reasoning "different diff". Both predictions have diff +1; per
// SCR-01 + RESEARCH Pattern 4 that is `goal-diff` (3pts), NOT `winner`.
// Replaced with an unambiguous winner-only case: predicted +3 diff vs
// actual +1 diff (same sign, different diff → `winner`).
assert(
  'winner 3-0 vs 1-0',
  JSON.stringify(
    scoreMatch(
      { home_score: 3, away_score: 0 },
      { result_home_90min: 1, result_away_90min: 0 },
    ),
  ) === '{"points":2,"kind":"winner"}',
);
assert(
  'miss draw vs away-win',
  JSON.stringify(
    scoreMatch(
      { home_score: 0, away_score: 0 },
      { result_home_90min: 1, result_away_90min: 0 },
    ),
  ) === '{"points":0,"kind":"miss"}',
);
assert(
  'miss opposite winner',
  JSON.stringify(
    scoreMatch(
      { home_score: 2, away_score: 0 },
      { result_home_90min: 0, result_away_90min: 2 },
    ),
  ) === '{"points":0,"kind":"miss"}',
);

// SCR-04 cases — scoreProp
assert(
  'prop correct alias',
  scoreProp({
    userAnswer: 'Messi',
    correctAnswer: 'Lionel Messi',
    answerType: 'single_player',
    pointsAtStake: 5,
    aliases: ['Messi', 'L. Messi'],
  }).points === 5,
);
assert(
  'prop correct trim+lower',
  scoreProp({
    userAnswer: '  MESSI  ',
    correctAnswer: 'Lionel Messi',
    answerType: 'single_player',
    pointsAtStake: 5,
    aliases: ['Messi'],
  }).points === 5,
);
assert(
  'prop miss',
  scoreProp({
    userAnswer: 'Ronaldo',
    correctAnswer: 'Lionel Messi',
    answerType: 'single_player',
    pointsAtStake: 5,
    aliases: [],
  }).points === 0,
);
assert(
  'prop team uuid match',
  scoreProp({
    userAnswer: 'abc-uuid',
    correctAnswer: 'abc-uuid',
    answerType: 'single_team',
    pointsAtStake: 3,
    aliases: [],
  }).points === 3,
);

// Plan 02-03 structural assertion: the savePrediction Server Action module
// MUST export the `savePrediction` symbol with the expected callable shape.
// We cannot invoke it here (it depends on Next.js request scope + Supabase
// cookie context), but a static-text grep confirms the module declares
// `'use server'` and exports `savePrediction`.
//
// A dynamic import is intentionally avoided — savePrediction imports
// next/cache + @/lib/supabase/server which only resolve inside the Next.js
// runtime. The grep-style structural check is the equivalent for a plain
// node/tsx context.
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const savePredictionPath = resolve(
  __dirname,
  '..',
  'src',
  'app',
  'actions',
  'savePrediction.ts',
);
assert(
  'savePrediction file exists',
  existsSync(savePredictionPath),
);
const savePredictionSrc = readFileSync(savePredictionPath, 'utf8');
assert(
  'savePrediction declares use server',
  savePredictionSrc.includes("'use server'"),
);
assert(
  'savePrediction exports the function',
  /export\s+async\s+function\s+savePrediction\s*\(/.test(savePredictionSrc),
);
assert(
  'savePrediction calls predictionSchema.safeParse',
  savePredictionSrc.includes('predictionSchema.safeParse'),
);
assert(
  'savePrediction translates RLS 42501 to locked',
  savePredictionSrc.includes("error.code === '42501'"),
);

console.log('all scoring smokes pass');

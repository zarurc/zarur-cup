import { z } from 'zod';

/**
 * User-submitted prop answer (D-22 / D-23 / D-24). Discriminated union
 * on `answer_type` so the Server Action validates each branch against
 * the correct payload shape:
 *
 *   - `single_team`   : answer is a team UUID (D-23 flag-grid selection)
 *   - `single_player` : answer is free text up to 64 chars (D-24)
 *   - `text`          : answer is free text up to 120 chars (D-24)
 *
 * The free-text branches enforce a Unicode-letter + digit + safe-punct
 * regex to mitigate stored XSS on `prop_answers.answer` per RESEARCH
 * Security Domain table (T-02-02-05). React auto-escapes on render as
 * a second defense; this regex is the first.
 *
 * IMPORTANT — answer_type values match the DB CHECK constraint in
 * supabase/migrations/0001_init.sql:138 — underscores, NOT dashes:
 *   check (answer_type in ('single_team','single_player','text'))
 * The plan text used dashes, but the canonical DB schema uses
 * underscores, and the seed in 0006_reseed_wc2026.sql writes the
 * underscored form. Schemas use underscores to match the live data.
 */

const FREE_TEXT_REGEX = /^[\p{L}\d \-.,!?']+$/u; // letters, digits, safe punctuation; rejects <, >, &, /, =, ;, "

const SINGLE_TEAM = z.object({
  question_id: z.string().uuid('question_id_invalid'),
  answer_type: z.literal('single_team'),
  answer: z.string().uuid('team_id_invalid'),
});

const SINGLE_PLAYER = z.object({
  question_id: z.string().uuid('question_id_invalid'),
  answer_type: z.literal('single_player'),
  answer: z
    .string()
    .trim()
    .min(1, 'answer_empty')
    .max(64, 'answer_long')
    .regex(FREE_TEXT_REGEX, 'answer_chars'),
});

const TEXT = z.object({
  question_id: z.string().uuid('question_id_invalid'),
  answer_type: z.literal('text'),
  answer: z
    .string()
    .trim()
    .min(1, 'answer_empty')
    .max(120, 'answer_long')
    .regex(FREE_TEXT_REGEX, 'answer_chars'),
});

export const propAnswerSchema = z.discriminatedUnion('answer_type', [
  SINGLE_TEAM,
  SINGLE_PLAYER,
  TEXT,
]);
export type PropAnswerInput = z.infer<typeof propAnswerSchema>;

import { z } from 'zod';

/**
 * User-submitted prop answer (D-22 / D-23 / D-24). Discriminated union
 * on `answer_type` so the Server Action validates each branch against
 * the correct payload shape:
 *
 *   - `single_team`   : answer is a team UUID (D-23 flag-grid selection)
 *   - `single_player` : answer is free text up to 64 chars (D-24)
 *   - `text`          : answer is free text up to 120 chars (D-24)
 *   - `yes_no`        : answer is the literal string 'yes' or 'no' (migration 0015)
 *
 * The free-text branches enforce a Unicode-letter + digit + safe-punct
 * regex to mitigate stored XSS on `prop_answers.answer` per RESEARCH
 * Security Domain table (T-02-02-05). React auto-escapes on render as
 * a second defense; this regex is the first.
 *
 * IMPORTANT — answer_type values match the live DB CHECK constraint
 * (originally 0001_init.sql:138, broadened by migration 0015_answer_type_yes_no.sql
 * to include 'yes_no'):
 *   check (answer_type in ('single_team','single_player','text','yes_no'))
 * The plan text used dashes, but the canonical DB schema uses
 * underscores, and the seed writes the underscored form. Schemas use
 * underscores to match the live data.
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

const YES_NO = z.object({
  question_id: z.string().uuid('question_id_invalid'),
  answer_type: z.literal('yes_no'),
  answer: z.enum(['yes', 'no'], { message: 'answer_invalid' }),
});

export const propAnswerSchema = z.discriminatedUnion('answer_type', [
  SINGLE_TEAM,
  SINGLE_PLAYER,
  TEXT,
  YES_NO,
]);
export type PropAnswerInput = z.infer<typeof propAnswerSchema>;

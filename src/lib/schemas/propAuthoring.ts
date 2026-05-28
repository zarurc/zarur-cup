import { z } from 'zod';

/**
 * Admin prop authoring (ADM-04 + D-13). Bilingual prompts because props
 * render to players in both locales, though the admin pages themselves
 * are EN-only (Phase 1 D-05).
 *
 * `id` is optional: omitted on create, present on edit. `points_value`
 * is per-question per D-04 / SCR-04 — admin sets it at authoring time.
 *
 * Bounds:
 *   - prompts 3..200 chars  (short enough for a mobile card; long enough
 *                            for any reasonable WC trivia)
 *   - points  1..50         (50 covers "Winner of the cup" headline prop;
 *                            higher would distort tiebreakers)
 *
 * IMPORTANT — `answer_type` values match the DB CHECK constraint in
 * supabase/migrations/0001_init.sql:138 (underscored, NOT dashed). See
 * the matching note in propAnswer.ts for full rationale.
 */
export const propAuthoringSchema = z.object({
  id: z.string().uuid().optional(),
  prompt_en: z
    .string()
    .trim()
    .min(3, 'prompt_short')
    .max(200, 'prompt_long'),
  prompt_he: z
    .string()
    .trim()
    .min(3, 'prompt_short')
    .max(200, 'prompt_long'),
  answer_type: z.enum(['single_team', 'single_player', 'text', 'yes_no']),
  points_value: z.coerce
    .number()
    .int()
    .min(1, 'points_range')
    .max(50, 'points_range'),
});
export type PropAuthoringInput = z.infer<typeof propAuthoringSchema>;

/**
 * Admin prop grading (D-13 + D-24). Once a tournament outcome is known,
 * admin enters the canonical correct answer plus an optional alias set
 * (entered as newline-separated lines in the UI textarea; trimmed +
 * de-duplicated server-side before passing here).
 *
 * The alias cap of 20 bounds regex/normalization cost in `scoreProp`
 * (T-02-02-04). 20 aliases is plenty for "Lionel Messi | Messi |
 * L. Messi | מסי | leo | ..." and any realistic transliteration set.
 */
export const propGradingSchema = z.object({
  id: z.string().uuid('question_id_invalid'),
  correct_answer: z
    .string()
    .trim()
    .min(1, 'answer_empty')
    .max(120, 'answer_long'),
  correct_answer_aliases: z
    .array(z.string().trim().min(1))
    .max(20, 'too_many_aliases')
    .default([]),
});
export type PropGradingInput = z.infer<typeof propGradingSchema>;

import { z } from 'zod';

/**
 * Per-fixture score prediction (D-04 — score range 0-9 inclusive).
 *
 * Used by both the client-side stepper form and the `savePrediction`
 * Server Action (Wave 2). Single source of truth — the action calls
 * `predictionSchema.safeParse(input)` before any DB write, and RLS is
 * the second gate (kickoff_at > now() on INSERT/UPDATE per Phase 1
 * 0002_rls.sql:113-140).
 *
 * `z.coerce.number()` lets FormData stringified digits flow through
 * untouched ("3" → 3). Error tokens (`score_int`, `score_range`,
 * `fixture_id_invalid`) mirror the `displayName.ts` convention — the
 * client maps them to next-intl message keys, no English strings here.
 */
export const predictionSchema = z.object({
  fixture_id: z.string().uuid('fixture_id_invalid'),
  home_score: z.coerce
    .number()
    .int('score_int')
    .min(0, 'score_range')
    .max(9, 'score_range'),
  away_score: z.coerce
    .number()
    .int('score_int')
    .min(0, 'score_range')
    .max(9, 'score_range'),
});

export type PredictionInput = z.infer<typeof predictionSchema>;

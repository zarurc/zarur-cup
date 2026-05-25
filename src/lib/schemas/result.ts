import { z } from 'zod';

/**
 * Admin result entry (ADM-01 + D-12). Phase 2 admin populates only the
 * `_90min` columns — the `_full` columns ship in Plan 02-01's 0009
 * migration but stay NULL until Phase 3 adds the ET admin UI. Group-stage
 * fixtures NEVER set `_full`.
 *
 * Score range 0-9 matches `predictionSchema` so player vs. admin inputs
 * occupy the same value space (no "player can predict 7-0 but admin can
 * only enter 0-3" footgun).
 *
 * Used by the `saveResult` Server Action (Wave 2+); error tokens mirror
 * Phase 1 conventions for client-side i18n mapping.
 */
export const resultSchema = z.object({
  fixture_id: z.string().uuid('fixture_id_invalid'),
  result_home_90min: z.coerce
    .number()
    .int('score_int')
    .min(0, 'score_range')
    .max(9, 'score_range'),
  result_away_90min: z.coerce
    .number()
    .int('score_int')
    .min(0, 'score_range')
    .max(9, 'score_range'),
});

export type ResultInput = z.infer<typeof resultSchema>;

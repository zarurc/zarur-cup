import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

/**
 * Shared idempotent score_events upsert helper (D-18 + RESEARCH Pattern 5).
 *
 * Called by Wave 2+ admin Server Actions:
 *   - saveResult   (source = 'league', ref_id = fixture_id)
 *   - gradeProp    (source = 'prop',   ref_id = question_id)
 *
 * Phase 3 will add a third caller for bracket scoring (source = 'bracket').
 *
 * Three-step protocol:
 *
 *   1. DELETE any rows for this (source, ref_id) whose user_id is NOT in
 *      the new row set. Handles the "user deleted their prediction"
 *      edge case from RESEARCH Pattern 5 lines 610-611 — without this
 *      sweep, a user who once predicted, scored, then deleted would
 *      keep their stale points.
 *
 *   2. Bulk UPSERT on the PK (user_id, source, ref_id) — D-18
 *      idempotency by construction. Re-running scoring for the same
 *      fixture re-UPSERTs each user's row in place; never duplicates.
 *
 *   3. revalidatePath() for 8 explicit per-locale × per-page combinations
 *      (Pitfall 6). The next-intl App Router does NOT honor a single
 *      `/leaderboard` revalidate against a `[locale]` segment — each
 *      `/he/...` / `/en/...` path must be invalidated explicitly.
 *
 * Note on typing: the `score_events` table is added by Plan 02-01
 * (`supabase/migrations/0007_score_events.sql`); both plans run in the
 * same wave so this module ships before that migration's types reach
 * src/types/supabase.ts. To keep typecheck green in isolation, the
 * caller passes a plain `SupabaseClient` (no Database generic) — once
 * Plan 02-01 merges and types regenerate, a follow-up can tighten the
 * signature without changing behavior.
 */

export type ScoreEventSource = 'league' | 'prop' | 'bracket';
export type ScoreEventKind =
  | 'exact'
  | 'goal-diff'
  | 'winner'
  | 'miss'
  | 'correct'
  | null;

export type ScoreEventRow = {
  user_id: string;
  source: ScoreEventSource;
  ref_id: string;
  points: number;
  kind: ScoreEventKind;
};

const REVALIDATE_PATHS = [
  '/he/leaderboard',
  '/en/leaderboard',
  '/he/matches',
  '/en/matches',
  '/he/me',
  '/en/me',
  '/he/me/props',
  '/en/me/props',
  '/he/bracket',
  '/en/bracket',
] as const;

export async function sweepAndUpsert(opts: {
  svc: SupabaseClient;
  source: Exclude<ScoreEventSource, 'bracket'>;
  ref_id: string;
  rows: ReadonlyArray<ScoreEventRow>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { svc, source, ref_id, rows } = opts;

  // 1. Sweep stragglers. PostgREST `.not('user_id','in', '(<csv>)')`
  // syntax requires the parenthesized comma-joined list. When the keep
  // set is empty, pass `(null)` so the NOT IN does not match any row
  // (no-op delete instead of accidentally wiping everything).
  const keepUserIds = rows.map((r) => r.user_id);
  const inList =
    keepUserIds.length > 0 ? `(${keepUserIds.join(',')})` : '(null)';
  const { error: delErr } = await svc
    .from('score_events')
    .delete()
    .eq('source', source)
    .eq('ref_id', ref_id)
    .not('user_id', 'in', inList);
  if (delErr) return { ok: false, error: `sweep:${delErr.message}` };

  // 2. Bulk UPSERT (skip the network call when there are zero rows).
  if (rows.length > 0) {
    const { error: upErr } = await svc
      .from('score_events')
      .upsert(rows as ScoreEventRow[], {
        onConflict: 'user_id,source,ref_id',
      });
    if (upErr) return { ok: false, error: `upsert:${upErr.message}` };
  }

  // 3. Revalidate per-locale × per-page (Pitfall 6).
  for (const path of REVALIDATE_PATHS) {
    revalidatePath(path);
  }

  return { ok: true };
}

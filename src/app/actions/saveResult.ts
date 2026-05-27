'use server';

import { requireAdmin } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/service';
import { resultSchema } from '@/lib/schemas/result';
import { scoreMatch, type LeagueKind } from '@/lib/scoring/league';
import {
  sweepAndUpsert,
  type ScoreEventRow,
} from '@/lib/scoring/sweepAndUpsert';

/**
 * Admin score-entry Server Action — orchestrates the league-scoring sweep
 * per D-18 + D-10 + ADM-02 + SCR-06 + LB-03.
 *
 * Flow (every call, idempotent by construction):
 *
 *   1. `requireAdmin()` — first executable line after imports. Phase 1
 *      session.ts redirects non-admins to /admin/403 and signed-out users
 *      to "/". The /admin/(protected)/ layout already gates the page, but
 *      we re-gate at the action level as defense-in-depth (T-02-05-01).
 *
 *   2. `resultSchema.safeParse(input)` — Zod 4 (`fixture_id` uuid, scores
 *      `int().min(0).max(9)`). Domain error → `{ ok: false, error:
 *      'validation' }`; the action never touches the DB if validation
 *      fails (T-02-05-02 + T-02-05-06).
 *
 *   3. `createServiceClient()` — bypass RLS so we can (a) UPDATE the
 *      fixtures row regardless of who's writing and (b) SELECT every
 *      prediction for the fixture, not just the admin's own. Pitfall 10
 *      (T-02-05-03): admin RSCs that use the anon client see only their
 *      own predictions through RLS and break integrity.
 *
 *   4. UPDATE `fixtures.result_home_90min` + `.result_away_90min` ONLY.
 *      Per Phase 2 D-12 the new `_full` columns ship in migration 0009
 *      but stay NULL for the entire phase — Phase 3 ET admin UI is the
 *      one that populates them. Group-stage fixtures NEVER set `_full`.
 *      `updated_at` is omitted (Phase 1 schema does not define a trigger
 *      that bumps it on UPDATE — if a later migration adds one it fires
 *      automatically; if not, the column may not even exist).
 *
 *   5. SELECT all predictions for this fixture (service-role bypasses
 *      RLS). The shape is the minimum needed by `scoreMatch` —
 *      `user_id`, `home_score`, `away_score`.
 *
 *   6. Score each via `scoreMatch` (Plan 02-02 pure function) and build
 *      a `ScoreEventRow[]`. Source is the literal `'league'`; ref_id is
 *      the fixture UUID. The PK `(user_id, source, ref_id)` makes the
 *      eventual UPSERT idempotent — re-saving the same result is a
 *      no-op at row level (just bumps `updated_at`).
 *
 *   7. `sweepAndUpsert` (Plan 02-02) — three-step shared helper:
 *        (a) DELETE rows where user_id is NOT in the new set (sweeps
 *            users who once predicted, scored, then deleted),
 *        (b) bulk UPSERT on PK (D-18),
 *        (c) revalidatePath fan-out across the 8 explicit per-locale
 *            paths (Pitfall 6 — never use a `[locale]` wildcard).
 *      Returns `{ ok: true } | { ok: false, error: string }` — we
 *      propagate the discriminated result up to the action's return.
 *
 * No `redirect()` — mutate-and-stay. The admin stays on
 * /admin/matches?mode=entry and the client component handles UI feedback
 * (Saving… → Saved ✓ → idle, with revert+error on failure).
 *
 * Defense in depth:
 *   - requireAdmin (action-level) AND admin layout gate
 *   - Zod validation BEFORE any DB call (kickoff-bypass via RLS is gated
 *     too — saveResult uses service-role so RLS doesn't gate it; the Zod
 *     range cap is the only ceiling on what scores reach the DB)
 *   - service-role client is created ONLY after the admin gate (mirrors
 *     Phase 1 join.ts:172-219 rebind pattern)
 */

type SaveResultSuccess = { ok: true; scored: number };
type SaveResultFailure = { ok: false; error: string };
export type SaveResultResponse = SaveResultSuccess | SaveResultFailure;

export async function saveResult(input: unknown): Promise<SaveResultResponse> {
  await requireAdmin();

  const parsed = resultSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const { fixture_id, result_home_90min, result_away_90min } = parsed.data;

  const svc = createServiceClient();

  // 1. Persist the result. D-12: Phase 2 admin UI populates ONLY _90min.
  // AUTO-04 (Plan 02-12): set auto_fetched_at = null so the score-fetch
  // cron does not overwrite admin's manual entry on its next tick. The
  // cron's admin-lock check is `result_home_90min IS NOT NULL AND
  // auto_fetched_at IS NULL` (skip), so a NULL here permanently locks
  // this row to admin's value until another admin write clears it again.
  const { error: e1 } = await svc
    .from('fixtures')
    .update({
      result_home_90min,
      result_away_90min,
      auto_fetched_at: null,
    })
    .eq('id', fixture_id);
  if (e1) return { ok: false, error: `fixture_update:${e1.message}` };

  // 1b. Bracket slot resolution (BRK-VIEW-03 + BRK-VIEW-04, Plan 02-11).
  //
  // For non-group fixtures with a clear 90-min winner, write the winning
  // team_id to bracket_slots.resolved_team_id WHERE fixture_id = this
  // fixture. This is the live-fill mechanism for /[locale]/bracket — the
  // RSC reads resolved_team via the relational join and renders the team
  // name once this row is populated.
  //
  // Tied-at-90 KO matches leave resolved_team_id NULL (D-12 ET handling
  // is Phase 3). Tied group-stage matches are ignored — group stage is
  // never written to bracket_slots.
  //
  // If the Final (slot_code = 'F') is being decided, also propagate the
  // winner to the CHAMPION slot in the same transaction (BRK-VIEW-04).
  //
  // Failure of this writeback does NOT fail the overall saveResult — the
  // primary scoring path must run. Errors logged for forensic audit.
  try {
    if (result_home_90min !== result_away_90min) {
      const { data: fixtureMeta } = await svc
        .from('fixtures')
        .select('stage, home_team_id, away_team_id')
        .eq('id', fixture_id)
        .maybeSingle();

      if (fixtureMeta && fixtureMeta.stage !== 'group') {
        const winnerId =
          result_home_90min > result_away_90min
            ? fixtureMeta.home_team_id
            : fixtureMeta.away_team_id;

        if (winnerId) {
          // Update the slot whose fixture_id matches; capture the
          // slot_code so we can detect the Final → Champion cascade.
          const { data: slotsUpdated } = await svc
            .from('bracket_slots')
            .update({ resolved_team_id: winnerId })
            .eq('fixture_id', fixture_id)
            .select('slot_code');

          // If we just updated the Final slot, propagate to CHAMPION.
          if (slotsUpdated && slotsUpdated.some((s) => s.slot_code === 'F')) {
            await svc
              .from('bracket_slots')
              .update({ resolved_team_id: winnerId })
              .eq('slot_code', 'CHAMPION');
          }
        }
      }
    }
  } catch (bracketErr) {
    // eslint-disable-next-line no-console
    console.warn('saveResult: bracket writeback failed (non-fatal)', bracketErr);
  }

  // 2. Read every prediction for this fixture (service-role bypasses RLS
  //    — Pitfall 10. The anon client would only return the admin's own
  //    prediction here, which would make the score sweep score one user.)
  const { data: preds, error: e2 } = await svc
    .from('predictions')
    .select('user_id, home_score, away_score')
    .eq('fixture_id', fixture_id);
  if (e2) return { ok: false, error: `predictions_read:${e2.message}` };

  // 3. Score each via the pure helper. The result is the canonical row
  //    shape sweepAndUpsert expects.
  const rows: ScoreEventRow[] = (preds ?? []).map((p) => {
    const { points, kind } = scoreMatch(
      { home_score: p.home_score, away_score: p.away_score },
      { result_home_90min, result_away_90min },
    );
    return {
      user_id: p.user_id,
      source: 'league' as const,
      ref_id: fixture_id,
      points,
      kind: kind as LeagueKind,
    };
  });

  // 4. Sweep + UPSERT + revalidate 8 paths (LB-03). The helper is the
  //    single source of truth for the per-locale revalidation array —
  //    duplicating those revalidatePath calls in this action is wrong.
  const sweepResult = await sweepAndUpsert({
    svc,
    source: 'league',
    ref_id: fixture_id,
    rows,
  });

  if (!sweepResult.ok) return { ok: false, error: sweepResult.error };

  return { ok: true, scored: rows.length };
}

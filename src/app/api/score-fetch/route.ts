import { NextResponse, after } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { fetchWcMatches } from '@/lib/score-fetch/footballData';
import { resolveFixture } from '@/lib/score-fetch/resolveFixture';
import { scoreMatch, type LeagueKind } from '@/lib/scoring/league';
import {
  sweepAndUpsert,
  type ScoreEventRow,
} from '@/lib/scoring/sweepAndUpsert';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 10; // Vercel Hobby ceiling

/**
 * POST /api/score-fetch — auto-fetch WC 2026 match scores (D-45 + D-46 + AUTO-02).
 *
 * Auth: shared Bearer secret in `SCORE_FETCH_SECRET` env var (server-only,
 * no NEXT_PUBLIC_ prefix). MUST be set on Vercel AND set on Supabase as
 * `app.score_fetch_secret` GUC (see 02-USER-SETUP.md). Missing or
 * mismatched secret → 401.
 *
 * Triggered by: Supabase pg_cron job 'zarur-score-fetch' (migration 0012),
 * every 15 minutes. The cron's body is a single pg_net.http_post — no
 * Postgres-side work; all logic lives here.
 *
 * Tournament-window gate: short-circuits with 200 + skipped=outside-window
 * when now() is outside (tournament.starts_at - 1h, tournament.ends_at + 1d).
 * Saves vendor quota during the long pre/post-tournament periods.
 *
 * Idempotency: UPDATE fixtures uses the filter
 *   (result_home_90min IS NULL OR auto_fetched_at IS NOT NULL)
 * so admin-entered fixtures (result non-NULL + auto_fetched_at NULL) are
 * never overwritten. D-45 admin-overwrite invariant.
 *
 * Failure isolation: vendor errors / mapping failures / DB errors are
 * caught and logged inside after(); the route always returns 200 so
 * pg_cron retains the schedule. Manual entry at /admin/matches is the
 * canonical fallback.
 */
export async function POST(request: Request) {
  // 1. Bearer-auth gate.
  const secret = process.env.SCORE_FETCH_SECRET;
  if (!secret) {
    return new Response('Unauthorized', { status: 401 });
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 2. Tournament-window gate.
  const svc = createServiceClient();
  const { data: tour } = await svc
    .from('tournament')
    .select('starts_at, ends_at')
    .order('starts_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const now = Date.now();
  const startsAt = tour ? new Date(tour.starts_at).getTime() : Number.POSITIVE_INFINITY;
  const endsAt = tour ? new Date(tour.ends_at).getTime() : Number.NEGATIVE_INFINITY;
  const inWindow = now >= startsAt - 3_600_000 && now <= endsAt + 86_400_000;

  if (!inWindow) {
    return NextResponse.json({ ok: true, skipped: 'outside-tournament-window' });
  }

  // 3. Schedule the heavy work in after() — keeps the cron's HTTP roundtrip snappy.
  after(async () => {
    try {
      const matches = await fetchWcMatches({ sinceDays: 1 });
      let writes = 0;
      let mappingFailures = 0;

      for (const m of matches) {
        if (m.status !== 'FINISHED') continue;
        const h = m.score.fullTime.home;
        const a = m.score.fullTime.away;
        if (h === null || a === null) continue;

        const fixtureId = await resolveFixture(svc, m);
        if (!fixtureId) {
          mappingFailures++;
          // eslint-disable-next-line no-console
          console.warn('score-fetch: no fixture resolved', {
            utcDate: m.utcDate,
            home: m.homeTeam.tla,
            away: m.awayTeam.tla,
          });
          continue;
        }

        // B4 (Revision iteration 2 2026-05-26): SELECT-then-UPDATE with the
        // admin-lock invariant evaluated in JavaScript. Iteration 1 used a
        // single UPDATE...WHERE id=? AND (.or() filter), but PostgREST's
        // .or() is filter-level (not boolean-AND with .eq()) and its
        // observable semantics drift across @supabase/supabase-js minor
        // versions. A future version could silently emit `WHERE id=? OR
        // result IS NULL OR auto_fetched_at IS NOT NULL` — a catastrophic
        // mass-update. Defense-in-depth: explicit two-query path is
        // immune to PostgREST builder semantics and adds only ~10ms per
        // fixture (104 fixtures * */15 cadence = trivial).
        const { data: fixture, error: selErr } = await svc
          .from('fixtures')
          .select('id, result_home_90min, auto_fetched_at')
          .eq('id', fixtureId)
          .single();
        if (selErr) {
          // eslint-disable-next-line no-console
          console.error('score-fetch select error', selErr);
          continue;
        }

        // Admin-lock invariant: skip if admin entered manually
        // (result NOT NULL AND auto_fetched_at IS NULL).
        const adminEntered =
          fixture.result_home_90min !== null && fixture.auto_fetched_at === null;
        if (adminEntered) continue;

        // Simple .eq() UPDATE — no .or() ambiguity possible.
        const { error: upErr } = await svc
          .from('fixtures')
          .update({
            result_home_90min: h,
            result_away_90min: a,
            auto_fetched_at: new Date().toISOString(),
          })
          .eq('id', fixtureId);
        if (upErr) {
          // eslint-disable-next-line no-console
          console.error('score-fetch update error', upErr);
          continue;
        }

        // SELECT predictions and sweep.
        const { data: preds, error: predErr } = await svc
          .from('predictions')
          .select('user_id, home_score, away_score')
          .eq('fixture_id', fixtureId);
        if (predErr) {
          // eslint-disable-next-line no-console
          console.error('score-fetch predictions read error', predErr);
          continue;
        }

        const rows: ScoreEventRow[] = (preds ?? []).map((p) => {
          const { points, kind } = scoreMatch(
            { home_score: p.home_score, away_score: p.away_score },
            { result_home_90min: h, result_away_90min: a },
          );
          return {
            user_id: p.user_id,
            source: 'league' as const,
            ref_id: fixtureId,
            points,
            kind: kind as LeagueKind,
          };
        });

        const sweepRes = await sweepAndUpsert({
          svc,
          source: 'league',
          ref_id: fixtureId,
          rows,
        });
        if (!sweepRes.ok) {
          // eslint-disable-next-line no-console
          console.error('score-fetch sweep error', sweepRes.error);
          continue;
        }

        writes++;
      }

      // eslint-disable-next-line no-console
      console.log('score-fetch ok', {
        processed: matches.length,
        writes,
        mappingFailures,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('score-fetch failed', err);
    }
  });

  return NextResponse.json({ ok: true, scheduled: true });
}

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

// Never cached; cron must actually execute the DB query each invocation.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Vercel Cron target (FND-05; CONTEXT.md D-18).
 *
 * Schedule: every 3 days at 12:00 UTC (vercel.json).
 * Purpose: keep the Supabase free tier from auto-pausing after 7 days of no DB activity.
 *
 * IMPORTANT: this must execute a REAL DB query against a real table — NOT just `select 1`.
 * Verify pings via Supabase Postgres logs, not just Vercel function logs (per RESEARCH Pitfall 6).
 *
 * Auth posture: PUBLIC by default (per CONTEXT.md D-18). Side-effect-free + idempotent;
 * the only "leak" is an attacker triggering an extra DB ping (harmless single-row SELECT).
 * Vercel Cron supports `Authorization: Bearer <secret>` since 2025 — if you want to lock
 * this route down, set `CRON_SECRET` in Vercel env vars and the guard below activates
 * automatically. Leaving CRON_SECRET unset keeps the public-acceptance behavior.
 */
export async function GET(request: Request) {
  // W2 optional CRON_SECRET: Vercel Cron supports `Authorization: Bearer <secret>` since 2025.
  // The check is OPT-IN — gated on process.env.CRON_SECRET being set — so the current
  // public-acceptance behavior (per CONTEXT.md D-18) still works when no secret is configured.
  // To enable: add CRON_SECRET to Vercel env vars; Vercel automatically attaches the header
  // to scheduled cron invocations. See Vercel Cron Jobs docs > "Securing Cron Jobs."
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const supabase = createServiceClient();
  const startedAt = Date.now();
  const { error } = await supabase.from('fixtures').select('id').limit(1);
  const durationMs = Date.now() - startedAt;

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message, pinged_at: new Date().toISOString() },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      pinged_at: new Date().toISOString(),
      duration_ms: durationMs,
    },
    { status: 200 },
  );
}

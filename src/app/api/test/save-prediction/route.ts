// src/app/api/test/save-prediction/route.ts
//
// TEST-ONLY route — exposes the savePrediction Server Action over JSON for
// the Plan 02-08 Playwright smoke (QA-01).
//
// FOLDER NAME: must be `test/`, NOT `_test/`. Next.js App Router excludes
// underscore-prefixed folders from routing entirely (private-folder
// convention) — the route returns 404 even when the file exists. The
// production-safety boundary is the NODE_ENV + PLAYWRIGHT_INVITE_CODE gate
// below, NOT the folder name.
//
// Hard gate (T-02-08-07): in production, this route MUST return 403 unless
// PLAYWRIGHT_INVITE_CODE is set on the server. Production Vercel deploys
// MUST NOT set PLAYWRIGHT_INVITE_CODE (it's a CI-only secret per
// 02-USER-SETUP.md). Verification: `curl https://zarur-cup.vercel.app/api/test/save-prediction`
// MUST return 403 with no body.
//
// Why this route exists: the savePrediction Server Action's wire protocol
// (Next.js multipart with an opaque action ID) is not stable across builds,
// so calling it from a Playwright `request.post` directly is fragile. A thin
// JSON wrapper that calls the action server-side is the simplest reliable
// path; it also lets us map the action's discriminated result to HTTP status
// (`{ ok: false, error: 'locked' }` → HTTP 403) so the smoke can assert
// either the status or the body.

import { NextRequest, NextResponse } from 'next/server';
import { savePrediction } from '@/app/actions/savePrediction';

export async function POST(req: NextRequest) {
  // Production gate: refuse unless this is a CI/test deploy.
  // PLAYWRIGHT_INVITE_CODE is a CI-only secret per 02-USER-SETUP.md — its
  // presence is the canonical "this is a test runner" signal.
  if (
    process.env.NODE_ENV === 'production' &&
    !process.env.PLAYWRIGHT_INVITE_CODE
  ) {
    return NextResponse.json(
      { ok: false, error: 'unauthenticated' },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'validation' },
      { status: 400 },
    );
  }

  const result = await savePrediction(body);

  // Map 'locked' (RLS rejection — Phase 1 42501 → action 'locked') to HTTP
  // 403 so the smoke can assert either status OR body.
  if (!result.ok && result.error === 'locked') {
    return NextResponse.json(result, { status: 403 });
  }
  if (!result.ok && result.error === 'unauthenticated') {
    return NextResponse.json(result, { status: 401 });
  }
  if (!result.ok && result.error === 'validation') {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}

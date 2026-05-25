// tests/e2e/global-teardown.ts
//
// Playwright globalTeardown — runs once after the entire suite (Plan 02-08
// Task 2). Two-step cleanup:
//
//   1. Run `npm run db:test-clean` to remove the SMOKE_PRE_LOCK /
//      SMOKE_POST_LOCK fixtures + SmokeUser profile/predictions/score_events
//      cascade (psql can't touch auth.users).
//   2. Iterate auth.users via the Supabase Admin API and delete any users
//      tagged with user_metadata.smoke_test === true (defense in depth so
//      the auth.users table doesn't accumulate orphans after a failed run).

import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

export default async function globalTeardown() {
  // 1. Clean DB-side test fixtures + SmokeUser cascade via SQL.
  try {
    execSync('npm run db:test-clean', { stdio: 'inherit' });
  } catch (e) {
    console.warn('db:test-clean failed:', (e as Error).message);
  }

  // 2. Clean auth.users rows for SmokeUser (only the Admin API can do this).
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) {
      console.warn(
        'global-teardown: SUPABASE_SECRET_KEY missing — skipping auth.users cleanup',
      );
      return;
    }
    const svc = createClient(url, key, {
      auth: { persistSession: false },
    });
    // The SmokeUser profile rows were already deleted by db:test-clean; find
    // any orphan auth.users by listing all anon users and matching the smoke
    // metadata tag.
    const { data: users } = await svc.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    for (const u of users?.users ?? []) {
      const meta = u.user_metadata as { smoke_test?: boolean } | undefined;
      const tagged = meta?.smoke_test === true;
      const emailTagged = u.email?.includes('smoke_test') === true;
      if (tagged || emailTagged) {
        await svc.auth.admin.deleteUser(u.id);
      }
    }
  } catch (e) {
    console.warn('auth.users cleanup skipped:', (e as Error).message);
  }
}

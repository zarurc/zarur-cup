/**
 * Roll back everything scripts/seed-preview.cjs created. Idempotent — safe to
 * run multiple times. Safe to run when seed has not been run (no-op).
 *
 *   node --env-file=.env.local scripts/cleanup-preview.cjs
 *
 * Deletes in dependency order so cascades cannot leave orphans:
 *   1. score_events with ref_id IN synthetic fixtures (NOT FK-cascaded by fixtures;
 *      score_events.ref_id is polymorphic)
 *   2. auth.users where user_metadata.preview_seed === true
 *      (cascades profiles, predictions, prop_answers, bracket_picks, remaining score_events)
 *   3. fixtures where external_match_no IN [9100, 9199]
 *      (cascades any predictions from non-preview users that may have hit these synthetic rows)
 */

const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    'Missing env. Run with: node --env-file=.env.local scripts/cleanup-preview.cjs',
  );
  process.exit(1);
}

const svc = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws },
});

const PREVIEW_FIXTURE_MIN = 9100;
const PREVIEW_FIXTURE_MAX = 9199;

async function main() {
  console.log('Cleaning up preview data...\n');

  // 1. Synthetic fixtures
  const { data: fixtures, error: fErr } = await svc
    .from('fixtures')
    .select('id, external_match_no')
    .gte('external_match_no', PREVIEW_FIXTURE_MIN)
    .lte('external_match_no', PREVIEW_FIXTURE_MAX);
  if (fErr) {
    console.error('fixtures select:', fErr);
    process.exit(1);
  }
  const fixtureIds = (fixtures ?? []).map((f) => f.id);
  console.log(`  found ${fixtureIds.length} synthetic fixtures (external_match_no 9100-9199)`);

  // 2. score_events for these fixtures (catches admin/zekez's score_events too if they have any)
  if (fixtureIds.length > 0) {
    const { error } = await svc
      .from('score_events')
      .delete()
      .eq('source', 'league')
      .in('ref_id', fixtureIds);
    if (error) {
      console.error('score_events delete:', error);
      process.exit(1);
    }
    console.log(`  deleted league score_events for synthetic fixtures`);
  }

  // 3. Fake auth.users — cascades profiles, predictions, prop_answers, remaining score_events
  let allUsers = [];
  let page = 1;
  while (true) {
    const { data: list, error } = await svc.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) {
      console.error('listUsers:', error);
      break;
    }
    if (!list?.users?.length) break;
    allUsers.push(...list.users);
    if (list.users.length < 200) break;
    page += 1;
  }
  const previewUsers = allUsers.filter(
    (u) => u.user_metadata?.preview_seed === true,
  );
  console.log(`  found ${previewUsers.length} preview auth.users`);

  for (const u of previewUsers) {
    const { error } = await svc.auth.admin.deleteUser(u.id);
    if (error) {
      console.warn(`  failed to delete user ${u.id}:`, error.message);
    } else {
      console.log(`  deleted user ${u.user_metadata?.display_name_seed ?? u.id}`);
    }
  }

  // 4. Synthetic fixtures (cascades any remaining predictions, e.g., zekez's)
  if (fixtureIds.length > 0) {
    const { error } = await svc.from('fixtures').delete().in('id', fixtureIds);
    if (error) {
      console.error('fixtures delete:', error);
      process.exit(1);
    }
    console.log(`  deleted ${fixtureIds.length} synthetic fixtures`);
  }

  console.log('\nPreview data cleaned up.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

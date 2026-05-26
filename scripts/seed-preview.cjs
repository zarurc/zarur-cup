/**
 * Preview-data seed — exercises features that don't render until the tournament
 * actually starts (MatchRowResulted + per-player picks reveal, populated
 * leaderboard with rankings, locked variant with the user's frozen pick).
 *
 * Idempotent. Run cleanup script when done.
 *
 *   node --env-file=.env.local scripts/seed-preview.cjs
 *
 * Markers (used by scripts/cleanup-preview.cjs to roll back cleanly):
 *   - Fixtures: external_match_no in [9100, 9199]
 *   - Auth users: user_metadata.preview_seed === true (+ email @preview.zarur-cup.test)
 *
 * Synthetic data:
 *   - 4 fixtures spanning all three row variants
 *   - 3 fake users with bilingual display names
 *   - Varied predictions producing distinct point totals on the leaderboard
 */

const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    'Missing env. Run with: node --env-file=.env.local scripts/seed-preview.cjs',
  );
  process.exit(1);
}

const svc = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws },
});

// Mirrors src/lib/scoring/league.ts:scoreMatch — keep in lockstep.
function scoreMatch(p, r) {
  if (p.home_score === r.result_home_90min && p.away_score === r.result_away_90min) {
    return { points: 4, kind: 'exact' };
  }
  const predDiff = p.home_score - p.away_score;
  const realDiff = r.result_home_90min - r.result_away_90min;
  if (predDiff === realDiff && predDiff !== 0) {
    return { points: 3, kind: 'goal-diff' };
  }
  if (Math.sign(predDiff) === Math.sign(realDiff)) {
    return { points: 2, kind: 'winner' };
  }
  return { points: 0, kind: 'miss' };
}

async function main() {
  console.log('Seeding preview data...\n');

  // 1. Tournament + team IDs
  const { data: tournament, error: tErr } = await svc
    .from('tournament')
    .select('id')
    .eq('code', 'WC2026')
    .single();
  if (tErr || !tournament) {
    console.error('Tournament WC2026 not found:', tErr);
    process.exit(1);
  }

  const TEAM_CODES = ['BRA', 'ARG', 'MEX', 'CAN', 'USA', 'POR', 'GER', 'FRA'];
  const { data: teams, error: teamErr } = await svc
    .from('teams')
    .select('id, code')
    .in('code', TEAM_CODES);
  if (teamErr) {
    console.error('Failed to load teams:', teamErr);
    process.exit(1);
  }
  const team = Object.fromEntries(teams.map((t) => [t.code, t.id]));
  for (const c of TEAM_CODES) {
    if (!team[c]) {
      console.error(`Team ${c} not found in DB`);
      process.exit(1);
    }
  }

  // 2. Synthetic fixtures — exercise all three row variants
  const now = Date.now();
  const ISO = (offsetMs) => new Date(now + offsetMs).toISOString();

  const fixtures = [
    {
      external_match_no: 9100,
      kickoff_at: ISO(-3 * 3600 * 1000), // 3h ago
      home: 'BRA',
      away: 'ARG',
      result_home_90min: 2,
      result_away_90min: 1,
      label: 'resulted (BRA 2:1 ARG)',
    },
    {
      external_match_no: 9101,
      kickoff_at: ISO(-1 * 3600 * 1000), // 1h ago
      home: 'MEX',
      away: 'CAN',
      result_home_90min: 1,
      result_away_90min: 0,
      label: 'resulted (MEX 1:0 CAN)',
    },
    {
      external_match_no: 9102,
      kickoff_at: ISO(-30 * 60 * 1000), // 30min ago
      home: 'USA',
      away: 'POR',
      result_home_90min: null,
      result_away_90min: null,
      label: 'locked, no result yet',
    },
    {
      external_match_no: 9103,
      kickoff_at: ISO(4 * 3600 * 1000), // 4h from now
      home: 'GER',
      away: 'FRA',
      result_home_90min: null,
      result_away_90min: null,
      label: 'future editable',
    },
  ];

  for (const fx of fixtures) {
    const { data: existing } = await svc
      .from('fixtures')
      .select('id')
      .eq('external_match_no', fx.external_match_no)
      .maybeSingle();

    const payload = {
      tournament_id: tournament.id,
      external_match_no: fx.external_match_no,
      stage: 'group',
      group_code: null,
      kickoff_at: fx.kickoff_at,
      home_team_id: team[fx.home],
      away_team_id: team[fx.away],
      home_placeholder: null,
      away_placeholder: null,
      result_home_90min: fx.result_home_90min,
      result_away_90min: fx.result_away_90min,
    };

    if (existing) {
      const { error } = await svc.from('fixtures').update(payload).eq('id', existing.id);
      if (error) {
        console.error(`fixture update ${fx.external_match_no}:`, error);
        process.exit(1);
      }
      fx.id = existing.id;
    } else {
      const { data: ins, error } = await svc
        .from('fixtures')
        .insert(payload)
        .select('id')
        .single();
      if (error) {
        console.error(`fixture insert ${fx.external_match_no}:`, error);
        process.exit(1);
      }
      fx.id = ins.id;
    }
    console.log(`  fixture ${fx.external_match_no} (${fx.label})`);
  }

  // 3. Fake users — mixed-script display names to exercise bidi
  const fakeUsers = [
    { display_name: '[Preview] אבא', locale: 'he' },
    { display_name: '[Preview] אמא', locale: 'he' },
    { display_name: '[Preview] Cousin Dan', locale: 'en' },
  ];

  for (const u of fakeUsers) {
    const { data: existing } = await svc
      .from('profiles')
      .select('user_id')
      .eq('display_name', u.display_name)
      .maybeSingle();

    if (existing) {
      u.user_id = existing.user_id;
      console.log(`  user "${u.display_name}" already exists`);
      continue;
    }

    const slug = u.display_name
      .toLowerCase()
      .replace(/\[preview\]/g, 'preview')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const email = `${slug || 'user'}-${Date.now()}@preview.zarur-cup.test`;

    const { data: created, error: cErr } = await svc.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { preview_seed: true, display_name_seed: u.display_name },
    });
    if (cErr || !created?.user) {
      console.error('auth.admin.createUser:', cErr);
      process.exit(1);
    }
    u.user_id = created.user.id;

    const { error: pErr } = await svc.from('profiles').insert({
      user_id: created.user.id,
      display_name: u.display_name,
      locale: u.locale,
      is_admin: false,
    });
    if (pErr) {
      console.error(`profile insert "${u.display_name}":`, pErr);
      // Try to roll back the auth user since profile failed
      await svc.auth.admin.deleteUser(created.user.id).catch(() => {});
      process.exit(1);
    }
    console.log(`  created user "${u.display_name}"`);
  }

  // 4. Predictions — varied so the leaderboard has distinct totals
  // 9100 (BRA 2:1 ARG, realDiff=1):
  //   אבא 2:1 → exact (4)   |   אמא 3:1 → winner (2)   |   Cousin 1:2 → miss (0)
  // 9101 (MEX 1:0 CAN, realDiff=1):
  //   אבא 0:1 → miss (0)    |   אמא 1:0 → exact (4)    |   Cousin 2:1 → goal-diff (3)
  // 9102 (USA:POR locked, no result):
  //   אבא 1:0  |  אמא 2:1  |  Cousin 0:0
  // 9103 (GER:FRA future): leave empty so zekez can interact with the stepper.
  const predictions = [
    { user: 0, fixture: 9100, home: 2, away: 1 },
    { user: 1, fixture: 9100, home: 3, away: 1 },
    { user: 2, fixture: 9100, home: 1, away: 2 },
    { user: 0, fixture: 9101, home: 0, away: 1 },
    { user: 1, fixture: 9101, home: 1, away: 0 },
    { user: 2, fixture: 9101, home: 2, away: 1 },
    { user: 0, fixture: 9102, home: 1, away: 0 },
    { user: 1, fixture: 9102, home: 2, away: 1 },
    { user: 2, fixture: 9102, home: 0, away: 0 },
  ];

  const fxByNum = Object.fromEntries(fixtures.map((f) => [f.external_match_no, f]));
  for (const p of predictions) {
    const fx = fxByNum[p.fixture];
    const u = fakeUsers[p.user];
    const { error } = await svc.from('predictions').upsert(
      {
        user_id: u.user_id,
        fixture_id: fx.id,
        home_score: p.home,
        away_score: p.away,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,fixture_id' },
    );
    if (error) {
      console.error('prediction upsert:', error);
      process.exit(1);
    }
  }
  console.log(`  inserted ${predictions.length} predictions`);

  // 5. score_events for resulted fixtures — replicates saveResult's sweep+upsert
  for (const fx of fixtures.filter((f) => f.result_home_90min !== null)) {
    const { data: preds } = await svc
      .from('predictions')
      .select('user_id, home_score, away_score')
      .eq('fixture_id', fx.id);

    const rows = (preds ?? []).map((pred) => {
      const { points, kind } = scoreMatch(
        { home_score: pred.home_score, away_score: pred.away_score },
        { result_home_90min: fx.result_home_90min, result_away_90min: fx.result_away_90min },
      );
      return {
        user_id: pred.user_id,
        source: 'league',
        ref_id: fx.id,
        points,
        kind,
      };
    });

    if (rows.length > 0) {
      // Sweep stragglers (users who no longer have a prediction)
      const keep = rows.map((r) => r.user_id);
      const inList = `(${keep.join(',')})`;
      await svc
        .from('score_events')
        .delete()
        .eq('source', 'league')
        .eq('ref_id', fx.id)
        .not('user_id', 'in', inList);

      const { error } = await svc
        .from('score_events')
        .upsert(rows, { onConflict: 'user_id,source,ref_id' });
      if (error) {
        console.error('score_events upsert:', error);
        process.exit(1);
      }
    }
    console.log(
      `  scored ${rows.length} predictions on fixture ${fx.external_match_no}`,
    );
  }

  console.log('\nPreview data seeded.');
  console.log('\nRefresh https://zarur-cup.vercel.app/he/matches on your phone.');
  console.log('You should see:');
  console.log('  - 4 new fixtures at the top of the matches feed (BRA:ARG, MEX:CAN, USA:POR, GER:FRA)');
  console.log('  - BRA:ARG and MEX:CAN render as the RESULTED variant with per-player picks');
  console.log('  - USA:POR renders as the LOCKED variant');
  console.log('  - GER:FRA renders as the EDITABLE variant — try the stepper');
  console.log('  - /he/leaderboard shows: אמא (6) > אבא (4) > Cousin Dan (3) > you (0)');
  console.log('  - /he/me shows your total (0 unless you predict on the editable ones)');
  console.log('\nWhen done: node --env-file=.env.local scripts/cleanup-preview.cjs');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

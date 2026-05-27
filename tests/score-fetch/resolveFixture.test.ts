import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveFixture } from '../../src/lib/score-fetch/resolveFixture.js';
import type { ExternalMatch } from '../../src/lib/score-fetch/footballData.js';

// Load fixtures + teams CSVs (header + comment lines start with #).
function loadCsv(path: string): string[][] {
  const raw = readFileSync(path, 'utf8');
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0 && !l.startsWith('#'));
  if (lines.length === 0) return [];
  const [header, ...rest] = lines;
  void header;
  return rest.map((l) => l.split(','));
}

type Team = { id: string; code: string };
type Fixture = {
  id: string;
  home_team_id: string | null;
  away_team_id: string | null;
  kickoff_at: string;
};

function buildMockClient(teams: Team[], fixtures: Fixture[]) {
  return {
    from(table: string) {
      if (table === 'teams') {
        return {
          select() {
            return {
              async in(_col: string, codes: string[]) {
                const rows = teams.filter((t) => codes.includes(t.code));
                return { data: rows, error: null };
              },
            };
          },
        };
      }
      if (table === 'fixtures') {
        // W1 (Revision iteration 2 2026-05-26): thenable builder.
        // Iteration 1 special-cased .lte() as the terminal call which made
        // the mock fragile to caller refactors (any reordering of .gte/.lte/.eq
        // would silently produce wrong results). Now the chain is a real
        // promise-builder: it accumulates filters and resolves on await
        // regardless of the order or count of chained methods.
        const filters: Record<string, string> = {};
        let lowerBound = '';
        let upperBound = '';
        const evaluate = () =>
          fixtures.filter(
            (f) =>
              (filters.home_team_id === undefined || f.home_team_id === filters.home_team_id) &&
              (filters.away_team_id === undefined || f.away_team_id === filters.away_team_id) &&
              (lowerBound === '' || f.kickoff_at >= lowerBound) &&
              (upperBound === '' || f.kickoff_at <= upperBound),
          );
        const chain: Record<string, unknown> = {
          select() {
            return chain;
          },
          eq(col: string, val: string) {
            filters[col] = val;
            return chain;
          },
          gte(_col: string, val: string) {
            lowerBound = val;
            return chain;
          },
          lte(_col: string, val: string) {
            upperBound = val;
            return chain;
          },
          then(onFulfilled: (v: { data: unknown; error: unknown }) => unknown) {
            return Promise.resolve({ data: evaluate(), error: null }).then(onFulfilled);
          },
        };
        return chain;
      }
      throw new Error(`mock client does not support table ${table}`);
    },
  };
}

test('resolveFixture maps all seeded group-stage fixtures by TLA + kickoff tuple', async () => {
  const teamRows = loadCsv('data/wc2026/teams.csv');
  // teams.csv columns: code, name_en, name_he, group_code
  // Synthesize sequential UUIDs for the mock.
  const teams: Team[] = teamRows.map((r, i) => ({
    id: `team-${String(i).padStart(3, '0')}`,
    code: r[0],
  }));

  const fixtureRows = loadCsv('data/wc2026/fixtures.csv');
  // fixtures.csv columns: external_match_no, stage, group_code,
  //   home_code, away_code, home_placeholder, away_placeholder,
  //   kickoff_at_utc, venue_code
  const fixtures: Fixture[] = [];
  let resolved = 0;
  for (const r of fixtureRows) {
    const [matchNo, stage, , homeCode, awayCode, homePh, awayPh, kickoff] = r;
    void stage;
    void matchNo;
    // Only fixtures with both teams resolved (no placeholder) participate;
    // group stage all qualify; KO stage starts with placeholders and only
    // resolves after group stage.
    if (homePh.length > 0 || awayPh.length > 0) continue;
    if (homeCode.length === 0 || awayCode.length === 0) continue;
    const home = teams.find((t) => t.code === homeCode);
    const away = teams.find((t) => t.code === awayCode);
    if (!home || !away) continue;
    fixtures.push({
      id: `fixture-${String(fixtures.length).padStart(3, '0')}`,
      home_team_id: home.id,
      away_team_id: away.id,
      kickoff_at: kickoff,
    });
    resolved++;
  }

  // Assert we have all 72 group-stage fixtures (104 total - 32 KO placeholders).
  assert.ok(
    fixtures.length >= 72,
    `expected at least 72 group-stage fixtures, got ${fixtures.length}`,
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = buildMockClient(teams, fixtures) as any;

  let mappedCount = 0;
  for (const f of fixtures) {
    const home = teams.find((t) => t.id === f.home_team_id)!;
    const away = teams.find((t) => t.id === f.away_team_id)!;
    const ext: ExternalMatch = {
      utcDate: f.kickoff_at,
      status: 'FINISHED',
      homeTeam: { id: 1, name: 'X', tla: home.code },
      awayTeam: { id: 2, name: 'Y', tla: away.code },
      score: { fullTime: { home: 1, away: 0 } },
    };
    const result = await resolveFixture(svc, ext);
    assert.equal(result, f.id, `fixture ${f.id} (${home.code} vs ${away.code}) did not resolve`);
    mappedCount++;
  }
  assert.equal(mappedCount, fixtures.length);
  void resolved;
});

test('resolveFixture returns null when TLA codes do not match a seeded team', async () => {
  const teams: Team[] = [{ id: 't1', code: 'MEX' }, { id: 't2', code: 'BRA' }];
  const fixtures: Fixture[] = [
    {
      id: 'f1',
      home_team_id: 't1',
      away_team_id: 't2',
      kickoff_at: '2026-06-11T19:00:00Z',
    },
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = buildMockClient(teams, fixtures) as any;
  const ext: ExternalMatch = {
    utcDate: '2026-06-11T19:00:00Z',
    status: 'FINISHED',
    homeTeam: { id: 1, name: 'X', tla: 'XXX' }, // unseeded
    awayTeam: { id: 2, name: 'Y', tla: 'BRA' },
    score: { fullTime: { home: 1, away: 0 } },
  };
  const result = await resolveFixture(svc, ext);
  assert.equal(result, null);
});

test('resolveFixture returns null when kickoff is outside +/- 5min window', async () => {
  const teams: Team[] = [{ id: 't1', code: 'MEX' }, { id: 't2', code: 'BRA' }];
  const fixtures: Fixture[] = [
    {
      id: 'f1',
      home_team_id: 't1',
      away_team_id: 't2',
      kickoff_at: '2026-06-11T19:00:00Z',
    },
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = buildMockClient(teams, fixtures) as any;
  const ext: ExternalMatch = {
    utcDate: '2026-06-11T19:30:00Z', // 30 min off
    status: 'FINISHED',
    homeTeam: { id: 1, name: 'X', tla: 'MEX' },
    awayTeam: { id: 2, name: 'Y', tla: 'BRA' },
    score: { fullTime: { home: 1, away: 0 } },
  };
  const result = await resolveFixture(svc, ext);
  assert.equal(result, null);
});

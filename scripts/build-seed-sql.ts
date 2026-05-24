#!/usr/bin/env tsx
/**
 * scripts/build-seed-sql.ts
 *
 * Reads the four CSV files under data/wc2026/ and emits an idempotent
 * Postgres migration at supabase/migrations/0005_seed_wc2026.sql.
 *
 * Output filename note ([Rule 3 - Blocking] deviation): Phase 1 already
 * shipped four migrations (0001..0004). The plan called for the seed to
 * be 0003 but that filename is taken. Migrations are append-only per the
 * Pattern 6 convention from Plan 01-02 — never edit a pushed migration,
 * always add a new sequential one. The next sequential number is 0005.
 *
 * Idempotency: every INSERT uses `on conflict ... do update` so a
 * corrected Hebrew name (DATA-04) can be re-applied by editing the CSV
 * and re-running `npm run seed:build && npm run db:push`.
 *
 * Defense in depth: duplicate `code` values in teams.csv throw at
 * SQL-gen time (in addition to the CSV-level awk gate and the schema's
 * unique(tournament_id, code)).
 *
 * Usage:
 *   npm run seed:build
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

const DATA_DIR = resolve(ROOT, "data/wc2026");
const OUTPUT_PATH = resolve(ROOT, "supabase/migrations/0005_seed_wc2026.sql");

// ----------------------------------------------------------------
// CSV parser (CSV-spec compliant: handles quoted fields, doubled
// quotes, embedded commas in quoted fields). Lines starting with
// `#` after optional whitespace are treated as comments and skipped.
// ----------------------------------------------------------------
function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/);
  const out: string[][] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    out.push(parseLine(line));
  }
  if (out.length === 0) throw new Error("empty CSV");
  const header = out.shift()!;
  return { header, rows: out };
}

function parseLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  let field = "";
  let inQuotes = false;
  while (i < line.length) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        field += '"';
        i += 2;
        continue;
      }
      if (c === '"') {
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      fields.push(field);
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  fields.push(field);
  return fields.map((f) => f.trim());
}

// SQL quoting helpers
function sqlStr(v: string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "null";
  // Postgres: double up single quotes
  return `'${v.replace(/'/g, "''")}'`;
}
function sqlInt(v: string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "null";
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`expected integer, got: ${JSON.stringify(v)}`);
  return String(n);
}

// ----------------------------------------------------------------
// Load CSVs
// ----------------------------------------------------------------
const teamsRaw = readFileSync(resolve(DATA_DIR, "teams.csv"), "utf8");
const fixturesRaw = readFileSync(resolve(DATA_DIR, "fixtures.csv"), "utf8");
const slotsRaw = readFileSync(resolve(DATA_DIR, "bracket_slots.csv"), "utf8");
const propsRaw = readFileSync(resolve(DATA_DIR, "prop_questions.csv"), "utf8");

const teams = parseCsv(teamsRaw);
const fixtures = parseCsv(fixturesRaw);
const slots = parseCsv(slotsRaw);
const props = parseCsv(propsRaw);

// ----------------------------------------------------------------
// Defense-in-depth gates
// ----------------------------------------------------------------
function colIndex(header: string[], col: string): number {
  const i = header.indexOf(col);
  if (i < 0) throw new Error(`Expected column '${col}' missing from header: ${header.join(",")}`);
  return i;
}

// 1. Teams: no duplicate `code` values; every row has name_en + name_he non-empty.
{
  const codeIdx = colIndex(teams.header, "code");
  const nameEnIdx = colIndex(teams.header, "name_en");
  const nameHeIdx = colIndex(teams.header, "name_he");
  const seen = new Set<string>();
  for (const row of teams.rows) {
    const code = row[codeIdx];
    if (!code) throw new Error(`teams.csv row missing code: ${row.join(",")}`);
    if (seen.has(code)) throw new Error(`teams.csv duplicate code: ${code}`);
    seen.add(code);
    if (!row[nameEnIdx]) throw new Error(`teams.csv row ${code} missing name_en`);
    if (!row[nameHeIdx]) throw new Error(`teams.csv row ${code} missing name_he`);
  }
}

// 2. Fixtures: kickoff_at_utc must end in 'Z' or '+00:00'; KO rows must have at least one placeholder.
{
  const stageIdx = colIndex(fixtures.header, "stage");
  const homeCodeIdx = colIndex(fixtures.header, "home_code");
  const awayCodeIdx = colIndex(fixtures.header, "away_code");
  const homePhIdx = colIndex(fixtures.header, "home_placeholder");
  const awayPhIdx = colIndex(fixtures.header, "away_placeholder");
  const kickoffIdx = colIndex(fixtures.header, "kickoff_at_utc");
  for (const row of fixtures.rows) {
    const kickoff = row[kickoffIdx];
    if (!/Z$|\+00:00$/.test(kickoff)) {
      throw new Error(`fixtures.csv kickoff_at_utc not UTC: ${kickoff}`);
    }
    const stage = row[stageIdx];
    if (stage !== "group") {
      // knockout row: must have at least one placeholder OR a team code (typically both placeholders)
      if (!row[homePhIdx] && !row[homeCodeIdx]) {
        throw new Error(`KO fixture missing home_placeholder or home_code: ${row.join(",")}`);
      }
      if (!row[awayPhIdx] && !row[awayCodeIdx]) {
        throw new Error(`KO fixture missing away_placeholder or away_code: ${row.join(",")}`);
      }
    } else {
      // group row: must have both team codes filled and no placeholder
      if (!row[homeCodeIdx] || !row[awayCodeIdx]) {
        throw new Error(`group fixture missing team code: ${row.join(",")}`);
      }
    }
  }
}

// 3. Bracket slots: exactly one row with empty parent_slot_code (CHAMPION).
{
  const slotIdx = colIndex(slots.header, "slot_code");
  const parentIdx = colIndex(slots.header, "parent_slot_code");
  const noParent = slots.rows.filter((r) => !r[parentIdx]);
  if (noParent.length !== 1) {
    throw new Error(
      `bracket_slots.csv expected exactly 1 root slot (no parent), found ${noParent.length}`,
    );
  }
  if (noParent[0][slotIdx] !== "CHAMPION") {
    throw new Error(
      `bracket_slots.csv root slot expected CHAMPION, got ${noParent[0][slotIdx]}`,
    );
  }
}

// 4. Prop questions: answer_type must be in the schema CHECK set.
{
  const codeIdx = colIndex(props.header, "code");
  const answerIdx = colIndex(props.header, "answer_type");
  const allowed = new Set(["single_team", "single_player", "text"]);
  for (const row of props.rows) {
    if (!allowed.has(row[answerIdx])) {
      throw new Error(
        `prop_questions.csv ${row[codeIdx]} bad answer_type: ${row[answerIdx]}`,
      );
    }
  }
}

// ----------------------------------------------------------------
// Emit SQL
// ----------------------------------------------------------------
const out: string[] = [];
const generatedAt = new Date().toISOString();

out.push(
  `-- Migration 0005: WC 2026 seed data.`,
  `-- Generated: ${generatedAt} from data/wc2026/*.csv by scripts/build-seed-sql.ts.`,
  `-- DO NOT HAND-EDIT THIS FILE. Edit the CSV and re-run \`npm run seed:build\`.`,
  `-- Idempotent: re-runs update existing rows via ON CONFLICT.`,
  `-- Migration numbering note ([Rule 3 - Blocking] deviation): the plan called`,
  `-- this 0003_seed_wc2026.sql but Plan 01-02 shipped 0001..0004. The next free`,
  `-- sequential number is 0005. Migrations are append-only (Pattern 6, Plan 01-02).`,
  `--`,
  `-- This entire migration runs in a single Postgres transaction so a failed`,
  `-- integrity check rolls back the whole seed (T-03-06 in the threat model).`,
  ``,
);

// === 1. Tournament row ===
out.push(`-- 1. Tournament row (single WC 2026 row).`);
out.push(`insert into public.tournament (code, name_en, name_he, starts_at, ends_at)`);
out.push(
  `values ('WC2026', 'FIFA World Cup 2026', 'גביע העולם 2026', '2026-06-11T20:00:00Z', '2026-07-19T23:59:59Z')`,
);
out.push(`on conflict (code) do update`);
out.push(`  set name_en = excluded.name_en,`);
out.push(`      name_he = excluded.name_he,`);
out.push(`      starts_at = excluded.starts_at,`);
out.push(`      ends_at = excluded.ends_at;`);
out.push(``);

// === 2. Teams ===
const teamCodeIdx = colIndex(teams.header, "code");
const teamNameEnIdx = colIndex(teams.header, "name_en");
const teamNameHeIdx = colIndex(teams.header, "name_he");
const teamGroupIdx = colIndex(teams.header, "group_code");

out.push(`-- 2. Teams (${teams.rows.length} rows).`);
out.push(`with t as (select id from public.tournament where code = 'WC2026')`);
out.push(`insert into public.teams (tournament_id, code, name_en, name_he, group_code) values`);
const teamValues = teams.rows.map((r) => {
  const code = sqlStr(r[teamCodeIdx]);
  const nameEn = sqlStr(r[teamNameEnIdx]);
  const nameHe = sqlStr(r[teamNameHeIdx]);
  const group = r[teamGroupIdx] ? sqlStr(r[teamGroupIdx]) : "null";
  return `  ((select id from t), ${code}, ${nameEn}, ${nameHe}, ${group})`;
});
out.push(teamValues.join(",\n"));
out.push(`on conflict (tournament_id, code) do update`);
out.push(`  set name_en = excluded.name_en,`);
out.push(`      name_he = excluded.name_he,`);
out.push(`      group_code = excluded.group_code;`);
out.push(``);

// === 3. Fixtures ===
const fxExtIdx = colIndex(fixtures.header, "external_match_no");
const fxStageIdx = colIndex(fixtures.header, "stage");
const fxGroupIdx = colIndex(fixtures.header, "group_code");
const fxHomeCodeIdx = colIndex(fixtures.header, "home_code");
const fxAwayCodeIdx = colIndex(fixtures.header, "away_code");
const fxHomePhIdx = colIndex(fixtures.header, "home_placeholder");
const fxAwayPhIdx = colIndex(fixtures.header, "away_placeholder");
const fxKickoffIdx = colIndex(fixtures.header, "kickoff_at_utc");
const fxVenueIdx = colIndex(fixtures.header, "venue_code");

out.push(`-- 3. Fixtures (${fixtures.rows.length} rows; group stage + 32 knockout with symbolic placeholders).`);
out.push(`-- Group rows: home_team_id + away_team_id resolved via team code subselect; placeholders null.`);
out.push(`-- KO rows:    home_team_id/away_team_id null; home_placeholder/away_placeholder set to symbolic refs.`);
out.push(`with t as (select id as tournament_id from public.tournament where code = 'WC2026')`);
out.push(
  `insert into public.fixtures (tournament_id, external_match_no, stage, group_code, home_team_id, away_team_id, home_placeholder, away_placeholder, kickoff_at, venue_code) values`,
);
const fxValues = fixtures.rows.map((r) => {
  const ext = sqlInt(r[fxExtIdx]);
  const stage = sqlStr(r[fxStageIdx]);
  const group = r[fxGroupIdx] ? sqlStr(r[fxGroupIdx]) : "null";
  const homeCode = r[fxHomeCodeIdx];
  const awayCode = r[fxAwayCodeIdx];
  const homePh = r[fxHomePhIdx];
  const awayPh = r[fxAwayPhIdx];
  const kickoff = sqlStr(r[fxKickoffIdx]);
  const venue = r[fxVenueIdx] ? sqlStr(r[fxVenueIdx]) : "null";
  const homeTeam = homeCode
    ? `(select id from public.teams where code = ${sqlStr(homeCode)} and tournament_id = (select tournament_id from t))`
    : "null";
  const awayTeam = awayCode
    ? `(select id from public.teams where code = ${sqlStr(awayCode)} and tournament_id = (select tournament_id from t))`
    : "null";
  const homePhSql = homePh ? sqlStr(homePh) : "null";
  const awayPhSql = awayPh ? sqlStr(awayPh) : "null";
  return `  ((select tournament_id from t), ${ext}, ${stage}, ${group}, ${homeTeam}, ${awayTeam}, ${homePhSql}, ${awayPhSql}, ${kickoff}, ${venue})`;
});
out.push(fxValues.join(",\n"));
out.push(`on conflict (tournament_id, external_match_no) do update`);
out.push(`  set stage = excluded.stage,`);
out.push(`      group_code = excluded.group_code,`);
out.push(`      home_team_id = excluded.home_team_id,`);
out.push(`      away_team_id = excluded.away_team_id,`);
out.push(`      home_placeholder = excluded.home_placeholder,`);
out.push(`      away_placeholder = excluded.away_placeholder,`);
out.push(`      kickoff_at = excluded.kickoff_at,`);
out.push(`      venue_code = excluded.venue_code,`);
out.push(`      updated_at = now();`);
out.push(``);

// === 4. Bracket slots (two-pass: insert without parent_slot_id, then UPDATE to wire) ===
const slotSlotIdx = colIndex(slots.header, "slot_code");
const slotStageIdx = colIndex(slots.header, "stage");
const slotParentIdx = colIndex(slots.header, "parent_slot_code");
const slotFixtureIdx = colIndex(slots.header, "fixture_external_match_no");

out.push(`-- 4. Bracket slots (${slots.rows.length} rows). Two-pass to handle parent_slot_id self-reference.`);
out.push(`-- Pass 1: insert all slots with fixture_id resolved; parent_slot_id stays null.`);
out.push(`with t as (select id as tournament_id from public.tournament where code = 'WC2026')`);
out.push(`insert into public.bracket_slots (tournament_id, slot_code, stage, fixture_id) values`);
const slotValues = slots.rows.map((r) => {
  const slot = sqlStr(r[slotSlotIdx]);
  const stage = sqlStr(r[slotStageIdx]);
  const fixture = r[slotFixtureIdx]
    ? `(select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = ${sqlInt(r[slotFixtureIdx])})`
    : "null";
  return `  ((select tournament_id from t), ${slot}, ${stage}, ${fixture})`;
});
out.push(slotValues.join(",\n"));
out.push(`on conflict (tournament_id, slot_code) do update`);
out.push(`  set stage = excluded.stage,`);
out.push(`      fixture_id = excluded.fixture_id;`);
out.push(``);

// Pass 2: wire parent_slot_id
out.push(`-- Pass 2: wire parent_slot_id from CSV's parent_slot_code mapping.`);
const slotsWithParent = slots.rows.filter((r) => r[slotParentIdx]);
if (slotsWithParent.length === 0) {
  out.push(`-- (no parent wiring needed)`);
} else {
  out.push(`update public.bracket_slots child`);
  out.push(`  set parent_slot_id = parent.id`);
  out.push(`  from public.bracket_slots parent`);
  out.push(
    `  where child.tournament_id = (select id from public.tournament where code = 'WC2026')`,
  );
  out.push(`    and parent.tournament_id = child.tournament_id`);
  out.push(`    and case child.slot_code`);
  for (const r of slotsWithParent) {
    out.push(`      when ${sqlStr(r[slotSlotIdx])} then parent.slot_code = ${sqlStr(r[slotParentIdx])}`);
  }
  out.push(`      else false`);
  out.push(`    end;`);
}
// Also explicitly null out the CHAMPION row's parent (in case prior seeds left it set)
out.push(``);
out.push(`update public.bracket_slots`);
out.push(`  set parent_slot_id = null`);
out.push(`  where slot_code = 'CHAMPION'`);
out.push(`    and tournament_id = (select id from public.tournament where code = 'WC2026');`);
out.push(``);

// === 5. Prop questions ===
const propCodeIdx = colIndex(props.header, "code");
const propPromptEnIdx = colIndex(props.header, "prompt_en");
const propPromptHeIdx = colIndex(props.header, "prompt_he");
const propAnswerIdx = colIndex(props.header, "answer_type");
const propPointsIdx = colIndex(props.header, "points");

out.push(`-- 5. Prop questions (${props.rows.length} rows; bilingual).`);
out.push(`with t as (select id as tournament_id from public.tournament where code = 'WC2026')`);
out.push(
  `insert into public.prop_questions (tournament_id, code, prompt_en, prompt_he, answer_type, points) values`,
);
const propValues = props.rows.map((r) => {
  const code = sqlStr(r[propCodeIdx]);
  const en = sqlStr(r[propPromptEnIdx]);
  const he = sqlStr(r[propPromptHeIdx]);
  const ans = sqlStr(r[propAnswerIdx]);
  const pts = sqlInt(r[propPointsIdx]);
  return `  ((select tournament_id from t), ${code}, ${en}, ${he}, ${ans}, ${pts})`;
});
out.push(propValues.join(",\n"));
out.push(`on conflict (tournament_id, code) do update`);
out.push(`  set prompt_en = excluded.prompt_en,`);
out.push(`      prompt_he = excluded.prompt_he,`);
out.push(`      answer_type = excluded.answer_type,`);
out.push(`      points = excluded.points,`);
out.push(`      updated_at = now();`);
out.push(``);

// === 6. Integrity-check DO block ===
const expectedTeams = teams.rows.length;
const expectedFixtures = fixtures.rows.length;
const expectedSlots = slots.rows.length;
const expectedPropsMin = props.rows.length;
out.push(`-- 6. Migration-time integrity check.`);
out.push(`-- Expected counts are substituted from CSV row counts by the build script.`);
out.push(`-- Failure raises an exception, rolling back the transaction (T-03-06).`);
out.push(`do $$`);
out.push(`declare`);
out.push(`  v_tournament_id uuid;`);
out.push(`  teams_n int;`);
out.push(`  fixtures_n int;`);
out.push(`  slots_n int;`);
out.push(`  props_n int;`);
out.push(`  no_parent_n int;`);
out.push(`  expected_teams_n constant int := ${expectedTeams};`);
out.push(`  expected_fixtures_n constant int := ${expectedFixtures};`);
out.push(`  expected_slots_n constant int := ${expectedSlots};`);
out.push(`  expected_props_n_min constant int := ${expectedPropsMin};`);
out.push(`begin`);
out.push(`  select id into v_tournament_id from public.tournament where code = 'WC2026';`);
out.push(`  if v_tournament_id is null then`);
out.push(`    raise exception 'Seed integrity: WC2026 tournament row missing';`);
out.push(`  end if;`);
out.push(`  select count(*) into teams_n from public.teams where tournament_id = v_tournament_id;`);
out.push(`  select count(*) into fixtures_n from public.fixtures where tournament_id = v_tournament_id;`);
out.push(`  select count(*) into slots_n from public.bracket_slots where tournament_id = v_tournament_id;`);
out.push(`  select count(*) into props_n from public.prop_questions where tournament_id = v_tournament_id;`);
out.push(`  select count(*) into no_parent_n from public.bracket_slots`);
out.push(`    where tournament_id = v_tournament_id and parent_slot_id is null;`);
out.push(``);
out.push(`  if teams_n <> expected_teams_n then`);
out.push(`    raise exception 'Seed integrity: expected % teams, got %', expected_teams_n, teams_n;`);
out.push(`  end if;`);
out.push(`  if fixtures_n <> expected_fixtures_n then`);
out.push(`    raise exception 'Seed integrity: expected % fixtures, got %', expected_fixtures_n, fixtures_n;`);
out.push(`  end if;`);
out.push(`  if slots_n <> expected_slots_n then`);
out.push(`    raise exception 'Seed integrity: expected % bracket_slots, got %', expected_slots_n, slots_n;`);
out.push(`  end if;`);
out.push(`  if props_n < expected_props_n_min then`);
out.push(`    raise exception 'Seed integrity: expected >= % prop_questions, got %', expected_props_n_min, props_n;`);
out.push(`  end if;`);
out.push(`  if no_parent_n <> 1 then`);
out.push(`    raise exception 'Seed integrity: expected exactly 1 bracket slot with null parent (CHAMPION), got %', no_parent_n;`);
out.push(`  end if;`);
out.push(`end$$;`);
out.push(``);

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, out.join("\n"), "utf8");

console.log(`[build-seed-sql] generated ${OUTPUT_PATH}`);
console.log(`  teams: ${teams.rows.length}`);
console.log(`  fixtures: ${fixtures.rows.length}`);
console.log(`  bracket_slots: ${slots.rows.length}`);
console.log(`  prop_questions: ${props.rows.length}`);

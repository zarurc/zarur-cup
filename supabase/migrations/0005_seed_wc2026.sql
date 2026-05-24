-- Migration 0005: WC 2026 seed data.
-- Generated: 2026-05-23T21:27:37.403Z from data/wc2026/*.csv by scripts/build-seed-sql.ts.
-- DO NOT HAND-EDIT THIS FILE. Edit the CSV and re-run `npm run seed:build`.
-- Idempotent: re-runs update existing rows via ON CONFLICT.
-- Migration numbering note ([Rule 3 - Blocking] deviation): the plan called
-- this 0003_seed_wc2026.sql but Plan 01-02 shipped 0001..0004. The next free
-- sequential number is 0005. Migrations are append-only (Pattern 6, Plan 01-02).
--
-- This entire migration runs in a single Postgres transaction so a failed
-- integrity check rolls back the whole seed (T-03-06 in the threat model).

-- 1. Tournament row (single WC 2026 row).
insert into public.tournament (code, name_en, name_he, starts_at, ends_at)
values ('WC2026', 'FIFA World Cup 2026', 'גביע העולם 2026', '2026-06-11T20:00:00Z', '2026-07-19T23:59:59Z')
on conflict (code) do update
  set name_en = excluded.name_en,
      name_he = excluded.name_he,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at;

-- 2. Teams (48 rows).
with t as (select id from public.tournament where code = 'WC2026')
insert into public.teams (tournament_id, code, name_en, name_he, group_code) values
  ((select id from t), 'MEX', 'Mexico', 'מקסיקו', 'A'),
  ((select id from t), 'JAM', 'Jamaica', 'ג''מייקה', 'A'),
  ((select id from t), 'NZL', 'New Zealand', 'ניו זילנד', 'A'),
  ((select id from t), 'NOR', 'Norway', 'נורווגיה', 'A'),
  ((select id from t), 'USA', 'United States', 'ארצות הברית', 'B'),
  ((select id from t), 'KSA', 'Saudi Arabia', 'ערב הסעודית', 'B'),
  ((select id from t), 'MAR', 'Morocco', 'מרוקו', 'B'),
  ((select id from t), 'AUT', 'Austria', 'אוסטריה', 'B'),
  ((select id from t), 'CAN', 'Canada', 'קנדה', 'C'),
  ((select id from t), 'JPN', 'Japan', 'יפן', 'C'),
  ((select id from t), 'BEL', 'Belgium', 'בלגיה', 'C'),
  ((select id from t), 'ALG', 'Algeria', 'אלג''יריה', 'C'),
  ((select id from t), 'ARG', 'Argentina', 'ארגנטינה', 'D'),
  ((select id from t), 'CIV', 'Ivory Coast', 'חוף השנהב', 'D'),
  ((select id from t), 'KOR', 'South Korea', 'קוריאה הדרומית', 'D'),
  ((select id from t), 'PO1', 'Playoff Winner 1', 'מנצח/ת המוקדמות 1', 'D'),
  ((select id from t), 'ESP', 'Spain', 'ספרד', 'E'),
  ((select id from t), 'EGY', 'Egypt', 'מצרים', 'E'),
  ((select id from t), 'AUS', 'Australia', 'אוסטרליה', 'E'),
  ((select id from t), 'HAI', 'Haiti', 'האיטי', 'E'),
  ((select id from t), 'BRA', 'Brazil', 'ברזיל', 'F'),
  ((select id from t), 'IRN', 'Iran', 'איראן', 'F'),
  ((select id from t), 'NGA', 'Nigeria', 'ניגריה', 'F'),
  ((select id from t), 'UKR', 'Ukraine', 'אוקראינה', 'F'),
  ((select id from t), 'FRA', 'France', 'צרפת', 'G'),
  ((select id from t), 'ECU', 'Ecuador', 'אקוודור', 'G'),
  ((select id from t), 'CMR', 'Cameroon', 'קמרון', 'G'),
  ((select id from t), 'IRQ', 'Iraq', 'עיראק', 'G'),
  ((select id from t), 'ENG', 'England', 'אנגליה', 'H'),
  ((select id from t), 'COL', 'Colombia', 'קולומביה', 'H'),
  ((select id from t), 'GHA', 'Ghana', 'גאנה', 'H'),
  ((select id from t), 'JOR', 'Jordan', 'ירדן', 'H'),
  ((select id from t), 'NED', 'Netherlands', 'הולנד', 'I'),
  ((select id from t), 'SEN', 'Senegal', 'סנגל', 'I'),
  ((select id from t), 'UZB', 'Uzbekistan', 'אוזבקיסטן', 'I'),
  ((select id from t), 'PAR', 'Paraguay', 'פרגוואי', 'I'),
  ((select id from t), 'POR', 'Portugal', 'פורטוגל', 'J'),
  ((select id from t), 'URU', 'Uruguay', 'אורוגוואי', 'J'),
  ((select id from t), 'TUN', 'Tunisia', 'תוניסיה', 'J'),
  ((select id from t), 'CRO', 'Croatia', 'קרואטיה', 'J'),
  ((select id from t), 'GER', 'Germany', 'גרמניה', 'K'),
  ((select id from t), 'CRC', 'Costa Rica', 'קוסטה ריקה', 'K'),
  ((select id from t), 'SUI', 'Switzerland', 'שוויץ', 'K'),
  ((select id from t), 'PO2', 'Playoff Winner 2', 'מנצח/ת המוקדמות 2', 'K'),
  ((select id from t), 'ITA', 'Italy', 'איטליה', 'L'),
  ((select id from t), 'DEN', 'Denmark', 'דנמרק', 'L'),
  ((select id from t), 'POL', 'Poland', 'פולין', 'L'),
  ((select id from t), 'TUR', 'Turkey', 'טורקיה', 'L')
on conflict (tournament_id, code) do update
  set name_en = excluded.name_en,
      name_he = excluded.name_he,
      group_code = excluded.group_code;

-- 3. Fixtures (104 rows; group stage + 32 knockout with symbolic placeholders).
-- Group rows: home_team_id + away_team_id resolved via team code subselect; placeholders null.
-- KO rows:    home_team_id/away_team_id null; home_placeholder/away_placeholder set to symbolic refs.
with t as (select id as tournament_id from public.tournament where code = 'WC2026')
insert into public.fixtures (tournament_id, external_match_no, stage, group_code, home_team_id, away_team_id, home_placeholder, away_placeholder, kickoff_at, venue_code) values
  ((select tournament_id from t), 1, 'group', 'A', (select id from public.teams where code = 'MEX' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'JAM' and tournament_id = (select tournament_id from t)), null, null, '2026-06-11T20:00:00Z', 'MEX'),
  ((select tournament_id from t), 2, 'group', 'A', (select id from public.teams where code = 'NZL' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'NOR' and tournament_id = (select tournament_id from t)), null, null, '2026-06-12T20:00:00Z', 'SEA'),
  ((select tournament_id from t), 3, 'group', 'B', (select id from public.teams where code = 'USA' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'KSA' and tournament_id = (select tournament_id from t)), null, null, '2026-06-12T23:00:00Z', 'LAX'),
  ((select tournament_id from t), 4, 'group', 'B', (select id from public.teams where code = 'MAR' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'AUT' and tournament_id = (select tournament_id from t)), null, null, '2026-06-13T20:00:00Z', 'DAL'),
  ((select tournament_id from t), 5, 'group', 'C', (select id from public.teams where code = 'CAN' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'JPN' and tournament_id = (select tournament_id from t)), null, null, '2026-06-13T23:00:00Z', 'TOR'),
  ((select tournament_id from t), 6, 'group', 'C', (select id from public.teams where code = 'BEL' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'ALG' and tournament_id = (select tournament_id from t)), null, null, '2026-06-13T17:00:00Z', 'VAN'),
  ((select tournament_id from t), 7, 'group', 'D', (select id from public.teams where code = 'ARG' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'CIV' and tournament_id = (select tournament_id from t)), null, null, '2026-06-14T16:00:00Z', 'MIA'),
  ((select tournament_id from t), 8, 'group', 'D', (select id from public.teams where code = 'KOR' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'PO1' and tournament_id = (select tournament_id from t)), null, null, '2026-06-14T19:00:00Z', 'ATL'),
  ((select tournament_id from t), 9, 'group', 'E', (select id from public.teams where code = 'ESP' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'EGY' and tournament_id = (select tournament_id from t)), null, null, '2026-06-14T22:00:00Z', 'BOS'),
  ((select tournament_id from t), 10, 'group', 'E', (select id from public.teams where code = 'AUS' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'HAI' and tournament_id = (select tournament_id from t)), null, null, '2026-06-15T17:00:00Z', 'SEA'),
  ((select tournament_id from t), 11, 'group', 'F', (select id from public.teams where code = 'BRA' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'IRN' and tournament_id = (select tournament_id from t)), null, null, '2026-06-15T20:00:00Z', 'KAN'),
  ((select tournament_id from t), 12, 'group', 'F', (select id from public.teams where code = 'NGA' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'UKR' and tournament_id = (select tournament_id from t)), null, null, '2026-06-15T23:00:00Z', 'PHI'),
  ((select tournament_id from t), 13, 'group', 'G', (select id from public.teams where code = 'FRA' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'ECU' and tournament_id = (select tournament_id from t)), null, null, '2026-06-16T17:00:00Z', 'HOU'),
  ((select tournament_id from t), 14, 'group', 'G', (select id from public.teams where code = 'CMR' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'IRQ' and tournament_id = (select tournament_id from t)), null, null, '2026-06-16T20:00:00Z', 'GUA'),
  ((select tournament_id from t), 15, 'group', 'H', (select id from public.teams where code = 'ENG' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'COL' and tournament_id = (select tournament_id from t)), null, null, '2026-06-16T23:00:00Z', 'LAX'),
  ((select tournament_id from t), 16, 'group', 'H', (select id from public.teams where code = 'GHA' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'JOR' and tournament_id = (select tournament_id from t)), null, null, '2026-06-16T16:00:00Z', 'DAL'),
  ((select tournament_id from t), 17, 'group', 'I', (select id from public.teams where code = 'NED' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'SEN' and tournament_id = (select tournament_id from t)), null, null, '2026-06-15T16:00:00Z', 'NYC'),
  ((select tournament_id from t), 18, 'group', 'I', (select id from public.teams where code = 'UZB' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'PAR' and tournament_id = (select tournament_id from t)), null, null, '2026-06-15T13:00:00Z', 'MEX'),
  ((select tournament_id from t), 19, 'group', 'J', (select id from public.teams where code = 'POR' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'URU' and tournament_id = (select tournament_id from t)), null, null, '2026-06-14T13:00:00Z', 'MTY'),
  ((select tournament_id from t), 20, 'group', 'J', (select id from public.teams where code = 'TUN' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'CRO' and tournament_id = (select tournament_id from t)), null, null, '2026-06-14T16:30:00Z', 'GDL'),
  ((select tournament_id from t), 21, 'group', 'K', (select id from public.teams where code = 'GER' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'CRC' and tournament_id = (select tournament_id from t)), null, null, '2026-06-13T13:00:00Z', 'SFO'),
  ((select tournament_id from t), 22, 'group', 'K', (select id from public.teams where code = 'SUI' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'PO2' and tournament_id = (select tournament_id from t)), null, null, '2026-06-13T16:00:00Z', 'KAN'),
  ((select tournament_id from t), 23, 'group', 'L', (select id from public.teams where code = 'ITA' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'DEN' and tournament_id = (select tournament_id from t)), null, null, '2026-06-12T17:00:00Z', 'MIA'),
  ((select tournament_id from t), 24, 'group', 'L', (select id from public.teams where code = 'POL' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'TUR' and tournament_id = (select tournament_id from t)), null, null, '2026-06-12T13:00:00Z', 'PHI'),
  ((select tournament_id from t), 25, 'group', 'A', (select id from public.teams where code = 'MEX' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'NZL' and tournament_id = (select tournament_id from t)), null, null, '2026-06-18T20:00:00Z', 'GDL'),
  ((select tournament_id from t), 26, 'group', 'A', (select id from public.teams where code = 'JAM' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'NOR' and tournament_id = (select tournament_id from t)), null, null, '2026-06-18T17:00:00Z', 'SEA'),
  ((select tournament_id from t), 27, 'group', 'B', (select id from public.teams where code = 'USA' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'MAR' and tournament_id = (select tournament_id from t)), null, null, '2026-06-19T20:00:00Z', 'LAX'),
  ((select tournament_id from t), 28, 'group', 'B', (select id from public.teams where code = 'KSA' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'AUT' and tournament_id = (select tournament_id from t)), null, null, '2026-06-19T17:00:00Z', 'DAL'),
  ((select tournament_id from t), 29, 'group', 'C', (select id from public.teams where code = 'CAN' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'BEL' and tournament_id = (select tournament_id from t)), null, null, '2026-06-20T23:00:00Z', 'TOR'),
  ((select tournament_id from t), 30, 'group', 'C', (select id from public.teams where code = 'JPN' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'ALG' and tournament_id = (select tournament_id from t)), null, null, '2026-06-20T20:00:00Z', 'VAN'),
  ((select tournament_id from t), 31, 'group', 'D', (select id from public.teams where code = 'ARG' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'KOR' and tournament_id = (select tournament_id from t)), null, null, '2026-06-21T19:00:00Z', 'MIA'),
  ((select tournament_id from t), 32, 'group', 'D', (select id from public.teams where code = 'CIV' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'PO1' and tournament_id = (select tournament_id from t)), null, null, '2026-06-21T16:00:00Z', 'ATL'),
  ((select tournament_id from t), 33, 'group', 'E', (select id from public.teams where code = 'ESP' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'AUS' and tournament_id = (select tournament_id from t)), null, null, '2026-06-21T22:00:00Z', 'BOS'),
  ((select tournament_id from t), 34, 'group', 'E', (select id from public.teams where code = 'EGY' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'HAI' and tournament_id = (select tournament_id from t)), null, null, '2026-06-22T17:00:00Z', 'NYC'),
  ((select tournament_id from t), 35, 'group', 'F', (select id from public.teams where code = 'BRA' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'NGA' and tournament_id = (select tournament_id from t)), null, null, '2026-06-22T20:00:00Z', 'KAN'),
  ((select tournament_id from t), 36, 'group', 'F', (select id from public.teams where code = 'IRN' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'UKR' and tournament_id = (select tournament_id from t)), null, null, '2026-06-22T23:00:00Z', 'PHI'),
  ((select tournament_id from t), 37, 'group', 'G', (select id from public.teams where code = 'FRA' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'CMR' and tournament_id = (select tournament_id from t)), null, null, '2026-06-19T22:00:00Z', 'HOU'),
  ((select tournament_id from t), 38, 'group', 'G', (select id from public.teams where code = 'ECU' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'IRQ' and tournament_id = (select tournament_id from t)), null, null, '2026-06-19T19:00:00Z', 'GUA'),
  ((select tournament_id from t), 39, 'group', 'H', (select id from public.teams where code = 'ENG' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'GHA' and tournament_id = (select tournament_id from t)), null, null, '2026-06-20T17:00:00Z', 'LAX'),
  ((select tournament_id from t), 40, 'group', 'H', (select id from public.teams where code = 'COL' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'JOR' and tournament_id = (select tournament_id from t)), null, null, '2026-06-20T14:00:00Z', 'DAL'),
  ((select tournament_id from t), 41, 'group', 'I', (select id from public.teams where code = 'NED' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'UZB' and tournament_id = (select tournament_id from t)), null, null, '2026-06-18T13:00:00Z', 'NYC'),
  ((select tournament_id from t), 42, 'group', 'I', (select id from public.teams where code = 'SEN' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'PAR' and tournament_id = (select tournament_id from t)), null, null, '2026-06-18T16:00:00Z', 'MEX'),
  ((select tournament_id from t), 43, 'group', 'J', (select id from public.teams where code = 'POR' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'TUN' and tournament_id = (select tournament_id from t)), null, null, '2026-06-17T20:00:00Z', 'MTY'),
  ((select tournament_id from t), 44, 'group', 'J', (select id from public.teams where code = 'URU' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'CRO' and tournament_id = (select tournament_id from t)), null, null, '2026-06-17T17:00:00Z', 'GDL'),
  ((select tournament_id from t), 45, 'group', 'K', (select id from public.teams where code = 'GER' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'SUI' and tournament_id = (select tournament_id from t)), null, null, '2026-06-17T13:00:00Z', 'SFO'),
  ((select tournament_id from t), 46, 'group', 'K', (select id from public.teams where code = 'CRC' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'PO2' and tournament_id = (select tournament_id from t)), null, null, '2026-06-17T23:00:00Z', 'KAN'),
  ((select tournament_id from t), 47, 'group', 'L', (select id from public.teams where code = 'ITA' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'POL' and tournament_id = (select tournament_id from t)), null, null, '2026-06-17T16:00:00Z', 'MIA'),
  ((select tournament_id from t), 48, 'group', 'L', (select id from public.teams where code = 'DEN' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'TUR' and tournament_id = (select tournament_id from t)), null, null, '2026-06-17T11:00:00Z', 'PHI'),
  ((select tournament_id from t), 49, 'group', 'A', (select id from public.teams where code = 'MEX' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'NOR' and tournament_id = (select tournament_id from t)), null, null, '2026-06-24T20:00:00Z', 'MEX'),
  ((select tournament_id from t), 50, 'group', 'A', (select id from public.teams where code = 'JAM' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'NZL' and tournament_id = (select tournament_id from t)), null, null, '2026-06-24T20:00:00Z', 'SEA'),
  ((select tournament_id from t), 51, 'group', 'B', (select id from public.teams where code = 'USA' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'AUT' and tournament_id = (select tournament_id from t)), null, null, '2026-06-25T20:00:00Z', 'LAX'),
  ((select tournament_id from t), 52, 'group', 'B', (select id from public.teams where code = 'KSA' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'MAR' and tournament_id = (select tournament_id from t)), null, null, '2026-06-25T20:00:00Z', 'DAL'),
  ((select tournament_id from t), 53, 'group', 'C', (select id from public.teams where code = 'CAN' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'ALG' and tournament_id = (select tournament_id from t)), null, null, '2026-06-26T23:00:00Z', 'TOR'),
  ((select tournament_id from t), 54, 'group', 'C', (select id from public.teams where code = 'JPN' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'BEL' and tournament_id = (select tournament_id from t)), null, null, '2026-06-26T23:00:00Z', 'VAN'),
  ((select tournament_id from t), 55, 'group', 'D', (select id from public.teams where code = 'ARG' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'PO1' and tournament_id = (select tournament_id from t)), null, null, '2026-06-25T16:00:00Z', 'MIA'),
  ((select tournament_id from t), 56, 'group', 'D', (select id from public.teams where code = 'CIV' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'KOR' and tournament_id = (select tournament_id from t)), null, null, '2026-06-25T16:00:00Z', 'ATL'),
  ((select tournament_id from t), 57, 'group', 'E', (select id from public.teams where code = 'ESP' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'HAI' and tournament_id = (select tournament_id from t)), null, null, '2026-06-25T22:00:00Z', 'BOS'),
  ((select tournament_id from t), 58, 'group', 'E', (select id from public.teams where code = 'EGY' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'AUS' and tournament_id = (select tournament_id from t)), null, null, '2026-06-25T22:00:00Z', 'NYC'),
  ((select tournament_id from t), 59, 'group', 'F', (select id from public.teams where code = 'BRA' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'UKR' and tournament_id = (select tournament_id from t)), null, null, '2026-06-26T20:00:00Z', 'KAN'),
  ((select tournament_id from t), 60, 'group', 'F', (select id from public.teams where code = 'IRN' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'NGA' and tournament_id = (select tournament_id from t)), null, null, '2026-06-26T20:00:00Z', 'PHI'),
  ((select tournament_id from t), 61, 'group', 'G', (select id from public.teams where code = 'FRA' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'IRQ' and tournament_id = (select tournament_id from t)), null, null, '2026-06-26T17:00:00Z', 'HOU'),
  ((select tournament_id from t), 62, 'group', 'G', (select id from public.teams where code = 'ECU' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'CMR' and tournament_id = (select tournament_id from t)), null, null, '2026-06-26T17:00:00Z', 'GUA'),
  ((select tournament_id from t), 63, 'group', 'H', (select id from public.teams where code = 'ENG' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'JOR' and tournament_id = (select tournament_id from t)), null, null, '2026-06-27T17:00:00Z', 'LAX'),
  ((select tournament_id from t), 64, 'group', 'H', (select id from public.teams where code = 'COL' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'GHA' and tournament_id = (select tournament_id from t)), null, null, '2026-06-27T17:00:00Z', 'DAL'),
  ((select tournament_id from t), 65, 'group', 'I', (select id from public.teams where code = 'NED' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'PAR' and tournament_id = (select tournament_id from t)), null, null, '2026-06-24T13:00:00Z', 'NYC'),
  ((select tournament_id from t), 66, 'group', 'I', (select id from public.teams where code = 'SEN' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'UZB' and tournament_id = (select tournament_id from t)), null, null, '2026-06-24T13:00:00Z', 'MEX'),
  ((select tournament_id from t), 67, 'group', 'J', (select id from public.teams where code = 'POR' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'CRO' and tournament_id = (select tournament_id from t)), null, null, '2026-06-23T17:00:00Z', 'MTY'),
  ((select tournament_id from t), 68, 'group', 'J', (select id from public.teams where code = 'URU' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'TUN' and tournament_id = (select tournament_id from t)), null, null, '2026-06-23T17:00:00Z', 'GDL'),
  ((select tournament_id from t), 69, 'group', 'K', (select id from public.teams where code = 'GER' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'PO2' and tournament_id = (select tournament_id from t)), null, null, '2026-06-23T13:00:00Z', 'SFO'),
  ((select tournament_id from t), 70, 'group', 'K', (select id from public.teams where code = 'CRC' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'SUI' and tournament_id = (select tournament_id from t)), null, null, '2026-06-23T13:00:00Z', 'KAN'),
  ((select tournament_id from t), 71, 'group', 'L', (select id from public.teams where code = 'ITA' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'TUR' and tournament_id = (select tournament_id from t)), null, null, '2026-06-23T20:00:00Z', 'MIA'),
  ((select tournament_id from t), 72, 'group', 'L', (select id from public.teams where code = 'DEN' and tournament_id = (select tournament_id from t)), (select id from public.teams where code = 'POL' and tournament_id = (select tournament_id from t)), null, null, '2026-06-23T20:00:00Z', 'PHI'),
  ((select tournament_id from t), 73, 'round_of_32', null, null, null, 'WINNER_GROUP_A', 'THIRD_PLACE_1', '2026-06-28T16:00:00Z', 'GDL'),
  ((select tournament_id from t), 74, 'round_of_32', null, null, null, 'RUNNER_UP_GROUP_C', 'RUNNER_UP_GROUP_F', '2026-06-28T20:00:00Z', 'TOR'),
  ((select tournament_id from t), 75, 'round_of_32', null, null, null, 'WINNER_GROUP_B', 'THIRD_PLACE_2', '2026-06-28T23:00:00Z', 'LAX'),
  ((select tournament_id from t), 76, 'round_of_32', null, null, null, 'RUNNER_UP_GROUP_A', 'RUNNER_UP_GROUP_H', '2026-06-29T17:00:00Z', 'SEA'),
  ((select tournament_id from t), 77, 'round_of_32', null, null, null, 'WINNER_GROUP_C', 'THIRD_PLACE_3', '2026-06-29T20:00:00Z', 'VAN'),
  ((select tournament_id from t), 78, 'round_of_32', null, null, null, 'RUNNER_UP_GROUP_B', 'RUNNER_UP_GROUP_E', '2026-06-29T23:00:00Z', 'DAL'),
  ((select tournament_id from t), 79, 'round_of_32', null, null, null, 'WINNER_GROUP_D', 'THIRD_PLACE_4', '2026-06-30T19:00:00Z', 'MIA'),
  ((select tournament_id from t), 80, 'round_of_32', null, null, null, 'RUNNER_UP_GROUP_D', 'RUNNER_UP_GROUP_K', '2026-06-30T22:00:00Z', 'ATL'),
  ((select tournament_id from t), 81, 'round_of_32', null, null, null, 'WINNER_GROUP_E', 'THIRD_PLACE_5', '2026-07-01T17:00:00Z', 'BOS'),
  ((select tournament_id from t), 82, 'round_of_32', null, null, null, 'RUNNER_UP_GROUP_G', 'RUNNER_UP_GROUP_J', '2026-07-01T20:00:00Z', 'NYC'),
  ((select tournament_id from t), 83, 'round_of_32', null, null, null, 'WINNER_GROUP_F', 'THIRD_PLACE_6', '2026-07-01T23:00:00Z', 'KAN'),
  ((select tournament_id from t), 84, 'round_of_32', null, null, null, 'WINNER_GROUP_H', 'RUNNER_UP_GROUP_I', '2026-07-02T17:00:00Z', 'LAX'),
  ((select tournament_id from t), 85, 'round_of_32', null, null, null, 'WINNER_GROUP_G', 'THIRD_PLACE_7', '2026-07-02T20:00:00Z', 'HOU'),
  ((select tournament_id from t), 86, 'round_of_32', null, null, null, 'WINNER_GROUP_I', 'RUNNER_UP_GROUP_L', '2026-07-02T23:00:00Z', 'PHI'),
  ((select tournament_id from t), 87, 'round_of_32', null, null, null, 'WINNER_GROUP_J', 'THIRD_PLACE_8', '2026-07-03T17:00:00Z', 'MTY'),
  ((select tournament_id from t), 88, 'round_of_32', null, null, null, 'WINNER_GROUP_L', 'WINNER_GROUP_K', '2026-07-03T20:00:00Z', 'MIA'),
  ((select tournament_id from t), 89, 'round_of_16', null, null, null, 'R32_M1_W', 'R32_M2_W', '2026-07-04T17:00:00Z', 'LAX'),
  ((select tournament_id from t), 90, 'round_of_16', null, null, null, 'R32_M3_W', 'R32_M4_W', '2026-07-04T21:00:00Z', 'DAL'),
  ((select tournament_id from t), 91, 'round_of_16', null, null, null, 'R32_M5_W', 'R32_M6_W', '2026-07-05T17:00:00Z', 'TOR'),
  ((select tournament_id from t), 92, 'round_of_16', null, null, null, 'R32_M7_W', 'R32_M8_W', '2026-07-05T21:00:00Z', 'MIA'),
  ((select tournament_id from t), 93, 'round_of_16', null, null, null, 'R32_M9_W', 'R32_M10_W', '2026-07-06T17:00:00Z', 'BOS'),
  ((select tournament_id from t), 94, 'round_of_16', null, null, null, 'R32_M11_W', 'R32_M12_W', '2026-07-06T21:00:00Z', 'KAN'),
  ((select tournament_id from t), 95, 'round_of_16', null, null, null, 'R32_M13_W', 'R32_M14_W', '2026-07-07T17:00:00Z', 'HOU'),
  ((select tournament_id from t), 96, 'round_of_16', null, null, null, 'R32_M15_W', 'R32_M16_W', '2026-07-07T21:00:00Z', 'NYC'),
  ((select tournament_id from t), 97, 'quarter_final', null, null, null, 'R16_M1_W', 'R16_M2_W', '2026-07-09T20:00:00Z', 'LAX'),
  ((select tournament_id from t), 98, 'quarter_final', null, null, null, 'R16_M3_W', 'R16_M4_W', '2026-07-10T20:00:00Z', 'DAL'),
  ((select tournament_id from t), 99, 'quarter_final', null, null, null, 'R16_M5_W', 'R16_M6_W', '2026-07-10T23:00:00Z', 'KAN'),
  ((select tournament_id from t), 100, 'quarter_final', null, null, null, 'R16_M7_W', 'R16_M8_W', '2026-07-11T20:00:00Z', 'MIA'),
  ((select tournament_id from t), 101, 'semi_final', null, null, null, 'QF_M1_W', 'QF_M2_W', '2026-07-14T20:00:00Z', 'DAL'),
  ((select tournament_id from t), 102, 'semi_final', null, null, null, 'QF_M3_W', 'QF_M4_W', '2026-07-15T20:00:00Z', 'ATL'),
  ((select tournament_id from t), 103, 'third_place', null, null, null, 'SF_M1_L', 'SF_M2_L', '2026-07-18T20:00:00Z', 'MIA'),
  ((select tournament_id from t), 104, 'final', null, null, null, 'SF_M1_W', 'SF_M2_W', '2026-07-19T19:00:00Z', 'NYC')
on conflict (tournament_id, external_match_no) do update
  set stage = excluded.stage,
      group_code = excluded.group_code,
      home_team_id = excluded.home_team_id,
      away_team_id = excluded.away_team_id,
      home_placeholder = excluded.home_placeholder,
      away_placeholder = excluded.away_placeholder,
      kickoff_at = excluded.kickoff_at,
      venue_code = excluded.venue_code,
      updated_at = now();

-- 4. Bracket slots (32 rows). Two-pass to handle parent_slot_id self-reference.
-- Pass 1: insert all slots with fixture_id resolved; parent_slot_id stays null.
with t as (select id as tournament_id from public.tournament where code = 'WC2026')
insert into public.bracket_slots (tournament_id, slot_code, stage, fixture_id) values
  ((select tournament_id from t), 'R32_M1', 'round_of_32', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 73)),
  ((select tournament_id from t), 'R32_M2', 'round_of_32', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 74)),
  ((select tournament_id from t), 'R32_M3', 'round_of_32', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 75)),
  ((select tournament_id from t), 'R32_M4', 'round_of_32', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 76)),
  ((select tournament_id from t), 'R32_M5', 'round_of_32', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 77)),
  ((select tournament_id from t), 'R32_M6', 'round_of_32', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 78)),
  ((select tournament_id from t), 'R32_M7', 'round_of_32', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 79)),
  ((select tournament_id from t), 'R32_M8', 'round_of_32', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 80)),
  ((select tournament_id from t), 'R32_M9', 'round_of_32', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 81)),
  ((select tournament_id from t), 'R32_M10', 'round_of_32', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 82)),
  ((select tournament_id from t), 'R32_M11', 'round_of_32', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 83)),
  ((select tournament_id from t), 'R32_M12', 'round_of_32', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 84)),
  ((select tournament_id from t), 'R32_M13', 'round_of_32', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 85)),
  ((select tournament_id from t), 'R32_M14', 'round_of_32', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 86)),
  ((select tournament_id from t), 'R32_M15', 'round_of_32', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 87)),
  ((select tournament_id from t), 'R32_M16', 'round_of_32', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 88)),
  ((select tournament_id from t), 'R16_M1', 'round_of_16', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 89)),
  ((select tournament_id from t), 'R16_M2', 'round_of_16', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 90)),
  ((select tournament_id from t), 'R16_M3', 'round_of_16', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 91)),
  ((select tournament_id from t), 'R16_M4', 'round_of_16', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 92)),
  ((select tournament_id from t), 'R16_M5', 'round_of_16', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 93)),
  ((select tournament_id from t), 'R16_M6', 'round_of_16', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 94)),
  ((select tournament_id from t), 'R16_M7', 'round_of_16', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 95)),
  ((select tournament_id from t), 'R16_M8', 'round_of_16', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 96)),
  ((select tournament_id from t), 'QF_M1', 'quarter_final', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 97)),
  ((select tournament_id from t), 'QF_M2', 'quarter_final', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 98)),
  ((select tournament_id from t), 'QF_M3', 'quarter_final', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 99)),
  ((select tournament_id from t), 'QF_M4', 'quarter_final', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 100)),
  ((select tournament_id from t), 'SF_M1', 'semi_final', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 101)),
  ((select tournament_id from t), 'SF_M2', 'semi_final', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 102)),
  ((select tournament_id from t), 'F', 'final', (select id from public.fixtures where tournament_id = (select tournament_id from t) and external_match_no = 104)),
  ((select tournament_id from t), 'CHAMPION', 'champion', null)
on conflict (tournament_id, slot_code) do update
  set stage = excluded.stage,
      fixture_id = excluded.fixture_id;

-- Pass 2: wire parent_slot_id from CSV's parent_slot_code mapping.
update public.bracket_slots child
  set parent_slot_id = parent.id
  from public.bracket_slots parent
  where child.tournament_id = (select id from public.tournament where code = 'WC2026')
    and parent.tournament_id = child.tournament_id
    and case child.slot_code
      when 'R32_M1' then parent.slot_code = 'R16_M1'
      when 'R32_M2' then parent.slot_code = 'R16_M1'
      when 'R32_M3' then parent.slot_code = 'R16_M2'
      when 'R32_M4' then parent.slot_code = 'R16_M2'
      when 'R32_M5' then parent.slot_code = 'R16_M3'
      when 'R32_M6' then parent.slot_code = 'R16_M3'
      when 'R32_M7' then parent.slot_code = 'R16_M4'
      when 'R32_M8' then parent.slot_code = 'R16_M4'
      when 'R32_M9' then parent.slot_code = 'R16_M5'
      when 'R32_M10' then parent.slot_code = 'R16_M5'
      when 'R32_M11' then parent.slot_code = 'R16_M6'
      when 'R32_M12' then parent.slot_code = 'R16_M6'
      when 'R32_M13' then parent.slot_code = 'R16_M7'
      when 'R32_M14' then parent.slot_code = 'R16_M7'
      when 'R32_M15' then parent.slot_code = 'R16_M8'
      when 'R32_M16' then parent.slot_code = 'R16_M8'
      when 'R16_M1' then parent.slot_code = 'QF_M1'
      when 'R16_M2' then parent.slot_code = 'QF_M1'
      when 'R16_M3' then parent.slot_code = 'QF_M2'
      when 'R16_M4' then parent.slot_code = 'QF_M2'
      when 'R16_M5' then parent.slot_code = 'QF_M3'
      when 'R16_M6' then parent.slot_code = 'QF_M3'
      when 'R16_M7' then parent.slot_code = 'QF_M4'
      when 'R16_M8' then parent.slot_code = 'QF_M4'
      when 'QF_M1' then parent.slot_code = 'SF_M1'
      when 'QF_M2' then parent.slot_code = 'SF_M1'
      when 'QF_M3' then parent.slot_code = 'SF_M2'
      when 'QF_M4' then parent.slot_code = 'SF_M2'
      when 'SF_M1' then parent.slot_code = 'F'
      when 'SF_M2' then parent.slot_code = 'F'
      when 'F' then parent.slot_code = 'CHAMPION'
      else false
    end;

update public.bracket_slots
  set parent_slot_id = null
  where slot_code = 'CHAMPION'
    and tournament_id = (select id from public.tournament where code = 'WC2026');

-- 5. Prop questions (7 rows; bilingual).
with t as (select id as tournament_id from public.tournament where code = 'WC2026')
insert into public.prop_questions (tournament_id, code, prompt_en, prompt_he, answer_type, points) values
  ((select tournament_id from t), 'WINNER', 'Who will win the World Cup?', 'מי תזכה בגביע העולם?', 'single_team', 10),
  ((select tournament_id from t), 'RUNNER_UP', 'Who will be the runner-up?', 'מי תהיה הסגנית הראשונה?', 'single_team', 5),
  ((select tournament_id from t), 'TOP_SCORER', 'Who will be the tournament top scorer?', 'מי יהיה הכובש המוביל בטורניר?', 'single_player', 10),
  ((select tournament_id from t), 'GOLDEN_BOOT', 'Who will win the Golden Boot (Top Scorer trophy)?', 'מי יזכה בנעל הזהב?', 'single_player', 5),
  ((select tournament_id from t), 'GOLDEN_BALL', 'Who will win the Golden Ball (Best Player)?', 'מי יזכה בכדור הזהב (השחקן הטוב ביותר)?', 'single_player', 5),
  ((select tournament_id from t), 'BIGGEST_UPSET', 'Which team will provide the biggest upset?', 'איזו נבחרת תספק את ההפתעה הגדולה ביותר?', 'single_team', 3),
  ((select tournament_id from t), 'DARK_HORSE_SF', 'Which non-favourite will reach the semi-finals?', 'איזו נבחרת לא-מועדפת תגיע לחצי הגמר?', 'single_team', 4)
on conflict (tournament_id, code) do update
  set prompt_en = excluded.prompt_en,
      prompt_he = excluded.prompt_he,
      answer_type = excluded.answer_type,
      points = excluded.points,
      updated_at = now();

-- 6. Migration-time integrity check.
-- Expected counts are substituted from CSV row counts by the build script.
-- Failure raises an exception, rolling back the transaction (T-03-06).
do $$
declare
  v_tournament_id uuid;
  teams_n int;
  fixtures_n int;
  slots_n int;
  props_n int;
  no_parent_n int;
  expected_teams_n constant int := 48;
  expected_fixtures_n constant int := 104;
  expected_slots_n constant int := 32;
  expected_props_n_min constant int := 7;
begin
  select id into v_tournament_id from public.tournament where code = 'WC2026';
  if v_tournament_id is null then
    raise exception 'Seed integrity: WC2026 tournament row missing';
  end if;
  select count(*) into teams_n from public.teams where tournament_id = v_tournament_id;
  select count(*) into fixtures_n from public.fixtures where tournament_id = v_tournament_id;
  select count(*) into slots_n from public.bracket_slots where tournament_id = v_tournament_id;
  select count(*) into props_n from public.prop_questions where tournament_id = v_tournament_id;
  select count(*) into no_parent_n from public.bracket_slots
    where tournament_id = v_tournament_id and parent_slot_id is null;

  if teams_n <> expected_teams_n then
    raise exception 'Seed integrity: expected % teams, got %', expected_teams_n, teams_n;
  end if;
  if fixtures_n <> expected_fixtures_n then
    raise exception 'Seed integrity: expected % fixtures, got %', expected_fixtures_n, fixtures_n;
  end if;
  if slots_n <> expected_slots_n then
    raise exception 'Seed integrity: expected % bracket_slots, got %', expected_slots_n, slots_n;
  end if;
  if props_n < expected_props_n_min then
    raise exception 'Seed integrity: expected >= % prop_questions, got %', expected_props_n_min, props_n;
  end if;
  if no_parent_n <> 1 then
    raise exception 'Seed integrity: expected exactly 1 bracket slot with null parent (CHAMPION), got %', no_parent_n;
  end if;
end$$;

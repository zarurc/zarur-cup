-- data/test-fixtures.sql
-- Synthetic test fixtures for the Plan 02-08 Playwright smoke (QA-01).
-- external_match_no values 9001 / 9002 are outside the 1..104 real range
-- (RESEARCH Open Q4 RESOLVED) — avoids collisions. Uses real teams from
-- the seed (BRA + ARG as a recognizable pair); these are placeholder
-- identities for the test only.
--
-- [Rule 1 fix] tournament_id is NOT NULL on public.fixtures (0001_init.sql
-- line 52). The plan's skeleton omitted it; we resolve via the canonical
-- WC2026 tournament code.

begin;

-- SMOKE_PRE_LOCK: external_match_no=9001, kickoff_at = now() + 90s.
-- Smoke clicks the stepper, expects a successful save (pre-lock).
insert into public.fixtures (
  tournament_id, external_match_no, stage, group_code, kickoff_at,
  home_team_id, away_team_id,
  home_placeholder, away_placeholder,
  result_home_90min, result_away_90min,
  result_home_full,  result_away_full
)
select
  (select id from public.tournament where code = 'WC2026' limit 1),
  9001, 'group', 'A', now() + interval '90 seconds',
  (select id from public.teams where code = 'BRA' limit 1),
  (select id from public.teams where code = 'ARG' limit 1),
  null, null, null, null, null, null
where not exists (select 1 from public.fixtures where external_match_no = 9001);

-- SMOKE_POST_LOCK: external_match_no=9002, kickoff_at = now() - 1min.
-- Smoke asserts UI shows lock variant AND server-side write attempt is rejected by RLS.
insert into public.fixtures (
  tournament_id, external_match_no, stage, group_code, kickoff_at,
  home_team_id, away_team_id,
  home_placeholder, away_placeholder,
  result_home_90min, result_away_90min,
  result_home_full,  result_away_full
)
select
  (select id from public.tournament where code = 'WC2026' limit 1),
  9002, 'group', 'A', now() - interval '1 minute',
  (select id from public.teams where code = 'BRA' limit 1),
  (select id from public.teams where code = 'ARG' limit 1),
  null, null, null, null, null, null
where not exists (select 1 from public.fixtures where external_match_no = 9002);

-- Refresh BOTH rows' kickoff_at on re-seed so the relative timestamps stay correct.
-- The smoke depends on 9001 being PRE-lock (>now) and 9002 being POST-lock (<now).
update public.fixtures
   set kickoff_at = now() + interval '90 seconds',
       updated_at = now()
 where external_match_no = 9001;

update public.fixtures
   set kickoff_at = now() - interval '1 minute',
       updated_at = now()
 where external_match_no = 9002;

commit;

select external_match_no, kickoff_at from public.fixtures
 where external_match_no in (9001, 9002)
 order by external_match_no;

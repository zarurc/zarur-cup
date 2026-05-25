-- data/test-fixtures-clean.sql
-- Removes everything seeded by data/test-fixtures.sql + the SmokeUser tree.
-- FK-safe order: score_events → predictions → prop_answers → fixtures → profiles.
-- (auth.users rows for SmokeUser deleted via Supabase Admin API in
--  tests/e2e/global-teardown.ts — psql cannot delete from auth schema.)

begin;

-- 1. Children of the test fixtures.
delete from public.score_events
  where source = 'league'
    and ref_id in (select id from public.fixtures where external_match_no in (9001, 9002));

delete from public.predictions
  where fixture_id in (select id from public.fixtures where external_match_no in (9001, 9002));

-- 2. The test fixtures themselves.
delete from public.fixtures where external_match_no in (9001, 9002);

-- 3. SmokeUser tree (any test-user whose display_name LIKE 'SmokeUser%').
--    Children FIRST (FK-safe).
delete from public.score_events
  where user_id in (select user_id from public.profiles where display_name like 'SmokeUser%');

delete from public.predictions
  where user_id in (select user_id from public.profiles where display_name like 'SmokeUser%');

delete from public.prop_answers
  where user_id in (select user_id from public.profiles where display_name like 'SmokeUser%');

delete from public.profiles where display_name like 'SmokeUser%';

-- auth.users rows for SmokeUser must be deleted via Supabase Admin API
-- (svc.auth.admin.deleteUser); documented in tests/e2e/global-teardown.ts.

commit;

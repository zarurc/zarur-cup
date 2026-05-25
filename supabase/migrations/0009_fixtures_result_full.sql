-- Migration 0009: add result_home_full / result_away_full to public.fixtures.
--
-- WHY THIS MIGRATION EXISTS (Phase 2, D-12):
-- Phase 3 (Bracket Mode) will introduce an admin UI for knockout matches that
-- went to extra time / penalties. The League scoring engine in Phase 2 reads
-- result_home_90min / result_away_90min ONLY (Kicktipp 4/3/2 over 90-min
-- score), so the Phase-2 admin UI never writes these new _full columns.
-- Shipping the schema now (forward-compat) means Phase 3 ships UI only —
-- no migration round-trip required mid-tournament.
--
-- INVARIANTS (D-12):
--   - Group-stage fixtures: result_home_full / result_away_full stay NULL
--     forever. They are conceptually meaningless for group play.
--   - Knockout fixtures (R32 onward) in Phase 3: admin sets _full when ET
--     or penalties decide the match; _90min still records the 90-minute
--     score (used by League scoring); _full + an ET-toggle column (not
--     in this migration) decide Bracket advancement.
--
-- DO NOT TOUCH legacy result_home / result_away columns (0001_init.sql lines
-- 65-66) — Phase 1 left them NULL forever and Phase 2 keeps that posture
-- (see Phase 1 "Don't Hand-Roll" decision). Use _90min for League scoring;
-- this migration only ADDS the _full pair.
--
-- APPEND-ONLY: Phase 1 D-21. Never edit this file once pushed.

-- ============================================================
-- 1. Add the columns. smallint matches the _90min pair; nullable because
--    group-stage fixtures never set them.
-- ============================================================
alter table public.fixtures
  add column result_home_full smallint,
  add column result_away_full smallint;

comment on column public.fixtures.result_home_full is
  'KO ET/penalty home score; populated by Phase 3 admin only. NULL for group-stage fixtures (D-12).';
comment on column public.fixtures.result_away_full is
  'KO ET/penalty away score; populated by Phase 3 admin only. NULL for group-stage fixtures (D-12).';

-- ============================================================
-- 2. Smoke: confirm both columns exist with the expected shape (nullable
--    smallint). If a future migration accidentally NOT-NULLs them or
--    changes type, this will fire on `db push`.
-- ============================================================
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'fixtures'
      and column_name  = 'result_home_full'
      and is_nullable  = 'YES'
      and data_type    = 'smallint'
  ) then
    raise exception '0009 smoke failed: fixtures.result_home_full missing or wrong shape (expected nullable smallint)';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'fixtures'
      and column_name  = 'result_away_full'
      and is_nullable  = 'YES'
      and data_type    = 'smallint'
  ) then
    raise exception '0009 smoke failed: fixtures.result_away_full missing or wrong shape (expected nullable smallint)';
  end if;
end$$;

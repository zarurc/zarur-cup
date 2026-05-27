-- ============================================================
-- Migration 0014 — fixtures.auto_fetched_at (D-45 + D-47 + AUTO-01)
--
-- Adds a nullable timestamptz column that the /api/score-fetch cron uses
-- to track which fixtures had their scores auto-fetched from
-- football-data.org. The cron MUST NOT overwrite a fixture whose
-- `result_home_90min` is non-NULL AND `auto_fetched_at` is NULL — that
-- combination signals "admin entered manually; cron stay out."
--
-- The `saveResult` Server Action (admin manual entry) clears this
-- column to NULL on every admin write so subsequent cron polls respect
-- the admin's intent.
--
-- Why append-only with this number: 0013 was used by Plan 02-10 (props
-- private); 0012 is reserved for Plan 02-12 Task 2 (pg_cron schedule).
-- Migrations are append-only on this project (Phase 1 D-21); 0012 + 0013
-- + 0014 can ship in the same `supabase db push` batch.
-- ============================================================

alter table public.fixtures
  add column if not exists auto_fetched_at timestamptz null;

comment on column public.fixtures.auto_fetched_at is
  'Set by /api/score-fetch when result_home_90min/result_away_90min are populated from football-data.org. NULL means admin-entered (or never scored). The cron UPDATE filter is `result_home_90min IS NULL OR auto_fetched_at IS NOT NULL`. The saveResult Server Action MUST set this to NULL on every admin write.';

-- B-style smoke: confirm the column exists with the correct type + nullability.
do $$
declare
  col_data_type text;
  col_is_nullable text;
begin
  select data_type, is_nullable into col_data_type, col_is_nullable
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'fixtures'
     and column_name = 'auto_fetched_at';

  if col_data_type is null then
    raise exception
      '0014 migration failed: fixtures.auto_fetched_at column does not exist after ALTER';
  end if;

  if col_data_type <> 'timestamp with time zone' then
    raise exception
      '0014 migration failed: fixtures.auto_fetched_at has wrong type: % (expected timestamp with time zone)', col_data_type;
  end if;

  if col_is_nullable <> 'YES' then
    raise exception
      '0014 migration failed: fixtures.auto_fetched_at is NOT nullable (must be nullable for admin-entered rows)';
  end if;
end;
$$;

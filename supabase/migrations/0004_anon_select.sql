-- Migration 0004: GRANT SELECT to anon on every Phase-1 table.
--
-- WHY THIS MIGRATION EXISTS (Rule 1 deviation, Plan 01-02):
-- After 0003_grants.sql, anon had ZERO table-level DML grants on every Phase-1
-- table. The anon-curl verification (scripts/verify-rls-no-leak.sh) hit
-- "42501 permission denied for table predictions" instead of returning `[]`
-- as the plan's must_haves requires:
--
--   "An unauthenticated curl against /rest/v1/predictions returns []
--    (empty array), not an error and not data"
--
-- The plan's contract is "RLS is the ONLY enforcer for lock-on-kickoff."
-- That contract requires the GRANT layer to be permissive (anon has SELECT)
-- so the RLS layer is the only thing actually filtering rows. With NO grant
-- to anon, we'd be proving "GRANTs are the lock" instead of "RLS is the lock"
-- -- a weaker, ambiguous result.
--
-- This migration restores the canonical Supabase posture: anon has SELECT on
-- every public table; the RLS policies all target `to authenticated`, so the
-- policy never applies to anon, and Postgres returns 0 rows -- which
-- PostgREST renders as `[]`. The lock is the RLS policy. Provable, testable.
--
-- NOTE: This migration deliberately INVERTS the anon-zero-DML smoke check
-- added in 0003_grants.sql. The smoke check was a misread of the contract:
-- it conflated "no table-level grants" with "RLS lock". The latter is what
-- the plan actually wants. We drop the smoke at the end of this migration
-- so future schema changes don't trip it.

-- ============================================================
-- 1. anon: SELECT on every Phase-1 table.
--    No INSERT/UPDATE/DELETE. RLS policies all target `to authenticated`,
--    so anon SELECT returns zero rows for every table -- which is `[]`.
-- ============================================================
grant select on
  public.tournament,
  public.profiles,
  public.teams,
  public.fixtures,
  public.bracket_slots,
  public.bracket_picks,
  public.predictions,
  public.prop_questions,
  public.prop_answers
to anon;

-- ============================================================
-- 2. Confirm anon still has NO write privileges (only SELECT).
--    Any future migration adding INSERT/UPDATE/DELETE to anon is a regression.
-- ============================================================
do $$
declare
  offenders text;
begin
  select string_agg(table_name || ':' || privilege_type, ', ')
    into offenders
    from information_schema.table_privileges
    where table_schema = 'public'
      and grantee = 'anon'
      and privilege_type in ('INSERT','UPDATE','DELETE');
  if offenders is not null then
    raise exception 'Anon write grant detected (Phase 1 contract: anon may only SELECT, and RLS returns []): %', offenders;
  end if;
end$$;

-- ============================================================
-- 3. Confirm anon now has SELECT on all 9 Phase-1 tables.
-- ============================================================
do $$
declare
  missing text;
begin
  with expected (tbl) as (values
    ('tournament'),('profiles'),('teams'),('fixtures'),('bracket_slots'),
    ('bracket_picks'),('predictions'),('prop_questions'),('prop_answers')
  )
  select string_agg(expected.tbl, ', ')
    into missing
    from expected
    left join information_schema.table_privileges p
      on p.table_schema = 'public'
     and p.table_name = expected.tbl
     and p.grantee = 'anon'
     and p.privilege_type = 'SELECT'
    where p.table_name is null;
  if missing is not null then
    raise exception 'anon SELECT grant missing on: %', missing;
  end if;
end$$;

-- ============================================================
-- 4. Re-assert B1 column-grant invariant (untouched by this migration).
-- ============================================================
do $$
declare
  cols text;
begin
  select string_agg(column_name, ',' order by column_name)
    into cols
    from information_schema.column_privileges
    where table_schema = 'public'
      and table_name = 'profiles'
      and grantee = 'authenticated'
      and privilege_type = 'UPDATE';
  if cols is null or cols <> 'display_name,locale' then
    raise exception 'B1 column-grant check (after 0004) failed: authenticated UPDATE on profiles = "%", expected "display_name,locale"', cols;
  end if;
end$$;

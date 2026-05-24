-- Migration 0003: Table-level GRANTs for the API roles.
--
-- WHY THIS MIGRATION EXISTS (Rule 2 deviation, Plan 01-02):
-- The Supabase project was provisioned with "Automatically expose new tables: OFF"
-- (see Plan 01-02 user context). With that setting, the usual event-trigger that
-- grants SELECT/INSERT/UPDATE/DELETE on every new `public` table to anon,
-- authenticated, and service_role does NOT fire. After 0001+0002, every role had
-- only REFERENCES + TRIGGER + TRUNCATE on every table -- meaning the API roles
-- could NOT read or write ANYTHING, even with RLS policies attached. RLS narrows
-- what GRANTs allow; without GRANTs, RLS is unreachable.
--
-- This migration restores the GRANTs the Phase-1 RLS model assumes:
--   - service_role:   full DML on every table (admin paths, seed migrations,
--                     heartbeat). RLS does NOT apply to service_role -- it
--                     bypasses RLS by design (Supabase convention).
--   - authenticated:  table-wide SELECT/INSERT/DELETE on every Phase-1 table.
--                     UPDATE is column-scoped on `profiles` (0002_rls.sql's B1
--                     defense) -- this file does NOT touch the profiles UPDATE
--                     grant. UPDATE is table-wide on every OTHER table.
--   - anon:           NOTHING. Anon callers must see [] for every table. This
--                     is the lock-and-reveal contract that scripts/verify-rls-no-leak.sh
--                     proves at the live URL.
--
-- After this migration the B1 column-grant smoke check in 0002_rls.sql still
-- holds (authenticated UPDATE on profiles = exactly display_name + locale),
-- because this migration never grants table-wide UPDATE on profiles.

-- ============================================================
-- 1. service_role: full DML on every Phase-1 table.
--    RLS does not apply to service_role; this is the role we use from the
--    server (heartbeat, admin actions, future seed migrations).
-- ============================================================
grant select, insert, update, delete on
  public.tournament,
  public.profiles,
  public.teams,
  public.fixtures,
  public.bracket_slots,
  public.bracket_picks,
  public.predictions,
  public.prop_questions,
  public.prop_answers
to service_role;

-- ============================================================
-- 2. authenticated: table-wide SELECT/INSERT/DELETE on every Phase-1 table.
--    Plus table-wide UPDATE on every table EXCEPT profiles.
--    The profiles UPDATE grant is column-restricted to (display_name, locale)
--    in 0002_rls.sql (B1). We deliberately do not re-grant it here.
-- ============================================================

-- 2a. SELECT on every table (RLS USING predicates do the row filtering)
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
to authenticated;

-- 2b. INSERT on every table (RLS WITH CHECK predicates do the row gating).
--     Public-read tables (tournament, teams, fixtures, bracket_slots,
--     prop_questions) have no INSERT policy, so RLS denies all authenticated
--     INSERTs by default -- granting INSERT is harmless and keeps the surface
--     uniform. Mutations on these tables happen via service_role only.
grant insert on
  public.tournament,
  public.profiles,
  public.teams,
  public.fixtures,
  public.bracket_slots,
  public.bracket_picks,
  public.predictions,
  public.prop_questions,
  public.prop_answers
to authenticated;

-- 2c. UPDATE on every table EXCEPT profiles (profiles has column-scoped UPDATE
--     from 0002_rls.sql). Same reasoning as 2b: tables without UPDATE policies
--     deny all authenticated UPDATEs at the RLS layer.
grant update on
  public.tournament,
  public.teams,
  public.fixtures,
  public.bracket_slots,
  public.bracket_picks,
  public.predictions,
  public.prop_questions,
  public.prop_answers
to authenticated;
-- NOTE: profiles UPDATE is column-scoped in 0002_rls.sql -- do NOT add here.

-- 2d. DELETE on every table (RLS USING predicates do the row gating).
grant delete on
  public.tournament,
  public.profiles,
  public.teams,
  public.fixtures,
  public.bracket_slots,
  public.bracket_picks,
  public.predictions,
  public.prop_questions,
  public.prop_answers
to authenticated;

-- ============================================================
-- 3. anon: NOTHING. Explicit no-op for documentation -- anon already has zero
--    DML grants on every public table, and we intend to keep it that way so
--    the lock test (scripts/verify-rls-no-leak.sh) returns [] for every table.
--    Any future migration adding `grant ... to anon` is a regression.
-- ============================================================
-- (intentionally empty)

-- ============================================================
-- 4. Re-assert B1 column-grant invariant. After this migration runs, the
--    profiles UPDATE grant for `authenticated` MUST still be exactly
--    (display_name, locale). This DO block fails the migration if any
--    accidental table-wide UPDATE-on-profiles grant slipped in.
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
    raise exception 'B1 column-grant check (after 0003_grants) failed: authenticated UPDATE on profiles = "%", expected "display_name,locale"', cols;
  end if;
end$$;

-- ============================================================
-- 5. Smoke: anon must have ZERO DML privileges on every Phase-1 table.
--    Raises if anon ever holds SELECT/INSERT/UPDATE/DELETE anywhere in public.
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
      and privilege_type in ('SELECT','INSERT','UPDATE','DELETE');
  if offenders is not null then
    raise exception 'Anon DML grant detected (Phase 1 lock contract broken): %', offenders;
  end if;
end$$;

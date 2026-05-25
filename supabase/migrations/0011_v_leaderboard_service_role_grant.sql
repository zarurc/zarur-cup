-- ============================================================
-- Migration 0011 — corrective: grant SELECT on v_leaderboard to service_role
--
-- Why this is a separate migration (Phase 1 P02 append-only pattern):
-- 0008_v_leaderboard.sql intentionally omitted `grant select on
-- public.v_leaderboard to service_role` based on the assumption that
-- service_role inherits read access via Supabase's role hierarchy.
--
-- This project was provisioned with `Automatically expose new tables: OFF`
-- (see Phase 1 Plan 01-02 deviations + 0003_grants.sql). On that posture the
-- default-grants event trigger does NOT fire and service_role lacks SELECT
-- on objects created without an explicit grant — including views. Verified
-- post-push 2026-05-25: REST hit with sb_secret_* key returned 42501
-- "permission denied for view v_leaderboard".
--
-- Migrations are append-only on this project (Phase 1 Pattern: never edit a
-- pushed migration, always add a new sequential one). 0008 stays on live as
-- historical record; this migration adds the missing grant.
--
-- Affects:
--   - Plan 02-06 integrity widget (admin-side read via adminReadClient)
--   - Any future service_role consumer of v_leaderboard
-- Does NOT affect authenticated/anon: those grants already exist in 0008
--   and survive untouched.
-- ============================================================

grant select on public.v_leaderboard to service_role;

-- B-style smoke: confirm service_role now has SELECT on v_leaderboard.
do $$
declare
  has_grant boolean;
begin
  select exists (
    select 1
      from information_schema.role_table_grants
     where table_schema  = 'public'
       and table_name    = 'v_leaderboard'
       and grantee       = 'service_role'
       and privilege_type = 'SELECT'
  ) into has_grant;

  if not has_grant then
    raise exception
      '0011 grant failed: service_role still lacks SELECT on public.v_leaderboard';
  end if;
end;
$$;

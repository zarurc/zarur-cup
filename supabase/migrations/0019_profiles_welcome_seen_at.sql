-- ============================================================
-- Migration 0019 — profiles.welcome_seen_at + grant
--
-- Adds a nullable timestamp on public.profiles to mark the first time
-- a user has dismissed the /welcome onboarding page. NULL = never seen.
-- The home redirect in /[locale]/page.tsx forwards signed-in users
-- with NULL welcome_seen_at to /welcome before /matches.
--
-- Existing profiles backfilled to now() so already-onboarded family
-- members don't see the welcome screen on their next visit. Only truly
-- new joins start with NULL.
--
-- Column-level UPDATE grant: 0002_rls.sql column-scoped authenticated
-- UPDATE on profiles to (display_name, locale) — this migration ADDS
-- welcome_seen_at to that grant so the dismissal Server Action (running
-- under the user's RLS context) can flip the timestamp on their own
-- row. The row-level policy profiles_update_self already restricts
-- writes to the caller's own row.
-- ============================================================

alter table public.profiles
  add column if not exists welcome_seen_at timestamptz;

comment on column public.profiles.welcome_seen_at is
  'NULL = user has not seen the /welcome onboarding page yet. Set on dismissal by the markWelcomeSeen Server Action. Used by /[locale]/page.tsx to route first-time logins through /welcome before /matches.';

-- Backfill existing profiles so they skip the welcome screen.
update public.profiles
   set welcome_seen_at = now()
 where welcome_seen_at is null;

-- Extend the column-level UPDATE grant. Existing (display_name, locale)
-- grant from 0002 stays — Postgres ORs them at the privilege layer.
grant update (welcome_seen_at) on public.profiles to authenticated;

-- Smoke.
do $$
declare cols text;
begin
  select string_agg(column_name, ',' order by column_name)
    into cols
    from information_schema.column_privileges
   where grantee = 'authenticated'
     and table_schema = 'public'
     and table_name = 'profiles'
     and privilege_type = 'UPDATE';
  if cols is null or position('welcome_seen_at' in cols) = 0 then
    raise exception '0019 smoke failed: welcome_seen_at not in authenticated UPDATE grant on profiles (got: %)', cols;
  end if;
end$$;

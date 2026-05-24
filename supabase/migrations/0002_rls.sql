-- Migration 0002: RLS enable + lock-and-reveal policies for Phase 1.
-- Every Phase-1 table is RLS-protected. Predicates use (select auth.uid())
-- per CVE-2025-48757 best practice (Supabase auth_rls_initplan advisor lint).

-- ============================================================
-- 1. tournament -- public read for authenticated users
-- ============================================================
alter table public.tournament enable row level security;
create policy tournament_read on public.tournament
  for select to authenticated using (true);

-- ============================================================
-- 2. profiles -- read all profiles (needed for leaderboard);
--    write only own row; column-level GRANT blocks is_admin self-escalation (B1)
-- ============================================================
alter table public.profiles enable row level security;

-- B1 defense: revoke table-wide UPDATE from authenticated and re-grant only
-- the two columns the user is allowed to change. is_admin, display_name_normalized,
-- joined_at, and user_id are NOT grantable -- Postgres rejects writes to them
-- at the privilege layer (errors with "permission denied for column ..."),
-- BEFORE the RLS USING/WITH CHECK predicates run. The row-level policy below
-- remains as defense in depth (row ownership check).
revoke update on public.profiles from authenticated;
grant update (display_name, locale) on public.profiles to authenticated;

create policy profiles_read_all on public.profiles
  for select to authenticated using (true);
  -- All authenticated users can read all profiles (display_name + is_admin etc).
  -- This is intentional: leaderboard needs to show names; family pool trust model.
  -- If we ever wanted to redact, we'd add a column-level grant. Not needed v1.

create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (
    user_id = (select auth.uid())
  );
  -- INSERT path is still where is_admin can legitimately be set. The Server Action
  -- in Plan 04 sets is_admin only when display_name matches ADMIN_DISPLAY_NAME
  -- (D-04). After INSERT, the column-level GRANT above prevents any UPDATE to
  -- is_admin even though the row-level policy would otherwise allow it.

create policy profiles_update_self on public.profiles
  for update to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

-- No DELETE policy. Profiles persist; deletion requires service-role (admin merge tool, Phase 2).

-- ============================================================
-- 3. teams -- public read for authenticated users
-- ============================================================
alter table public.teams enable row level security;
create policy teams_read on public.teams
  for select to authenticated using (true);

-- ============================================================
-- 4. fixtures -- public read for authenticated users
-- ============================================================
alter table public.fixtures enable row level security;
create policy fixtures_read on public.fixtures
  for select to authenticated using (true);

-- ============================================================
-- 5. bracket_slots -- public read for authenticated users
-- ============================================================
alter table public.bracket_slots enable row level security;
create policy bracket_slots_read on public.bracket_slots
  for select to authenticated using (true);

-- ============================================================
-- 6. bracket_picks -- lock-and-reveal at the slot's gating moment
--    (Phase 3 will refine slot-level lock; Phase 1 uses a permissive own-row policy
--     until Phase 3 lands the cross-slot lock predicate)
-- ============================================================
alter table public.bracket_picks enable row level security;

create policy bracket_picks_read_own on public.bracket_picks
  for select to authenticated using (
    user_id = (select auth.uid())
  );
  -- Phase 3 will widen this to allow reads of others' picks after the reveal moment.

create policy bracket_picks_insert_own on public.bracket_picks
  for insert to authenticated with check (
    user_id = (select auth.uid())
  );
  -- Phase 3 will add the slot-level lock predicate.

create policy bracket_picks_update_own on public.bracket_picks
  for update to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

create policy bracket_picks_delete_own on public.bracket_picks
  for delete to authenticated using (
    user_id = (select auth.uid())
  );

-- ============================================================
-- 7. predictions -- lock-and-reveal core (RESEARCH §"Pattern 2")
-- ============================================================
alter table public.predictions enable row level security;

create policy predictions_read on public.predictions
  for select to authenticated using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.fixtures f
      where f.id = predictions.fixture_id and f.kickoff_at <= now()
    )
  );

create policy predictions_insert on public.predictions
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.fixtures f
      where f.id = fixture_id and f.kickoff_at > now()
    )
  );

create policy predictions_update on public.predictions
  for update to authenticated
    using (user_id = (select auth.uid()))
    with check (
      user_id = (select auth.uid())
      and exists (
        select 1 from public.fixtures f
        where f.id = fixture_id and f.kickoff_at > now()
      )
    );

create policy predictions_delete on public.predictions
  for delete to authenticated using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.fixtures f
      where f.id = fixture_id and f.kickoff_at > now()
    )
  );

-- ============================================================
-- 8. prop_questions -- public read for authenticated users
-- ============================================================
alter table public.prop_questions enable row level security;
create policy prop_questions_read on public.prop_questions
  for select to authenticated using (true);

-- ============================================================
-- 9. prop_answers -- lock-and-reveal at tournament first kickoff
--    (visibility opens at tournament.starts_at; writes locked at same moment)
-- ============================================================
alter table public.prop_answers enable row level security;

create policy prop_answers_read on public.prop_answers
  for select to authenticated using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.tournament t
      join public.prop_questions q on q.tournament_id = t.id
      where q.id = prop_answers.question_id and t.starts_at <= now()
    )
  );

create policy prop_answers_insert on public.prop_answers
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.tournament t
      join public.prop_questions q on q.tournament_id = t.id
      where q.id = question_id and t.starts_at > now()
    )
  );

create policy prop_answers_update on public.prop_answers
  for update to authenticated
    using (user_id = (select auth.uid()))
    with check (
      user_id = (select auth.uid())
      and exists (
        select 1 from public.tournament t
        join public.prop_questions q on q.tournament_id = t.id
        where q.id = question_id and t.starts_at > now()
      )
    );

create policy prop_answers_delete on public.prop_answers
  for delete to authenticated using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.tournament t
      join public.prop_questions q on q.tournament_id = t.id
      where q.id = question_id and t.starts_at > now()
    )
  );

-- ============================================================
-- 10. Smoke check at migration time: no Phase-1 table should have RLS disabled.
--     This DO block raises an exception if anyone forgets `enable row level security`.
-- ============================================================
do $$
declare
  offenders text;
begin
  select string_agg(tablename, ', ')
    into offenders
    from pg_tables
    where schemaname = 'public'
      and tablename in (
        'tournament','profiles','teams','fixtures','bracket_slots',
        'bracket_picks','predictions','prop_questions','prop_answers'
      )
      and rowsecurity = false;
  if offenders is not null then
    raise exception 'Phase 1 RLS smoke check failed: % missing `enable row level security`', offenders;
  end if;
end$$;

-- ============================================================
-- 11. B1 smoke check: profiles UPDATE grant must be column-restricted.
--     authenticated must hold UPDATE on EXACTLY (display_name, locale) -- no other columns.
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
    raise exception 'B1 column-grant check failed: authenticated UPDATE on profiles = "%", expected "display_name,locale"', cols;
  end if;
end$$;

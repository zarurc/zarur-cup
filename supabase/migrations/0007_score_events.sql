-- Migration 0007: score_events — idempotent points projection (Phase 2, D-19).
--
-- WHY THIS MIGRATION EXISTS:
-- Phase 2 saveResult / gradeProp Server Actions UPSERT into this table; the
-- v_leaderboard view (0008) aggregates. The PRIMARY KEY (user_id, source, ref_id)
-- IS the idempotency key per SCR-06 + D-10 (admin corrections are seamless
-- because re-running the score sweep UPSERTs the same row).
--
-- POSTURE (D-19, family-trust):
--   - SELECT: open to all signed-in members (using (true)) — leaderboard is
--     intentionally public-to-members. Same anon SELECT layer as every other
--     Phase 1 table (D-21 "anon SELECT so RLS is the visible lock"), but with
--     the RLS policy targeting `to authenticated` only, anon sees zero rows.
--   - INSERT / UPDATE / DELETE: NO policy for authenticated => RLS default-deny.
--     All writes happen via service-role (saveResult/gradeProp Server Actions).
--     The B-style smoke at the end of this migration fails fast if any DML
--     grant is ever accidentally added for `authenticated`.
--
-- APPEND-ONLY: Per Phase 1 D-21 / Plan 01-02 deviations, migrations are
-- append-only. Never edit this file once pushed; add a new sequential
-- migration to evolve.

-- ============================================================
-- 1. Table shape (D-19).
--    PK (user_id, source, ref_id) is the idempotency key.
--    `kind` drives SCR-07 per-pick transparency badges ('exact','goal-diff',
--    'winner','miss' for league; 'correct'/'miss' for props; reserved for
--    bracket in Phase 3).
-- ============================================================
create table public.score_events (
  user_id     uuid        not null references auth.users(id) on delete cascade,
  source      text        not null check (source in ('league','prop','bracket')),
  ref_id      uuid        not null,
  points      smallint    not null,
  kind        text        null     check (kind in ('exact','goal-diff','winner','miss','correct')),
  updated_at  timestamptz not null default now(),
  primary key (user_id, source, ref_id)
);

create index score_events_user_idx       on public.score_events (user_id);
create index score_events_source_ref_idx on public.score_events (source, ref_id);

-- ============================================================
-- 2. RLS: enable + SELECT-for-all-members. NO INSERT/UPDATE/DELETE policy =>
--    denied by default for authenticated. Service-role bypasses RLS.
-- ============================================================
alter table public.score_events enable row level security;

-- Public-to-members read (D-19 family-trust). Uses (true) because
-- leaderboard is intentionally shared; RLS still scopes to `authenticated`
-- so anon sees [] (rows are filtered out, not 42501).
create policy score_events_read on public.score_events
  for select to authenticated using (true);

-- ============================================================
-- 3. GRANTs (mirror 0003_grants.sql + 0004_anon_select.sql shape):
--    - service_role: full DML (writes from saveResult/gradeProp).
--    - authenticated: SELECT only. NO INSERT/UPDATE/DELETE — RLS lock holds.
--    - anon: SELECT only (Phase 1 convention so RLS is the visible lock).
-- ============================================================
grant select, insert, update, delete on public.score_events to service_role;
grant select                          on public.score_events to authenticated;
grant select                          on public.score_events to anon;

-- ============================================================
-- 4. B-style smoke: confirm authenticated has NO INSERT/UPDATE/DELETE grants
--    on score_events. Phase 2 lock posture is "writes via service-role only";
--    if any future migration accidentally widens this, the smoke raises and
--    the migration aborts.
-- ============================================================
do $$
declare
  offenders text;
begin
  select string_agg(privilege_type, ',' order by privilege_type)
    into offenders
    from information_schema.table_privileges
    where table_schema = 'public'
      and table_name  = 'score_events'
      and grantee     = 'authenticated'
      and privilege_type in ('INSERT','UPDATE','DELETE');
  if offenders is not null then
    raise exception 'score_events B-style check failed: authenticated holds unexpected DML grant(s): %', offenders;
  end if;
end$$;

-- ============================================================
-- 5. B-style smoke: confirm anon has NO write grants (anon may only SELECT).
-- ============================================================
do $$
declare
  offenders text;
begin
  select string_agg(privilege_type, ',' order by privilege_type)
    into offenders
    from information_schema.table_privileges
    where table_schema = 'public'
      and table_name  = 'score_events'
      and grantee     = 'anon'
      and privilege_type in ('INSERT','UPDATE','DELETE');
  if offenders is not null then
    raise exception 'score_events anon write grant detected (Phase 1 lock contract broken): %', offenders;
  end if;
end$$;

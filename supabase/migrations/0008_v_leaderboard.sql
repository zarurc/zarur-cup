-- Migration 0008: v_leaderboard view — aggregates score_events per profile.
--
-- WHY THIS MIGRATION EXISTS (Phase 2, D-20):
-- The leaderboard page reads from this VIEW (not directly from score_events).
-- The view rolls up `score_events` into 6 derived columns per profile:
--   total, league_total, props_total, bracket_total, exact_count, correct_count.
-- LEFT JOIN ensures every profile shows up (with all-zero totals) even before
-- they have any score_events rows.
--
-- NO ORDER BY here: The LB-04 tiebreaker chain (total -> exact_count ->
-- correct_count -> locale-aware alphabetical) lives in the consumer RSC
-- (TypeScript-side Intl.Collator per RESEARCH Pattern 7 + Pitfall 5 — avoids
-- the "is `und-x-icu` collation actually present on this Supabase build?"
-- question).
--
-- bracket_total stays 0 in Phase 2: Phase 3 will write source='bracket' rows
-- to score_events; until then bracket_total aggregates to 0 by SUM (no rows).
-- The leaderboard breakdown UI renders this as the literal "0 — opens June 27"
-- (D-28) so the placeholder is consistent across all users.
--
-- VIEW vs MATERIALIZED VIEW: regular VIEW chosen — at 15 users x ~120 events
-- (~1.8k rows), a SUM/GROUP BY/JOIN is sub-ms. Re-evaluate only if row counts
-- balloon (Phase 3 bracket scoring is still small).
--
-- APPEND-ONLY: Phase 1 D-21. Never edit this file once pushed; replace via a
-- new migration that runs `create or replace view ...`.

-- ============================================================
-- 1. View definition.
--    LEFT JOIN profiles -> score_events so every profile appears, with COALESCE
--    forcing zeros instead of NULL when a member has no events yet.
--    FILTER clauses bucket score_events by source / kind without needing
--    separate sub-queries.
-- ============================================================
create or replace view public.v_leaderboard as
select
  p.user_id,
  p.display_name,
  coalesce(sum(se.points),                                                      0)::int as total,
  coalesce(sum(se.points) filter (where se.source = 'league'),                  0)::int as league_total,
  coalesce(sum(se.points) filter (where se.source = 'prop'),                    0)::int as props_total,
  coalesce(sum(se.points) filter (where se.source = 'bracket'),                 0)::int as bracket_total,
  coalesce(count(*)       filter (where se.kind   = 'exact'),                   0)::int as exact_count,
  coalesce(count(*)       filter (where se.kind  in
                                  ('exact','goal-diff','winner','correct')),    0)::int as correct_count
from public.profiles p
left join public.score_events se on se.user_id = p.user_id
group by p.user_id, p.display_name;

-- ============================================================
-- 2. GRANTs (mirror 0003_grants.sql + 0004_anon_select.sql shape).
--    The view is a thin projection over score_events; SELECT is appropriate
--    for the same posture as the underlying table (public-to-members read).
-- ============================================================
grant select on public.v_leaderboard to authenticated;
grant select on public.v_leaderboard to anon;
-- service_role inherits via superuser-equivalent in Supabase; explicit grant
-- not required for views in Supabase's role model but is harmless to add if
-- a future migration finds it useful.

-- ============================================================
-- 3. Smoke: confirm the view is defined and queryable. We don't expect any
--    rows pre-Phase-2-runtime; `limit 1` is enough to prove the planner
--    can resolve the projection.
-- ============================================================
do $$
begin
  perform 1 from public.v_leaderboard limit 1;
exception when others then
  raise exception 'v_leaderboard smoke failed: %', sqlerrm;
end$$;

-- ============================================================
-- 4. Smoke: confirm the view exposes the six expected aggregation columns
--    so a downstream typegen + RSC consumer can rely on the shape.
-- ============================================================
do $$
declare
  missing text;
begin
  with expected (col) as (values
    ('user_id'),('display_name'),('total'),('league_total'),
    ('props_total'),('bracket_total'),('exact_count'),('correct_count')
  )
  select string_agg(expected.col, ', ')
    into missing
    from expected
    left join information_schema.columns c
      on c.table_schema = 'public'
     and c.table_name   = 'v_leaderboard'
     and c.column_name  = expected.col
    where c.column_name is null;
  if missing is not null then
    raise exception 'v_leaderboard schema check failed: missing columns: %', missing;
  end if;
end$$;

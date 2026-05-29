-- ============================================================
-- Migration 0018 — prop_questions trimmed to 5 awards-only questions
--
-- Drops MOST_GOALS, FIRST_RED, FIRST_PEN_WIN, HOST_FINAL, MOST_YELLOWS
-- (introduced by 0016) and reindexes display_order on the surviving 5
-- to the user-stated reading order: 1st / 2nd / 3rd / Golden Boot /
-- Golden Ball.
--
-- Surviving 5 questions (32 pts total, locks at tournament.starts_at):
--   1. WINNER       10 pts   single_team
--   2. RUNNER_UP     5 pts   single_team
--   3. THIRD_PLACE   5 pts   single_team
--   4. GOLDEN_BOOT   8 pts   single_player
--   5. GOLDEN_BALL   4 pts   single_player
--
-- Pre-launch (no real prop_answers — confirmed 2026-05-28). FK on
-- prop_answers.question_id is ON DELETE CASCADE, so deleting the 5
-- retired prop_questions rows cleans up any stray answers transparently.
-- ============================================================

do $$
declare
  v_tournament_id uuid;
begin
  select id into v_tournament_id from public.tournament where code = 'WC2026';
  if v_tournament_id is null then
    raise exception 'WC2026 tournament row not found — apply 0006 reseed first.';
  end if;

  delete from public.prop_questions
   where tournament_id = v_tournament_id
     and code in ('MOST_GOALS', 'FIRST_RED', 'FIRST_PEN_WIN', 'HOST_FINAL', 'MOST_YELLOWS');

  update public.prop_questions set display_order = case code
    when 'WINNER'      then 1
    when 'RUNNER_UP'   then 2
    when 'THIRD_PLACE' then 3
    when 'GOLDEN_BOOT' then 4
    when 'GOLDEN_BALL' then 5
    else display_order
  end
   where tournament_id = v_tournament_id;
end$$;

-- Integrity check.
do $$
declare
  v_count int;
  v_points int;
  v_tournament_id uuid;
begin
  select id into v_tournament_id from public.tournament where code = 'WC2026';

  select count(*), coalesce(sum(points), 0)
    into v_count, v_points
    from public.prop_questions
   where tournament_id = v_tournament_id;

  if v_count <> 5 then
    raise exception 'prop_questions count for WC2026 = %, expected 5', v_count;
  end if;
  if v_points <> 32 then
    raise exception 'prop_questions points total for WC2026 = %, expected 32', v_points;
  end if;
  raise notice 'prop_questions trim complete: 5 questions, 32 pts total';
end$$;

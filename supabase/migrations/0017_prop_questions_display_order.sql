-- ============================================================
-- Migration 0017 — prop_questions.display_order
--
-- The /me/props page previously sorted by `id asc` (effectively
-- random insertion-order UUIDs). Order matters now — narrative-flow
-- ordering (early-tournament events → late awards) is what the family
-- will read top-to-bottom on a phone.
--
-- Add a smallint column with a sane default, populate per the agreed
-- order, then update the page query to `order by display_order asc`.
-- ============================================================

alter table public.prop_questions
  add column if not exists display_order smallint not null default 0;

-- Populate display_order per narrative-flow ordering A (2026-05-28):
--   tournament arc — early events first, then running stats, yes/no
--   wildcard, podium picks, awards last.
do $$
declare
  v_tournament_id uuid;
begin
  select id into v_tournament_id from public.tournament where code = 'WC2026';
  if v_tournament_id is null then
    raise exception 'WC2026 tournament row not found.';
  end if;

  update public.prop_questions set display_order = case code
    when 'FIRST_RED'     then 1
    when 'FIRST_PEN_WIN' then 2
    when 'MOST_YELLOWS'  then 3
    when 'MOST_GOALS'    then 4
    when 'HOST_FINAL'    then 5
    when 'THIRD_PLACE'   then 6
    when 'RUNNER_UP'     then 7
    when 'WINNER'        then 8
    when 'GOLDEN_BOOT'   then 9
    when 'GOLDEN_BALL'   then 10
    else display_order
  end
   where tournament_id = v_tournament_id;
end$$;

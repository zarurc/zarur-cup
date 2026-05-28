-- ============================================================
-- Migration 0016 — prop_questions redesign (Phase 3 ad-hoc)
--
-- Content swap of the 7 launched prop questions to 10 redesigned ones:
--   - drops 3 questions (TOP_SCORER was a duplicate of GOLDEN_BOOT;
--     BIGGEST_UPSET and DARK_HORSE_SF were too subjective to grade
--     without arguments at dinner)
--   - updates 4 kept questions to new wording and re-balanced points
--     (GOLDEN_BOOT 5 → 8, GOLDEN_BALL 5 → 4)
--   - inserts 6 new questions with definitive official answers,
--     including the project's first 'yes_no' answer_type (HOST_FINAL)
--
-- Pre-launch (no real users have joined yet) so we wipe prop_answers
-- to avoid stale references to deleted/renamed questions. Same logic
-- as the 0006 reseed prologue (FK-safe order).
--
-- Total: 49 pts across 10 questions, locks at tournament.starts_at.
-- ============================================================

do $$
declare
  v_tournament_id uuid;
begin
  select id into v_tournament_id from public.tournament where code = 'WC2026';
  if v_tournament_id is null then
    raise exception 'WC2026 tournament row not found — apply 0006 reseed first.';
  end if;

  -- Wipe any pre-launch prop_answers (no real users yet — confirmed empty
  -- by REST count 2026-05-28). FK on prop_answers.question_id is ON DELETE
  -- CASCADE so this is also implicitly covered by the next DELETE, but
  -- explicit is clearer.
  delete from public.prop_answers
   where question_id in (
     select id from public.prop_questions where tournament_id = v_tournament_id
   );

  -- Drop the 3 retired questions explicitly. The remaining 4 are UPDATEd
  -- in place below to preserve their UUIDs for any score_events that may
  -- reference them in the future (no rows now; defense in depth).
  delete from public.prop_questions
   where tournament_id = v_tournament_id
     and code in ('TOP_SCORER', 'BIGGEST_UPSET', 'DARK_HORSE_SF');

  raise notice 'Prop_questions redesign prologue cleared % stale rows', 3;
end$$;

-- UPSERT all 10 questions. Existing 4 (WINNER, RUNNER_UP, GOLDEN_BOOT,
-- GOLDEN_BALL) match on (tournament_id, code) and get updated in place;
-- new 6 (MOST_GOALS, FIRST_RED, FIRST_PEN_WIN, HOST_FINAL, THIRD_PLACE,
-- MOST_YELLOWS) get fresh UUIDs.
with t as (select id as tournament_id from public.tournament where code = 'WC2026')
insert into public.prop_questions (tournament_id, code, prompt_en, prompt_he, answer_type, points) values
  ((select tournament_id from t), 'WINNER',        'Who will win the World Cup?',                                              'מי תזכה בגביע העולם?',                                              'single_team',   10),
  ((select tournament_id from t), 'RUNNER_UP',     'Who will be the runner-up?',                                               'מי תהיה הסגנית הראשונה?',                                            'single_team',   5),
  ((select tournament_id from t), 'GOLDEN_BOOT',   'Who will win the Golden Boot (top scorer)?',                               'מי יזכה בנעל הזהב (הכובש המוביל)?',                                  'single_player', 8),
  ((select tournament_id from t), 'GOLDEN_BALL',   'Who will win the Golden Ball (best player)?',                              'מי יזכה בכדור הזהב (השחקן הטוב ביותר)?',                              'single_player', 4),
  ((select tournament_id from t), 'MOST_GOALS',    'Which team will score the most goals in the tournament?',                  'איזו נבחרת תכבוש הכי הרבה גולים בטורניר?',                            'single_team',   5),
  ((select tournament_id from t), 'FIRST_RED',     'Which team will receive the first red card?',                              'איזו נבחרת תקבל את הכרטיס האדום הראשון?',                            'single_team',   3),
  ((select tournament_id from t), 'FIRST_PEN_WIN', 'Which team will win the first match decided on penalties?',                'איזו נבחרת תנצח במשחק הראשון שיוכרע בפנדלים?',                       'single_team',   3),
  ((select tournament_id from t), 'HOST_FINAL',    'Will a host nation (USA/Canada/Mexico) reach the final?',                  'האם נבחרת מארחת (ארה"ב / קנדה / מקסיקו) תגיע לגמר?',                  'yes_no',        3),
  ((select tournament_id from t), 'THIRD_PLACE',   'Which team will win the 3rd-place playoff?',                               'איזו נבחרת תנצח במשחק על המקום השלישי?',                              'single_team',   5),
  ((select tournament_id from t), 'MOST_YELLOWS',  'Which team will receive the most yellow cards?',                           'איזו נבחרת תקבל את הכי הרבה כרטיסים צהובים?',                        'single_team',   3)
on conflict (tournament_id, code) do update
  set prompt_en = excluded.prompt_en,
      prompt_he = excluded.prompt_he,
      answer_type = excluded.answer_type,
      points = excluded.points,
      updated_at = now();

-- Integrity check.
do $$
declare
  v_count int;
  v_tournament_id uuid;
begin
  select id into v_tournament_id from public.tournament where code = 'WC2026';
  select count(*) into v_count from public.prop_questions where tournament_id = v_tournament_id;
  if v_count <> 10 then
    raise exception 'prop_questions count for WC2026 = %, expected 10', v_count;
  end if;
  raise notice 'prop_questions redesign: 10 questions installed (49 pts total)';
end$$;

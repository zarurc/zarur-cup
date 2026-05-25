-- Migration 0010: add correct_answer_aliases text[] to public.prop_questions.
--
-- WHY THIS MIGRATION EXISTS (Phase 2, D-24):
-- Admin grades a prop by entering the canonical correct_answer; alongside it,
-- admin may register an alias set (e.g., for the "Top Scorer" prop:
-- ["Lionel Messi", "L. Messi", "מסי", "Messi"]). The Phase-2 gradeProp Server
-- Action does case-insensitive trim+NFC-normalized match of each user's
-- prop_answers.answer against the union {correct_answer} U correct_answer_aliases.
-- This avoids the "user typed 'מסי' and admin entered 'Messi'" tragedy
-- without forcing a separate player-roster table (deferred to v2 per CONTEXT).
--
-- SHAPE: text[] with default '{}' (empty array). NOT NULL so the Phase-2
-- gradeProp helper can rely on a guaranteed-iterable column without a
-- COALESCE branch.
--
-- POSTURE: aliases are PUBLIC by design — admin enters them for grading and
-- they're effectively common knowledge (variants of a name). Anon SELECT on
-- prop_questions (Phase 1 D-21) is unchanged; no row-level secrets here.
--
-- APPEND-ONLY: Phase 1 D-21. Never edit this file once pushed.

-- ============================================================
-- 1. Add the column. NOT NULL with empty-array default so existing
--    prop_questions rows (Phase 1 seeded 7 of them) backfill cleanly.
-- ============================================================
alter table public.prop_questions
  add column correct_answer_aliases text[] not null default '{}';

comment on column public.prop_questions.correct_answer_aliases is
  'Optional aliases for fuzzy-match grading (e.g., ["Lionel Messi","L. Messi","מסי"]). D-24.';

-- ============================================================
-- 2. Smoke: confirm the column exists, is NOT NULL, has the expected
--    text[] / ARRAY shape, and defaults to an empty array.
-- ============================================================
do $$
declare
  col_default text;
  col_dtype   text;
  col_udt     text;
  col_nullable text;
begin
  select column_default, data_type, udt_name, is_nullable
    into col_default, col_dtype, col_udt, col_nullable
    from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'prop_questions'
      and column_name  = 'correct_answer_aliases';

  if col_default is null then
    raise exception '0010 smoke failed: prop_questions.correct_answer_aliases missing or has no default';
  end if;
  -- data_type for ARRAY columns is 'ARRAY'; udt_name encodes element type
  -- as '_text' for text[]. Accept either form.
  if col_dtype <> 'ARRAY' or col_udt <> '_text' then
    raise exception '0010 smoke failed: prop_questions.correct_answer_aliases wrong type (data_type=%, udt_name=%) — expected ARRAY/_text', col_dtype, col_udt;
  end if;
  if col_nullable <> 'NO' then
    raise exception '0010 smoke failed: prop_questions.correct_answer_aliases should be NOT NULL (got %)', col_nullable;
  end if;
  -- Default serialization is either ''{}''::text[] or just ''{}''; both
  -- contain the literal characters {}.
  if position('{}' in col_default) = 0 then
    raise exception '0010 smoke failed: prop_questions.correct_answer_aliases default not empty array — got %', col_default;
  end if;
end$$;

-- ============================================================
-- 3. Smoke: confirm existing prop_questions rows backfilled cleanly (no NULL
--    aliases after the ADD COLUMN). 7 prop_questions exist on live from
--    Phase 1 seed (0005/0006); after this migration all should have '{}'.
-- ============================================================
do $$
declare
  bad_rows int;
begin
  select count(*) into bad_rows
    from public.prop_questions
    where correct_answer_aliases is null;
  if bad_rows > 0 then
    raise exception '0010 smoke failed: % prop_questions row(s) have NULL correct_answer_aliases after backfill', bad_rows;
  end if;
end$$;

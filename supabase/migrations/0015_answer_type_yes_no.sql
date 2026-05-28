-- ============================================================
-- Migration 0015 — add 'yes_no' to prop_questions.answer_type
--
-- Phase 3 (post-launch question redesign): host-nation-reaches-final
-- and similar binary questions need a native yes/no answer type instead
-- of being shoehorned into 'text' with constrained input. Adds a new
-- enum value to the CHECK constraint; no data migration needed (all
-- pre-existing rows are 'single_team' | 'single_player' | 'text').
--
-- The corresponding YesNoToggle.client.tsx + savePropAnswer Zod schema
-- update ship alongside this migration in the same atomic-commit arc.
-- ============================================================

alter table public.prop_questions
  drop constraint if exists prop_questions_answer_type_check;

alter table public.prop_questions
  add constraint prop_questions_answer_type_check
  check (answer_type in ('single_team','single_player','text','yes_no'));

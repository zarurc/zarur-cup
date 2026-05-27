-- ============================================================
-- Migration 0013 — props strictly private (reverses D-25 → enforces D-38)
--
-- Why this is a separate migration (Phase 1 P02 append-only pattern):
-- 0002_rls.sql shipped the original lock-and-reveal `prop_answers_read`
-- policy with a post-`tournament.starts_at` exists-clause that opened
-- prop_answers SELECT to all family members at first kickoff. Per Phase 2
-- D-38 (2026-05-26 scope expansion), props are now strictly private —
-- each user sees only their own answers at all times, pre-lock and
-- post-lock. Migrations are append-only on this project (Phase 1 D-21);
-- 0002 stays on live as historical record; this migration atomically
-- drops and re-creates the policy with the simpler `user_id = (select
-- auth.uid())` predicate.
--
-- Affects:
--   - /[locale]/me/props (Plan 02-10): the simplified RSC reads only own
--     answers; RLS now matches the UI invariant (defense in depth).
--   - VIS-04 traceability: original "user cannot see another player's
--     prop answers until first kickoff" is strengthened — the user NEVER
--     sees another player's prop answers.
-- Does NOT affect prop_answers_insert / prop_answers_update / prop_answers_delete:
--   the lock-at-`starts_at` WITH CHECK clauses remain. Predictions table
--   policies are untouched.
-- ============================================================

drop policy if exists prop_answers_read on public.prop_answers;

create policy prop_answers_read on public.prop_answers
  for select to authenticated using (
    user_id = (select auth.uid())
  );

-- B-style smoke: confirm the policy body no longer contains the
-- `tournament.starts_at` clause. If a future maintainer accidentally
-- re-introduces the exists-branch, this smoke fails loudly at push time
-- (Phase 1 P02 Pattern 9 — security-relevant invariants get DO-block
-- migration-time smokes).
do $$
declare
  policy_def text;
begin
  select pg_get_expr(polqual, polrelid) into policy_def
    from pg_policy
   where polname = 'prop_answers_read'
     and polrelid = 'public.prop_answers'::regclass;

  if policy_def is null then
    raise exception
      '0013 migration failed: prop_answers_read policy does not exist after re-create';
  end if;

  if position('starts_at' in policy_def) > 0 then
    raise exception
      '0013 migration failed: prop_answers_read still references tournament.starts_at; D-38 requires user_id = auth.uid() only. Got: %', policy_def;
  end if;

  if position('auth.uid()' in policy_def) = 0 then
    raise exception
      '0013 migration failed: prop_answers_read does not reference auth.uid(); RLS is broken. Got: %', policy_def;
  end if;
end;
$$;

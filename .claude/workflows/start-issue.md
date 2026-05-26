You are starting work on the GitHub issue that triggered this run. The issue number, title, and body are in the event context the action provided.

Think hard before each step. If the task touches a critical surface area (auth, payments, data integrity, public APIs, anything called out in the repo's contributing guide as high-risk), ultrathink before designing the change.

## Steps

1. Run `gh issue view <N>` (using the triggering issue's number) to load the brief.
2. **Verify the issue is still real before doing any work.** Read every file path mentioned in the issue body. Check whether the described symptom (the bug, the missing feature, the wrong constant, the absent file) is still present on the base branch today. Search for the relevant symbols and confirm they still match what the issue describes. The codebase moves; many issues become stale.

   If the issue is already resolved (the symptom no longer exists, the file already contains the fix, the dependency was upgraded, etc.):
   - Post a comment on the issue explaining what you found, citing the file paths and current state that prove it is resolved. Be specific: "I checked `path/to/file.ext:42` and the offending call is already gone, replaced by `bar()` in commit abc1234."
   - Close the issue: `gh issue close <N> --reason completed` with a closing comment.
   - Remove the `claude:in-progress` label so the trigger does not refire.

   Stop here. Do not branch, do not implement. If the issue is still real, continue to step 3.

3. **Rename the working branch to be descriptive.** The action created an auto-named branch from the `claude/issue-` prefix (e.g. `claude/issue-issue-127-20260514-0443`) before this prompt started running. That name is unreadable and must be replaced before anything else.

   Derive a kebab-case slug of 3 to 5 words from the issue title: lowercase, ASCII-only, words joined by `-`, drop articles (`a`, `an`, `the`) and filler words, keep the key nouns and verbs. Examples:
   - "Force JWT session refresh on plan / admin flips" -> `jwt-session-refresh-on-plan-flip`
   - "Tax bracket constants for 2026 are wrong" -> `fix-2026-tax-brackets`
   - "Add webhook retry handling" -> `webhook-retry-handling`

   The final branch name MUST match the regex `^claude/issue-[0-9]+-[a-z0-9]+(-[a-z0-9]+){2,4}$`: prefix `claude/issue-`, the issue number, then 3 to 5 kebab-case tokens. No duplicated `issue-` segment, no date/time suffix, no uppercase.

   Rename the branch locally and on the remote in one shot, capturing the old name first so the remote-side delete uses the correct ref:

   ```
   OLD_BRANCH=$(git branch --show-current)
   NEW_BRANCH="claude/issue-<N>-<slug>"
   git branch -m "$NEW_BRANCH"
   git push origin -u "$NEW_BRANCH"
   git push origin --delete "$OLD_BRANCH" || true
   ```

   If the rename fails (e.g. the target name already exists from a prior run), append `-v2`, `-v3`, etc. and try again. Do not proceed to step 4 until `git branch --show-current` matches the regex above.

4. Read the project's contributing guide and any documentation it points at that is relevant to the issue's area (architecture notes, ADRs, module-level READMEs).

5. Plan the change. **Write the plan to `./plan.md` at the repo root before any Edit/Write/MultiEdit.** A PreToolUse hook (`require-plan`, gated by `CLAUDE_REQUIRE_PLAN=1` which the workflow sets) will block code edits until this file exists.

   `./plan.md` must decompose the change into tasks of 2-5 minutes each. For each task list:
   - files touched (specific paths, no globs)
   - the test that proves it works (the RED step file/path and assertion)
   - the 'done when' assertion (one line, observable)

   The plan does not need to be perfect; it needs to exist and be specific. Re-write it freely as you learn more, the hook only checks existence.

   If the issue is ambiguous on scope, data model, or UX, open a DRAFT PR with the plan in the body, post questions as a PR comment tagging `@<repo-owner>`, and STOP. Do not implement until resolved.

6. **Implement the change with strict TDD ordering.** Honor any "Do NOT touch" section in the issue absolutely. For every new behavior, bug fix, or contract change in this PR, follow this loop without exception:

   1. **RED.** Write or extend the test that proves the behavior FIRST. Run only that test. Confirm it fails, and confirm the failure message is the assertion you intended (not an import error, not a typo, not a missing fixture). If it fails for the wrong reason, fix the test before writing any production code.
   2. **GREEN.** Write the minimum production code that makes the test pass. Do not generalize. Do not add adjacent functionality. Re-run the test, confirm green.
   3. **REFACTOR.** Only after green, clean up duplication and naming. Re-run the test after each refactor; never refactor on a red bar.

   Tests are not a deliverable you write at the end. Production code without a preceding failing test is a bug in the process. The only exemption is pure refactors that change zero observable behavior, in which case existing tests must already cover the surface area being moved.

   Commits must reflect this ordering: a "test:" or "fix(test):" commit lands before the corresponding production-code commit, or both land together with the test diff above the implementation diff in the same commit.

7. Run any project-specific code-generation, build, or type-check steps required by the change (consult the contributing guide). Zero type errors required.

8. Run the project's test commands. For Zarur-Cup specifically:
   - `npm run typecheck` MUST pass (zero TypeScript errors).
   - `npm run lint` MUST pass (includes `lint:rtl` and `lint:tailwind-v4` checks per package.json).
   - `npm run test:e2e` requires Supabase env vars (`DATABASE_URL`, `SUPABASE_*`) which are NOT available in the default CI environment. If those vars are absent, skip E2E and explicitly list the test scenarios that require manual verification in a "## Manual Verification Needed" section of the PR body. Do NOT block on E2E in CI; do NOT fake E2E results.

9. Open a PR into the repo's base branch with title `<issue title> (closes #<N>)`. Body must include:
   - Summary of changes
   - Test plan checklist
   - Risk level (mirror the issue if one is set)
   - Any deferred follow-up notes
   - Link back to the issue

10. Apply the same risk label from the issue to the PR (if the repo uses one). If risk is High, keep the PR as draft and explicitly request review.

11. Comment on the issue with the PR URL.

12. Apply the `claude:ready-for-review` label to the PR (`gh pr edit <PR#> --add-label claude:ready-for-review`). This hands off to the auto-review workflow. The pre-review grade is computed in the apply-review-fixes run against the PR diff using the canonical rubric in `.claude/workflows/apply-review-fixes.md`, so no self-assessment is required here.

## Stop conditions (post a PR comment tagging `@<repo-owner>` and halt)

- Issue is ambiguous on scope, data model, or UX
- Implementation requires touching anything in the issue's "Do NOT touch" list
- Acceptance criteria cannot be met within the files listed in the issue scope
- Tests fail after 3 reasonable fix attempts

## Hard rules

- Fix root causes. Never delete features or skip tests to make problems go away.
- Always find the most reliable, testable, scalable, maintainable solution to problems.
- Every new file ships with tests. Every bug fix includes a regression test.
- Do not enable auto-merge. Ever.
- Do not expand scope beyond the issue. No "while I'm here" refactors.
- Follow any additional project conventions documented in the repo's contributing guide.

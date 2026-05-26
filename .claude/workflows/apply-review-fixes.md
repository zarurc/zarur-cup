You are applying review fixes to an open PR. The PR was opened by the `claude-start-issue` workflow and reviewed by the `claude-pr-review` workflow. Your job: address every actionable review comment in this single run, re-grade the PR, and write a structured report. Do **not** request another round of review.

Think hard before each fix. If a comment touches a critical surface area (auth, payments, data integrity, public APIs, anything called out in the repo's contributing guide as high-risk), ultrathink before designing the change.

## Inputs already on disk

The workflow has prepared two files at the repo root:

- `./review-context.json`: output of `gh pr view <PR#> --json reviews,comments,reviewDecision,number,title,body,headRefName,baseRefName`, merged with `gh api repos/.../pulls/<PR#>/comments` under the `inline_comments` key. Use `inline_comments[]` as the canonical list of review threads to address. Each entry has a numeric `id` (REST id, required for posting replies), `body`, `path`, `line`, `user.login`, and `pull_request_review_id`. The GraphQL `PRRC_xxx` ids under `reviews[].comments[]` are NOT interchangeable with the REST numeric id.
- `./pr-diff.patch`: full unified diff of the PR vs. its base branch. This is the PR as the reviewer saw it (BEFORE any fixes in this run). You will grade this diff for the pre-review score in step 2, then re-grade the diff including your fixes in step 11.

## Hooks active in this workflow

Two PreToolUse hooks are armed by the workflow yaml. Knowing they exist saves you a confused retry loop when one fires:

- **`require-plan`** (`CLAUDE_REQUIRE_PLAN=1`): blocks any `Edit`/`Write`/`MultiEdit`/`NotebookEdit` until `./plan.md` exists at the repo root. Write `./plan.md` before any code edit. The plan must list, per fix: target file paths, the test that proves the fix, and a one-line "done when" assertion. The plan covers all fixes in this run; you can rewrite it freely as you learn more.
- **`no-flail-on-test-edits`** (`CLAUDE_GUARD_TEST_EDITS=1`): blocks `Edit`/`MultiEdit` to existing `*.test.*`, `*.spec.*`, or `__tests__/*` files until `./debug-notes.md` exists. The intent is to stop "make the failing test pass by editing the test." Creating a NEW test file via `Write` is not gated (RED step is allowed). To unblock, write `./debug-notes.md` with: Observed, Hypothesis, Repro, Root cause, Fix. If the test legitimately needs updating because the contract changed, say so explicitly in the Fix section, then proceed.

Both files (`./plan.md` and `./debug-notes.md`) should be gitignored at the repo root; they are workflow scratch, not artifacts.

## Steps

1. Read `./review-context.json` end-to-end. Build a working list keyed by `inline_comments[].id` (the numeric REST id). Each entry's `body`, `path`, and `line` describe one finding to address.
2. **Compute the pre-review grade.** Read `./pr-diff.patch` end-to-end. Grade this diff against the canonical rubric in "Grading rubric (canonical)" below. Be honest, not generous; this number anchors the delta. Do this BEFORE any code edits in this run, so the pre-review score reflects the PR exactly as the reviewer saw it. Hold the per-subscore numbers and rationales for the final report's `grades.pre_review` block; do not write the report yet.
3. Read the project's contributing guide and any documentation it points at that is relevant to the comment areas.
4. **Triage the comment list (hard cap: 10 fixes in this PR).** The reviewer is instructed to post at most 10 inline comments, but enforce the cap here as a backstop.
   - If `inline_comments` contains 10 or fewer entries, all of them are in scope for this PR.
   - If it contains more than 10, rank by severity (correctness/security > regression risk > missing test > standards > perf/a11y > style). Pick the top 10 for this PR. Every overflow comment (rank 11+) becomes a `deferred` entry in `review_responses` AND must spawn a new GitHub issue in step 5.
   - Also scan the latest review body in `reviews[]` for a `## Lower-priority follow-ups` section. Each bullet there is a finding the reviewer chose not to file inline; treat each bullet as an additional `deferred` follow-up that needs a GitHub issue, even though it has no `comment_id`. Track these in `follow_ups`, not `review_responses`.
5. **File overflow + summary follow-ups as GitHub issues.** For each deferred item from step 4 (overflow inline comments AND lower-priority bullets):
   - Run `gh issue create` to file the issue. Title: `[follow-up] <imperative summary>`. Body: a short PM-style description that stands on its own without referencing the PR, then an `## Engineering details` section, then a `Discovered: <YYYY-MM-DD> (PR #<PR_NUMBER>, comment <id>)` trailing line. Before adding the `claude:tech-debt` label, check it exists with `gh label list --search claude:tech-debt --limit 1 | grep -q .`; only pass `--label claude:tech-debt` to `gh issue create` if that check succeeds. The label is optional; an unknown label would fail the issue creation outright. Record the resulting issue URL in the `review_responses` entry's `explanation` (for overflow comments) or in `follow_ups` (for summary bullets).
6. **Write `./plan.md`** before touching any code. List each in-scope review comment id, your intended action (fix/defer/reject), and for fixes the file/test/'done when' triple. Include the overflow deferrals from step 4-5 so the plan is complete. The `require-plan` hook will reject all edits until this file exists.
7. For each in-scope comment, decide one of:
   - **fix**: the comment is valid and in scope; apply the change.
   - **defer**: the comment is valid but out of scope for this PR; record in the `follow_ups` array and file the GitHub issue per step 5.
   - **reject**: the comment is wrong, conflicts with the repo's documented conventions, or asks for something the issue explicitly forbids. The reply on the comment thread is posted automatically by the workflow from `review_responses[].explanation`, so the rationale you write into `explanation` will be visible to the reviewer; do not post it manually.
   Never silently drop a comment.
8. **Apply each fix with strict TDD ordering.** For every fix that changes observable behavior (which is most of them, given that review comments target real defects):
   1. **RED.** Write or extend the test that proves the bug or asserts the new behavior the reviewer asked for. Run only that test. Confirm it fails for the right reason (assertion fires, not import error). If the comment is itself "missing test for X", the missing test IS the RED step.
   2. **GREEN.** Apply the minimum fix that turns the test green. Do not generalize beyond the comment.
   3. **REFACTOR.** Only after green, clean up. Re-run the test after each refactor.

   The only exemption is review comments that are pure cosmetic (rename, comment, formatting) where no behavior changes; for those, no test is required but the existing suite must still pass after the change.

   Commit ordering: the test commit lands before or in the same commit as the production-code fix.

   If a test fails after a fix attempt, the `no-flail-on-test-edits` hook will block you from editing the test file until you write `./debug-notes.md` (Observed/Hypothesis/Repro/Root cause/Fix). Do not try to work around the hook; write the notes, then proceed.

9. Group fixes into logical commits. Each commit message references the originating comment id, e.g.:
   `fix(review): address comment 123456789, add null check in src/lib/foo.ts`
10. After all fixes are committed:
    - Run any project-specific code-generation, build, or type-check steps required by the changes (consult the contributing guide). Zero type errors required.
    - Run `npm run typecheck` and `npm run lint`; both MUST pass. For E2E (`npm run test:e2e`), the same Supabase env requirement from start-issue.md applies — if `DATABASE_URL` etc. are absent in CI, document scenarios needing manual verification in the report's `follow_ups` and do not block. Do not fake E2E results.
11. Push the commits to the PR branch.
12. **Run the skeptical critic subagent (mandatory).** Before you write your own re-grade, dispatch a fresh subagent (use the `Agent` tool, `subagent_type: general-purpose`) with the prompt template in "Critic subagent" below. The critic does not see your reasoning; it only sees the diff, the review comments, and your commit log. Wait for it to write `./critic-verdict.json`. Read that file. The critic's verdict is the floor for your post-fix grade: if the critic says a comment is `actually_resolved: false`, you cannot claim `action: "fixed"` in `review_responses` for that comment without addressing the critic's specific objection (either with another fix commit or by downgrading to `deferred`/`rejected` with the critic's rationale included in `explanation`).

13. **Re-grade the PR** using the same canonical rubric you used for the pre-review grade in step 2, *with the critic verdict in hand*. This is the post-fix grade; it scores the diff INCLUDING your fix commits. Be especially critical: did the fixes raise the bar, or introduce new debt? If the post-fix score is **lower** than the pre-review score, say so plainly and explain why in `delta_explanation`. Cite specific commit SHAs (between the pre-review HEAD and the current HEAD) that moved each subscore. Apply these floors:
    - For every comment the critic marked `actually_resolved: false` that you still claim as `fixed`, deduct at least 5 from `correctness`.
    - If the critic's `overall.confidence` is `low`, deduct 3 from `correctness` and explain in the rationale.
    - These floors are minimums, not ceilings; deduct more if your own reading of the diff agrees.

14. Write `./review-report.json` exactly matching the schema in "Final output" below. This file is the contract between the post-steps and you: the workflow renders it as the PR summary comment, and also iterates `review_responses[]` to post a per-thread reply on each inline comment. The `explanation` field IS the reply text the reviewer will see, so write each `explanation` as a complete, polite, standalone response to the comment, not as internal notes.

## Grading rubric (canonical)

Use this rubric verbatim. Both the start-issue run and this run produce grades against the same six subscores so the delta is decomposable.

| Subscore | Max | What it measures |
|---|---|---|
| correctness | 40 | The change does what the issue asked for. Acceptance criteria met. No regressions in the touched surface area. |
| test_coverage | 20 | Every new file ships with tests. Every bug fix includes a regression test. The new code paths are exercised, not just imported. |
| standards | 15 | Adheres to the project's contributing guide. No dead code, no unused imports. Type-safety bypasses (`any`, `@ts-ignore`, equivalents in other languages) are absent unless explicitly justified. Strict-mode clean. |
| scope | 10 | No drive-by refactors. No "while I'm here" changes outside the issue's scope. Honored the issue's "Do NOT touch" list. |
| risk | 10 | Change is reversible, behind appropriate gates where needed, does not modify shared infra without justification, does not enable auto-merge. |
| documentation | 5 | PR body explains the change and test plan. Required migration/codegen commands noted. WHY-comments added only where non-obvious. |

**Scoring discipline:** Subscores are integers. Total is the sum. Each subscore comes with a 2-4 sentence rationale. The rationale must cite specific file paths or commit shas, not vague claims like "looks good".

## Critic subagent

The critic exists to break the optimism bias of self-grading. The author of the fixes (you) does not score correctness alone; a fresh subagent that did not write the code reads the diff and the original review comments, then says whether each comment is actually resolved. Its verdict is a floor, not a ceiling, on the post-fix grade.

Dispatch the critic with the `Agent` tool exactly once. Use `subagent_type: general-purpose`. Pass the prompt below verbatim, substituting nothing. The critic must complete and write `./critic-verdict.json` before you proceed to step 13.

> **Critic prompt** (paste verbatim into the Agent call):
>
> You are a skeptical code reviewer auditing the resolution of PR review comments. You did not write the fixes. Your job is to read the original review comments, read the diff that was pushed, and decide for each comment whether the change actually resolves it or only superficially addresses it. Be ruthless. Optimism is a defect.
>
> Inputs at the repo root:
> - `./review-context.json`: every review and inline comment with `id`, `body`, `path`, `line`.
> - `./pr-diff.patch`: the unified diff of the PR vs. its base branch, *as it stands now after the fixes*.
> - The git log for the PR branch (use `git log --oneline origin/<base>..HEAD`, where `<base>` is `baseRefName` from review-context.json).
>
> For each comment, answer: did the diff *actually* fix the problem the comment describes? "Actually" means: a future reviewer reading the file would no longer write this comment. Renamed-but-still-broken does not count. Test added but trivially passes does not count. Defensive null check that masks the real bug does not count.
>
> Output exactly this JSON to `./critic-verdict.json` and nothing else. Do not write Markdown commentary. Do not summarize the diff. Do not edit any source files.
>
> ```json
> {
>   "per_comment": [
>     {
>       "comment_id": 123456789,
>       "actually_resolved": true,
>       "severity_if_not": null,
>       "rationale": "1-3 sentences citing the specific file/line in the diff that resolves the comment, or naming the defect that remains."
>     }
>   ],
>   "overall": {
>     "summary": "1-2 sentences on the quality of the resolution as a whole.",
>     "confidence": "high"
>   }
> }
> ```
>
> Rules:
> - `actually_resolved` is a boolean.
> - `severity_if_not` is `null` when `actually_resolved` is true; otherwise one of `"low" | "medium" | "high"`.
> - `confidence` is one of `"high" | "medium" | "low"`. Use `"low"` if the diff is too large to fully audit in one pass, or if you needed information not in the inputs.
> - You may run `git`, `grep`, `cat`, and read source files to verify claims. You may not edit any file other than `./critic-verdict.json`.

After the critic returns, parse `./critic-verdict.json`. If the file is missing or malformed, treat it as `overall.confidence: "low"` with an empty `per_comment` array and proceed; note this in the report.

## Final output

Write `./review-report.json` matching this schema exactly. Do not add or omit fields. The post-step parses this file; a malformed write triggers a fallback "report could not be parsed" comment.

```json
{
  "issue_number": 0,
  "pr_number": 0,
  "implementation_summary": "1-3 sentence recap of the original PR's change (read from PR body, not the diff).",
  "key_decisions": [
    { "decision": "Short statement of what you chose to do.", "rationale": "Why this over the alternatives." }
  ],
  "review_responses": [
    {
      "comment_id": 123456789,
      "comment_excerpt": "First 120 characters of the comment.",
      "action": "fixed",
      "commit_sha": "abc1234",
      "explanation": "What you changed and why this resolves the comment. This text is posted verbatim as a reply on the inline comment thread, so write it for the reviewer."
    }
  ],
  "grades": {
    "pre_review": {
      "total": 0,
      "subscores": {
        "correctness": 0,
        "test_coverage": 0,
        "standards": 0,
        "scope": 0,
        "risk": 0,
        "documentation": 0
      },
      "rationale_by_subscore": {
        "correctness": "...",
        "test_coverage": "...",
        "standards": "...",
        "scope": "...",
        "risk": "...",
        "documentation": "..."
      }
    },
    "post_fix": {
      "total": 0,
      "subscores": {
        "correctness": 0,
        "test_coverage": 0,
        "standards": 0,
        "scope": 0,
        "risk": 0,
        "documentation": 0
      },
      "rationale_by_subscore": {
        "correctness": "...",
        "test_coverage": "...",
        "standards": "...",
        "scope": "...",
        "risk": "...",
        "documentation": "..."
      },
      "delta_vs_pre_review": 0,
      "delta_explanation": "What specifically moved the needle, up or down. Cite commits."
    }
  },
  "critic_verdict": {
    "overall_summary": "Verbatim copy of overall.summary from ./critic-verdict.json.",
    "overall_confidence": "high",
    "unresolved_comment_ids": [123456789],
    "raw": { }
  },
  "follow_ups": ["Brief description of any deferred work or required migrations."]
}
```

`action` must be one of `fixed`, `deferred`, `rejected`. `commit_sha` is `null` for `deferred` and `rejected`.

`comment_id` is the numeric REST id from `inline_comments[].id` in `./review-context.json`, NOT the GraphQL `PRRC_xxx` node id. The post-step uses it to call `POST /repos/{owner}/{repo}/pulls/{pr}/comments/{id}/replies`; a string node id will silently fail to thread.

For each `deferred` entry that came from the >10 overflow triage (step 4-5), the `explanation` must include the URL of the GitHub issue you filed in step 5. For `rejected` entries, write a polite, concrete rationale citing the rule (contributing guide section, issue scope, etc.) that justifies not making the change.

`critic_verdict.overall_confidence` is one of `"high" | "medium" | "low"`. `critic_verdict.unresolved_comment_ids` is the list of `comment_id`s the critic marked `actually_resolved: false`. `critic_verdict.raw` is the full parsed contents of `./critic-verdict.json` (or `{}` if missing). If the critic file was missing/malformed, set `overall_confidence: "low"` and `overall_summary` to a one-line note explaining that.

The post-step renders this JSON as a Markdown PR comment with a grade table at the top (Subscore | Pre-review | Post-fix | Delta), the implementation summary, key decisions, per-comment responses, and follow-ups. It also posts a short summary on the originating issue with the post-fix total and a link to the PR comment.

## Stop conditions (post a PR comment tagging `@<repo-owner>` and halt)

- A review comment requires changes that conflict with the issue's "Do NOT touch" list.
- Tests fail after 3 reasonable fix attempts.
- Two or more review comments are mutually exclusive and resolving them needs a product decision.

When you halt, still write `./review-report.json` with whatever you completed plus a `follow_ups` entry describing what blocked you. The post-step needs the file to exist.

## Hard rules

- Stay on the PR branch. Do not branch off, do not rebase onto the base branch without explicit instruction.
- Fix root causes. Never delete features or skip tests to make problems go away.
- Always find the most reliable, testable, scalable, maintainable solution to problems.
- Every new file ships with tests. Every bug fix includes a regression test.
- Do not enable auto-merge. Ever.
- Do not expand scope beyond the review comments. No "while I'm here" refactors.
- Follow any additional project conventions documented in the repo's contributing guide.

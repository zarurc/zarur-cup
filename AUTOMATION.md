# Automation

End-to-end map of the Claude-bot workflows that fire on issues, PRs, and merges. This is the source of truth. **Update this file whenever a workflow, label, secret, or trigger changes in your fork.**

---

## TL;DR

- **Issue gets `claude:in-progress`** -> Claude implements + opens a PR.
- **PR gets `claude:ready-for-review`** -> Claude reviews, posts inline comments, flips to `claude:review-complete`.
- **PR gets `claude:review-complete`** -> Claude applies fixes, runs a verify pass, swaps the issue to `claude:pr-ready`, flips PR to `claude:done`, requests a human reviewer.
- **PR merges** -> linked issue flips to `claude:done`.
- **Manual re-trigger**: comment `/claude-review` on a PR.

---

## Label reference

### PR labels (drive the Claude pipeline)

| Label | Set by | Removed by | What it triggers |
|---|---|---|---|
| `claude:ready-for-review` | `start-issue` workflow (end of issue work), `/claude-review` comment, or human in UI | `claude-pr-review.yml` (on completion) | `claude-pr-review.yml` |
| `claude:review-complete` | `claude-pr-review.yml` (on completion) | `claude-apply-review-fixes.yml` (on completion) | `claude-apply-review-fixes.yml` |
| `claude:done` | `claude-apply-review-fixes.yml` (on completion) | Removed by `/claude-review` if re-triggered | Nothing (terminal). The "Request human reviewer" step fires right after this label is added. |
| `ci-approved` | Human, manually | Human, manually | Optional pattern. Use it to gate your own CI workflows so drive-by PRs do not burn CI minutes. The bundle does not ship CI workflows. |

### Issue labels (drive issue lifecycle)

| Label | Set by | Removed by | What it triggers |
|---|---|---|---|
| `claude:in-progress` | Human (manually), or an external bot that mirrors a project board column. The `claude-start-issue.yml` precheck job strips it back out if the issue is already past in-progress. | `claude-apply-review-fixes.yml` swap step (when its PR completes), or `claude-pr-merged-issue-done.yml` on merge, or the `claude-start-issue.yml` precheck job | `claude-start-issue.yml` |
| `claude:pr-ready` | `claude-apply-review-fixes.yml` (when its PR completes; replaces `in-progress` on the issue) | `claude-pr-merged-issue-done.yml` on PR merge | Nothing. Signals: "PR open, bot work done, awaiting human." |
| `claude:done` | `claude-pr-merged-issue-done.yml` (on PR merge) | Never | Nothing (terminal). |
| `claude:tech-debt` | `claude-apply-review-fixes.yml` on overflow issues it files for deferred review findings | Manually | Nothing. Search filter only. |

**Mutually exclusive**: `claude:in-progress` and `claude:pr-ready` should never both be on the same issue. If you see both, the apply-fixes swap silently raced or partially failed; the verify-and-retry guard in `claude-apply-review-fixes.yml` is the line of defense.

---

## The Claude PR pipeline (end-to-end)

```
Human: add label claude:in-progress to issue #N
   |
   v
claude-start-issue.yml                            (issues: labeled)
   | Opus, plan-gated, opens PR claude/issue-<N>-<slug>
   | Adds claude:ready-for-review to the PR
   v
claude-pr-review.yml                              (pull_request: labeled)
   | Sonnet, 80 turns, posts inline review comments
   | Submits REQUEST_CHANGES / COMMENT / APPROVE
   | Swaps PR label -> claude:review-complete
   v
claude-apply-review-fixes.yml                     (pull_request: labeled)
   | Opus, 250 turns, plan-gated + test-edit-gated
   | Commits fixes, replies to each inline thread
   | Dismisses stale CHANGES_REQUESTED reviews (bot's own)
   | Verify pass: Sonnet, 30 turns, read-only
   |    verifies each claimed fix against its commit diff
   |    writes ./verify-report.json
   | Auto-decision:
   |    all verified  -> bot submits APPROVE review
   |    any unverified -> posts warning comment, no APPROVE
   |    malformed report -> fail-closed (no APPROVE)
   | Flips PR label -> claude:done
   | Moves project card: "In progress" -> "In review" (if Projects v2 in use)
   | Swaps issue label: claude:in-progress -> claude:pr-ready
   |   (split into two gh calls + post-condition retry)
   | Requests human reviewer (GitHub notification)
   v
Human reviews + merges
   |
   v
claude-pr-merged-issue-done.yml                   (pull_request: closed, merged==true)
   | Resolves linked issue from PR body keywords (closes/fixes/resolves #N)
   | Swaps issue labels: claude:in-progress|claude:pr-ready -> claude:done
```

**Manual escape hatch**: `/claude-review` comment on any PR is handled by `claude-review-comment-trigger.yml`. It strips `claude:review-complete` and `claude:done`, then re-adds `claude:ready-for-review` so the pipeline restarts cleanly.

**Why split** (issue label swap): a single `gh issue edit --add-label X --remove-label Y` hides both halves behind one warning, so partial failures leave the labels desynced silently. The current code splits into two `gh` calls with distinct warnings, then verifies the post-condition and retries the remove once if `claude:in-progress` is still present. The retry guards against an upstream actor that may re-stamp the label between the card move and the swap.

---

## Workflows reference

### `claude-start-issue.yml`
- **Trigger**: `issues: labeled` with `claude:in-progress`.
- **Does**: Two jobs. (1) `precheck`: runs `gh issue view --json labels` and `gh pr list --state open`. If the issue already carries `claude:pr-ready` or `claude:done`, OR an open PR's body matches `(?i)(close[sd]?|fix(es|ed)?|resolve[sd]?)\s+#<N>\b`, removes the stale `claude:in-progress` label with `CLAUDE_AUTOMATION_PAT` and short-circuits the run. Posts a single "Skipped" notice the first time per loop and stays silent on subsequent re-triggers. (2) `start`: loads the `start-issue.md` prompt, runs Opus 4.7 with `track_progress: true`, lets it open a PR from `claude/issue-<N>-<slug>` against the base branch (default `main`). Publishes transcript.
- **Outputs the trigger for**: `claude-pr-review.yml` (by adding `claude:ready-for-review` to the new PR).
- **Hooks**: `CLAUDE_REQUIRE_PLAN=1` (blocks edits until `./plan.md` exists).

### `claude-pr-review.yml`
- **Trigger**: `pull_request: labeled` with `claude:ready-for-review`.
- **Does**: Runs the engineering plugin review (Sonnet, 80 turns), posts up to 10 inline review comments, submits REQUEST_CHANGES / COMMENT / APPROVE. Swaps label to `claude:review-complete`. Publishes transcript.
- **Outputs the trigger for**: `claude-apply-review-fixes.yml`.

### `claude-apply-review-fixes.yml`
- **Trigger**: `pull_request: labeled` with `claude:review-complete`.
- **Does**:
  1. Loads `apply-review-fixes.md` prompt, gathers reviews + inline comments + diff vs base.
  2. Runs Opus 4.7 (250 turns), commits fixes, writes `./review-report.json`.
  3. Posts the rendered report as a PR comment + short summary on the originating issue.
  4. Threads a reply onto each inline review comment.
  5. Dismisses stale CHANGES_REQUESTED reviews authored by the bot.
  6. **Verify pass**: Sonnet, 30 turns, read-only. For each `action: "fixed"` claim, diffs the named commit against the comment's file/line, writes `./verify-report.json` with `verified[]` and `unverified[]`.
  7. **Auto-decision**: all verified -> bot APPROVE review; any unverified -> warning comment (no APPROVE); malformed report -> fail-closed.
  8. Flips PR label `claude:review-complete` -> `claude:done`.
  9. Moves the linked issue's project card from "In progress" to "In review" via `updateProjectV2ItemFieldValue`, when `PROJECT_BRIDGE_PAT` is set and the board has an "In review" column. Runs before the issue label swap so an upstream re-stamper sees a non-trigger status before we touch the labels. No-op when the secret is absent or the board lacks the column.
  10. Swaps issue label `claude:in-progress` -> `claude:pr-ready` (split + verify + retry).
  11. Requests a human reviewer via `POST /repos/{owner}/{repo}/pulls/{pr}/requested_reviewers`. Reviewer login resolves to repo var `CLAUDE_REVIEW_REQUESTER` if set, else `github.repository_owner`. Best-effort: self-review and other failures warn-and-continue.
- **Hooks**: `CLAUDE_REQUIRE_PLAN=1`, `CLAUDE_GUARD_TEST_EDITS=1` (blocks edits to existing test files until `./debug-notes.md` exists).

### `claude-review-comment-trigger.yml`
- **Trigger**: `issue_comment: created` on a PR (not an issue), with `/claude-review` in the body.
- **Does**: Removes `claude:ready-for-review`, `claude:review-complete`, `claude:done` from the PR, then re-adds `claude:ready-for-review` in the same `gh pr edit` call. The remove-then-add ensures a fresh `pull_request: labeled` event fires.
- **Outputs the trigger for**: `claude-pr-review.yml`.

### `claude-pr-merged-issue-done.yml`
- **Trigger**: `pull_request: closed` with `merged == true`.
- **Does**: Extracts linked issue from PR body (regex on `closes|fixes|resolves #N`). If the issue carries `claude:in-progress` or `claude:pr-ready`, removes both and adds `claude:done`. Label hygiene only.

### `claude.yml`
- **Trigger**: `@claude` mention in any issue, issue comment, PR review, or PR review comment.
- **Does**: Generic Claude assistance. Not part of the labeled-PR pipeline. Reads CI results (`additional_permissions: actions: read`).

---

## Secrets and permissions

| Secret | Used by | Why |
|---|---|---|
| `CLAUDE_AUTOMATION_PAT` | All `claude-*.yml` workflows for label flips, dismissals, APPROVE reviews, requested-reviewers, transcript pushes | `GITHUB_TOKEN`-driven label edits do NOT fire downstream `pull_request: labeled` events. A PAT is required at every handoff or the chain breaks silently. Also needs Contents write to push to the `claude-transcripts` orphan branch. |
| `CLAUDE_CODE_OAUTH_TOKEN` | `anthropics/claude-code-action@v1` step in every Claude workflow | Authenticates Claude Code. |
| `PROJECT_BRIDGE_PAT` (optional) | `claude-apply-review-fixes.yml` "Move project card off In progress" step | Fine-grained PAT with `project: read+write`. Only needed if you use GitHub Projects v2 with an "In review" column. `GITHUB_TOKEN` does not have user/org Projects v2 access by default, and `CLAUDE_AUTOMATION_PAT` is repo-scoped only. Without this PAT the card move silently warns and skips. |

| Repo variable | Used by | Default if unset |
|---|---|---|
| `CLAUDE_REVIEW_REQUESTER` | `claude-apply-review-fixes.yml` "Request human reviewer" step | `${{ github.repository_owner }}` |

---

## Transcripts

Every Claude run publishes its full execution transcript to the **`claude-transcripts` orphan branch** under `issue-<N>/<workflow>-<runid>.{txt,json}`. The link is posted as a comment on the originating issue (and PR, for review and apply-fixes). One PR cycle therefore accumulates three transcript links: `start-issue`, `pr-review`, `apply-review-fixes`.

- **Plain text** (`.txt`): rendered by `.github/scripts/render-transcript.mjs`, one section per turn, tool calls + results, results truncated to ~4 KB.
- **Raw JSON** (`.json`): unmodified `SDKMessage[]` from `claude-code-action@v1`'s `claude-execution-output.json`.
- **Visibility**: public-readable branch, no GitHub login needed. Treat URLs like issue-body content.
- **Implementation**: shared composite action at `.github/actions/publish-transcript/action.yml`. Retries `git push` up to 5 times with rebase if multiple workflows race.

---

## PreToolUse hooks

Two Node hooks in `.claude/hooks/` enforce process discipline in CI runs. They are no-ops in local sessions unless you opt in.

| Hook | Env var (set by workflow) | Active in | What it blocks |
|---|---|---|---|
| `require-plan.mjs` | `CLAUDE_REQUIRE_PLAN=1` | `start-issue`, `apply-review-fixes` | `Edit`/`Write`/`MultiEdit`/`NotebookEdit` until `./plan.md` exists |
| `no-flail-on-test-edits.mjs` | `CLAUDE_GUARD_TEST_EDITS=1` | `apply-review-fixes` only | `Edit`/`MultiEdit` on `*.test.*`, `*.spec.*`, `__tests__/*` until `./debug-notes.md` exists |

Scratch files (`plan.md`, `debug-notes.md`, `review-report.json`, `verify-report.json`, `critic-verdict.json`) should be added to `.gitignore` at the repo root.

To opt in locally: `export CLAUDE_REQUIRE_PLAN=1 CLAUDE_GUARD_TEST_EDITS=1` before running `claude`.

---

## Common failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| Chain halts after `claude-start-issue.yml`. Label flip happened but `claude-pr-review.yml` never ran. | Missing/expired `CLAUDE_AUTOMATION_PAT`. `GITHUB_TOKEN` label edits do not trigger downstream `pull_request: labeled` events. | Rotate `CLAUDE_AUTOMATION_PAT`. |
| Apply-fixes posts the fallback "report could not be parsed" comment. | Claude finished but did not write a valid `./review-report.json`. | Read the workflow logs; the PR may still have useful fix commits. Re-trigger with `/claude-review` after manual inspection. |
| Pre-review and post-fix grades are identical (`delta = 0`). | Either review asked only cosmetic changes, or Claude did not re-read the diff before re-grading. | Check `delta_explanation` in the report; it should cite per-subscore commit SHAs. |
| Workflow halts within seconds with `[require-plan]` / `[no-flail-on-test-edits]` in transcript. | Expected first failure if Claude tries to edit before writing `plan.md` / `debug-notes.md`. Should retry after writing the gate file. | If persistent: check hook stderr; the gate file path or schema may have drifted. |
| Issue ends up with both `claude:in-progress` and `claude:pr-ready`. | The swap raced or partially failed, and the post-condition retry also failed. | Manually fix the labels. Check the apply-fixes workflow log for the warning emitted by the verify-and-retry step. If a new upstream actor is re-stamping the label, add a `claude:pr-ready` precheck on that side. |
| `claude-start-issue.yml` keeps re-firing on the same issue, each run creating a fresh throwaway branch. | An upstream re-stamper is re-applying `claude:in-progress` after the workflow strips it. Common cause: a Projects v2 board automation rule that mirrors a column into a label. | The `precheck` job is the line of defense; it strips the label and exits 0 within ~10 seconds. The longer fix is to move the project card off "In progress" before the apply-fixes label swap (the `Move project card off "In progress"` step does this when `PROJECT_BRIDGE_PAT` is set). If the loop persists, list cross-referencing events with `gh api repos/{owner}/{repo}/issues/{N}/timeline --jq '.[] \| select(.event == "labeled" and .label.name == "claude:in-progress") \| {at: .created_at, by: .actor.login}'` to identify the actor. |
| Human reviewer not pinged after `claude:done`. | Either `CLAUDE_REVIEW_REQUESTER` (or `repository_owner`) equals the PR author (GitHub blocks self-review), the user is not a collaborator, or the API call rate-limited. | Check the workflow log for the `::warning::` from the "Request human reviewer" step. Set `CLAUDE_REVIEW_REQUESTER` to a different login if needed. |

---

## How to update this doc

This file is the **single source of truth** for the automation chain. Update it when you:

- Add, remove, or rename a `.github/workflows/*.yml` file.
- Change a workflow's trigger (events, label names, branch patterns, paths).
- Add, remove, or rename a label that any workflow reads or writes.
- Add, remove, or rename a secret or repo variable any workflow consumes.
- Add or remove a step that crosses a workflow boundary (e.g., flips a label that triggers another workflow).
- Change a hook's env var or guard file path.

Keep the diagrams and tables in sync.

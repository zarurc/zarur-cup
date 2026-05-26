#!/usr/bin/env node
// PreToolUse hook: requires ./plan.md to exist before any Edit/Write/MultiEdit.
//
// Active only when CLAUDE_REQUIRE_PLAN=1 (set by claude-start-issue.yml and
// claude-apply-review-fixes.yml). Local Claude Code sessions are unaffected
// unless the dev opts in.
//
// Exemptions:
//   - The Write/Edit that creates or modifies ./plan.md itself.
//   - Operations on .claude/state/** scratch files (the workflow may stage
//     intermediate artifacts there).

import { existsSync } from "node:fs";
import { resolve, sep } from "node:path";

if (process.env.CLAUDE_REQUIRE_PLAN !== "1") {
  process.exit(0);
}

let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const input = payload.tool_input || {};
  const filePath = String(input.file_path || "");
  if (!filePath) process.exit(0);

  const planPath = resolve(process.cwd(), "plan.md");
  const stateDir = resolve(process.cwd(), ".claude", "state") + sep;
  const target = resolve(filePath);

  if (target === planPath) process.exit(0);
  if (target.startsWith(stateDir)) process.exit(0);

  if (existsSync(planPath)) process.exit(0);

  const out = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: [
        "[require-plan] ./plan.md must exist before any Edit/Write/MultiEdit.",
        "",
        "Write the plan first. It must decompose the change into tasks of 2-5",
        "minutes each. For each task list:",
        "  - files touched",
        "  - the test that proves it works (RED step)",
        "  - the 'done when' assertion",
        "",
        "Once ./plan.md is on disk, retry your edit. The plan does not need",
        "to be perfect, it needs to exist and be specific.",
      ].join("\n"),
    },
  };
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
});

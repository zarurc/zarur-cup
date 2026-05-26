#!/usr/bin/env node
// PreToolUse hook: blocks edits to existing test files unless ./debug-notes.md
// exists, on the theory that "make the failing test pass by editing the test"
// is the most common debugging anti-pattern.
//
// Active only when CLAUDE_GUARD_TEST_EDITS=1 (set by claude-apply-review-fixes.yml).
// Not active in start-issue runs because that workflow legitimately writes new
// tests as part of the TDD RED step.
//
// Scope: gates Edit and MultiEdit (which only operate on existing files) when
// the target path matches a test file pattern. Write is intentionally NOT
// gated, since Write on a test path is most likely creating a new test file
// (the RED step), not modifying an existing one.
//
// Exemptions:
//   - ./debug-notes.md exists at the repo root.
//   - The file being edited is itself ./debug-notes.md.

import { existsSync } from "node:fs";
import { resolve } from "node:path";

if (process.env.CLAUDE_GUARD_TEST_EDITS !== "1") {
  process.exit(0);
}

const TEST_PATH_RE =
  /(^|[\\/])(?:__tests__[\\/]|(?:[^\\/]+\.(?:test|spec)\.(?:ts|tsx|js|jsx|mjs|cjs))$)/;

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

  if (!TEST_PATH_RE.test(filePath)) process.exit(0);

  const debugNotesPath = resolve(process.cwd(), "debug-notes.md");
  const target = resolve(filePath);
  if (target === debugNotesPath) process.exit(0);

  if (existsSync(debugNotesPath)) process.exit(0);

  const out = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: [
        "[no-flail-on-test-edits] You are about to edit an existing test file.",
        `  target: ${filePath}`,
        "",
        "If a test is failing, do not 'fix' it by changing the assertion or",
        "skipping the case. First write ./debug-notes.md with:",
        "  1. Observed: the actual failure output (paste the assertion).",
        "  2. Hypothesis: your best guess at the cause, in 1-2 sentences.",
        "  3. Repro: the minimal command/input that reproduces it.",
        "  4. Root cause: the actual defect, traced to a specific file:line.",
        "  5. Fix: which file you intend to change and why that addresses",
        "     the root cause (not the symptom).",
        "",
        "Once ./debug-notes.md exists, retry. If the test legitimately needs",
        "updating (the contract changed, not just the implementation), say so",
        "explicitly in the 'Fix' section.",
      ].join("\n"),
    },
  };
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
});

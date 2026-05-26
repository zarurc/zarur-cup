#!/usr/bin/env node
// Renders the SDKMessage[] JSON written by claude-code-action@v1 to
// ${{ runner.temp }}/claude-execution-output.json into a human-readable
// plain-text transcript. The output is committed to the claude-transcripts
// branch alongside the raw JSON; see .github/actions/publish-transcript/.
//
// Usage:
//   TRANSCRIPT_META='{"issue":42,"pr":99,"branch":"...","workflow":"start-issue","run_url":"..."}' \
//     node render-transcript.mjs <path-to-execution-file> > transcript.txt
//
// SDKMessage shape (from @anthropic-ai/claude-agent-sdk):
//   - { type: "system", subtype: "init", session_id, model, ... }
//   - { type: "user",      message: { content: ContentBlock[] | string } }
//   - { type: "assistant", message: { content: ContentBlock[] } }
//   - { type: "result", is_error, duration_ms, num_turns, total_cost_usd, permission_denials }
//
// ContentBlock is the Anthropic message shape:
//   - { type: "text", text }
//   - { type: "thinking", thinking }
//   - { type: "tool_use", id, name, input }
//   - { type: "tool_result", tool_use_id, content }

import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("usage: render-transcript.mjs <path-to-execution-file>");
  process.exit(2);
}

const meta = (() => {
  try {
    return JSON.parse(process.env.TRANSCRIPT_META || "{}");
  } catch {
    return {};
  }
})();

const messages = JSON.parse(readFileSync(path, "utf8"));
if (!Array.isArray(messages)) {
  console.error("expected execution file to contain a JSON array");
  process.exit(2);
}

const TOOL_RESULT_MAX = 4000;
const TEXT_BLOCK_MAX = 8000;

const initMsg = messages.find(
  (m) => m && m.type === "system" && m.subtype === "init",
);
const resultMsg = messages.find((m) => m && m.type === "result");

const lines = [];

const workflowLabel = meta.workflow || "claude run";
const heading = `Claude transcript: ${workflowLabel}`;
lines.push("=".repeat(heading.length + 8));
lines.push(`=== ${heading} ===`);
lines.push("=".repeat(heading.length + 8));
lines.push("");

const headerRows = [];
if (meta.issue) headerRows.push(`Issue:        #${meta.issue}`);
if (meta.pr) headerRows.push(`PR:           #${meta.pr}`);
if (meta.branch) headerRows.push(`Branch:       ${meta.branch}`);
if (meta.run_url) headerRows.push(`Workflow run: ${meta.run_url}`);
if (initMsg?.model) headerRows.push(`Model:        ${initMsg.model}`);
if (initMsg?.session_id) headerRows.push(`Session:      ${initMsg.session_id}`);
if (typeof resultMsg?.duration_ms === "number")
  headerRows.push(`Duration:     ${formatDuration(resultMsg.duration_ms)}`);
if (typeof resultMsg?.num_turns === "number")
  headerRows.push(`Turns:        ${resultMsg.num_turns}`);
if (typeof resultMsg?.total_cost_usd === "number")
  headerRows.push(`Cost:         $${resultMsg.total_cost_usd.toFixed(4)}`);
if (resultMsg?.is_error) headerRows.push(`Status:       ERROR`);

if (headerRows.length > 0) {
  lines.push(...headerRows);
  lines.push("");
}

lines.push("-".repeat(72));
lines.push("");

let turn = 0;
for (const msg of messages) {
  if (!msg || typeof msg !== "object") continue;
  if (msg.type === "system") continue;
  if (msg.type === "result") continue;

  turn += 1;
  const role =
    msg.type === "user"
      ? "User"
      : msg.type === "assistant"
        ? "Assistant"
        : msg.type;
  lines.push(`--- Turn ${turn} (${role}) ---`);
  lines.push("");

  const content = msg.message?.content;

  if (typeof content === "string") {
    lines.push(indent(truncate(content, TEXT_BLOCK_MAX), "  "));
    lines.push("");
    continue;
  }

  if (!Array.isArray(content)) {
    lines.push("  (empty turn)");
    lines.push("");
    continue;
  }

  for (const block of content) {
    if (!block || typeof block !== "object") continue;

    if (block.type === "text" && typeof block.text === "string") {
      lines.push(truncate(block.text, TEXT_BLOCK_MAX));
      lines.push("");
      continue;
    }

    if (block.type === "thinking" && typeof block.thinking === "string") {
      lines.push("[Thinking]");
      lines.push(indent(truncate(block.thinking, TEXT_BLOCK_MAX), "  "));
      lines.push("");
      continue;
    }

    if (block.type === "tool_use") {
      lines.push(`Tool call: ${block.name}`);
      lines.push("  Input:");
      const inputStr = truncate(
        JSON.stringify(block.input ?? {}, null, 2),
        TOOL_RESULT_MAX,
      );
      lines.push(indent(inputStr, "    "));
      lines.push("");
      continue;
    }

    if (block.type === "tool_result") {
      lines.push("Tool result:");
      const c = block.content;
      let rendered = "";
      if (typeof c === "string") rendered = c;
      else if (Array.isArray(c)) {
        rendered = c
          .map((b) => {
            if (!b || typeof b !== "object") return "";
            if (b.type === "text" && typeof b.text === "string") return b.text;
            return JSON.stringify(b);
          })
          .filter(Boolean)
          .join("\n");
      } else if (c != null) {
        rendered = JSON.stringify(c, null, 2);
      }
      lines.push(indent(truncate(rendered, TOOL_RESULT_MAX), "  "));
      lines.push("");
      continue;
    }
  }
}

if (resultMsg) {
  lines.push("-".repeat(72));
  lines.push("");
  lines.push("Run summary");
  lines.push("");
  lines.push(`  Status:   ${resultMsg.is_error ? "error" : "ok"}`);
  if (typeof resultMsg.duration_ms === "number")
    lines.push(`  Duration: ${formatDuration(resultMsg.duration_ms)}`);
  if (typeof resultMsg.num_turns === "number")
    lines.push(`  Turns:    ${resultMsg.num_turns}`);
  if (typeof resultMsg.total_cost_usd === "number")
    lines.push(`  Cost:     $${resultMsg.total_cost_usd.toFixed(4)}`);
  if (
    Array.isArray(resultMsg.permission_denials) &&
    resultMsg.permission_denials.length > 0
  ) {
    lines.push("");
    lines.push("  Permission denials:");
    for (const d of resultMsg.permission_denials) {
      const summary = d.tool_input_summary || d.tool_input || "";
      lines.push(
        `    - ${d.tool_name}${summary ? `: ${truncate(String(summary), 200)}` : ""}`,
      );
    }
  }
  lines.push("");
}

process.stdout.write(lines.join("\n"));

function truncate(s, n) {
  if (typeof s !== "string") s = String(s);
  if (s.length <= n) return s;
  return (
    s.slice(0, n) +
    `\n... (truncated, ${s.length - n} more chars; see the .json sibling file for full content)`
  );
}

function indent(s, prefix) {
  return s
    .split("\n")
    .map((l) => `${prefix}${l}`)
    .join("\n");
}

function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

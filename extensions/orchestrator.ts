import type { ExtensionAPI, ToolCallEvent } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";
import { readState } from "./state-manager-utils.js";
import { loadRouterConfig } from "./model-router-utils.js";

const KEYWORD_PATTERNS: Array<{ pattern: RegExp; mode: string; message: string }> = [
  { pattern: /\bcancel\b/i, mode: "cancel", message: "Invoke the cancel skill to stop the active mode." },
  { pattern: /\bralph\b/i, mode: "ralph", message: "Use the executing-plans skill with --ralph strategy." },
  { pattern: /\bautopilot\b/i, mode: "autopilot", message: "Use the executing-plans skill with --autopilot strategy." },
  { pattern: /\becomode\b/i, mode: "ecomode", message: "Activate ecomode for token-efficient model routing." },
  { pattern: /\bralplan\b/i, mode: "ralplan", message: "Use the ralplan skill for consensus planning." },
  { pattern: /\bparallel\b/i, mode: "parallel", message: "Use the executing-plans skill with --parallel strategy." },
];

const SOURCE_EXTENSIONS = /\.(ts|tsx|js|jsx|py|go|rs|java|c|cpp|h|svelte|vue)$/;
const ALLOWED_PATHS = /(\.(pi|claude)|CLAUDE\.md|AGENTS\.md|README\.md|package\.json|\.json$|\.md$)/;

export default function (pi: ExtensionAPI) {
  let cwd = ".";
  let config = loadRouterConfig();

  // session_start now fires on startup, reload, new, resume, and fork (Pi 0.65+).
  // We re-read cwd and reload config on every session change so state paths stay correct.
  pi.on("session_start", async (_event, ctx) => {
    cwd = ctx.cwd;
    config = loadRouterConfig(cwd);
  });

  // Keyword detection
  pi.on("input", async (event, _ctx) => {
    try {
      // Strip code blocks to avoid false positives
      const text = event.text.replace(/```[\s\S]*?```/g, "").replace(/<[^>]+>/g, "");

      for (const { pattern, mode, message } of KEYWORD_PATTERNS) {
        if (pattern.test(text)) {
          return {
            action: "transform" as const,
            text: `[Keyword detected: ${mode}] ${message}\n\nOriginal request: ${event.text}`,
          };
        }
      }
    } catch {
      // On error, pass through unchanged
    }
    return { action: "continue" as const };
  });

  // Delegation audit
  pi.on("tool_call", async (event, _ctx) => {
    if (!config.delegation.audit) return;

    if (isToolCallEventType("write", event) || isToolCallEventType("edit", event)) {
      const filePath = (event.input as Record<string, string>).file_path || (event.input as Record<string, string>).path || "";

      if (SOURCE_EXTENSIONS.test(filePath) && !ALLOWED_PATHS.test(filePath)) {
        // Log delegation audit
        const auditDir = path.join(cwd, ".pi", "state");
        const auditFile = path.join(auditDir, "delegation-audit.jsonl");
        try {
          fs.mkdirSync(auditDir, { recursive: true });
          const entry = JSON.stringify({
            timestamp: new Date().toISOString(),
            tool: event.toolName,
            file: filePath,
            message: "Direct source file write — consider delegating to a subagent",
          });
          fs.appendFileSync(auditFile, entry + "\n");
        } catch {
          // Skip if can't write audit log
        }

        if (config.delegation.enforce) {
          return { block: true, reason: "Direct source file writes are blocked. Delegate to a subagent instead." };
        }
      }
    }
  });

  // Mode reminders via system prompt
  pi.on("before_agent_start", async (event, _ctx) => {
    const stateDir = path.join(cwd, ".pi", "state");

    for (const mode of ["ralph", "autopilot"]) {
      const state = readState(stateDir, mode);
      if (state?.active) {
        return {
          systemPrompt: event.systemPrompt + `\n\n[Active mode: ${mode}. Follow the executing-plans skill, ${mode} strategy. Use the state tool to track progress. When done, invoke /cancel.]`,
        };
      }
    }
  });
}

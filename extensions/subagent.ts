/**
 * Subagent tool extension for pi-superpowers.
 *
 * Adapted from the official Pi subagent example:
 * https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/subagent
 *
 * Registers a `subagent` tool with three modes:
 * - Single: { agent, task }
 * - Parallel: { tasks: [{agent, task}, ...] } - up to 8 tasks, 4 concurrent
 * - Chain: { chain: [{agent, task}, ...] } - sequential with {previous} placeholder
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";

import { discoverAgentsWithProjectDir } from "./agents.js";
import type { AgentConfig } from "./agents.js";
import {
  buildAgentArgs,
  writePromptToTempFile,
  mapWithConcurrencyLimit,
  getFinalOutput,
  formatUsageStats,
  emptyUsage,
  toolResult,
} from "./subagent-utils.js";
import type { Message, UsageStats } from "./subagent-utils.js";
import { loadRouterConfig, resolveModel } from "./model-router-utils.js";
import type { RouterConfig } from "./model-router-utils.js";

// Constants
const MAX_PARALLEL_TASKS = 8;
const MAX_CONCURRENCY = 4;
const COLLAPSED_ITEM_COUNT = 10;

// Interfaces for the render system
interface SubagentDetails {
  agentName: string;
  model?: string;
  task: string;
  output: string;
  usage: UsageStats;
  error?: string;
  toolCalls: Array<{ name: string; args: Record<string, unknown> }>;
}

interface SingleResult {
  success: boolean;
  output: string;
  usage: UsageStats;
  model?: string;
  error?: string;
  toolCalls: Array<{ name: string; args: Record<string, unknown> }>;
}

/**
 * Resolve the pi invocation: use the current process script if running via node/bun,
 * otherwise fall back to the `pi` binary on PATH.
 *
 * This matches the approach in Pi's official subagent example so subagents work
 * correctly regardless of how Pi itself was launched.
 */
function getPiInvocation(args: string[]): { command: string; args: string[] } {
  const currentScript = process.argv[1];
  if (currentScript && fs.existsSync(currentScript)) {
    return { command: process.execPath, args: [currentScript, ...args] };
  }
  const execName = path.basename(process.execPath).toLowerCase();
  const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
  if (!isGenericRuntime) {
    // Pi is compiled / shipped as a self-contained binary
    return { command: process.execPath, args };
  }
  return { command: "pi", args };
}

/** Format a tool call for collapsed display in the TUI */
function formatToolCall(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "bash":
    case "Bash":
      return `$ ${String(args.command ?? "").slice(0, 80)}`;
    case "read":
    case "Read":
      return `read ${String(args.file_path ?? args.path ?? "")}`;
    case "write":
    case "Write":
      return `write ${String(args.file_path ?? args.path ?? "")}`;
    case "edit":
    case "Edit":
      return `edit ${String(args.file_path ?? args.path ?? "")}`;
    case "ls":
      return `ls ${String(args.path ?? ".")}`;
    case "find":
      return `find ${String(args.pattern ?? args.path ?? "")}`;
    case "grep":
    case "Grep":
      return `grep ${String(args.pattern ?? "")} ${String(args.path ?? "")}`;
    default:
      return `${name}(${JSON.stringify(args).slice(0, 60)})`;
  }
}

/**
 * Run a single agent as a subprocess.
 * Spawns `pi --mode json -p --no-session` and streams newline-delimited JSON events.
 */
async function runSingleAgent(
  agent: AgentConfig,
  task: string,
  cwd: string,
  signal: AbortSignal | undefined,
  onUpdate: (details: Partial<SubagentDetails>) => void,
  routerConfig?: RouterConfig,
  tier?: string,
): Promise<SingleResult> {
  const resolvedModel = routerConfig
    ? resolveModel(agent.name, agent, routerConfig, { explicitTier: tier, taskPrompt: task })
    : agent.model;
  const args = buildAgentArgs({ model: resolvedModel, tools: agent.tools });

  // Write the agent system prompt to a temp file and pass it via --append-system-prompt.
  // Pi 0.65+ removed --prompt-file; the task is now passed as a positional argument.
  let tmpDir: string | null = null;
  let promptFile: string | null = null;

  if (agent.systemPrompt?.trim()) {
    const tmp = writePromptToTempFile(agent.name, agent.systemPrompt);
    tmpDir = tmp.dir;
    promptFile = tmp.filePath;
    args.push("--append-system-prompt", promptFile);
  }

  // Task is the user message — pass as a positional argument
  args.push(`Task: ${task}`);

  const messages: Message[] = [];
  const usage = emptyUsage();
  const toolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

  return new Promise<SingleResult>((resolve) => {
    const invocation = getPiInvocation(args);
    const proc = spawn(invocation.command, invocation.args, {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const rl = readline.createInterface({ input: proc.stdout });

    rl.on("line", (line: string) => {
      if (!line.trim()) return;

      let event: Record<string, unknown>;
      try {
        event = JSON.parse(line);
      } catch {
        return;
      }

      const eventType = event.type as string;

      if (eventType === "message_end") {
        const message = event.message as Message | undefined;
        if (message) {
          messages.push(message);

          if (message.role === "assistant") {
            // Track usage for assistant turns only
            if (message.usage) {
              usage.input += message.usage.input ?? 0;
              usage.output += message.usage.output ?? 0;
              usage.cacheRead += message.usage.cacheRead ?? 0;
              usage.cacheWrite += message.usage.cacheWrite ?? 0;
              usage.cost += message.usage.cost?.total ?? 0;
              usage.contextTokens = message.usage.totalTokens ?? 0;
            }
            usage.turns++;

            // Track tool calls in current Pi JSON protocol (`toolCall`) while also
            // tolerating the older `tool_use` shape for backward compatibility.
            if (Array.isArray(message.content)) {
              for (const part of message.content) {
                const partType = part.type;
                if ((partType === "toolCall" || partType === "tool_use") && part.name) {
                  toolCalls.push({
                    name: part.name,
                    args: (part.arguments ?? {}) as Record<string, unknown>,
                  });
                }
              }
            }

            onUpdate({
              usage: { ...usage },
              toolCalls: [...toolCalls],
            });
          }
        }
      } else if (eventType === "tool_result_end") {
        // Tool results are tracked via message_end above
      }
    });

    let stderrOutput = "";
    proc.stderr.on("data", (chunk: Buffer) => {
      stderrOutput += chunk.toString();
    });

    proc.on("close", (code: number | null) => {
      // Cleanup temp files
      try {
        if (promptFile) fs.unlinkSync(promptFile);
        if (tmpDir) fs.rmdirSync(tmpDir);
      } catch {
        // Ignore cleanup errors
      }

      const output = getFinalOutput(messages);
      const error = code !== 0 ? stderrOutput || `Process exited with code ${code}` : undefined;

      resolve({
        success: code === 0,
        output,
        usage,
        model: resolvedModel,
        error,
        toolCalls,
      });
    });

    proc.on("error", (err: Error) => {
      // Cleanup temp files
      try {
        if (promptFile) fs.unlinkSync(promptFile);
        if (tmpDir) fs.rmdirSync(tmpDir);
      } catch {
        // Ignore cleanup errors
      }

      resolve({
        success: false,
        output: "",
        usage,
        error: err.message,
        toolCalls,
      });
    });

    // Handle abort signal: send SIGTERM, then SIGKILL if needed
    if (signal) {
      const killProc = () => {
        proc.kill("SIGTERM");
        setTimeout(() => {
          if (!proc.killed) proc.kill("SIGKILL");
        }, 5000);
      };
      if (signal.aborted) {
        killProc();
      } else {
        signal.addEventListener("abort", killProc, { once: true });
      }
    }
  });
}

export default function (pi: ExtensionAPI) {
  const AgentTask = Type.Object({
    agent: Type.String({ description: "Agent name (e.g. 'worker', 'scout', 'planner', 'code-reviewer')" }),
    task: Type.String({ description: "Task description for the agent" }),
    tier: Type.Optional(Type.String({
      description: 'Model tier override: "fast", "standard", or "reasoning". If omitted, uses agent default or auto-routes based on task complexity.',
    })),
  });

  const ParamsSchema = Type.Object(
    {
      agent: Type.Optional(Type.String({
        description: "Agent name for single-agent mode",
      })),
      task: Type.Optional(Type.String({
        description: "Task description for single-agent mode",
      })),
      tasks: Type.Optional(Type.Array(AgentTask, {
        description: "Array of agent-task pairs for parallel execution (max 8, 4 concurrent)",
        maxItems: MAX_PARALLEL_TASKS,
      })),
      chain: Type.Optional(Type.Array(AgentTask, {
        description: "Array of agent-task pairs for sequential execution. Use {previous} in task to reference previous output.",
      })),
      tier: Type.Optional(Type.String({
        description: 'Model tier override for single mode: "fast", "standard", or "reasoning".',
      })),
    },
    {
      description: "Dispatch work to specialized subagents. Use single mode for one task, parallel for independent tasks, or chain for sequential handoffs.",
    },
  );

  pi.registerTool({
    name: "subagent",
    label: "Subagent",
    description:
      "Dispatch tasks to specialized subagents. Supports three modes: " +
      "single (one agent, one task), parallel (multiple independent tasks, up to 8 with 4 concurrent), " +
      "and chain (sequential pipeline where each step can reference {previous} output).",
    parameters: ParamsSchema,
    promptGuidelines: [
      "For multi-task implementation plans, use the superpowers:subagent-driven-development skill",
      "For 3+ independent broken subsystems, use superpowers:dispatching-parallel-agents skill",
      "After task completion, use superpowers:requesting-code-review to dispatch the code-reviewer agent",
    ],

    async execute(
      toolCallId: string,
      params: Record<string, unknown>,
      signal: AbortSignal | undefined,
      onUpdate: ((data: AgentToolResult<unknown>) => void) | undefined,
      ctx: { cwd: string },
    ) {
      // Discover agents
      const { agents, projectAgentsDir } = discoverAgentsWithProjectDir(
        ctx.cwd,
        "both",
      );

      const routerConfig = loadRouterConfig(projectAgentsDir ? path.dirname(projectAgentsDir) : undefined);

      // Helper: find agent by name
      function findAgent(name: string): AgentConfig | undefined {
        return agents.find((a) => a.name === name);
      }

      // Determine mode
      if (params.chain && Array.isArray(params.chain)) {
        // Chain mode: sequential execution with {previous} substitution
        const chain = params.chain as Array<{ agent: string; task: string; tier?: string }>;
        let previousOutput = "";
        const results: SingleResult[] = [];

        for (const step of chain) {
          if (signal?.aborted) break;

          const agent = findAgent(step.agent);
          if (!agent) {
            return toolResult(`Unknown agent: ${step.agent}`);
          }

          // Substitute {previous} placeholder
          const resolvedTask = step.task.replace(/\{previous\}/g, previousOutput);

          const result = await runSingleAgent(agent, resolvedTask, ctx.cwd, signal, (details) => {
            onUpdate?.({
              content: [],
              details: { type: "chain_progress", agent: step.agent, ...details },
            });
          }, routerConfig, step.tier);

          results.push(result);
          previousOutput = result.output;

          if (!result.success) {
            return toolResult(`Chain failed at step "${step.agent}": ${result.error ?? "unknown error"}\n\nOutput so far:\n${previousOutput}`);
          }
        }

        const lastResult = results[results.length - 1];
        const totalUsage = results.reduce(
          (acc, r) => ({
            input: acc.input + r.usage.input,
            output: acc.output + r.usage.output,
            cacheRead: acc.cacheRead + r.usage.cacheRead,
            cacheWrite: acc.cacheWrite + r.usage.cacheWrite,
            cost: acc.cost + r.usage.cost,
            contextTokens: 0,
            turns: acc.turns + r.usage.turns,
          }),
          emptyUsage(),
        );

        return toolResult(`Chain completed (${chain.length} steps). ${formatUsageStats(totalUsage)}\n\n${lastResult?.output ?? ""}`);
      } else if (params.tasks && Array.isArray(params.tasks)) {
        // Parallel mode
        const tasks = params.tasks as Array<{ agent: string; task: string; tier?: string }>;

        if (tasks.length > MAX_PARALLEL_TASKS) {
          return toolResult(`Too many parallel tasks (${tasks.length}). Maximum is ${MAX_PARALLEL_TASKS}.`);
        }

        // Validate all agents exist
        for (const t of tasks) {
          if (!findAgent(t.agent)) {
            return toolResult(`Unknown agent: ${t.agent}`);
          }
        }

        const results = await mapWithConcurrencyLimit(
          tasks,
          MAX_CONCURRENCY,
          async (t, index) => {
            const agent = findAgent(t.agent)!;
            return runSingleAgent(agent, t.task, ctx.cwd, signal, (details) => {
              onUpdate?.({
                content: [],
                details: { type: "parallel_progress", index, agent: t.agent, ...details },
              });
            }, routerConfig, t.tier);
          },
        );

        const totalUsage = results.reduce(
          (acc, r) => ({
            input: acc.input + r.usage.input,
            output: acc.output + r.usage.output,
            cacheRead: acc.cacheRead + r.usage.cacheRead,
            cacheWrite: acc.cacheWrite + r.usage.cacheWrite,
            cost: acc.cost + r.usage.cost,
            contextTokens: 0,
            turns: acc.turns + r.usage.turns,
          }),
          emptyUsage(),
        );

        const outputParts = results.map((r, i) => {
          const t = tasks[i];
          const status = r.success ? "completed" : "FAILED";
          return `### ${t.agent} (${status})\n**Task:** ${t.task}\n\n${r.output || r.error || "(no output)"}`;
        });

        return toolResult(`Parallel execution complete (${tasks.length} tasks). ${formatUsageStats(totalUsage)}\n\n${outputParts.join("\n\n---\n\n")}`);
      } else if (params.agent && params.task) {
        // Single mode
        const agent = findAgent(params.agent as string);
        if (!agent) {
          return toolResult(`Unknown agent: ${params.agent}`);
        }

        const result = await runSingleAgent(
          agent,
          params.task as string,
          ctx.cwd,
          signal,
          (details) => {
            onUpdate?.({
              content: [],
              details: { type: "single_progress", agent: params.agent, ...details },
            });
          },
          routerConfig,
          params.tier as string | undefined,
        );

        if (!result.success) {
          return toolResult(`Agent "${params.agent}" failed: ${result.error ?? "unknown error"}\n\n${result.output}`);
        }

        return toolResult(`${result.output}\n\n---\n${formatUsageStats(result.usage, result.model)}`);
      } else {
        return toolResult("Invalid parameters. Use one of: { agent, task } for single mode, { tasks: [...] } for parallel, or { chain: [...] } for sequential.");
      }
    },
  });
}

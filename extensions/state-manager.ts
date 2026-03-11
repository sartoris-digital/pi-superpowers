import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import * as path from "node:path";
import { readState, writeState, clearState, listStates, isStale } from "./state-manager-utils.js";
import { loadRouterConfig } from "./model-router-utils.js";

export default function (pi: ExtensionAPI) {
  let stateDir = ".pi/state";

  pi.on("session_start", async (_event, ctx) => {
    stateDir = path.join(ctx.cwd, ".pi", "state");
    // Clean up stale states
    const config = loadRouterConfig(ctx.cwd);
    const keys = listStates(stateDir);
    for (const key of keys) {
      const state = readState(stateDir, key);
      if (state && isStale(state, config.persistence.staleTimeout)) {
        // Only clean if not marked active (respect resumed sessions)
        if (!state.active) {
          clearState(stateDir, key);
        }
      }
    }
  });

  pi.registerTool({
    name: "state",
    label: "State Manager",
    description: "Read, write, clear, or list persistent state for execution modes (ralph, autopilot, etc.)",
    parameters: Type.Object({
      operation: StringEnum(["read", "write", "clear", "list"] as const, {
        description: "Operation to perform",
      }),
      key: Type.Optional(
        Type.String({ description: 'State key (e.g., "ralph", "autopilot"). Required for read/write/clear.' }),
      ),
      data: Type.Optional(
        Type.Unknown({ description: "JSON data to write. Required for write operation." }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      switch (params.operation) {
        case "read": {
          if (!params.key) return error("key is required for read");
          const state = readState(stateDir, params.key);
          return ok(state ? JSON.stringify(state, null, 2) : "No state found");
        }
        case "write": {
          if (!params.key) return error("key is required for write");
          if (!params.data) return error("data is required for write");
          writeState(stateDir, params.key, params.data as Record<string, unknown>);
          return ok(`State "${params.key}" written`);
        }
        case "clear": {
          if (!params.key) return error("key is required for clear");
          clearState(stateDir, params.key);
          return ok(`State "${params.key}" cleared`);
        }
        case "list": {
          const keys = listStates(stateDir);
          return ok(keys.length > 0 ? keys.join("\n") : "No active states");
        }
        default:
          return error(`Unknown operation: ${params.operation}`);
      }
    },
  });
}

function ok(text: string) {
  return { content: [{ type: "text" as const, text }], details: {} };
}

function error(text: string) {
  return { content: [{ type: "text" as const, text: `Error: ${text}` }], details: {}, isError: true };
}

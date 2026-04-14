import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as path from "node:path";
import { readState, writeState, isStale } from "./state-manager-utils.js";
import { loadRouterConfig } from "./model-router-utils.js";

const PERSISTENCE_MODES = ["ralph", "autopilot"];
const CANCEL_SIGNAL_KEY = "cancel-signal";

export default function (pi: ExtensionAPI) {
  let stateDir = ".pi/state";
  let maxIterations = 50;
  let staleTimeout = 14400;

  // session_start now fires on startup, reload, new, resume, and fork (Pi 0.65+).
  // Rebind stateDir and config on every session switch so paths stay correct.
  pi.on("session_start", async (event, ctx) => {
    stateDir = path.join(ctx.cwd, ".pi", "state");
    const config = loadRouterConfig(ctx.cwd);
    maxIterations = config.persistence.maxIterations;
    staleTimeout = config.persistence.staleTimeout;

    // On resume, log active modes so the LLM sees them in context.
    // No explicit restore action needed — the agent_end handler will
    // pick up active states and inject continuation messages automatically.
    // State persistence is handled by writeState's atomic writes.
  });

  pi.on("agent_end", async (_event, _ctx) => {
    // Check for cancel signal first
    const cancelSignal = readState(stateDir, CANCEL_SIGNAL_KEY);
    if (cancelSignal) return; // Let the agent stop

    // Check each persistence mode
    for (const mode of PERSISTENCE_MODES) {
      const state = readState(stateDir, mode);
      if (!state?.active) continue;

      // Guard: max iterations
      const iteration = (state._persistenceIteration as number) || 0;
      if (iteration >= maxIterations) {
        writeState(stateDir, mode, { ...state, active: false, reason: "max iterations reached" });
        return;
      }

      // Guard: staleness
      if (isStale(state, staleTimeout)) {
        writeState(stateDir, mode, { ...state, active: false, reason: "stale timeout" });
        return;
      }

      // Increment iteration counter
      writeState(stateDir, mode, { ...state, _persistenceIteration: iteration + 1 });

      // Inject continuation message
      try {
        pi.sendMessage(
          {
            customType: "persistence-engine",
            content: `[Persistence: ${mode} mode active, iteration ${iteration + 1}/${maxIterations}. Continue working on remaining tasks. Use \`state read ${mode}\` to check progress. When all work is done, update state to active: false, then invoke /cancel.]`,
            display: true,
          },
          { deliverAs: "followUp", triggerTurn: true },
        );
      } catch {
        // Session shutting down — save state for resume
      }
      return; // Only handle one active mode
    }
  });

  // No session_shutdown handler needed: state is persisted atomically
  // via writeState() on every update, so no flush is required.
}

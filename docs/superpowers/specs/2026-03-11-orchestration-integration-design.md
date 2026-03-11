# Orchestration Integration Design

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan.

**Goal:** Integrate advanced orchestration features from oh-my-claudecode into pi-superpowers — smart model routing, persistence loops, execution strategies, verification tiers, planning workflows, and delegation enforcement — merged with existing agents and skills rather than duplicated.

**Architecture:** Balanced approach — 3 new TypeScript extensions handle infrastructure (state management, persistence, orchestration glue) plus a shared utility module for model routing (consumed by the subagent extension). Skills handle workflows (planning, execution strategies, verification checklists). Extensions enforce behavior programmatically via Pi's lifecycle events; skills guide the LLM through workflow steps.

**Tech Stack:** TypeScript extensions using Pi's ExtensionAPI, markdown skills/agents, JSON config files, Pi lifecycle events (input, tool_call, tool_result, agent_end, session_start, before_agent_start, session_shutdown).

**Note on extension count:** The `extensions/` directory contains both registered extensions (files that export a default function receiving `ExtensionAPI`) and utility modules (imported by extensions but not registered independently). When this spec says "extensions," it means registered extensions only. Utility modules like `subagent-utils.ts`, `bootstrap-utils.ts`, `agents.ts`, and the new `model-router-utils.ts` are not counted.

---

## Table of Contents

1. [Unified Configuration System](#1-unified-configuration-system)
2. [New Extensions](#2-new-extensions)
3. [New Agents](#3-new-agents)
4. [Enhanced Existing Skills](#4-enhanced-existing-skills)
5. [New Skills](#5-new-skills)
6. [New Prompts](#6-new-prompts)
7. [Feature-Driven Phases](#7-feature-driven-phases)

---

## 1. Unified Configuration System

Replace the current `.pi/code-review.json` with a broader `.pi/superpowers.json` that configures model routing, execution preferences, and feature toggles.

### Config file: `.pi/superpowers.json`

```json
{
  "models": {
    "fast": "claude-haiku-4-5",
    "standard": "claude-sonnet-4-6",
    "reasoning": "claude-opus-4-6"
  },
  "routing": {
    "enabled": true,
    "defaultTier": "standard",
    "agentTierOverrides": {
      "scout": "fast",
      "bug-hunter": "reasoning",
      "security-reviewer": "reasoning",
      "issue-validator": "reasoning"
    }
  },
  "persistence": {
    "maxIterations": 50,
    "staleTimeout": 14400
  },
  "delegation": {
    "audit": true,
    "enforce": false
  }
}
```

### Design decisions

- **Backward compatible** — If `.pi/code-review.json` exists but `.pi/superpowers.json` doesn't, the model-router reads the old config. Migration is seamless.
- **Three-tier model mapping** — Same `fast`/`standard`/`reasoning` tiers as the existing code-review config, now applied globally. Any agent's default tier can be overridden in `agentTierOverrides`.
- **Project agent overrides still win** — If a user creates `.pi/agents/worker.md` with `model: gpt-4.1`, that takes precedence over the config file. Hierarchy: project agent file > superpowers.json > bundled agent default.
- **Non-Anthropic friendly** — The `models` block accepts any model ID Pi supports (GPT, Gemini, Ollama, etc.). The smart routing maps tiers to these models rather than hardcoding Claude model names.
- **Feature toggles** — `routing.enabled`, `delegation.audit`, `delegation.enforce` let users opt into features incrementally.

### How skills reference tiers

Skills stop hardcoding model names. Instead of "dispatch scout (haiku)", they say "dispatch scout (fast tier)". The model-router extension resolves the actual model at dispatch time.

```
subagent({ agent: "scout", task: "...", tier: "fast" })
```

The `tier` parameter is a new optional field on the subagent tool. If omitted, the router uses the agent's default tier from config or frontmatter.

---

## 2. New Extensions

Three new registered extensions under `extensions/`, plus one shared utility module. The extensions handle infrastructure — state, persistence, and orchestration glue. The utility module handles model routing and is consumed by the subagent extension.

### 2.1 state-manager.ts (registered extension)

**Purpose:** Unified state tracking for active modes, progress, and cancellation signals.

**What it does:**
- Registers a custom `state` tool the LLM can call to read/write/clear/list state
- Stores state as JSON files under `.pi/state/` (project-local)
- Provides atomic read/write/clear/list operations
- Tracks heartbeats for staleness detection (marks states inactive after `staleTimeout`)
- Cleans up stale states on `session_start`

**Tool interface:**
```json
{
  "name": "state",
  "parameters": {
    "operation": "read | write | clear | list",
    "key": "string (state name, e.g., 'ralph', 'autopilot')",
    "data": "object (for write operation)"
  }
}
```

**Events used:** `session_start` (cleanup stale states)

**Resume-aware cleanup:** The `session_start` event includes `event.resumed: boolean`. When `resumed: true`, the state-manager skips cleanup of active mode states (e.g., `ralph-state.json` with `active: true`) to avoid racing with the persistence-engine's restore logic. Only states that are both stale (older than `staleTimeout`) AND not actively flagged are cleaned up during a resumed session.

### 2.2 model-router-utils.ts (shared utility module — NOT a registered extension)

**Purpose:** Resolves the correct model for a given agent + tier, based on config and complexity signals.

**Why a utility module instead of a lifecycle extension?** Pi's `tool_call` event result type (`ToolCallEventResult`) only supports `{ block?: boolean; reason?: string }` — it can block a tool call but cannot modify its parameters. Therefore, model routing cannot be implemented as a `tool_call` interceptor. Instead, the subagent extension imports this module and calls it directly when resolving the model for each agent dispatch.

**What it exports:**
```typescript
interface RouterConfig {
  models: { fast: string; standard: string; reasoning: string };
  routing: { enabled: boolean; defaultTier: string; agentTierOverrides: Record<string, string> };
}

// Load config with fallback chain: .pi/superpowers.json -> .pi/code-review.json -> bundled defaults
function loadRouterConfig(projectDir?: string): RouterConfig;

// Resolve a model ID for a given agent, respecting: project agent override > config > agent frontmatter default
function resolveModel(agentName: string, agentConfig: AgentConfig, routerConfig: RouterConfig, options?: {
  explicitTier?: string;        // from subagent tool's `tier` parameter
  taskPrompt?: string;          // for auto-routing signal extraction
  ecomodeActive?: boolean;      // shifts tiers down
}): string;

// Extract complexity signals from task prompt text to auto-select tier
function extractTierFromSignals(taskPrompt: string): "fast" | "standard" | "reasoning";
```

**Complexity signal extraction (for auto-routing when no explicit `tier`):**
- **Fast signals:** keyword-only matching ("find", "list", "check", "count", "search", "look up"). Prompt length is NOT used as a signal (short prompts can be complex).
- **Reasoning signals:** "debug", "security", "architect", "why", "race condition", "refactor architecture", multi-file references (3+ file paths), explicit complexity markers
- **Standard:** everything else (default)

**Resolution priority:**
1. If agent has a project-level override (`.pi/agents/worker.md` with explicit `model:`), use that — router does NOT override
2. If explicit `tier` parameter provided in subagent call, map to model via config
3. If no explicit tier, extract signals from task prompt
4. If ecomode active, shift tier down (reasoning→standard, standard→fast)
5. Map final tier to model ID via `routerConfig.models[tier]`

**Integration with subagent.ts:** The subagent extension imports `resolveModel()` and calls it when building the `pi` subprocess args. This happens inside `buildAgentArgs()` or a new `resolveAgentModel()` step before spawning. The `tier` parameter is added to the subagent tool's schema alongside `agent` and `task`.

### 2.3 persistence-engine.ts (registered extension)

**Purpose:** Keeps the agent working until all tasks/stories are complete. Powers the autopilot and ralph execution strategies.

**What it does:**
- On `agent_end`: checks `.pi/state/{mode}-state.json` for active persistence modes
- If a mode is active and work remains incomplete: injects a continuation message via `pi.sendMessage()` with `deliverAs: "followUp"` and `triggerTurn: true`
- Continuation messages include: remaining task summary, iteration count, elapsed context
- Respects cancel signals: if `.pi/state/cancel-signal.json` exists, allows the agent to stop
- Increments iteration counter on each continuation; stops after `maxIterations` from config
- On `session_start`: restores active mode state (session resume support)

**Events used:** `agent_end` (inject continuation), `session_start` (restore state), `session_shutdown` (save state for resume)

**Key design note:** Instead of blocking Stop events (which Pi doesn't support the same way), we use `agent_end` + `pi.sendMessage({ deliverAs: "followUp", triggerTurn: true })` to create a follow-up turn. The agent naturally continues rather than being prevented from stopping.

**State-write contract (critical):** The persistence engine can only check state that has been written. The executing-plans skill MUST instruct the LLM to update state via the `state` tool before each turn concludes. Specifically:

1. Before starting work: `state write ralph { active: true, iteration: 1, stories: [...], completedStories: [] }`
2. After completing a story/task: `state write ralph { ...current, completedStories: [...updated] }`
3. When all work is done: `state write ralph { active: false, ... }`

If the LLM fails to update state, the persistence engine has nothing to check and will not inject a continuation. This is by design — the LLM is in control of when persistence activates and deactivates.

**Recursive agent_end handling:** Each `sendMessage({ triggerTurn: true })` from the `agent_end` handler creates a NEW agent loop (agent_start -> turns -> agent_end). This means the persistence engine's `agent_end` handler fires again at the end of each continuation turn. This is intentional — it IS the loop mechanism. Guards against infinite loops:

1. **Cancel signal:** If `.pi/state/cancel-signal.json` exists, stop immediately
2. **Max iterations:** Increment counter atomically on each continuation; stop after `maxIterations`
3. **Staleness:** If last state update was >staleTimeout seconds ago, assume abandoned and stop
4. **Completion:** If state shows `active: false` or all stories/tasks are marked complete, stop

The iteration counter is read-modify-written by the persistence engine itself (not the LLM), ensuring it increments reliably even if the LLM forgets.

**Error handling:** If `sendMessage()` throws (e.g., session is shutting down), the persistence engine catches the error and saves current state to `.pi/state/{mode}-state.json` for potential session resume. If `.pi/state/` is not writable, the extension logs a warning on `session_start` and disables persistence features.

### 2.4 orchestrator.ts (registered extension)

**Purpose:** Keyword detection, delegation auditing, and mode activation glue.

**What it does:**

1. **Keyword detection** — On `input` event, scans for magic keywords:
   - "ralph", "autopilot", "ecomode", "cancel", "ralplan", "parallel"
   - Returns `{ action: "transform" }` to prepend activation instructions to the prompt

2. **Delegation audit** — On `tool_call` for write/edit tools, logs when the LLM writes source code directly instead of delegating to a subagent:
   - Allowed paths (direct write OK): `.pi/`, config files, markdown docs
   - Warned paths (should delegate): `.ts`, `.js`, `.py`, `.go`, `.rs`, `.java`, `.c`, `.cpp`
   - Soft warning logged to `.pi/state/delegation-audit.jsonl`
   - Optionally enforced (blocks write) via `delegation.enforce` config

3. **Skill activation hints** — On `before_agent_start`, appends a brief reminder to the system prompt via `return { systemPrompt: event.systemPrompt + "\n\n[Active mode: ralph. Follow the executing-plans skill, ralph strategy.]" }`. This is appended, never replaced, and only when a persistence mode is active.

**Events used:** `input` (keyword detection), `tool_call` (delegation audit), `before_agent_start` (mode reminders via systemPrompt append)

**tool_call handler ordering:** Only the orchestrator extension registers a `tool_call` handler (for delegation audit on write/edit tools). The model-router is a utility module, not a lifecycle extension, so there is no handler conflict. Pi calls `tool_call` handlers in extension load order as declared in `package.json`'s `pi.extensions` array.

**Error handling:** If the `input` event handler fails (e.g., malformed regex), it returns `{ action: "continue" }` to pass through unchanged. If delegation audit cannot write to the log file, it silently skips logging. No extension failure should block the user's workflow.

### Extension summary

| File | Type | Events | Tools Registered | State Files |
|---|---|---|---|---|
| `state-manager.ts` | registered extension | `session_start` | `state` (CRUD) | `.pi/state/*.json` |
| `model-router-utils.ts` | utility module | none (imported by subagent.ts) | none | reads `.pi/superpowers.json` |
| `persistence-engine.ts` | registered extension | `agent_end`, `session_start`, `session_shutdown` | none | reads/writes `.pi/state/*-state.json` |
| `orchestrator.ts` | registered extension | `input`, `tool_call`, `before_agent_start` | none | writes `.pi/state/delegation-audit.jsonl` |

---

## 3. New Agents

7 new agent roles added to the existing 7, for 14 total. Each has a `tier` field in frontmatter that the model-router-utils module uses for default tier resolution.

**Note on tool lists:** Agent frontmatter uses Pi's actual tool names (e.g., `tools: read, grep, find, ls, bash`). "Read-only" annotations below are enforced via the agent's system prompt instructions, not via a restricted tool variant. The agent receives full `bash` access but is instructed to use it only for read operations (running tests, checking builds, reading output). This matches existing agents like `scout`, `code-reviewer`, and `bug-hunter`.

### architect.md

**Default tier:** `reasoning`
**Tools:** read, grep, find, ls, bash

Two modes:
1. **Plan review mode** — Evaluates implementation plans for feasibility, missing edge cases, dependency ordering, and architectural risks. Returns structured assessment with approved/concerns/rejected verdict.
2. **Verification mode** — Verifies completion claims against actual evidence. Reads test output, checks build results, traces code changes. Returns verdict with evidence citations. Flags weak claims ("should work", "probably fine") as insufficient.

### critic.md

**Default tier:** `reasoning`
**Tools:** read, grep, find, ls

Challenges assumptions in plans and designs. Used in the ralplan consensus loop (planner -> architect -> critic). Must provide a steelman antithesis before approving. Returns structured feedback: strengths, weaknesses, alternative approaches, verdict (approve/revise).

### designer.md

**Default tier:** `standard`
**Tools:** read, grep, find, ls, bash

Implements frontend components, styling, layouts, and UI logic. Understands responsive design, accessibility (WCAG), component architecture (React, Vue, Svelte patterns). Returns working code with visual structure notes.

### writer.md

**Default tier:** `fast`
**Tools:** read, grep, find, ls

Generates README files, API docs, inline comments, changelogs, and migration guides. Reads existing code and docs to match project style. Focuses on accuracy — never invents API details, always cites source code.

### researcher.md

**Default tier:** `standard`
**Tools:** read, grep, find, ls, bash

Looks up official documentation, API references, and usage examples for external libraries and frameworks before the team writes code. Supports doc-first development. Returns structured findings with source URLs and code examples.

### scientist.md

**Default tier:** `standard`
**Tools:** read, grep, find, ls, bash

Analyzes data, runs experiments, tests hypotheses. Can execute scripts to process data, generate statistics, and validate assumptions. Returns findings with methodology, data, and conclusions.

### vision.md

**Default tier:** `standard`
**Tools:** read, grep, find, ls

Analyzes screenshots, mockups, diagrams, and other visual content. Describes what it sees, identifies UI issues, compares implementations against designs. Returns structured observations with specific coordinates/regions referenced.

### Full agent roster (14)

| Agent | Default Tier | Role | Status |
|---|---|---|---|
| scout | fast | Codebase recon | existing |
| planner | standard | Implementation planning | existing |
| worker | standard | Task execution | existing |
| code-reviewer | standard | Code quality & compliance | existing |
| bug-hunter | reasoning | Deep bug analysis | existing |
| security-reviewer | reasoning | Security audit | existing |
| issue-validator | reasoning | Issue verification | existing |
| architect | reasoning | Plan review & completion verification | **new** |
| critic | reasoning | Quality challenger | **new** |
| designer | standard | UI/frontend | **new** |
| writer | fast | Documentation | **new** |
| researcher | standard | External doc lookup | **new** |
| scientist | standard | Data analysis | **new** |
| vision | standard | Visual analysis | **new** |

---

## 4. Enhanced Existing Skills

### using-superpowers

- Add magic keyword reference (ralph, autopilot, ecomode, cancel, ralplan, parallel)
- Add new agent roles and when to use each
- Replace model-specific references with tier references ("dispatch scout at fast tier")
- Add auto-detection hints (UI work -> designer, stuck -> systematic-debugging)

### brainstorming

- After user approves design, offer: "Standard plan or consensus plan (planner -> architect -> critic review loop)?"
- If consensus chosen, invoke the `ralplan` skill instead of `writing-plans`

### writing-plans

- Add tier annotations on each step (so model-router knows what tier to use)
- Add story/acceptance-criteria structure (so ralph strategy can track per-story progress)
- Add verification tier recommendation per task (light/standard/thorough)

### executing-plans (major enhancement)

Becomes the unified execution engine with 4 strategies:

**Strategy 1: Sequential (current default)**
- Execute tasks one by one in order
- Verify each before moving to next
- Best for: dependent tasks, small plans

**Strategy 2: Parallel (ultrawork)**
- Analyze plan tasks for independence
- Dispatch independent tasks in parallel via subagent parallel mode
- Sequential tasks still run in order
- Activated via `--parallel` flag or "parallel" keyword
- Best for: plans with many independent tasks

**Strategy 3: Autopilot**
- Wraps the plan in a persistence loop (activates persistence engine via state tool)
- Phases: Execute (parallel within each iteration) -> QA (run tests, fix failures) -> Validate (architect verification)
- Keeps iterating until all tasks pass verification
- Activated via `--autopilot` flag or "autopilot" keyword
- Best for: large plans where you want hands-off execution

**Strategy 4: Ralph (story-driven)**
- Accepts PRD files with user stories and acceptance criteria
- Story-by-story execution: pick story -> implement -> verify against criteria -> mark done
- Activates persistence engine
- Architect verification per story
- Progress tracking in `.pi/state/progress.md`
- Activated via `--ralph` flag or "ralph" keyword
- Best for: PRD-driven development without a pre-written plan

### subagent-driven-development

- Smart tier dispatch: use explicit `tier` parameter when dispatching workers
- Architect verification after each task (replaces self-review for completion claims)
- Parallel dispatch guidance aligned with ultrawork patterns

### verification-before-completion (rewrite)

Tiered verification based on change complexity:
- **Light** (<5 files, <100 lines, full tests) -> architect at fast tier
- **Standard** (default) -> architect at standard tier
- **Thorough** (>20 files, security, architectural changes) -> architect at reasoning tier

Evidence requirements per tier:
- Light: build passes, diagnostics clean
- Standard: build passes + test suite passes
- Thorough: full review + all tests + security check

### dispatching-parallel-agents

- Independence analysis before dispatch
- Background vs. foreground guidance
- Concurrency limits and batching (existing max 8/4 concurrent)

---

## 5. New Skills

### plan

Unified planning entry point with mode detection.

- Detects broad vs. specific requests
- Broad requests (vague verbs, no specific files, 3+ areas) -> interview mode: one question at a time, uses scout for codebase facts before asking the user
- Specific requests (file paths, function names, clear deliverable) -> direct plan generation via writing-plans
- Option to escalate to ralplan consensus
- Saves plans to `docs/plans/`

### ralplan

Consensus planning with adversarial review loop.

1. Planner creates initial plan
2. Architect reviews for feasibility (must provide concerns or approve)
3. Critic evaluates quality (must steelman an alternative before approving)
4. Loop until critic approves (max 5 iterations, then surface to human)
5. Produces plan + architecture decision record (ADR)
6. Can be invoked from brainstorming or directly

### ecomode

Token-efficient modifier (not a standalone execution strategy).

- Shifts default tier preferences down: reasoning -> standard, standard -> fast
- Not a standalone mode — modifies how other strategies route models
- Activated via keyword or config, stored in state via `state write ecomode { active: true }`
- **Integration with model-router-utils:** The subagent extension, before calling `resolveModel()`, reads `.pi/state/ecomode-state.json` (via the state-manager's file API or direct fs read) and passes `ecomodeActive: true` to `resolveModel()`. The router then shifts the resolved tier down one level before mapping to a model ID. This check happens on every subagent dispatch, so ecomode can be toggled mid-session

### cancel

Unified cancellation system.

- Reads `.pi/state/` to detect active modes (autopilot, ralph, persistence)
- Clears mode state files in dependency order
- Writes cancel signal for persistence engine to pick up
- Reports what was cancelled and how to resume (if applicable)

---

## 6. New Prompts

| Command | Skill Invoked | Description |
|---|---|---|
| `/plan` | plan | Start a planning session (interview or direct) |
| `/ralplan` | ralplan | Consensus planning with planner -> architect -> critic loop |
| `/cancel` | cancel | Cancel active execution mode |
| `/ecomode` | ecomode | Toggle token-efficient model routing |

Updated existing prompts:
- `/execute-plan` gains `--parallel`, `--autopilot`, `--ralph` flags

---

## 7. Feature-Driven Phases

Each phase ships a complete, independently usable feature.

### Phase 1: Foundation — Unified Config + Model Router + Tier System

**Delivers:** Smart model routing that works with all existing skills today.

**New/modified files:**
- Create: `extensions/model-router-utils.ts` (shared utility module)
- Create: config schema documentation
- Modify: `extensions/subagent.ts` (add `tier` parameter)
- Modify: all agent frontmatter (add `tier:` field)
- Modify: all skill files (replace model names with tier references)
- Tests: config loading, tier resolution, backward compat with `.pi/code-review.json`

### Phase 2: New Agents + State Management

**Delivers:** 7 new agent roles + state infrastructure.

**New/modified files:**
- Create: `agents/architect.md`, `agents/critic.md`, `agents/designer.md`, `agents/writer.md`, `agents/researcher.md`, `agents/scientist.md`, `agents/vision.md`
- Create: `extensions/state-manager.ts`
- Modify: `tests/agents.test.ts` (7 -> 14 agents)
- Tests: all agent frontmatter + state operations

### Phase 3: Verification Tiers + Architect Integration

**Delivers:** Scaled verification replacing self-verification across all skills.

**New/modified files:**
- Modify: `skills/verification-before-completion/SKILL.md` (rewrite with tiers)
- Modify: `skills/subagent-driven-development/SKILL.md` (architect integration)
- Modify: `skills/executing-plans/SKILL.md` (architect integration)
- Tests: tier selection logic

### Phase 4: Enhanced Planning — Plan Skill + Ralplan Consensus

**Delivers:** Unified planning entry point with optional consensus loop.

**New/modified files:**
- Create: `skills/plan/SKILL.md`
- Create: `skills/ralplan/SKILL.md`
- Create: `prompts/plan.md`, `prompts/ralplan.md`
- Modify: `skills/brainstorming/SKILL.md` (ralplan option)
- Modify: `skills/writing-plans/SKILL.md` (tier annotations, story structure)
- Tests: skill count, frontmatter validation

### Phase 5: Execution Strategies — Parallel + Autopilot + Ralph

**Delivers:** executing-plans becomes a multi-strategy execution engine.

**New/modified files:**
- Create: `extensions/persistence-engine.ts`
- Create: `skills/cancel/SKILL.md`
- Create: `prompts/cancel.md`
- Modify: `skills/executing-plans/SKILL.md` (4 strategies)
- Modify: `skills/dispatching-parallel-agents/SKILL.md` (ultrawork patterns)
- Modify: `prompts/execute-plan.md` (strategy flags)
- Tests: persistence, strategy selection, cancellation

### Phase 6: Orchestration — Keyword Detection + Delegation + Ecomode

**Delivers:** Automatic mode activation and delegation auditing.

**New/modified files:**
- Create: `extensions/orchestrator.ts`
- Create: `skills/ecomode/SKILL.md`
- Create: `prompts/ecomode.md`
- Modify: `skills/using-superpowers/SKILL.md` (full feature docs)
- Modify: `README.md` (new counts, features, config docs)
- Modify: `package.json` (version bump)
- Tests: full suite

### Phase summary

| Phase | Key Deliverable | New Files | Dependencies |
|---|---|---|---|
| 1 | Smart routing + config | 1 utility module, config docs | None |
| 2 | New agents + state | 7 agents, 1 extension | Phase 1 |
| 3 | Verification tiers | Enhanced skills | Phase 2 |
| 4 | Planning workflows | 2 skills, 2 prompts | Phase 2 |
| 5 | Execution strategies | 1 extension, 1 skill, 1 prompt | Phase 3 + Phase 4 |
| 6 | Orchestration glue | 1 extension, 1 skill, 1 prompt, docs | Phase 5 |

**Note:** Phases 3 and 4 are independent of each other (both depend only on Phase 2) and can be executed in parallel. Phase 5 depends on both because: the autopilot strategy uses architect verification (Phase 3) and the ralph strategy needs writing-plans enhancements for story structure (Phase 4).

---

## Totals

| Category | Before | After | Delta |
|---|---|---|---|
| Registered extensions | 2 | 5 | +3 (state-manager, persistence-engine, orchestrator) |
| Utility modules | 3 | 4 | +1 (model-router-utils) |
| Agents | 7 | 14 | +7 |
| Skills | 16 | 20 | +4 (plan, ralplan, ecomode, cancel) |
| Prompts | 5 | 9 | +4 (/plan, /ralplan, /cancel, /ecomode) |
| Enhanced skills | — | 7 | using-superpowers, brainstorming, writing-plans, executing-plans, subagent-driven-development, verification-before-completion, dispatching-parallel-agents |

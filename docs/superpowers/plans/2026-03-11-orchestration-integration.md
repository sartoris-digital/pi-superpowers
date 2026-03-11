# Orchestration Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate advanced orchestration features (smart model routing, persistence loops, execution strategies, verification tiers, planning workflows, delegation enforcement) into pi-superpowers, merging with existing agents and skills.

**Architecture:** 3 new registered extensions + 1 utility module handle infrastructure. 7 new agents expand the roster to 14. 4 new skills + 7 enhanced existing skills handle workflows. Unified `.pi/superpowers.json` config replaces per-feature configs.

**Tech Stack:** TypeScript (ES2022, NodeNext), Pi ExtensionAPI, Vitest, @sinclair/typebox for schemas.

**Spec:** `docs/superpowers/specs/2026-03-11-orchestration-integration-design.md`

---

## Chunk 1: Phase 1 — Foundation (Unified Config + Model Router + Tier System)

### Task 1: Add `tier` field to AgentConfig and agent discovery

**Files:**
- Modify: `extensions/agents.ts`
- Modify: `tests/agents.test.ts`

- [ ] **Step 1: Add `tier` to AgentConfig interface**

In `extensions/agents.ts`, add `tier` to the interface:

```typescript
export interface AgentConfig {
  name: string;
  description: string;
  tools?: string[];
  model?: string;
  tier?: string;  // NEW: "fast" | "standard" | "reasoning"
  systemPrompt: string;
  source: "user" | "project" | "bundled";
  filePath: string;
}
```

- [ ] **Step 2: Parse `tier` from frontmatter**

In the `loadAgentsFromDir` function, where agents are pushed to the array, add `tier` extraction:

```typescript
agents.push({
  name: frontmatter.name,
  description: frontmatter.description,
  tools: tools && tools.length > 0 ? tools : undefined,
  model: frontmatter.model || undefined,
  tier: frontmatter.tier || undefined,  // NEW
  systemPrompt: body.trim(),
  source,
  filePath,
});
```

- [ ] **Step 3: Add test for tier parsing**

In `tests/agents.test.ts`, add a test within the `loadAgentsFromDir` describe block:

```typescript
it("parses tier from frontmatter", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agents-tier-"));
  fs.writeFileSync(
    path.join(dir, "test-agent.md"),
    "---\nname: test-agent\ndescription: Test\ntier: fast\n---\nPrompt",
  );
  const agents = await loadAgentsFromDir(dir, "project");
  expect(agents[0].tier).toBe("fast");
  fs.rmSync(dir, { recursive: true });
});

it("returns undefined tier when not specified", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agents-notier-"));
  fs.writeFileSync(
    path.join(dir, "test-agent.md"),
    "---\nname: test-agent\ndescription: Test\n---\nPrompt",
  );
  const agents = await loadAgentsFromDir(dir, "project");
  expect(agents[0].tier).toBeUndefined();
  fs.rmSync(dir, { recursive: true });
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/agents.test.ts`
Expected: All tests pass including new tier tests.

- [ ] **Step 5: Commit**

```bash
git add extensions/agents.ts tests/agents.test.ts
git commit -m "feat: add tier field to AgentConfig and agent discovery"
```

---

### Task 2: Add `tier` field to all existing agent frontmatter

**Files:**
- Modify: `agents/scout.md`
- Modify: `agents/planner.md`
- Modify: `agents/worker.md`
- Modify: `agents/code-reviewer.md`
- Modify: `agents/bug-hunter.md`
- Modify: `agents/security-reviewer.md`
- Modify: `agents/issue-validator.md`

- [ ] **Step 1: Add tier to each agent's frontmatter**

Add the `tier:` field after the `model:` field in each agent file:

| Agent | Tier |
|-------|------|
| `scout.md` | `tier: fast` |
| `planner.md` | `tier: standard` |
| `worker.md` | `tier: standard` |
| `code-reviewer.md` | `tier: standard` |
| `bug-hunter.md` | `tier: reasoning` |
| `security-reviewer.md` | `tier: reasoning` |
| `issue-validator.md` | `tier: reasoning` |

Example for `agents/scout.md`, change frontmatter from:
```yaml
---
name: scout
description: Fast codebase recon that returns compressed context for handoff to other agents
tools: read, grep, find, ls, bash
model: claude-haiku-4-5
---
```

To:
```yaml
---
name: scout
description: Fast codebase recon that returns compressed context for handoff to other agents
tools: read, grep, find, ls, bash
model: claude-haiku-4-5
tier: fast
---
```

Repeat for all 7 agents with the tier values from the table above.

- [ ] **Step 2: Run agent tests to verify frontmatter still valid**

Run: `npx vitest run tests/agents.test.ts`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add agents/
git commit -m "feat: add tier field to all existing agent frontmatter"
```

---

### Task 3: Create model-router-utils module

**Files:**
- Create: `extensions/model-router-utils.ts`
- Create: `tests/model-router.test.ts`

- [ ] **Step 1: Write the test file**

Create `tests/model-router.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  loadRouterConfig,
  resolveModel,
  extractTierFromSignals,
  DEFAULT_CONFIG,
} from "../extensions/model-router-utils.js";
import type { AgentConfig } from "../extensions/agents.js";

function makeAgent(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    name: "worker",
    description: "Test agent",
    systemPrompt: "You are a test agent.",
    source: "bundled",
    filePath: "/test/worker.md",
    ...overrides,
  };
}

describe("loadRouterConfig", () => {
  it("returns default config when no files exist", () => {
    const config = loadRouterConfig("/nonexistent/path");
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("loads .pi/superpowers.json when it exists", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "router-"));
    const piDir = path.join(dir, ".pi");
    fs.mkdirSync(piDir, { recursive: true });
    fs.writeFileSync(
      path.join(piDir, "superpowers.json"),
      JSON.stringify({
        models: { fast: "gpt-4.1-mini", standard: "gpt-4.1", reasoning: "gpt-4.1" },
      }),
    );
    const config = loadRouterConfig(dir);
    expect(config.models.fast).toBe("gpt-4.1-mini");
    fs.rmSync(dir, { recursive: true });
  });

  it("falls back to .pi/code-review.json", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "router-fallback-"));
    const piDir = path.join(dir, ".pi");
    fs.mkdirSync(piDir, { recursive: true });
    fs.writeFileSync(
      path.join(piDir, "code-review.json"),
      JSON.stringify({
        models: { fast: "gemini-flash", standard: "gemini-pro", reasoning: "gemini-pro" },
      }),
    );
    const config = loadRouterConfig(dir);
    expect(config.models.fast).toBe("gemini-flash");
    fs.rmSync(dir, { recursive: true });
  });

  it("prefers superpowers.json over code-review.json", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "router-prefer-"));
    const piDir = path.join(dir, ".pi");
    fs.mkdirSync(piDir, { recursive: true });
    fs.writeFileSync(
      path.join(piDir, "superpowers.json"),
      JSON.stringify({ models: { fast: "super-fast", standard: "super-std", reasoning: "super-reason" } }),
    );
    fs.writeFileSync(
      path.join(piDir, "code-review.json"),
      JSON.stringify({ models: { fast: "cr-fast", standard: "cr-std", reasoning: "cr-reason" } }),
    );
    const config = loadRouterConfig(dir);
    expect(config.models.fast).toBe("super-fast");
    fs.rmSync(dir, { recursive: true });
  });
});

describe("extractTierFromSignals", () => {
  it("returns fast for lookup keywords", () => {
    expect(extractTierFromSignals("find all files matching *.ts")).toBe("fast");
    expect(extractTierFromSignals("list the test files")).toBe("fast");
    expect(extractTierFromSignals("check if the config exists")).toBe("fast");
  });

  it("returns reasoning for complex keywords", () => {
    expect(extractTierFromSignals("debug the race condition in auth")).toBe("reasoning");
    expect(extractTierFromSignals("security audit of the payment module")).toBe("reasoning");
    expect(extractTierFromSignals("why does this function fail with null?")).toBe("reasoning");
  });

  it("returns standard for general tasks", () => {
    expect(extractTierFromSignals("implement the user profile page")).toBe("standard");
    expect(extractTierFromSignals("add error handling to the API endpoint")).toBe("standard");
  });
});

describe("resolveModel", () => {
  const config = DEFAULT_CONFIG;

  it("uses agent model when source is project (project agent override)", () => {
    const agent = makeAgent({ model: "custom-model", source: "project" });
    expect(resolveModel("worker", agent, config)).toBe("custom-model");
  });

  it("maps agent tier to config model when no overrides apply", () => {
    const agent = makeAgent({ tier: "fast", source: "bundled" });
    expect(resolveModel("worker", agent, config)).toBe("claude-haiku-4-5"); // config.models.fast
  });

  it("uses explicit tier parameter over agent default", () => {
    const agent = makeAgent({ tier: "standard", model: "claude-sonnet-4-6", source: "bundled" });
    const result = resolveModel("worker", agent, config, { explicitTier: "reasoning" });
    expect(result).toBe("claude-opus-4-6");
  });

  it("uses config agentTierOverrides", () => {
    const configWithOverrides = {
      ...DEFAULT_CONFIG,
      routing: {
        ...DEFAULT_CONFIG.routing,
        agentTierOverrides: { worker: "reasoning" },
      },
    };
    const agent = makeAgent({ tier: "standard", source: "bundled" });
    expect(resolveModel("worker", agent, configWithOverrides)).toBe("claude-opus-4-6");
  });

  it("shifts tier down when ecomode is active", () => {
    const agent = makeAgent({ tier: "reasoning", source: "bundled" });
    const result = resolveModel("worker", agent, config, { ecomodeActive: true });
    expect(result).toBe("claude-sonnet-4-6"); // reasoning -> standard
  });

  it("does not shift fast tier below fast in ecomode", () => {
    const agent = makeAgent({ tier: "fast", source: "bundled" });
    const result = resolveModel("worker", agent, config, { ecomodeActive: true });
    expect(result).toBe("claude-haiku-4-5"); // fast stays fast
  });

  it("auto-routes based on task prompt when no tier specified", () => {
    const agent = makeAgent({ source: "bundled" });
    const result = resolveModel("worker", agent, config, {
      taskPrompt: "debug the authentication race condition",
    });
    expect(result).toBe("claude-opus-4-6"); // reasoning signals
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/model-router.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement model-router-utils.ts**

Create `extensions/model-router-utils.ts`:

```typescript
import * as fs from "node:fs";
import * as path from "node:path";

export interface RouterConfig {
  models: {
    fast: string;
    standard: string;
    reasoning: string;
  };
  routing: {
    enabled: boolean;
    defaultTier: string;
    agentTierOverrides: Record<string, string>;
  };
  persistence: {
    maxIterations: number;
    staleTimeout: number;
  };
  delegation: {
    audit: boolean;
    enforce: boolean;
  };
}

export const DEFAULT_CONFIG: RouterConfig = {
  models: {
    fast: "claude-haiku-4-5",
    standard: "claude-sonnet-4-6",
    reasoning: "claude-opus-4-6",
  },
  routing: {
    enabled: true,
    defaultTier: "standard",
    agentTierOverrides: {},
  },
  persistence: {
    maxIterations: 50,
    staleTimeout: 14400,
  },
  delegation: {
    audit: true,
    enforce: false,
  },
};

const FAST_KEYWORDS = /\b(find|list|check|count|search|look\s+up|locate|show)\b/i;
const REASONING_KEYWORDS =
  /\b(debug|security|architect|race\s+condition|refactor\s+architecture|vulnerability|exploit|why\s+does|why\s+is|root\s+cause)\b/i;

/**
 * Load router config with fallback chain:
 * .pi/superpowers.json -> .pi/code-review.json -> DEFAULT_CONFIG
 */
export function loadRouterConfig(projectDir?: string): RouterConfig {
  if (!projectDir) return DEFAULT_CONFIG;

  const superpowersPath = path.join(projectDir, ".pi", "superpowers.json");
  const codeReviewPath = path.join(projectDir, ".pi", "code-review.json");

  let rawConfig: Record<string, unknown> | undefined;

  if (fs.existsSync(superpowersPath)) {
    try {
      rawConfig = JSON.parse(fs.readFileSync(superpowersPath, "utf-8"));
    } catch {
      // malformed JSON, fall through
    }
  }

  if (!rawConfig && fs.existsSync(codeReviewPath)) {
    try {
      rawConfig = JSON.parse(fs.readFileSync(codeReviewPath, "utf-8"));
    } catch {
      // malformed JSON, fall through
    }
  }

  if (!rawConfig) return DEFAULT_CONFIG;

  return {
    models: {
      fast: (rawConfig.models as Record<string, string>)?.fast ?? DEFAULT_CONFIG.models.fast,
      standard: (rawConfig.models as Record<string, string>)?.standard ?? DEFAULT_CONFIG.models.standard,
      reasoning: (rawConfig.models as Record<string, string>)?.reasoning ?? DEFAULT_CONFIG.models.reasoning,
    },
    routing: {
      enabled: (rawConfig.routing as Record<string, unknown>)?.enabled !== false,
      defaultTier: ((rawConfig.routing as Record<string, string>)?.defaultTier as string) ?? DEFAULT_CONFIG.routing.defaultTier,
      agentTierOverrides: ((rawConfig.routing as Record<string, Record<string, string>>)?.agentTierOverrides as Record<string, string>) ?? {},
    },
    persistence: {
      maxIterations: ((rawConfig.persistence as Record<string, number>)?.maxIterations as number) ?? DEFAULT_CONFIG.persistence.maxIterations,
      staleTimeout: ((rawConfig.persistence as Record<string, number>)?.staleTimeout as number) ?? DEFAULT_CONFIG.persistence.staleTimeout,
    },
    delegation: {
      audit: (rawConfig.delegation as Record<string, boolean>)?.audit !== false,
      enforce: (rawConfig.delegation as Record<string, boolean>)?.enforce === true,
    },
  };
}

/**
 * Extract complexity tier from task prompt text using keyword signals.
 */
export function extractTierFromSignals(taskPrompt: string): "fast" | "standard" | "reasoning" {
  if (REASONING_KEYWORDS.test(taskPrompt)) return "reasoning";
  if (FAST_KEYWORDS.test(taskPrompt)) return "fast";
  return "standard";
}

/**
 * Resolve the model ID for a given agent dispatch.
 *
 * Priority:
 * 1. Project agent override (source === "project" with explicit model) -> use that
 * 2. Explicit tier parameter from subagent call -> use that (call-site intent wins)
 * 3. Config agentTierOverrides for this agent -> use that tier
 * 4. Agent's default tier from frontmatter -> use that
 * 5. Auto-extract tier from task prompt signals
 * 6. Fall back to config defaultTier
 *
 * After resolving tier, apply ecomode shift if active.
 * Finally, map tier to model via config.models.
 */
export function resolveModel(
  agentName: string,
  agent: { model?: string; tier?: string; source: string },
  config: RouterConfig,
  options?: {
    explicitTier?: string;
    taskPrompt?: string;
    ecomodeActive?: boolean;
  },
): string {
  // 1. Project agent override wins unconditionally
  if (agent.source === "project" && agent.model) {
    return agent.model;
  }

  if (!config.routing.enabled) {
    return agent.model ?? config.models[config.routing.defaultTier as keyof typeof config.models] ?? config.models.standard;
  }

  // 2. Resolve tier (call-site explicitTier wins over config agentTierOverrides)
  let tier: string;

  if (options?.explicitTier) {
    // Explicit tier from subagent call — call-site intent always wins
    tier = options.explicitTier;
  } else if (config.routing.agentTierOverrides[agentName]) {
    // Config override for this specific agent
    tier = config.routing.agentTierOverrides[agentName];
  } else if (agent.tier) {
    // Agent's default tier from frontmatter
    tier = agent.tier;
  } else if (options?.taskPrompt) {
    // Auto-extract from prompt signals
    tier = extractTierFromSignals(options.taskPrompt);
  } else {
    tier = config.routing.defaultTier;
  }

  // 3. Ecomode shift
  if (options?.ecomodeActive) {
    if (tier === "reasoning") tier = "standard";
    else if (tier === "standard") tier = "fast";
    // fast stays fast
  }

  // 4. Map tier to model
  const model = config.models[tier as keyof typeof config.models];
  return model ?? agent.model ?? config.models.standard;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/model-router.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add extensions/model-router-utils.ts tests/model-router.test.ts
git commit -m "feat: add model-router-utils with config loading and tier resolution"
```

---

### Task 4: Add `tier` parameter to subagent tool and integrate model routing

**Files:**
- Modify: `extensions/subagent.ts`
- Modify: `extensions/subagent-utils.ts`
- Modify: `tests/subagent-utils.test.ts`

- [ ] **Step 1: Add tier to buildAgentArgs**

In `extensions/subagent-utils.ts`, update the `buildAgentArgs` function signature and implementation. The function currently accepts `{ model, tools }`. Change it to accept the resolved model (the caller will handle resolution):

No changes needed to `buildAgentArgs` itself — it already accepts `model: string | undefined` and passes it through. The tier resolution happens BEFORE calling `buildAgentArgs`.

- [ ] **Step 2: Add tier to subagent ParamsSchema**

In `extensions/subagent.ts`, add `tier` to `AgentTask` and the top-level `ParamsSchema`.

Find the `AgentTask` type definition and add tier:
```typescript
const AgentTask = Type.Object({
  agent: Type.String({ description: "Agent name" }),
  task: Type.String({ description: "Task description" }),
  tier: Type.Optional(
    Type.String({
      description: 'Model tier override: "fast", "standard", or "reasoning". If omitted, uses agent default or auto-routes based on task complexity.',
    }),
  ),
});
```

Add `tier` to the top-level ParamsSchema (for single mode). Preserve all existing fields and descriptions — only add the new `tier` field:
```typescript
// In the existing ParamsSchema Type.Object, add this field alongside agent/task/tasks/chain:
tier: Type.Optional(
  Type.String({
    description: 'Model tier override for single mode: "fast", "standard", or "reasoning".',
  }),
),
// Keep all existing fields (agent, task, tasks, chain) and their descriptions unchanged.
```

- [ ] **Step 3: Import and use model-router-utils in subagent.ts**

At the top of `extensions/subagent.ts`, add:
```typescript
import { loadRouterConfig, resolveModel } from "./model-router-utils.js";
```

In the tool's `execute` function, after `discoverAgentsWithProjectDir()`, load the config. Note: `path` is already imported in `subagent.ts`, and `projectAgentsDir` is available from the existing `discoverAgentsWithProjectDir()` call which returns `{ agents, projectAgentsDir }`:
```typescript
const routerConfig = loadRouterConfig(projectAgentsDir ? path.dirname(projectAgentsDir) : undefined);
```

- [ ] **Step 4: Update runSingleAgent to use resolveModel**

In the `runSingleAgent` function, change the model resolution from:
```typescript
const args = buildAgentArgs({ model: agent.model, tools: agent.tools });
```

To:
```typescript
const resolvedModel = resolveModel(agent.name, agent, routerConfig, {
  explicitTier: tier,
  taskPrompt: task,
});
const args = buildAgentArgs({ model: resolvedModel, tools: agent.tools });
```

This requires passing `routerConfig` and `tier` into `runSingleAgent`. Update its signature to accept these additional parameters.

- [ ] **Step 5: Thread tier through all three dispatch modes**

**Single mode:** Extract `params.tier` and pass to `runSingleAgent`.

**Parallel mode:** Each task in `params.tasks` has its own `tier` field. Pass `t.tier` to `runSingleAgent` for each task.

**Chain mode:** Each step in `params.chain` has its own `tier` field. Pass `step.tier` to `runSingleAgent` for each step.

- [ ] **Step 6: Update subagent-utils tests**

In `tests/subagent-utils.test.ts`, the existing `buildAgentArgs` tests should still pass since the function signature hasn't changed. Verify:

Run: `npx vitest run tests/subagent-utils.test.ts`
Expected: All existing tests pass.

- [ ] **Step 7: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add extensions/subagent.ts extensions/subagent-utils.ts tests/subagent-utils.test.ts
git commit -m "feat: integrate model routing into subagent tool with tier parameter"
```

---

### Task 5: Update code-review and security-review skills to use tier references

**Files:**
- Modify: `skills/code-review/SKILL.md`
- Modify: `skills/code-review/model-config.md`
- Modify: `skills/security-review/SKILL.md`

- [ ] **Step 1: Update code-review SKILL.md**

Replace model-specific references with tier references throughout the file:
- "scout (haiku)" → "scout (fast tier)"
- "code-reviewer (sonnet)" → "code-reviewer (standard tier)"
- "bug-hunter (opus)" → "bug-hunter (reasoning tier)"
- "issue-validator (opus)" → "issue-validator (reasoning tier)"

In subagent dispatch examples, add `tier` parameter:
```
subagent({
  agent: "scout",
  task: "...",
  tier: "fast"
})
```

Update the Tier mapping table to reference `superpowers.json`:
```markdown
**Tier mapping (configured in `.pi/superpowers.json`):**

| Tier | Default Model | Agents | Pipeline Steps |
|------|--------------|--------|----------------|
| `fast` | claude-haiku-4-5 | scout | Steps 1, 2 |
| `standard` | claude-sonnet-4-6 | code-reviewer | Steps 3, 4a-b |
| `reasoning` | claude-opus-4-6 | bug-hunter, issue-validator | Steps 4c-d, 5 |
```

- [ ] **Step 2: Update model-config.md**

Add a note at the top referencing the new unified config:

```markdown
> **Unified config:** Model overrides now use `.pi/superpowers.json` (applies to ALL agent dispatch, not just code review). The `.pi/code-review.json` format is still supported as a fallback. See below for details.
```

- [ ] **Step 3: Update security-review SKILL.md**

Same pattern as code-review — replace model names with tier references:
- "scout (haiku)" → "scout (fast tier)"
- "security-reviewer (opus)" → "security-reviewer (reasoning tier)"
- "issue-validator (opus)" → "issue-validator (reasoning tier)"

Add `tier` parameter to dispatch examples.

Update the Model Configuration table to reference the unified config.

- [ ] **Step 4: Run skills tests to verify frontmatter intact**

Run: `npx vitest run tests/skills.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add skills/code-review/ skills/security-review/
git commit -m "feat: update code-review and security-review skills to use tier references"
```

---

### Task 6: Update subagent-driven-development and dispatching-parallel-agents to use tier references

**Files:**
- Modify: `skills/subagent-driven-development/SKILL.md`
- Modify: `skills/dispatching-parallel-agents/SKILL.md`

- [ ] **Step 1: Update subagent-driven-development SKILL.md**

Replace the "Model Selection Strategy" section to reference tiers:
```markdown
**Model Selection via Tiers:**
- Mechanical tasks (1-2 files, clear spec) → `tier: "fast"`
- Integration tasks (multi-file, pattern matching) → `tier: "standard"`
- Architecture/design/review → `tier: "reasoning"`
```

Update dispatch examples to include `tier` parameter.

- [ ] **Step 2: Update dispatching-parallel-agents SKILL.md**

Update Pi Platform Implementation examples to include `tier`:
```typescript
subagent({
  tasks: [
    { agent: "worker", task: "Fix task 1", tier: "standard" },
    { agent: "worker", task: "Fix task 2", tier: "standard" },
    { agent: "worker", task: "Fix task 3", tier: "standard" }
  ]
})
```

- [ ] **Step 3: Run skills tests**

Run: `npx vitest run tests/skills.test.ts`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add skills/subagent-driven-development/ skills/dispatching-parallel-agents/
git commit -m "feat: update subagent-driven-development and dispatching-parallel-agents to use tiers"
```

---

### Task 7: Phase 1 integration verification

**Files:** (no new changes — verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (agents, skills, subagent-utils, bootstrap-utils, model-router).

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Verify clean state**

Run: `git status`
Expected: No uncommitted changes (all work from Tasks 1-6 is committed). If any unstaged changes remain, stage and commit them now with an appropriate message.

---

## Chunk 2: Phase 2 — New Agents + State Management

### Task 8: Create architect agent

**Files:**
- Create: `agents/architect.md`

- [ ] **Step 1: Create the agent file**

Create `agents/architect.md`:

```markdown
---
name: architect
description: Reviews implementation plans for feasibility and verifies task completion with evidence
tools: read, grep, find, ls, bash
model: claude-opus-4-6
tier: reasoning
---

# Architect

You review plans and verify completion claims. You operate in two modes.

## Mode 1: Plan Review

When the task contains "MODE: plan-review", evaluate the implementation plan for:

1. **Feasibility** — Can each step actually be implemented as described?
2. **Completeness** — Are there missing edge cases, error handling, or integration steps?
3. **Ordering** — Are dependencies between tasks correctly sequenced?
4. **Risk** — What could go wrong? Are there architectural risks?

Return a structured JSON assessment:
```json
{
  "verdict": "approved" | "concerns" | "rejected",
  "feasibility": { "score": 1-5, "issues": [] },
  "completeness": { "score": 1-5, "gaps": [] },
  "ordering": { "score": 1-5, "issues": [] },
  "risks": [],
  "summary": "1-2 sentence overall assessment"
}
```

If you have concerns, be specific about what needs to change. Do not reject plans for style preferences — only for correctness issues.

## Mode 2: Verification

When the task contains "MODE: verification", verify that the claimed work is actually complete.

1. **Read the evidence** — test output, build logs, file changes
2. **Check claims** — does the evidence support the claim?
3. **Run checks** — if needed, run tests or build commands yourself
4. **Flag weak claims** — "should work", "probably fine", "looks good" are NOT evidence

Return a structured JSON verdict:
```json
{
  "verdict": "verified" | "insufficient" | "failed",
  "evidence": [
    { "claim": "Tests pass", "evidence": "npx vitest run output shows 87/87 passing", "status": "confirmed" }
  ],
  "missing": [],
  "summary": "1-2 sentence assessment"
}
```

## Rules

- Never approve without reading the actual code/output
- Never trust verbal claims without running verification
- Be thorough but practical — focus on correctness, not style
- If you cannot verify a claim, say so explicitly
```

- [ ] **Step 2: Run agent tests**

Run: `npx vitest run tests/agents.test.ts`
Expected: Tests fail because expected agent count is wrong (will fix in Task 15).

- [ ] **Step 3: Commit**

```bash
git add agents/architect.md
git commit -m "feat: add architect agent for plan review and completion verification"
```

---

### Task 9: Create critic agent

**Files:**
- Create: `agents/critic.md`

- [ ] **Step 1: Create the agent file**

Create `agents/critic.md`:

```markdown
---
name: critic
description: Challenges assumptions in plans and designs, providing adversarial quality review
tools: read, grep, find, ls
model: claude-opus-4-6
tier: reasoning
---

# Critic

You challenge plans and designs. Your job is to find weaknesses before implementation begins.

## Process

For every plan or design you review:

1. **Understand the intent** — What is this trying to achieve?
2. **Steelman an alternative** — Before critiquing, present the strongest alternative approach you can think of. This is mandatory — you cannot approve without first showing you considered alternatives.
3. **Evaluate trade-offs** — Compare the proposed approach against your alternative on: complexity, maintainability, performance, risk.
4. **Identify weaknesses** — What assumptions does the plan make? What could go wrong?
5. **Render verdict** — approve or request revision.

## Output Format

Return structured JSON:
```json
{
  "verdict": "approve" | "revise",
  "strengths": ["..."],
  "alternative": {
    "description": "Brief description of alternative approach",
    "tradeoffs": "Why the proposed approach is better (or worse)"
  },
  "weaknesses": ["..."],
  "suggestions": ["..."],
  "summary": "1-2 sentence assessment"
}
```

## Rules

- You MUST present an alternative before approving. No exceptions.
- Focus on substance, not style. Do not nitpick naming or formatting.
- If the plan is genuinely good, say so — but still present the alternative.
- If you request revision, be specific about what needs to change.
- Do not reject plans for being simple. Simple is often correct.
```

- [ ] **Step 2: Commit**

```bash
git add agents/critic.md
git commit -m "feat: add critic agent for adversarial quality review"
```

---

### Task 10: Create designer, writer, researcher, scientist, vision agents

**Files:**
- Create: `agents/designer.md`
- Create: `agents/writer.md`
- Create: `agents/researcher.md`
- Create: `agents/scientist.md`
- Create: `agents/vision.md`

- [ ] **Step 1: Create designer agent**

Create `agents/designer.md`:

```markdown
---
name: designer
description: UI/frontend specialist for components, styling, layouts, and accessible interfaces
tools: read, grep, find, ls, bash
model: claude-sonnet-4-6
tier: standard
---

# Designer

You implement frontend components, styling, layouts, and UI logic.

## Capabilities

- Component architecture (React, Vue, Svelte, vanilla)
- Responsive design and mobile-first layouts
- Accessibility (WCAG 2.1 AA compliance)
- CSS/Tailwind/styled-components
- Design system integration

## Process

1. Read existing code to understand the project's UI patterns and styling approach
2. Follow established conventions (component structure, naming, file organization)
3. Implement the requested UI changes
4. Ensure responsive behavior and accessibility
5. Test in context (run dev server if available)

## Output

Return:
- Working code for the requested UI changes
- Notes on responsive behavior or accessibility considerations
- Files changed and why

## Rules

- Match the project's existing UI patterns and component library
- Always consider accessibility (labels, focus management, contrast)
- Prefer semantic HTML elements
- Do not introduce new UI dependencies without explicit approval
```

- [ ] **Step 2: Create writer agent**

Create `agents/writer.md`:

```markdown
---
name: writer
description: Documentation generator for READMEs, API docs, changelogs, and code comments
tools: read, grep, find, ls
model: claude-haiku-4-5
tier: fast
---

# Writer

You generate technical documentation by reading existing code and docs.

## Capabilities

- README files and getting-started guides
- API documentation from code signatures
- Inline code comments for complex logic
- Changelogs and migration guides
- Architecture documentation

## Process

1. Read the code thoroughly before writing about it
2. Match the project's existing documentation style
3. Be accurate — never invent API details or behaviors
4. Cite source code locations (file:line) for every factual claim
5. Keep documentation concise and actionable

## Rules

- Never guess at API behavior — read the code
- Match the project's markdown style and heading conventions
- Do not add documentation for trivial or self-evident code
- If a README already exists, extend it — do not rewrite from scratch
```

- [ ] **Step 3: Create researcher agent**

Create `agents/researcher.md`:

```markdown
---
name: researcher
description: External documentation and API reference lookup for libraries and frameworks
tools: read, grep, find, ls, bash
model: claude-sonnet-4-6
tier: standard
---

# Researcher

You look up official documentation, API references, and usage examples for external libraries and frameworks.

## Process

1. Identify the library/framework and version in use (check package.json, go.mod, etc.)
2. Search for official docs, API references, and examples
3. Verify API contracts — actual function signatures, return types, field names
4. Return structured findings the team can use immediately

## Output Format

```json
{
  "library": "library-name",
  "version": "x.y.z",
  "findings": [
    {
      "topic": "What was researched",
      "result": "What was found",
      "source": "URL or file reference",
      "code_example": "Working code example if applicable"
    }
  ],
  "warnings": ["Any deprecations, breaking changes, or gotchas"]
}
```

## Rules

- Always verify the version in use before looking up docs
- Prefer official documentation over blog posts or Stack Overflow
- If docs are unclear or contradictory, say so explicitly
- Never guess at API behavior — report what the docs say
```

- [ ] **Step 4: Create scientist agent**

Create `agents/scientist.md`:

```markdown
---
name: scientist
description: Data analysis, hypothesis testing, and experimental validation
tools: read, grep, find, ls, bash
model: claude-sonnet-4-6
tier: standard
---

# Scientist

You analyze data, run experiments, and test hypotheses.

## Process

1. **Understand the question** — What are we trying to learn?
2. **Gather data** — Read logs, run queries, collect measurements
3. **Analyze** — Process data, compute statistics, identify patterns
4. **Conclude** — State findings with confidence levels

## Output Format

```json
{
  "question": "What we investigated",
  "methodology": "How we investigated",
  "data": "Key data points or measurements",
  "findings": ["Finding 1", "Finding 2"],
  "confidence": "high | medium | low",
  "conclusion": "1-2 sentence summary"
}
```

## Rules

- Show your data — conclusions without evidence are worthless
- Distinguish correlation from causation
- State confidence levels honestly
- If the data is insufficient, say so rather than speculating
```

- [ ] **Step 5: Create vision agent**

Create `agents/vision.md`:

```markdown
---
name: vision
description: Visual analysis of screenshots, mockups, diagrams, and UI implementations
tools: read, grep, find, ls
model: claude-sonnet-4-6
tier: standard
---

# Vision

You analyze visual content — screenshots, mockups, diagrams, and UI implementations.

## Capabilities

- Screenshot analysis (identify UI elements, layout issues, visual bugs)
- Mockup comparison (compare implementation against design)
- Diagram interpretation (architecture diagrams, flowcharts, ERDs)
- Accessibility visual audit (contrast, text size, spacing)

## Output Format

```json
{
  "description": "What the image shows",
  "observations": [
    {
      "element": "What element or region",
      "observation": "What you notice",
      "severity": "info | warning | issue"
    }
  ],
  "recommendations": ["Actionable suggestions"],
  "summary": "1-2 sentence assessment"
}
```

## Rules

- Be specific about locations — reference coordinates, quadrants, or element names
- Distinguish factual observations from subjective assessments
- When comparing against a design, note both matches and mismatches
- If an image is unclear or low quality, say so
```

- [ ] **Step 6: Commit all agents**

```bash
git add agents/designer.md agents/writer.md agents/researcher.md agents/scientist.md agents/vision.md
git commit -m "feat: add designer, writer, researcher, scientist, and vision agents"
```

---

### Task 11: Create state-manager extension

**Files:**
- Create: `extensions/state-manager.ts`
- Create: `tests/state-manager.test.ts`

- [ ] **Step 1: Write the test file**

Create `tests/state-manager.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  readState,
  writeState,
  clearState,
  listStates,
} from "../extensions/state-manager-utils.js";

describe("state-manager-utils", () => {
  let stateDir: string;

  beforeEach(() => {
    stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "state-"));
  });

  afterEach(() => {
    fs.rmSync(stateDir, { recursive: true, force: true });
  });

  describe("writeState / readState", () => {
    it("writes and reads state", () => {
      writeState(stateDir, "test", { active: true, count: 1 });
      const state = readState(stateDir, "test");
      expect(state).toEqual({ active: true, count: 1 });
    });

    it("returns undefined for nonexistent state", () => {
      expect(readState(stateDir, "nonexistent")).toBeUndefined();
    });

    it("overwrites existing state", () => {
      writeState(stateDir, "test", { v: 1 });
      writeState(stateDir, "test", { v: 2 });
      expect(readState(stateDir, "test")).toEqual({ v: 2 });
    });

    it("adds timestamp to written state", () => {
      writeState(stateDir, "test", { active: true });
      const state = readState(stateDir, "test") as Record<string, unknown>;
      expect(state._timestamp).toBeDefined();
      expect(typeof state._timestamp).toBe("number");
    });
  });

  describe("clearState", () => {
    it("removes state file", () => {
      writeState(stateDir, "test", { active: true });
      clearState(stateDir, "test");
      expect(readState(stateDir, "test")).toBeUndefined();
    });

    it("does not throw for nonexistent state", () => {
      expect(() => clearState(stateDir, "nonexistent")).not.toThrow();
    });
  });

  describe("listStates", () => {
    it("returns empty array for empty dir", () => {
      expect(listStates(stateDir)).toEqual([]);
    });

    it("lists all state keys", () => {
      writeState(stateDir, "alpha", { a: 1 });
      writeState(stateDir, "beta", { b: 2 });
      const keys = listStates(stateDir).sort();
      expect(keys).toEqual(["alpha", "beta"]);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/state-manager.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create state-manager-utils.ts**

Create `extensions/state-manager-utils.ts`:

```typescript
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Read state by key. Returns undefined if not found.
 */
export function readState(stateDir: string, key: string): Record<string, unknown> | undefined {
  const filePath = path.join(stateDir, `${key}.json`);
  if (!fs.existsSync(filePath)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return undefined;
  }
}

/**
 * Write state atomically. Adds _timestamp for staleness detection.
 */
export function writeState(stateDir: string, key: string, data: Record<string, unknown>): void {
  fs.mkdirSync(stateDir, { recursive: true });
  const filePath = path.join(stateDir, `${key}.json`);
  const withTimestamp = { ...data, _timestamp: Date.now() };
  const tmpPath = filePath + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(withTimestamp, null, 2));
  fs.renameSync(tmpPath, filePath);
}

/**
 * Clear (delete) a state by key.
 */
export function clearState(stateDir: string, key: string): void {
  const filePath = path.join(stateDir, `${key}.json`);
  try {
    fs.unlinkSync(filePath);
  } catch {
    // ignore if doesn't exist
  }
}

/**
 * List all state keys in the state directory.
 */
export function listStates(stateDir: string): string[] {
  if (!fs.existsSync(stateDir)) return [];
  return fs
    .readdirSync(stateDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

/**
 * Check if a state is stale (older than timeout seconds).
 */
export function isStale(state: Record<string, unknown>, timeoutSeconds: number): boolean {
  const timestamp = state._timestamp as number | undefined;
  if (!timestamp) return true;
  return (Date.now() - timestamp) / 1000 > timeoutSeconds;
}
```

- [ ] **Step 4: Create state-manager.ts extension**

Create `extensions/state-manager.ts`:

```typescript
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
```

- [ ] **Step 5: Register state-manager in package.json**

In `package.json`, add state-manager to the extensions array:
```json
"pi": {
  "extensions": ["./extensions/bootstrap.ts", "./extensions/subagent.ts", "./extensions/state-manager.ts"],
  "skills": ["./skills"],
  "prompts": ["./prompts"]
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/state-manager.test.ts`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add extensions/state-manager.ts extensions/state-manager-utils.ts tests/state-manager.test.ts package.json
git commit -m "feat: add state-manager extension with state CRUD tool"
```

---

### Task 12: Update agent and skill tests for Phase 2

**Files:**
- Modify: `tests/agents.test.ts`
- Modify: `tests/skills.test.ts`

- [ ] **Step 1: Update expected agent count and list in agents test**

The agents test currently validates bundled agents. Update the expected count from 7 to 14 and add the new agent names to any expected arrays.

Find the section that checks bundled agents and update:
- Expected agents: scout, planner, worker, code-reviewer, bug-hunter, security-reviewer, issue-validator, architect, critic, designer, writer, researcher, scientist, vision

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/agents.test.ts tests/skills.test.ts
git commit -m "test: update expected counts for 14 agents"
```

---

## Chunk 3: Phase 3 — Verification Tiers + Architect Integration

### Task 13: Rewrite verification-before-completion skill with tiers

**Files:**
- Modify: `skills/verification-before-completion/SKILL.md`

- [ ] **Step 1: Rewrite the skill**

Replace the content (keeping existing frontmatter) with a tiered verification system. The new skill should:

1. Keep the existing Iron Law ("NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE")
2. Add tier selection logic:
   - **Light** (<5 files changed, <100 lines, tests exist): dispatch architect at fast tier
   - **Standard** (default): dispatch architect at standard tier
   - **Thorough** (>20 files, security changes, architectural changes): dispatch architect at reasoning tier
3. Evidence requirements per tier:
   - Light: build passes + diagnostics clean
   - Standard: build passes + full test suite passes
   - Thorough: architect full review + all tests + security check
4. Dispatch pattern:
```
subagent({
  agent: "architect",
  task: "MODE: verification\n\nVerify the following claims:\n- [list of claims]\n\nEvidence to check:\n- [list of verification commands]",
  tier: "[selected tier]"
})
```
5. Keep the existing Red Flags section
6. Add automatic tier selection hints based on file patterns (e.g., `**/auth/**` → thorough)

- [ ] **Step 2: Run skills tests**

Run: `npx vitest run tests/skills.test.ts`
Expected: All tests pass (frontmatter still valid).

- [ ] **Step 3: Commit**

```bash
git add skills/verification-before-completion/
git commit -m "feat: rewrite verification-before-completion with tiered architect verification"
```

---

### Task 14: Integrate architect verification into subagent-driven-development

**Files:**
- Modify: `skills/subagent-driven-development/SKILL.md`

- [ ] **Step 1: Update the per-task workflow**

In the existing per-task workflow section, replace the self-review completion check with architect verification:

After the two-stage review (spec compliance + code quality), add:

```markdown
#### Completion Verification

After both reviews pass, dispatch the architect for verification:

```
subagent({
  agent: "architect",
  task: "MODE: verification\n\nTask: [task description]\nClaimed: Implementation complete, tests pass.\n\nVerify:\n1. Run: [test command]\n2. Check files changed match task scope\n3. Confirm no regressions",
  tier: "[light/standard/thorough based on task complexity]"
})
```

**Tier selection for verification:**
- Task touches <5 files and has clear test coverage → `tier: "fast"` (light verification)
- Default → `tier: "standard"`
- Task touches auth, security, or >20 files → `tier: "reasoning"` (thorough verification)
```

- [ ] **Step 2: Run skills tests**

Run: `npx vitest run tests/skills.test.ts`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add skills/subagent-driven-development/
git commit -m "feat: integrate architect verification into subagent-driven-development"
```

---

### Task 15: Integrate architect verification into executing-plans

**Files:**
- Modify: `skills/executing-plans/SKILL.md`

- [ ] **Step 1: Add architect verification to the task execution loop**

In the "Execute Tasks" section, after "Run verifications as specified", add:

```markdown
4. Dispatch architect for verification:
   ```
   subagent({
     agent: "architect",
     task: "MODE: verification\n\nTask: [task N description]\nClaimed: Task complete.\n\nVerify: [specific verification steps from plan]",
     tier: "[based on task complexity]"
   })
   ```
5. If architect returns "verified" → mark as completed
6. If architect returns "insufficient" or "failed" → address gaps, re-verify
```

- [ ] **Step 2: Run skills tests**

Run: `npx vitest run tests/skills.test.ts`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add skills/executing-plans/
git commit -m "feat: integrate architect verification into executing-plans"
```

---

## Chunk 4: Phase 4 — Enhanced Planning (Plan + Ralplan Skills)

### Task 16: Create plan skill

**Files:**
- Create: `skills/plan/SKILL.md`
- Create: `prompts/plan.md`

- [ ] **Step 1: Create the skill**

Create `skills/plan/SKILL.md`:

```markdown
---
name: plan
description: Unified planning entry point — detects broad vs. specific requests and routes to appropriate planning workflow
---

# Plan

Unified planning entry point. Routes to interview mode (broad requests) or direct planning (specific requests), with optional escalation to consensus planning (ralplan).

## When to Use

- When a user says "plan this", "plan the", or invokes `/plan`
- When a broad request is detected (vague verbs, no specific files, touches 3+ areas)
- Before any implementation work on a non-trivial feature

## Broad vs. Specific Detection

**Broad request** (needs interview mode) — any of:
- Uses vague verbs: "improve", "enhance", "fix", "refactor" without specific targets
- No specific file or function mentioned
- Touches 3+ unrelated areas
- Single sentence without clear deliverable

**Specific request** (direct planning) — all of:
- References specific files, functions, or components
- Clear deliverable described
- Scope is well-bounded

## Interview Mode (Broad Requests)

1. Dispatch scout (fast tier) to gather codebase context relevant to the request
2. Ask clarifying questions ONE AT A TIME:
   - What is the desired outcome?
   - What constraints exist? (performance, backward compat, etc.)
   - What is the scope boundary? (what's in, what's out)
   - What does success look like? (testable criteria)
3. After 3-5 questions, summarize understanding and confirm
4. Invoke the `writing-plans` skill with gathered context

## Direct Mode (Specific Requests)

1. Dispatch scout (fast tier) for quick context on referenced files
2. Invoke the `writing-plans` skill directly with the request

## Consensus Option

After initial planning mode is determined, offer:
> "Would you like a standard plan, or a consensus plan with architect and critic review (ralplan)?"

If consensus chosen, invoke the `ralplan` skill instead of `writing-plans`.

## Red Flags

- Do not start implementation without a plan for non-trivial work
- Do not skip the interview for broad requests — assumptions waste time
- Do not ask more than 5 clarifying questions — scope should be clear by then
```

- [ ] **Step 2: Create the prompt**

Create `prompts/plan.md`:

```markdown
---
description: Start a planning session — detects broad vs. specific requests and routes to the right workflow
---
Use the superpowers:plan skill to start a planning session.

If a specific request is provided, route to direct planning.
If a broad request is provided, start with interview mode.

Arguments: $@
```

- [ ] **Step 3: Run skills tests**

Run: `npx vitest run tests/skills.test.ts`
Expected: FAIL — skill count is 16 but we now have 17. Will fix in Task 20.

- [ ] **Step 4: Commit**

```bash
git add skills/plan/ prompts/plan.md
git commit -m "feat: add plan skill and /plan prompt"
```

---

### Task 17: Create ralplan skill

**Files:**
- Create: `skills/ralplan/SKILL.md`
- Create: `prompts/ralplan.md`

- [ ] **Step 1: Create the skill**

Create `skills/ralplan/SKILL.md`:

```markdown
---
name: ralplan
description: Consensus planning with adversarial review — planner, architect, and critic iterate until approved
---

# Ralplan — Consensus Planning

Iterative planning workflow where a planner creates, an architect reviews for feasibility, and a critic challenges for quality. The loop continues until the critic approves.

## When to Use

- High-risk or high-complexity features
- Architectural decisions that are hard to reverse
- When the user explicitly requests consensus planning
- When invoked from brainstorming after user chooses "consensus plan"

## Process

### Step 1: Generate Initial Plan

Dispatch planner (standard tier) to create the implementation plan:

```
subagent({
  agent: "planner",
  task: "Create an implementation plan for:\n\n[requirements]\n\nContext:\n[codebase context from scout]\n\nReturn a structured plan with numbered tasks, file paths, and verification steps.",
  tier: "standard"
})
```

### Step 2: Architect Review

Dispatch architect (reasoning tier) to review feasibility:

```
subagent({
  agent: "architect",
  task: "MODE: plan-review\n\nReview this implementation plan:\n\n[plan from Step 1]\n\nEvaluate feasibility, completeness, ordering, and risks.",
  tier: "reasoning"
})
```

If architect returns concerns or rejected → revise plan and re-submit.

### Step 3: Critic Review

Dispatch critic (reasoning tier) to challenge quality:

```
subagent({
  agent: "critic",
  task: "Review this implementation plan:\n\n[plan from Step 1]\n\nArchitect assessment:\n[architect output from Step 2]\n\nProvide adversarial review. You MUST present an alternative approach before approving.",
  tier: "reasoning"
})
```

If critic returns "revise" → incorporate feedback, return to Step 1.

### Step 4: Loop Control

- Maximum 5 iterations of the planner → architect → critic loop
- If critic approves → proceed to Step 5
- If 5 iterations without approval → present current state to user for guidance

### Step 5: Output

Produce final plan with:
- The approved implementation plan
- Architecture Decision Record (ADR):
  - Decision: What was decided
  - Context: Why this approach was chosen
  - Alternatives considered: From critic's reviews
  - Consequences: Trade-offs accepted

Save to `docs/plans/` and offer to execute.

## Red Flags

- Do not skip the critic step — that defeats the purpose
- Do not let the loop run indefinitely — 5 iterations max, then ask the human
- The critic MUST present an alternative — if it doesn't, re-dispatch with emphasis
```

- [ ] **Step 2: Create the prompt**

Create `prompts/ralplan.md`:

```markdown
---
description: Start consensus planning with planner, architect, and critic review loop
---
Use the superpowers:ralplan skill to start a consensus planning session.

This runs an iterative loop: planner creates → architect reviews → critic challenges → repeat until approved.

Arguments: $@
```

- [ ] **Step 3: Commit**

```bash
git add skills/ralplan/ prompts/ralplan.md
git commit -m "feat: add ralplan skill and /ralplan prompt for consensus planning"
```

---

### Task 18: Enhance brainstorming skill with ralplan option

**Files:**
- Modify: `skills/brainstorming/SKILL.md`

- [ ] **Step 1: Add ralplan option**

In the "After the Design" section, after "Write the validated design (spec)", add a planning choice before invoking writing-plans:

```markdown
**Planning Choice:**

After the spec is approved, offer the user a choice:
> "Ready to create the implementation plan. Would you like:
> - **A) Standard plan** — direct plan generation via writing-plans
> - **B) Consensus plan** — planner → architect → critic review loop via ralplan"

If user chooses A → invoke `writing-plans` skill (existing behavior).
If user chooses B → invoke `ralplan` skill instead.
```

- [ ] **Step 2: Run skills tests**

Run: `npx vitest run tests/skills.test.ts`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add skills/brainstorming/
git commit -m "feat: add ralplan consensus option to brainstorming skill"
```

---

### Task 19: Enhance writing-plans skill with tier annotations and story structure

**Files:**
- Modify: `skills/writing-plans/SKILL.md`

- [ ] **Step 1: Add tier annotations guidance**

In the "Task Structure" section, add tier annotation guidance:

```markdown
**Tier Annotations:**

Each task should include a recommended tier for the implementing agent:

```markdown
### Task N: [Component Name]

**Tier:** standard (or fast/reasoning based on complexity)
```

Tier selection guide:
- `fast` — Simple file creation, config changes, documentation
- `standard` — Feature implementation, test writing, integration work
- `reasoning` — Complex debugging, security-sensitive changes, architectural decisions
```

- [ ] **Step 2: Add story/acceptance-criteria structure**

Add a new section for PRD-compatible plan format:

```markdown
**Story Structure (for ralph strategy):**

Plans can optionally include user stories with acceptance criteria for use with the ralph execution strategy:

```markdown
### Story N: [Story Name]

**As a** [role], **I want** [feature], **so that** [benefit].

**Acceptance Criteria:**
- [ ] [Criterion 1 — testable]
- [ ] [Criterion 2 — testable]
- [ ] [Criterion 3 — testable]

**Tasks:**
1. [Task with steps...]
```

This format allows the executing-plans ralph strategy to track story-by-story completion with verification against acceptance criteria.
```

- [ ] **Step 3: Run skills tests**

Run: `npx vitest run tests/skills.test.ts`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add skills/writing-plans/
git commit -m "feat: add tier annotations and story structure to writing-plans skill"
```

---

### Task 20: Update skill tests for Phase 4

**Files:**
- Modify: `tests/skills.test.ts`

- [ ] **Step 1: Update expected skills count and list**

Update `EXPECTED_SKILLS` array to include "plan" and "ralplan" (alphabetically sorted). Update the test description from 16 to 18.

```typescript
const EXPECTED_SKILLS = [
  "brainstorming",
  "code-review",
  "dispatching-parallel-agents",
  "executing-plans",
  "finishing-a-development-branch",
  "plan",          // NEW
  "ralplan",       // NEW
  "receiving-code-review",
  "requesting-code-review",
  "security-review",
  "subagent-driven-development",
  "systematic-debugging",
  "test-driven-development",
  "using-git-worktrees",
  "using-superpowers",
  "verification-before-completion",
  "writing-plans",
  "writing-skills",
];
```

Update test description: `it("has all 18 expected skill directories"`.

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/skills.test.ts
git commit -m "test: update expected skills count to 18 (plan, ralplan)"
```

---

## Chunk 5: Phase 5 — Execution Strategies (Parallel + Autopilot + Ralph)

### Task 21: Create persistence-engine extension

**Files:**
- Create: `extensions/persistence-engine.ts`

- [ ] **Step 1: Create the extension**

Create `extensions/persistence-engine.ts`:

```typescript
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
```

- [ ] **Step 2: Register in package.json**

Add to the extensions array:
```json
"extensions": [
  "./extensions/bootstrap.ts",
  "./extensions/subagent.ts",
  "./extensions/state-manager.ts",
  "./extensions/persistence-engine.ts"
]
```

- [ ] **Step 3: Commit**

```bash
git add extensions/persistence-engine.ts package.json
git commit -m "feat: add persistence-engine extension for execution strategy loops"
```

---

### Task 22: Create cancel skill and prompt

**Files:**
- Create: `skills/cancel/SKILL.md`
- Create: `prompts/cancel.md`

- [ ] **Step 1: Create the cancel skill**

Create `skills/cancel/SKILL.md`:

```markdown
---
name: cancel
description: Cancel active execution mode (ralph, autopilot) and clean up state
---

# Cancel

Unified cancellation for active execution modes.

## When to Use

- When all work is complete and you need to exit a persistence loop
- When the user says "cancel", "stop", or invokes `/cancel`
- When a mode is stuck and needs manual termination

## Process

1. **Detect active modes:**
   ```
   state list
   ```

2. **Write cancel signal:**
   ```
   state write cancel-signal { "active": true, "reason": "user requested" }
   ```

3. **Deactivate modes in dependency order:**
   - If autopilot active: `state write autopilot { "active": false, "reason": "cancelled" }`
   - If ralph active: `state write ralph { "active": false, "reason": "cancelled" }`
   - Clear cancel signal: `state clear cancel-signal`

4. **Report:**
   ```
   Cancelled: [mode name]
   Iteration: [N]
   ```

## Notes

- The persistence-engine checks for the cancel-signal on each `agent_end` event
- Writing the cancel signal is sufficient — the engine will see it and stop injecting continuations
- Always deactivate the mode state AND write the cancel signal for reliable cancellation
```

- [ ] **Step 2: Create the prompt**

Create `prompts/cancel.md`:

```markdown
---
description: Cancel active execution mode and clean up state
---
Use the superpowers:cancel skill to cancel any active execution mode (ralph, autopilot).

Arguments: $@
```

- [ ] **Step 3: Commit**

```bash
git add skills/cancel/ prompts/cancel.md
git commit -m "feat: add cancel skill and /cancel prompt"
```

---

### Task 23: Enhance executing-plans with 4 execution strategies

**Files:**
- Modify: `skills/executing-plans/SKILL.md`

- [ ] **Step 1: Add strategy selection**

Rewrite the skill to support 4 strategies while keeping existing sequential behavior as default. Add after the frontmatter:

```markdown
## Execution Strategies

Select a strategy based on the plan type and user preference:

| Strategy | Flag | Keyword | Best For |
|----------|------|---------|----------|
| Sequential | (default) | — | Dependent tasks, small plans |
| Parallel | `--parallel` | "parallel" | Many independent tasks |
| Autopilot | `--autopilot` | "autopilot" | Large plans, hands-off |
| Ralph | `--ralph` | "ralph" | PRD with user stories |

### Strategy 1: Sequential (Default)

Retain the existing executing-plans content unchanged for this strategy. The current SKILL.md already describes sequential execution (load plan → review → execute tasks one by one → verify each → mark complete → finish). Wrap that existing content inside this `### Strategy 1: Sequential (Default)` heading so it becomes one of four strategies rather than the only mode.

### Strategy 2: Parallel

1. Load and review plan
2. Analyze tasks for independence (no shared files, no data dependencies)
3. Group independent tasks into parallel batches (max 8 per batch, 4 concurrent)
4. For each batch:
   ```
   subagent({
     tasks: [
       { agent: "worker", task: "Task N: [description]", tier: "[from plan]" },
       { agent: "worker", task: "Task M: [description]", tier: "[from plan]" },
       ...
     ]
   })
   ```
5. After each batch: verify results, resolve any conflicts
6. Sequential tasks run between parallel batches
7. Final verification via architect

### Strategy 3: Autopilot

1. Load and review plan
2. Activate persistence mode via the `state` tool (these are LLM-directed tool calls, not literal code):
   ```
   Use state tool: operation="write", key="autopilot", data={
     "active": true,
     "phase": "execute",
     "totalTasks": N,
     "completedTasks": 0,
     "iteration": 1
   }
   ```
3. **Execute phase:** Run tasks using parallel strategy where possible
4. **QA phase:** Run full test suite, fix any failures
   ```
   Use state tool: operation="write", key="autopilot", data={
     "active": true, "phase": "qa", "totalTasks": N,
     "completedTasks": <current>, "iteration": <current>
   }
   ```
5. **Validate phase:** Dispatch architect for thorough verification
   ```
   Use state tool: operation="write", key="autopilot", data={
     "active": true, "phase": "validate", "totalTasks": N,
     "completedTasks": <current>, "iteration": <current>
   }
   subagent({
     agent: "architect",
     task: "MODE: verification\n\n[comprehensive verification prompt]",
     tier: "reasoning"
   })
   ```
6. If validation passes → deactivate and invoke /cancel:
   ```
   Use state tool: operation="write", key="autopilot", data={ "active": false, "reason": "complete" }
   ```
   Then invoke the cancel skill.
7. If validation fails → return to execute phase with fixes

### Strategy 4: Ralph (Story-Driven)

1. Load PRD file (`.pi/state/prd.json` or plan with story structure)
2. Activate persistence mode via the `state` tool:
   ```
   Use state tool: operation="write", key="ralph", data={
     "active": true,
     "stories": [{ "name": "Story 1", "status": "pending", "criteria": ["..."] }, ...],
     "completedStories": [],
     "iteration": 1
   }
   ```
3. For each pending story:
   a. Dispatch worker to implement
   b. Verify against acceptance criteria
   c. Dispatch architect for verification
   d. If verified → mark story complete:
      ```
      Use state tool: operation="write", key="ralph", data={
        "active": true, "stories": [<updated statuses>],
        "completedStories": ["Story 1", ...], "iteration": <current>
      }
      ```
   e. If failed → fix and re-verify
4. When all stories complete → deactivate and invoke /cancel
5. Track learnings in `.pi/state/progress.md`
```

- [ ] **Step 2: Update execute-plan prompt with flags**

Modify `prompts/execute-plan.md` to document the strategy flags:

```markdown
---
description: Execute an existing implementation plan with optional execution strategy
---
Use the superpowers:executing-plans skill to execute a plan.

Strategies:
- Default: sequential execution
- `--parallel`: parallel execution of independent tasks
- `--autopilot`: full autonomous pipeline with persistence
- `--ralph`: story-driven execution from PRD

Arguments: $@
```

- [ ] **Step 3: Run skills tests**

Run: `npx vitest run tests/skills.test.ts`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add skills/executing-plans/ prompts/execute-plan.md
git commit -m "feat: add parallel, autopilot, and ralph execution strategies to executing-plans"
```

---

### Task 24: Enhance dispatching-parallel-agents with ultrawork patterns

**Files:**
- Modify: `skills/dispatching-parallel-agents/SKILL.md`

- [ ] **Step 1: Add ultrawork enhancements**

Add a section for ultrawork-style parallel dispatch patterns:

```markdown
## Independence Analysis

Before dispatching in parallel, verify independence:

1. **File independence** — tasks don't modify the same files
2. **Data independence** — tasks don't depend on each other's output
3. **State independence** — tasks don't share mutable state

If tasks have dependencies, split into sequential batches separated by parallel groups.

## Background vs. Foreground

- **Foreground:** Tasks that produce output you need before proceeding (scout, planner)
- **Background:** Long-running tasks where you can continue other work (builds, test suites)

## Tier Routing for Parallel Tasks

Assign tiers based on individual task complexity, not batch complexity:

```
subagent({
  tasks: [
    { agent: "scout", task: "Find auth code", tier: "fast" },
    { agent: "worker", task: "Implement auth fix", tier: "standard" },
    { agent: "bug-hunter", task: "Check for regressions", tier: "reasoning" }
  ]
})
```
```

- [ ] **Step 2: Commit**

```bash
git add skills/dispatching-parallel-agents/
git commit -m "feat: add ultrawork patterns to dispatching-parallel-agents"
```

---

### Task 25: Update skill tests for Phase 5

**Files:**
- Modify: `tests/skills.test.ts`

- [ ] **Step 1: Update expected skills count**

Add "cancel" to `EXPECTED_SKILLS` (alphabetically sorted). Increment the count in the test description by 1 (should be 19 after Phase 4's Task 20 set it to 18). Verify the current count in the file before editing.

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/skills.test.ts
git commit -m "test: update expected skills count to 19 (cancel)"
```

---

## Chunk 6: Phase 6 — Orchestration (Keyword Detection + Delegation + Ecomode)

### Task 26: Create orchestrator extension

**Files:**
- Create: `extensions/orchestrator.ts`

- [ ] **Step 1: Create the extension**

Create `extensions/orchestrator.ts`:

```typescript
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
```

- [ ] **Step 2: Register in package.json**

Add to the extensions array:
```json
"extensions": [
  "./extensions/bootstrap.ts",
  "./extensions/subagent.ts",
  "./extensions/state-manager.ts",
  "./extensions/persistence-engine.ts",
  "./extensions/orchestrator.ts"
]
```

- [ ] **Step 3: Commit**

```bash
git add extensions/orchestrator.ts package.json
git commit -m "feat: add orchestrator extension with keyword detection and delegation audit"
```

---

### Task 27: Create ecomode skill and prompt

**Files:**
- Create: `skills/ecomode/SKILL.md`
- Create: `prompts/ecomode.md`

- [ ] **Step 1: Create the skill**

Create `skills/ecomode/SKILL.md`:

```markdown
---
name: ecomode
description: Token-efficient model routing modifier — shifts tier preferences down to save costs
---

# Ecomode

A modifier that shifts model tier routing to prefer cheaper models. Not a standalone execution strategy — it modifies how other modes and dispatches select models.

## What It Does

When active, ecomode shifts tiers down:
- `reasoning` → `standard`
- `standard` → `fast`
- `fast` → `fast` (no change)

This means:
- Bug-hunter (normally opus) runs on sonnet
- Worker (normally sonnet) runs on haiku
- Scout (normally haiku) stays on haiku

## Activation

Activate:
```
state write ecomode { "active": true }
```

Deactivate:
```
state clear ecomode
```

## How It Works

The model-router-utils module checks for ecomode state when resolving models. The subagent extension reads `.pi/state/ecomode.json` before each dispatch and passes `ecomodeActive: true` to `resolveModel()` if the state is active.

## When to Use

- Working on low-risk tasks where speed/cost matters more than quality
- Prototyping or exploratory work
- When token budget is limited
- Can combine with any execution strategy (sequential, parallel, autopilot, ralph)

## When NOT to Use

- Security-sensitive changes
- Complex architectural decisions
- Production bug fixes
```

- [ ] **Step 2: Create the prompt**

Create `prompts/ecomode.md`:

```markdown
---
description: Toggle token-efficient model routing to save costs
---
Use the superpowers:ecomode skill to toggle ecomode.

When active, model tiers shift down (reasoning→standard, standard→fast) for cheaper execution.

Arguments: $@
```

- [ ] **Step 3: Commit**

```bash
git add skills/ecomode/ prompts/ecomode.md
git commit -m "feat: add ecomode skill and /ecomode prompt"
```

---

### Task 28: Update using-superpowers skill

**Files:**
- Modify: `skills/using-superpowers/SKILL.md`

- [ ] **Step 1: Add new features documentation**

Add sections covering:

1. **New agents** — architect, critic, designer, writer, researcher, scientist, vision with descriptions and when to use each
2. **Tier system** — explain fast/standard/reasoning tiers, how to override via `tier` parameter
3. **Execution strategies** — sequential, parallel, autopilot, ralph in executing-plans
4. **Magic keywords** — ralph, autopilot, ecomode, cancel, ralplan, parallel
5. **Planning workflows** — /plan (interview vs. direct), /ralplan (consensus)
6. **Verification tiers** — light/standard/thorough with architect agent
7. **Configuration** — `.pi/superpowers.json` for model overrides and feature toggles
8. **State management** — `state` tool for read/write/clear/list

- [ ] **Step 2: Run skills tests**

Run: `npx vitest run tests/skills.test.ts`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add skills/using-superpowers/
git commit -m "feat: update using-superpowers with full orchestration feature documentation"
```

---

### Task 29: Update skill tests, README, and version for Phase 6

**Files:**
- Modify: `tests/skills.test.ts`
- Modify: `README.md`
- Modify: `package.json`

- [ ] **Step 1: Update expected skills count**

Add "ecomode" to `EXPECTED_SKILLS` (alphabetically). Update count from 19 to 20.

- [ ] **Step 2: Update README.md**

Update all counts and tables:
- Skills: 16 → 20 (add plan, ralplan, cancel, ecomode to table)
- Agents: 7 → 14 (add architect, critic, designer, writer, researcher, scientist, vision to table)
- Prompts: 5 → 9 (add /plan, /ralplan, /cancel, /ecomode to table)
- Extensions section: mention state-manager, persistence-engine, orchestrator
- Add "Orchestration Features" section covering: tier system, execution strategies, planning workflows, configuration

- [ ] **Step 3: Bump version**

In `package.json`, update version from `1.2.0` to `2.0.0` (major version bump due to new extensions, config system, and significant API changes with `tier` parameter on subagent tool).

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add tests/skills.test.ts README.md package.json
git commit -m "docs: update README, bump to v2.0.0 with full orchestration features"
```

---

## Summary

| Phase | Tasks | Key Deliverables |
|-------|-------|-----------------|
| 1 | 1-7 | Unified config, model-router-utils, tier parameter on subagent tool |
| 2 | 8-12 | 7 new agents, state-manager extension |
| 3 | 13-15 | Tiered verification, architect integration |
| 4 | 16-20 | plan + ralplan skills, enhanced brainstorming + writing-plans |
| 5 | 21-25 | persistence-engine, cancel skill, 4 execution strategies |
| 6 | 26-29 | orchestrator extension, ecomode, README, v2.0.0 |

**Total: 29 tasks across 6 phases.**

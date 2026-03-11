# Pi Superpowers Extension Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@sartoris/pi-superpowers`, a full English-only port of obra/superpowers v5.0.0 for the Pi coding agent platform.

**Architecture:** Two TypeScript extensions (bootstrap + subagent) register Pi events and tools. 14 adapted skill SKILL.md files provide the methodology. 4 agent .md files define subagent personas. The subagent extension is adapted from pi-mono's official example with a third-tier bundled agent discovery.

**Tech Stack:** TypeScript (ES2022/NodeNext), Pi Extension API (`@mariozechner/pi-coding-agent`), Pi TUI (`@mariozechner/pi-tui`), TypeBox (`@sinclair/typebox`), Vitest for testing.

**Spec document:** `docs/plans/2026-03-11-pi-superpowers-design.md`

---

## Chunk 1: Project Scaffolding & Agent Definitions

### Task 1: Initialize project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `LICENSE`

- [ ] **Step 1: Initialize git repo**

Run: `cd /Users/ndcollins/Clients/Sartoris/Projects/pi-superpowers && git init`
Expected: `Initialized empty Git repository`

- [ ] **Step 2: Create package.json**

```json
{
  "name": "@sartoris/pi-superpowers",
  "version": "1.0.0",
  "description": "Superpowers skills framework for Pi - TDD, debugging, collaboration patterns, and proven development techniques",
  "author": "Sartoris",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/sartoris/pi-superpowers"
  },
  "keywords": ["pi", "skills", "tdd", "debugging", "collaboration", "best-practices", "workflows"],
  "type": "module",
  "pi": {
    "extensions": ["./extensions/bootstrap.ts", "./extensions/subagent.ts"],
    "skills": ["./skills"],
    "prompts": ["./prompts"]
  },
  "devDependencies": {
    "@mariozechner/pi-agent-core": "*",
    "@mariozechner/pi-ai": "*",
    "@mariozechner/pi-coding-agent": "*",
    "@mariozechner/pi-tui": "*",
    "@sinclair/typebox": "^0.34.0",
    "vitest": "^3.0.0",
    "typescript": "^5.7.0"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": ".",
    "types": ["vitest/globals"]
  },
  "include": ["extensions/**/*.ts", "tests/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
*.tgz
.DS_Store
```

- [ ] **Step 5: Create LICENSE**

MIT license, copyright 2026 Sartoris. Based on obra/superpowers by Jesse Vincent.

- [ ] **Step 6: Create directory structure**

Run: `mkdir -p extensions agents skills prompts tests docs/superpowers/specs docs/superpowers/plans`

- [ ] **Step 7: Install dependencies**

Run: `npm install`
Expected: Dependencies installed, `node_modules/` created, `package-lock.json` generated.

Note: Pi extension dependencies (`@mariozechner/*`) may not be available on npm. If install fails for those, add them as `peerDependencies` instead and mark as optional. The extension runs inside Pi which provides these at runtime.

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json .gitignore LICENSE
git commit -m "feat: initialize @sartoris/pi-superpowers project scaffolding"
```

---

### Task 2: Create agent definitions

**Files:**
- Create: `agents/code-reviewer.md`
- Create: `agents/scout.md`
- Create: `agents/planner.md`
- Create: `agents/worker.md`

- [ ] **Step 1: Create agents/code-reviewer.md**

Adapted from obra/superpowers `agents/code-reviewer.md`. The agent reviews completed code against specs and coding standards.

```markdown
---
name: code-reviewer
description: Reviews completed code against specs and coding standards for quality, security, and maintainability
tools: read, grep, find, ls, bash
model: claude-sonnet-4-5
---

You are a Senior Code Reviewer with expertise in software architecture, design patterns, and best practices.

Bash is for read-only commands only: `git diff`, `git log`, `git show`, `git blame`. Do NOT modify files or run builds.

When reviewing completed work, you will:

1. **Plan Alignment Analysis** — compare implementation against the original planning document
2. **Code Quality Assessment** — patterns, error handling, type safety, test coverage
3. **Architecture and Design Review** — SOLID principles, separation of concerns, integration points
4. **Documentation and Standards** — comments, headers, function docs, project conventions
5. **Issue Identification** — categorize as Critical (must fix) / Important (should fix) / Suggestion (consider)

Output format:

## Files Reviewed
- `path/to/file.ts` (lines X-Y)

## Critical (must fix)
- `file.ts:42` — Issue description and suggested fix

## Important (should fix)
- `file.ts:100` — Issue description

## Suggestions (consider)
- `file.ts:150` — Improvement idea

## Summary
Overall assessment in 2-3 sentences. Include whether work aligns with the spec/plan.
```

- [ ] **Step 2: Create agents/scout.md**

Adapted from pi-mono's `agents/scout.md`. Fast codebase recon for handoff.

```markdown
---
name: scout
description: Fast codebase recon that returns compressed context for handoff to other agents
tools: read, grep, find, ls, bash
model: claude-haiku-4-5
---

You are a scout. Quickly investigate a codebase and return structured findings that another agent can use without re-reading everything.

Your output will be passed to an agent who has NOT seen the files you explored.

Thoroughness (infer from task, default medium):
- Quick: Targeted lookups, key files only
- Medium: Follow imports, read critical sections
- Thorough: Trace all dependencies, check tests/types

Strategy:
1. grep/find to locate relevant code
2. Read key sections (not entire files)
3. Identify types, interfaces, key functions
4. Note dependencies between files

Output format:

## Files Retrieved
List with exact line ranges:
1. `path/to/file.ts` (lines 10-50) - Description of what's here
2. `path/to/other.ts` (lines 100-150) - Description

## Key Code
Critical types, interfaces, or functions (actual code from files).

## Architecture
Brief explanation of how the pieces connect.

## Start Here
Which file to look at first and why.
```

- [ ] **Step 3: Create agents/planner.md**

Adapted from pi-mono's `agents/planner.md`. Read-only planning, references superpowers writing-plans format.

```markdown
---
name: planner
description: Creates implementation plans from context and requirements following superpowers plan format
tools: read, grep, find, ls
model: claude-sonnet-4-5
---

You are a planning specialist. You receive context (often from a scout) and requirements, then produce a clear implementation plan.

You must NOT make any changes. Only read, analyze, and plan.

Follow the superpowers writing-plans format: atomic 2-5 minute steps with exact file paths, code samples, and expected command output. Use TDD ordering (write test, verify fail, implement, verify pass, commit).

Output format:

## Goal
One sentence summary of what needs to be done.

## Plan
Numbered steps, each small and actionable:
1. Step one — specific file/function to modify
2. Step two — what to add/change

## Files to Modify
- `path/to/file.ts` — what changes

## New Files (if any)
- `path/to/new.ts` — purpose

## Risks
Anything to watch out for.

Keep the plan concrete. The worker agent will execute it verbatim.
```

- [ ] **Step 4: Create agents/worker.md**

Adapted from pi-mono's `agents/worker.md`. Full execution, references superpowers principles.

```markdown
---
name: worker
description: General-purpose subagent with full capabilities for implementing tasks
model: claude-sonnet-4-5
---

You are a worker agent with full capabilities. You operate in an isolated context window to handle delegated tasks without polluting the main conversation.

Work autonomously to complete the assigned task. Use all available tools as needed.

Follow these principles:
- Use TDD when implementing features (write failing test first, then implement)
- Verify your work before claiming completion (run tests, check output)
- If stuck, report the blocker clearly rather than guessing

Output format when finished:

## Completed
What was done.

## Files Changed
- `path/to/file.ts` — what changed

## Verification
What commands were run and their results.

## Notes (if any)
Anything the main agent should know.
```

- [ ] **Step 5: Commit**

```bash
git add agents/
git commit -m "feat: add agent definitions (code-reviewer, scout, planner, worker)"
```

---

## Chunk 2: Subagent Extension

### Task 3: Create agent discovery module

**Files:**
- Create: `extensions/agents.ts`

This module handles loading agent definitions from three sources: bundled (our `agents/` dir), user (`~/.pi/agent/agents/`), project (`.pi/agents/` walking up from cwd). Priority: project > user > bundled.

- [ ] **Step 1: Write the test file**

Create `tests/agents.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { discoverAgents, loadAgentsFromDir, type AgentConfig } from "../extensions/agents.js";

describe("loadAgentsFromDir", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-superpowers-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads agent from valid markdown file with frontmatter", () => {
    const agentContent = `---
name: test-agent
description: A test agent
tools: read, grep, find
model: claude-haiku-4-5
---

You are a test agent. Do test things.
`;
    fs.writeFileSync(path.join(tmpDir, "test-agent.md"), agentContent);

    const agents = loadAgentsFromDir(tmpDir, "user");

    expect(agents).toHaveLength(1);
    expect(agents[0].name).toBe("test-agent");
    expect(agents[0].description).toBe("A test agent");
    expect(agents[0].tools).toEqual(["read", "grep", "find"]);
    expect(agents[0].model).toBe("claude-haiku-4-5");
    expect(agents[0].systemPrompt).toContain("You are a test agent");
    expect(agents[0].source).toBe("user");
  });

  it("skips files without required frontmatter", () => {
    fs.writeFileSync(path.join(tmpDir, "bad.md"), "No frontmatter here");
    const agents = loadAgentsFromDir(tmpDir, "user");
    expect(agents).toHaveLength(0);
  });

  it("skips non-md files", () => {
    fs.writeFileSync(path.join(tmpDir, "readme.txt"), "---\nname: x\ndescription: y\n---\nbody");
    const agents = loadAgentsFromDir(tmpDir, "user");
    expect(agents).toHaveLength(0);
  });

  it("returns empty array for non-existent directory", () => {
    const agents = loadAgentsFromDir("/nonexistent/path", "user");
    expect(agents).toHaveLength(0);
  });

  it("parses agent without tools or model", () => {
    const content = `---
name: minimal
description: Minimal agent
---

Just a system prompt.
`;
    fs.writeFileSync(path.join(tmpDir, "minimal.md"), content);
    const agents = loadAgentsFromDir(tmpDir, "project");
    expect(agents).toHaveLength(1);
    expect(agents[0].tools).toBeUndefined();
    expect(agents[0].model).toBeUndefined();
    expect(agents[0].source).toBe("project");
  });
});

describe("discoverAgents priority", () => {
  let bundledDir: string;
  let userDir: string;
  let projectDir: string;

  beforeEach(() => {
    bundledDir = fs.mkdtempSync(path.join(os.tmpdir(), "bundled-"));
    userDir = fs.mkdtempSync(path.join(os.tmpdir(), "user-"));
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "project-"));

    // Same agent name in all three sources
    for (const [dir, source] of [[bundledDir, "bundled"], [userDir, "user"], [projectDir, "project"]] as const) {
      fs.writeFileSync(
        path.join(dir, "scout.md"),
        `---\nname: scout\ndescription: ${source} scout\n---\n${source} prompt`
      );
    }
  });

  afterEach(() => {
    for (const dir of [bundledDir, userDir, projectDir]) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("project agents override user agents with same name", () => {
    const agents = discoverAgents({
      bundledDir,
      userDir,
      projectDir,
      scope: "both",
    });
    const scout = agents.find((a) => a.name === "scout");
    expect(scout).toBeDefined();
    expect(scout!.source).toBe("project");
    expect(scout!.description).toBe("project scout");
  });

  it("user agents override bundled agents with same name", () => {
    const agents = discoverAgents({
      bundledDir,
      userDir,
      projectDir: null,
      scope: "user",
    });
    const scout = agents.find((a) => a.name === "scout");
    expect(scout).toBeDefined();
    expect(scout!.source).toBe("user");
  });

  it("bundled agents used when no user or project override", () => {
    // Remove user and project scout
    fs.unlinkSync(path.join(userDir, "scout.md"));
    fs.unlinkSync(path.join(projectDir, "scout.md"));

    const agents = discoverAgents({
      bundledDir,
      userDir,
      projectDir,
      scope: "both",
    });
    const scout = agents.find((a) => a.name === "scout");
    expect(scout).toBeDefined();
    expect(scout!.source).toBe("bundled");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/agents.test.ts`
Expected: FAIL — `Cannot find module '../extensions/agents.js'`

- [ ] **Step 3: Implement extensions/agents.ts**

```typescript
/**
 * Agent discovery and configuration for pi-superpowers.
 *
 * Discovers agents from three sources (priority: project > user > bundled):
 * 1. Project agents: .pi/agents/ walking up from cwd
 * 2. User agents: ~/.pi/agent/agents/
 * 3. Bundled agents: this package's agents/ directory
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

export type AgentScope = "user" | "project" | "both";

export interface AgentConfig {
  name: string;
  description: string;
  tools?: string[];
  model?: string;
  systemPrompt: string;
  source: "user" | "project" | "bundled";
  filePath: string;
}

/**
 * Simple frontmatter parser for agent .md files.
 * Returns { frontmatter, body } where frontmatter is a key-value record.
 */
function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      frontmatter[key] = value;
    }
  }
  return { frontmatter, body: match[2] };
}

export function loadAgentsFromDir(dir: string, source: "user" | "project" | "bundled"): AgentConfig[] {
  const agents: AgentConfig[] = [];

  if (!fs.existsSync(dir)) return agents;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return agents;
  }

  for (const entry of entries) {
    if (!entry.name.endsWith(".md")) continue;
    if (!entry.isFile() && !entry.isSymbolicLink()) continue;

    const filePath = path.join(dir, entry.name);
    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    const { frontmatter, body } = parseFrontmatter(content);
    if (!frontmatter.name || !frontmatter.description) continue;

    const tools = frontmatter.tools
      ?.split(",")
      .map((t: string) => t.trim())
      .filter(Boolean);

    agents.push({
      name: frontmatter.name,
      description: frontmatter.description,
      tools: tools && tools.length > 0 ? tools : undefined,
      model: frontmatter.model,
      systemPrompt: body.trim(),
      source,
      filePath,
    });
  }

  return agents;
}

function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function findNearestProjectAgentsDir(cwd: string): string | null {
  let currentDir = cwd;
  while (true) {
    const candidate = path.join(currentDir, ".pi", "agents");
    if (isDirectory(candidate)) return candidate;
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) return null;
    currentDir = parentDir;
  }
}

/** Get the bundled agents/ directory path (relative to this package) */
function getBundledAgentsDir(): string {
  const thisFile = fileURLToPath(import.meta.url);
  const extensionsDir = path.dirname(thisFile);
  return path.join(extensionsDir, "..", "agents");
}

/** Get user agents directory */
function getUserAgentsDir(): string {
  return path.join(process.env.HOME || os.homedir(), ".pi", "agent", "agents");
}

import * as os from "node:os";

export interface DiscoverAgentsOptions {
  bundledDir?: string;
  userDir?: string;
  projectDir?: string | null;
  scope: AgentScope;
}

/**
 * Discover agents from all sources.
 * When called from the extension, pass no options to use defaults.
 * Options are exposed for testing.
 */
export function discoverAgents(options: DiscoverAgentsOptions): AgentConfig[];
export function discoverAgents(cwd: string, scope: AgentScope): AgentConfig[];
export function discoverAgents(
  cwdOrOptions: string | DiscoverAgentsOptions,
  maybeScope?: AgentScope,
): AgentConfig[] {
  let bundledDir: string;
  let userDir: string;
  let projectDir: string | null;
  let scope: AgentScope;

  if (typeof cwdOrOptions === "string") {
    bundledDir = getBundledAgentsDir();
    userDir = getUserAgentsDir();
    projectDir = findNearestProjectAgentsDir(cwdOrOptions);
    scope = maybeScope!;
  } else {
    bundledDir = cwdOrOptions.bundledDir ?? getBundledAgentsDir();
    userDir = cwdOrOptions.userDir ?? getUserAgentsDir();
    projectDir = cwdOrOptions.projectDir ?? null;
    scope = cwdOrOptions.scope;
  }

  const bundledAgents = loadAgentsFromDir(bundledDir, "bundled");
  const userAgents = scope === "project" ? [] : loadAgentsFromDir(userDir, "user");
  const projectAgents =
    scope === "user" || !projectDir ? [] : loadAgentsFromDir(projectDir, "project");

  // Priority: project > user > bundled (later entries overwrite earlier)
  const agentMap = new Map<string, AgentConfig>();
  for (const agent of bundledAgents) agentMap.set(agent.name, agent);
  for (const agent of userAgents) agentMap.set(agent.name, agent);
  for (const agent of projectAgents) agentMap.set(agent.name, agent);

  return Array.from(agentMap.values());
}

export function discoverAgentsWithProjectDir(
  cwd: string,
  scope: AgentScope,
): { agents: AgentConfig[]; projectAgentsDir: string | null } {
  const projectAgentsDir = findNearestProjectAgentsDir(cwd);
  const agents = discoverAgents({ scope, projectDir: projectAgentsDir });
  return { agents, projectAgentsDir };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/agents.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add extensions/agents.ts tests/agents.test.ts
git commit -m "feat: add agent discovery with bundled/user/project priority"
```

---

### Task 4: Create subagent utilities

**Files:**
- Create: `extensions/subagent-utils.ts`
- Create: `tests/subagent-utils.test.ts`

Pure functions for CLI arg building, result parsing, and the concurrency limiter.

- [ ] **Step 1: Write tests**

Create `tests/subagent-utils.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  buildAgentArgs,
  writePromptToTempFile,
  mapWithConcurrencyLimit,
  getFinalOutput,
} from "../extensions/subagent-utils.js";

describe("buildAgentArgs", () => {
  it("builds basic args for agent without model or tools", () => {
    const args = buildAgentArgs({ model: undefined, tools: undefined });
    expect(args).toEqual(["--mode", "json", "-p", "--no-session"]);
  });

  it("includes model when specified", () => {
    const args = buildAgentArgs({ model: "claude-haiku-4-5", tools: undefined });
    expect(args).toContain("--model");
    expect(args).toContain("claude-haiku-4-5");
  });

  it("includes tools when specified", () => {
    const args = buildAgentArgs({ model: undefined, tools: ["read", "grep", "find"] });
    expect(args).toContain("--tools");
    expect(args).toContain("read,grep,find");
  });
});

describe("writePromptToTempFile", () => {
  it("writes prompt to temp file and returns path", () => {
    const { dir, filePath } = writePromptToTempFile("test", "prompt content");
    const fs = await import("node:fs");
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, "utf-8")).toBe("prompt content");
    // Cleanup
    fs.unlinkSync(filePath);
    fs.rmdirSync(dir);
  });
});

describe("mapWithConcurrencyLimit", () => {
  it("processes all items", async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await mapWithConcurrencyLimit(items, 2, async (item) => item * 2);
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it("respects concurrency limit", async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const items = [1, 2, 3, 4, 5, 6];
    await mapWithConcurrencyLimit(items, 3, async (item) => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 10));
      concurrent--;
      return item;
    });
    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });

  it("returns empty array for empty input", async () => {
    const results = await mapWithConcurrencyLimit([], 4, async (x) => x);
    expect(results).toEqual([]);
  });
});

describe("getFinalOutput", () => {
  it("returns last assistant text content", () => {
    const messages = [
      { role: "user", content: [{ type: "text", text: "hello" }] },
      { role: "assistant", content: [{ type: "text", text: "first" }] },
      { role: "assistant", content: [{ type: "text", text: "final answer" }] },
    ];
    expect(getFinalOutput(messages as any)).toBe("final answer");
  });

  it("returns empty string for no messages", () => {
    expect(getFinalOutput([])).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/subagent-utils.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement extensions/subagent-utils.ts**

```typescript
/**
 * Pure utility functions for the subagent extension.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface Message {
  role: string;
  content: Array<{ type: string; text?: string; name?: string; arguments?: Record<string, any> }>;
  usage?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    cost?: { total?: number };
    totalTokens?: number;
  };
  model?: string;
  stopReason?: string;
  errorMessage?: string;
}

export interface UsageStats {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  contextTokens: number;
  turns: number;
}

export function emptyUsage(): UsageStats {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 };
}

export function buildAgentArgs(options: {
  model: string | undefined;
  tools: string[] | undefined;
}): string[] {
  const args = ["--mode", "json", "-p", "--no-session"];
  if (options.model) args.push("--model", options.model);
  if (options.tools && options.tools.length > 0) args.push("--tools", options.tools.join(","));
  return args;
}

export function writePromptToTempFile(
  agentName: string,
  prompt: string,
): { dir: string; filePath: string } {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-subagent-"));
  const safeName = agentName.replace(/[^\w.-]+/g, "_");
  const filePath = path.join(tmpDir, `prompt-${safeName}.md`);
  fs.writeFileSync(filePath, prompt, { encoding: "utf-8", mode: 0o600 });
  return { dir: tmpDir, filePath };
}

export async function mapWithConcurrencyLimit<TIn, TOut>(
  items: TIn[],
  concurrency: number,
  fn: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results: TOut[] = new Array(items.length);
  let nextIndex = 0;
  const workers = new Array(limit).fill(null).map(async () => {
    while (true) {
      const current = nextIndex++;
      if (current >= items.length) return;
      results[current] = await fn(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

export function getFinalOutput(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant") {
      for (const part of msg.content) {
        if (part.type === "text" && part.text) return part.text;
      }
    }
  }
  return "";
}

export function formatTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.round(count / 1000)}k`;
  return `${(count / 1000000).toFixed(1)}M`;
}

export function formatUsageStats(
  usage: UsageStats,
  model?: string,
): string {
  const parts: string[] = [];
  if (usage.turns) parts.push(`${usage.turns} turn${usage.turns > 1 ? "s" : ""}`);
  if (usage.input) parts.push(`↑${formatTokens(usage.input)}`);
  if (usage.output) parts.push(`↓${formatTokens(usage.output)}`);
  if (usage.cacheRead) parts.push(`R${formatTokens(usage.cacheRead)}`);
  if (usage.cacheWrite) parts.push(`W${formatTokens(usage.cacheWrite)}`);
  if (usage.cost) parts.push(`$${usage.cost.toFixed(4)}`);
  if (usage.contextTokens && usage.contextTokens > 0) {
    parts.push(`ctx:${formatTokens(usage.contextTokens)}`);
  }
  if (model) parts.push(model);
  return parts.join(" ");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/subagent-utils.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add extensions/subagent-utils.ts tests/subagent-utils.test.ts
git commit -m "feat: add subagent utility functions (arg builder, concurrency, output parsing)"
```

---

### Task 5: Create subagent extension

**Files:**
- Create: `extensions/subagent.ts`

This is the main subagent tool registration, adapted from pi-mono's official example. It uses `agents.ts` for discovery and `subagent-utils.ts` for helpers.

- [ ] **Step 1: Implement extensions/subagent.ts**

Adapt the full `index.ts` from pi-mono's subagent example with these changes:

1. Import `discoverAgentsWithProjectDir` from `./agents.js` instead of the pi-mono version
2. Import helpers from `./subagent-utils.js` instead of inline
3. Add bundled agents as third discovery tier (already handled by our `agents.ts`)
4. Add `promptGuidelines` to the tool registration pointing to superpowers skills:
   ```typescript
   promptGuidelines: [
     "For multi-task implementation plans, use the superpowers:subagent-driven-development skill",
     "For 3+ independent broken subsystems, use superpowers:dispatching-parallel-agents skill",
     "After task completion, use superpowers:requesting-code-review to dispatch the code-reviewer agent",
   ],
   ```
5. Keep all three modes (single, parallel, chain) and the full TUI rendering
6. Use our own `parseFrontmatter` instead of importing from `@mariozechner/pi-coding-agent` (to avoid hard dependency)
7. Keep the `MAX_PARALLEL_TASKS = 8` and `MAX_CONCURRENCY = 4` constants

The full implementation follows the pi-mono example closely. Key function signatures:
- `runSingleAgent(...)` — spawns `pi` subprocess, streams JSON events
- `execute(toolCallId, params, signal, onUpdate, ctx)` — routes to single/parallel/chain mode
- `renderCall(args, theme)` — TUI display of tool invocation
- `renderResult(result, options, theme)` — TUI display of results

Note: The TUI rendering imports (`Container`, `Markdown`, `Spacer`, `Text` from `@mariozechner/pi-tui` and `getMarkdownTheme` from `@mariozechner/pi-coding-agent`) are runtime dependencies provided by Pi. They don't need to be installable via npm.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors (or only errors from missing Pi runtime types, which is acceptable)

- [ ] **Step 3: Commit**

```bash
git add extensions/subagent.ts
git commit -m "feat: add subagent extension with single/parallel/chain modes"
```

---

## Chunk 3: Bootstrap Extension

### Task 6: Create bootstrap utilities

**Files:**
- Create: `extensions/bootstrap-utils.ts`
- Create: `tests/bootstrap-utils.test.ts`

- [ ] **Step 1: Write tests**

Create `tests/bootstrap-utils.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  stripFrontmatter,
  buildPiToolMapping,
  buildBootstrapContent,
} from "../extensions/bootstrap-utils.js";

describe("stripFrontmatter", () => {
  it("removes YAML frontmatter from markdown", () => {
    const input = `---
name: test
description: A test
---

# Content here`;
    const result = stripFrontmatter(input);
    expect(result).not.toContain("---");
    expect(result).not.toContain("name: test");
    expect(result).toContain("# Content here");
  });

  it("returns content as-is when no frontmatter", () => {
    const input = "# Just content\n\nNo frontmatter here.";
    expect(stripFrontmatter(input)).toBe(input);
  });
});

describe("buildPiToolMapping", () => {
  it("returns a markdown table", () => {
    const mapping = buildPiToolMapping();
    expect(mapping).toContain("Superpowers Concept");
    expect(mapping).toContain("Pi Equivalent");
    expect(mapping).toContain("subagent");
  });

  it("contains no Chinese characters", () => {
    const mapping = buildPiToolMapping();
    expect(mapping).not.toMatch(/[\u4e00-\u9fff]/);
  });
});

describe("buildBootstrapContent", () => {
  it("includes the using-superpowers skill content", () => {
    const content = buildBootstrapContent();
    expect(content).toContain("superpowers");
    expect(content).toContain("Skill");
  });

  it("includes the Pi tool mapping", () => {
    const content = buildBootstrapContent();
    expect(content).toContain("Pi Equivalent");
    expect(content).toContain("subagent");
  });

  it("does not contain YAML frontmatter markers", () => {
    const content = buildBootstrapContent();
    // Should not start with ---
    expect(content.trimStart().startsWith("---")).toBe(false);
  });

  it("contains no Chinese characters", () => {
    const content = buildBootstrapContent();
    expect(content).not.toMatch(/[\u4e00-\u9fff]/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/bootstrap-utils.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement extensions/bootstrap-utils.ts**

```typescript
/**
 * Pure utility functions for the bootstrap extension.
 * Assembles the using-superpowers skill content with Pi-specific adaptations.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/** Strip YAML frontmatter from markdown content */
export function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return match ? match[1].trim() : content;
}

/** Build Pi-specific tool mapping table */
export function buildPiToolMapping(): string {
  return `
## Pi Platform Tool Mapping

| Superpowers Concept | Pi Equivalent |
|---|---|
| \`Skill\` tool | Skills are auto-triggered by Pi based on description matching, or invoked via \`/skill-name\` slash commands |
| \`Agent\` / \`Task\` tool (subagents) | \`subagent\` tool — supports single, parallel (up to 8 tasks, 4 concurrent), and chain modes |
| \`TodoWrite\` / task tracking | Use markdown checklists in plan documents |
| \`EnterPlanMode\` | Not available — use the writing-plans and executing-plans skills instead |
| Git worktrees (\`EnterWorktree\`/\`ExitWorktree\`) | Use \`git worktree\` commands directly via bash |
| Code review dispatch | \`subagent\` tool with agent: "code-reviewer" |

### Subagent Quick Reference

**Single agent:**
\`\`\`json
{ "agent": "worker", "task": "implement the feature" }
\`\`\`

**Parallel (independent tasks):**
\`\`\`json
{ "tasks": [
  { "agent": "worker", "task": "task 1" },
  { "agent": "worker", "task": "task 2" }
]}
\`\`\`

**Chain (sequential handoff):**
\`\`\`json
{ "chain": [
  { "agent": "scout", "task": "find code related to auth" },
  { "agent": "planner", "task": "plan implementation using {previous}" },
  { "agent": "worker", "task": "implement the plan: {previous}" }
]}
\`\`\`
`.trim();
}

/** Get the using-superpowers SKILL.md content */
function getUsingSuperpowersContent(): string {
  const thisFile = fileURLToPath(import.meta.url);
  const extensionsDir = path.dirname(thisFile);
  const skillPath = path.join(extensionsDir, "..", "skills", "using-superpowers", "SKILL.md");
  return fs.readFileSync(skillPath, "utf-8");
}

/**
 * Build the full bootstrap content injected into every Pi session.
 * Combines the using-superpowers skill (without frontmatter) with Pi tool mapping.
 */
export function buildBootstrapContent(): string {
  const skillContent = getUsingSuperpowersContent();
  const stripped = stripFrontmatter(skillContent);
  const toolMapping = buildPiToolMapping();

  return `${stripped}

${toolMapping}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/bootstrap-utils.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add extensions/bootstrap-utils.ts tests/bootstrap-utils.test.ts
git commit -m "feat: add bootstrap utility functions (frontmatter stripping, tool mapping)"
```

---

### Task 7: Create bootstrap extension

**Files:**
- Create: `extensions/bootstrap.ts`

- [ ] **Step 1: Implement extensions/bootstrap.ts**

```typescript
/**
 * Bootstrap extension for pi-superpowers.
 *
 * Injects the using-superpowers skill content into every Pi session
 * via the context event, so the agent knows about available skills
 * and how to use them.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { buildBootstrapContent } from "./bootstrap-utils.js";

// Assemble content once at load time
let cachedContent: string | null = null;

function getContent(): string {
  if (!cachedContent) {
    cachedContent = buildBootstrapContent();
  }
  return cachedContent;
}

export default function (pi: ExtensionAPI) {
  // Use the context event for idiomatic Pi context injection
  pi.on("context", (_event, _ctx) => {
    return {
      sections: [
        {
          title: "Superpowers Skills Framework",
          content: getContent(),
        },
      ],
    };
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors (or only Pi runtime type errors)

- [ ] **Step 3: Commit**

```bash
git add extensions/bootstrap.ts
git commit -m "feat: add bootstrap extension for session context injection"
```

---

## Chunk 4: Skills Adaptation

### Task 8: Port skills that need no Pi-specific changes

**Files:**
- Create: `skills/test-driven-development/SKILL.md`
- Create: `skills/test-driven-development/testing-anti-patterns.md`
- Create: `skills/systematic-debugging/SKILL.md`
- Create: `skills/verification-before-completion/SKILL.md`
- Create: `skills/executing-plans/SKILL.md`
- Create: `skills/finishing-a-development-branch/SKILL.md`
- Create: `skills/receiving-code-review/SKILL.md`
- Create: `skills/writing-skills/SKILL.md`

These 7 skills (8 files) need only frontmatter additions — no content changes. The existing `name` and `description` frontmatter from upstream is already correct.

- [ ] **Step 1: Copy each SKILL.md verbatim from obra/superpowers v5.0.0**

For each skill: copy the upstream SKILL.md as-is. The frontmatter is already present in v5.0.0 (they added it in v3.0.1 when switching to the skills system).

Also copy supplementary files:
- `skills/test-driven-development/testing-anti-patterns.md`
- `skills/systematic-debugging/` supplementary files: `condition-based-waiting.md`, `condition-based-waiting-example.ts`, `defense-in-depth.md`, `root-cause-tracing.md`, `find-polluter.sh`
- `skills/writing-skills/` supplementary files: `anthropic-best-practices.md`, `persuasion-principles.md`, `testing-skills-with-subagents.md`, `graphviz-conventions.dot`

Do NOT copy: test files, CREATION-LOG.md, or test-pressure-*.md files (these are development artifacts, not runtime files).

- [ ] **Step 2: Verify all files have valid frontmatter with name and description**

Run: `grep -l "^---" skills/*/SKILL.md | head -20`
Expected: All SKILL.md files listed

- [ ] **Step 3: Commit**

```bash
git add skills/test-driven-development/ skills/systematic-debugging/ skills/verification-before-completion/ skills/executing-plans/ skills/finishing-a-development-branch/ skills/receiving-code-review/ skills/writing-skills/
git commit -m "feat: port 7 skills from superpowers v5.0.0 (no Pi-specific changes needed)"
```

---

### Task 9: Port skills that need Pi-specific adaptations

**Files:**
- Create: `skills/using-superpowers/SKILL.md`
- Create: `skills/subagent-driven-development/SKILL.md`
- Create: `skills/dispatching-parallel-agents/SKILL.md`
- Create: `skills/requesting-code-review/SKILL.md`
- Create: `skills/using-git-worktrees/SKILL.md`
- Create: `skills/brainstorming/SKILL.md`
- Create: `skills/writing-plans/SKILL.md`

Each skill is copied from upstream v5.0.0 with these modifications:

**`using-superpowers/SKILL.md`:**
- In "How to Access Skills" section, add Pi platform:
  ```
  **In Pi:** Skills are auto-triggered based on their description matching your intent. You can also invoke them via `/skill-name` slash commands.
  ```
- In "Platform Adaptation" section, replace Codex/Gemini references with Pi tool mapping reference
- Add a `references/pi-tools.md` file with the Pi tool equivalents table

**`subagent-driven-development/SKILL.md`:**
- Replace all `Task` tool examples with `subagent` tool syntax
- Replace the implementer dispatch pattern:
  - Before: `Task(agent="implementer", prompt="...")`
  - After: `subagent({ agent: "worker", task: "..." })`
- Replace two-stage review dispatch with chain mode:
  - After: `subagent({ chain: [{ agent: "worker", task: "implement..." }, { agent: "code-reviewer", task: "review {previous}" }] })`
- Add `## Pi Platform Notes` section at end

**`dispatching-parallel-agents/SKILL.md`:**
- Replace `Agent` tool parallel dispatch with `subagent` parallel mode:
  - Before: dispatch multiple `Agent` tools simultaneously
  - After: `subagent({ tasks: [{ agent: "worker", task: "..." }, ...] })`
- Add `## Pi Platform Notes` section

**`requesting-code-review/SKILL.md`:**
- Replace code-reviewer subagent dispatch:
  - Before: dispatch `superpowers:code-reviewer` via Task
  - After: `subagent({ agent: "code-reviewer", task: "Review changes between <base-sha> and <head-sha>..." })`
- Add `## Pi Platform Notes` section
- Also copy `code-reviewer.md` prompt template if present

**`using-git-worktrees/SKILL.md`:**
- Remove references to `EnterWorktree` and `ExitWorktree` tools
- Replace with direct `git worktree add/remove` bash commands
- Add `## Pi Platform Notes` section

**`brainstorming/SKILL.md`:**
- Update spec output path from `docs/plans/` to `docs/superpowers/specs/`
- Copy `spec-document-reviewer-prompt.md` supplementary file
- Note: visual companion (`visual-companion.md` and `scripts/`) is a Claude Code-specific feature (runs a local HTTP server). Skip for Pi port — add note in `## Pi Platform Notes`.

**`writing-plans/SKILL.md`:**
- Update plan output path to `docs/superpowers/plans/`
- Copy `plan-document-reviewer-prompt.md` supplementary file
- Update execution handoff section to reference Pi's subagent tool instead of Task

- [ ] **Step 1: Create each adapted skill file**

For each skill, start from the upstream v5.0.0 content and apply the changes listed above. Keep changes minimal — only modify what's needed for Pi compatibility. All adaptations go in a `## Pi Platform Notes` section at the end of the file.

Also copy supplementary files:
- `skills/subagent-driven-development/`: `code-quality-reviewer-prompt.md`, `implementer-prompt.md`, `spec-reviewer-prompt.md`
- `skills/brainstorming/`: `spec-document-reviewer-prompt.md`
- `skills/writing-plans/`: `plan-document-reviewer-prompt.md`
- `skills/requesting-code-review/`: `code-reviewer.md`

- [ ] **Step 2: Verify no Chinese characters in any skill file**

Run: `grep -rP '[\x{4e00}-\x{9fff}]' skills/ || echo "No Chinese characters found"`
Expected: "No Chinese characters found"

- [ ] **Step 3: Verify all SKILL.md files have valid frontmatter**

Run: `for f in skills/*/SKILL.md; do head -1 "$f"; done`
Expected: All files start with `---`

- [ ] **Step 4: Commit**

```bash
git add skills/using-superpowers/ skills/subagent-driven-development/ skills/dispatching-parallel-agents/ skills/requesting-code-review/ skills/using-git-worktrees/ skills/brainstorming/ skills/writing-plans/
git commit -m "feat: port 7 skills with Pi platform adaptations"
```

---

## Chunk 5: Prompts, Tests & Documentation

### Task 10: Create prompt files

**Files:**
- Create: `prompts/brainstorm.md`
- Create: `prompts/write-plan.md`
- Create: `prompts/execute-plan.md`

- [ ] **Step 1: Create prompts/brainstorm.md**

```markdown
---
description: Start a brainstorming session to design a feature or system before implementation
---
Use the superpowers:brainstorming skill to guide a collaborative design session for: $@
```

- [ ] **Step 2: Create prompts/write-plan.md**

```markdown
---
description: Create a detailed implementation plan for a feature or task
---
Use the superpowers:writing-plans skill to create a detailed implementation plan for: $@
```

- [ ] **Step 3: Create prompts/execute-plan.md**

```markdown
---
description: Execute an existing implementation plan step by step
---
Use the superpowers:executing-plans skill to implement the plan for: $@
```

- [ ] **Step 4: Commit**

```bash
git add prompts/
git commit -m "feat: add slash command prompts (brainstorm, write-plan, execute-plan)"
```

---

### Task 11: Create skills validation test

**Files:**
- Create: `tests/skills.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SKILLS_DIR = path.join(import.meta.dirname, "..", "skills");
const EXPECTED_SKILLS = [
  "brainstorming",
  "dispatching-parallel-agents",
  "executing-plans",
  "finishing-a-development-branch",
  "receiving-code-review",
  "requesting-code-review",
  "subagent-driven-development",
  "systematic-debugging",
  "test-driven-development",
  "using-git-worktrees",
  "using-superpowers",
  "verification-before-completion",
  "writing-plans",
  "writing-skills",
];

describe("skills", () => {
  it("has all 14 expected skill directories", () => {
    const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    expect(dirs).toEqual(EXPECTED_SKILLS.sort());
  });

  for (const skill of EXPECTED_SKILLS) {
    describe(skill, () => {
      const skillPath = path.join(SKILLS_DIR, skill, "SKILL.md");

      it("has a SKILL.md file", () => {
        expect(fs.existsSync(skillPath)).toBe(true);
      });

      it("has valid frontmatter with name and description", () => {
        const content = fs.readFileSync(skillPath, "utf-8");
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        expect(match).not.toBeNull();

        const frontmatter = match![1];
        expect(frontmatter).toMatch(/^name:\s*.+/m);
        expect(frontmatter).toMatch(/^description:\s*.+/m);
      });

      it("contains no Chinese characters", () => {
        const content = fs.readFileSync(skillPath, "utf-8");
        expect(content).not.toMatch(/[\u4e00-\u9fff]/);
      });
    });
  }
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/skills.test.ts`
Expected: All 14 skills pass validation (after skills are created in Tasks 8-9)

- [ ] **Step 3: Commit**

```bash
git add tests/skills.test.ts
git commit -m "test: add skills validation (frontmatter, no Chinese characters)"
```

---

### Task 12: Create README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README.md**

Include:
- Package name and description
- Installation instructions (npm and git)
- What's included (2 extensions, 14 skills, 4 agents, 3 prompts)
- Brief description of each skill
- Agent descriptions
- Subagent usage examples (single, parallel, chain)
- Credits (obra/superpowers, weiping/pi-superpowers for Pi extension patterns, pi-mono subagent example)
- License (MIT)

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with installation, usage, and credits"
```

---

### Task 13: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors (or only expected Pi runtime type warnings)

- [ ] **Step 3: Verify no Chinese characters anywhere**

Run: `grep -rP '[\x{4e00}-\x{9fff}]' --include='*.md' --include='*.ts' . || echo "Clean"`
Expected: "Clean"

- [ ] **Step 4: Verify all 14 skills present**

Run: `ls -d skills/*/SKILL.md | wc -l`
Expected: `14`

- [ ] **Step 5: Verify all 4 agents present**

Run: `ls agents/*.md | wc -l`
Expected: `4`

- [ ] **Step 6: Test install locally in Pi (manual)**

Run: `pi install .` from the project root
Expected: Extension loads without errors. `using-superpowers` content appears in session context. `subagent` tool is registered.

- [ ] **Step 7: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: final adjustments from verification"
```

# Pi Superpowers Extension Design

**Date:** 2026-03-11
**Package:** `@sartoris/pi-superpowers`
**Based on:** [obra/superpowers v5.0.0](https://github.com/obra/superpowers)
**Reference:** [weiping/pi-superpowers](https://github.com/weiping/pi-superpowers) (Chinese port, used for Pi extension patterns only)

## Overview

A full English-only port of obra/superpowers for the [Pi](https://pi.dev) coding agent platform. Includes two TypeScript extensions (bootstrap + subagent), 14 adapted skills, 4 agent definitions, and 3 slash command prompts.

## Key Decisions

1. **Full port** — bootstrap + subagent extensions, 14 skills, 3 prompts, 4 agents
2. **English only** — no Chinese content anywhere, validated by tests
3. **v5.0.0 base** — latest obra/superpowers with Pi adaptation sections
4. **Official subagent pattern** — adapted from [pi-mono subagent example](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/subagent), supports parallel (4 concurrent), chain, and single modes
5. **`@sartoris/pi-superpowers`** — installable via npm or git
6. **Overridable agents** — bundled agents are lowest priority, users can customize via `.pi/agents/` or `~/.pi/agent/agents/`

## Package Structure

```
pi-superpowers/
├── package.json                     # @sartoris/pi-superpowers, pi extension config
├── tsconfig.json                    # ES2022, NodeNext
├── LICENSE                          # MIT (matching upstream)
├── README.md
├── extensions/
│   ├── bootstrap.ts                 # Session-start skill injection
│   ├── bootstrap-utils.ts           # Pure functions for content assembly
│   ├── subagent.ts                  # Subagent tool (adapted from official example)
│   ├── subagent-utils.ts            # Agent discovery, concurrency helpers
│   └── agents.ts                    # Agent file parsing & discovery
├── agents/                          # Superpowers-tuned agent definitions
│   ├── code-reviewer.md             # From obra/superpowers, for review skills
│   ├── scout.md                     # Fast recon (haiku)
│   ├── planner.md                   # Read-only planning (sonnet)
│   └── worker.md                    # Full execution (sonnet)
├── skills/                          # 14 skills from obra/superpowers v5.0.0
│   ├── brainstorming/SKILL.md
│   ├── dispatching-parallel-agents/SKILL.md
│   ├── executing-plans/SKILL.md
│   ├── finishing-a-development-branch/SKILL.md
│   ├── receiving-code-review/SKILL.md
│   ├── requesting-code-review/SKILL.md
│   ├── subagent-driven-development/SKILL.md
│   ├── systematic-debugging/SKILL.md
│   ├── test-driven-development/SKILL.md
│   ├── using-git-worktrees/SKILL.md
│   ├── using-superpowers/SKILL.md
│   ├── verification-before-completion/SKILL.md
│   ├── writing-plans/SKILL.md
│   └── writing-skills/SKILL.md
├── prompts/                         # English-only slash command prompts
│   ├── brainstorm.md
│   ├── write-plan.md
│   └── execute-plan.md
├── tests/                           # Vitest test suite
│   ├── bootstrap-utils.test.ts
│   ├── subagent-utils.test.ts
│   ├── agents.test.ts
│   └── skills.test.ts
└── docs/
    └── superpowers/                 # Where specs/plans get written by skills
        ├── specs/
        └── plans/
```

**`package.json` pi key:**
```json
{
  "pi": {
    "extensions": ["./extensions/bootstrap.ts", "./extensions/subagent.ts"],
    "skills": ["./skills"],
    "prompts": ["./prompts"]
  }
}
```

## Bootstrap Extension

Injects the `using-superpowers` skill content into every session so the agent knows about available skills.

**Mechanism:** Uses the `context` event (Pi's idiomatic persistent context injection). Falls back to `before_agent_start` if `context` isn't available.

```typescript
export default function (pi: ExtensionAPI) {
  pi.on("context", (event, ctx) => {
    return {
      sections: [{
        title: "Superpowers Skills Framework",
        content: buildBootstrapContent()
      }]
    };
  });
}
```

**`bootstrap-utils.ts`** — pure functions:
- `buildBootstrapContent()` — reads `using-superpowers/SKILL.md`, strips YAML frontmatter, appends Pi tool mapping table
- `buildPiToolMapping()` — returns markdown table mapping superpowers concepts to Pi tools:

| Superpowers Concept | Pi Equivalent |
|---|---|
| `Skill` tool | `/skill:<name>` or auto-triggered |
| `Agent` / `Task` tool | `subagent` tool (single/parallel/chain) |
| `EnterPlanMode` | Not available — use planning skills |
| Git worktrees | Native git via bash |

**Key differences from weiping:**
- No Chinese content
- Uses `context` event instead of `before_agent_start`
- Content assembled at load time, not on every event fire

## Subagent Extension

Adapted from the [official Pi subagent example](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/subagent).

**Three modes:**

1. **Single** — `{ agent: "worker", task: "implement feature X" }`
2. **Parallel** — `{ tasks: [{ agent: "worker", task: "..." }, ...] }` — up to 8 tasks, 4 concurrent
3. **Chain** — `{ chain: [{ agent: "scout", task: "..." }, { agent: "planner", task: "using {previous}" }] }` — sequential handoff

**Subprocess spawning:** Each agent runs as `pi --mode json -p --no-session` with model, tools, and system prompt args.

**Parallel execution:** Work-stealing pool (`mapWithConcurrencyLimit`), streaming updates via `onUpdate`.

**Agent discovery** (priority order):
1. Project agents (`.pi/agents/` walking up from cwd) — highest
2. User agents (`~/.pi/agent/agents/`)
3. Bundled agents (our `agents/` directory) — lowest

**Superpowers-specific additions:**
- Bundled agents directory as third discovery source
- `promptGuidelines` pointing to relevant superpowers skills

**TUI rendering:** Agent name, model, task, streaming output, token usage.

## Agent Definitions

| Agent | Model | Tools | Purpose |
|---|---|---|---|
| `code-reviewer.md` | claude-sonnet-4-5 | read, grep, find, ls, bash | Code review against specs, bugs, security, style |
| `scout.md` | claude-haiku-4-5 | read, grep, find, ls, bash | Fast recon, structured context for handoff |
| `planner.md` | claude-sonnet-4-5 | read, grep, find, ls | Read-only planning, atomic task breakdown |
| `worker.md` | claude-sonnet-4-5 | all | Full execution, follows superpowers principles |

- Agent system prompts reference superpowers skills by name
- Scout uses Haiku for speed/cost; others use Sonnet
- All overridable via same-named `.md` in project/user agent directories

## Skills Adaptation

All 14 skills from obra/superpowers v5.0.0 with:

**Frontmatter additions:**
```yaml
---
name: brainstorming
description: Use before any creative work...
---
```

**Pi platform adaptation sections** (appended as `## Pi Platform Notes`):

| Skill | Adaptation |
|---|---|
| `using-superpowers` | Replace Claude Code tool table with Pi equivalents |
| `subagent-driven-development` | Replace `Task` tool examples with `subagent` syntax |
| `dispatching-parallel-agents` | Replace `Agent` tool dispatch with `subagent` parallel mode |
| `requesting-code-review` | Replace `Task` dispatch with `subagent` single mode |
| `using-git-worktrees` | Remove `EnterWorktree`/`ExitWorktree`, use git directly |
| `brainstorming` | Update spec output path to `docs/superpowers/specs/` |
| `writing-plans` | Update plan output path to `docs/superpowers/plans/` |

**No changes needed** (beyond frontmatter): test-driven-development, systematic-debugging, verification-before-completion, executing-plans, finishing-a-development-branch, receiving-code-review, writing-skills.

## Prompts

| File | Command | Description |
|---|---|---|
| `brainstorm.md` | `/brainstorm` | Triggers brainstorming skill |
| `write-plan.md` | `/write-plan` | Triggers writing-plans skill |
| `execute-plan.md` | `/execute-plan` | Triggers executing-plans skill |

## Testing

Vitest test suite:

| Test File | Covers |
|---|---|
| `bootstrap-utils.test.ts` | Content assembly, frontmatter stripping, tool mapping |
| `subagent-utils.test.ts` | Config parsing, CLI arg building, concurrency helper |
| `agents.test.ts` | Discovery priority, frontmatter parsing, tool list parsing |
| `skills.test.ts` | All 14 SKILL.md files have valid frontmatter, no Chinese characters |

## Installation

```bash
# From npm
pi install npm:@sartoris/pi-superpowers

# From git
pi install github:sartoris/pi-superpowers
```

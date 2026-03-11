> **Unified config:** Model overrides now use `.pi/superpowers.json` (applies to ALL agent dispatch, not just code review). The `.pi/code-review.json` format is still supported as a fallback. See below for details.

# Model Configuration for Code Review

The code review pipeline uses three model tiers. Each tier maps to a role in the pipeline. The defaults use Claude models, but you can override them for any provider Pi supports.

## Default Model Mapping

| Role | Default Model | Agent | Pipeline Steps |
|------|--------------|-------|----------------|
| **fast** (pre-flight, discovery) | `claude-haiku-4-5` | scout | Steps 1, 2 |
| **standard** (compliance, summary) | `claude-sonnet-4-6` | code-reviewer | Steps 3, 4a-b |
| **reasoning** (bugs, validation) | `claude-opus-4-6` | bug-hunter, issue-validator | Steps 4c-d, 5 |

## How to Override Models

### Option 1: Project-Level Agent Overrides (Recommended)

Pi's agent discovery has 3-tier priority: **project > user > bundled**. Create project-level agents in `.pi/agents/` that override the bundled agents with your preferred models.

Example: Override all agents to use GPT models:

```bash
mkdir -p .pi/agents
```

`.pi/agents/scout.md`:
```markdown
---
name: scout
description: Fast codebase recon that returns compressed context for handoff to other agents
tools: read, grep, find, ls, bash
model: gpt-4.1-mini
---

[copy system prompt from bundled scout agent]
```

`.pi/agents/bug-hunter.md`:
```markdown
---
name: bug-hunter
description: Deep bug analysis of pull request diffs
tools: read, grep, find, ls, bash
model: gpt-4.1
---

[copy system prompt from bundled bug-hunter agent]
```

`.pi/agents/code-reviewer.md`:
```markdown
---
name: code-reviewer
description: Reviews code against specs and standards
tools: read, grep, find, ls, bash
model: gpt-4.1-mini
---

[copy system prompt from bundled code-reviewer agent]
```

`.pi/agents/issue-validator.md`:
```markdown
---
name: issue-validator
description: Independently verifies a single code review issue
tools: read, grep, find, ls, bash
model: gpt-4.1
---

[copy system prompt from bundled issue-validator agent]
```

**Advantage:** Works with Pi's existing agent discovery — no extra configuration needed. Overrides apply to ALL uses of these agents, not just code review.

### Option 2: Code Review Config File

For code-review-specific model overrides that don't affect other agent uses, create a `.pi/code-review.json` file:

```json
{
  "models": {
    "fast": "gpt-4.1-mini",
    "standard": "gpt-4.1-mini",
    "reasoning": "gpt-4.1"
  }
}
```

When the orchestrating agent finds this file in Step 1 (pre-flight), it should instruct each subagent dispatch to append a model override note to the task prompt:

```
NOTE: Use model "{MODEL}" for this task (overridden by .pi/code-review.json).
```

**The agent definition's `model` field is the default.** The config file override is advisory — the orchestrating agent reads it and adjusts dispatch accordingly. This does NOT require changes to the subagent tool; it's a convention the orchestrating skill follows.

### Option 3: User-Level Agent Overrides

For overrides across all projects, place agent files in `~/.pi/agent/agents/`. Same format as project-level, but lower priority (project overrides user overrides bundled).

## Model Tier Guidelines

When choosing alternative models, match capabilities to the role:

| Role | Minimum Capability | Why |
|------|-------------------|-----|
| **fast** | Fast, cheap, can follow instructions | Only doing lookups and simple checks |
| **standard** | Good at structured analysis, rule matching | Needs to compare code against written rules |
| **reasoning** | Strong at complex reasoning, bug detection | Must identify subtle logic errors and verify claims |

## Example Configurations

### All Claude (Default)
No config needed — bundled agents use Claude models.

### All GPT
```json
{ "models": { "fast": "gpt-4.1-mini", "standard": "gpt-4.1-mini", "reasoning": "gpt-4.1" } }
```

### All Gemini
```json
{ "models": { "fast": "gemini-2.5-flash", "standard": "gemini-2.5-flash", "reasoning": "gemini-2.5-pro" } }
```

### Mixed (Cost-Optimized)
```json
{ "models": { "fast": "gemini-2.5-flash", "standard": "claude-sonnet-4-6", "reasoning": "claude-opus-4-6" } }
```

### Local Models
```json
{ "models": { "fast": "ollama/qwen3:8b", "standard": "ollama/qwen3:32b", "reasoning": "ollama/qwen3:72b" } }
```

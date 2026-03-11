# @sartoris/pi-superpowers

Superpowers skills framework for [Pi](https://pi.dev) — TDD, debugging, collaboration patterns, and proven development techniques.

A full English port of [obra/superpowers](https://github.com/obra/superpowers) v5.0.0 for the Pi coding agent platform.

## Installation

```bash
# From npm
pi install npm:@sartoris/pi-superpowers

# From git
pi install https://github.com/sartoris-digital/pi-superpowers
```

## What's Included

### Extensions

| Extension | Purpose |
|---|---|
| **bootstrap** | Injects the using-superpowers skill into every Pi session via the `context` event |
| **subagent** | Registers a `subagent` tool for delegating tasks to specialized agents |

### Skills (16)

| Skill | Description |
|---|---|
| **using-superpowers** | Meta-skill: when and how to invoke other skills |
| **brainstorming** | Design-first workflow with collaborative question-driven design |
| **writing-plans** | Create detailed implementation plans with atomic tasks |
| **executing-plans** | Execute implementation plans task by task |
| **subagent-driven-development** | Dispatch subagents per task with two-stage review |
| **dispatching-parallel-agents** | Parallel agent dispatch for independent subsystems |
| **test-driven-development** | Strict Red-Green-Refactor TDD enforcement |
| **systematic-debugging** | Four-phase root cause debugging methodology |
| **verification-before-completion** | Evidence-based completion claims |
| **code-review** | Multi-agent code review pipeline with parallel review and validation |
| **security-review** | Multi-agent security audit with vulnerability validation and false-positive filtering |
| **requesting-code-review** | Dispatch quick single-agent code review after task completion |
| **receiving-code-review** | How to respond to review feedback |
| **using-git-worktrees** | Isolated workspaces for feature branches |
| **finishing-a-development-branch** | End-of-work workflow (merge/PR/preserve/discard) |
| **writing-skills** | How to create new skills |

### Agents (7)

| Agent | Model | Purpose |
|---|---|---|
| **scout** | claude-haiku-4-5 | Fast codebase recon for handoff |
| **planner** | claude-sonnet-4-6 | Read-only implementation planning |
| **worker** | claude-sonnet-4-6 | Full-capability task execution |
| **code-reviewer** | claude-sonnet-4-6 | Code review against specs and standards, compliance auditing |
| **bug-hunter** | claude-opus-4-6 | Deep bug analysis of PR diffs (diff-only and context-aware modes) |
| **security-reviewer** | claude-opus-4-6 | 3-phase security audit with vulnerability assessment and exploit scenarios |
| **issue-validator** | claude-opus-4-6 | Independent verification of flagged code review issues |

### Prompts (5)

| Command | Description |
|---|---|
| `/brainstorm` | Start a brainstorming session |
| `/write-plan` | Create an implementation plan |
| `/execute-plan` | Execute an existing plan |
| `/code-review` | Run a multi-agent code review on a PR or branch diff |
| `/security-review` | Run a security-focused review to identify exploitable vulnerabilities |

## Subagent Usage

The `subagent` tool supports three modes:

**Single agent:**
```json
{ "agent": "worker", "task": "implement user authentication" }
```

**Parallel (independent tasks, up to 8 tasks / 4 concurrent):**
```json
{ "tasks": [
  { "agent": "worker", "task": "fix auth module" },
  { "agent": "worker", "task": "fix payment module" }
]}
```

**Chain (sequential handoff with `{previous}` placeholder):**
```json
{ "chain": [
  { "agent": "scout", "task": "find code related to auth" },
  { "agent": "planner", "task": "plan changes using {previous}" },
  { "agent": "worker", "task": "implement: {previous}" }
]}
```

## Agent Customization

Agents are discovered from three sources (highest priority first):

1. **Project agents** — `.pi/agents/` in your project directory
2. **User agents** — `~/.pi/agent/agents/`
3. **Bundled agents** — shipped with this package

Override any bundled agent by creating a `.md` file with the same `name` in your project or user agents directory.

## Multi-Agent Code Review

The `/code-review` command runs a comprehensive review pipeline that orchestrates multiple agents across model tiers:

```
Pre-flight (scout/haiku) → Config discovery (scout/haiku) → Summarize (sonnet)
→ Parallel review: 2× compliance audit (sonnet) + 2× bug hunt (opus)
→ Validate each issue independently (opus/sonnet) → Filter → Report
```

Only high-signal, independently validated issues are reported. See `skills/code-review/SKILL.md` for full pipeline documentation.

### Model Configuration

The pipeline defaults to Claude models but supports any provider Pi can use. Override models via:

1. **Project agent overrides** — Create `.pi/agents/<agent>.md` with your preferred `model:` in frontmatter
2. **Config file** — Create `.pi/code-review.json` with tier-based overrides:
   ```json
   { "models": { "fast": "gpt-4.1-mini", "standard": "gpt-4.1-mini", "reasoning": "gpt-4.1" } }
   ```
3. **User agent overrides** — Place agent files in `~/.pi/agent/agents/` for cross-project defaults

See `skills/code-review/model-config.md` for full configuration documentation with examples for Claude, GPT, Gemini, and local models.

## Security Review

The `/security-review` command runs a multi-agent security audit focused on exploitable vulnerabilities with minimal false positives:

```
Context gathering (scout/haiku) → Security audit (security-reviewer/opus)
→ Hard filter (exclusion rules) → Validate each finding (issue-validator/opus) → Report
```

Features:
- 3-phase methodology: context research, comparative analysis, vulnerability assessment
- Hard exclusion rules filter out known false-positive categories (DOS, rate limiting, etc.)
- Independent validation of each finding before reporting
- Customizable via `.pi/security-instructions.txt` and `.pi/security-exclusions.txt`
- Can run standalone or integrated into the code-review pipeline

See `skills/security-review/SKILL.md` for full pipeline documentation.

## Credits

- [obra/superpowers](https://github.com/obra/superpowers) by Jesse Vincent — original skills framework
- [pi-mono subagent example](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/subagent) by Mario Zechner — subagent extension architecture
- [weiping/pi-superpowers](https://github.com/weiping/pi-superpowers) — reference for Pi extension patterns

## License

MIT

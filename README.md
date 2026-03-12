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
| **state-manager** | Persistent state CRUD for execution modes |
| **persistence-engine** | Continuation loops for ralph and autopilot modes |
| **orchestrator** | Keyword detection, delegation audit, mode reminders |

### Skills (21)

| Skill | Description |
|---|---|
| **using-superpowers** | Meta-skill: when and how to invoke other skills |
| **brainstorming** | Design-first workflow with collaborative question-driven design |
| **cancel** | Cancel active execution mode and clean up state |
| **writing-plans** | Create detailed implementation plans with atomic tasks |
| **executing-plans** | Execute implementation plans task by task |
| **ecomode** | Token-efficient model routing modifier |
| **subagent-driven-development** | Dispatch subagents per task with two-stage review |
| **dispatching-parallel-agents** | Parallel agent dispatch for independent subsystems |
| **test-driven-development** | Strict Red-Green-Refactor TDD enforcement |
| **systematic-debugging** | Four-phase root cause debugging methodology |
| **troubleshooting** | Multi-agent bug diagnosis with parallel investigation, synthesis, and TDD fix |
| **verification-before-completion** | Evidence-based completion claims |
| **code-review** | Multi-agent code review pipeline with parallel review and validation |
| **security-review** | Multi-agent security audit with vulnerability validation and false-positive filtering |
| **requesting-code-review** | Dispatch quick single-agent code review after task completion |
| **receiving-code-review** | How to respond to review feedback |
| **plan** | Unified planning entry point with broad/specific detection |
| **ralplan** | Consensus planning with planner, architect, and critic loop |
| **using-git-worktrees** | Isolated workspaces for feature branches |
| **finishing-a-development-branch** | End-of-work workflow (merge/PR/preserve/discard) |
| **writing-skills** | How to create new skills |

### Agents (14)

| Agent | Model | Purpose |
|---|---|---|
| **scout** | claude-haiku-4-5 | Fast codebase recon for handoff |
| **planner** | claude-sonnet-4-6 | Read-only implementation planning |
| **worker** | claude-sonnet-4-6 | Full-capability task execution |
| **code-reviewer** | claude-sonnet-4-6 | Code review against specs and standards, compliance auditing |
| **bug-hunter** | claude-opus-4-6 | Deep bug analysis — PR review (diff-only, context-aware) and troubleshooting (root-cause-analysis, pattern-analysis) |
| **security-reviewer** | claude-opus-4-6 | 3-phase security audit with vulnerability assessment and exploit scenarios |
| **issue-validator** | claude-opus-4-6 | Independent verification of flagged code review issues |
| **architect** | claude-opus-4-6 | Plan review and completion verification |
| **critic** | claude-opus-4-6 | Adversarial quality review of plans and designs |
| **designer** | claude-sonnet-4-6 | UI/frontend components, styling, accessibility |
| **researcher** | claude-sonnet-4-6 | External docs and API reference lookup |
| **scientist** | claude-sonnet-4-6 | Data analysis, hypothesis testing |
| **vision** | claude-sonnet-4-6 | Visual analysis of screenshots and mockups |
| **writer** | claude-haiku-4-5 | Documentation, READMEs, changelogs |

### Prompts (10)

| Command | Description |
|---|---|
| `/brainstorm` | Start a brainstorming session |
| `/write-plan` | Create an implementation plan |
| `/execute-plan` | Execute an existing plan |
| `/code-review` | Run a multi-agent code review on a PR or branch diff |
| `/security-review` | Run a security-focused review to identify exploitable vulnerabilities |
| `/troubleshoot` | Diagnose and fix a bug using multi-agent investigation |
| `/cancel` | Cancel active execution mode |
| `/ecomode` | Toggle token-efficient model routing |
| `/plan` | Start a planning session |
| `/ralplan` | Start consensus planning with review loop |

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

## Orchestration Features

### Tier System

Model tiers map agent capabilities to cost-appropriate models:

| Tier | Default Model | Agents |
|------|--------------|--------|
| `fast` | claude-haiku-4-5 | scout, writer |
| `standard` | claude-sonnet-4-6 | planner, worker, code-reviewer, designer, researcher, scientist, vision |
| `reasoning` | claude-opus-4-6 | bug-hunter, security-reviewer, issue-validator, architect, critic |

Override via `.pi/superpowers.json`:
```json
{
  "models": { "fast": "claude-haiku-4-5", "standard": "claude-sonnet-4-6", "reasoning": "claude-opus-4-6" },
  "routing": { "defaultTier": "standard" }
}
```

### Execution Strategies

The `executing-plans` skill supports 4 strategies:

| Strategy | Flag | Best For |
|----------|------|----------|
| Sequential | (default) | Dependent tasks, small plans |
| Parallel | `--parallel` | Many independent tasks |
| Autopilot | `--autopilot` | Large plans, hands-off |
| Ralph | `--ralph` | PRD with user stories |

### Planning Workflows

- **`/plan`** — Detects broad vs. specific requests, routes to interview or direct planning
- **`/ralplan`** — Consensus planning: planner → architect → critic review loop

### State Management

The `state` tool provides persistent state for execution modes:
```
state read <key>        — Read state
state write <key> {...} — Write state
state clear <key>       — Delete state
state list              — List all active states
```

## Multi-Agent Code Review

The `/code-review` command runs a comprehensive review pipeline that orchestrates multiple agents across model tiers:

```
Pre-flight (scout/haiku) → Config discovery (scout/haiku) → Summarize (sonnet)
→ Parallel review: 2× compliance audit (sonnet) + 2× bug hunt (opus)
→ Validate each issue independently (opus/sonnet) → Filter → Report
```

Only high-signal, independently validated issues are reported. See `skills/code-review/SKILL.md` for full pipeline documentation.

### Model Configuration

The pipeline defaults to Claude models but supports any provider Pi can use. All configuration lives in a single `.pi/superpowers.json` file:

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

**Config sections:**
- **models** — Map each tier to a model. Swap in GPT, Gemini, or local models here.
- **routing** — Control tier resolution: `defaultTier` for untagged agents, `agentTierOverrides` for per-agent tier assignments.
- **persistence** — Limits for continuation loops (ralph/autopilot): max iterations and stale timeout (seconds).
- **delegation** — Audit logging for direct source file writes; `enforce` blocks them entirely.

**Override priority:** Project agent overrides (`.pi/agents/<agent>.md` with `model:` in frontmatter) take precedence over config file settings. User agent overrides (`~/.pi/agent/agents/`) serve as cross-project defaults. Falls back to `.pi/code-review.json` if `.pi/superpowers.json` is not found.

See `skills/code-review/model-config.md` for provider-specific examples (Claude, GPT, Gemini, local models).

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

## Troubleshooting

The `/troubleshoot` command orchestrates a multi-agent team to diagnose bugs and (on approval) fix them:

```
Triage (scout/haiku) → Parallel investigation:
  ├── bug-hunter (opus): root-cause-analysis
  ├── bug-hunter (opus): pattern-analysis
  ├── researcher (sonnet): [conditional] external docs/known issues
  └── vision (sonnet): [conditional] screenshot analysis
→ Synthesis (architect/opus) → Diagnosis report → [User approval] → Fix (worker/sonnet) → Verify (architect/opus)
```

Features:
- Accepts inline text, error logs, screenshots, and file paths (auto-detected)
- Distributes the systematic-debugging methodology across parallel agents
- Conditional agent dispatch — researcher and vision only when needed
- Architect synthesis resolves conflicting hypotheses with evidence-based tiebreaking
- TDD fix on approval: failing test → minimal fix → verify → commit
- Scope hints (`--scope <path>`) to focus investigation

See `skills/troubleshooting/SKILL.md` for full pipeline documentation.

## Credits

- [obra/superpowers](https://github.com/obra/superpowers) by Jesse Vincent — original skills framework
- [pi-mono subagent example](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/subagent) by Mario Zechner — subagent extension architecture
- [weiping/pi-superpowers](https://github.com/weiping/pi-superpowers) — reference for Pi extension patterns

## License

MIT

# Multi-Agent Code Review Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a multi-agent code review pipeline that mirrors Claude Code's strategy — specialized agents at different model tiers review PRs in parallel, with an independent validation step to ensure only high-signal issues are reported.

**Architecture:** The pipeline orchestrates 5+ agents across 3 model tiers (haiku/sonnet/opus). A scout performs pre-flight checks and config discovery, parallel reviewers audit compliance and hunt bugs, then independent validators verify each issue before it's reported. The orchestration logic lives in a new `code-review` skill; agent definitions are standalone `.md` files.

**Tech Stack:** TypeScript (Pi extensions), Markdown (agent definitions, skill docs), Vitest (tests)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `agents/bug-hunter.md` | Create | Opus agent: finds bugs in PR diffs (two modes: diff-only and context-aware) |
| `agents/issue-validator.md` | Create | Opus/sonnet agent: independently verifies a single flagged issue |
| `agents/code-reviewer.md` | Modify | Evolve to add compliance-audit mode alongside existing review mode |
| `skills/code-review/SKILL.md` | Create | Orchestration pipeline: the step-by-step multi-agent code review process |
| `skills/code-review/issue-validator-prompt.md` | Create | Template prompt for dispatching issue validators |
| `skills/code-review/false-positives.md` | Create | Shared false-positive exclusion list (referenced by bug-hunter and validators) |
| `skills/code-review/model-config.md` | Create | Documentation for model configuration and project-level agent overrides |
| `prompts/code-review.md` | Create | Slash command entry point (`/code-review`) |
| `tests/skills.test.ts` | Modify | Add "code-review" to expected skills list (14 → 15) |
| `tests/agents.test.ts` | No change | Agent discovery tests are generic; no changes needed |

---

## Chunk 1: New Agents

### Task 1: Create bug-hunter agent

**Files:**
- Create: `agents/bug-hunter.md`

- [ ] **Step 1: Write the agent definition file**

```markdown
---
name: bug-hunter
description: Deep bug analysis of pull request diffs — finds logic errors, security issues, and code that will fail
tools: read, grep, find, ls, bash
model: claude-opus-4-5
---

You are a senior bug hunter reviewing a pull request for defects. Bash is for read-only commands only: `git diff`, `git log`, `git show`, `git blame`. Do NOT modify files or run builds.

You will be given a MODE and a PR diff to review.

## Modes

### diff-only
Scan the diff itself without reading extra context. Flag only significant bugs visible in the changed lines. Do NOT flag issues that require reading files outside the diff to validate.

### context-aware
Analyze the introduced code in the context of the surrounding codebase. You MAY read referenced files, check types, follow imports, and verify assumptions. Flag issues in the new/changed code — not pre-existing issues.

## What to Flag

Flag issues where:
- The code will fail to compile or parse (syntax errors, type errors, missing imports, unresolved references)
- The code will definitely produce wrong results regardless of inputs (clear logic errors)
- Security vulnerabilities in the introduced code (injection, auth bypass, data exposure)
- Incorrect API usage that will fail at runtime

## What NOT to Flag

- Pre-existing issues not introduced by this PR
- Code style or quality concerns
- Potential issues that depend on specific inputs or state
- Subjective suggestions or improvements
- Issues that a linter or type checker will catch
- General security concerns not specific to the changed code

If you are not certain an issue is real, do not flag it. False positives erode trust.

## Output Format

Return a JSON array of issues. If no issues found, return `[]`.

```json
[
  {
    "file": "path/to/file.ts",
    "line": 42,
    "severity": "bug" | "security" | "logic-error",
    "description": "Clear description of the issue",
    "reason": "Why this is definitely a problem",
    "confidence": "high" | "medium"
  }
]
```

Only include issues with "high" or "medium" confidence. Never include "low" confidence issues.
```

- [ ] **Step 2: Verify the file parses correctly**

Run: `head -6 agents/bug-hunter.md`
Expected: YAML frontmatter with name, description, tools, model fields.

- [ ] **Step 3: Commit**

```bash
git add agents/bug-hunter.md
git commit -m "feat: add bug-hunter agent (opus) for PR defect analysis"
```

---

### Task 2: Create issue-validator agent

**Files:**
- Create: `agents/issue-validator.md`

- [ ] **Step 1: Write the agent definition file**

```markdown
---
name: issue-validator
description: Independently verifies a single code review issue to confirm it is a real problem
tools: read, grep, find, ls, bash
model: claude-opus-4-5
---

You are an independent issue validator. Your job is to verify whether a flagged code review issue is a real problem. Bash is for read-only commands only: `git diff`, `git show`, `git log`, `git blame`. Do NOT modify files.

You will receive:
1. A PR title and description (author's intent)
2. A description of the flagged issue
3. The file and line number

## Your Task

Investigate the flagged issue and determine if it is **truly a problem** with high confidence.

Examples of validation:
- "Variable is not defined" → Check if the variable is actually defined (imported, declared in scope, etc.)
- "Missing null check" → Check if the value can actually be null in this context
- "Type mismatch" → Check the actual types involved
- "CLAUDE.md violation" → Check if the rule is scoped to this file and is actually violated
- "Security issue" → Verify the vulnerability is exploitable in context

## Output Format

```json
{
  "validated": true | false,
  "confidence": "high" | "medium" | "low",
  "reasoning": "Explanation of why this is or isn't a real issue",
  "evidence": "Specific code/config that proves your conclusion"
}
```

## Rules

- Be thorough: actually read the code, don't guess
- If the issue description is vague, try to interpret it charitably before invalidating
- An issue is validated only if you have HIGH confidence it's real
- Pre-existing issues (present before the PR) should NOT be validated
- Issues that depend on specific runtime conditions should NOT be validated unless the condition is clearly always met
```

- [ ] **Step 2: Verify the file parses correctly**

Run: `head -6 agents/issue-validator.md`
Expected: YAML frontmatter with name, description, tools, model fields.

- [ ] **Step 3: Commit**

```bash
git add agents/issue-validator.md
git commit -m "feat: add issue-validator agent (opus) for independent issue verification"
```

---

### Task 3: Evolve code-reviewer agent for compliance mode

**Files:**
- Modify: `agents/code-reviewer.md`

The existing code-reviewer works well for general review. We add a **compliance-audit mode** that accepts project config rules and audits the diff against them specifically.

- [ ] **Step 1: Read the current file to confirm contents**

Run: `cat agents/code-reviewer.md`
Confirm: matches the version already read (36 lines, sonnet model).

- [ ] **Step 2: Add compliance-audit mode to the agent**

Edit `agents/code-reviewer.md` — append the compliance mode section after the existing content. Keep all existing functionality intact.

Add after line 35 (after the `Summary` section of the output format):

```markdown

## Compliance Audit Mode

When your task includes `MODE: compliance-audit`, shift focus to auditing changes against project configuration rules.

You will receive:
1. The PR diff
2. Project config file contents (CLAUDE.md, AGENTS.md, or similar)
3. A mapping of which config files apply to which changed files

## Compliance Audit Rules

- Only flag violations where you can quote the exact rule being broken
- Only consider config files that share a file path with the changed file or its parents
- Do not flag issues that are explicitly silenced in the code (e.g., lint ignore comments)
- Do not flag code style issues unless a config file explicitly requires a specific style

## Compliance Output Format

Return a JSON array of violations. If no violations found, return `[]`.

```json
[
  {
    "file": "path/to/file.ts",
    "line": 42,
    "severity": "compliance",
    "rule": "Exact quote from the config file",
    "config_source": "path/to/CLAUDE.md",
    "description": "How the code violates this rule",
    "confidence": "high" | "medium"
  }
]
```
```

- [ ] **Step 3: Verify the edit**

Run: `grep -c "Compliance Audit Mode" agents/code-reviewer.md`
Expected: `1`

- [ ] **Step 4: Commit**

```bash
git add agents/code-reviewer.md
git commit -m "feat: add compliance-audit mode to code-reviewer agent"
```

---

## Chunk 2: Code Review Skill (Orchestration Pipeline)

### Task 4: Create the false-positives reference file

**Files:**
- Create: `skills/code-review/false-positives.md`

- [ ] **Step 1: Create the skills/code-review directory and false-positives file**

```bash
mkdir -p skills/code-review
```

Write `skills/code-review/false-positives.md`:

```markdown
# False Positive Exclusion List

When evaluating issues in the review and validation steps, these are FALSE POSITIVES — do NOT flag them:

- **Pre-existing issues** — Problems that existed before this PR
- **Apparent bugs that are actually correct** — Code that looks wrong but works as intended
- **Pedantic nitpicks** — Issues a senior engineer would not flag
- **Linter-catchable issues** — Do not run the linter to verify; assume it will catch these
- **General code quality concerns** — Lack of test coverage, general security issues, unless explicitly required in project config
- **Silenced issues** — Issues mentioned in config but explicitly silenced in code (e.g., lint ignore comment, type assertion with explanation)
- **Code style preferences** — Formatting, naming conventions, unless explicitly required in project config
- **Potential issues depending on specific inputs** — Flag only issues that fail regardless of inputs
- **Subjective improvements** — "Could be better" suggestions without concrete defect
```

- [ ] **Step 2: Commit**

```bash
git add skills/code-review/false-positives.md
git commit -m "feat: add false-positive exclusion list for code review"
```

---

### Task 5: Create model configuration documentation

**Files:**
- Create: `skills/code-review/model-config.md`

Pi supports multiple model providers (Claude, GPT, Gemini, local models, etc.). The agent `.md` files ship with default Claude models, but users can override them at the project level using Pi's existing 3-tier agent discovery system, or via a dedicated code review config file.

- [ ] **Step 1: Write the model config documentation**

Write `skills/code-review/model-config.md`:

```markdown
# Model Configuration for Code Review

The code review pipeline uses three model tiers. Each tier maps to a role in the pipeline. The defaults use Claude models, but you can override them for any provider Pi supports.

## Default Model Mapping

| Role | Default Model | Agent | Pipeline Steps |
|------|--------------|-------|----------------|
| **fast** (pre-flight, discovery) | `claude-haiku-4-5` | scout | Steps 1, 2 |
| **standard** (compliance, summary) | `claude-sonnet-4-5` | code-reviewer | Steps 3, 4a-b |
| **reasoning** (bugs, validation) | `claude-opus-4-5` | bug-hunter, issue-validator | Steps 4c-d, 5 |

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
{ "models": { "fast": "gemini-2.5-flash", "standard": "claude-sonnet-4-5", "reasoning": "claude-opus-4-5" } }
```

### Local Models
```json
{ "models": { "fast": "ollama/qwen3:8b", "standard": "ollama/qwen3:32b", "reasoning": "ollama/qwen3:72b" } }
```
```

- [ ] **Step 2: Commit**

```bash
git add skills/code-review/model-config.md
git commit -m "feat: add model configuration docs for provider-agnostic code review"
```

---

### Task 6: Create the issue-validator prompt template

**Files:**
- Create: `skills/code-review/issue-validator-prompt.md`

- [ ] **Step 1: Write the template**

Write `skills/code-review/issue-validator-prompt.md`:

```markdown
# Issue Validator Dispatch Template

Use this template when dispatching `issue-validator` subagents in step 5 of the code review pipeline.

## Template

```
Validate this code review issue.

**PR Title:** {PR_TITLE}
**PR Description:** {PR_DESCRIPTION}

**Flagged Issue:**
- File: {ISSUE_FILE}
- Line: {ISSUE_LINE}
- Type: {ISSUE_TYPE}
- Description: {ISSUE_DESCRIPTION}
- Reason: {ISSUE_REASON}

**Your job:** Investigate the codebase to determine if this issue is truly a problem with high confidence. Read the actual file, check types, follow imports, verify the claim.

Refer to the false-positive exclusion list in `skills/code-review/false-positives.md` — if the issue matches any exclusion category, it should NOT be validated.

Return your verdict as JSON:
{
  "validated": true/false,
  "confidence": "high"/"medium"/"low",
  "reasoning": "...",
  "evidence": "..."
}
```

## Model Selection for Validators

| Issue Type | Model | Rationale |
|-----------|-------|-----------|
| bug, logic-error, security | opus | Complex reasoning needed |
| compliance | sonnet | Rule matching is straightforward |

## Dispatch Pattern

Use the subagent tool in parallel mode — one validator per issue:

```json
{
  "tasks": [
    { "agent": "issue-validator", "task": "[filled template for issue 1]" },
    { "agent": "issue-validator", "task": "[filled template for issue 2]" }
  ]
}
```
```

- [ ] **Step 2: Commit**

```bash
git add skills/code-review/issue-validator-prompt.md
git commit -m "feat: add issue validator dispatch template"
```

---

### Task 7: Create the code-review skill (SKILL.md)

This is the core orchestration document — the multi-agent pipeline.

**Files:**
- Create: `skills/code-review/SKILL.md`

- [ ] **Step 1: Write the skill file**

Write `skills/code-review/SKILL.md`:

```markdown
---
name: code-review
description: Use when performing a comprehensive multi-agent code review of a pull request or branch diff
---

# Multi-Agent Code Review

Orchestrate specialized agents across model tiers to review code changes with high signal and low false positives.

**Core principle:** Multiple independent reviewers + independent validation = high-signal issues only.

## When to Use

- Reviewing a pull request before merge
- Reviewing accumulated changes on a feature branch
- When `/code-review` prompt is invoked

## Pipeline Overview

```
Step 1: Pre-flight (scout/haiku) ──→ stop if PR is closed/draft/already-reviewed
Step 2: Config discovery (scout/haiku) ──→ find project config files
Step 3: Summarize changes (code-reviewer/sonnet)
Step 4: Parallel review ──→ 4 agents simultaneously:
  ├── code-reviewer (sonnet) × 2: compliance audit
  ├── bug-hunter (opus): diff-only scan
  └── bug-hunter (opus): context-aware scan
Step 5: Validate ──→ 1 issue-validator per issue (parallel)
Step 6: Filter ──→ drop unvalidated issues
Step 7: Report ──→ output summary
```

## Step-by-Step Instructions

### Step 1: Pre-flight Check

Dispatch `scout` agent (haiku) to check if any of these are true:
- The PR is closed
- The PR is a draft
- The PR does not need review (automated PR, trivial/obvious change)
- A previous multi-agent review has already been posted

```
subagent({
  agent: "scout",
  task: "Pre-flight check for code review. Run these commands and report findings:\n\n1. `git log --oneline -5` to see recent commits\n2. Check if this is a draft or closed PR (if applicable)\n3. Check if any previous review comments exist\n\nReturn: { proceed: true/false, reason: '...' }"
})
```

**If any condition is true:** Stop. Report why and do not proceed.

**Note:** Still review AI-generated PRs.

### Step 2: Config Discovery

Dispatch `scout` agent (haiku) to find project configuration files:

```
subagent({
  agent: "scout",
  task: "Find all project configuration files that contain coding rules or standards. Look for:\n- CLAUDE.md files (root and in directories containing modified files)\n- AGENTS.md files\n- .pi/ config directories\n- .editorconfig, .eslintrc, tsconfig.json (if they contain custom rules)\n\nFor each file found, return its path and a 1-line summary of what rules it contains.\n\nReturn as JSON: [{ path: '...', summary: '...' }]"
})
```

### Step 3: Summarize Changes

Dispatch `code-reviewer` agent (sonnet) to produce a change summary:

```
subagent({
  agent: "code-reviewer",
  task: "Summarize the changes in this PR/branch.\n\nRun:\n```\ngit diff {BASE_SHA}..{HEAD_SHA} --stat\ngit log --oneline {BASE_SHA}..{HEAD_SHA}\ngit diff {BASE_SHA}..{HEAD_SHA}\n```\n\nReturn a structured summary:\n- What changed (files, modules affected)\n- Why (infer intent from commit messages and code)\n- Scope (small fix, feature, refactor, etc.)\n- Risk areas (files with complex changes)"
})
```

Save this summary — it will be passed to all review agents for context.

### Step 4: Parallel Review

Launch 4 agents in parallel using the subagent tool's parallel mode:

```
subagent({
  tasks: [
    {
      agent: "code-reviewer",
      task: "MODE: compliance-audit\n\nPR Title: {PR_TITLE}\nPR Description: {PR_DESCRIPTION}\n\nAudit the FIRST HALF of changed files for compliance with project config rules.\n\nConfig files:\n{CONFIG_FILE_CONTENTS}\n\nDiff to audit:\n```\ngit diff {BASE_SHA}..{HEAD_SHA} -- {FIRST_HALF_FILES}\n```\n\nReturn JSON array of violations. See your Compliance Audit Mode instructions."
    },
    {
      agent: "code-reviewer",
      task: "MODE: compliance-audit\n\nPR Title: {PR_TITLE}\nPR Description: {PR_DESCRIPTION}\n\nAudit the SECOND HALF of changed files for compliance with project config rules.\n\nConfig files:\n{CONFIG_FILE_CONTENTS}\n\nDiff to audit:\n```\ngit diff {BASE_SHA}..{HEAD_SHA} -- {SECOND_HALF_FILES}\n```\n\nReturn JSON array of violations. See your Compliance Audit Mode instructions."
    },
    {
      agent: "bug-hunter",
      task: "MODE: diff-only\n\nPR Title: {PR_TITLE}\nPR Description: {PR_DESCRIPTION}\n\nScan this diff for bugs. Focus ONLY on the diff itself — do not read extra context files.\n\n```\ngit diff {BASE_SHA}..{HEAD_SHA}\n```\n\nReturn JSON array of issues. Refer to false-positive exclusion list."
    },
    {
      agent: "bug-hunter",
      task: "MODE: context-aware\n\nPR Title: {PR_TITLE}\nPR Description: {PR_DESCRIPTION}\n\nAnalyze the introduced code in context of the surrounding codebase. You may read referenced files, check types, follow imports.\n\n```\ngit diff {BASE_SHA}..{HEAD_SHA}\n```\n\nReturn JSON array of issues. Refer to false-positive exclusion list."
    }
  ]
})
```

**Splitting compliance across 2 agents:** Divide the changed file list in half. Each compliance auditor gets half the files. This provides parallel coverage and catches issues the other might miss.

### Step 5: Validate Issues

For each issue found in Step 4, dispatch a parallel `issue-validator` subagent.

Use the template from `issue-validator-prompt.md`:
- **Bug/logic/security issues** → dispatch with opus model (issue-validator default)
- **Compliance issues** → you may override to sonnet if the validation is straightforward

```
subagent({
  tasks: [
    { agent: "issue-validator", task: "[filled template for issue 1]" },
    { agent: "issue-validator", task: "[filled template for issue 2]" },
    ...
  ]
})
```

**If more than 8 issues:** Batch into groups of 8 (the parallel task limit) and run sequentially.

### Step 6: Filter

Drop any issues where the validator returned:
- `validated: false`
- `confidence: "low"`

Keep only issues where `validated: true` AND `confidence` is `"high"` or `"medium"`.

This step is performed by the orchestrating agent (you) — no subagent needed.

### Step 7: Report

Output a summary to the terminal:

**If issues were found:**

```
## Code Review Results

**Reviewed:** {FILE_COUNT} files, {LINE_COUNT} lines changed
**Issues found:** {ISSUE_COUNT} validated issues

### Bugs
1. **`file.ts:42`** — Description (validated with high confidence)
   Reason: ...

### Compliance Violations
1. **`file.ts:100`** — Violates: "exact rule quote" (from CLAUDE.md)

### Summary
[1-2 sentence overall assessment]
```

**If no issues were found:**

```
## Code Review Results

No issues found. Checked for bugs, security issues, and project config compliance.

**Reviewed:** {FILE_COUNT} files, {LINE_COUNT} lines changed
**Agents used:** 2× compliance auditor (sonnet), 2× bug hunter (opus)
```

## Model Configuration

The pipeline defaults to Claude models but supports any model provider Pi can use. See `model-config.md` for full documentation.

**Quick summary of override methods:**

1. **Project-level agent overrides (recommended):** Create `.pi/agents/<agent-name>.md` files with your preferred `model:` in frontmatter. Pi's 3-tier discovery (project > user > bundled) handles the rest.

2. **Code review config file:** Create `.pi/code-review.json` with tier-based overrides:
   ```json
   {
     "models": {
       "fast": "gpt-4.1-mini",
       "standard": "gpt-4.1-mini",
       "reasoning": "gpt-4.1"
     }
   }
   ```

3. **User-level agent overrides:** Place agent files in `~/.pi/agent/agents/` for cross-project defaults.

**When config file exists:** In Step 1 (pre-flight), the scout also checks for `.pi/code-review.json`. If found, the orchestrating agent reads the model overrides and adjusts dispatch notes for each subsequent subagent task. The config file takes precedence over bundled agent defaults but NOT over project-level agent overrides (which are resolved by Pi's agent discovery before the subagent runs).

**Tier mapping:**

| Tier | Agents | Pipeline Steps |
|------|--------|----------------|
| `fast` | scout | Steps 1, 2 |
| `standard` | code-reviewer | Steps 3, 4a-b |
| `reasoning` | bug-hunter, issue-validator | Steps 4c-d, 5 |

## Adapting the Pipeline

### Smaller reviews (< 5 files changed)

Skip splitting compliance across 2 agents — use 1 compliance auditor instead. Run 3 parallel agents in Step 4 instead of 4.

### No project config files found

Skip compliance auditors entirely. Run only the 2 bug-hunter agents in Step 4.

### Branch diff instead of PR

Replace PR-specific commands with branch diff:

```bash
BASE_SHA=$(git merge-base main HEAD)
HEAD_SHA=$(git rev-parse HEAD)
```

## Placeholders Reference

| Placeholder | Source |
|-------------|--------|
| `{BASE_SHA}` | Git SHA of the base (e.g., `origin/main`, `HEAD~N`) |
| `{HEAD_SHA}` | Git SHA of the head (e.g., `HEAD`) |
| `{PR_TITLE}` | Pull request title (or branch name for branch diffs) |
| `{PR_DESCRIPTION}` | Pull request description (or commit messages for branch diffs) |
| `{CONFIG_FILE_CONTENTS}` | Concatenated contents of discovered config files from Step 2 |
| `{FIRST_HALF_FILES}` | Space-separated first half of changed file paths |
| `{SECOND_HALF_FILES}` | Space-separated second half of changed file paths |
| `{FILE_COUNT}` | Number of files changed |
| `{LINE_COUNT}` | Number of lines changed (additions + deletions) |

## Integration with Other Skills

- **requesting-code-review:** This skill replaces the single-agent dispatch from `requesting-code-review` with the full multi-agent pipeline. Use `requesting-code-review` when you want a quick single-agent review; use `code-review` when you want the comprehensive multi-agent pipeline.
- **subagent-driven-development:** After each task's implementation, you may use either the quick single-agent review or the full pipeline depending on the scope of changes.
- **verification-before-completion:** Run the code review pipeline as part of your verification before claiming work is complete.

## Red Flags

**Never:**
- Skip the validation step (Step 5) — it's the key to high signal
- Report issues that weren't validated
- Flag pre-existing issues (not introduced by this PR)
- Include low-confidence issues in the report
- Run compliance auditors without config files (skip them instead)

**If no issues after validation:**
- This is a GOOD outcome, not a failure
- Report it clearly so the reviewer knows it was thorough
```

- [ ] **Step 2: Verify frontmatter is valid**

Run: `head -4 skills/code-review/SKILL.md`
Expected:
```
---
name: code-review
description: Use when performing a comprehensive multi-agent code review of a pull request or branch diff
---
```

- [ ] **Step 3: Commit**

```bash
git add skills/code-review/
git commit -m "feat: add multi-agent code-review skill with orchestration pipeline"
```

---

## Chunk 3: Slash Command Prompt & Test Updates

### Task 8: Create the /code-review prompt

**Files:**
- Create: `prompts/code-review.md`

- [ ] **Step 1: Write the prompt file**

Write `prompts/code-review.md`:

```markdown
---
description: Run a comprehensive multi-agent code review on a pull request or branch diff
---
Use the superpowers:code-review skill to perform a multi-agent code review.

If a PR number or URL is provided: review that PR.
If no argument is given: review the current branch's changes against the base branch (main or master).

Arguments: $@
```

- [ ] **Step 2: Commit**

```bash
git add prompts/code-review.md
git commit -m "feat: add /code-review slash command prompt"
```

---

### Task 9: Update skills test to include code-review

**Files:**
- Modify: `tests/skills.test.ts`

- [ ] **Step 1: Read current test file to confirm contents**

Run: `cat tests/skills.test.ts`
Confirm: EXPECTED_SKILLS array has 14 entries, test says "has all 14 expected skill directories".

- [ ] **Step 2: Add "code-review" to EXPECTED_SKILLS array**

Edit `tests/skills.test.ts`:

In the `EXPECTED_SKILLS` array, add `"code-review"` (it sorts alphabetically between `"brainstorming"` and `"dispatching-parallel-agents"`):

```typescript
const EXPECTED_SKILLS = [
  "brainstorming",
  "code-review",
  "dispatching-parallel-agents",
  // ... rest unchanged
];
```

- [ ] **Step 3: Update the test description from 14 to 15**

Edit `tests/skills.test.ts`:

Change:
```typescript
it("has all 14 expected skill directories", () => {
```

To:
```typescript
it("has all 15 expected skill directories", () => {
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/skills.test.ts`
Expected: All tests pass (15 skill directories found, each with valid SKILL.md).

- [ ] **Step 5: Commit**

```bash
git add tests/skills.test.ts
git commit -m "test: update skills test for new code-review skill (14 → 15)"
```

---

### Task 10: Run full test suite

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All test suites pass — skills.test.ts, agents.test.ts, bootstrap-utils.test.ts, subagent-utils.test.ts.

- [ ] **Step 2: Verify agent discovery includes new agents**

Run: `ls -1 agents/*.md | wc -l`
Expected: `6` (scout, planner, worker, code-reviewer, bug-hunter, issue-validator)

- [ ] **Step 3: Verify skill structure**

Run: `ls -1 skills/code-review/`
Expected:
```
SKILL.md
false-positives.md
issue-validator-prompt.md
model-config.md
```

- [ ] **Step 4: Verify prompt exists**

Run: `ls prompts/code-review.md`
Expected: File exists.

- [ ] **Step 5: Final commit (if any fixups needed)**

```bash
git add -A
git commit -m "fix: address any test or structure issues"
```

Only commit if there were actual fixes needed. Skip if all green.

---

## Summary of Changes

| Category | Before | After |
|----------|--------|-------|
| Agents | 4 (scout, planner, worker, code-reviewer) | 6 (+bug-hunter, +issue-validator) |
| Skills | 14 | 15 (+code-review, with 4 supporting files) |
| Prompts | 3 (brainstorm, write-plan, execute-plan) | 4 (+code-review) |
| Review strategy | Single agent (sonnet) | Multi-agent pipeline (haiku + sonnet + opus) |
| Model providers | Claude only (hardcoded) | Any provider via project agent overrides or config file |
| Validation | None | Independent per-issue validation |
| False-positive handling | Agent judgment only | Explicit exclusion list + validation step |

## Cost Model (Approximate per Review)

| Step | Agents | Model | Est. Tokens |
|------|--------|-------|-------------|
| Pre-flight | 1 | haiku | ~2K |
| Config discovery | 1 | haiku | ~3K |
| Summarize | 1 | sonnet | ~10K |
| Compliance audit | 2 | sonnet | ~20K |
| Bug hunting | 2 | opus | ~40K |
| Validation | N | opus/sonnet | ~10K each |
| **Total (0 issues)** | **7** | — | **~75K** |
| **Total (5 issues)** | **12** | — | **~125K** |

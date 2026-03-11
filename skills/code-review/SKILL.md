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
Step 1: Pre-flight (scout/fast tier) ──→ stop if PR is closed/draft/already-reviewed
Step 2: Config discovery (scout/fast tier) ──→ find project config files
Step 3: Summarize changes (code-reviewer/standard tier)
Step 4: Parallel review ──→ 4 agents simultaneously:
  ├── code-reviewer (standard tier) × 2: compliance audit
  ├── bug-hunter (reasoning tier): diff-only scan
  └── bug-hunter (reasoning tier): context-aware scan
Step 5: Validate ──→ 1 issue-validator per issue (parallel)
Step 6: Filter ──→ drop unvalidated issues
Step 7: Report ──→ output summary
```

## Step-by-Step Instructions

### Step 1: Pre-flight Check

Dispatch `scout` agent (fast tier) to check if any of these are true:
- The PR is closed
- The PR is a draft
- The PR does not need review (automated PR, trivial/obvious change)
- A previous multi-agent review has already been posted

```
subagent({
  agent: "scout",
  tier: "fast",
  task: "Pre-flight check for code review. Run these commands and report findings:\n\n1. `git log --oneline -5` to see recent commits\n2. Check if this is a draft or closed PR (if applicable)\n3. Check if any previous review comments exist\n\nReturn: { proceed: true/false, reason: '...' }"
})
```

**If any condition is true:** Stop. Report why and do not proceed.

**Note:** Still review AI-generated PRs.

### Step 2: Config Discovery

Dispatch `scout` agent (fast tier) to find project configuration files:

```
subagent({
  agent: "scout",
  tier: "fast",
  task: "Find all project configuration files that contain coding rules or standards. Look for:\n- CLAUDE.md files (root and in directories containing modified files)\n- AGENTS.md files\n- .pi/ config directories\n- .editorconfig, .eslintrc, tsconfig.json (if they contain custom rules)\n\nFor each file found, return its path and a 1-line summary of what rules it contains.\n\nReturn as JSON: [{ path: '...', summary: '...' }]"
})
```

### Step 3: Summarize Changes

Dispatch `code-reviewer` agent (standard tier) to produce a change summary:

```
subagent({
  agent: "code-reviewer",
  tier: "standard",
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
      tier: "standard",
      task: "MODE: compliance-audit\n\nPR Title: {PR_TITLE}\nPR Description: {PR_DESCRIPTION}\n\nAudit the FIRST HALF of changed files for compliance with project config rules.\n\nConfig files:\n{CONFIG_FILE_CONTENTS}\n\nDiff to audit:\n```\ngit diff {BASE_SHA}..{HEAD_SHA} -- {FIRST_HALF_FILES}\n```\n\nReturn JSON array of violations. See your Compliance Audit Mode instructions."
    },
    {
      agent: "code-reviewer",
      tier: "standard",
      task: "MODE: compliance-audit\n\nPR Title: {PR_TITLE}\nPR Description: {PR_DESCRIPTION}\n\nAudit the SECOND HALF of changed files for compliance with project config rules.\n\nConfig files:\n{CONFIG_FILE_CONTENTS}\n\nDiff to audit:\n```\ngit diff {BASE_SHA}..{HEAD_SHA} -- {SECOND_HALF_FILES}\n```\n\nReturn JSON array of violations. See your Compliance Audit Mode instructions."
    },
    {
      agent: "bug-hunter",
      tier: "reasoning",
      task: "MODE: diff-only\n\nPR Title: {PR_TITLE}\nPR Description: {PR_DESCRIPTION}\n\nScan this diff for bugs. Focus ONLY on the diff itself — do not read extra context files.\n\n```\ngit diff {BASE_SHA}..{HEAD_SHA}\n```\n\nReturn JSON array of issues. Refer to false-positive exclusion list."
    },
    {
      agent: "bug-hunter",
      tier: "reasoning",
      task: "MODE: context-aware\n\nPR Title: {PR_TITLE}\nPR Description: {PR_DESCRIPTION}\n\nAnalyze the introduced code in context of the surrounding codebase. You may read referenced files, check types, follow imports.\n\n```\ngit diff {BASE_SHA}..{HEAD_SHA}\n```\n\nReturn JSON array of issues. Refer to false-positive exclusion list."
    }
  ]
})
```

**Splitting compliance across 2 agents:** Divide the changed file list in half. Each compliance auditor gets half the files. This provides parallel coverage and catches issues the other might miss.

### Step 5: Validate Issues

For each issue found in Step 4, dispatch a parallel `issue-validator` subagent.

Use the template from `issue-validator-prompt.md`:
- **Bug/logic/security issues** → dispatch with reasoning tier (issue-validator default)
- **Compliance issues** → you may override to standard tier if the validation is straightforward

```
subagent({
  tasks: [
    { agent: "issue-validator", tier: "reasoning", task: "[filled template for issue 1]" },
    { agent: "issue-validator", tier: "reasoning", task: "[filled template for issue 2]" },
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
**Agents used:** 2× compliance auditor (standard tier), 2× bug hunter (reasoning tier)
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

**Tier mapping (configured in `.pi/superpowers.json`):**

| Tier | Default Model | Agents | Pipeline Steps |
|------|--------------|--------|----------------|
| `fast` | claude-haiku-4-5 | scout | Steps 1, 2 |
| `standard` | claude-sonnet-4-6 | code-reviewer | Steps 3, 4a-b |
| `reasoning` | claude-opus-4-6 | bug-hunter, issue-validator | Steps 4c-d, 5 |

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

### Adding security review

For security-critical changes, add the `security-reviewer` agent to Step 4's parallel tasks:

```
subagent({
  tasks: [
    // existing compliance + bug-hunter agents...
    {
      agent: "security-reviewer",
      tier: "reasoning",
      task: "[filled security-prompt.md template with context from Steps 1-3]"
    }
  ]
})
```

Security findings go through the same validation pipeline (Step 5) and filtering (Step 6) as other issues. Security-specific exclusion rules from `skills/security-review/exclusions.md` apply automatically.

For standalone security review, use the `security-review` skill instead.

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

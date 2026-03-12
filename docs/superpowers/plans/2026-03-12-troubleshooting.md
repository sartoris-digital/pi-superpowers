# Troubleshooting Command Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/troubleshoot` command that orchestrates a multi-agent team to diagnose bugs and (on approval) fix them.

**Architecture:** New skill (`skills/troubleshooting/SKILL.md`) defines a 6-step pipeline — triage, parallel investigation, synthesis, report, fix, verify — using existing agents (scout, bug-hunter, researcher, vision, architect, worker). The bug-hunter agent gets two new modes (`root-cause-analysis` and `pattern-analysis`). A prompt file (`prompts/troubleshoot.md`) provides the `/troubleshoot` entry point.

**Tech Stack:** Markdown (skill/agent/prompt definitions), TypeScript/Vitest (tests)

**Spec:** `docs/superpowers/specs/2026-03-12-troubleshooting-design.md`

---

## Chunk 1: Tests First + Agent Update + Prompt

### Task 1: Update tests (red phase — tests fail first)

**Tier:** fast

**Files:**
- Modify: `tests/skills.test.ts`

- [ ] **Step 1: Add "troubleshooting" to EXPECTED_SKILLS array**

In `tests/skills.test.ts`, the `EXPECTED_SKILLS` array is sorted alphabetically. Add `"troubleshooting"` in the correct position — after `"test-driven-development"` (line 23) and before `"using-git-worktrees"` (line 24):

```typescript
  "test-driven-development",
  "troubleshooting",
  "using-git-worktrees",
```

- [ ] **Step 2: Update the test description count**

Change line 32 from:
```typescript
  it("has all 20 expected skill directories", () => {
```
to:
```typescript
  it("has all 21 expected skill directories", () => {
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/skills.test.ts`
Expected: FAIL — the `troubleshooting` directory doesn't exist yet, so the "has a SKILL.md file" test will fail.

**If tests pass instead of failing:** STOP and investigate — a stale `skills/troubleshooting/` directory may exist from a previous attempt and should be removed before proceeding.

- [ ] **Step 4: Commit**

```bash
git add tests/skills.test.ts
git commit -m "test: add troubleshooting to expected skills (will fail until skill created)"
```

---

### Task 2: Add troubleshooting modes to bug-hunter agent

**Tier:** fast

**Files:**
- Modify: `agents/bug-hunter.md`

The bug-hunter agent currently has two modes: `diff-only` and `context-aware` (for PR review). We need to add two new modes for troubleshooting: `root-cause-analysis` and `pattern-analysis`.

- [ ] **Step 1: Read the current bug-hunter agent file**

Read `agents/bug-hunter.md` to understand the existing structure. The file has frontmatter (`name`, `description`, `tools`, `model`, `tier`) and a body with `## Modes` section containing `### diff-only` and `### context-aware`.

- [ ] **Step 2: Add the two new modes**

Add the following two mode sections after the existing `### context-aware` section, before the `## What to Flag` section:

````markdown
### root-cause-analysis
Trace a reported bug through the codebase to find its exact location and root cause. You will receive a triage report with error text, stack traces, and affected area. Follow data flow, check types, read relevant files. Use `git log`, `git blame` to understand recent changes. Focus on finding WHY the bug happens, not just WHERE.

Scope hints may be provided — prioritize those paths but follow the evidence trail beyond them if needed.

Return JSON:
```json
{
  "hypothesis": "Description of suspected root cause",
  "confidence": "high|medium|low",
  "evidence": ["file.ts:42 — null check missing", "git log shows field removed in abc123"],
  "affected_files": ["src/auth/login.ts"],
  "suggested_fix": "Brief description of fix approach"
}
```

### pattern-analysis
Search for patterns related to a reported bug. Check: similar code that works correctly, related test failures, recent git changes to affected files (`git log --oneline -20 -- {files}`), and whether this is a regression. You will receive a triage report with error context.

Scope hints may be provided — prioritize those paths but search broadly if needed.

Return JSON:
```json
{
  "hypothesis": "Description of suspected root cause",
  "confidence": "high|medium|low",
  "evidence": ["similar code in auth.ts:100 works because it checks for null", "git blame shows line changed 3 days ago"],
  "affected_files": ["src/auth/login.ts"],
  "suggested_fix": "Brief description of fix approach"
}
```
````

- [ ] **Step 3: Update the agent description**

Change the `description` field in frontmatter from:
```
description: Deep bug analysis of pull request diffs — finds logic errors, security issues, and code that will fail
```
to:
```
description: Deep bug analysis — PR diff review (diff-only, context-aware) and troubleshooting (root-cause-analysis, pattern-analysis)
```

- [ ] **Step 4: Commit**

```bash
git add agents/bug-hunter.md
git commit -m "feat(agents): add root-cause-analysis and pattern-analysis modes to bug-hunter"
```

---

### Task 3: Create the troubleshoot prompt

**Tier:** fast

**Files:**
- Create: `prompts/troubleshoot.md`

- [ ] **Step 1: Create the prompt file**

Create `prompts/troubleshoot.md` with the following content (follows the exact pattern of `prompts/code-review.md` and `prompts/security-review.md`):

```markdown
---
description: Troubleshoot a bug using multi-agent diagnosis and fix
---
Use the superpowers:troubleshooting skill to diagnose and fix the bug.

Arguments: $@
```

- [ ] **Step 2: Commit**

```bash
git add prompts/troubleshoot.md
git commit -m "feat(prompts): add /troubleshoot entry point"
```

---

## Chunk 2: The Skill

### Task 4: Create the troubleshooting skill

**Tier:** standard

**Files:**
- Create: `skills/troubleshooting/SKILL.md`

This is the main deliverable. The skill defines the full 6-step multi-agent pipeline for troubleshooting.

- [ ] **Step 1: Create the skill directory and file**

Create `skills/troubleshooting/SKILL.md` with the following content:

````markdown
---
name: troubleshooting
description: Use when diagnosing bugs using multi-agent parallel investigation
---

# Troubleshooting

Orchestrate a multi-agent team to diagnose a bug's root cause through parallel investigation, then (on approval) fix it using TDD.

**Core principle:** Distribute the systematic-debugging methodology across specialized agents running in parallel for faster, higher-signal diagnosis.

**Announce at start:** "I'm using the troubleshooting skill to diagnose this bug."

## When to Use

- When `/troubleshoot` prompt is invoked
- When a user describes a bug and asks for help diagnosing or fixing it
- When a user pastes an error log or stack trace and wants to understand the root cause
- After a test failure that isn't immediately obvious
- When a bug involves multiple files or systems and needs parallel investigation

## Input Handling

The command accepts any combination of:
- **Inline text** — bug description or error message
- **File paths** — auto-detected; text files (`.log`, `.txt`, etc.) read as error context, image files (`.png`, `.jpg`, `.gif`, `.webp`) read as visual input
- **Directory paths** — auto-detected as scope hints

**Auto-detection logic (in triage step):**
1. For each argument, check if it resolves to an existing file or directory
2. Image files → include as visual input, set `needsVision: true`
3. Text/log files → read contents, include as error context
4. Directory paths → treat as scope hints
5. Everything else → treat as bug description text

**Optional flag:**
- `--scope <path>` — explicit scope hint (directory paths are also auto-detected as scope hints)

## Examples

```
/troubleshoot TypeError: Cannot read property 'foo' of undefined
/troubleshoot ./crash.log "login fails silently"
/troubleshoot ./crash.log ./ui-error.png src/auth "Login button does nothing"
/troubleshoot --scope src/auth "session expires immediately after login"
```

## Pipeline Overview

```
Step 1: Triage (scout/fast tier) ──→ parse input, classify bug, determine agents
Step 2: Parallel Investigation (2-4 agents) ──→ root cause + pattern analysis
  ├── bug-hunter (reasoning): root-cause-analysis mode
  ├── bug-hunter (reasoning): pattern-analysis mode
  ├── researcher (standard): [conditional] external docs/known issues
  └── vision (standard): [conditional] screenshot analysis
Step 3: Synthesis (architect/reasoning) ──→ merge findings, resolve conflicts
Step 4: Diagnosis Report ──→ present findings, ask user to approve fix
Step 5: Fix (worker/standard) [on approval] ──→ TDD: test → fix → verify → commit
Step 6: Verify (architect/reasoning) ──→ confirm fix addresses root cause
```

## Step-by-Step Instructions

### Step 1: Triage

Dispatch `scout` agent (fast tier) to parse and classify the bug report:

```
subagent({
  agent: "scout",
  tier: "fast",
  task: "Triage this bug report. Parse the input, classify the bug type, identify affected files/modules, and determine if external libraries are involved.\n\nBug input:\n{INPUT}\n\nScope hints: {SCOPE}\n\nReturn JSON:\n{\n  \"bug_type\": \"runtime_error|logic_bug|ui_bug|build_error|test_failure|performance\",\n  \"summary\": \"one-line summary\",\n  \"affected_area\": [\"files/modules mentioned or inferred\"],\n  \"error_text\": \"extracted error message if present\",\n  \"stack_trace\": \"extracted stack trace if present\",\n  \"tech_stack\": [\"relevant frameworks/libraries\"],\n  \"needsResearcher\": true/false,\n  \"needsVision\": true/false,\n  \"scope_hints\": [\"paths to prioritize\"]\n}"
})
```

**If triage returns no actionable input** (empty affected area, no error text, no description): ask the user for more detail. Do not proceed to investigation.

### Step 2: Parallel Investigation

Launch 2-4 agents in parallel using the subagent tool's parallel mode.

**Always dispatched:**

| Agent | Tier | Mode | Role |
|-------|------|------|------|
| bug-hunter #1 | reasoning | root-cause-analysis | Trace the error through code, find exact bug location |
| bug-hunter #2 | reasoning | pattern-analysis | Find similar patterns, related failures, check if regression |

**Conditionally dispatched:**

| Agent | Tier | Condition | Role |
|-------|------|-----------|------|
| researcher | standard | `needsResearcher: true` | Look up docs, known issues, changelogs |
| vision | standard | `needsVision: true` | Analyze screenshots, compare expected vs actual |

```
subagent({
  tasks: [
    {
      agent: "bug-hunter",
      tier: "reasoning",
      task: "MODE: root-cause-analysis\n\n{TRIAGE_REPORT}\n\nTrace the error through the code. Find the exact location of the bug and explain why it happens. Follow data flow, check types, read relevant files.\n\nScope hints (prioritize but don't restrict): {SCOPE}\n\nReturn JSON: { hypothesis: '...', confidence: 'high|medium|low', evidence: [], affected_files: [], suggested_fix: '...' }"
    },
    {
      agent: "bug-hunter",
      tier: "reasoning",
      task: "MODE: pattern-analysis\n\n{TRIAGE_REPORT}\n\nSearch for similar patterns in the codebase. Check: related test failures, recent git changes to affected files (`git log --oneline -20 -- {files}`), similar code that works correctly. Determine if this is a regression.\n\nScope hints (prioritize but don't restrict): {SCOPE}\n\nReturn JSON: { hypothesis: '...', confidence: 'high|medium|low', evidence: [], affected_files: [], suggested_fix: '...' }"
    }
    // Add researcher task if needsResearcher is true
    // Add vision task if needsVision is true
  ]
})
```

**Simple bug shortcut:** If triage identifies a single file with a clear error (typo, missing import, off-by-one), dispatch a single bug-hunter in root-cause-analysis mode instead of parallel investigation.

### Step 3: Synthesis

Dispatch `architect` agent (reasoning tier) to merge investigation findings:

```
subagent({
  agent: "architect",
  tier: "reasoning",
  task: "Synthesize these troubleshooting findings into a unified diagnosis.\n\nTriage: {TRIAGE_REPORT}\n\nInvestigation results:\n{INVESTIGATION_RESULTS}\n\nMerge findings, resolve conflicts, evaluate evidence quality. If investigators disagree, pick the hypothesis with stronger code evidence.\n\nIf only one investigator returned a hypothesis (others found nothing), validate the single hypothesis rather than attempting to merge.\n\nReturn JSON:\n{\n  \"root_cause\": \"definitive description\",\n  \"confidence\": \"high|medium|low\",\n  \"evidence_summary\": [\"key evidence points\"],\n  \"affected_files\": [\"deduplicated list\"],\n  \"fix_approach\": \"recommended fix strategy\",\n  \"competing_hypotheses\": []\n}"
})
```

**Conflict resolution:**
- Investigators agree (or one has clearly stronger evidence) → unified diagnosis
- Genuine disagreement with comparable evidence → architect picks most likely, notes alternatives
- Architect can't resolve (confidence: low) → escalate to user with both hypotheses
- Only one investigator returns findings → architect validates the single hypothesis

### Step 4: Diagnosis Report

The orchestrating agent (you) formats and presents the diagnosis:

**If confidence is high or medium:**

```
## Troubleshooting Diagnosis

**Root cause:** [description]
**Confidence:** high/medium
**Affected files:** [list]

### Evidence
- [evidence point 1]
- [evidence point 2]

### Suggested Fix
[description of fix approach]

### Investigators
- Bug hunter (root cause): [hypothesis summary] (confidence: X)
- Bug hunter (pattern): [hypothesis summary] (confidence: X)
- Researcher: [relevant findings] (if dispatched)
- Vision: [UI observations] (if dispatched)

Proceed with fix? (y/n)
```

**If confidence is low or competing hypotheses exist:**
Present both hypotheses with evidence and ask the user which direction to pursue. Do not proceed with fix until user chooses.

### Step 5: Fix

On user approval, dispatch `worker` agent (standard tier):

```
subagent({
  agent: "worker",
  tier: "standard",
  task: "Fix this bug using TDD.\n\nDiagnosis:\n{DIAGNOSIS}\n\nEvidence:\n{EVIDENCE}\n\n1. Write a failing test that reproduces the bug\n2. Verify it fails\n3. Implement the minimal fix\n4. Verify the test passes\n5. Run full test suite\n6. Self-review\n7. Commit\n\nIf the bug cannot be reproduced as an automated test (UI-only, timing, environment-specific), document why, apply the fix, add any feasible partial tests, and describe manual verification steps.\n\nReturn: { status: 'DONE'|'BLOCKED', files_changed: [], test_added: '', commit_sha: '', notes: '' }"
})
```

**If worker returns BLOCKED:** Report the blocker to the user. Don't retry automatically.

### Step 6: Verify

Dispatch `architect` agent (reasoning tier) to verify the fix:

```
subagent({
  agent: "architect",
  tier: "reasoning",
  task: "Verify this bug fix.\n\nOriginal diagnosis:\n{DIAGNOSIS}\n\nChanges made:\n{FIX_SUMMARY}\n\nCheck:\n1. Fix addresses the identified root cause (not just symptoms)\n2. Regression test is meaningful and would catch recurrence\n3. No unintended side effects\n4. All tests pass\n\nReturn: { verified: true/false, confidence: 'high|medium|low', reasoning: '...' }"
})
```

**If verified:** Report success to user.
**If not verified:** Report the architect's reasoning to user. Don't loop automatically.

## Adapting the Pipeline

### Simple bugs (single file, obvious fix)
Skip parallel investigation — dispatch single bug-hunter in root-cause-analysis mode. Synthesis step still runs.

### No affected files identified
Investigation proceeds with full codebase in scope. Bug-hunters use error text, stack trace, or description to search broadly.

### No test framework available
Worker skips the failing test step, applies fix directly, verifies manually, documents verification in commit message.

### Empty or unresolvable input
Triage returns an error — orchestrator asks user for more detail before proceeding.

## Model Configuration

Follows the same tier system as code-review and security-review. Configurable via `.pi/superpowers.json`:

| Tier | Default Model | Agent | Pipeline Steps |
|------|--------------|-------|----------------|
| `fast` | claude-haiku-4-5 | scout | Step 1 |
| `standard` | claude-sonnet-4-6 | researcher, vision, worker | Steps 2, 5 |
| `reasoning` | claude-opus-4-6 | bug-hunter, architect | Steps 2, 3, 6 |

Override via project agent files in `.pi/agents/` or `.pi/superpowers.json`. See `skills/code-review/model-config.md` for provider-specific examples.

## Placeholders Reference

| Placeholder | Source |
|-------------|--------|
| `{INPUT}` | Normalized bug input (text + file contents + image references) |
| `{SCOPE}` | Scope hints from `--scope` flag or auto-detected directory paths |
| `{TRIAGE_REPORT}` | JSON output from Step 1 |
| `{INVESTIGATION_RESULTS}` | Combined JSON outputs from Step 2 agents |
| `{DIAGNOSIS}` | JSON output from Step 3 |
| `{EVIDENCE}` | Evidence array from diagnosis |
| `{FIX_SUMMARY}` | Worker's return value from Step 5 |

## Integration with Other Skills

- **systematic-debugging** — this pipeline distributes the same four-phase methodology (root cause → pattern analysis → hypothesis → fix) across parallel agents
- **test-driven-development** — the worker agent follows TDD when applying the fix
- **verification-before-completion** — the architect verification step mirrors this skill's evidence-based approach
- **code-review** — follows the same multi-agent pipeline pattern (parallel investigation → validation → report)

## Red Flags

**Never:**
- Apply a fix without user approval
- Skip the synthesis step (even if only one investigator)
- Report a root cause without evidence
- Loop the fix step automatically on verification failure (escalate to user instead)
- Restrict investigation strictly to scope hints (they're hints, not boundaries)

**Always:**
- Announce: "I'm using the troubleshooting skill to diagnose this bug."
- Include evidence for every claim
- Present competing hypotheses when confidence is low
- Follow TDD when fixing (failing test first)
- Run full test suite before committing fix

## Pi Platform Notes

**Triage dispatch:**
```
subagent({ agent: "scout", tier: "fast", task: "..." })
```

**Parallel investigation dispatch:**
```
subagent({ tasks: [{ agent: "bug-hunter", tier: "reasoning", task: "MODE: root-cause-analysis\n..." }, ...] })
```

**Synthesis dispatch:**
```
subagent({ agent: "architect", tier: "reasoning", task: "Synthesize...\n..." })
```
````

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run tests/skills.test.ts`
Expected: PASS — all 21 skills now have directories with valid SKILL.md files.

- [ ] **Step 3: Commit**

```bash
git add skills/troubleshooting/SKILL.md
git commit -m "feat(skills): add troubleshooting multi-agent pipeline skill"
```

---

### Task 5: Update README

**Tier:** fast

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the Skills count**

Change `### Skills (20)` to `### Skills (21)`.

- [ ] **Step 2: Add troubleshooting to the skills table**

Add the following row to the skills table, after the `systematic-debugging` row and before the `verification-before-completion` row (grouping diagnostic skills together):

```markdown
| **troubleshooting** | Multi-agent bug diagnosis with parallel investigation, synthesis, and TDD fix |
```

- [ ] **Step 3: Update the Prompts count**

Change `### Prompts (9)` to `### Prompts (10)`.

- [ ] **Step 4: Add troubleshoot to the prompts table**

Add the following row to the prompts table, after the `/security-review` row and before the `/cancel` row:

```markdown
| `/troubleshoot` | Diagnose and fix a bug using multi-agent investigation |
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add troubleshooting skill and prompt to README"
```

---

### Task 6: Final verification

**Tier:** fast

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Verify file inventory**

Check that all expected files exist:
```bash
ls -la skills/troubleshooting/SKILL.md
ls -la prompts/troubleshoot.md
ls -la agents/bug-hunter.md
ls -la tests/skills.test.ts
```

- [ ] **Step 3: Verify SKILL.md frontmatter**

```bash
head -5 skills/troubleshooting/SKILL.md
```
Expected: frontmatter with `name: troubleshooting` and `description: Use when diagnosing bugs using multi-agent parallel investigation`.

Note: The Vitest test suite already validates no Chinese characters are present in SKILL.md files, so no separate check is needed.

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

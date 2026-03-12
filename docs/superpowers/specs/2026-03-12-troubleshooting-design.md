# Troubleshooting Command Design

## Overview

A new `/troubleshoot` command that accepts a bug description, error logs, and/or screenshots, then orchestrates a multi-agent team to diagnose the root cause and (on approval) fix the bug.

**Core principle:** Distribute the systematic-debugging methodology across specialized agents running in parallel for faster, higher-signal diagnosis.

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

**Examples:**
```
/troubleshoot TypeError: Cannot read property 'foo' of undefined
/troubleshoot ./crash.log "login fails silently"
/troubleshoot ./crash.log ./ui-error.png src/auth "Login button does nothing"
/troubleshoot --scope src/auth "session expires immediately after login"
```

## Pipeline

```
Step 1: Triage (scout/fast)
  → Parse input, classify bug, identify affected area, determine conditional agents

Step 2: Parallel Investigation (2-4 agents)
  ├── bug-hunter (reasoning): Root cause analysis
  ├── bug-hunter (reasoning): Pattern analysis
  ├── researcher (standard): [conditional] External docs/known issues
  └── vision (standard): [conditional] Screenshot analysis

Step 3: Synthesis (architect/reasoning)
  → Merge findings, resolve conflicts, produce unified diagnosis

Step 4: Diagnosis Report
  → Present findings, ask user to approve fix

Step 5: Fix (worker/standard) [on approval]
  → TDD: failing test → fix → verify → commit

Step 6: Verify (architect/reasoning)
  → Confirm fix addresses root cause, no regressions
```

## Step Details

### Step 1: Triage (scout/fast)

Dispatch `scout` agent to:
1. Parse and normalize all inputs into a structured triage report
2. Classify bug type: runtime error, logic bug, UI bug, build error, test failure, performance issue
3. Identify affected area: files, modules, dependencies mentioned in error
4. Detect external library involvement → sets `needsResearcher: true`
5. Detect image input → sets `needsVision: true`

```
subagent({
  agent: "scout",
  tier: "fast",
  task: "Triage this bug report. Parse the input, classify the bug type, identify affected files/modules, and determine if external libraries are involved.\n\nBug input:\n{INPUT}\n\nScope hints: {SCOPE}\n\nReturn JSON:\n{\n  \"bug_type\": \"runtime_error|logic_bug|ui_bug|build_error|test_failure|performance\",\n  \"summary\": \"one-line summary\",\n  \"affected_area\": [\"files/modules mentioned or inferred\"],\n  \"error_text\": \"extracted error message if present\",\n  \"stack_trace\": \"extracted stack trace if present\",\n  \"tech_stack\": [\"relevant frameworks/libraries\"],\n  \"needsResearcher\": true/false,\n  \"needsVision\": true/false,\n  \"scope_hints\": [\"paths to prioritize\"]\n}"
})
```

### Step 2: Parallel Investigation

**Always dispatched:**

| Agent | Tier | Role |
|-------|------|------|
| bug-hunter #1 | reasoning | **Root cause analysis** — trace the error through code, identify the exact bug location, explain why it happens |
| bug-hunter #2 | reasoning | **Pattern analysis** — find similar code patterns, related test failures, recent git changes to affected files, check if this is a regression |

**Conditionally dispatched:**

| Agent | Tier | Condition | Role |
|-------|------|-----------|------|
| researcher | standard | `needsResearcher: true` | Look up docs, known issues, changelogs for relevant library/framework |
| vision | standard | `needsVision: true` | Analyze screenshots, identify UI state, compare expected vs actual |

```
subagent({
  tasks: [
    {
      agent: "bug-hunter",
      tier: "reasoning",
      task: "MODE: root-cause-analysis\n\n{TRIAGE_REPORT}\n\nTrace the error through the code. Find the exact location of the bug and explain why it happens. Follow data flow, check types, read relevant files.\n\nScope hints (prioritize but don't restrict): {SCOPE}\n\nReturn JSON: { hypothesis, confidence, evidence: [], affected_files: [], suggested_fix }"
    },
    {
      agent: "bug-hunter",
      tier: "reasoning",
      task: "MODE: pattern-analysis\n\n{TRIAGE_REPORT}\n\nSearch for similar patterns in the codebase. Check: related test failures, recent git changes to affected files (`git log --oneline -20 -- {files}`), similar code that works correctly. Determine if this is a regression.\n\nScope hints (prioritize but don't restrict): {SCOPE}\n\nReturn JSON: { hypothesis, confidence, evidence: [], affected_files: [], suggested_fix }"
    },
    // conditional: researcher if needsResearcher
    // conditional: vision if needsVision
  ]
})
```

**Investigation output format:**
```json
{
  "hypothesis": "Description of suspected root cause",
  "confidence": 0.85,
  "evidence": ["file.ts:42 — null check missing", "git log shows field removed in abc123"],
  "affected_files": ["src/auth/login.ts", "src/auth/session.ts"],
  "suggested_fix": "Brief description of fix approach"
}
```

### Step 3: Synthesis (architect/reasoning)

The architect merges all investigation outputs:
1. Identifies agreement and disagreement between investigators
2. Evaluates evidence quality — concrete code evidence vs. speculation
3. Produces unified diagnosis with confidence score

**Conflict resolution:**
- Investigators agree (or one has clearly stronger evidence) → unified diagnosis
- Genuine disagreement with comparable evidence → architect picks most likely, notes alternatives
- Architect can't resolve (confidence: low) → escalate to user with both hypotheses

```
subagent({
  agent: "architect",
  tier: "reasoning",
  task: "Synthesize these troubleshooting findings into a unified diagnosis.\n\nTriage: {TRIAGE_REPORT}\n\nInvestigation results:\n{INVESTIGATION_RESULTS}\n\nMerge findings, resolve conflicts, evaluate evidence quality. If investigators disagree, pick the hypothesis with stronger code evidence.\n\nReturn JSON:\n{\n  \"root_cause\": \"definitive description\",\n  \"confidence\": \"high|medium|low\",\n  \"evidence_summary\": [\"key evidence points\"],\n  \"affected_files\": [\"deduplicated list\"],\n  \"fix_approach\": \"recommended fix strategy\",\n  \"competing_hypotheses\": []\n}"
})
```

### Step 4: Diagnosis Report

The orchestrating agent formats and presents:

```
## Troubleshooting Diagnosis

**Root cause:** [description]
**Confidence:** high/medium/low
**Affected files:** [list]

### Evidence
- [evidence point 1]
- [evidence point 2]

### Suggested Fix
[description of fix approach]

### Investigators
- Bug hunter #1: [hypothesis summary] (confidence: X)
- Bug hunter #2: [hypothesis summary] (confidence: X)
- Researcher: [relevant findings] (if dispatched)
- Vision: [UI observations] (if dispatched)

Proceed with fix? (y/n)
```

**If confidence is low or competing hypotheses exist:**
Present both hypotheses with evidence and ask the user which direction to pursue.

### Step 5: Fix (worker/standard)

On user approval, dispatch `worker` agent with:
- The unified diagnosis
- Full evidence trail
- Instruction to follow TDD:
  1. Write a failing test that reproduces the bug
  2. Verify it fails
  3. Implement the minimal fix
  4. Verify the test passes
  5. Run full test suite for regressions
  6. Self-review changes
  7. Commit with descriptive message

```
subagent({
  agent: "worker",
  tier: "standard",
  task: "Fix this bug using TDD.\n\nDiagnosis:\n{DIAGNOSIS}\n\nEvidence:\n{EVIDENCE}\n\n1. Write a failing test that reproduces the bug\n2. Verify it fails\n3. Implement the minimal fix\n4. Verify the test passes\n5. Run full test suite\n6. Self-review\n7. Commit\n\nReturn: { status: 'DONE'|'BLOCKED', files_changed: [], test_added: '', commit_sha: '', notes: '' }"
})
```

### Step 6: Verify (architect/reasoning)

```
subagent({
  agent: "architect",
  tier: "reasoning",
  task: "Verify this bug fix.\n\nOriginal diagnosis:\n{DIAGNOSIS}\n\nChanges made:\n{FIX_SUMMARY}\n\nCheck:\n1. Fix addresses the identified root cause (not just symptoms)\n2. Regression test is meaningful and would catch recurrence\n3. No unintended side effects\n4. All tests pass\n\nReturn: { verified: true/false, reasoning: '...' }"
})
```

If verification fails → report to user with explanation. Don't loop automatically.

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `skills/troubleshooting/SKILL.md` | Create | Main skill — full pipeline orchestration instructions |
| `prompts/troubleshoot.md` | Create | Entry point prompt for `/troubleshoot` command |
| `tests/skills.test.ts` | Modify | Add "troubleshooting" to EXPECTED_SKILLS, update count to 21 |

**No new agents needed.** Reuses: scout, bug-hunter, researcher, vision, architect, worker.

**No new extensions needed.** The orchestrating agent handles the pipeline using the existing `subagent` tool.

## Tier Mapping

| Step | Agent | Tier | Default Model |
|------|-------|------|---------------|
| 1. Triage | scout | fast | claude-haiku-4-5 |
| 2. Investigation | bug-hunter ×2 | reasoning | claude-opus-4-6 |
| 2. Research (conditional) | researcher | standard | claude-sonnet-4-6 |
| 2. Vision (conditional) | vision | standard | claude-sonnet-4-6 |
| 3. Synthesis | architect | reasoning | claude-opus-4-6 |
| 5. Fix | worker | standard | claude-sonnet-4-6 |
| 6. Verify | architect | reasoning | claude-opus-4-6 |

## Integration with Existing Skills

- **systematic-debugging** — the troubleshooting pipeline distributes the same four-phase methodology (root cause → pattern analysis → hypothesis → fix) across parallel agents
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
- Include evidence for every claim
- Present competing hypotheses when confidence is low
- Follow TDD when fixing (failing test first)
- Run full test suite before committing fix

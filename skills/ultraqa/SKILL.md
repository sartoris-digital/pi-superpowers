---
name: ultraqa
description: Autonomous QA cycling - verify, diagnose, fix, repeat until goal met (max 5 cycles)
---

# UltraQA

Autonomous QA cycling workflow that runs until your quality goal is met.

**Cycle**: Run verification → diagnose failures → fix → repeat (max 5 cycles)

## Goal Parsing

Parse the goal from arguments:

| Invocation | Goal Type | Verification Command |
|------------|-----------|---------------------|
| `--tests` | tests | Project's test command |
| `--build` | build | Project's build command |
| `--lint` | lint | Project's lint command |
| `--typecheck` | typecheck | `tsc --noEmit` or equivalent |
| `--custom "pattern"` | custom | Run command and check for pattern |

If no structured goal provided, interpret the argument as a custom goal.

## Cycle Workflow (Max 5 Cycles)

### Step 1: Run Verification

Execute the verification command based on goal type. Capture full output.

### Step 2: Check Result

- **PASS** → Exit with success message
- **FAIL** → Continue to Step 3

### Step 3: Diagnose Failure

Dispatch `bug-hunter` at reasoning tier to analyze the failure:

```
subagent({
  agent: "bug-hunter",
  tier: "reasoning",
  task: "DIAGNOSE QA FAILURE:\n\nGoal type: {GOAL_TYPE}\nCycle: {N} of 5\n\nVerification output:\n```\n{OUTPUT}\n```\n\nProvide:\n1. Root cause analysis for each failure\n2. Specific fix recommendations with file paths and line numbers\n3. Order fixes from most likely to resolve the issue to least"
})
```

### Step 4: Apply Fixes

Dispatch `worker` at standard tier to implement the recommended fixes:

```
subagent({
  agent: "worker",
  tier: "standard",
  task: "FIX QA FAILURES:\n\nDiagnosis:\n{DIAGNOSIS}\n\nApply the recommended fixes precisely. Do not make unrelated changes."
})
```

### Step 5: Repeat

Go back to Step 1.

## Exit Conditions

| Condition | Action |
|-----------|--------|
| Goal met | "ULTRAQA COMPLETE: Goal met after N cycles" |
| Cycle 5 reached | "ULTRAQA STOPPED: Max cycles reached. Remaining issues: ..." |
| Same failure 3x | "ULTRAQA STOPPED: Same failure detected 3 times. Root cause: ..." |

## Progress Reporting

Output progress each cycle:

```
[ULTRAQA Cycle 1/5] Running typecheck...
[ULTRAQA Cycle 1/5] FAILED - 3 type errors
[ULTRAQA Cycle 1/5] Diagnosing via bug-hunter...
[ULTRAQA Cycle 1/5] Fixing: subagent.ts - missing details field
[ULTRAQA Cycle 2/5] Running typecheck...
[ULTRAQA Cycle 2/5] PASSED - No errors
[ULTRAQA COMPLETE] Goal met after 2 cycles
```

## Important Rules

1. **Track failures** — record each failure to detect repeat patterns
2. **Early exit on pattern** — 3x same failure means stop and surface the root cause
3. **Clear output** — user should always know current cycle and status
4. **No scope creep** — only fix what the verification catches, nothing else

## Placeholders

| Placeholder | Source |
|-------------|--------|
| `{GOAL_TYPE}` | Parsed from arguments |
| `{N}` | Current cycle number |
| `{OUTPUT}` | Verification command output |
| `{DIAGNOSIS}` | Bug-hunter's analysis |

---
name: ralph
description: PRD-driven persistence loop — keep working until all user stories pass with architect verification
---

# Ralph

Ralph is a PRD-driven persistence loop that keeps working until ALL user stories pass and are verified. It wraps ultrawork's parallel execution with structured story tracking and mandatory verification.

## When to Use

- Task requires guaranteed completion with verification
- User says "ralph", "don't stop", "must complete", "finish this", "keep going until done"
- Work may span multiple iterations and needs persistence
- Task benefits from structured PRD-driven execution with reviewer sign-off

## When NOT to Use

- User wants a full autonomous pipeline from idea to code — use `autopilot`
- User wants to explore before committing — use `brainstorming`
- Quick one-shot fix — delegate directly to worker/executor

## PRD Structure

Save the PRD to `docs/superpowers/prd.json`:

```json
{
  "goal": "One-sentence description",
  "stories": [
    {
      "id": "US-001",
      "title": "Story title",
      "acceptanceCriteria": [
        "Function X returns Y when given Z",
        "Test file exists at path P and passes",
        "TypeScript compiles with no errors"
      ],
      "passes": false
    }
  ]
}
```

## Steps

### Step 1: PRD Setup (first iteration only)

Check if `docs/superpowers/prd.json` exists. If not, create it.

**CRITICAL: Write task-specific acceptance criteria.** Generic criteria ("Implementation is complete") are useless. Replace them with concrete, testable criteria specific to this task.

Order stories by priority — foundational work first, dependent work later.

### Step 2: Pick Next Story

Read `docs/superpowers/prd.json` and select the highest-priority story with `passes: false`.

### Step 3: Implement the Story

Dispatch to specialist agents at appropriate tiers:

```
subagent({
  tasks: [
    { agent: "worker", tier: "standard", task: "Implement story: {story}" },
    // parallel tasks if story has independent subtasks
  ]
})
```

If discovery reveals sub-tasks, add them as new stories to the PRD.

### Step 4: Verify Acceptance Criteria

For EACH criterion in the story, verify it is met with fresh evidence:

- Run relevant tests and read the output
- Run typecheck/build
- If any criterion is NOT met, continue working — do NOT mark complete

### Step 5: Mark Story Complete

When ALL criteria pass:
1. Set `passes: true` in `docs/superpowers/prd.json`
2. Record progress in `docs/superpowers/progress.txt`: what was implemented, files changed, learnings

### Step 6: Check PRD Completion

Are ALL stories marked `passes: true`? If not, return to Step 2.

### Step 7: Architect Verification

When all stories pass, dispatch architect for verification:

```
subagent({
  agent: "architect",
  tier: "reasoning",
  task: "MODE: verification\nAll stories complete. Verify: {acceptance_criteria}"
})
```

Verification tier:
- <5 files, <100 lines, full tests: standard tier (sonnet)
- Default: standard tier
- >20 files or security/architectural: reasoning tier (opus)

### Step 8: Completion

On architect approval:
- Invoke `/cancel` skill to clean up state
- Report to user with summary

On rejection:
- Fix the raised issues
- Re-verify with architect
- Loop back if stories need to be marked incomplete

## PRD Quality Rules

**Good acceptance criteria (specific and testable):**
- "detectNoPrdFlag('ralph --no-prd fix') returns true"
- "TypeScript compiles with `npm run build` — zero errors"
- "GET /api/users returns 200 with pagination metadata"

**Bad acceptance criteria (generic):**
- "Implementation is complete"
- "Code compiles without errors"
- "Feature works correctly"

## Failure Handling

- If the same issue recurs across 3+ iterations, report as a fundamental problem requiring human input
- If a blocker requires missing credentials or external services, report and pause
- Continue when the system sends continuation signals — keep working

## Final Checklist

- [ ] All prd.json stories have `passes: true`
- [ ] Acceptance criteria are task-specific (not generic boilerplate)
- [ ] All requirements from the original task are met
- [ ] Zero pending TODO items
- [ ] Fresh test output shows all tests pass
- [ ] Fresh build output shows success
- [ ] Architect verification passed
- [ ] `/cancel` invoked for clean state cleanup

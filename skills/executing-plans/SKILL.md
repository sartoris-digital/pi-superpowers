---
name: executing-plans
description: Use when you have a written implementation plan to execute in a separate session with review checkpoints
---

# Executing Plans

## Overview

Load plan, review critically, execute all tasks, report when complete.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

**Note:** Tell your human partner that Superpowers works much better with access to subagents. The quality of its work will be significantly higher if run on a platform with subagent support (such as Claude Code or Codex). If subagents are available, use superpowers:subagent-driven-development instead of this skill.

## Execution Strategies

Select a strategy based on the plan type and user preference:

| Strategy | Flag | Keyword | Best For |
|----------|------|---------|----------|
| Sequential | (default) | — | Dependent tasks, small plans |
| Parallel | `--parallel` | "parallel" | Many independent tasks |
| Autopilot | `--autopilot` | "autopilot" | Large plans, hands-off |
| Ralph | `--ralph` | "ralph" | PRD with user stories |

### Strategy 1: Sequential (Default)

#### Step 1: Load and Review Plan
1. Read plan file
2. Review critically - identify any questions or concerns about the plan
3. If concerns: Raise them with your human partner before starting
4. If no concerns: Create TodoWrite and proceed

#### Step 2: Execute Tasks

For each task:
1. Mark as in_progress
2. Follow each step exactly (plan has bite-sized steps)
3. Run verifications as specified
4. Dispatch architect for verification:
   ```
   subagent({
     agent: "architect",
     task: "MODE: verification\n\nTask: [task N description]\nClaimed: Task complete.\n\nVerify: [specific verification steps from plan]",
     tier: "[based on task complexity]"
   })
   ```
5. If architect returns "verified" → mark as completed
6. If architect returns "insufficient" or "failed" → address gaps, re-verify

#### Step 3: Complete Development

After all tasks complete and verified:
- Announce: "I'm using the finishing-a-development-branch skill to complete this work."
- **REQUIRED SUB-SKILL:** Use superpowers:finishing-a-development-branch
- Follow that skill to verify tests, present options, execute choice

### Strategy 2: Parallel

1. Load and review plan
2. Analyze tasks for independence (no shared files, no data dependencies)
3. Group independent tasks into parallel batches (max 8 per batch, 4 concurrent)
4. For each batch:
   ```
   subagent({
     tasks: [
       { agent: "worker", task: "Task N: [description]", tier: "[from plan]" },
       { agent: "worker", task: "Task M: [description]", tier: "[from plan]" },
       ...
     ]
   })
   ```
5. After each batch: verify results, resolve any conflicts
6. Sequential tasks run between parallel batches
7. Final verification via architect

### Strategy 3: Autopilot

1. Load and review plan
2. Activate persistence mode via the `state` tool:
   ```
   Use state tool: operation="write", key="autopilot", data={
     "active": true,
     "phase": "execute",
     "totalTasks": N,
     "completedTasks": 0,
     "iteration": 1
   }
   ```
3. **Execute phase:** Run tasks using parallel strategy where possible
4. **QA phase:** Run full test suite, fix any failures
   ```
   Use state tool: operation="write", key="autopilot", data={
     "active": true, "phase": "qa", "totalTasks": N,
     "completedTasks": <current>, "iteration": <current>
   }
   ```
5. **Validate phase:** Dispatch architect for thorough verification
   ```
   Use state tool: operation="write", key="autopilot", data={
     "active": true, "phase": "validate", "totalTasks": N,
     "completedTasks": <current>, "iteration": <current>
   }
   subagent({
     agent: "architect",
     task: "MODE: verification\n\n[comprehensive verification prompt]",
     tier: "reasoning"
   })
   ```
6. If validation passes → deactivate and invoke /cancel:
   ```
   Use state tool: operation="write", key="autopilot", data={ "active": false, "reason": "complete" }
   ```
   Then invoke the cancel skill.
7. If validation fails → return to execute phase with fixes

### Strategy 4: Ralph (Story-Driven)

1. Load PRD file (`.pi/state/prd.json` or plan with story structure)
2. Activate persistence mode via the `state` tool:
   ```
   Use state tool: operation="write", key="ralph", data={
     "active": true,
     "stories": [{ "name": "Story 1", "status": "pending", "criteria": ["..."] }, ...],
     "completedStories": [],
     "iteration": 1
   }
   ```
3. For each pending story:
   a. Dispatch worker to implement
   b. Verify against acceptance criteria
   c. Dispatch architect for verification
   d. If verified → mark story complete:
      ```
      Use state tool: operation="write", key="ralph", data={
        "active": true, "stories": [<updated statuses>],
        "completedStories": ["Story 1", ...], "iteration": <current>
      }
      ```
   e. If failed → fix and re-verify
4. When all stories complete → deactivate and invoke /cancel
5. Track learnings in `.pi/state/progress.md`

## When to Stop and Ask for Help

**STOP executing immediately when:**
- Hit a blocker (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing starting
- You don't understand an instruction
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

## When to Revisit Earlier Steps

**Return to Review (Step 1) when:**
- Partner updates the plan based on your feedback
- Fundamental approach needs rethinking

**Don't force through blockers** - stop and ask.

## Remember
- Review plan critically first
- Follow plan steps exactly
- Don't skip verifications
- Reference skills when plan says to
- Stop when blocked, don't guess
- Never start implementation on main/master branch without explicit user consent

## Integration

**Required workflow skills:**
- **superpowers:using-git-worktrees** - REQUIRED: Set up isolated workspace before starting
- **superpowers:writing-plans** - Creates the plan this skill executes
- **superpowers:finishing-a-development-branch** - Complete development after all tasks

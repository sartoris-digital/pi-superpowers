---
name: autopilot
description: Full autonomous execution from idea to working code — expand, plan, implement, QA, validate
---

# Autopilot

Autopilot takes a product idea and autonomously handles the full lifecycle: requirements analysis, technical design, planning, parallel implementation, QA cycling, and multi-perspective validation.

## When to Use

- User wants end-to-end autonomous execution from idea to working code
- User says "autopilot", "build me", "create me", "make me", "full auto", or "I want a/an..."
- Task requires multiple phases: planning, coding, testing, and validation
- User wants hands-off execution

## When NOT to Use

- User wants to explore options — use `brainstorming` skill instead
- User says "just explain" or "what would you suggest" — respond conversationally
- User wants a single focused code change — delegate to worker/executor directly
- Task is a quick fix or small bug — use direct agent delegation

## Execution Policy

- Each phase must complete before the next begins
- Parallel subagent dispatch is used within phases where possible
- QA cycles repeat up to 5 times; if the same error persists 3 times, stop and report
- Validation requires approval from all reviewers; rejected items get fixed and re-validated

## Phase 0: Expansion

Turn the user's idea into a detailed spec.

**Skip Phase 0 if** a deep-interview spec exists at `docs/superpowers/specs/deep-interview-*.md` — use the pre-validated spec directly.

**If input is vague** (no file paths, function names, or concrete anchors), offer redirect to `deep-interview` for Socratic clarification before expanding.

**Otherwise:**

```
subagent({
  agent: "analyst",
  tier: "reasoning",
  task: "Extract requirements, acceptance criteria, and gaps from this idea: {idea}"
})

subagent({
  agent: "architect",
  tier: "reasoning",
  task: "MODE: plan-review\nCreate technical specification from this analyst output: {analyst_output}"
})
```

Save spec to `docs/superpowers/autopilot/spec.md`.

## Phase 1: Planning

Create an implementation plan from the spec.

**Skip Phase 1 if** a ralplan consensus plan exists at `docs/superpowers/plans/ralplan-*.md`.

```
subagent({
  chain: [
    { agent: "scout", tier: "fast", task: "Map relevant codebase areas for: {spec}" },
    { agent: "planner", tier: "standard", task: "Create implementation plan from spec: {spec}\nContext: {previous}" }
  ]
})
```

Then validate with critic:
```
subagent({
  agent: "critic",
  tier: "reasoning",
  task: "Review this implementation plan: {plan}"
})
```

Save plan to `docs/superpowers/plans/autopilot-impl.md`.

## Phase 2: Execution

Implement the plan using parallel subagent dispatch.

```
subagent({
  tasks: [
    { agent: "worker", tier: "standard", task: "Implement task 1 from plan: {plan}" },
    { agent: "worker", tier: "standard", task: "Implement task 2 from plan: {plan}" }
  ]
})
```

Route complex tasks to reasoning tier, simple tasks to fast tier.

## Phase 3: QA Cycling

Cycle until all tests pass (max 5 cycles):

1. Run build and tests
2. If failures: dispatch debugger to fix
3. Repeat until green or cycle limit reached

If the same error persists across 3 cycles, stop and report — indicates a fundamental issue requiring human input.

## Phase 4: Validation

Multi-perspective review in parallel:

```
subagent({
  tasks: [
    { agent: "architect", tier: "reasoning", task: "MODE: verification\nVerify functional completeness: {changes}" },
    { agent: "security-reviewer", tier: "reasoning", task: "Review for vulnerabilities: {changes}" },
    { agent: "code-reviewer", tier: "reasoning", task: "Review code quality: {changes}" }
  ]
})
```

All must approve. Fix and re-validate on rejection (max 3 rounds).

## Phase 5: Cleanup

Remove state files and report completion to user with a summary of what was built.

## 3-Stage Pipeline Integration

The recommended full pipeline chains three quality gates:

```
/deep-interview "vague idea"
  → Socratic Q&A → spec (ambiguity ≤ 20%)
  → /ralplan → consensus plan (planner/architect/critic approved)
  → /autopilot → skips Phase 0+1, starts at Phase 2 (Execution)
```

## Final Checklist

- [ ] All phases completed (Expansion, Planning, Execution, QA, Validation)
- [ ] All validators approved in Phase 4
- [ ] Tests pass (verified with fresh test run output)
- [ ] Build succeeds (verified with fresh build output)
- [ ] User informed with summary of what was built

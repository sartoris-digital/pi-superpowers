---
name: ralplan
description: Consensus planning with adversarial review — planner, architect, and critic iterate until approved
---

# Ralplan — Consensus Planning

Iterative planning workflow where a planner creates, an architect reviews for feasibility, and a critic challenges for quality. The loop continues until the critic approves.

## When to Use

- High-risk or high-complexity features
- Architectural decisions that are hard to reverse
- When the user explicitly requests consensus planning
- When invoked from brainstorming after user chooses "consensus plan"

## Process

### Step 1: Generate Initial Plan

Dispatch planner (standard tier) to create the implementation plan:

```
subagent({
  agent: "planner",
  task: "Create an implementation plan for:\n\n[requirements]\n\nContext:\n[codebase context from scout]\n\nReturn a structured plan with numbered tasks, file paths, and verification steps.",
  tier: "standard"
})
```

### Step 2: Architect Review

Dispatch architect (reasoning tier) to review feasibility:

```
subagent({
  agent: "architect",
  task: "MODE: plan-review\n\nReview this implementation plan:\n\n[plan from Step 1]\n\nEvaluate feasibility, completeness, ordering, and risks.",
  tier: "reasoning"
})
```

If architect returns concerns or rejected → revise plan and re-submit.

### Step 3: Critic Review

Dispatch critic (reasoning tier) to challenge quality:

```
subagent({
  agent: "critic",
  task: "Review this implementation plan:\n\n[plan from Step 1]\n\nArchitect assessment:\n[architect output from Step 2]\n\nProvide adversarial review. You MUST present an alternative approach before approving.",
  tier: "reasoning"
})
```

If critic returns "revise" → incorporate feedback, return to Step 1.

### Step 4: Loop Control

- Maximum 5 iterations of the planner → architect → critic loop
- If critic approves → proceed to Step 5
- If 5 iterations without approval → present current state to user for guidance

### Step 5: Output

Produce final plan with:
- The approved implementation plan
- Architecture Decision Record (ADR):
  - Decision: What was decided
  - Context: Why this approach was chosen
  - Alternatives considered: From critic's reviews
  - Consequences: Trade-offs accepted

Save to `docs/plans/` and offer to execute.

## Red Flags

- Do not skip the critic step — that defeats the purpose
- Do not let the loop run indefinitely — 5 iterations max, then ask the human
- The critic MUST present an alternative — if it doesn't, re-dispatch with emphasis

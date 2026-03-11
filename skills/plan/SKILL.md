---
name: plan
description: Unified planning entry point — detects broad vs. specific requests and routes to appropriate planning workflow
---

# Plan

Unified planning entry point. Routes to interview mode (broad requests) or direct planning (specific requests), with optional escalation to consensus planning (ralplan).

## When to Use

- When a user says "plan this", "plan the", or invokes `/plan`
- When a broad request is detected (vague verbs, no specific files, touches 3+ areas)
- Before any implementation work on a non-trivial feature

## Broad vs. Specific Detection

**Broad request** (needs interview mode) — any of:
- Uses vague verbs: "improve", "enhance", "fix", "refactor" without specific targets
- No specific file or function mentioned
- Touches 3+ unrelated areas
- Single sentence without clear deliverable

**Specific request** (direct planning) — all of:
- References specific files, functions, or components
- Clear deliverable described
- Scope is well-bounded

## Interview Mode (Broad Requests)

1. Dispatch scout (fast tier) to gather codebase context relevant to the request
2. Ask clarifying questions ONE AT A TIME:
   - What is the desired outcome?
   - What constraints exist? (performance, backward compat, etc.)
   - What is the scope boundary? (what's in, what's out)
   - What does success look like? (testable criteria)
3. After 3-5 questions, summarize understanding and confirm
4. Invoke the `writing-plans` skill with gathered context

## Direct Mode (Specific Requests)

1. Dispatch scout (fast tier) for quick context on referenced files
2. Invoke the `writing-plans` skill directly with the request

## Consensus Option

After initial planning mode is determined, offer:
> "Would you like a standard plan, or a consensus plan with architect and critic review (ralplan)?"

If consensus chosen, invoke the `ralplan` skill instead of `writing-plans`.

## Red Flags

- Do not start implementation without a plan for non-trivial work
- Do not skip the interview for broad requests — assumptions waste time
- Do not ask more than 5 clarifying questions — scope should be clear by then

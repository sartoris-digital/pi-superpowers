---
name: ultrawork
description: Parallel execution engine — fire multiple independent agents simultaneously with smart model tier routing
---

# Ultrawork

Ultrawork is a parallel execution engine that runs multiple agents simultaneously for independent tasks. It provides parallelism and smart model routing but is a component, not a standalone persistence mode.

## When to Use

- Multiple independent tasks can run simultaneously
- User says "ultrawork", "parallel", or wants concurrent execution
- Need to delegate work to multiple agents at once

## When NOT to Use

- Task requires guaranteed completion with verification — use `ralph` instead (ralph includes ultrawork)
- Task requires a full autonomous pipeline — use `autopilot` (autopilot includes ralph)
- Only one sequential task with no parallelism opportunity — delegate directly to an agent

## Execution Policy

- Fire all independent agent calls simultaneously — never serialize independent work
- Route tasks to cost-appropriate tiers
- Use parallel dispatch for independent tasks, sequential for dependent ones

## Model Tier Routing

| Tier | Best For |
|------|----------|
| `fast` (Haiku) | Simple lookups, definitions, trivial edits |
| `standard` (Sonnet) | Standard implementation, feature work |
| `reasoning` (Opus) | Complex analysis, debugging, architecture |

## Steps

1. **Classify tasks by independence** — which tasks can run in parallel vs. which have dependencies
2. **Route to correct tiers** — match task complexity to model cost
3. **Fire independent tasks simultaneously:**

```
subagent({
  tasks: [
    { agent: "worker", tier: "fast", task: "Add missing type export for Config interface" },
    { agent: "worker", tier: "standard", task: "Implement the /api/users endpoint with validation" },
    { agent: "worker", tier: "standard", task: "Add integration tests for auth middleware" }
  ]
})
```

4. **Run dependent tasks sequentially** — wait for prerequisites before launching dependent work
5. **Verify when all tasks complete:**
   - Build/typecheck passes
   - Affected tests pass
   - No new errors introduced

## Examples

**Good — parallel independent tasks:**
```
subagent({
  tasks: [
    { agent: "worker", tier: "fast", task: "Fix typo in error message" },
    { agent: "worker", tier: "standard", task: "Add pagination to GET /users" },
    { agent: "worker", tier: "standard", task: "Write tests for auth service" }
  ]
})
```

**Bad — sequential independent tasks:**
```
subagent({ agent: "worker", task: "Fix typo" })
// wait...
subagent({ agent: "worker", task: "Add pagination" })
// These could have run in parallel
```

## Relationship to Other Modes

```
ralph (persistence wrapper)
  └── includes ultrawork (this skill)

autopilot (full lifecycle)
  └── includes ralph
      └── includes ultrawork (this skill)
```

Ultrawork provides parallelism. Ralph adds persistence and verification. Autopilot adds the full lifecycle.

## Final Checklist

- [ ] All parallel tasks completed
- [ ] Build/typecheck passes
- [ ] Affected tests pass
- [ ] No new errors introduced

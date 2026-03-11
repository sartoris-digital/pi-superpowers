# Pi Platform Tool Mapping

This table maps Claude Code tool names (used in skill documentation) to their Pi platform equivalents.

| Claude Code Tool | Pi Equivalent | Notes |
|------------------|---------------|-------|
| `Task` | `subagent` | Use `subagent({ agent: "worker", task: "..." })` |
| `Agent` | `subagent` (parallel mode) | Use `subagent({ tasks: [...] })` for parallel dispatch |
| `Skill` | Auto-triggered / `/skill-name` | Skills match on description; slash commands also work |
| `TodoWrite` | `TodoWrite` | Same tool, no change needed |
| `Read` | `Read` | Same tool, no change needed |
| `Write` | `Write` | Same tool, no change needed |
| `Edit` | `Edit` | Same tool, no change needed |
| `Bash` | `Bash` | Same tool, no change needed |
| `Glob` | `Glob` | Same tool, no change needed |
| `Grep` | `Grep` | Same tool, no change needed |
| `EnterWorktree` | N/A | Use `git worktree add` via Bash instead |
| `ExitWorktree` | N/A | Use `git worktree remove` via Bash instead |

## Subagent Modes

Pi's `subagent` tool supports three dispatch modes:

### Single Mode
```
subagent({ agent: "worker", task: "Implement feature X following TDD" })
```

### Chain Mode (sequential stages)
```
subagent({
  chain: [
    { agent: "worker", task: "Implement feature X" },
    { agent: "code-reviewer", task: "Review changes from {previous}" }
  ]
})
```

### Parallel Mode (independent tasks)
```
subagent({
  tasks: [
    { agent: "worker", task: "Fix auth module" },
    { agent: "worker", task: "Fix payment module" }
  ]
})
```

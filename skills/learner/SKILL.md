---
name: learner
description: Extract a hard-won debugging insight from the current conversation into a reusable skill file
---

# Learner

Extract reusable skills from the current conversation — principles and decision-making heuristics that teach how to THINK about a class of problems, not just what code to produce.

## Quality Gate

Before extracting, the insight MUST pass all three checks:

1. **Non-Googleable** — Could someone find this in 5 minutes of searching? If yes, STOP.
2. **Codebase-specific** — Does it reference actual files, error messages, or patterns from THIS project? If no, STOP.
3. **Hard-won** — Did it take real debugging effort to discover? If no, STOP.

## When to Use

- After solving a tricky bug that required deep investigation
- After discovering a non-obvious workaround specific to this codebase
- After finding a hidden gotcha that wastes time when forgotten
- After uncovering undocumented behavior that affects this project

## When NOT to Use

- Generic programming patterns (use documentation instead)
- Library usage examples (use library docs)
- Type definitions or boilerplate
- Anything a developer could Google in 5 minutes

## Extraction Process

### Step 1: Gather Information

From the current conversation, identify:

- **Problem Statement**: The SPECIFIC error, symptom, or confusion that occurred. Include actual error messages, file paths, line numbers.
- **Solution**: The EXACT fix — code snippets, file paths, configuration changes.
- **Triggers**: Keywords that would appear when hitting this problem again (error message fragments, file names, symptom descriptions).

### Step 2: Write the Skill File

Save to `.pi/skills/learned/<slug>.md`:

```markdown
---
name: <descriptive-name>
description: <one-line description>
triggers: [<keyword1>, <keyword2>, <keyword3>]
---

# <Skill Name>

## The Insight
What is the underlying PRINCIPLE discovered? Not the code, but the mental model.

## Why This Matters
What goes wrong if you don't know this? What symptom led here?

## Recognition Pattern
How do you know when this skill applies? What are the signs?

## The Approach
The decision-making heuristic. How should the agent THINK about this?

## Example
Code illustration of the principle (if helpful).
```

### Step 3: Confirm with User

Present the extracted skill and ask for approval before saving:
- Show the skill content
- Confirm the save location
- Ask if anything should be adjusted

## Anti-Patterns (DO NOT Extract)

| Pattern | Why Not |
|---------|---------|
| "When you see Error X, add try/catch" | Mimicking, not understanding |
| "Use library X for Y" | Googleable |
| "Always validate inputs" | Generic advice |
| Standard design patterns | Universal knowledge |

## Good Examples

| Insight | Why It's Worth Saving |
|---------|----------------------|
| "The ESM path resolution in this project requires fileURLToPath + specific relative paths" | Codebase-specific, non-obvious |
| "Race condition in worker.ts — Promise.all at line 89 needs await before map callback" | Hard-won debugging, precise location |
| "The pi-coding-agent SDK changed AgentToolResult to require `details` field in v4.x" | Undocumented breaking change |

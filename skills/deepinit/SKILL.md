---
name: deepinit
description: Deep codebase initialization — create hierarchical AGENTS.md documentation across the entire project
---

# Deep Init

Creates comprehensive, hierarchical AGENTS.md documentation across the entire codebase. AI-readable documentation that helps agents understand what each directory contains, how components relate, and how to work in each area.

## When to Use

- Starting work on a new codebase
- AGENTS.md files are missing or outdated
- User says "deepinit", "init codebase docs", or "create AGENTS.md files"

## Hierarchical Parent Tag System

Every AGENTS.md (except root) includes a parent reference:

```markdown
<!-- Parent: ../AGENTS.md -->
```

This creates a navigable hierarchy agents can traverse.

## AGENTS.md Template

```markdown
<!-- Parent: {relative_path}/AGENTS.md -->
<!-- Generated: {timestamp} -->

# {Directory Name}

## Purpose
{One paragraph: what this directory contains and its role}

## Key Files
| File | Description |
|------|-------------|
| `file.ts` | Brief purpose |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `subdir/` | What it contains (see `subdir/AGENTS.md`) |

## For AI Agents

### Working In This Directory
{Special instructions for agents modifying files here}

### Testing Requirements
{How to test changes in this directory}

### Common Patterns
{Code patterns or conventions used here}

## Dependencies
### Internal
{Other codebase areas this depends on}
### External
{Key external packages used}

<!-- MANUAL: Notes below this line are preserved on regeneration -->
```

## Execution Workflow

### Step 1: Map Directory Structure

```
subagent({
  agent: "scout",
  tier: "fast",
  task: "List all directories recursively. Exclude: node_modules, .git, dist, build, __pycache__, .venv, coverage, .next"
})
```

### Step 2: Create Work Plan

Group directories by depth level:
```
Level 0: / (root)
Level 1: /src, /docs, /tests
Level 2: /src/components, /src/utils
...
```

### Step 3: Generate Level by Level

**Parent levels before child levels** — ensures parent references are valid.

For each directory, dispatch writer to generate content:

```
subagent({
  tasks: [
    // Same-level directories processed in parallel
    {
      agent: "writer",
      tier: "fast",
      task: "Generate AGENTS.md for directory: {dir}\nFiles: {file_list}\nSubdirs: {subdir_list}\nParent: {parent_path}/AGENTS.md"
    }
  ]
})
```

### Step 4: Update Mode (if AGENTS.md exists)

When files already exist:
1. Read existing content
2. Preserve `<!-- MANUAL: -->` sections
3. Update auto-generated sections
4. Update the `<!-- Updated: -->` timestamp

### Step 5: Validate Hierarchy

After generation:
- Verify all parent references resolve
- Check no orphaned AGENTS.md files
- Confirm all directories have coverage

## Empty Directory Handling

| Condition | Action |
|-----------|--------|
| No files, no subdirs | Skip — no AGENTS.md |
| No files, has subdirs | Minimal AGENTS.md with subdirectory listing only |
| Only generated files (*.min.js, *.map) | Skip |
| Has config files | AGENTS.md describing configuration purpose |

## Parallelization Rules

- Same-level directories: process in parallel
- Different levels: parent first, then children
- Large directories: dedicated agent per directory
- Small directories: batch multiple into one agent

## Quality Standards

### Must Include
- Accurate file descriptions (read the actual files)
- Correct parent references
- Subdirectory links to child AGENTS.md
- AI agent working instructions

### Must Avoid
- Generic boilerplate that could apply to any directory
- Incorrect file names or descriptions
- Broken parent references

---
name: ai-slop-cleaner
description: Clean AI-generated code slop with a regression-safe, deletion-first workflow and optional reviewer-only mode
---

# AI Slop Cleaner

Clean AI-generated code slop without drifting scope or changing intended behavior. A bounded cleanup workflow for code that works but feels bloated, repetitive, weakly tested, or over-abstracted.

## When to Use

- User says "deslop", "anti-slop", "AI slop", or "clean up the AI code"
- Code feels noisy, repetitive, or overly abstract after AI generation
- Duplicate logic, dead code, wrapper layers, boundary leaks, or weak test coverage
- User wants a reviewer-only pass via `--review`

## When NOT to Use

- New feature build or product change
- Broad redesign (not incremental cleanup)
- Generic refactor with no simplification intent

## Core Principles

- **Preserve behavior** unless explicitly asked to change it
- **Lock behavior with tests first** before making any edits
- **Write a cleanup plan before editing code**
- **Prefer deletion over addition**
- **Reuse existing utilities** before introducing new ones
- **Keep diffs small, reversible, and smell-focused**

## Review Mode (`--review`)

When invoked with `--review`, this is a **reviewer-only pass** — no edits:

1. Do NOT edit any files
2. Review the cleanup plan, changed files, and regression coverage
3. Check for: leftover dead code, duplicate logic, needless wrappers, missing tests, unintended behavior changes
4. Produce a reviewer verdict with required follow-ups
5. Hand needed changes back for a separate writer pass

## Cleanup Workflow

### Step 1: Protect Current Behavior

Identify what must stay the same. Add or run the narrowest regression tests needed before editing. If tests cannot come first, record the verification plan explicitly.

### Step 2: Write Cleanup Plan

- Bound the pass to the requested files or feature area
- List the concrete smells to remove
- Order work from safest deletion to riskier consolidation

### Step 3: Classify the Slop

Dispatch `code-reviewer` at standard tier to classify issues:

```
subagent({
  agent: "code-reviewer",
  tier: "standard",
  task: "MODE: slop-classification\n\nAnalyze these files for AI-generated code slop. Classify each issue into one of these categories:\n\n1. **Dead code** — unused code, unreachable branches, stale flags, debug leftovers\n2. **Duplication** — repeated logic, copy-paste branches, redundant helpers\n3. **Needless abstraction** — pass-through wrappers, speculative indirection, single-use helper layers\n4. **Boundary violations** — hidden coupling, misplaced responsibilities, wrong-layer imports\n5. **Missing tests** — behavior not locked, weak regression coverage, edge-case gaps\n\nFor each issue: cite file:line, category, severity (high/medium/low), and suggested fix.\n\nFiles to analyze:\n{FILES}"
})
```

### Step 4: Execute Ordered Passes

Run one smell-focused pass at a time, verifying after each:

**Pass 1: Dead code deletion**
- Remove unused imports, unreachable branches, stale flags, debug leftovers
- Run verification

**Pass 2: Duplicate removal**
- Consolidate repeated logic into shared utilities
- Run verification

**Pass 3: Naming and error-handling cleanup**
- Fix misleading names, inconsistent patterns, weak error handling
- Run verification

**Pass 4: Test reinforcement**
- Add missing tests for behavior that should be locked
- Run verification

### Step 5: Quality Gates

After all passes:
- Regression tests green
- Lint/typecheck clean
- No unintended behavior changes

### Step 6: Report

```
## Cleanup Report

### Changed Files
- file.ts: removed 3 dead functions, consolidated 2 duplicates

### Simplifications
- Removed X lines of dead code
- Consolidated N duplicate patterns into shared utility

### Verification
- All tests pass (N total)
- Typecheck clean

### Remaining Risks
- (any concerns or deferred items)
```

## Placeholders

| Placeholder | Source |
|-------------|--------|
| `{FILES}` | Target files from arguments, or changed files from git diff |

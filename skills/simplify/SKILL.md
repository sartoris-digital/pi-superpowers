---
name: simplify
description: Review changed code for reuse, quality, and efficiency, then fix any issues found
---

# Simplify: Code Review and Cleanup

Review all changed files for reuse, quality, and efficiency. Fix any issues found.

## Phase 1: Identify Changes

Run `git diff` (or `git diff HEAD` if there are staged changes) to see what changed. If there are no git changes, review the most recently modified files that the user mentioned or that you edited earlier in this conversation.

## Phase 2: Launch Three Review Agents in Parallel

Dispatch all three review agents simultaneously using the subagent tool's parallel mode. Pass each agent the full diff so it has the complete context.

```
subagent({
  tasks: [
    {
      agent: "code-reviewer",
      tier: "standard",
      task: "MODE: reuse-review\n\n<diff>\n{DIFF}\n</diff>\n\nReview this diff for CODE REUSE opportunities only. For each change:\n\n1. **Search for existing utilities and helpers** that could replace newly written code. Look for similar patterns elsewhere in the codebase — common locations are utility directories, shared modules, and files adjacent to the changed ones.\n2. **Flag any new function that duplicates existing functionality.** Suggest the existing function to use instead.\n3. **Flag any inline logic that could use an existing utility** — hand-rolled string manipulation, manual path handling, custom environment checks, ad-hoc type guards, and similar patterns are common candidates.\n\nDo NOT suggest fixes for things that are working correctly. Only flag real reuse opportunities. Cite file paths and function names."
    },
    {
      agent: "code-reviewer",
      tier: "standard",
      task: "MODE: quality-review\n\n<diff>\n{DIFF}\n</diff>\n\nReview this diff for CODE QUALITY issues only. Look for:\n\n1. **Redundant state**: state that duplicates existing state, cached values that could be derived, observers/effects that could be direct calls\n2. **Parameter sprawl**: adding new parameters to a function instead of generalizing or restructuring existing ones\n3. **Copy-paste with slight variation**: near-duplicate code blocks that should be unified with a shared abstraction\n4. **Leaky abstractions**: exposing internal details that should be encapsulated, or breaking existing abstraction boundaries\n5. **Stringly-typed code**: using raw strings where constants, enums (string unions), or branded types already exist in the codebase\n6. **Unnecessary nesting**: wrapper elements that add no value — check if inner component props already provide the needed behavior\n\nDo NOT suggest fixes for things that are working correctly. Only flag real quality issues. Cite line numbers and patterns."
    },
    {
      agent: "code-reviewer",
      tier: "standard",
      task: "MODE: efficiency-review\n\n<diff>\n{DIFF}\n</diff>\n\nReview this diff for EFFICIENCY issues only. Look for:\n\n1. **Unnecessary work**: redundant computations, repeated file reads, duplicate network/API calls, N+1 patterns\n2. **Missed concurrency**: independent operations run sequentially when they could run in parallel\n3. **Hot-path bloat**: new blocking work added to startup or per-request/per-render hot paths\n4. **Recurring no-op updates**: state/store updates inside polling loops, intervals, or event handlers that fire unconditionally — add a change-detection guard so downstream consumers aren't notified when nothing changed. Also: if a wrapper function takes an updater/reducer callback, verify it honors same-reference returns (or whatever the \"no change\" signal is) — otherwise callers' early-return no-ops are silently defeated\n5. **Unnecessary existence checks**: pre-checking file/resource existence before operating (TOCTOU anti-pattern) — operate directly and handle the error\n6. **Memory**: unbounded data structures, missing cleanup, event listener leaks\n7. **Overly broad operations**: reading entire files when only a portion is needed, loading all items when filtering for one\n\nDo NOT suggest fixes for things that are working correctly. Only flag real efficiency issues."
    }
  ]
})
```

## Phase 3: Fix Issues

Wait for all three agents to complete. Aggregate their findings and fix each issue directly. If a finding is a false positive or not worth addressing, note it and move on — do not argue with the finding, just skip it.

When done, briefly summarize what was fixed (or confirm the code was already clean).

## Placeholders Reference

| Placeholder | Source |
|-------------|--------|
| `{DIFF}` | Output of `git diff` (or `git diff HEAD` for staged changes) |

## Integration with Other Skills

- **code-review**: Use `code-review` for comprehensive PR review with validation. Use `simplify` for quick post-implementation cleanup.
- **verification-before-completion**: Run `simplify` before claiming work is complete to catch reuse opportunities and inefficiencies.

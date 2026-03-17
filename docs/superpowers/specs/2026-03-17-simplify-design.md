# Simplify Skill Design

## Summary

Port the `/simplify` code review and cleanup skill into pi-superpowers, adapting it to use the subagent tool with the existing `code-reviewer` agent.

## Architecture

Single skill file (`skills/simplify/SKILL.md`) that orchestrates 3 parallel code-reviewer subagents, each with a focused review lens.

## Pipeline

```
Phase 1: Identify changes (orchestrator runs git diff)
Phase 2: Parallel review (3x code-reviewer at standard tier)
  ├── Reuse reviewer: find existing utilities that replace new code
  ├── Quality reviewer: flag hacky patterns and DRY violations
  └── Efficiency reviewer: unnecessary work, missed concurrency, memory
Phase 3: Fix issues (orchestrator aggregates and applies fixes)
```

## Design Decisions

- **Reuse `code-reviewer` agent** — no new agents needed; task prompts differentiate the review focus
- **Standard tier (sonnet)** — pattern-matching reviews don't need reasoning tier
- **No validation pipeline** — unlike code-review, simplify is post-implementation cleanup, not gated review
- **No supporting files** — review checklists embed in task prompts within SKILL.md
- **Orchestrator fixes directly** — after aggregating findings, skip false positives and fix remaining issues

## Differences from Claude Code Version

| Aspect | Claude Code | pi-superpowers |
|--------|------------|----------------|
| Dispatch | Agent tool (generic) | subagent tool (code-reviewer, standard tier) |
| Agent selection | Implicit | Explicit agent + tier |
| Review checklists | Inline in skill | Inline in subagent task prompts |
| Fix phase | Identical | Identical |

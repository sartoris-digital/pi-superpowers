# OMC Skills Port Design

## Summary

Port 5 skills from oh-my-claudecode v4.8.2 into pi-superpowers, adapted for the Pi subagent architecture. Each skill gets a `skills/<name>/SKILL.md` and a `prompts/<name>.md` entry point.

## Skills

### 1. deep-interview
- Socratic Q&A with mathematical ambiguity scoring across weighted dimensions
- Challenge agent modes at round thresholds (Contrarian R4, Simplifier R6, Ontologist R8)
- Proceeds when ambiguity ≤ 20%; spec saved to `docs/superpowers/specs/`
- Hands off to `writing-plans` skill (not OMC execution pipeline)
- Uses `scout` (fast tier) for brownfield exploration

### 2. ai-slop-cleaner
- Regression-safe, deletion-first cleanup for AI-generated code
- Four ordered passes: dead code, duplicates, naming/errors, test reinforcement
- Supports `--review` mode (reviewer-only, no edits)
- Dispatches `code-reviewer` (standard tier) per pass

### 3. ultraqa
- Autonomous QA cycling: verify → diagnose → fix → repeat (max 5 cycles)
- Supports --tests, --build, --typecheck, --lint, custom goals
- Uses `bug-hunter` (reasoning tier) for diagnosis, `worker` (standard tier) for fixes
- Early exit on 3x same failure

### 4. learner
- Extract debugging insights from conversation into reusable skill files
- Strict quality gate: non-Googleable, codebase-specific, actionable, hard-won
- Saves to `.pi/skills/learned/`

### 5. deepsearch
- Structured codebase search via `scout` agent (fast tier)
- Three-phase: broad search, deep dive (follow imports), synthesize

## Prompts (entry points)

Each skill gets a corresponding `prompts/<name>.md`:
- `/deep-interview` → superpowers:deep-interview
- `/ai-slop-cleaner` → superpowers:ai-slop-cleaner
- `/ultraqa` → superpowers:ultraqa
- `/learner` → superpowers:learner
- `/deepsearch` → superpowers:deepsearch

## No new agents needed

All skills use existing agents: scout, code-reviewer, bug-hunter, worker.

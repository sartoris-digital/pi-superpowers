---
name: deep-interview
description: Socratic deep interview with mathematical ambiguity scoring before planning and execution
---

# Deep Interview

Socratic questioning with mathematical ambiguity scoring. Replaces vague ideas with crystal-clear specifications by asking targeted questions that expose hidden assumptions, measuring clarity across weighted dimensions, and refusing to proceed until ambiguity drops below 20%.

## When to Use

- User has a vague idea and wants thorough requirements gathering
- User says "interview me", "ask me everything", "don't assume"
- Task is complex enough that jumping to code would waste cycles on scope discovery
- User wants validated clarity before committing to execution

## When NOT to Use

- User has a detailed, specific request with file paths and acceptance criteria
- User wants to explore options (use `brainstorming` instead)
- User wants a quick fix (delegate directly)
- User says "just do it" or "skip the questions"

## Phase 1: Initialize

1. **Parse the user's idea** from arguments
2. **Detect brownfield vs greenfield:**
   - Dispatch `scout` (fast tier) to check if cwd has existing source code

```
subagent({
  agent: "scout",
  tier: "fast",
  task: "Check if the current directory is a brownfield project (existing source code, package files, git history) or greenfield (empty/new). Report: project type, key technologies found, relevant file structure."
})
```

3. **For brownfield**: Dispatch `scout` again to map relevant codebase areas
4. **Announce the interview:**

> Starting deep interview. I'll ask targeted questions one at a time to understand your idea thoroughly. After each answer, I'll show your clarity score. We proceed when ambiguity drops below 20%.
>
> **Your idea:** "{idea}"
> **Project type:** {greenfield|brownfield}
> **Current ambiguity:** 100%

## Phase 2: Interview Loop

Repeat until ambiguity ≤ 0.2, user exits early, or round 20 hard cap.

### Step 2a: Generate Question

Target the dimension with the LOWEST clarity score. Questions should expose ASSUMPTIONS, not gather feature lists.

| Dimension | Question Style | Example |
|-----------|---------------|---------|
| Goal Clarity | "What exactly happens when...?" | "When you say 'manage tasks', what specific action does a user take first?" |
| Constraint Clarity | "What are the boundaries?" | "Should this work offline, or is internet assumed?" |
| Success Criteria | "How do we know it works?" | "If I showed you the finished product, what would make you say 'yes, that's it'?" |
| Context Clarity (brownfield) | "How does this fit?" | "The existing auth uses JWT. Should we extend that or add a separate flow?" |

### Step 2b: Ask the Question

Present one question at a time with context:

```
Round {N} | Targeting: {weakest_dimension} | Ambiguity: {score}%

{question}
```

### Step 2c: Score Ambiguity

After receiving the answer, score clarity across all dimensions (0.0 to 1.0 each):

1. **Goal Clarity** — Is the primary objective unambiguous?
2. **Constraint Clarity** — Are boundaries, limitations, and non-goals clear?
3. **Success Criteria Clarity** — Could you write a test that verifies success?
4. **Context Clarity** (brownfield only) — Do we understand the existing system?

For each dimension: score (0.0-1.0), justification (one sentence), gap (what's still unclear).

**Calculate ambiguity:**
- Greenfield: `ambiguity = 1 - (goal × 0.40 + constraints × 0.30 + criteria × 0.30)`
- Brownfield: `ambiguity = 1 - (goal × 0.35 + constraints × 0.25 + criteria × 0.25 + context × 0.15)`

### Step 2d: Report Progress

```
Round {N} complete.

| Dimension | Score | Weight | Weighted | Gap |
|-----------|-------|--------|----------|-----|
| Goal | {s} | {w} | {s×w} | {gap or "Clear"} |
| Constraints | {s} | {w} | {s×w} | {gap or "Clear"} |
| Success Criteria | {s} | {w} | {s×w} | {gap or "Clear"} |
| Context (brownfield) | {s} | {w} | {s×w} | {gap or "Clear"} |
| **Ambiguity** | | | **{score}%** | |
```

### Step 2e: Soft Limits

- **Round 3+**: Allow early exit if user says "enough", "let's go", "build it"
- **Round 10**: Soft warning — offer to continue or proceed
- **Round 20**: Hard cap — proceed with current clarity

## Phase 3: Challenge Agents

At specific round thresholds, shift the questioning perspective (each used once):

| Mode | Activates | Purpose | Approach |
|------|-----------|---------|----------|
| Contrarian | Round 4+ | Challenge assumptions | "What if the opposite were true?" |
| Simplifier | Round 6+ | Remove complexity | "What's the simplest version that's still valuable?" |
| Ontologist | Round 8+ (if ambiguity > 30%) | Find essence | "What IS this, really?" |

## Phase 4: Crystallize Spec

When ambiguity ≤ 20% (or hard cap / early exit):

Write the specification to `docs/superpowers/specs/deep-interview-{slug}.md`:

```markdown
# Deep Interview Spec: {title}

## Metadata
- Rounds: {count}
- Final Ambiguity: {score}%
- Type: greenfield | brownfield

## Goal
{crystal-clear goal statement}

## Constraints
- {constraint 1}
- {constraint 2}

## Non-Goals
- {explicitly excluded scope}

## Acceptance Criteria
- [ ] {testable criterion 1}
- [ ] {testable criterion 2}

## Assumptions Exposed & Resolved
| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| {assumption} | {how questioned} | {decision} |

## Technical Context
{brownfield: codebase findings | greenfield: technology choices}

## Interview Transcript
<details>
<summary>Full Q&A ({N} rounds)</summary>

### Round 1
**Q:** {question}
**A:** {answer}
**Ambiguity:** {score}%
</details>
```

## Phase 5: Hand Off

After the spec is written, present the spec path and hand off to the `writing-plans` skill to create a detailed implementation plan.

> Spec written to `docs/superpowers/specs/deep-interview-{slug}.md` with {score}% ambiguity. Invoking writing-plans to create an implementation plan.

## Key Rules

- **ONE question at a time** — never batch multiple questions
- **Explore before asking** — use scout to gather codebase facts, don't ask the user what the code reveals
- **Target the weakest dimension** — every question should improve the lowest-scoring area
- **Show your work** — display ambiguity scores after every round
- **Respect early exit** — if user wants to proceed, warn about risk but comply

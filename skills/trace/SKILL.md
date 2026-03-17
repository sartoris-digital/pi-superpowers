---
name: trace
description: Evidence-driven causal tracing — competing hypotheses, disconfirmation, discriminating probe
agent: tracer
---

# Trace

Use this skill for ambiguous, causal, evidence-heavy questions where the goal is to explain **why** an observed result happened, not to jump directly into fixing.

## When to Use

- Runtime bugs and regressions
- Performance / latency / resource behavior
- Architecture / premortem / postmortem analysis
- "Given this output, trace back the likely causes"
- Config / routing / orchestration behavior explanation
- Any question that benefits from competing explanations explored in parallel

## Core Tracing Contract

Always preserve these distinctions:

1. **Observation** — what was actually observed
2. **Hypotheses** — competing explanations
3. **Evidence For** — what supports each explanation
4. **Evidence Against / Gaps** — what contradicts it or is still missing
5. **Current Best Explanation** — the leading explanation right now
6. **Critical Unknown** — the missing fact keeping explanations apart
7. **Discriminating Probe** — the highest-value next step to collapse uncertainty

Do NOT collapse into a generic fix-it loop or fake certainty when evidence is incomplete.

## Execution

### Step 1: Frame the Observation

Restate what was observed precisely. Define the tracing target.

### Step 2: Generate 3 Competing Hypotheses

Use these default lanes unless the problem strongly suggests a better partition:

1. **Code-path / implementation cause** — a bug in the code itself
2. **Config / environment / orchestration cause** — the code is correct but context is wrong
3. **Measurement / artifact / assumption mismatch** — the observation itself may be misleading

### Step 3: Dispatch Parallel Tracer Agents

```
subagent({
  tasks: [
    {
      agent: "tracer",
      tier: "standard",
      task: "Investigate hypothesis: [code-path cause]\nObservation: {observation}\nGather evidence FOR and AGAINST this hypothesis. Cite file:line or command output for every claim."
    },
    {
      agent: "tracer",
      tier: "standard",
      task: "Investigate hypothesis: [config/environment cause]\nObservation: {observation}\nGather evidence FOR and AGAINST this hypothesis. Cite file:line or command output for every claim."
    },
    {
      agent: "tracer",
      tier: "standard",
      task: "Investigate hypothesis: [measurement/assumption mismatch]\nObservation: {observation}\nGather evidence FOR and AGAINST this hypothesis. Cite file:line or command output for every claim."
    }
  ]
})
```

### Step 4: Apply Cross-Check Lenses

After the initial evidence pass, pressure-test the leaders:

- **Systems lens** — queues, retries, feedback loops, upstream/downstream dependencies
- **Premortem lens** — assume the current best explanation is incomplete; what failure mode would embarrass this trace?
- **Science lens** — controls, confounders, measurement bias, alternative variables

### Step 5: Rebuttal Round

Let the strongest non-leading hypothesis present its best rebuttal to the leader. Force the leader to answer with evidence, not assertion.

### Step 6: Synthesize

Merge findings into a ranked explanation table. Explicitly down-rank hypotheses and explain why.

## Evidence Strength Hierarchy

1. Controlled reproductions / direct experiments
2. Primary source artifacts (logs, traces, metrics, git history, file:line)
3. Multiple independent sources converging
4. Single-source code-path inference
5. Weak circumstantial clues (timing, naming)
6. Intuition / speculation

Explicitly down-rank hypotheses that depend mostly on lower tiers.

## Output Format

```markdown
### Observed Result
[What happened]

### Ranked Hypotheses
| Rank | Hypothesis | Confidence | Evidence Strength | Why it leads |
|------|-----------|-----------|------------------|-------------|

### Evidence Against / Missing Evidence
[For each hypothesis]

### Rebuttal Round
- Best rebuttal to leader: ...
- Why leader held/failed: ...

### Most Likely Explanation
[Current best explanation]

### Critical Unknown
[Single missing fact]

### Recommended Discriminating Probe
[Single highest-value next step]
```

## Down-Ranking Guidance

Explicitly say why a hypothesis moved down:

- Contradicted by stronger evidence
- Requires extra unverified assumptions
- Explains fewer facts than the leader
- Lost the rebuttal round
- Converged into a stronger parent explanation

## Key Rules

- Evidence-backed — no fake certainty when evidence is incomplete
- Explicit about missing evidence and what we couldn't determine
- Practical about the next action — the probe should be achievable
- Explain why weaker explanations were down-ranked, not just what the answer is

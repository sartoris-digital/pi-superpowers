---
name: verification-before-completion
description: Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output before making any success claims; evidence before assertions always
---

# Verification Before Completion

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command in this message, you cannot claim it passes.

**Violating the letter of this rule is violating the spirit of this rule.**

## Verification Tiers

Select the appropriate verification tier based on change scope:

### Light Verification
**When:** <5 files changed, <100 lines, tests exist and cover the changes

Dispatch architect at fast tier:
```
subagent({
  agent: "architect",
  task: "MODE: verification\n\nClaimed: [what is being claimed]\n\nVerify:\n1. Run build/typecheck\n2. Confirm diagnostics clean\n3. Spot-check changed files match claimed scope",
  tier: "fast"
})
```

**Evidence required:** Build passes + diagnostics clean.

### Standard Verification (Default)
**When:** Default for all tasks not matching light or thorough criteria

Dispatch architect at standard tier:
```
subagent({
  agent: "architect",
  task: "MODE: verification\n\nClaimed: [what is being claimed]\n\nVerify:\n1. Run full test suite\n2. Check all changed files match task scope\n3. Confirm no regressions\n4. Verify claimed features work",
  tier: "standard"
})
```

**Evidence required:** Build passes + full test suite passes + changes match scope.

### Thorough Verification
**When:** >20 files changed, security-sensitive changes, architectural changes, or file patterns match `**/auth/**`, `**/security/**`, `**/crypto/**`

Dispatch architect at reasoning tier:
```
subagent({
  agent: "architect",
  task: "MODE: verification\n\nClaimed: [what is being claimed]\n\nVerify:\n1. Run full test suite\n2. Review all changed files in detail\n3. Check for security implications\n4. Verify architectural consistency\n5. Confirm no regressions across the full codebase",
  tier: "reasoning"
})
```

**Evidence required:** Full architect review + all tests pass + security check.

## Automatic Tier Selection Hints

| File Pattern | Suggested Tier |
|-------------|---------------|
| `**/auth/**`, `**/security/**`, `**/crypto/**` | Thorough |
| `**/test/**` only | Light |
| `*.md` only | Light |
| `**/api/**`, `**/routes/**` | Standard or Thorough |
| >20 files | Thorough |
| <5 files, <100 lines | Light |
| Everything else | Standard |

## The Gate Function

```
BEFORE claiming any status or expressing satisfaction:

1. IDENTIFY: What command proves this claim?
2. SELECT TIER: Light / Standard / Thorough based on change scope
3. DISPATCH: Architect verification at selected tier
4. READ: Full verification output
5. VERIFY: Does output confirm the claim?
   - If NO: State actual status with evidence
   - If YES: State claim WITH evidence
6. ONLY THEN: Make the claim

Skip any step = lying, not verifying
```

## Common Failures

| Claim | Requires | Not Sufficient |
|-------|----------|----------------|
| Tests pass | Test command output: 0 failures | Previous run, "should pass" |
| Build succeeds | Build command: exit 0 | Linter passing, logs look good |
| Bug fixed | Test original symptom: passes | Code changed, assumed fixed |
| Requirements met | Line-by-line checklist | Tests passing |
| Agent completed | VCS diff shows changes | Agent reports "success" |

## Red Flags - STOP

- Using "should", "probably", "seems to"
- Expressing satisfaction before verification ("Great!", "Perfect!", "Done!")
- About to commit/push/PR without verification
- Trusting agent success reports without independent verification
- Relying on partial verification
- **ANY wording implying success without having run verification**

## Rationalization Prevention

| Excuse | Reality |
|--------|---------|
| "Should work now" | RUN the verification |
| "I'm confident" | Confidence ≠ evidence |
| "Just this once" | No exceptions |
| "Agent said success" | Verify independently |
| "Partial check is enough" | Partial proves nothing |

## The Bottom Line

**No shortcuts for verification.**

Run the command. Read the output. Dispatch the architect. THEN claim the result.

This is non-negotiable.

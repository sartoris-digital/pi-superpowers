---
name: security-review
description: Use when performing a security-focused review of code changes to identify exploitable vulnerabilities
---

# Security Review

Perform a multi-agent security audit of code changes to identify exploitable vulnerabilities with high confidence and minimal false positives.

**Core principle:** High signal only — better to miss theoretical issues than flood the report with false positives.

## When to Use

- Before merging security-sensitive changes
- When `/security-review` prompt is invoked
- As an additional step in the code-review pipeline for security-critical projects
- After implementing authentication, authorization, or data handling features

## Pipeline Overview

```
Step 1: Context gathering (scout/haiku) → tech stack, changed files, security patterns
Step 2: Security audit (security-reviewer/opus) → 3-phase analysis, JSON findings
Step 3: Hard filter (orchestrator) → exclude known false-positive categories
Step 4: Validate findings (issue-validator/opus × N) → independently verify each finding
Step 5: Report → structured output with severity and confidence
```

## Step-by-Step Instructions

### Step 1: Context Gathering

Dispatch `scout` agent (haiku) to gather context:

```
subagent({
  agent: "scout",
  task: "Security review context gathering. Investigate:\n\n1. `git diff --stat {BASE_SHA}..{HEAD_SHA}` — what files changed\n2. `git log --oneline {BASE_SHA}..{HEAD_SHA}` — commit messages for intent\n3. Look for security-related files: auth modules, middleware, input validators, crypto usage\n4. Check for `.pi/security-instructions.txt` and `.pi/security-exclusions.txt`\n5. Identify the tech stack and frameworks in use\n\nReturn:\n- Changed files list with line counts\n- Tech stack summary\n- Security-relevant patterns found in codebase\n- Custom instructions/exclusions if found"
})
```

### Step 2: Security Audit

Dispatch `security-reviewer` agent (opus) with the full prompt from `security-prompt.md`:

```
subagent({
  agent: "security-reviewer",
  task: "[filled security-prompt.md template with context from Step 1]"
})
```

The security-reviewer will:
1. Research repository context using file exploration tools
2. Compare changes against existing security patterns
3. Assess vulnerabilities and return structured JSON

### Step 3: Hard Filter

Apply the exclusion rules from `exclusions.md` to the findings JSON. This is done by the orchestrating agent (you) — no subagent needed.

For each finding in the `findings` array:
1. Check description/category against exclusion patterns
2. Check file extension (drop `.md` files)
3. Check confidence threshold (drop < 0.7)
4. Check severity threshold (drop "LOW" unless comprehensive mode)
5. Check for project custom exclusions in `.pi/security-exclusions.txt`

Remove excluded findings and note what was filtered.

### Step 4: Validate Findings

For each remaining finding, dispatch an `issue-validator` subagent in parallel.

Use the template from the code-review skill's `issue-validator-prompt.md`, adapted for security:

```
subagent({
  tasks: [
    {
      agent: "issue-validator",
      task: "Validate this SECURITY finding.\n\nPR Title: {PR_TITLE}\nPR Description: {PR_DESCRIPTION}\n\nFlagged Issue:\n- File: {FILE}\n- Line: {LINE}\n- Severity: {SEVERITY}\n- Category: {CATEGORY}\n- Description: {DESCRIPTION}\n- Exploit scenario: {EXPLOIT_SCENARIO}\n- Confidence: {CONFIDENCE}\n\nYour job: Verify this security vulnerability is real and exploitable. Read the actual code, trace the data flow, check if sanitization exists elsewhere. Verify the exploit scenario is feasible.\n\nReturn JSON: { validated: true/false, confidence: 'high'/'medium'/'low', reasoning: '...', evidence: '...' }"
    },
    ...
  ]
})
```

**If more than 8 findings:** Batch into groups of 8 and run sequentially.

### Step 5: Report

Output a structured report:

**If findings were found:**

```
## Security Review Results

**Reviewed:** {FILE_COUNT} files, {LINE_COUNT} lines changed
**Findings:** {FINDING_COUNT} validated security issues

### HIGH Severity
1. **`file.ts:42`** — [category] Description (confidence: 0.95)
   Exploit: ...
   Recommendation: ...

### MEDIUM Severity
1. **`file.ts:100`** — [category] Description (confidence: 0.82)
   Exploit: ...
   Recommendation: ...

### Filtering Summary
- Original findings: N
- Excluded by hard rules: N
- Excluded by validation: N
- Final validated findings: N

### Summary
[1-2 sentence overall security assessment]
```

**If no findings were found:**

```
## Security Review Results

No security vulnerabilities found.

**Reviewed:** {FILE_COUNT} files, {LINE_COUNT} lines changed
**Categories checked:** Input validation, auth/authz, crypto, injection, data exposure
**Filtering:** N original findings → all excluded (false positives)
```

## Model Configuration

Follows the same tier system as code-review. See `skills/code-review/model-config.md`.

| Tier | Agent | Default Model |
|------|-------|---------------|
| fast | scout | claude-haiku-4-5 |
| reasoning | security-reviewer | claude-opus-4-6 |
| reasoning | issue-validator | claude-opus-4-6 |

Override via project agent files in `.pi/agents/` or `.pi/code-review.json`.

## Integration with Code Review

The security review can run standalone or as part of the code-review pipeline.

**Standalone:** Invoke via `/security-review` or the `superpowers:security-review` skill.

**Integrated with code-review:** Add `security-reviewer` to Step 4 of the code-review pipeline:

```
subagent({
  tasks: [
    // existing code-review agents...
    { agent: "security-reviewer", task: "[security audit prompt]" }
  ]
})
```

This runs the security audit in parallel with compliance and bug hunting. Security findings go through the same validation pipeline (Step 5) as other issues.

## Project Customization

### Custom Security Instructions
Create `.pi/security-instructions.txt` with additional security categories or focus areas specific to your project. These are appended to the audit prompt.

### Custom Exclusions
Create `.pi/security-exclusions.txt` with one pattern per line to exclude from findings. These are applied during the hard filter step.

## Red Flags

**Never:**
- Skip the validation step — false positives erode trust
- Report findings below 0.7 confidence
- Flag pre-existing issues not introduced by this change
- Include DOS, rate limiting, or resource exhaustion findings
- Report issues in documentation files

**Always:**
- Include exploit scenarios for each finding
- Provide actionable recommendations
- Show what was filtered (transparency builds trust)

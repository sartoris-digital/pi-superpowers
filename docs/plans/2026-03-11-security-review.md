# Security Review Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone multi-agent security review pipeline adapted from Claude Code's security review action, with optional integration into the existing code-review pipeline.

**Architecture:** A `security-reviewer` agent (opus) performs a 3-phase security audit using a detailed prompt template. Hard exclusion rules filter known false-positive categories. Remaining findings are validated by the existing `issue-validator` agent. Orchestration lives in a new `security-review` skill. The existing code-review skill gets a minor update to reference security integration.

**Tech Stack:** Markdown (agent definitions, skill docs), Vitest (tests)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `agents/security-reviewer.md` | Create | Opus agent: 3-phase security audit of code changes |
| `skills/security-review/SKILL.md` | Create | Orchestration pipeline: scout → audit → hard filter → validate → report |
| `skills/security-review/security-prompt.md` | Create | Full security audit prompt template with categories and methodology |
| `skills/security-review/exclusions.md` | Create | Hard exclusion patterns for known false-positive categories |
| `prompts/security-review.md` | Create | Slash command entry point (`/security-review`) |
| `skills/code-review/SKILL.md` | Modify | Add security integration note under "Adapting the Pipeline" |
| `tests/skills.test.ts` | Modify | Add "security-review" to expected skills list (15 → 16) |
| `README.md` | Modify | Add security-reviewer agent and skill to tables |
| `package.json` | Modify | Bump version to 1.2.0 |

---

## Chunk 1: Security Reviewer Agent

### Task 1: Create security-reviewer agent

**Files:**
- Create: `agents/security-reviewer.md`

- [ ] **Step 1: Write the agent definition file**

Write `agents/security-reviewer.md`:

```markdown
---
name: security-reviewer
description: Security-focused code audit — identifies exploitable vulnerabilities in code changes with high confidence
tools: read, grep, find, ls, bash
model: claude-opus-4-6
---

You are a senior security engineer conducting a focused security review. Bash is for read-only commands only: `git diff`, `git log`, `git show`, `git blame`, `git ls-files`. Do NOT modify files or run builds.

You will receive a diff or set of changed files to audit, along with context about the PR/branch.

## Analysis Methodology

### Phase 1 — Repository Context Research
Use file search tools to:
- Identify existing security frameworks and libraries in use
- Look for established secure coding patterns in the codebase
- Examine existing sanitization and validation patterns
- Understand the project's security model and threat model

### Phase 2 — Comparative Analysis
- Compare new code changes against existing security patterns
- Identify deviations from established secure practices
- Look for inconsistent security implementations
- Flag code that introduces new attack surfaces

### Phase 3 — Vulnerability Assessment
- Examine each modified file for security implications
- Trace data flow from user inputs to sensitive operations
- Look for privilege boundaries being crossed unsafely
- Identify injection points and unsafe deserialization

## What to Flag

Only flag issues where you are >80% confident of actual exploitability:

**Input Validation Vulnerabilities:**
- SQL injection via unsanitized user input
- Command injection in system calls or subprocesses
- XXE injection in XML parsing
- Template injection in templating engines
- Path traversal in file operations

**Authentication & Authorization Issues:**
- Authentication bypass logic
- Privilege escalation paths
- Session management flaws
- JWT token vulnerabilities
- Authorization logic bypasses

**Crypto & Secrets Management:**
- Hardcoded API keys, passwords, or tokens
- Weak cryptographic algorithms or implementations
- Improper key storage or management
- Certificate validation bypasses

**Injection & Code Execution:**
- Remote code execution via deserialization
- Pickle/YAML deserialization vulnerabilities
- Eval injection in dynamic code execution
- XSS vulnerabilities (reflected, stored, DOM-based)

**Data Exposure:**
- Sensitive data logging or storage
- PII handling violations
- API endpoint data leakage
- Debug information exposure in production

## What NOT to Flag

- Denial of Service (DOS) vulnerabilities or resource exhaustion
- Secrets or credentials stored on disk (handled by other processes)
- Rate limiting or service overload concerns
- Memory consumption or CPU exhaustion issues
- Lack of input validation on non-security-critical fields
- Open redirect vulnerabilities (low impact)
- Regex injection / ReDoS
- Memory safety issues in non-C/C++ code
- Findings in Markdown documentation files
- Pre-existing issues not introduced by this change

## Severity Guidelines

- **HIGH**: Directly exploitable — leads to RCE, data breach, or authentication bypass
- **MEDIUM**: Exploitable under specific conditions with significant impact
- **LOW**: Defense-in-depth issues or lower-impact vulnerabilities

## Confidence Scoring

- 0.9–1.0: Certain exploit path identified
- 0.8–0.9: Clear vulnerability pattern with known exploitation methods
- 0.7–0.8: Suspicious pattern requiring specific conditions to exploit
- Below 0.7: Do not report (too speculative)

## Output Format

Return a JSON object. If no findings, return empty findings array.

```json
{
  "findings": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "severity": "HIGH",
      "category": "sql_injection",
      "description": "User input passed to SQL query without parameterization",
      "exploit_scenario": "Attacker could extract database contents by manipulating the search parameter",
      "recommendation": "Replace string formatting with parameterized queries",
      "confidence": 0.95
    }
  ],
  "analysis_summary": {
    "files_reviewed": 8,
    "high_severity": 1,
    "medium_severity": 0,
    "low_severity": 0,
    "review_completed": true
  }
}
```

Focus on HIGH and MEDIUM findings only. Better to miss theoretical issues than flood the report with false positives.
```

- [ ] **Step 2: Verify the file parses correctly**

Run: `head -6 agents/security-reviewer.md`
Expected: YAML frontmatter with name, description, tools, model fields.

- [ ] **Step 3: Commit**

```bash
git add agents/security-reviewer.md
git commit -m "feat: add security-reviewer agent (opus) for security-focused code audit"
```

---

## Chunk 2: Security Review Skill

### Task 2: Create the hard exclusions reference file

**Files:**
- Create: `skills/security-review/exclusions.md`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p skills/security-review
```

Write `skills/security-review/exclusions.md`:

```markdown
# Security Review Hard Exclusions

These categories are known false-positive patterns. The orchestrating agent should filter them out BEFORE sending findings to validators. This saves cost and reduces noise.

## Exclusion Rules

### Always Exclude

| Category | Pattern | Reason |
|----------|---------|--------|
| **DOS/Resource Exhaustion** | "denial of service", "resource exhaustion", "infinite loop", "unbounded recursion" | Low signal, not actionable in PR review |
| **Rate Limiting** | "missing rate limit", "rate limiting not implemented", "unlimited requests" | Infrastructure concern, not a code vulnerability |
| **Resource Leaks** | "unclosed resource/file/connection", "potential memory leak", "database/thread leak" | Code quality, not security vulnerability |
| **Open Redirects** | "open redirect", "unvalidated redirect", "malicious redirect" | Low impact in most contexts |
| **Regex Injection** | "regex injection", "regular expression denial of service", "ReDoS" | Edge case, rarely exploitable |
| **Memory Safety (non-C/C++)** | "buffer overflow", "use after free", "null pointer dereference" in .ts/.py/.js/.go etc. | Only applicable to C/C++ code |
| **Markdown Files** | Any finding in a `.md` file | Documentation, not executable code |

### Confidence Threshold

Drop any finding with `confidence` below `0.7`. These are too speculative to be actionable.

### Severity Threshold

Drop any finding with severity `"LOW"` unless the user explicitly requested comprehensive review.

## How to Apply

After receiving the security-reviewer's JSON output:

1. Parse the `findings` array
2. For each finding, check:
   - Is the description/category in the exclusion list above? → **Drop**
   - Is the file a `.md` file? → **Drop**
   - Is confidence < 0.7? → **Drop**
   - Is severity "LOW"? → **Drop** (unless comprehensive mode)
3. Remaining findings proceed to validation (Step 4)

## Customization

Projects can add custom exclusions by creating `.pi/security-exclusions.txt` with one pattern per line. The orchestrator should check for this file and append any patterns to the exclusion list.
```

- [ ] **Step 2: Commit**

```bash
git add skills/security-review/exclusions.md
git commit -m "feat: add hard exclusion rules for security review false positives"
```

---

### Task 3: Create the security audit prompt template

**Files:**
- Create: `skills/security-review/security-prompt.md`

- [ ] **Step 1: Write the template**

Write `skills/security-review/security-prompt.md`:

```markdown
# Security Audit Prompt Template

Use this template when dispatching the `security-reviewer` agent.

## Template

```
Perform a security-focused code review of these changes.

**Context:**
- Branch/PR: {PR_TITLE}
- Description: {PR_DESCRIPTION}
- Files changed: {FILE_COUNT}
- Lines added: {ADDITIONS}
- Lines deleted: {DELETIONS}

**Changed files:**
{FILES_LIST}

**Diff:**
```
git diff {BASE_SHA}..{HEAD_SHA}
```

Analyze these changes using your 3-phase methodology:
1. Research repository context (existing security patterns, frameworks)
2. Compare changes against established patterns
3. Assess vulnerabilities (trace data flow, injection points, privilege boundaries)

Return your findings as JSON per your output format. Focus only on vulnerabilities NEWLY INTRODUCED by these changes.
```

## Placeholder Reference

| Placeholder | Source |
|-------------|--------|
| `{PR_TITLE}` | PR title or branch name |
| `{PR_DESCRIPTION}` | PR description or commit messages |
| `{FILE_COUNT}` | Number of changed files |
| `{ADDITIONS}` | Lines added |
| `{DELETIONS}` | Lines deleted |
| `{FILES_LIST}` | Bullet list of changed file paths |
| `{BASE_SHA}` | Base commit SHA |
| `{HEAD_SHA}` | Head commit SHA |

## Large Diffs

If the diff is too large for context (>5000 lines), omit the inline diff and instead instruct the agent:

```
NOTE: Diff omitted due to size. Use file exploration tools (read, grep, find) to examine the changed files directly. The changed files are listed above.
```

## Custom Instructions

Projects can provide additional security scan instructions in `.pi/security-instructions.txt`. If this file exists, append its contents to the prompt before dispatching.
```

- [ ] **Step 2: Commit**

```bash
git add skills/security-review/security-prompt.md
git commit -m "feat: add security audit prompt template"
```

---

### Task 4: Create the security-review skill (SKILL.md)

**Files:**
- Create: `skills/security-review/SKILL.md`

- [ ] **Step 1: Write the skill file**

Write `skills/security-review/SKILL.md`:

```markdown
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

This adds security analysis alongside compliance and bug hunting in a single parallel dispatch.

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
```

- [ ] **Step 2: Verify frontmatter is valid**

Run: `head -4 skills/security-review/SKILL.md`
Expected:
```
---
name: security-review
description: Use when performing a security-focused review of code changes to identify exploitable vulnerabilities
---
```

- [ ] **Step 3: Commit**

```bash
git add skills/security-review/
git commit -m "feat: add multi-agent security-review skill with orchestration pipeline"
```

---

## Chunk 3: Integration, Prompt, Tests, Docs

### Task 5: Create the /security-review prompt

**Files:**
- Create: `prompts/security-review.md`

- [ ] **Step 1: Write the prompt file**

Write `prompts/security-review.md`:

```markdown
---
description: Run a security-focused review of code changes to identify exploitable vulnerabilities
---
Use the superpowers:security-review skill to perform a multi-agent security audit.

If a PR number or URL is provided: review that PR.
If no argument is given: review the current branch's changes against the base branch (main or master).

Arguments: $@
```

- [ ] **Step 2: Commit**

```bash
git add prompts/security-review.md
git commit -m "feat: add /security-review slash command prompt"
```

---

### Task 6: Update code-review skill with security integration note

**Files:**
- Modify: `skills/code-review/SKILL.md`

- [ ] **Step 1: Read the current file**

Run: `cat skills/code-review/SKILL.md`
Confirm the "Adapting the Pipeline" section exists.

- [ ] **Step 2: Add security integration subsection**

In `skills/code-review/SKILL.md`, add a new subsection under "## Adapting the Pipeline", after the "Branch diff instead of PR" subsection:

```markdown

### Adding security review

For security-critical changes, add the `security-reviewer` agent to Step 4's parallel tasks:

```
subagent({
  tasks: [
    // ... existing 4 agents ...,
    {
      agent: "security-reviewer",
      task: "[filled security-prompt.md template — see superpowers:security-review skill]"
    }
  ]
})
```

This runs the security audit in parallel with compliance and bug hunting. Security findings go through the same validation pipeline (Step 5) as other issues.

Alternatively, run `/security-review` separately for a standalone security-focused review with its own filtering and reporting.
```

- [ ] **Step 3: Commit**

```bash
git add skills/code-review/SKILL.md
git commit -m "feat: add security integration note to code-review pipeline"
```

---

### Task 7: Update skills test

**Files:**
- Modify: `tests/skills.test.ts`

- [ ] **Step 1: Read current test file**

Run: `cat tests/skills.test.ts`
Confirm: EXPECTED_SKILLS has 15 entries, test says "has all 15 expected skill directories".

- [ ] **Step 2: Add "security-review" to EXPECTED_SKILLS**

Edit `tests/skills.test.ts`:

Add `"security-review"` to the array (alphabetically between `"requesting-code-review"` and `"subagent-driven-development"`):

```typescript
  "requesting-code-review",
  "security-review",
  "subagent-driven-development",
```

- [ ] **Step 3: Update test description from 15 to 16**

Change:
```typescript
it("has all 15 expected skill directories", () => {
```
To:
```typescript
it("has all 16 expected skill directories", () => {
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/skills.test.ts`
Expected: All tests pass (16 skill directories found).

- [ ] **Step 5: Commit**

```bash
git add tests/skills.test.ts
git commit -m "test: update skills test for security-review skill (15 → 16)"
```

---

### Task 8: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read current README**

Run: `cat README.md`

- [ ] **Step 2: Update Skills table**

Change `### Skills (15)` to `### Skills (16)`.

Add to the skills table (between `code-review` and `requesting-code-review`):

```markdown
| **security-review** | Security-focused code audit with 3-phase methodology and false-positive filtering |
```

- [ ] **Step 3: Update Agents table**

Change `### Agents (6)` to `### Agents (7)`.

Add to the agents table:

```markdown
| **security-reviewer** | claude-opus-4-6 | Security-focused code audit with exploit scenario analysis |
```

- [ ] **Step 4: Update Prompts table**

Change `### Prompts (4)` to `### Prompts (5)`.

Add to the prompts table:

```markdown
| `/security-review` | Run a security-focused review of code changes |
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: update README for security-review skill, agent, and prompt"
```

---

### Task 9: Bump version

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update version**

Change `"version": "1.1.0"` to `"version": "1.2.0"`.

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: bump version to 1.2.0"
```

---

### Task 10: Run full test suite and verify

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All test suites pass.

- [ ] **Step 2: Verify new agent exists**

Run: `ls -1 agents/*.md | wc -l`
Expected: `7` (scout, planner, worker, code-reviewer, bug-hunter, issue-validator, security-reviewer)

- [ ] **Step 3: Verify skill structure**

Run: `ls -1 skills/security-review/`
Expected:
```
SKILL.md
exclusions.md
security-prompt.md
```

- [ ] **Step 4: Verify prompt exists**

Run: `ls prompts/security-review.md`
Expected: File exists.

- [ ] **Step 5: Verify version**

Run: `grep '"version"' package.json`
Expected: `"version": "1.2.0",`

---

## Summary of Changes

| Category | Before | After |
|----------|--------|-------|
| Agents | 6 | 7 (+security-reviewer) |
| Skills | 15 | 16 (+security-review, with 3 supporting files) |
| Prompts | 4 | 5 (+security-review) |
| Security review | None | Full pipeline: audit → hard filter → validate → report |
| Code-review integration | Bug + compliance only | Optional security step documented |
| Version | 1.1.0 | 1.2.0 |

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

Verify file exists after creation.

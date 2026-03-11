# Issue Validator Dispatch Template

Use this template when dispatching `issue-validator` subagents in step 5 of the code review pipeline.

## Template

```
Validate this code review issue.

**PR Title:** {PR_TITLE}
**PR Description:** {PR_DESCRIPTION}

**Flagged Issue:**
- File: {ISSUE_FILE}
- Line: {ISSUE_LINE}
- Type: {ISSUE_TYPE}
- Description: {ISSUE_DESCRIPTION}
- Reason: {ISSUE_REASON}

**Your job:** Investigate the codebase to determine if this issue is truly a problem with high confidence. Read the actual file, check types, follow imports, verify the claim.

Refer to the false-positive exclusion list in `skills/code-review/false-positives.md` — if the issue matches any exclusion category, it should NOT be validated.

Return your verdict as JSON:
{
  "validated": true/false,
  "confidence": "high"/"medium"/"low",
  "reasoning": "...",
  "evidence": "..."
}
```

## Model Selection for Validators

| Issue Type | Model | Rationale |
|-----------|-------|-----------|
| bug, logic-error, security | opus | Complex reasoning needed |
| compliance | sonnet | Rule matching is straightforward |

## Dispatch Pattern

Use the subagent tool in parallel mode — one validator per issue:

```json
{
  "tasks": [
    { "agent": "issue-validator", "task": "[filled template for issue 1]" },
    { "agent": "issue-validator", "task": "[filled template for issue 2]" }
  ]
}
```

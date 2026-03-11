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

Verify file exists after creation.

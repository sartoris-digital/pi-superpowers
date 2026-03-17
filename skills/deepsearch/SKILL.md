---
name: deepsearch
description: Thorough codebase search using structured search strategy via scout agent
---

# Deep Search

Perform a thorough search of the codebase for the specified query, pattern, or concept.

## Execution

Dispatch a single `scout` agent at fast tier with the full search strategy:

```
subagent({
  agent: "scout",
  tier: "fast",
  task: "DEEP SEARCH: {QUERY}\n\nPerform a thorough codebase search using this 3-phase strategy:\n\n## Phase 1: Broad Search\n- Search for exact matches of the query\n- Search for related terms, synonyms, and variations\n- Check common locations: components, utils, services, hooks, lib, helpers\n- Search file names, function names, class names, and comments\n\n## Phase 2: Deep Dive\n- Read files with matches to understand context\n- Check imports/exports to find connections\n- Follow the trail: what imports this? What does this import?\n- Look for related configuration, tests, and documentation\n\n## Phase 3: Synthesize\n- Map out where the concept is used across the codebase\n- Identify the main implementation vs secondary references\n- Note related functionality and patterns\n\n## Output Format\n\n### Primary Locations\n(Main implementations with file:line references)\n\n### Related Files\n(Dependencies, consumers, tests)\n\n### Usage Patterns\n(How it's used across the codebase)\n\n### Key Insights\n(Patterns, conventions, gotchas discovered)\n\nBe comprehensive but concise. Always cite file paths and line numbers."
})
```

## Placeholders

| Placeholder | Source |
|-------------|--------|
| `{QUERY}` | The user's search query from arguments |

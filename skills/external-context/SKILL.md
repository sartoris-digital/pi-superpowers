---
name: external-context
description: Fetch external documentation and references — decompose query into facets, search in parallel
argument-hint: <search query or topic>
---

# External Context

Fetch external documentation, references, and context for a query. Decomposes into parallel facets and dispatches document-specialist agents to search each.

## When to Use

- Need documentation for a library, API, or framework
- Researching best practices for a technology decision
- Comparing options with up-to-date information
- Any question requiring current external knowledge

## Protocol

### Step 1: Facet Decomposition

Break the query into 2-5 independent search facets:

```markdown
## Search Decomposition

**Query:** {original query}

### Facet 1: {facet-name}
- Search focus: what to search for
- Best sources: official docs, GitHub, etc.

### Facet 2: {facet-name}
...
```

### Step 2: Parallel Document Specialist Dispatch

Fire independent facets simultaneously (max 5 parallel agents):

```
subagent({
  tasks: [
    {
      agent: "document-specialist",
      tier: "standard",
      task: "Search for: {facet 1 description}. Find official documentation and practical examples. Cite all sources with URLs."
    },
    {
      agent: "document-specialist",
      tier: "standard",
      task: "Search for: {facet 2 description}. Find official documentation and practical examples. Cite all sources with URLs."
    }
  ]
})
```

### Step 3: Synthesis

Present synthesized results:

```markdown
## External Context: {query}

### Key Findings
1. **{finding}** — Source: [title](url)
2. **{finding}** — Source: [title](url)

### Detailed Results

#### Facet 1: {name}
{aggregated findings with citations}

#### Facet 2: {name}
{aggregated findings with citations}

### Sources
- [Source 1](url)
- [Source 2](url)
```

## Rules

- Maximum 5 parallel document-specialist agents
- Every finding must be cited with a source URL
- Note when sources conflict or information is outdated
- If official docs aren't available, say so explicitly

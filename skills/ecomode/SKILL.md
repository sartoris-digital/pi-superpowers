---
name: ecomode
description: Token-efficient model routing modifier — shifts tier preferences down to save costs
---

# Ecomode

A modifier that shifts model tier routing to prefer cheaper models. Not a standalone execution strategy — it modifies how other modes and dispatches select models.

## What It Does

When active, ecomode shifts tiers down:
- `reasoning` → `standard`
- `standard` → `fast`
- `fast` → `fast` (no change)

This means:
- Bug-hunter (normally opus) runs on sonnet
- Worker (normally sonnet) runs on haiku
- Scout (normally haiku) stays on haiku

## Activation

Activate:
```
state write ecomode { "active": true }
```

Deactivate:
```
state clear ecomode
```

## How It Works

The model-router-utils module checks for ecomode state when resolving models. The subagent extension reads `.pi/state/ecomode.json` before each dispatch and passes `ecomodeActive: true` to `resolveModel()` if the state is active.

## When to Use

- Working on low-risk tasks where speed/cost matters more than quality
- Prototyping or exploratory work
- When token budget is limited
- Can combine with any execution strategy (sequential, parallel, autopilot, ralph)

## When NOT to Use

- Security-sensitive changes
- Complex architectural decisions
- Production bug fixes

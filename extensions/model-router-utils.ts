import * as fs from "node:fs";
import * as path from "node:path";

export interface RouterConfig {
  models: {
    fast: string;
    standard: string;
    reasoning: string;
  };
  routing: {
    enabled: boolean;
    defaultTier: string;
    agentTierOverrides: Record<string, string>;
  };
  persistence: {
    maxIterations: number;
    staleTimeout: number;
  };
  delegation: {
    audit: boolean;
    enforce: boolean;
  };
}

export const DEFAULT_CONFIG: RouterConfig = {
  models: {
    fast: "claude-haiku-4-5",
    standard: "claude-sonnet-4-6",
    reasoning: "claude-opus-4-6",
  },
  routing: {
    enabled: true,
    defaultTier: "standard",
    agentTierOverrides: {},
  },
  persistence: {
    maxIterations: 50,
    staleTimeout: 14400,
  },
  delegation: {
    audit: true,
    enforce: false,
  },
};

const FAST_KEYWORDS = /\b(find|list|check|count|search|look\s+up|locate|show)\b/i;
const REASONING_KEYWORDS =
  /\b(debug|security|architect|race\s+condition|refactor\s+architecture|vulnerability|exploit|why\s+does|why\s+is|root\s+cause)\b/i;

/**
 * Load router config with fallback chain:
 * .pi/superpowers.json -> .pi/code-review.json -> DEFAULT_CONFIG
 */
export function loadRouterConfig(projectDir?: string): RouterConfig {
  if (!projectDir) return DEFAULT_CONFIG;

  const superpowersPath = path.join(projectDir, ".pi", "superpowers.json");
  const codeReviewPath = path.join(projectDir, ".pi", "code-review.json");

  let rawConfig: Record<string, unknown> | undefined;

  if (fs.existsSync(superpowersPath)) {
    try {
      rawConfig = JSON.parse(fs.readFileSync(superpowersPath, "utf-8"));
    } catch {
      // malformed JSON, fall through
    }
  }

  if (!rawConfig && fs.existsSync(codeReviewPath)) {
    try {
      rawConfig = JSON.parse(fs.readFileSync(codeReviewPath, "utf-8"));
    } catch {
      // malformed JSON, fall through
    }
  }

  if (!rawConfig) return DEFAULT_CONFIG;

  return {
    models: {
      fast: (rawConfig.models as Record<string, string>)?.fast ?? DEFAULT_CONFIG.models.fast,
      standard: (rawConfig.models as Record<string, string>)?.standard ?? DEFAULT_CONFIG.models.standard,
      reasoning: (rawConfig.models as Record<string, string>)?.reasoning ?? DEFAULT_CONFIG.models.reasoning,
    },
    routing: {
      enabled: (rawConfig.routing as Record<string, unknown>)?.enabled !== false,
      defaultTier: ((rawConfig.routing as Record<string, string>)?.defaultTier as string) ?? DEFAULT_CONFIG.routing.defaultTier,
      agentTierOverrides: ((rawConfig.routing as Record<string, Record<string, string>>)?.agentTierOverrides as Record<string, string>) ?? {},
    },
    persistence: {
      maxIterations: ((rawConfig.persistence as Record<string, number>)?.maxIterations as number) ?? DEFAULT_CONFIG.persistence.maxIterations,
      staleTimeout: ((rawConfig.persistence as Record<string, number>)?.staleTimeout as number) ?? DEFAULT_CONFIG.persistence.staleTimeout,
    },
    delegation: {
      audit: (rawConfig.delegation as Record<string, boolean>)?.audit !== false,
      enforce: (rawConfig.delegation as Record<string, boolean>)?.enforce === true,
    },
  };
}

/**
 * Extract complexity tier from task prompt text using keyword signals.
 */
export function extractTierFromSignals(taskPrompt: string): "fast" | "standard" | "reasoning" {
  if (REASONING_KEYWORDS.test(taskPrompt)) return "reasoning";
  if (FAST_KEYWORDS.test(taskPrompt)) return "fast";
  return "standard";
}

/**
 * Resolve the model ID for a given agent dispatch.
 *
 * Priority:
 * 1. Project agent override (source === "project" with explicit model) -> use that
 * 2. Explicit tier parameter from subagent call -> use that (call-site intent wins)
 * 3. Config agentTierOverrides for this agent -> use that tier
 * 4. Agent's default tier from frontmatter -> use that
 * 5. Auto-extract tier from task prompt signals
 * 6. Fall back to config defaultTier
 *
 * After resolving tier, apply ecomode shift if active.
 * Finally, map tier to model via config.models.
 */
export function resolveModel(
  agentName: string,
  agent: { model?: string; tier?: string; source: string },
  config: RouterConfig,
  options?: {
    explicitTier?: string;
    taskPrompt?: string;
    ecomodeActive?: boolean;
  },
): string {
  // 1. Project agent override wins unconditionally
  if (agent.source === "project" && agent.model) {
    return agent.model;
  }

  if (!config.routing.enabled) {
    return agent.model ?? config.models[config.routing.defaultTier as keyof typeof config.models] ?? config.models.standard;
  }

  // 2. Resolve tier (call-site explicitTier wins over config agentTierOverrides)
  let tier: string;

  if (options?.explicitTier) {
    // Explicit tier from subagent call — call-site intent always wins
    tier = options.explicitTier;
  } else if (config.routing.agentTierOverrides[agentName]) {
    // Config override for this specific agent
    tier = config.routing.agentTierOverrides[agentName];
  } else if (agent.tier) {
    // Agent's default tier from frontmatter
    tier = agent.tier;
  } else if (options?.taskPrompt) {
    // Auto-extract from prompt signals
    tier = extractTierFromSignals(options.taskPrompt);
  } else {
    tier = config.routing.defaultTier;
  }

  // 3. Ecomode shift
  if (options?.ecomodeActive) {
    if (tier === "reasoning") tier = "standard";
    else if (tier === "standard") tier = "fast";
    // fast stays fast
  }

  // 4. Map tier to model
  const model = config.models[tier as keyof typeof config.models];
  return model ?? agent.model ?? config.models.standard;
}

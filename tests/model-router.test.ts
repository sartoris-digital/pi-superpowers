import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  loadRouterConfig,
  resolveModel,
  extractTierFromSignals,
  DEFAULT_CONFIG,
} from "../extensions/model-router-utils.js";
import type { AgentConfig } from "../extensions/agents.js";

function makeAgent(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    name: "worker",
    description: "Test agent",
    systemPrompt: "You are a test agent.",
    source: "bundled",
    filePath: "/test/worker.md",
    ...overrides,
  };
}

describe("loadRouterConfig", () => {
  it("returns default config when no files exist", () => {
    const config = loadRouterConfig("/nonexistent/path");
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("loads .pi/superpowers.json when it exists", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "router-"));
    const piDir = path.join(dir, ".pi");
    fs.mkdirSync(piDir, { recursive: true });
    fs.writeFileSync(
      path.join(piDir, "superpowers.json"),
      JSON.stringify({
        models: { fast: "gpt-4.1-mini", standard: "gpt-4.1", reasoning: "gpt-4.1" },
      }),
    );
    const config = loadRouterConfig(dir);
    expect(config.models.fast).toBe("gpt-4.1-mini");
    fs.rmSync(dir, { recursive: true });
  });

  it("falls back to .pi/code-review.json", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "router-fallback-"));
    const piDir = path.join(dir, ".pi");
    fs.mkdirSync(piDir, { recursive: true });
    fs.writeFileSync(
      path.join(piDir, "code-review.json"),
      JSON.stringify({
        models: { fast: "gemini-flash", standard: "gemini-pro", reasoning: "gemini-pro" },
      }),
    );
    const config = loadRouterConfig(dir);
    expect(config.models.fast).toBe("gemini-flash");
    fs.rmSync(dir, { recursive: true });
  });

  it("prefers superpowers.json over code-review.json", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "router-prefer-"));
    const piDir = path.join(dir, ".pi");
    fs.mkdirSync(piDir, { recursive: true });
    fs.writeFileSync(
      path.join(piDir, "superpowers.json"),
      JSON.stringify({ models: { fast: "super-fast", standard: "super-std", reasoning: "super-reason" } }),
    );
    fs.writeFileSync(
      path.join(piDir, "code-review.json"),
      JSON.stringify({ models: { fast: "cr-fast", standard: "cr-std", reasoning: "cr-reason" } }),
    );
    const config = loadRouterConfig(dir);
    expect(config.models.fast).toBe("super-fast");
    fs.rmSync(dir, { recursive: true });
  });
});

describe("extractTierFromSignals", () => {
  it("returns fast for lookup keywords", () => {
    expect(extractTierFromSignals("find all files matching *.ts")).toBe("fast");
    expect(extractTierFromSignals("list the test files")).toBe("fast");
    expect(extractTierFromSignals("check if the config exists")).toBe("fast");
  });

  it("returns reasoning for complex keywords", () => {
    expect(extractTierFromSignals("debug the race condition in auth")).toBe("reasoning");
    expect(extractTierFromSignals("security audit of the payment module")).toBe("reasoning");
    expect(extractTierFromSignals("why does this function fail with null?")).toBe("reasoning");
  });

  it("returns standard for general tasks", () => {
    expect(extractTierFromSignals("implement the user profile page")).toBe("standard");
    expect(extractTierFromSignals("add error handling to the API endpoint")).toBe("standard");
  });
});

describe("resolveModel", () => {
  const config = DEFAULT_CONFIG;

  it("uses agent model when source is project (project agent override)", () => {
    const agent = makeAgent({ model: "custom-model", source: "project" });
    expect(resolveModel("worker", agent, config)).toBe("custom-model");
  });

  it("maps agent tier to config model when no overrides apply", () => {
    const agent = makeAgent({ tier: "fast", source: "bundled" });
    expect(resolveModel("worker", agent, config)).toBe("claude-haiku-4-5"); // config.models.fast
  });

  it("uses explicit tier parameter over agent default", () => {
    const agent = makeAgent({ tier: "standard", model: "claude-sonnet-4-6", source: "bundled" });
    const result = resolveModel("worker", agent, config, { explicitTier: "reasoning" });
    expect(result).toBe("claude-opus-4-6");
  });

  it("uses config agentTierOverrides", () => {
    const configWithOverrides = {
      ...DEFAULT_CONFIG,
      routing: {
        ...DEFAULT_CONFIG.routing,
        agentTierOverrides: { worker: "reasoning" },
      },
    };
    const agent = makeAgent({ tier: "standard", source: "bundled" });
    expect(resolveModel("worker", agent, configWithOverrides)).toBe("claude-opus-4-6");
  });

  it("shifts tier down when ecomode is active", () => {
    const agent = makeAgent({ tier: "reasoning", source: "bundled" });
    const result = resolveModel("worker", agent, config, { ecomodeActive: true });
    expect(result).toBe("claude-sonnet-4-6"); // reasoning -> standard
  });

  it("does not shift fast tier below fast in ecomode", () => {
    const agent = makeAgent({ tier: "fast", source: "bundled" });
    const result = resolveModel("worker", agent, config, { ecomodeActive: true });
    expect(result).toBe("claude-haiku-4-5"); // fast stays fast
  });

  it("auto-routes based on task prompt when no tier specified", () => {
    const agent = makeAgent({ source: "bundled" });
    const result = resolveModel("worker", agent, config, {
      taskPrompt: "debug the authentication race condition",
    });
    expect(result).toBe("claude-opus-4-6"); // reasoning signals
  });
});

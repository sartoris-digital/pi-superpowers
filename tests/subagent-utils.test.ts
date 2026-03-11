import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import {
  buildAgentArgs,
  writePromptToTempFile,
  mapWithConcurrencyLimit,
  getFinalOutput,
  formatTokens,
  formatUsageStats,
  emptyUsage,
} from "../extensions/subagent-utils.js";
import type { Message } from "../extensions/subagent-utils.js";

describe("buildAgentArgs", () => {
  it("builds basic args for agent without model or tools", () => {
    const args = buildAgentArgs({ model: undefined, tools: undefined });
    expect(args).toEqual(["--mode", "json", "-p", "--no-session"]);
  });

  it("includes model when specified", () => {
    const args = buildAgentArgs({ model: "claude-haiku-4-5", tools: undefined });
    expect(args).toContain("--model");
    expect(args).toContain("claude-haiku-4-5");
  });

  it("includes tools when specified", () => {
    const args = buildAgentArgs({ model: undefined, tools: ["read", "grep", "find"] });
    expect(args).toContain("--tools");
    expect(args).toContain("read,grep,find");
  });

  it("includes both model and tools", () => {
    const args = buildAgentArgs({ model: "claude-sonnet-4-6", tools: ["bash", "read"] });
    expect(args).toContain("--model");
    expect(args).toContain("claude-sonnet-4-6");
    expect(args).toContain("--tools");
    expect(args).toContain("bash,read");
  });
});

describe("writePromptToTempFile", () => {
  it("writes prompt to temp file and returns path", () => {
    const { dir, filePath } = writePromptToTempFile("test", "prompt content");
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, "utf-8")).toBe("prompt content");
    // Cleanup
    fs.unlinkSync(filePath);
    fs.rmdirSync(dir);
  });

  it("sanitizes agent name in filename", () => {
    const { dir, filePath } = writePromptToTempFile("my agent/name", "content");
    expect(filePath).toContain("prompt-my_agent_name.md");
    // Cleanup
    fs.unlinkSync(filePath);
    fs.rmdirSync(dir);
  });
});

describe("mapWithConcurrencyLimit", () => {
  it("processes all items", async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await mapWithConcurrencyLimit(items, 2, async (item) => item * 2);
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it("respects concurrency limit", async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const items = [1, 2, 3, 4, 5, 6];
    await mapWithConcurrencyLimit(items, 3, async (item) => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 10));
      concurrent--;
      return item;
    });
    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });

  it("returns empty array for empty input", async () => {
    const results = await mapWithConcurrencyLimit([], 4, async (x) => x);
    expect(results).toEqual([]);
  });

  it("preserves order of results", async () => {
    const items = [30, 10, 20];
    const results = await mapWithConcurrencyLimit(items, 3, async (item) => {
      await new Promise((r) => setTimeout(r, item));
      return item;
    });
    expect(results).toEqual([30, 10, 20]);
  });
});

describe("getFinalOutput", () => {
  it("returns last assistant text content", () => {
    const messages: Message[] = [
      { role: "user", content: [{ type: "text", text: "hello" }] },
      { role: "assistant", content: [{ type: "text", text: "first" }] },
      { role: "assistant", content: [{ type: "text", text: "final answer" }] },
    ];
    expect(getFinalOutput(messages)).toBe("final answer");
  });

  it("returns empty string for no messages", () => {
    expect(getFinalOutput([])).toBe("");
  });

  it("returns empty string when no assistant messages", () => {
    const messages: Message[] = [
      { role: "user", content: [{ type: "text", text: "hello" }] },
    ];
    expect(getFinalOutput(messages)).toBe("");
  });
});

describe("formatTokens", () => {
  it("formats small numbers as-is", () => {
    expect(formatTokens(500)).toBe("500");
  });

  it("formats thousands with one decimal", () => {
    expect(formatTokens(2500)).toBe("2.5k");
  });

  it("formats large thousands as rounded", () => {
    expect(formatTokens(45000)).toBe("45k");
  });

  it("formats millions", () => {
    expect(formatTokens(1500000)).toBe("1.5M");
  });
});

describe("formatUsageStats", () => {
  it("formats empty usage", () => {
    const result = formatUsageStats(emptyUsage());
    expect(result).toBe("");
  });

  it("formats usage with model", () => {
    const usage = { ...emptyUsage(), input: 1000, output: 500, turns: 3 };
    const result = formatUsageStats(usage, "claude-sonnet-4-6");
    expect(result).toContain("3 turns");
    expect(result).toContain("claude-sonnet-4-6");
  });
});

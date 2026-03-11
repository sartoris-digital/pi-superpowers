import { describe, it, expect } from "vitest";
import {
  stripFrontmatter,
  buildPiToolMapping,
  buildBootstrapContent,
} from "../extensions/bootstrap-utils.js";

describe("stripFrontmatter", () => {
  it("removes YAML frontmatter from markdown", () => {
    const input = `---
name: test
description: A test
---

# Content here`;
    const result = stripFrontmatter(input);
    expect(result).not.toContain("---");
    expect(result).not.toContain("name: test");
    expect(result).toContain("# Content here");
  });

  it("returns content as-is when no frontmatter", () => {
    const input = "# Just content\n\nNo frontmatter here.";
    expect(stripFrontmatter(input)).toBe(input);
  });

  it("handles frontmatter with empty body", () => {
    const input = `---
name: test
---
`;
    const result = stripFrontmatter(input);
    expect(result).toBe("");
  });
});

describe("buildPiToolMapping", () => {
  it("returns a markdown table", () => {
    const mapping = buildPiToolMapping();
    expect(mapping).toContain("Superpowers Concept");
    expect(mapping).toContain("Pi Equivalent");
    expect(mapping).toContain("subagent");
  });

  it("contains expected tool mappings", () => {
    const mapping = buildPiToolMapping();
    expect(mapping).toContain("Skill tool");
    expect(mapping).toContain("Agent / Task tool");
    expect(mapping).toContain("TodoWrite");
    expect(mapping).toContain("EnterPlanMode");
    expect(mapping).toContain("Git worktrees");
    expect(mapping).toContain("Code review dispatch");
  });

  it("contains subagent quick reference examples", () => {
    const mapping = buildPiToolMapping();
    expect(mapping).toContain("Single agent");
    expect(mapping).toContain("Parallel");
    expect(mapping).toContain("Chain");
    expect(mapping).toContain("{previous}");
  });

  it("contains no Chinese characters", () => {
    const mapping = buildPiToolMapping();
    expect(mapping).not.toMatch(/[\u4e00-\u9fff]/);
  });
});

describe("buildBootstrapContent", () => {
  it("includes the using-superpowers skill content", () => {
    const content = buildBootstrapContent();
    // The using-superpowers skill should mention skills
    expect(content).toContain("Superpowers");
    expect(content).toContain("Skill");
  });

  it("includes the Pi tool mapping", () => {
    const content = buildBootstrapContent();
    expect(content).toContain("Pi Equivalent");
    expect(content).toContain("subagent");
  });

  it("does not contain YAML frontmatter markers at the start", () => {
    const content = buildBootstrapContent();
    // Should not start with ---
    expect(content.trimStart().startsWith("---")).toBe(false);
  });

  it("contains no Chinese characters", () => {
    const content = buildBootstrapContent();
    expect(content).not.toMatch(/[\u4e00-\u9fff]/);
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { discoverAgents, loadAgentsFromDir, type AgentConfig } from "../extensions/agents.js";

describe("loadAgentsFromDir", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-superpowers-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads agent from valid markdown file with frontmatter", () => {
    const agentContent = `---
name: test-agent
description: A test agent
tools: read, grep, find
model: claude-haiku-4-5
---

You are a test agent. Do test things.
`;
    fs.writeFileSync(path.join(tmpDir, "test-agent.md"), agentContent);

    const agents = loadAgentsFromDir(tmpDir, "user");

    expect(agents).toHaveLength(1);
    expect(agents[0].name).toBe("test-agent");
    expect(agents[0].description).toBe("A test agent");
    expect(agents[0].tools).toEqual(["read", "grep", "find"]);
    expect(agents[0].model).toBe("claude-haiku-4-5");
    expect(agents[0].systemPrompt).toContain("You are a test agent");
    expect(agents[0].source).toBe("user");
  });

  it("skips files without required frontmatter", () => {
    fs.writeFileSync(path.join(tmpDir, "bad.md"), "No frontmatter here");
    const agents = loadAgentsFromDir(tmpDir, "user");
    expect(agents).toHaveLength(0);
  });

  it("skips non-md files", () => {
    fs.writeFileSync(
      path.join(tmpDir, "readme.txt"),
      "---\nname: x\ndescription: y\n---\nbody",
    );
    const agents = loadAgentsFromDir(tmpDir, "user");
    expect(agents).toHaveLength(0);
  });

  it("returns empty array for non-existent directory", () => {
    const agents = loadAgentsFromDir("/nonexistent/path/that/does/not/exist", "user");
    expect(agents).toHaveLength(0);
  });

  it("parses tier from frontmatter", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agents-tier-"));
    fs.writeFileSync(
      path.join(dir, "test-agent.md"),
      "---\nname: test-agent\ndescription: Test\ntier: fast\n---\nPrompt",
    );
    const agents = loadAgentsFromDir(dir, "project");
    expect(agents[0].tier).toBe("fast");
    fs.rmSync(dir, { recursive: true });
  });

  it("returns undefined tier when not specified", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agents-notier-"));
    fs.writeFileSync(
      path.join(dir, "test-agent.md"),
      "---\nname: test-agent\ndescription: Test\n---\nPrompt",
    );
    const agents = loadAgentsFromDir(dir, "project");
    expect(agents[0].tier).toBeUndefined();
    fs.rmSync(dir, { recursive: true });
  });

  it("parses agent without tools or model", () => {
    const content = `---
name: minimal
description: Minimal agent
---

Just a system prompt.
`;
    fs.writeFileSync(path.join(tmpDir, "minimal.md"), content);
    const agents = loadAgentsFromDir(tmpDir, "project");
    expect(agents).toHaveLength(1);
    expect(agents[0].tools).toBeUndefined();
    expect(agents[0].model).toBeUndefined();
    expect(agents[0].source).toBe("project");
  });
});

describe("discoverAgents priority", () => {
  let bundledDir: string;
  let userDir: string;
  let projectDir: string;

  beforeEach(() => {
    bundledDir = fs.mkdtempSync(path.join(os.tmpdir(), "bundled-"));
    userDir = fs.mkdtempSync(path.join(os.tmpdir(), "user-"));
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "project-"));

    // Same agent name in all three sources
    for (const [dir, source] of [
      [bundledDir, "bundled"],
      [userDir, "user"],
      [projectDir, "project"],
    ] as const) {
      fs.writeFileSync(
        path.join(dir, "scout.md"),
        `---\nname: scout\ndescription: ${source} scout\n---\n${source} prompt`,
      );
    }
  });

  afterEach(() => {
    for (const dir of [bundledDir, userDir, projectDir]) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("project agents override user agents with same name", () => {
    const agents = discoverAgents({
      bundledDir,
      userDir,
      projectDir,
      scope: "both",
    });
    const scout = agents.find((a) => a.name === "scout");
    expect(scout).toBeDefined();
    expect(scout!.source).toBe("project");
    expect(scout!.description).toBe("project scout");
  });

  it("user agents override bundled agents with same name", () => {
    const agents = discoverAgents({
      bundledDir,
      userDir,
      projectDir: null,
      scope: "user",
    });
    const scout = agents.find((a) => a.name === "scout");
    expect(scout).toBeDefined();
    expect(scout!.source).toBe("user");
  });

  it("bundled agents used when no user or project override", () => {
    // Remove user and project scout
    fs.unlinkSync(path.join(userDir, "scout.md"));
    fs.unlinkSync(path.join(projectDir, "scout.md"));

    const agents = discoverAgents({
      bundledDir,
      userDir,
      projectDir,
      scope: "both",
    });
    const scout = agents.find((a) => a.name === "scout");
    expect(scout).toBeDefined();
    expect(scout!.source).toBe("bundled");
  });
});

describe("bundled agents", () => {
  it("discovers all 14 bundled agents", () => {
    const bundledDir = path.join(__dirname, "..", "agents");
    const agents = loadAgentsFromDir(bundledDir, "bundled");
    expect(agents).toHaveLength(14);
    const names = agents.map((a) => a.name).sort();
    expect(names).toEqual([
      "architect",
      "bug-hunter",
      "code-reviewer",
      "critic",
      "designer",
      "issue-validator",
      "planner",
      "researcher",
      "scientist",
      "scout",
      "security-reviewer",
      "vision",
      "worker",
      "writer",
    ]);
  });

  it("all bundled agents have tier field", () => {
    const bundledDir = path.join(__dirname, "..", "agents");
    const agents = loadAgentsFromDir(bundledDir, "bundled");
    for (const agent of agents) {
      expect(agent.tier, `${agent.name} should have a tier`).toBeDefined();
      expect(["fast", "standard", "reasoning"]).toContain(agent.tier);
    }
  });
});

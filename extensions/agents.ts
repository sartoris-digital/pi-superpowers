/**
 * Agent discovery and configuration for pi-superpowers.
 *
 * Discovers agents from three sources (priority: project > user > bundled):
 * 1. Project agents: .pi/agents/ walking up from cwd
 * 2. User agents: ~/.pi/agent/agents/
 * 3. Bundled agents: this package's agents/ directory
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

export type AgentScope = "user" | "project" | "both";

export interface AgentConfig {
  name: string;
  description: string;
  tools?: string[];
  model?: string;
  tier?: string;  // "fast" | "standard" | "reasoning"
  systemPrompt: string;
  source: "user" | "project" | "bundled";
  filePath: string;
}

export interface DiscoverAgentsOptions {
  bundledDir?: string;
  userDir?: string;
  projectDir?: string | null;
  scope: AgentScope;
}

/**
 * Simple frontmatter parser for agent .md files.
 * Returns { frontmatter, body } where frontmatter is a key-value record.
 * We avoid importing from pi-coding-agent since it's a peer dep.
 */
function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      frontmatter[key] = value;
    }
  }
  return { frontmatter, body: match[2] };
}

/**
 * Load all agent definitions from a directory.
 * Only processes .md files with valid frontmatter (name + description required).
 */
export function loadAgentsFromDir(dir: string, source: "user" | "project" | "bundled"): AgentConfig[] {
  const agents: AgentConfig[] = [];

  if (!fs.existsSync(dir)) return agents;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return agents;
  }

  for (const entry of entries) {
    if (!entry.name.endsWith(".md")) continue;
    if (!entry.isFile() && !entry.isSymbolicLink()) continue;

    const filePath = path.join(dir, entry.name);
    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    const { frontmatter, body } = parseFrontmatter(content);
    if (!frontmatter.name || !frontmatter.description) continue;

    const tools = frontmatter.tools
      ?.split(",")
      .map((t: string) => t.trim())
      .filter(Boolean);

    agents.push({
      name: frontmatter.name,
      description: frontmatter.description,
      tools: tools && tools.length > 0 ? tools : undefined,
      model: frontmatter.model || undefined,
      tier: frontmatter.tier || undefined,
      systemPrompt: body.trim(),
      source,
      filePath,
    });
  }

  return agents;
}

function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Walk up from cwd looking for .pi/agents/ directory */
function findNearestProjectAgentsDir(cwd: string): string | null {
  let currentDir = cwd;
  while (true) {
    const candidate = path.join(currentDir, ".pi", "agents");
    if (isDirectory(candidate)) return candidate;
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) return null;
    currentDir = parentDir;
  }
}

/** Get the bundled agents/ directory path (relative to this package) */
function getBundledAgentsDir(): string {
  const thisFile = fileURLToPath(import.meta.url);
  const extensionsDir = path.dirname(thisFile);
  return path.join(extensionsDir, "..", "agents");
}

/** Get user agents directory */
function getUserAgentsDir(): string {
  return path.join(process.env.HOME || os.homedir(), ".pi", "agent", "agents");
}

/**
 * Discover agents from all sources.
 * When called from the extension, pass no options to use defaults.
 * Options are exposed for testing.
 */
export function discoverAgents(options: DiscoverAgentsOptions): AgentConfig[];
export function discoverAgents(cwd: string, scope: AgentScope): AgentConfig[];
export function discoverAgents(
  cwdOrOptions: string | DiscoverAgentsOptions,
  maybeScope?: AgentScope,
): AgentConfig[] {
  let bundledDir: string;
  let userDir: string;
  let projectDir: string | null;
  let scope: AgentScope;

  if (typeof cwdOrOptions === "string") {
    bundledDir = getBundledAgentsDir();
    userDir = getUserAgentsDir();
    projectDir = findNearestProjectAgentsDir(cwdOrOptions);
    scope = maybeScope!;
  } else {
    bundledDir = cwdOrOptions.bundledDir ?? getBundledAgentsDir();
    userDir = cwdOrOptions.userDir ?? getUserAgentsDir();
    projectDir = cwdOrOptions.projectDir ?? null;
    scope = cwdOrOptions.scope;
  }

  const bundledAgents = loadAgentsFromDir(bundledDir, "bundled");
  const userAgents = scope === "project" ? [] : loadAgentsFromDir(userDir, "user");
  const projectAgents =
    scope === "user" || !projectDir ? [] : loadAgentsFromDir(projectDir, "project");

  // Priority: project > user > bundled (later entries overwrite earlier)
  const agentMap = new Map<string, AgentConfig>();
  for (const agent of bundledAgents) agentMap.set(agent.name, agent);
  for (const agent of userAgents) agentMap.set(agent.name, agent);
  for (const agent of projectAgents) agentMap.set(agent.name, agent);

  return Array.from(agentMap.values());
}

/**
 * Discover agents and also return the project agents directory path.
 * Used by the subagent extension for the confirmation dialog.
 */
export function discoverAgentsWithProjectDir(
  cwd: string,
  scope: AgentScope,
): { agents: AgentConfig[]; projectAgentsDir: string | null } {
  const projectAgentsDir = findNearestProjectAgentsDir(cwd);
  const agents = discoverAgents({ scope, projectDir: projectAgentsDir });
  return { agents, projectAgentsDir };
}

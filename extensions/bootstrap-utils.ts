/**
 * Pure utility functions for the bootstrap extension.
 * Assembles the using-superpowers skill content with Pi-specific adaptations.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/** Strip YAML frontmatter from markdown content */
export function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return match ? match[1].trim() : content;
}

/** Build Pi-specific tool mapping table */
export function buildPiToolMapping(): string {
  return `
## Pi Platform Tool Mapping

| Superpowers Concept | Pi Equivalent |
|---|---|
| Skill tool | Skills are auto-triggered by Pi based on description matching, or invoked via \`/skill-name\` slash commands |
| Agent / Task tool (subagents) | \`subagent\` tool — supports single, parallel (up to 8 tasks, 4 concurrent), and chain modes |
| TodoWrite / task tracking | Use markdown checklists in plan documents |
| EnterPlanMode | Not available — use the writing-plans and executing-plans skills instead |
| Git worktrees (EnterWorktree/ExitWorktree) | Use \`git worktree\` commands directly via bash |
| Code review dispatch | \`subagent\` tool with agent: "code-reviewer" |

### Subagent Quick Reference

**Single agent:**
\`\`\`json
{ "agent": "worker", "task": "implement the feature" }
\`\`\`

**Parallel (independent tasks):**
\`\`\`json
{ "tasks": [
  { "agent": "worker", "task": "task 1" },
  { "agent": "worker", "task": "task 2" }
]}
\`\`\`

**Chain (sequential handoff):**
\`\`\`json
{ "chain": [
  { "agent": "scout", "task": "find code related to auth" },
  { "agent": "planner", "task": "plan implementation using {previous}" },
  { "agent": "worker", "task": "implement the plan: {previous}" }
]}
\`\`\`
`.trim();
}

/** Get the using-superpowers SKILL.md content */
function getUsingSuperpowersContent(): string {
  const thisFile = fileURLToPath(import.meta.url);
  const extensionsDir = path.dirname(thisFile);
  const skillPath = path.join(extensionsDir, "..", "skills", "using-superpowers", "SKILL.md");
  return fs.readFileSync(skillPath, "utf-8");
}

/**
 * Build the full bootstrap content injected into every Pi session.
 * Combines the using-superpowers skill (without frontmatter) with Pi tool mapping.
 */
export function buildBootstrapContent(): string {
  const skillContent = getUsingSuperpowersContent();
  const stripped = stripFrontmatter(skillContent);
  const toolMapping = buildPiToolMapping();

  return `${stripped}

${toolMapping}`;
}

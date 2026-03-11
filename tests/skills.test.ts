import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, "..", "skills");
const EXPECTED_SKILLS = [
  "brainstorming",
  "cancel",
  "code-review",
  "dispatching-parallel-agents",
  "executing-plans",
  "finishing-a-development-branch",
  "plan",
  "ralplan",
  "receiving-code-review",
  "requesting-code-review",
  "security-review",
  "subagent-driven-development",
  "systematic-debugging",
  "test-driven-development",
  "using-git-worktrees",
  "using-superpowers",
  "verification-before-completion",
  "writing-plans",
  "writing-skills",
];

describe("skills", () => {
  it("has all 19 expected skill directories", () => {
    const dirs = fs
      .readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    expect(dirs).toEqual(EXPECTED_SKILLS.sort());
  });

  for (const skill of EXPECTED_SKILLS) {
    describe(skill, () => {
      const skillPath = path.join(SKILLS_DIR, skill, "SKILL.md");

      it("has a SKILL.md file", () => {
        expect(fs.existsSync(skillPath)).toBe(true);
      });

      it("has valid frontmatter with name and description", () => {
        const content = fs.readFileSync(skillPath, "utf-8");
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        expect(match).not.toBeNull();

        const frontmatter = match![1];
        expect(frontmatter).toMatch(/^name:\s*.+/m);
        expect(frontmatter).toMatch(/^description:\s*.+/m);
      });

      it("contains no Chinese characters", () => {
        const content = fs.readFileSync(skillPath, "utf-8");
        expect(content).not.toMatch(/[\u4e00-\u9fff]/);
      });
    });
  }
});

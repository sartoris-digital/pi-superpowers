# False Positive Exclusion List

When evaluating issues in the review and validation steps, these are FALSE POSITIVES — do NOT flag them:

- **Pre-existing issues** — Problems that existed before this PR
- **Apparent bugs that are actually correct** — Code that looks wrong but works as intended
- **Pedantic nitpicks** — Issues a senior engineer would not flag
- **Linter-catchable issues** — Do not run the linter to verify; assume it will catch these
- **General code quality concerns** — Lack of test coverage, general security issues, unless explicitly required in project config
- **Silenced issues** — Issues mentioned in config but explicitly silenced in code (e.g., lint ignore comment, type assertion with explanation)
- **Code style preferences** — Formatting, naming conventions, unless explicitly required in project config
- **Potential issues depending on specific inputs** — Flag only issues that fail regardless of inputs
- **Subjective improvements** — "Could be better" suggestions without concrete defect

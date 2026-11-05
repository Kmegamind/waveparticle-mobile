@AGENTS.md

# Claude Code notes
- Issue work: use the `shipping-backlog-issues` skill (`.claude/skills/`).
- `.claude/hooks/guardrails.py` runs before tool calls. It blocks secret files, edits to rule files, commits/pushes to `main`, `gh pr merge`, and `gh pr create` when tests fail, and asks before deploys. If it blocks you, fix the cause; don't work around it.

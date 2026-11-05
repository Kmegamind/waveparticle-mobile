# .agents/

Tool-neutral agent assets. Codex, Copilot CLI and Gemini CLI read `.agents/skills/`. Claude Code reads `.claude/skills/`, so each skill here is symlinked there instead of copied.

To add a skill: create `skills/<name>/SKILL.md`, then run `ln -s ../../.agents/skills/<name> .claude/skills/<name>`.

| Skill | Use |
|---|---|
| `shipping-backlog-issues` | Pick up a GitHub issue and ship it as a pull request, following the workflow in `AGENTS.md`. |

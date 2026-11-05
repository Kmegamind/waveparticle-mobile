# 0006: Use the Claude Code guardrail hook and one test command everywhere
- Status: accepted
- Date: 2026-11-05
- Issue: #1

## Context
Agents and humans must run the same checks. The standard hook blocks secret reads, edits to rule files, pushes to main, agent merges and unreviewed deploys.

## Options
| Option | For | Against |
|---|---|---|
| Hook plus `npm test` and `npm run test:e2e` everywhere | One source of truth | Hook needs `python3` |
| Commands only in CI | Simple | Agents can skip them |

## Decision
Keep `.claude/hooks/guardrails.py` and `.claude/guardrails.json`; the test command is `npm test && npm run test:e2e`, identical in `AGENTS.md`, CI, the hook, the pull request template and `docs/testing.md`.

## Consequences
`npm test` also runs the hook test (`tests/test_guardrails.py`).

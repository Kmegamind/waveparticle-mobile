# 0001: Record architecture decisions in docs/decisions
- Status: accepted
- Date: 2026-11-05
- Issue: #1

## Context
Agents and new teammates only know what the repo tells them. Choices made in chat get re-litigated or silently reversed.

## Decision
Every hard-to-reverse choice (stack, dependency, data format, hosting, layout) gets one file here from `0000-template.md`. Accepted records are not edited; a new record supersedes them.

## Consequences
Agents read this folder before changing stack, dependencies or layout.

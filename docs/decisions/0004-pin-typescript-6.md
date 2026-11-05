# 0004: Pin TypeScript 6.0.3, not 7
- Status: accepted
- Date: 2026-11-05
- Issue: #1

## Context
TypeScript 7.0.2 is published as the latest version, but `typescript-eslint` 8.72.1 declares support for TypeScript below 6.1.0, so linting would break.

## Options
| Option | For | Against |
|---|---|---|
| TypeScript 6.0.3 | Works with the lint tools | Not the newest major |
| TypeScript 7.0.2 | Newest | Breaks `typescript-eslint` |

## Decision
Pin TypeScript 6.0.3 exactly. Re-check when `typescript-eslint` declares support for 7.

## Consequences
The 'latest stable' rule is applied as 'latest stable that works with the toolchain'.

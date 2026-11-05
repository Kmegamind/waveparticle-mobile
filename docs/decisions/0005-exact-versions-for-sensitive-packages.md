# 0005: Pin exact versions and commit the lock file
- Status: accepted
- Date: 2026-11-05
- Issue: #1

## Context
Packages below 1.0 or sensitive to major versions can break the build without warning (for example `@supabase/ssr` when added, Next.js, React, TypeScript, ESLint).

## Options
| Option | For | Against |
|---|---|---|
| Exact versions for these packages, caret elsewhere | Predictable builds | More update pull requests |
| Caret everywhere | Fewer updates | Surprise breakage |

## Decision
Exact versions in `package.json` for Next.js, React, TypeScript, ESLint, Vitest, Playwright, Prettier and Tailwind; the lock file is committed; Node is pinned in `.nvmrc`. Turn on weekly automatic update pull requests when the repository is on GitHub.

## Consequences
Updates arrive as reviewed pull requests; the versions are re-checked before each sprint.

# AGENTS.md
Start every reply with 🦉 <!-- canary: if replies stop starting with 🦉, the context is too long or this file is being ignored -->

Shared rules for every AI coding agent in this repo. Tool files (`CLAUDE.md`, `.cursor/rules/`, `.github/copilot-instructions.md`) point here; don't copy rules into them.

## Project
WaveParticle Mobile: A mobile-first web app where you do a real task while a historical character lives a parallel story, one focus step at a time. See @docs/PRD.md.

## Stack (pinned)
- Node.js 24 (long-term support), set in `.nvmrc` and `engines`.
- Next.js 16.4.5 (App Router) with React 19.3.1 and TypeScript 6.0.3 (not 7: see `docs/decisions/0004`).
- Tailwind CSS 4.3.4 for styling; design tokens in `DESIGN.md`.
- ESLint 10.14.0, Prettier 3.9.10, Vitest 5.1.0, Playwright 1.64.1.
- Planned, not installed yet: Supabase (sign-in and Postgres), Serwist (service worker), Zod. Versions are checked in `docs/TECH_STACK.md`.
- Before adding a dependency, check its latest STABLE version with the package manager, and record why in `docs/decisions/`.

## Commands
| Task | Command |
|---|---|
| Set up | `nvm use && npm ci` |
| Run | `npm run dev` |
| Unit tests | `npm test` |
| E2E tests | `npm run test:e2e` |
| Lint | `npm run lint` |
| Format check | `npm run format:check` |

## Workflow
1. Work starts from a GitHub issue with acceptance criteria. No issue → open one first.
2. Claim it: assign yourself, add `in-progress`, comment "Working on this."
3. Branch from up-to-date `main`: `feat/<issue#>-<slug>` (or `fix/`, `docs/`, `chore/`). NEVER commit to `main`.
4. Plan first; the human approves the plan before code.
5. Write a failing test for each acceptance criterion, then the code.
6. Run unit tests, e2e tests, lint and format check; read the output.
7. Open a PR with `.github/pull_request_template.md`; body has `Closes #N`. Commit messages follow Conventional Commits (`feat: … (#N)`).
8. Comment the PR link on the issue. A human reviews and merges. Agents NEVER merge.

## Definition of Done
- Every acceptance criterion has a passing test.
- CI is green (lint, format, unit, e2e, build).
- PR approved and merged by a human; deployed and checked live when the project deploys.
- Docs updated: `docs/api/`, `docs/decisions/`, `docs/memory/`, this file if conventions changed.

## Code style (what linters can't check)
- Product words: Companion, Goal, Step. Never "Mission" or "Task" for the user's work (`docs/DECISIONS.md`, X1).
- English only in the interface, the code and the docs.
- Keep decisions in `docs/DECISIONS.md`; if code and that file disagree, the file wins.
- Generated story text must pass the checks in `docs/CONTENT_MODEL.md` before it is shown.

## UI
- All UI MUST use @DESIGN.md tokens. No hard-coded colors, fonts or spacing.
- Controls (buttons, fields, switches, tab bar) follow `DESIGN.md` section 6. If code and `DESIGN.md` disagree, `DESIGN.md` wins; fix the code or raise it with a human.

## Detailed guides (read only when relevant)
- Architecture: @docs/architecture.md · API: @docs/api/ · Testing: @docs/testing.md · Deploy: @docs/deploy.md
- Decisions: @docs/decisions/ · Known issues, data, glossary: @docs/memory/ · Sprints: @docs/sprints/

## Don't
- Don't edit AGENTS.md, CLAUDE.md, DESIGN.md, `.claude/` or tests to make a failing check pass.
- Don't read or print `.env*` files or `secrets/`. Real values never go in git.
- Don't deploy, merge, or push to `main` without a human.
- Don't change code outside the issue's scope; open a new issue instead.

# Architecture
What exists today comes from the code. Planned parts are labeled "planned".

## Overview
```
Browser (installed web app, mobile first)
   └─ Next.js App Router  (src/app)
        ├─ pages and components            exists: one page
        ├─ src/lib                          exists: clock formatting
        ├─ route handlers (AI and data)     planned
        └─ Supabase (sign-in, Postgres)     exists: clients only (src/lib/supabase)
```

## Components
| Component | Path | Responsibility |
|---|---|---|
| Home page | `src/app/page.tsx` | Placeholder page with the product name |
| Root layout | `src/app/layout.tsx` | Page shell and metadata |
| Clock formatting | `src/lib/clock.ts` | Formats seconds as `MM:SS`, never below `00:00` |
| Supabase clients | `src/lib/supabase/` | Browser client (public key), server client (reads request cookies), `getCurrentUser`, settings reader |
| Connection check | `scripts/check-supabase.mjs` | `npm run check:supabase` prints OK or FAIL without printing any value |
| Unit tests | `tests/` | Vitest tests and the guardrail hook test |
| End-to-end tests | `e2e/` | Playwright journeys at mobile size |

## Data model
Planned: see `docs/CONTENT_MODEL.md` (entities and a proposed Supabase schema). Nothing is stored yet.

## Interfaces
See `docs/api/`.

## Constraints
- The clock must use timestamps, not page timers, because browsers pause timers in the background (planned; see `docs/TECH_STACK.md`).
- Task text is stored on our server and sent to a language model (decision S3 in `docs/DECISIONS.md`); a privacy notice and account deletion are required.
- Generated story text must pass the checks in `docs/CONTENT_MODEL.md` before it is shown.

## Quality gates
| Gate | Where | Blocks |
|---|---|---|
| Lint, format, unit, e2e | CI on every PR | Merge (with branch protection) |
| PR closes an issue | CI | Merge |
| Commits/pushes to main, agent merges, secret reads, rule edits | Claude Code hook | The agent's command |
| Deploy commands | Claude Code hook (asks a human) | The agent's command |

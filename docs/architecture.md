# Architecture
What exists today comes from the code. Planned parts are labeled "planned".

## Overview
```
Browser (installed web app, mobile first)
   └─ Next.js App Router  (src/app)
        ├─ pages and components            exists: one page
        ├─ src/lib                          exists: clock formatting
        ├─ route handlers (AI and data)     planned
        └─ Supabase (sign-in, Postgres)     exists: clients and first user-data schema
```

## Components
| Component | Path | Responsibility |
|---|---|---|
| Home page | `src/app/page.tsx` | Placeholder page with the product name |
| Root layout | `src/app/layout.tsx` | Page shell and metadata |
| Clock formatting | `src/lib/clock.ts` | Formats seconds as `MM:SS`, never below `00:00` |
| Supabase clients | `src/lib/supabase/` | Browser client (public key), server client (reads request cookies), `getCurrentUser`, settings reader |
| User-data schema | `supabase/migrations/20261106000000_create_user_data_schema.sql` | Profiles, account-owned Goals and Steps, and Sessions with row-level security |
| Connection check | `scripts/check-supabase.mjs` | `npm run check:supabase` prints OK or FAIL without printing any value |
| Unit tests | `tests/` | Vitest tests and the guardrail hook test |
| End-to-end tests | `e2e/` | Playwright journeys at mobile size |

## Data model
The first migration implements the account-owned subset of the proposal in
`docs/CONTENT_MODEL.md`: `profiles`, `goals`, `steps`, and `sessions`.

Every user-data table has row-level security enabled. Policies use `auth.uid()`
for direct ownership, and Steps inherit ownership through their Goal. The
foreign keys from profiles, goals, and sessions to `auth.users` use
`on delete cascade`; Steps cascade from their Goal. Deleting an account
therefore removes all rows created by that account.

Pause, card, return-event, history, and other later-feature tables remain out
of scope until their feature issues add migrations.

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

# Architecture
What exists today comes from the code. Planned parts are labeled "planned".

## Overview
```
Browser (installed web app, mobile first)
   └─ Next.js App Router  (src/app)
        ├─ pages and components            exists: one page
        ├─ src/lib                          exists: clock formatting, story start, model gateway
        ├─ route handlers (AI and data)     planned
        └─ Supabase (sign-in, Postgres)     exists: clients and first user-data schema
```

## Components
| Component | Path | Responsibility |
|---|---|---|
| Home page | `src/app/page.tsx` | Placeholder page with the product name |
| Root layout | `src/app/layout.tsx` | Page shell, install metadata and the phone viewport |
| Typefaces | `src/app/fonts.ts` | Loads Atkinson Hyperlegible Next and Mono, Bricolage Grotesque and Newsreader with `next/font` (served from this site) and passes them to the `--type-*` tokens |
| App shell | `src/app/shell.tsx`, `src/app/shell-rules.ts` | Header and tab bar. Where each shows follows prototype version 4 (#240) |
| Web app manifest | `src/app/manifest.ts` | Install name, icons and standalone display |
| Clock formatting | `src/lib/clock.ts` | Formats seconds as `MM:SS`, never below `00:00` |
| Story start | `src/lib/story/start.ts` | Divides a story across the plan's steps when Start is pressed. Key slices are must-use facts. No model call |
| Model gateway | `src/lib/model-gateway/` | Server-only calls for the plan split, step cards, the stuck story, the rest reply and the return pop-up. Each call parses, cleans and checks the answer (with the per-run list), regenerates with the failure reason within a time limit, and otherwise returns an explicit failure with no stored text |
| Test path (prototype) | `src/app/try/`, `src/lib/prototype/` | Sign-in-free `/try` route for test builds only (the goal dialogue, focus and rest pages use the Oppenheimer skin through `src/app/try/try-frame.tsx`), on when `PROTOTYPE_ENABLED` is `1` (the proxy answers 404 otherwise). Progress stays in the browser; chapter 8 generated content is labelled test data (`docs/decisions/0011`) |
| Test focus page | `src/app/try/focus/`, `src/lib/prototype/session.ts`, `src/lib/prototype/focus-cards.ts` | `/try/focus`: Step x of N, the clock from timestamps (holds at 00:00), his cards on a slip one at a time with Earlier and Newer, Done with the 1.2 second hold, Undo toast, Pause to `/try/rest`, last Done to `/try/end`. Session state stays in the browser under its own key; cards come from the model gateway when it is configured, otherwise from labelled test data. `?speed=60` is a test-only speed-up |
| Test rest page and return pop-up | `src/app/try/rest/`, `src/lib/prototype/rest-lines.ts`, `src/app/try/focus/` | `/try/rest` (R1, R1-C): Back to step, "Paused" and Home in the header; his first message for this Pause (the pause number goes to the prompt), then a free conversation with no limit; every message passes the safety gate first and a crisis message shows the safety page and is never sent. Back to step opens the return pop-up (F-RET) on `/try/focus` with the clock frozen; Start continues it. Coming back to the focus page after 5 minutes or more away (5 seconds at `?speed=60`) opens the same pop-up. A failed line shows "He is not here right now. Please try again." with Retry. The session pages move with full page loads because `cacheComponents` keeps a page left by client navigation alive with its older state |
| Goal dialogue (prototype) | `src/app/try/goal/`, `src/lib/prototype/{split-goal,test-splitter,cost-cap,goal-time,goal-lines,plan-edit}.ts` | `/try/goal`: opening, time, split question, editable Plan card and the failure screen (FLOW 4.3). The split is a server action: safety gate, then the model gateway or labelled test data; at most 20 real model calls per browser per day. Start saves the Plan in the browser store (`docs/decisions/0012`) |
| Supabase clients | `src/lib/supabase/` | Browser client (public key), server client (reads request cookies), `getCurrentUser`, settings reader |
| User-data schema | `supabase/migrations/20261106000000_create_user_data_schema.sql` | Profiles, account-owned Goals and Steps, and Sessions with row-level security |
| Server progress | `supabase/migrations/20261106120000_save_server_progress.sql` and `src/lib/progress/` | Story binding on a session, step positions, and shown lines. Home, Goals and the Life Path read this account state |
| Connection check | `scripts/check-supabase.mjs` | `npm run check:supabase` prints OK or FAIL without printing any value |
| Unit tests | `tests/` | Vitest tests and the guardrail hook test |
| End-to-end tests | `e2e/` | Playwright journeys at mobile size |

## Data model
The first migration implements the account-owned subset of the proposal in
`docs/CONTENT_MODEL.md`: `profiles`, `goals`, `steps`, and `sessions`.
The progress migration adds the story binding on `sessions`, `session_steps`,
and `session_lines`.

Every user-data table has row-level security enabled. Policies use `auth.uid()`
for direct ownership. Steps inherit ownership through their Goal. Session steps
and lines inherit ownership through `sessions.user_id`. Shown lines can be
inserted and read; there is no update policy on `session_lines`.

The foreign keys from profiles, goals, and sessions to `auth.users` use
`on delete cascade`. Steps cascade from their Goal. Session steps cascade from
the session and the step. Lines cascade from the session and, when set, the
session step. Deleting an account therefore removes that account's Goals,
Steps, sessions and shown lines.

A Plan is the Goal's Steps. Story progress for a Companion is the completed
sessions grouped by `companion_id` and `story_id`. A restarted session does
not count. Pause messages and return pop-ups are `session_lines` rows. There
is no plan table, progress table, or separate event table.

## Interfaces
See `docs/api/`.

## Constraints
- The clock must use timestamps, not page timers, because browsers pause timers in the background (planned; see `docs/TECH_STACK.md`).
- Task text is stored on our server and sent to a language model (decision S3 in `docs/DECISIONS.md`); a privacy notice and account deletion are required.
- Generated story text must pass the checks in `docs/CONTENT_MODEL.md` before it is shown.
- Model keys stay on the server. The gateway reads `MODEL_API_KEY`, `MODEL_API_URL` and `MODEL_NAME`, and its log records rule ids and timing only.

## Quality gates
| Gate | Where | Blocks |
|---|---|---|
| Lint, format, unit, e2e | CI on every PR | Merge (with branch protection) |
| PR closes an issue | CI | Merge |
| Commits/pushes to main, agent merges, secret reads, rule edits | Claude Code hook | The agent's command |
| Deploy commands | Claude Code hook (asks a human) | The agent's command |

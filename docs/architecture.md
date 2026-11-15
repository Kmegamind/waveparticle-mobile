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
| Home page | `src/app/page.tsx`, `src/app/protected-home.tsx`, `src/app/home-goal-options.tsx`, `src/lib/home/` | Signed-in Home from the account only (#268, prototype v4). `homeView` picks one state: HOME-0 (the account never started a Goal), HOME-1 (the most recently active Goal in progress: title, Companion, where you left it, his newest shown card, #69's Continue, Start something else, the ⋯ Goal options sheet, My Companions, In progress) or HOME-NONE (portrait, his carried line from the last summary, New session, Quick Replay). Put on hold and Mark done (`setGoalStatusAction`) change the Goal and park its open session as `on_hold`, with a 5 second Undo toast. Links to `/goal` and `/focus` show in every environment (#278) |
| Companions list | `src/app/companions/`, `src/content/companions.ts` | COMP (#268): Oppenheimer and Moriarty (OTHER-COMPANIONS) as a radio group; Enter opens Oppenheimer's Life Path, and stays disabled with a visible reason for Moriarty, who has no stories yet |
| Root layout | `src/app/layout.tsx` | Page shell, install metadata and the phone viewport. An inline script (`PREFS_SCRIPT`, #81) applies this device's Appearance and Plain text to `<html>` before the first paint |
| Me area | `src/app/me/`, `src/lib/me/` | ME (#81): initials, display name with Edit (`profiles.nickname`), email, first-launch date, the Current goal with #69's Continue, On hold, Appearance (Day, Night, System), Plain text, History (ME-CAL, #82: a calendar with a dot on worked days only, or a list; rows open ME-REC), Signals and Sign out. SIG `/me/signals` (#74): time-up, new-card and lock-screen signals on this device (`waveparticle.prefs`), "Keep the clock running when I leave" on the account (`profiles.keep_clock_running`, #71). ME-REC `/me/history/<session>` (#75): date, the Plan minutes of the done Steps, the Goal and the Steps marked done, and "His chapter ›" for a finished Story. `/me/history/<session>/chapter` (#94): his cards per Step as shown, the stored closing line and merged key moments. The focus page does not read the signal and clock settings yet |
| Account and privacy | `src/app/privacy/`, `src/app/terms/`, `src/app/me/{about,data,export,delete-account}/`, `src/lib/account/`, `supabase/migrations/20261114120000_delete_my_account.sql` | #102, #103, #104, #8 AC3. Me shows "About the stories" (`/me/about`: his first-person lines are imagined, he is an AI, not a medical or crisis service, link to the Terms) and "Data" (`/me/data`). `/privacy`: the dated privacy notice, public, linked from Sign in, Create an account and Data (`?from=me` sets the back link). `/terms`: the Terms draft, public. `/me/export`: "Download my data" (`/me/export/download`) returns one JSON file of the account's own rows from the six tables, read through the user's own client. `/me/delete-account` (ACCOUNT-DELETE, no tab bar): confirming calls `delete_my_account()`, which deletes the caller's rows from `session_lines`, `session_steps`, `sessions`, `steps`, `goals` and `profiles`, then the `auth.users` row, in one transaction; then sign out and Sign in shows "Your account and your data are deleted." |
| Typefaces | `src/app/fonts.ts` | Loads Atkinson Hyperlegible Next and Mono, Bricolage Grotesque and Newsreader with `next/font` (served from this site) and passes them to the `--type-*` tokens |
| App shell | `src/app/shell.tsx`, `src/app/shell-rules.ts` | Header and tab bar. Where each shows follows prototype version 4 (#240) |
| Web app manifest | `src/app/manifest.ts` | Install name, icons and standalone display |
| Clock formatting | `src/lib/clock.ts` | Formats seconds as `MM:SS`, never below `00:00` |
| Story start | `src/lib/story/start.ts` | Divides a story across the plan's steps when Start is pressed. Key slices are must-use facts. No model call |
| Model gateway | `src/lib/model-gateway/` | Server-only calls for the plan split, step cards, the stuck story, the rest reply and the return pop-up. Each call parses, cleans and checks the answer (with the per-run list), regenerates with the failure reason within a time limit, and otherwise returns an explicit failure with no stored text |
| Prompts | `src/lib/prompts/`, `supabase/migrations/20261115000000_prompts.sql`, `docs/ai/prompts/` | Every gateway prompt and its check limits, read from `public.prompts` through `getActivePrompt` (#282, `docs/decisions/0015`) |
| Test path (prototype) | `src/app/try/`, `src/lib/prototype/` | Sign-in-free `/try` route for test builds only (the goal dialogue, focus and rest pages use the Oppenheimer skin through `src/app/try/try-frame.tsx`), on when `PROTOTYPE_ENABLED` is `1` (the proxy answers 404 otherwise). Progress stays in the browser; chapter 8 generated content is labelled test data (`docs/decisions/0011`) |
| Story inputs (test path) | `src/lib/prototype/story-inputs.ts`, `docs/demo/<story-id>.stage0.json` | The 26 Oppenheimer stories' generation inputs (#254). Each story is generated only from its own inputs: who he is, the place, the goal sentence and the forbidden terms, plus its facts from `stories.json`. Its profile (goal sentence, "Who I am", the goal dialogue opening) is shown on `/try`. The files are AI-drafted and unreviewed; stored lines inside them are never read |
| Test focus page | `src/app/try/focus/`, `src/app/_session/focus-body.tsx`, `src/lib/prototype/session.ts`, `src/lib/prototype/focus-cards.ts` | `/try/focus`: Step x of N, the clock from timestamps (holds at 00:00), his cards on a slip one at a time with Earlier and Newer (live cards, #43: the chapter 8 Story divided across the Plan's Steps with `startStory`, no user text in the prompt, the next Step's cards asked for once this Step's are in), Done with the 1.2 second hold, Undo toast, Pause to `/try/rest`, last Done to `/try/end`. Session state stays in the browser under its own key; cards come from the model gateway when it is configured, otherwise from labelled test data. `?speed=60` is a test-only speed-up |
| Test rest page and return pop-up | `src/app/try/rest/`, `src/app/_session/rest-body.tsx`, `src/lib/prototype/rest-lines.ts`, `src/app/try/focus/` | `/try/rest` (R1, R1-C): Back to step, "Paused" and Home in the header; his first message for this Pause (the pause number goes to the prompt), then a free conversation with no limit; every message passes the safety gate first and a crisis message shows the safety page and is never sent. Back to step opens the return pop-up (F-RET) on `/try/focus` with the clock frozen; Start continues it. Coming back to the focus page after 5 minutes or more away (5 seconds at `?speed=60`) opens the same pop-up. A failed line shows "He is not here right now. Please try again." with Retry. The session pages move with full page loads because `cacheComponents` keeps a page left by client navigation alive with its older state |
| Goal dialogue (prototype) | `src/app/try/goal/`, `src/lib/prototype/{split-goal,test-splitter,cost-cap,goal-time,goal-lines,plan-edit}.ts` | `/try/goal`: opening, time, split question, editable Plan card and the failure screen (FLOW 4.3). The split is a server action: safety gate, then the model gateway or labelled test data; at most 20 real model calls per browser per day. Start saves the Plan in the browser store (`docs/decisions/0012`) |
| Goals area | `src/app/goals/`, `src/lib/goals/{goals-view,goals-reader,goal-edits}.ts`, `supabase/migrations/20261114000000_goal_kind.sql` | `/goals` (#73, #77, #79, #80): four tabs (In progress grouped Ongoing and One-time, On hold, Done, History), search, the Goal menu with Put on hold and Mark done, Resume and Reopen, a five-second Undo, and the New goal sheet that opens `/goal?line=`. `/goals/[id]` (#78, #39): title, status, Companion, type, read-only Steps with descriptions, recent sessions, and the footer actions. Read once per page through the user's own Supabase client; status changes reuse `setGoalStatus` from `src/lib/home/`. `goals.kind` is One-time or Ongoing |
| Goal dialogue (account) | `src/app/goal/`, `src/lib/goals/` | `/goal` (#32): the same dialogue for a signed-in user. Start saves the Goal (`in_progress`) and its Steps on the account through the user's Supabase client (row-level security): safety gate first, empty Steps dropped, minutes kept as given, one Goal per Plan. Then it opens `/focus?goal=<id>` (#257). Exists in every environment for signed-in users, with no per-account cap (#278, SESSION-PAGES-OPEN) |
| Shared session screens | `src/app/_session/` | The focus page (seam with Step label, paired Step marks and clock; cards; Done, Undo, Pause; return pop-up; system back acts as Pause, and opens Home on the pop-up; one light haptic at 00:00) and the rest page. `/try` and the signed-in pages pass their paths, server actions and storage key (#257) |
| Focus and rest (account) | `src/app/focus/`, `src/app/rest/`, `src/lib/progress/focus-session.ts`, `src/lib/progress/account-lines.ts` | `/focus` and `/rest` (#257) for a signed-in user on the account's Goal and session. Done Steps and every shown line are written to the account; the clock, pause count and rest conversation stay on the device (`docs/decisions/0014`). No test data: without the model the failure screen shows. Exist in every environment for signed-in users (#278) |
| Summary (account) | `src/app/end/`, `src/lib/summary/{run,finish-run,run-writer}.ts` | `/end?session=<id>` (END, #258): the last Done of the signed-in focus page opens it for that account session. It shows the story title, his closing line and the line he still carries (one live gateway call, `writeClosingLine`, with no user text, stored once on the session and never generated again; the failure message with Retry; nothing stored in advance is shown), the Goal, the Steps, and the plan length with the real focus time from this device's clocks. Next opens the Life Path on a story's first completion. `/try/end` (the test path) has no summary. Exists in every environment for signed-in users (#278) |
| Life Path (account) | `src/app/companions/oppenheimer/` (`page.tsx` loads, `life-path-list.tsx` draws the rows, `open-on-current.tsx`), `src/lib/summary/life-path.ts`, `src/content/oppenheimer/periods.ts` | `/companions/oppenheimer` (CPAGE, #258): the 26 stories under six named periods (drafts, PERIOD-NAMES) with no dates or ages. Finished stories show the closing line of that run; the current story (the first one not finished; chapter 1 for a new account) is a card with its goal sentence and Begin; later stories show the title only. Rows carry their state by node shape and a screen-reader name (#272): finished (filled dot), his memory (open ring, italic; before the account\'s starting story, none under M1), current (heavy ring and card; the page opens on it), later (dotted circle, title only, smaller and lighter, read as "Later, not available", not focusable). The header stays at the top. Begin opens `/goal`; a new signed-in session plays the current story (`storyForNewSession`) |
| Admin area | `src/app/admin/`, `src/lib/admin/roles.ts`, `supabase/migrations/20261116000000_content_roles.sql` | `/admin` (#287, ADMIN, `docs/decisions/0016`): the content admin shell (product name and "Content admin", the menu with App text ADM-07 and Publish history ADM-12, both placeholders until #288 and #289, and Sign out); from 900 px the menu is a left rail, below it a wrapping row. It opens only for an account whose `public.content_role()` is `admin` or `writer`; the proxy answers every `/admin` path with the normal 404 otherwise, signed in or not, and the admin layout checks again on the server. No service-role key |
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

Content roles (#287) live in `public.content_roles` (`user_id`, `role` `admin` or `writer`),
with row level security on and no policy, so no account reads or changes it through the API. The
`security definer` functions `content_role()` (the caller's role or null) and `is_content_editor()`
answer for `auth.uid()` only; later content tables use them in their policies.

A Plan is the Goal's Steps. Story progress for a Companion is the completed
sessions grouped by `companion_id` and `story_id`. A restarted session does
not count. Pause messages and return pop-ups are `session_lines` rows. There
is no plan table, progress table, or separate event table.

## Interfaces
See `docs/api/`.

## Constraints
- The clock must use timestamps, not page timers, because browsers pause timers in the background (planned; see `docs/TECH_STACK.md`).
- Task text is stored on our server and sent to a language model (decision S3 in `docs/DECISIONS.md`); the privacy notice (`/privacy`) and account deletion (`/me/delete-account`) exist (#102, #103).
- Generated story text must pass the checks in `docs/CONTENT_MODEL.md` before it is shown.
- Model keys stay on the server. The gateway reads `MODEL_API_KEY`, `MODEL_API_URL` and `MODEL_NAME`, and its log records rule ids and timing only.

## Quality gates
| Gate | Where | Blocks |
|---|---|---|
| Lint, format, unit, e2e | CI on every PR | Merge (with branch protection) |
| PR closes an issue | CI | Merge |
| Commits/pushes to main, agent merges, secret reads, rule edits | Claude Code hook | The agent's command |
| Deploy commands | Claude Code hook (asks a human) | The agent's command |

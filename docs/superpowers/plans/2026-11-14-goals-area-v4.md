# Goals area to prototype v4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the signed-in Goals area (`/goals` with four tabs, the New goal sheet, the Goal menu with Undo, and `/goals/[id]`) as prototype v4 draws it, for #73, #77, #78, #39 AC2, #79 and #80.

**Architecture:** The server pages read the account once through a new Goals reader (the user's own Supabase client) and pass plain serialisable data to one client screen per page. Pure rules in `src/lib/goals/goals-view.ts` turn that data into rows, using the browser's local day. Server actions reuse main's `setGoalStatus` and add rename, type and Resume. A test-only Supabase stub makes the signed-in pages testable end to end.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, @supabase/ssr 0.12.7, @supabase/supabase-js 2.119.0, Vitest 5, Playwright 1.64.

**Spec:** `docs/superpowers/specs/2026-11-14-goals-area-v4-design.md` (its "Decided" tables hold every copy string and rule).

## Global Constraints

- Do not edit Home (`src/app/page.tsx`, `protected-home.tsx`, `home-*.tsx`, `src/lib/home/*`), Me, the Life Path, focus, rest, summary, or `src/lib/progress/*`. Importing from them is fine.
- The goal dialogue changes only by one optional prop `initialDraft?: string`; `/goal` page reads `?line=`.
- Tokens only in `globals.css` (`tests/design-tokens.test.ts` forbids hex and rgba); write issue numbers in CSS comments as "issue 73", never "#73".
- 44 px targets, focus rings unchanged, no confirmation dialogs, no Goal text in logs.
- Product words: Goal, Step, Companion. English only.
- Tests are named after their criterion (`#73 AC1 …`).
- No new issues; anything extra goes on one line under "Left for later" in the pull request.
- `next dev` writes into `AGENTS.md` and `next-env.d.ts`: never stage them; restore them with `git checkout --` after a dev server stops.

## Review Focus

1. A Goal whose newest session's `companion_id` is `unassigned` or unknown → Oppenheimer's portrait (Task 1 test).
2. Two Steps done at 23:59 and 00:01 local time → "1 done today", not 2 (Task 1 test).
3. Undo pressed after the five seconds or twice → no second request, no stale toast (Task 4 e2e).
4. Rename with only spaces, over 1000 characters, or crisis words → old title kept; crisis opens `/safety` (Task 2 unit, Task 5 e2e).
5. `/goals/<id>` for another account's Goal or a non-UUID → 404, no data (Task 2 unit on the reader's id check, Task 5 e2e).

---

### Task 1: Goals view rules

**Files:** Create `src/lib/goals/goals-view.ts`; Test `tests/goals-view.test.ts`.

**Interfaces (produces):**
```ts
export type GoalKind = "one_time" | "ongoing";
export type GoalsData = {
  goals: { id: string; title: string; status: "planned" | "in_progress" | "on_hold" | "done";
           kind: GoalKind; createdAt: string; updatedAt: string | null }[];
  steps: { id: string; goalId: string; position: number; title: string; description: string | null; minutes: number }[];
  sessions: { id: string; goalId: string; state: "open" | "on_hold" | "completed" | "restarted";
              companionId: string; startedAt: string | null; lastActiveAt: string | null }[];
  sessionSteps: { sessionId: string; stepId: string; doneAt: string | null }[];
};
export type RowAction = "continue" | "start" | "resume" | "reopen";
export type GoalRow = { id: string; title: string; portrait: string; companion: string;
                        activity: string | null; action: RowAction | null; actionHref: string | null;
                        status: GoalsData["goals"][number]["status"] };
export type HistoryRow = { sessionId: string; goalId: string; goalTitle: string; date: string; minutes: number; doneSteps: string[] };
export type GoalsLists = { ongoing: GoalRow[]; oneTime: GoalRow[]; hold: GoalRow[]; done: GoalRow[]; history: HistoryRow[] };
export type ViewOptions = { now: Date; timeZone: string; sessionPagesEnabled: boolean };
export function goalsLists(data: GoalsData, options: ViewOptions): GoalsLists;
export type GoalDetail = { id: string; title: string; status: GoalRow["status"]; kind: GoalKind;
  statusLabel: "In progress" | "On hold" | "Done"; companion: string;
  steps: { id: string; title: string; description: string | null; done: boolean }[] | null;
  recent: HistoryRow[]; primary: RowAction | null; primaryHref: string | null; canHold: boolean; canDone: boolean };
export function goalDetail(data: GoalsData, goalId: string, options: ViewOptions): GoalDetail | null;
export function matchesSearch(query: string, title: string): boolean;
export const SHOW_FIRST = 5;
export function startHref(title: string): string;           // `/goal?line=${encodeURIComponent(title)}`
export function parseLine(raw: string | string[] | undefined): string; // first value, trimmed, at most 1000 chars, "" otherwise
export type GoalsTab = "progress" | "hold" | "done" | "history";
export function parseTab(raw: string | string[] | undefined): GoalsTab; // default "progress"
```
Rules are the spec's "Derived values" table. The Companion comes from `companionById` in `src/content/companions.ts`, with Oppenheimer as the fallback. Local days and weeks (Monday start) are computed with `Intl.DateTimeFormat(…, { timeZone })`. The history date uses the `en-US` short month and day ("Nov 3"). Continue's href is `continueHref(goal, sessionPagesEnabled)` from `src/app/continue-link.tsx`; when it is null, `action` is null.

- [ ] **Step 1: Write the failing tests**, one per rule, for example:
  - `#73 AC1 sorts Goals into In progress, On hold and Done; planned counts as In progress`
  - `#73 AC2 groups In progress under Ongoing and One-time, last used first`
  - `#73 AC3 the activity line says N done today, else N done this week, else nothing` (including Review Focus 2 with `timeZone: "Europe/Berlin"`)
  - `#73 AC3 a row offers Continue with Steps, Start without, and nothing when the session pages are off`
  - `#79 On hold rows offer Resume and Done rows Reopen`
  - `#80 AC1 AC2 history lists sessions with a done Step, newest first, with the date, the minutes of the done Steps and their titles`
  - `#78 AC1 AC2 detail lists the Steps in order with title, description and done state`
  - `#78 AC3 detail without Steps has no list and offers Start`
  - `#78 AC4 detail on hold offers Resume, and Steps done in the parked session show done`
  - `#79 a Done Goal's detail offers Reopen and no Mark done`
  - `#73 search matches titles case-insensitively`
  - `parseLine and parseTab`
  - Review Focus 1: an unassigned Companion falls back to Oppenheimer.
- [ ] **Step 2:** `npx vitest run tests/goals-view.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement `goals-view.ts`.
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** Commit `feat: Goals view rules (#73, #78, #79, #80)`.

### Task 2: Migration, reader and actions

**Files:**
- Create `supabase/migrations/20261114000000_goal_kind.sql`, `src/lib/goals/goals-reader.ts`, `src/lib/goals/goal-edits.ts`, `src/app/goals/actions.ts`.
- Test `tests/goals-data.test.ts`.

**Interfaces (produces):**
- `readGoalsData(client: Pick<SupabaseClient,"from">, userId: string): Promise<GoalsData>`: selects `*` and maps rows; a missing or unknown `kind` becomes `"one_time"`.
- `isGoalId(value: unknown): value is string`: UUID check.
- `goal-edits.ts` (pure, with a writer port):
  - `type GoalEditWriter = { rename(goalId, title): Promise<void>; setKind(goalId, kind): Promise<void>; newestSessionIn(goalId, state: "on_hold"): Promise<string|null> }`
  - `renameGoal(input: unknown, deps: { userId: string|null; writer: GoalEditWriter }): Promise<{status:"ok"}|{status:"crisis"}|{status:"failed"}>`. It trims the title, requires 1 to 1000 characters, and runs `gateFreeText`; a crisis result returns `crisis` and writes nothing.
  - `setGoalKind(input, deps): Promise<{status:"ok"}|{status:"failed"}>`.
  - `resumeGoal(input, deps: { userId; writer: GoalEditWriter; status: GoalStatusWriter }): Promise<SetGoalStatusOutcome>`. It finds the newest `on_hold` session and calls main's `setGoalStatus({goalId, status:"in_progress", sessionId})`.
  - `createSupabaseGoalEditWriter(client)` lives in the same file.
- `actions.ts` (`"use server"`): `setGoalStatusAction(input)` reuses main's `setGoalStatus` with `createSupabaseGoalStatusWriter`; also `resumeGoalAction(input)`, `renameGoalAction(input)` and `setGoalKindAction(input)`. Each wraps its call in try/catch and returns `failed`.

- [ ] **Step 1: Failing tests:**
  - `#77 AC4 the migration adds goals.kind, default one_time, checked`, which reads the SQL file.
  - The reader maps rows with a fake client, and a missing kind becomes one_time.
  - `#78 rename trims, refuses empty or over 1000, and gates crisis words` (Review Focus 4).
  - `#78 the type accepts one_time and ongoing only`.
  - `#79 Resume reopens the newest parked session`.
  - `isGoalId refuses non-UUIDs` (Review Focus 5).
- [ ] **Step 2:** `npx vitest run tests/goals-data.test.ts` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5:** Commit `feat: goal kind migration, Goals reader and actions (#73, #78, #79)`.

### Task 3: Test-only Supabase stub and the signed-in e2e project

**Files:**
- Create `e2e/support/stub-supabase.mjs` and `e2e/support/account.ts` (helpers: `seed(page, data)`, `signIn(context)`).
- Modify `playwright.config.ts`.
- Test `e2e/goals-account.spec.ts` (first tests).

**Interfaces:**
- The stub listens on `STUB_SUPABASE_PORT` (3198) and holds tables in memory:
  - `GET /health`.
  - `POST /__seed` (body: `{ user: {id,email}, tables: {goals, steps, sessions, session_steps, session_lines} }`, which replaces all data).
  - `GET /__tables`, so tests can assert writes.
  - `GET /auth/v1/user` returns the seeded user when `Authorization: Bearer stub-access-token`, else 401.
  - `GET|PATCH|POST|DELETE /rest/v1/<table>` supports the `select`, `eq.`, `in.(…)`, `order` and `limit` query parameters. `Accept: application/vnd.pgrst.object+json` returns one object (406 when none). PATCH merges the JSON body into the matching rows.
- `playwright.config.ts`: `appEnv.NEXT_PUBLIC_SUPABASE_URL` becomes `http://127.0.0.1:3198` (the stub) for every project. This is one build, and `NEXT_PUBLIC_*` values are fixed at build time. A signed-out visitor still has no session, so the existing redirect tests keep their meaning. The stub joins `webServer`.
- `signIn(context)` sets the `@supabase/ssr` session cookie `sb-127-auth-token` for `127.0.0.1` to `base64-` plus the base64url of `{access_token:"stub-access-token", refresh_token:"stub", token_type:"bearer", expires_in:3600, expires_at:<now+3600>, user:{id,email,aud:"authenticated"}}`. The builder confirms the cookie name and format against `@supabase/ssr` 0.12.7 in `node_modules` and fixes them here if they differ.

- [ ] **Step 1:** Write `goals-account.spec.ts` with `#73 a signed-in account opens /goals and sees its Goal titles` (seed two Goals and expect their titles).
- [ ] **Step 2:** `CI=1 npx playwright test e2e/goals-account.spec.ts` → FAIL (the stub is missing).
- [ ] **Step 3:** Implement the stub, the helpers and the config.
- [ ] **Step 4:** The same command PASSES with the current bare `/goals` list, and `CI=1 npm run test:e2e` still passes everywhere.
- [ ] **Step 5:** Commit `test: a test-only Supabase stub for signed-in e2e (#73)`.

### Task 4: `/goals` list screen (G1, G2b, G3, G5, G5-D, G6)

**Files:**
- Modify `src/app/goals/page.tsx`.
- Create `src/app/goals/goals-screen.tsx` (client), `src/app/goals/goal-sheets.tsx` (client: the Goal menu, the New goal sheet, the toast) and `src/app/goals/goal-row.tsx`.
- Modify `src/app/globals.css` (a Goals section).
- Test `e2e/goals-account.spec.ts`.

**Interfaces:**
- Consumes `goalsLists`, `parseTab`, `matchesSearch`, `SHOW_FIRST`, `startHref`, the actions, `readGoalsData` and `isPrototypeEnabled()` (as `sessionPagesEnabled`).
- `useLocalNow()` returns `null` on the server and during the first client render, and the current `Date` after mount. While it is null, the activity lines and dates are not drawn, which avoids hydration mismatches.
- Toast state `{ text, undo: { goalId, previous, parkedSessionId? } | null }`. It lasts 5 s and pauses on focus or hover. The texts are "Put on hold." / "Marked done." / "Back in progress." / "Reopened.". The failure texts are in the spec.

- [ ] **Step 1: Failing e2e tests** (390 × 800, seeded):
  - `#73 AC1 four tabs, the tab kept in the URL`
  - `#73 AC2 Ongoing then One-time, last used first`
  - `#73 AC3 a row shows the portrait, the title, "1 done today" and Continue, and never x of y`
  - `#73 AC4 Show more after five rows, with no number`
  - `#73 AC5 Continue opens /focus?goal=<id> with a full page load` (assert the link's href, and that it is a plain `<a>`)
  - `#79 AC1 AC4 the ⋯ menu puts a Goal on hold with a five-second Undo and no dialog` (checks the stub's tables before and after Undo)
  - `#79 AC2 On hold shows Resume, and Resume reopens the parked session`
  - `#79 AC3 Mark done moves the Goal to Done`
  - `#79 AC5 Reopen moves it back to In progress`
  - `#80 AC1 AC2 AC4 AC5 History rows: date, minutes, done Steps; sessions without a done Step are absent; no totals`
  - `#77 AC1 New goal opens one input and one arrow, with no pickers`
  - `#77 AC2 the arrow opens /goal?line=… and the draft is kept after Close`
  - `#73 search filters rows and history`
  - the empty texts per tab
  - Review Focus 3: Undo after 5 s is gone and Undo cannot be sent twice.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement, with the styles from the prototype CSS in the spec (`.tabs`, `.grow-r`, `.grow-t`, `.chip-f`, `.histl`, the sheet, the toast) mapped to tokens.
- [ ] **Step 4:** Run this spec plus `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: Goals page with tabs, menu, Undo, New goal and History (#73, #77, #79, #80)`.

### Task 5: `/goals/[id]` detail (G4, G4-N, G4-H, Done)

**Files:**
- Create `src/app/goals/[id]/page.tsx` and `src/app/goals/[id]/goal-detail-screen.tsx`.
- Modify `globals.css`.
- Test `e2e/goals-account.spec.ts`.

- [ ] **Step 1: Failing e2e tests:**
  - `#78 AC1 the detail shows the title field, "In progress · with Oppenheimer", the Type chips, the Steps and Continue`
  - `#78 AC2 #39 AC2 each Step shows its title and description; tapping one says "Complete steps in your session."; nothing can be added or removed`
  - `#78 AC3 nothing open: "Nothing open right now." and Start`
  - `#78 AC4 on hold: Resume, Steps exactly as left`
  - `#78 AC5 no total minutes, no Step x of N, no last-active date`
  - `#77 AC4 the type chip saves Ongoing`
  - `#78 renaming saves on blur; an empty field brings the old title back; crisis words open the safety page` (Review Focus 4)
  - `#79 AC1 the footer puts on hold and marks done with Undo`
  - `#80 recent sessions: three rows and See all`
  - Review Focus 5: `/goals/<other account's id>` and `/goals/not-a-uuid` → 404
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Back goes to `/goals?tab=<the Goal's tab>`.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: Goal detail with read-only Steps (#78, #39, #79)`.

### Task 6: `/goal?line=` starts the dialogue with the line

**Files:**
- Modify `src/app/goal/page.tsx` and `src/app/try/goal/goal-dialogue.tsx` (prop only).
- Test `tests/goals-view.test.ts` (`parseLine` is already covered) and `e2e/goals-account.spec.ts`.

- [ ] **Step 1:** Failing e2e test `#77 AC2 /goal?line=… opens the dialogue with the line in the composer, and the safety gate still runs on Send`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Add `initialDraft?: string` (it seeds `useState(initialDraft ?? "")`), and have the page pass `parseLine(searchParams.line)`.
- [ ] **Step 4:** PASS, and `e2e/try-goal-dialogue.spec.ts` and `e2e/goal-account.spec.ts` are unchanged and passing.
- [ ] **Step 5:** Commit `feat: /goal?line= starts the goal dialogue with that line (#77)`.

### Task 7: Screenshots, docs, full verification

**Files:**
- Create `scripts/design/capture-goals.mjs` (uses the stub and `signIn`) and `docs/design/prototype/pr-goals/README.md` with the composed pictures.
- Modify `docs/architecture.md` (Goals rows), `docs/api/README.md` (the four actions) and `docs/memory/known-issues.md` (the migration has to be applied).
- Reuse `scripts/design/compose-compare.mjs` with a mapping for g1, g3, g4, g4-n, g4-h, g5, g5-d, g6 (day = light, night = dark).

- [ ] **Step 1:** Capture before and after in light and dark with the stub seeded like the prototype's data: "Methods section for Friday" (one-time, in progress, 1 done today), "IELTS listening, section 3" (ongoing, no Steps, 2 done this week), "Portfolio case study" (on hold) and "Lab report" (done). Compose the pictures, look at each one, and fix real differences.
- [ ] **Step 2:** Run `npm test`, `CI=1 npm run test:e2e`, `npm run lint` and `npm run format:check`; all must pass.
- [ ] **Step 3:** Commit `docs: Goals area comparison with prototype v4 (#73)`.

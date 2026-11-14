# Home and the Companions list Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Signed-in Home (HOME-0, HOME-1 with HOME-MENU, HOME-NONE) and the Companions list (COMP) built from the account and matching prototype v4.

**Architecture:** Server pages read the account with `createSupabaseProgressStore`; a pure `homeView(progress)` picks the Home state; small client components handle the Goal options sheet, the Undo toast and Companion selection; a server action changes a Goal's status (and its open session) through the user's own Supabase client.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Supabase, Vitest (`renderToStaticMarkup` for screen tests), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-14-home-companions-design.md`

## Global Constraints
- Tokens only (`src/app/tokens.css`); no hard-coded colours, fonts or spacing. Controls follow DESIGN.md section 6 (paper-tag buttons, sheet 6.7, toast 6.8).
- Product words Companion, Goal, Step; English only; no counts, percentages, "started N days ago", "away for", streaks or totals on Home.
- Do not change the goal dialogue, focus, rest, account screens, summary, Life Path or `src/app/continue-link.tsx`.
- Links to `/goal` and `/focus` appear only when `isPrototypeEnabled()` is true.
- Existing file checks stay true: `src/app/page.tsx` or `src/app/protected-home.tsx` contains `<h1`; `protected-home.tsx` and `companions/page.tsx` contain `app-screen`; `companions/page.tsx` contains `<h1`; `page.tsx` contains `isPrototypeEnabled()`.

## Review Focus
1. A Goal with Steps but no session yet (Start pressed, focus never opened): the card shows Step 1, no slip, Continue still works. Test in Task 2.
2. An account whose only Goals are on hold: HOME-NONE without Quick Replay or carried line, never HOME-0. Test in Task 2.
3. Undo after the page has refreshed: restores the Goal to `in_progress` and the session to `open`, and never opens a second session for that Goal. Test in Task 3.
4. A `setGoalStatus` call for another account's Goal, an unknown id or an invalid status does nothing. Test in Task 3.
5. Moriarty selected: Enter stays disabled with the visible reason; keyboard selection works (radio group). Test in Task 5.

---

### Task 1: Companion data and Moriarty's portrait

**Files:**
- Create: `src/content/companions.ts`, `public/companions/moriarty.png` (extracted from the prototype's embedded `moriarty` image)
- Test: `tests/home-companions.test.ts`

**Interfaces:**
- Produces: `type Companion = { id: "oppenheimer" | "moriarty"; name: string; shortName: string; tags: string; line: string; portrait: string; enterHref: string | null }` and `COMPANIONS: Companion[]`, `companionById(id: string): Companion` (unknown id gives Oppenheimer).

- [ ] Step 1: failing test `companions list holds Oppenheimer and Moriarty only` — ids `["oppenheimer","moriarty"]`; Oppenheimer name "J. Robert Oppenheimer", tags "Brilliant · Eloquent · Haunted", `enterHref` "/companions/oppenheimer"; Moriarty name "Professor Moriarty", tags "Analytical · Enigmatic · Defiant", line "The only way to defeat the devil is to become one yourself.", `enterHref` null; each portrait file exists under `public/`.
- [ ] Step 2: run `npx vitest run tests/home-companions.test.ts` → FAIL (module missing).
- [ ] Step 3: implement; extract the portrait with a one-off script (not committed).
- [ ] Step 4: run → PASS. Commit `feat: companion data for Home and the Companions list (#268)`.

### Task 2: `homeView`

**Files:**
- Create: `src/lib/home/home-view.ts`
- Test: `tests/home-view.test.ts`

**Interfaces:**
- Consumes: `AccountProgress` (`src/lib/progress/account-progress.ts`; `ProgressGoal.createdAt?` already exists), `companionById`.
- Produces:
```ts
type HomeGoalCard = { goalId: string; title: string; companion: string; stepLabel: string; line: string | null; status: "in_progress" };
type HomeView =
  | { kind: "first" }
  | { kind: "goal"; card: HomeGoalCard; companions: string[]; inProgress: { goalId: string; title: string; companion: string }[] }
  | { kind: "none"; carriedLine: string | null; replay: { goalId: string; title: string }[]; companions: string[] };
function homeView(progress: AccountProgress): HomeView;
```
`companions` are Companion ids. Activity of a Goal = newest of its sessions' `openedAt`, `doneAt`, line `shownAt`, else `createdAt`, else "".

- [ ] Step 1: failing tests, one `it` each:
  - `first visit only when the account has no Goal` (no goals → first; one done goal → none, never first).
  - `the card is the most recently active in-progress Goal` (two in_progress goals; the one with the newer `shownAt` wins; `inProgress` lists both, newest first).
  - `where you left it is the first Step not done in the open session` (`stepLabel` "Step 2: Draft"; one-Step Plan gives "Only"; no session gives "Step 1: Outline").
  - `his line is the newest shown card of the open session` (story_card newer than background wins; pause_message and return_popup ignored; no lines → null).
  - `nothing in progress shows the carried line and Quick Replay` (`closing` line of the newest completed session; up to 3 done goals newest first; on-hold-only account → `replay` [] and `carriedLine` null).
  - `My Companions lists companions with a non-restarted session` (restarted only → []).
- [ ] Step 2: run → FAIL. Step 3: implement. Step 4: run → PASS. Commit `feat: pick the Home state from the account (#268)`.

### Task 3: Put on hold, Mark done and Undo

**Files:**
- Create: `src/lib/home/goal-status.ts`, `src/lib/home/supabase-goal-status.ts`, `src/app/home-actions.ts`
- Test: `tests/goal-status.test.ts`

**Interfaces:**
- Produces:
```ts
type GoalStatusWriter = {
  goalStatus(goalId: string): Promise<ProgressGoal["status"] | null>;   // null: not this account's
  setGoal(goalId: string, status: ProgressGoal["status"]): Promise<void>;
  sessionIn(goalId: string, state: "open" | "on_hold"): Promise<string | null>; // newest
  setSession(sessionId: string, state: "open" | "on_hold"): Promise<void>;
};
type SetGoalStatusOutcome = { status: "ok"; previous: ProgressGoal["status"] } | { status: "failed" };
function setGoalStatus(input: unknown, deps: { userId: string | null; writer: GoalStatusWriter }): Promise<SetGoalStatusOutcome>;
// server action
export async function setGoalStatusAction(input: unknown): Promise<SetGoalStatusOutcome>;
```
Rules: input `{ goalId: uuid, status: "on_hold" | "done" | "in_progress" }`. `on_hold`/`done`: set the Goal, then the newest `open` session to `on_hold`. `in_progress` (Undo): set the Goal, then the newest `on_hold` session to `open` only when the Goal has no `open` session.

- [ ] Step 1: failing tests with an in-memory writer: `put on hold sets the Goal and parks its open session`, `mark done does the same with done`, `undo restores in_progress and reopens the parked session once` (second Undo opens nothing new), `refuses a signed-out user, another account's Goal, a bad id and a bad status` (writer never called).
- [ ] Step 2: run → FAIL. Step 3: implement the rules, the Supabase writer (`goals` and `sessions` updates through the user's client, row-level security) and the action (`isPrototypeEnabled()` not required: Home exists in every build). Step 4: run → PASS. Commit `feat: put a Goal on hold or mark it done from Home, with Undo (#268)`.

### Task 4: Home screens

**Files:**
- Modify: `src/app/page.tsx`, `src/app/protected-home.tsx`, `src/app/globals.css`, `tests/continue-link.test.ts` ("shows on Home" case only, rewritten to the new props)
- Create: `src/app/home-goal-options.tsx` (client: ⋯, sheet, toast)
- Test: `tests/home-screen.test.ts`

**Interfaces:**
- Consumes: `homeView`, `continueHref`/`ContinueLink`, `setGoalStatusAction`, `COMPANIONS`.
- Produces: `ProtectedHome({ view: HomeView; continueHref: string | null; sessionPagesEnabled: boolean })`.

- [ ] Step 1: failing render tests:
  - `HOME-0 shows one card and nothing else` — text "Let's launch your first wave.", link "Choose a Companion" to `/companions`; no "At your desk", no `<img`, no "Quick Replay", no "My Companions".
  - `HOME-1 shows the Goal card` — "Goal · with Oppenheimer" (overline), title, "Where you left it", step label, his line inside the slip, `href="/focus?goal=…">Continue</a>` exactly once, "Start something else" to `/goal`, a button named "Goal options"; sections "My Companions" and "In progress".
  - `HOME-1 hides the session links when the test-build switch is off` — no Continue, no "Start something else".
  - `HOME-NONE shows the trace` — portrait, carried line, "New session" to `/goal`, chips under "Quick Replay"; no chips and no line when empty; no "welcome back".
  - `Home never shows counts or sample data` — rendered HTML of each state has no `/\d+%|\d+ of \d+|days ago|away for|streak/i`.
- [ ] Step 2: run → FAIL. Step 3: implement the screens and CSS (prototype v4 values via tokens; sheet per DESIGN 6.7 with focus trap, Esc, focus return; toast per 6.8, 5 s, pauses on focus/hover; Undo calls the action with the previous status, then `router.refresh()`). Step 4: run → PASS (also `tests/app-shell.test.ts`, `tests/installable-pwa.test.ts`, `tests/continue-link.test.ts`). Commit `feat: Home from the account, as in prototype v4 (#268)`.

### Task 5: Companions list

**Files:**
- Modify: `src/app/companions/page.tsx`, `src/app/globals.css`, `tests/summary-routes.test.ts` (#258 AC7 line only: the Life Path link now comes from `COMPANIONS`)
- Create: `src/app/companions/companions-list.tsx` (client)
- Test: `tests/home-companions.test.ts` (add)

- [ ] Step 1: failing tests: `Companions shows title, subtitle and one radio per companion` ("Companions", "Choose who sits at the desk with you.", `role="radiogroup"`, two `role="radio"`, Enter disabled); `Enter on Oppenheimer opens his Life Path` (selection helper `enterFor("oppenheimer")` → "/companions/oppenheimer"); `Moriarty keeps Enter disabled with a visible reason` (`enterFor("moriarty")` → null, reason text "His stories are not ready yet.").
- [ ] Step 2: FAIL. Step 3: implement (`enterFor(id)` exported from `companions-list.tsx`; arrow keys move selection; no "last observed", no animation). Step 4: PASS. Commit `feat: Companions list with select-then-Enter (#268)`.

### Task 6: Check, compare, document

- [ ] Run `npm test`, `npm run lint`, `npm run format:check`, `npm run test:e2e`; read the output.
- [ ] Visual comparison: a temporary, uncommitted page under `/try/` renders each Home state and COMP with fixture data; capture 390 px day and night; put next to `home-0`, `home-1`, `home-menu`, `home-none`, `comp` references; fix real differences, list intentional ones; delete the page.
- [ ] Docs: `docs/architecture.md` (Home, Companions rows), `docs/api/README.md` (`setGoalStatusAction`, `homeView`).
- [ ] Merge origin/main, open the PR (closes #268; lists #96, #97 and #271 as left), comment the link on #268.

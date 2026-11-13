# Start creates the Goal and the Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in `/goal` dialogue (preview builds only) whose Start saves the Goal and its Steps on the account. The time question becomes a slider from 0 to 3 hours on both `/try/goal` and `/goal`.

**Architecture:** The save rules live in a pure function, `startGoal`, behind a small `GoalWriter` port. A Supabase adapter implements the port with the user's own client, so row-level security applies. `/goal` reuses the `GoalDialogue` component, which takes its split and start actions as props. `/try` keeps the browser-only behaviour.

**Tech Stack:** Next.js 16 App Router (server actions), React 19, Supabase JS, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-13-start-creates-goal-design.md`

## Global Constraints

- No new dependency and no migration. Tokens only in CSS. English only. Use the words Goal and Step (X1).
- `/try` never reads or writes account data.
- No goal text in the logs. No stored text shown on failure (NO-BACKUP, FAIL-SCREEN).
- Do not change: `src/lib/model-gateway/`, `src/app/try/focus/`, `src/app/try/rest/`, or the layout of the GD and F1 screens beyond the time control.
- Before the pull request: `npm test`, `CI=1 npm run test:e2e`, `npm run lint`, `npm run format:check`. Revert `AGENTS.md` and `next-env.d.ts` if `next dev` rewrote them.

## Review Focus

1. Pressing Start twice quickly must not create two Goals: the same `goalId` updates the one Goal.
2. A Goal must never be left without Steps after a failure: the first save deletes the Goal it created, and a later Start repairs it.
3. A crisis typed into a Step title or description (not only the goal) must save nothing.
4. Minutes that are not whole numbers, or below 1, must be rejected, not rounded.
5. Keyboard users must be able to move the slider (native range input), and its value must be read aloud as words (`aria-valuetext`).

---

### Task 1: `startGoal` save rules

**Files:**
- Create: `src/lib/goals/start-goal.ts`
- Test: `tests/start-goal.test.ts`

**Interfaces:**
- Produces:
  - `type StartGoalInput = { goalId: string; goalText: string; title: string; splitFiner: boolean | null; steps: { title: string; description: string; minutes: number }[] }`
  - `type GoalRow = { id: string; user_id: string; title: string; text: string; shape: "specific" | "vague" | "big"; split_finer: boolean | null; total_minutes: number; status: "in_progress" }`
  - `type StepRow = { goal_id: string; position: number; title: string; description: string | null; minutes: number }`
  - `type GoalWriter = { goalExists(id: string): Promise<boolean>; insertGoal(row: GoalRow): Promise<void>; updateGoal(row: GoalRow): Promise<void>; replaceSteps(goalId: string, rows: StepRow[]): Promise<void>; deleteGoal(id: string): Promise<void> }`
  - `type StartGoalOutcome = { status: "saved"; goalId: string; steps: { title: string; description: string; minutes: number }[] } | { status: "signed-out" | "crisis" | "invalid" | "failed" }`
  - `startGoal(input: StartGoalInput, deps: { userId: string | null; writer: GoalWriter }): Promise<StartGoalOutcome>`

- [ ] **Step 1: Write failing tests** with an in-memory `GoalWriter` (a `Map` of goals and steps, plus an option to throw in `replaceSteps`):
  - `#32 AC3 drops Steps whose name is empty after trimming`: three Steps, one titled `"  "`. Saved has 2 Steps at positions 0 and 1; the outcome's `steps` has 2.
  - `#32 AC4 keeps names, descriptions and minutes as given`: minutes `7` and `53` are stored as 7 and 53. `total_minutes` is 60. An empty description is stored as `null`.
  - `#32 AC4 rejects minutes that are not whole numbers of at least 1`: `0`, `-5`, `2.5` and `NaN` each give `invalid`, and nothing is written.
  - `#32 AC2 creates one in_progress Goal for the signed-in user`: `user_id` is the user, `status` is `"in_progress"`, `title` is the input title, `text` is the goal text, and `shape` is `classifyGoalShape(goalText)`.
  - `#32 AC2 a second Start with the same goalId keeps one Goal and replaces its Steps`: call twice, the second time with one Step renamed. There is one Goal, and the Steps equal the second call's.
  - `#32 a Goal left without Steps is repaired by the next Start`: the Goal exists with no Steps; the call saves the Steps.
  - `#32 a failed Steps write on the first save deletes the new Goal`: `replaceSteps` throws. The outcome is `failed` and the goals map is empty.
  - `#32 a crisis in the goal or in any Step saves nothing`: goal `"I want to kill myself"` gives `crisis`. A Step description containing it also gives `crisis`. No writes in either case.
  - `#32 signed out saves nothing`: `userId: null` gives `signed-out`.
  - `#32 no Steps left gives invalid`: every title is empty.
- [ ] **Step 2:** Run `npx vitest run tests/start-goal.test.ts`. Expected: FAIL (the module is not found).
- [ ] **Step 3:** Implement `startGoal`. Check order: signed-out; then the safety gate (`gateFreeText` on the goal text and on each Step's `title\ndescription`, before trimming); then drop empty Steps; then check minutes (`Number.isInteger(m) && m >= 1`) and require at least 1 Step (otherwise `invalid`); then the writes. If `goalExists`, call `updateGoal` and then `replaceSteps`. Otherwise call `insertGoal` and then `replaceSteps`; if `replaceSteps` throws, try `deleteGoal` (ignore its error) and return `failed`. Any other writer error returns `failed`. Never log the text.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit `feat: startGoal saves the Goal and its Steps (#32)`.

### Task 2: Supabase `GoalWriter`

**Files:**
- Create: `src/lib/goals/supabase-goal-writer.ts`
- Test: `tests/start-goal.test.ts` (new `describe`)

**Interfaces:**
- Consumes: `GoalWriter`, `GoalRow`, `StepRow` from Task 1.
- Produces: `createSupabaseGoalWriter(client: Pick<SupabaseClient, "from">): GoalWriter`

- [ ] **Step 1: Failing test** with a recording fake `from()` that supports chains (`select().eq().maybeSingle()`, `insert()`, `update().eq()`, `delete().eq()`), returns `{ data, error }`, and records `[table, op, args]`:
  - `goalExists` reads `goals` by `id`.
  - `insertGoal` inserts into `goals`.
  - `replaceSteps` deletes `steps` where `goal_id` matches, then inserts the rows.
  - `deleteGoal` deletes from `goals` by `id`.
  - An `error` returned on any call makes the method throw.
- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3:** Implement the adapter. Throw `new Error("goal write failed")` with no row data.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 3: Time slider (both dialogues)

**Files:**
- Modify: `src/lib/prototype/goal-time.ts` (add exports), `src/app/try/goal/goal-dialogue.tsx` (time phase), `src/app/globals.css` (slider style, tokens only)
- Test: `tests/try-goal-dialogue.test.ts` (new `describe`), `e2e/try-goal-dialogue.spec.ts`

**Interfaces:**
- Produces:
  - `SLIDER_MAX_MINUTES = 180`
  - `SLIDER_STEP_MINUTES = 5`
  - `sliderStart(understood: number | null): number` (0 when null; otherwise `min(understood, 180)`)
  - `sliderValueText(minutes: number): string` (`"No time chosen"` at 0; otherwise `formatMinutes`)
  - `SLIDER_ZERO_HINT = "Choose a time above 0"`

- [ ] **Step 1: Failing unit tests** (`TIME-SLIDER the time slider runs from 0 to 3 hours`): the constants; `sliderStart(null) === 0`; `sliderStart(60) === 60`; `sliderStart(240) === 180`; `sliderValueText(0)`; `sliderValueText(75) === "1 hour 15 min"`.
- [ ] **Step 2: Change the e2e tests on purpose** (each one is listed in the pull request). Add a helper `setTime(page, minutes)` that fills `getByRole("slider", { name: "Your time" })` and clicks Send.
  - Walk-through: instead of the four quick replies and "no slider", expect a slider with `min="0"`, `max="180"` and `step="5"`, plus "Not sure". Expect no "30 min", "1 hour" or "2 hours" button and no `Your time` textbox. Send is disabled at 0 and "Choose a time above 0" is visible. Then `setTime(60)`.
  - `#33 AC2`, `#37`: `setTime(60)` replaces the "1 hour" click.
  - `#35 AC1` (typed time) becomes `TIME-SLIDER any time from 5 minutes to 3 hours`: `setTime(95)` gives a Plan "1 hour 35 min". The test-data splitter must accept non-multiples of 15. Check `test-splitter.ts`; if it cannot, use 90 and record a ruling.
  - `GOAL-TIME` change test: after "Change time", the slider's value is `60`; `setTime(120)` gives "· 2 hours".
- [ ] **Step 3:** Run `npx vitest run tests/try-goal-dialogue.test.ts`. Expected: FAIL. Run `CI=1 npx playwright test e2e/try-goal-dialogue.spec.ts`. Expected: FAIL on the slider tests.
- [ ] **Step 4:** Implement the time phase. Remove `QUICK_TIMES`, the typed-time form and its hint state from the time phase. Add a form with `<input type="range" aria-label="Your time" min max step aria-valuetext>`, an `<output>` showing `sliderValueText`, the `SendButton` (disabled at 0), and the zero hint as text. Keep "Not sure" (hidden when understood, as today) and "Just split it". Send calls `chooseTime(value, formatMinutes(value))`. The slider starts at `sliderStart(timeMode understood or changed ? minutes : null)`. Leave `parseTypedTime` and its unit tests alone; they are not deleted, only unused by the page. CSS class `try-time-slider` with full width, `accent-color: var(--control)` and the minimum height `var(--target)`.
- [ ] **Step 5:** Run both commands. Expected: PASS.
- [ ] **Step 6:** Commit `feat: the time question is a slider from 0 to 3 hours (#32)`.

### Task 4: `/goal` route, actions and dialogue props

**Files:**
- Modify: `src/lib/prototype/config.ts` (add `isGoalPath(pathname)` and `goalPathIsHidden(pathname, enabled)`), `src/proxy.ts` (404 for either hidden path), `src/app/try/session-paths.ts` (`/goal` is a session path, so it gets the Oppenheimer skin), `src/app/try/goal/goal-dialogue.tsx` (props, goal id, save failure)
- Create: `src/app/goal/page.tsx`, `src/app/goal/layout.tsx` (uses `TryFrame`), `src/app/goal/actions.ts`
- Test: `tests/prototype-path.test.ts` (or a new `tests/start-goal-route.test.ts`), `e2e/goal-account.spec.ts`

**Interfaces:**
- Consumes: `startGoal` and `createSupabaseGoalWriter` (Tasks 1 and 2); `splitGoal` (existing).
- Produces:
  - `startGoalAction(input: StartGoalInput): Promise<StartGoalOutcome>` and `splitGoalForAccountAction(input: SplitInput): Promise<SplitOutcome>` in `src/app/goal/actions.ts`. Both return failure or `signed-out` when the switch is off or there is no user. The split uses the cost-cap cookie with path `/goal`.
  - `GoalDialogue` props: `{ split?: (input: SplitInput) => Promise<SplitOutcome>; start?: (input: StartGoalInput) => Promise<StartGoalOutcome> }`. The defaults are the `/try` split and no account save.

- [ ] **Step 1: Failing tests:**
  - Unit `#32 /goal exists only when the test path is on`: `goalPathIsHidden("/goal", false) === true`, `goalPathIsHidden("/goal", true) === false`, `goalPathIsHidden("/goals", false) === false`; `isSessionPath("/goal") === true`.
  - Unit `#32 AC6 /try never imports the account save`: no file under `src/app/try/` contains `@/lib/goals` or `app/goal/actions`, read with `fs` over the folder.
  - Unit `#32 the account actions require a user`: read `src/app/goal/actions.ts` and check it calls `getCurrentUser` and `isPrototypeEnabled`.
  - e2e `#32 /goal sends a signed-out visitor to sign in`: `page.goto("/goal")` ends at `/auth/sign-in`.
  - Unit `#32 AC1 the clock waits for his first card`, against `src/lib/prototype/session.ts`: after `syncSession`, the Step's `clock` is `null`; after `setStepCards`, the clock exists. This is existing behaviour, pinned for this criterion; it is expected to pass at once.
- [ ] **Step 2:** Run them. Expected: FAIL, except the AC1 test.
- [ ] **Step 3:** Implement:
  - The config functions and the proxy check.
  - The session path.
  - The layout and page. The page awaits `connection()`; calls `notFound()` when the switch is off; redirects to `/auth/sign-in` without a user; renders `<GoalDialogue split={splitGoalForAccountAction} start={startGoalAction} />`.
  - The actions, which use `createSupabaseServerClient` and `getCurrentUser`.
  - In `GoalDialogue`: `goalId` state is set with `crypto.randomUUID()` whenever a split produces a Plan (including Use one step). When `start` is given, `onStart` awaits it with `{ goalId, goalText: goal, title: planTitle || goal, splitFiner, steps: saved }`:
    - `saved`: write the browser store as today with the server's `steps`, then push `/try/focus`;
    - `crisis`: `openCrisis("plan")`;
    - `signed-out`: push `/auth/sign-in`;
    - `failed` or `invalid`: show `<div role="alert">` "Your Goal was not saved. Please try again." with a Retry button that calls `onStart` again (system voice, no slip). Start is disabled while saving.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat: /goal saves the Goal and Plan on Start (#32)`.

### Task 5: Docs

**Files:** `docs/DECISIONS.md` (row `TIME-SLIDER` in "Decisions of 2026-11-12", citing `_handoff/2026-11-12-spec-audit/01_DECISIONS_FROM_YUE_2026-11-12.md`); `docs/USER_STORIES.md` (US-GD-15 criteria as corrected in issue #32; #35's "no time slider" line marked superseded by TIME-SLIDER); `docs/FLOW.md` GD2 (slider instead of quick replies and the typed box); `docs/architecture.md` (rows for `/goal` and `src/lib/goals/`); `docs/decisions/0012-try-goal-dialogue-split.md` (consequence: #32 is done for `/goal`).

- [ ] **Step 1:** Make the edits. Check `npx prettier --check` on the files that are not ignored.
- [ ] **Step 2:** Commit `docs: TIME-SLIDER, US-GD-15 criteria and /goal (#32)`.

### Task 6: Verify and open the pull request

- [ ] Run the full suite, e2e, lint and format check. Merge `origin/main`. Then a final review on Opus. Push, open the PR with the list of changed tests, comment on the issue, and wait for the checks.

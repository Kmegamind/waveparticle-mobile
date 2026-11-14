# Summary, closing line and Life Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Signed-in END (`/end`), a live closing line plus carried line, saving the finished run on the account, and the Life Path `/companions/oppenheimer` with the current Story card and Begin (issue #258).

**Architecture:** Pure libraries in `src/lib/summary/` take the store, the gateway and the time as arguments; thin server actions and pages call them. The browser run is matched to the account Goal by its Plan (design, approach 1). The gateway gets one new call, `writeClosingLine`, that uses the existing line checks.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase through `ProgressStore`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-13-summary-life-path-design.md`

## Global Constraints

- Do not change `src/app/try/focus/*`, `src/app/try/rest/*`, `src/app/try/goal/*` or `src/app/goal/*`.
- NO-BACKUP: no stored or authored line from him on END or on the current card. A failure shows `He is not here right now. Please try again.` with Retry.
- No new check rule. The closing kind uses the existing default length branch (at most 3 sentences, 40 words) and the existing rules.
- No user text in the closing prompt: no Goal, no Step titles or descriptions.
- No verdict, score, percentage, "3/3", Step count or pause count on END or on the Life Path.
- Tokens only (`DESIGN.md`); session skin through `TryFrame`; END has no tab bar; the Life Path has the tab bar.
- English only. Product words: Goal, Step, Companion.

## Review Focus

1. Reloading `/end` after a saved run: the same lines appear and no second model call or second session is made (Task 3 test `reuses the stored lines for a Goal that is already finished`).
2. A malformed or oversized `finishRun` input (the action is a public endpoint) is refused (Task 3 test `refuses malformed input`).
3. Two in-progress Goals with the same Steps: the newest one is chosen. The Goal table has no `created_at` in `ProgressGoal`, so the last one in the read order wins (Task 3 test `picks the last matching Goal`).
4. The model is not configured: END shows the failure message, never test data (Task 3 test `fails without a gateway`).
5. The Life Path for an account with a completed chapter-8 run but no chapter 1: chapter 8 shows as finished, and chapter 1 stays current (Task 4 test `current is the first story without a completion`).

---

### Task 1: The closing call in the model gateway

**Files:** Modify `src/lib/model-gateway/{types,gateway,index}.ts`. Test: `tests/closing-line.test.ts`.

**Interfaces:**
- Produces: `ClosingLineInput = { facts: string; lastMoment: string; forbidTerms?: string[]; earlierLines?: string[] }`; `ClosingLineResult = { source: "generated"; closingLine: string; carryLine: string } | GatewayFailure`; `ModelGateway.writeClosingLine(input): Promise<ClosingLineResult>`; `CompanionKind` gains `"closing_line"`; `GatewayCall` gains `"closing_line"`.

- [ ] Step 1: Tests with a fake provider:
  - Accepts `{"closing_line":"I ...","carry_line":"I ..."}`.
  - Rejects and retries when either line breaks an existing rule ("you", a question, more than 40 words).
  - Rejects a carry line equal to the closing line (the run-list check with the closing line as an earlier line).
  - The prompt holds the facts and the last moment, says END-TONE (what happened to him that day and how he feels; no counts, no pauses, no judging), and holds no `{{`.
  - Failure after the attempts gives `{source:"failed"}`.
- [ ] Step 2: Run `npx vitest run tests/closing-line.test.ts`. Expected: FAIL (`writeClosingLine` missing).
- [ ] Step 3: Implement it with `run("closing_line", closingPrompt(input), acceptClosing)`. `acceptClosing` parses both keys, runs `checkCompanionLine(text, "closing_line", forbidTerms)` on each, then `checkRunList` against `earlierLines` (and, for the carry line, the closing line too).
- [ ] Step 4: Run the test. Expected: PASS. Then run `npm test`.
- [ ] Step 5: Commit `feat: the closing call in the model gateway (#258)`.

### Task 2: The browser run and focus time

**Files:** Create `src/lib/summary/run.ts`. Test: `tests/summary-run.test.ts`.

**Interfaces:**
- Consumes: `PrototypeState` (`store.ts`), `FocusSession` and `isFinished` (`session.ts`).
- Produces:
  - `FinishedRun = { storyId: string; steps: PrototypeStep[]; focusSeconds: number[]; earlierLines: string[] }`.
  - `finishedRun(plan: PrototypeState, session: FocusSession | null): FinishedRun | null`. It is null unless the session is finished and its `planKey` equals `planKey(plan)`. `storyId` defaults to `DEFAULT_STORY_ID`. `focusSeconds[i]` = `steps[i].clock?.elapsedBeforeRunMs / 1000` (0 without a clock). `earlierLines` = every card shown in the run, oldest first.
  - `planMinutesOf(steps): number`.
  - `focusLabel(totalSeconds): string`: `"Under 1 min"` below 30 s, otherwise `` `${Math.round(s/60)} min` ``.
  - `SUMMARY_KEY = "waveparticle.summary"`.
  - `loadSummaryRecord(storage, planKey)` and `saveSummaryRecord(storage, planKey, record)`, where the record is `{ runId: string; result?: FinishShown }`. Every storage call is wrapped in try/catch.
- [ ] Steps: test first (unfinished → null; another plan → null; focus seconds from the clocks; labels `Under 1 min`, `1 min`, `60 min`), run (FAIL), implement, run (PASS), commit `feat: read the finished run and its focus time (#258)`.

### Task 3: Finishing a run on the account

**Files:** Create `src/lib/summary/finish-run.ts`. Test: `tests/finish-run.test.ts`.

**Interfaces:**
- Consumes: `ProgressStore` and `createMemoryProgressStore`, `ModelGateway.writeClosingLine`, `generationInputs` and `isStoryId`, `startStory`, `oppenheimerStories`.
- Produces:
  - `FinishInput = { runId: string; storyId: string; steps: {title,description,minutes}[]; focusSeconds: number[]; earlierLines: string[] }`.
  - `normaliseFinishInput(raw: unknown): FinishInput | null`. It requires a uuid `runId`, a known story, 1 to 50 Steps within the `start-goal.ts` LIMITS, `focusSeconds` of the same length with each value between 0 and 86400, and `earlierLines` capped at 60 lines of 600 characters each.
  - `findGoalForPlan(progress, steps): ProgressGoal | null`. It looks only at `in_progress` Goals, compares Steps in position order (trimmed title, equal minutes, empty description = null), and returns the last match.
  - `closingInputFor(storyId, minutes: number[], earlierLines): ClosingLineInput`. `facts` = who, place, goal sentence and all facts of the Steps' shares. `lastMoment` = the facts of the last share. `forbidTerms` comes from `generationInputs`.
  - `FinishShown = { closingLine: string; carryLine: string; next: string | null }`.
  - `FinishOutcome = { status: "ok"; shown: FinishShown } | { status: "signed-out" | "invalid" | "no-goal" | "failed" }`.
  - `finishRun(raw: unknown, deps: { userId: string | null; store: ProgressStore; gateway: ModelGateway | null; nowIso: string }): Promise<FinishOutcome>`.
  - `nextStoryAfter(progressBefore, storyId): string | null`. It returns the story after `storyId` in order when `storyId` had no completed session before this run, else null; also null after the last story.
- Saving writes the full progress back with:
  - the Goal set to `done`;
  - a new session: id `runId`, state `completed`, `companionId` "oppenheimer", `storyId`, `closingLine`, `mergedKeyMoments` from `startStory`, `backgroundCard` null;
  - one `SessionStep` per Step with `doneAt` = `nowIso` (id = a uuid made from `crypto.randomUUID()`);
  - one `closing` line: the carry line, `source` "generated", seq 0, `sessionStepId` null, `pauseNumber` null.
  - The carry line of a finished Goal is read back from its `closing` line.
- [ ] Step 1: Tests (memory store, fake gateway):
  - `signed-out`.
  - `refuses malformed input` (bad uuid, unknown story, 51 Steps, a negative focus second).
  - `no-goal` without calling the gateway.
  - `fails without a gateway`, with nothing saved.
  - A gateway failure gives `failed` and saves nothing.
  - Success saves the completed session, the Goal as done and the carry line, and returns `next` = "tolman-lecture" for chapter 1.
  - `reuses the stored lines for a Goal that is already finished`: the gateway is not called again.
  - `picks the last matching Goal`.
  - The closing prompt input holds no Step title or Goal text.
  - `next` is null for the last story and for a story completed before.
- [ ] Step 2: Run. Expected: FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: Run. Expected: PASS. Then run `npm test`.
- [ ] Step 5: Commit `feat: save a finished run with its closing line (#258)`.

### Task 4: Life Path model and draft periods

**Files:** Create `src/content/oppenheimer/periods.ts` and `src/lib/summary/life-path.ts`. Test: `tests/life-path.test.ts`.

**Interfaces:**
- Produces:
  - `PERIOD_DRAFTS: { name: string; storyIds: string[] }[]`. The six prototype names, in order: `His youth`, `The Berkeley years`, `The Manhattan Project years`, `After the war`, `The hearings`, `His later years`. The prototype's PATH map: [0] chapter 1; [1] chapters 2 to 6; [2] chapters 7 to 18; [3] chapters 19 and 20; [4] chapters 21 to 25; [5] chapter 26.
  - `PERIOD_STATUS = "draft, not approved (PERIOD-NAMES)"`.
  - `LifePathRow = { id; title; state: "finished" | "current" | "later"; line: string | null }`. `line` is the stored closing line for finished rows, `goalShort` for the current row, and null for later rows.
  - `lifePath(progress): { periods: { name: string; rows: LifePathRow[] }[]; currentId: string | null }`.
- [ ] Step 1: Tests:
  - Every story is in exactly one period, and in story order.
  - New account: chapter 1 is current, and every other story is `later` with a null line.
  - `current is the first story without a completion`.
  - A finished row shows the stored closing line of its first completed session.
  - A restarted session does not count.
  - No row text contains a digit that is a date or age (no `\b1[89]\d\d\b`, no "age").
- [ ] Steps 2 to 5: run (FAIL), implement, run (PASS), commit `feat: the Life Path model with draft periods (#258)`.

### Task 5: Pages, routing and e2e

**Files:**
- Create:
  - `src/app/try/end/page.tsx`: signed in → `redirect("/end")`; otherwise the plain message and a link to `/try`.
  - `src/app/end/{layout.tsx,page.tsx,end-screen.tsx,actions.ts}`.
  - `src/app/companions/oppenheimer/{page.tsx,begin-button.tsx}`.
  - `e2e/summary-life-path.spec.ts`.
- Modify:
  - `src/app/try/session-paths.ts`: add `/end`.
  - `src/lib/prototype/config.ts` and `src/proxy.ts`: `/end` is hidden like `/goal`.
  - `src/app/companions/page.tsx`: a link "Oppenheimer" to the Life Path.
  - `src/app/globals.css`: END and Life Path styles from the prototype, using tokens.
  - Docs: `docs/architecture.md`, `docs/api/README.md`.
- END (client, `data-ready`):
  - It loads the Plan, the session and the summary record. With no finished run, it shows `There is no finished Step to sum up.` and a Home link.
  - Otherwise it makes or keeps the `runId` and calls `finishRunAction`.
  - While waiting it shows the Steps and the record.
  - On `ok` it shows the slips, the Steps and the record, then Next (`/companions/oppenheimer`, only when `next`) and Home (`/`).
  - On `failed` it shows the failure text with Retry.
  - On `no-goal` it shows `This Goal is not on your account.`
  - Its parts, top to bottom: the story title as an overline, the closing slip with tape, the carry slip with tape, a "Your Goal" line with the Goal title, a "Your steps" card with check marks, and a "Your record" card with `Plan length` and `Focus time`.
- Life Path (server, signed in, `‹ Back to Companions`):
  - The header shows the name "Oppenheimer" and the tags "Brilliant · Eloquent · Haunted".
  - Then the period headings with a note that the names are drafts (visually small, `--ink-2`).
  - Finished rows: solid dot, title and italic line.
  - Current row: a ring and a card with the title, the line and `BeginButton`.
  - Later rows: a dotted circle and the title.
- `BeginButton` (client): it saves `{...emptyPrototypeState(), storyId}` and clears the focus session and summary record, then runs `fullPageLoad("/goal")`. It renders only when `isPrototypeEnabled()`; otherwise a caption says the goal dialogue is in test builds only.
- [ ] Step 1: Failing tests:
  - Unit (`tests/summary-routes.test.ts`): `isSessionPath("/end")`; `endPathIsHidden("/end", false)`; `showsTabBar("/companions/oppenheimer")` and not `/end`; the END and Life Path sources contain no `"site-search"` and no `authoredCards` or `generated.json` import.
  - e2e: signed out, `/end` → `/auth/sign-in`; `/companions/oppenheimer` → `/auth/sign-in`; `/try/end` shows `There is no summary to show.`
- [ ] Step 2: Run. Expected: FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: Run `npm test`, `CI=1 npm run test:e2e`, `npm run lint` and `npm run format:check`. Expected: all pass.
- [ ] Step 5: Commit `feat: signed-in summary and Life Path pages (#258)`.

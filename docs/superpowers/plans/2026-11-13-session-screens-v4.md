# Session screens to prototype v4 (#263) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the goal dialogue (GD1 to GD4, the Step editor, the understood-time caption, the split-failed screen) and the focus page (F1 and its open Steps list) a 1:1 version of prototype v4, and make Step minutes free (#249).

**Architecture:** The two shared client components are restructured in place: `src/app/try/goal/goal-dialogue.tsx` (used by `/goal` and `/try/goal`) and `src/app/_session/focus-body.tsx` (used by `/focus` and `/try/focus`). Copy and rules live in `src/lib/prototype/{goal-lines,goal-time,plan-edit}.ts`. Styles go in `src/app/globals.css` with tokens and the #244 classes only.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, plain CSS custom properties, Vitest 5, Playwright 1.64.

**Spec:** `docs/superpowers/specs/2026-11-13-session-screens-v4-design.md` (read it; its "Decided" table holds every value and every line of copy).

## Global Constraints

- Tokens only in `globals.css`: `tests/design-tokens.test.ts` forbids hex and rgba there.
- Every control keeps a 44 by 44 px hit area; focus rings unchanged.
- No change under `src/lib/goals`, `src/lib/progress`, `src/lib/model-gateway`, server actions, `/auth`, `/end`, Life Path, `/rest`.
- English only; product words Companion, Goal, Step.
- Tests are named after the criterion they prove (`#234 AC1 …`). Existing tests changed on purpose are listed in the PR with the reason; none is deleted to make CI pass.
- Commits: Conventional Commits with `(#263)` and the Co-Authored-By trailer.

## Review Focus

1. A typed minutes value of "", "0", "-3", "2.5" or "abc" → keeps the last valid value (Task 1 test).
2. Typed minutes above 1440 and "+" at 1440 → capped, reason in words (Task 1 and Task 3 tests).
3. An emptied Goal field → Start saves the typed goal as the title (Task 1 test on `planTitleFor`; Task 3 e2e).
4. Crisis text typed in the Goal field → the safety page opens on Start (Task 3 e2e).
5. Long thread on a 390 by 800 screen → the dock stays pinned and the newest turn is visible (Task 2 e2e checks the dock's bottom edge is at the viewport bottom and the last slip is in view).

---

### Task 1: Lines and minute rules

**Files:**
- Modify: `src/lib/prototype/goal-lines.ts`, `src/lib/prototype/goal-time.ts`, `src/lib/prototype/plan-edit.ts`
- Test: `tests/try-goal-dialogue.test.ts`

**Interfaces (produces):**
- `goal-lines.ts`: `REACTIONS.specific[0] === "That has a clear edge to it."`; `NOT_SURE_LINE = "Then thirty minutes. Long enough to start, short enough to keep."`; `SPLIT_QUESTION = "Do you want it cut fine, or kept in a few broad pieces?"`; `PLAN_INTRO = "Here is how I would cut it. Argue with it now, in ink, where it’s cheap."`; `timeQuestionSlip(reaction: string): string` → `` `${reaction} ${TIME_QUESTION}` ``; `SPLIT_FAILED_TITLE = "That one wouldn’t split."`; `splitFailedLine(goal: string): string` → `` `Nothing is lost. Your words are kept: “${goal}”.` ``. Remove `TIME_ACKS` and `timeAck` (unused after Task 2).
- `goal-time.ts`: `minutesLabel(minutes: number): string` → `` `${minutes} min` ``.
- `plan-edit.ts`: `MINUTES_STEP = 5`, `MIN_MINUTES = 1`, `MAX_MINUTES = 1440`, `NEW_STEP_MINUTES = 15`, `MINUTES_FLOOR_HINT = "A Step is at least 1 minute."`, `MINUTES_CEILING_HINT = "A Step is at most 24 hours."`; `changeMinutes(steps, id, delta)` clamps to [1, 1440]; `setMinutes(steps, id, typed: string)` takes a whole number ≥ 1 (capped at 1440), else no change; `addStep(steps, afterId?: string)` inserts after `afterId` (or at the end) with 15 minutes; `countLine` uses `minutesLabel`; `planTitleFor(field: string, goal: string): string` → trimmed field, or the goal when empty.

- [ ] **Step 1: Update the tests**: change the existing expectations deliberately (NOT_SURE_LINE, countLine "1 step · 60 min", changeMinutes floor, addStep) and add:

```ts
it("#235 AC1 his reaction and the time question share one slip", () => {
  expect(timeQuestionSlip("That has a clear edge to it.")).toBe("That has a clear edge to it. How long do you have?");
  expect(REACTIONS.specific[0]).toBe("That has a clear edge to it.");
});
it("#236 AC1 time answers read N min", () => {
  expect(minutesLabel(60)).toBe("60 min");
  expect(minutesLabel(95)).toBe("95 min");
  expect(countLine(fromPlan([{ title: "A", description: "", minutes: 60 }]))).toBe("1 step · 60 min");
});
it("#249 AC1 minutes change by 5 and take any typed whole number from 1", () => {
  // start(): two Steps of 30 and 15
  let s = changeMinutes(start(), id0, 5); expect(s[0].minutes).toBe(35);
  for (const bad of ["", "0", "-3", "2.5", "abc"]) expect(setMinutes(s, id0, bad)[0].minutes).toBe(35);
  expect(setMinutes(s, id0, "7")[0].minutes).toBe(7);
  expect(setMinutes(s, id0, "2000")[0].minutes).toBe(1440);
});
it("#249 AC2 minutes never go below 1 or above 1440", () => {
  expect(changeMinutes(setMinutes(start(), id0, "3"), id0, -5)[0].minutes).toBe(1);
  expect(changeMinutes(setMinutes(start(), id0, "1438"), id0, 5)[0].minutes).toBe(1440);
});
it("#237 Add a step goes after the open Step with 15 minutes", () => {
  const added = addStep(start(), id0); expect(added.steps[1].id).toBe(added.id); expect(added.steps[1].minutes).toBe(15);
});
it("#237 AC1 an empty Goal field saves the typed goal", () => {
  expect(planTitleFor("  ", "Methods section for Friday")).toBe("Methods section for Friday");
  expect(planTitleFor(" Methods ", "x")).toBe("Methods");
});
```

- [ ] **Step 2:** `npx vitest run tests/try-goal-dialogue.test.ts` → FAIL (missing exports).
- [ ] **Step 3:** Implement the interfaces above.
- [ ] **Step 4:** `npx vitest run tests/try-goal-dialogue.test.ts` → PASS; `npx tsc --noEmit` shows only the expected errors in `goal-dialogue.tsx` (fixed in Task 2).
- [ ] **Step 5:** Commit `feat: prototype v4 lines and free Step minutes (#263, #249)` (together with Task 2 if tsc is red).

### Task 2: Dialogue frame, GD1, GD2, GD3

**Files:**
- Create: `src/app/_session/companion.ts` → `export const COMPANION = { name: "Oppenheimer", portrait: "/companions/oppenheimer.png" } as const;`
- Modify: `src/app/try/goal/goal-dialogue.tsx`, `src/app/globals.css`
- Test: `e2e/try-goal-dialogue.spec.ts` (new tests + deliberate changes), `e2e/session-screens-v4.spec.ts` (new, look checks)

**Interfaces:** consumes Task 1. Structure of `<main className="app-screen try-screen try-dialogue">`: `.try-dialogue-bar` (back, `.avatar` with `<img alt="">`, `.try-companion-name`), `.try-thread` (scrolls; `role="log"` not added, keep current semantics), `.try-dock` (pinned bottom). Slips get `.try-slip` (him, max-width 94 %), bubbles `.try-you` (restyled per spec).

- [ ] **Step 1: Write the failing e2e tests** in `e2e/session-screens-v4.spec.ts`, 390 by 800:
  - `#234 AC1 the header shows back, his portrait and his name`: `img` inside `.try-dialogue-bar` has width 40 and `getByText("Oppenheimer")` visible.
  - `#234 AC2 the composer sits at the bottom with a 52 px paper-tag Send`: placeholder "Say it in one line"; input border-radius "14px"; Send box 52×52; dock bottom within 24 px of 800; "Just split it" centred (|link centre − 195| < 4).
  - `#234 AC3 his slip leaves space on the right`: first `.try-slip` width < 330.
  - `#235 AC1 AC2 one slip, a surface bubble, controls at the bottom`: after sending "Methods section for Friday" the thread contains one slip matching `/How long do you have\?$/` preceded by a reaction in the same element; `.try-you` border-radius "16px 16px 4px"; slider and "Not sure" inside `.try-dock`; "Just split it" count 0.
  - `#236 AC1 AC2 the answer reads 60 min and the choices are chips at the bottom`: slider 60 → Send; `.try-you` last text "60 min"; slip "Do you want it cut fine, or kept in a few broad pieces?"; no "Then I will keep to the same span."; "Split it finer" and "Keep it broad" inside `.try-dock` with border-radius "12px".
  - `GOAL-TIME the understood time is a caption with Change`: goal "Write the methods for 45 minutes" → `role=status` text "Time I understood from your line: 45 min."; no reaction slip; `getByRole("button", { name: "Change time" })` visible with text "Change"; after it, the combined slip and the slider.
  - Review Focus 5: after reaching GD3, the dock's bottom ≥ 776 and the last slip `toBeInViewport()`.
- [ ] **Step 2:** `npx playwright test e2e/session-screens-v4.spec.ts` → FAIL.
- [ ] **Step 3:** Rebuild the JSX per the spec's Decided rows (header, thread, dock, composer, Send with right-arrow path `M5 12h14M13 6l6 6-6 6`, combined slip via `timeQuestionSlip`, no ack slip, "N min" bubble via `minutesLabel`, Not sure line, understood caption with "Change", GD3 chips, GD2 without "Just split it"; drop the `"changed"` TimeMode: Change sets the asked path). Scroll the thread to its end after each phase change (`scrollTop = scrollHeight`, no smooth scroll). Add CSS: `.try-dialogue` as a full-height flex column, `.try-thread` flex 1 / overflow auto, `.try-dock`, `.avatar`, `.try-chip` (12 px radius), `.try-you`, `.try-send` paper tag.
- [ ] **Step 4:** Update `e2e/try-goal-dialogue.spec.ts` deliberately: "1 hour" → "60 min" in the answer and count lines; `/Thirty minutes, then/` → `/Then thirty minutes/`; "Time: 1 hour" → the new caption; "Just split it" no longer expected on the time step. Keep each test's behaviour check.
- [ ] **Step 5:** `npx playwright test e2e/session-screens-v4.spec.ts e2e/try-goal-dialogue.spec.ts e2e/goal-account.spec.ts e2e/crisis-page.spec.ts e2e/shared-v4-styles.spec.ts` → PASS.
- [ ] **Step 6:** Commit `feat: goal dialogue frame, GD1 to GD3 as prototype v4 (#263)`.

### Task 3: GD4 plan card, Step editor, split failed

**Files:** Modify `src/app/try/goal/goal-dialogue.tsx`, `src/app/globals.css`; Test `e2e/session-screens-v4.spec.ts`, `e2e/try-goal-dialogue.spec.ts`.

**Interfaces:** consumes `setMinutes`, `changeMinutes`, `addStep(steps, afterId)`, `planTitleFor`, `minutesLabel`, `MIN/MAX_MINUTES`, the hints, `SPLIT_FAILED_TITLE`, `splitFailedLine`. New state `titleDraft: string` initialised on each split to `planTitle || goal`; Start sends `title: planTitleFor(titleDraft, goal)` and gates `titleDraft` with `gateFreeText` (crisis → `openCrisis("plan")`).

- [ ] **Step 1: Failing e2e tests:**
  - `#237 AC1 the card starts with YOUR STEPS and an editable Goal field`: group "Your steps"; `getByLabel("Goal")` value non-empty and 48 px high.
  - `#237 AC2 rows have a number, title, minutes and arrows; no descriptions`: first row text matches `/^1/`; minutes "30 min" in the mono family; `getByRole("button", { name: /^Move up: / }).first()` disabled, `/^Move down: /` last disabled; arrows' hit box ≥ 44×44; no description text in the card; clicking "Move down: <first>" swaps the first two titles.
  - `#237 AC3 Add a step and the count share a row; Split again is centred inside the card`.
  - `#237 AC4 Start is a full-width paper tag pinned at the bottom`: Start inside `.try-dock`, width ≥ 340, height 56.
  - `#237 AC5 his line before the plan` = PLAN_INTRO.
  - `#249 AC1 AC2 AC3 the editor takes 5-minute steps and typed minutes`: open a row → row shows "Editing"; "Five minutes more" → count up by 5 ("2 steps · 65 min"); type "1" in "Minutes" → "Five minutes fewer" `aria-disabled="true"` and "A Step is at least 1 minute." visible; "Done editing" closes; "Remove step" is a link-styled button absent with one Step.
  - Review Focus 3 and 4: empty the Goal field, Start (on `/try`) → focus page "Your goal" shows the typed goal; crisis text in the Goal field → safety page.
  - `GD-F the failed split reads That one wouldn’t split`: use the existing failure trigger in `e2e/try-goal-dialogue.spec.ts` (the test splitter's failure path; reuse whatever it uses) → heading and "Nothing is lost. Your words are kept: “…”.", "Try again", "Use one step", "Change my line" puts the goal back in the composer.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement per the spec rows "GD4 card", "GD4 rows", "GD4 footer", "Start", "Step editor (open)", "Minutes (#249)", "Add a step", "Split failed", "Splitting state". Arrow buttons: visible 40×26 box, hit area padded to 44×44 via `::before` inset.
- [ ] **Step 4:** Update the `#37` editing test deliberately: "15 minutes more" → "Five minutes more" with +5 totals; "Done" → "Done editing"; Move up/Move down now on rows.
- [ ] **Step 5:** Run the Task 2 command plus `npx vitest run` → PASS.
- [ ] **Step 6:** Commit `feat: plan card, Step editor and split failure as prototype v4 (#263, #249)`.

### Task 4: Focus page F1

**Files:** Modify `src/app/_session/focus-body.tsx`, `src/app/globals.css`; Test `e2e/session-screens-v4.spec.ts`, `e2e/prototype-focus.spec.ts`.

**Interfaces:** consumes `COMPANION`. Pure helper in `focus-body.tsx` (exported for a unit test in `tests/session-screens-v4.test.ts`): `cardLabel(stepIndex: number, cardIndex: number, cardCount: number): "Where I am" | "Right now" | "How I got here"` (first card of Step 1 → "Where I am"; else newest → "Right now"; else "How I got here").

- [ ] **Step 1: Failing tests:** unit `#238 AC3 card labels` for `cardLabel(0,0,2)`, `(0,1,2)`, `(1,0,2)`; e2e:
  - `#238 AC1 top row and centred 46 px mono timer`: `.focus-ticks` visible right of "Step 1 of N"; timer font-size "46px", family contains "Atkinson Hyperlegible Mono", centred.
  - `#238 AC2 MY GOAL row with his 48 px portrait`.
  - `#238 AC3 the slip holds the label and the pager`: label inside `[data-testid=story-card]`; buttons "Earlier card" and "Newer card" inside it, text "‹" and "›".
  - `#238 AC4 the YOUR GOAL panel`: `section[aria-labelledby=your-side]` border-radius "14px"; button "Your steps ▾" with `aria-expanded=false`.
  - `#238 AC5 Done and Pause are 56 px paper tags pinned at the bottom`.
  - `F1 open list marks ✓ ● ○`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement per the spec F1 rows. The swipe, keyboard paging, toast, return pop-up and failure box keep their behaviour.
- [ ] **Step 4:** Update `e2e/prototype-focus.spec.ts` deliberately: "‹ Earlier card" → "Earlier card", "Newer card ›" → "Newer card", "Your Steps" → `/^Your steps/`.
- [ ] **Step 5:** `npx playwright test e2e/prototype-focus.spec.ts e2e/session-screens-v4.spec.ts e2e/signed-in-focus.spec.ts` and `npx vitest run` → PASS.
- [ ] **Step 6:** Commit `feat: focus page as prototype v4 (#263)`.

### Task 5: Screenshots, docs, full verification

**Files:** Modify `scripts/design/capture-app-shared.mjs` (add `gd2`, `gd3`, and after-only states `gd4-edit`, `gd3-understood`, `gd-failed`, `f1-steps`), `scripts/design/compose-compare.mjs` (folder arg, gd2/gd3); Create `docs/design/prototype/pr-263/` with the pictures and a README; Modify `docs/architecture.md` (one line each for the dialogue and focus rows if wording changed), `docs/memory/known-issues.md` if a gap remains.

- [ ] **Step 1:** Capture "before" from a `main` build and "after" from this branch (`PROTOTYPE_ENABLED=1`, placeholder Supabase values), compose, and **look at every picture** next to its reference; fix real differences.
- [ ] **Step 2:** `npm test`, `CI=1 npm run test:e2e`, `npm run lint`, `npm run format:check` → all pass.
- [ ] **Step 3:** Commit `docs: prototype v4 comparison for the session screens (#263)`.

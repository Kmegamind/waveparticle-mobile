# Accessibility and small-screen pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The signed-in app survives 200% text on 320 px and short landscape screens, honours reduced motion, and reads sensibly to screen readers (#100, #101, #5 and eight findings).

**Architecture:** CSS fixes in `src/app/globals.css` driven by one e2e check per page at 320 px with a 200% root font; small markup and focus changes in the focus page, goal dialogue, Goals, Home and Companions, each pinned by an e2e test.

**Tech Stack:** Next.js 16, React 19, Playwright 1.64 (iPhone 14 profile, WebKit), the e2e Supabase stub.

**Spec:** `docs/superpowers/specs/2026-11-14-a11y-small-screens-design.md`

## Global Constraints

- No visual change at normal text size; prototype v4 is the reference. All values through tokens (DESIGN.md).
- No model calls, prompts, caps or content work. No new issues; extras go under "Left for later".
- Product words: Companion, Goal, Step. English only.
- Test names start with the issue and criterion (`#100 AC1 …`).

## Review Focus

1. 200% text on a 430 px phone (not only 320): Done and Pause still stack, nothing clipped — covered by the 320 check plus the flex bases; reviewer checks the basis arithmetic.
2. A Goals change that fails: focus must still land somewhere sensible (the tab), and the error toast is read — Task 5 test covers failure path.
3. Reduced motion on the native `<dialog>` sheets and the typing dots — Task 2 test checks every element's computed durations.
4. Card stack with a single card: "Card 1 of 1" and no stray `aria-current` noise — Task 3 test.
5. The signed-in goal dialogue at phase "goal" on `/try` keeps `/try` as its back destination — Task 4 test.

---

### Task 1: Large text and narrow screens (#100 AC1, AC2; findings 1–3)

**Files:** Modify `src/app/globals.css`. Test: create `e2e/large-text.spec.ts`, helper `e2e/support/large-text.ts`.

**Interfaces:** Produces `largeText(page: Page): Promise<void>` (adds `html{font-size:200%}`) and `overflowReport(page: Page): Promise<string[]>` (elements past the right edge or clipping their content; skips `.sr-only` and fixed elements).

- [ ] Write `#100 AC1 and AC2 <page> at 200% text on 320 px cuts nothing off` for `/`, `/goals`, `/goals/<id>`, `/me`, `/companions`, `/companions/oppenheimer`, `/goal` (signed in through the stub with `sampleGoals`), and `/try/goal`, `/try/focus`, `/try/rest`: `expect(await overflowReport(page)).toEqual([])` and `scrollWidth <= 320`.
- [ ] Write `#100 AC2 on the focus page with large text Done and Pause stack` (Pause's top ≥ Done's bottom) and `at normal size Done and Pause sit side by side at 62:38` (same top, width ratio within 0.58–0.66).
- [ ] Write `finding: the Step ticks wrap with 15 Steps` (every tick inside the viewport) and `finding: on a 640 by 320 screen at 200% Done can be scrolled into view and pressed`.
- [ ] Run: `CI=1 npx playwright test e2e/large-text.spec.ts` — Expected: FAIL on the pages listed in the spec.
- [ ] Fix CSS: `.app-screen{grid-template-columns:minmax(0,1fr)}`, wrapping for long words, `.focus-actions` flex with bases 8.68rem/5.32rem, `.focus-ticks{flex-wrap:wrap;height:auto}`, `.focus-page` scrolls with a minimum middle height; page fixes until the report is empty.
- [ ] Run the spec — Expected: PASS. Run `e2e/session-screens-v4.spec.ts e2e/shared-v4-styles.spec.ts` — Expected: PASS (normal size unchanged).
- [ ] Commit `fix: layouts survive 200% text on 320 px and short screens (#100)`.

### Task 2: Reduced motion (#100 AC4)

**Files:** Modify `src/app/globals.css`. Test: `e2e/large-text.spec.ts`.

- [ ] Write `#100 AC4 with reduced motion nothing animates or transitions`: `page.emulateMedia({ reducedMotion: "reduce" })` on `/try/focus`, `/try/rest`, `/goals`; every element's computed `animationDuration` and `transitionDuration` parse to ≤ 0.01 s (or animation-name `none`).
- [ ] Run — Expected: FAIL (button transitions are 120 ms).
- [ ] Add one `@media (prefers-reduced-motion: reduce)` rule on `*, *::before, *::after, ::backdrop` setting `animation-duration`, `transition-duration` to `0.01ms !important`, `animation-iteration-count: 1 !important`, `scroll-behavior: auto !important`.
- [ ] Run — Expected: PASS. Commit `fix: reduced motion removes every animation and transition (#100)`.

### Task 3: Focus page names and reading (#5, #101 AC1, AC5; finding 4)

**Files:** Modify `src/app/_session/focus-body.tsx`, `src/app/me/me-screen.tsx`. Test: `e2e/prototype-focus.spec.ts`.

- [ ] Write tests: `#5 AC1 the timer is role timer with live announcements off` (`aria-live="off"`); `finding: the Your steps toggle is named without the arrow glyph` (`getByRole("button", { name: "Your steps", exact: true })`); `#101 AC1 the card stack says card x of n and marks the newest card current` (one card: "Card 1 of 1"; after Earlier: "Card 1 of 2", no `aria-current`); `#5 AC5 the return pop-up is named, takes focus at once and Start is reachable`; `#5 AC4 no screen-reader text on the focus page says Paused`; `#101 AC5 the focus page reads seam, his side, Step name, Done, Pause` (DOM order of the five landmarks).
- [ ] Run — Expected: FAIL on aria-live, glyph name, card position, pop-up name/focus.
- [ ] Implement: `aria-live="off"` on the clock; glyphs in `<span aria-hidden="true">`; sr-only `Card {shown+1} of {cards.length}` inside the slip and `aria-current="true"` on the figure when `shown === cards.length - 1`; pop-up `aria-label="Back to your step"`, `tabIndex={-1}`, focused on open, Start focused when the line arrives. Me's "▾/▴" toggle gets the same glyph treatment.
- [ ] Run — Expected: PASS. Commit `fix: focus page timer, card position, pop-up focus and toggle names (#5, #101)`.

### Task 4: Goal dialogue back names (#5 AC3)

**Files:** Modify `src/app/try/goal/goal-dialogue.tsx`, `src/app/goal/page.tsx`. Test: `e2e/try-goal-dialogue.spec.ts`, `e2e/goal-account.spec.ts`.

**Interfaces:** `GoalDialogueProps.home?: { href: string; label: string }` (default `{ href: "/try", label: "Back to the test start" }`); `/goal` passes `{ href: "/", label: "Back to Home" }`.

- [ ] Write `#5 AC3 each ‹ in the dialogue names where it goes` on `/try/goal` (opening: "Back to the test start"; time: "Back to your goal") and on signed-in `/goal` (opening link named "Back to Home" with `href="/"`).
- [ ] Run — FAIL. Implement `backLabel(phase, timeMode, cameFrom)` destinations: goal → "Back to your goal", time → "Back to the time", split → "Back to the split question". Run — PASS. Commit.

### Task 5: Goals, Home and Companions findings (findings 5–8)

**Files:** Modify `src/app/goals/use-goal-changes.ts`, `src/app/goals/goals-screen.tsx`, `src/app/goals/[id]/goal-detail-screen.tsx`, `src/app/home-goal-options.tsx`, `src/app/companions/companions-list.tsx`. Test: `e2e/goals-account.spec.ts`, create `e2e/home-account.spec.ts`, `e2e/app-shell.spec.ts` or companions spec.

**Interfaces:** `useGoalChanges(focusAfter?: () => HTMLElement | null)`; called after a change resolves (ok or failed) and after Undo.

- [ ] Write: `finding: after Put on hold from the menu, focus is on the selected tab`; `finding: after Resume on a row, focus is on the selected tab`; `finding: after Put on hold on the detail, focus is on the heading`; `finding: a second Home toast gets its own five seconds`; `finding: Esc while a Home change is saving keeps the sheet and its error`; `finding: Moriarty's reason is announced and describes Enter`.
- [ ] Run — FAIL. Implement: focusAfter targets (`tabRefs` selected tab; detail `<h1 tabIndex={-1}>` or the existing heading); HomeToast effect depends on `toast`; dialog `onCancel` prevents default while busy; `<p aria-live="polite" id="comp-reason">` always rendered, Enter `aria-describedby="comp-reason"` when a reason shows.
- [ ] Run — PASS. Commit `fix: focus after Goals changes, Home toast and sheet, Companions reason (#100)`.

### Task 6: Docs, compare and verification

- [ ] Update `docs/memory/known-issues.md` (large-text check), `docs/testing.md` (the 200% helper).
- [ ] Capture normal-size screens with `scripts/design/capture-*.mjs` and compare against `docs/design/prototype/` references; save to `docs/design/prototype/pr-a11y/`.
- [ ] `npm test`, `npm run lint`, `npm run format:check`, `CI=1 npm run test:e2e` all green.

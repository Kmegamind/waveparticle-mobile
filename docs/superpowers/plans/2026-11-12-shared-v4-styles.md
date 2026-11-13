# Shared styling from prototype version 4: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the eleven differences C1 to C11 that every built screen shares with prototype version 4, in shared tokens, shared CSS and the shared shell only.

**Architecture:** Values live as tokens in `src/app/tokens.css`; shared component rules in `src/app/globals.css`; fonts in a new `src/app/fonts.ts` loaded by the root layout; tab bar and header visibility in `src/app/shell.tsx`; the session skin in a new client wrapper `src/app/try/try-frame.tsx` used by `src/app/try/layout.tsx`. No page component under `src/app/auth`, `src/app/safety`, `src/app/try/{goal,focus,rest}` and nothing under `src/lib` changes.

**Tech Stack:** Next.js 16.4.5 App Router, `next/font/google` (built in), CSS custom properties with Tailwind 4, Vitest 5, Playwright 1.64.

**Spec:** `docs/superpowers/specs/2026-11-12-shared-v4-styles-design.md`

## Global Constraints

- Every value comes from `docs/design/prototype/TOKENS_FROM_V4.md` or the spec's tables; no colour, font or size is hard-coded in a component rule; new values are tokens.
- `--control` keeps its current values (focus rings and outlines stay at 3:1 or more).
- Do not edit `DESIGN.md`, `AGENTS.md` (revert the `next dev` block before each commit with `git checkout AGENTS.md`), `.claude/`, `src/lib/`.
- The only existing test whose expectation changes is e2e "US-PLAT-1 a wider screen keeps the phone layout" (approved by Yue, option A); `tests/app-shell.test.ts` and `tests/design-tokens.test.ts` keep passing unchanged.
- Commands: `npm test`, `CI=1 npm run test:e2e`, `npm run lint`, `npm run format:check`, `npx next build`.
- Merge `origin/main` before the first commit and before opening the pull request.

## Review Focus

1. Dark system setting on a session page: the `@media (prefers-color-scheme: dark) .theme-shell:not(.theme-light)` block must not beat the skin on `html`; the goal dialogue background must be #140D12 in dark too. Pinned in Task 4's e2e test (both schemes).
2. Disabled filled button: the 2 pixel edge and the 35% opacity together must still read as disabled. Pinned in Task 2's unit test (the disabled rule keeps `opacity: 0.35`).
3. Text at 320 pixels wide: 56 pixel buttons with 18 pixel side padding must not overflow. Pinned in Task 2's e2e test at 320 by 640 (no horizontal scroll on sign in).
4. Rest page with only his first message: it must keep its tape (the sibling rule must not hide the first). Pinned in Task 6's unit test on the selector text and by the screenshots.
5. Sign-in page with a slow font load: text must stay visible (`display: "swap"`). Pinned in Task 1's unit test.

---

### Task 1: Load the four typefaces (C1)

**Files:**
- Create: `src/app/fonts.ts`
- Modify: `src/app/layout.tsx` (add the four `.variable` classes to `<html>`), `src/app/tokens.css` (`--type-*`)
- Test: `tests/shared-v4-styles.test.ts` (new), `e2e/shared-v4-styles.spec.ts` (new)

**Interfaces:**
- Produces: CSS variables `--font-atkinson-next`, `--font-atkinson-mono`, `--font-bricolage`, `--font-newsreader`; `--type-sans`, `--type-mono`, `--type-display`, `--type-voice` start with them; `--type-shell: var(--type-sans)`.

- [ ] **Step 1: Unit test** `#240 C1 loads the four typefaces with next/font and swap`: `fonts.ts` imports `Atkinson_Hyperlegible_Next`, `Atkinson_Hyperlegible_Mono`, `Bricolage_Grotesque`, `Newsreader` from `next/font/google`, each with `display: "swap"`, `subsets: ["latin"]` and its `variable`; Bricolage and Newsreader have `axes: ["opsz"]`; Newsreader has `style: ["normal", "italic"]`; `layout.tsx` contains `fontVariables`; `tokens.css` matches `/--type-sans:\s*var\(--font-atkinson-next\)/` (and the same for the other three) and `/--type-shell:\s*var\(--type-sans\)/`.
- [ ] **Step 2: e2e test** `#240 C1 the typefaces are loaded on sign in`: at 390 by 800 on `/auth/sign-in`, after `document.fonts.ready`, the set of `family` names of `[...document.fonts].filter(f => f.status === "loaded")` covers Atkinson Hyperlegible Next, Bricolage Grotesque (the `h1`) and contains at least three distinct families (next/font renames families, so match with a case-insensitive substring such as `/bricolage/i`); and `getComputedStyle(h1).fontFamily` matches `/bricolage/i`.
- [ ] **Step 3: Run both; expect FAIL.**
- [ ] **Step 4: Implement** `export const fontVariables: string` (the four `.variable` class names joined) in `src/app/fonts.ts`; use it in `layout.tsx`; change the four `--type-*` tokens to `var(--font-…), "<family>", <existing fallbacks>` so `tests/design-tokens.test.ts` still matches.
- [ ] **Step 5: Run the two new tests and `npm test`; expect PASS. Commit** `feat: load the prototype typefaces with next/font (#240)`.

### Task 2: Paper-tag buttons and the filled colours (C2, C3, C4)

**Files:**
- Modify: `src/app/tokens.css` (new `--tag-fill`, `--tag-ink`, `--tag-edge`, `--button-height: 3.5rem`, `--button-small-height: 2.75rem`, `--button-padding: 1.125rem`, `--button-small-padding: 0.875rem`, `--text-button-small-size: 0.875rem`, in `:root`, `.theme-dark`, `.skin-opp` and the dark media block), `src/app/globals.css:43-124` (button rules), `src/app/globals.css` `.auth-page .button-filled` (drop its capsule override)
- Test: `tests/shared-v4-styles.test.ts`, `e2e/shared-v4-styles.spec.ts`

**Interfaces:**
- Produces: `.button-filled`, `.button-tinted`, `.button-gray`, `.button-plain`, `.button-small` keep their names (used by page components).

- [ ] **Step 1: Unit test** `#240 C2 C3 C4 button tokens`: day `--tag-fill: #c3e0c8; --tag-ink: #050b06; --tag-edge: #517e5a`; `.theme-dark`, `.skin-opp` and the dark media block `#a1caa8 / #050b06 / #6e9876`; `--control` still `#426f4c` in `:root`; the disabled rule still has `opacity: 0.35`.
- [ ] **Step 2: e2e test** `#240 C2 C3 sign in uses the paper-tag filled button` (light and dark): the Sign in button has `border-radius` 14px, height 56, `font-weight` 700, `letter-spacing` normal, `border-top-width` 1px, `box-shadow` containing `0px 2px 0px 0px`, background `rgb(195, 224, 200)` light / `rgb(161, 202, 168)` dark. And `#240 C2 sign in has no horizontal scroll at 320 pixels`: `document.documentElement.scrollWidth <= 320`.
- [ ] **Step 3: e2e test** `#240 C4 the crisis page's second button is a secondary paper tag`: on `/safety` after "test input: suicide" and Send, the `.button-tinted` in `.crisis-actions` has background `rgb(255, 255, 255)` (light), border colour `rgb(129, 128, 125)`, text `rgb(27, 26, 25)`.
- [ ] **Step 4: Run; expect FAIL.**
- [ ] **Step 5: Implement** the rules: shared base with `border-radius: var(--r-field)`, `min-height: var(--button-height)`, `padding-inline: var(--button-padding)`, `font-family: var(--type-sans)`, weight 700, no letter spacing, `border: 1px solid`; filled = `--tag-fill` / `--tag-ink` / `--tag-edge` plus `box-shadow: 0 2px 0 0 var(--tag-edge)`; tinted and gray = `--raised` / `--ink` / `--edge`; plain = transparent, no border, `--ink`; small = `--button-small-height`, `--button-small-padding`, `--text-button-small-size`. Keep press, focus, disabled and reduced-motion rules. Remove the `.crisis-actions .button-tinted` and `.focus-actions .button-gray` colour overrides only if they set colours (layout stays).
- [ ] **Step 6: Run the new tests, `npm test`, `CI=1 npm run test:e2e`; expect PASS. Commit** `feat: paper-tag buttons from prototype v4 (#240)`.

### Task 3: Text links and small labels (C9, C10)

**Files:**
- Modify: `src/app/tokens.css` (`--text-link-size: 0.9375rem`, `--text-overline-size: 0.78125rem`, `--overline-tracking: 0.09em`), `src/app/globals.css` (`a`, `.try-link`, `.focus-label`)
- Test: `tests/shared-v4-styles.test.ts`, `e2e/shared-v4-styles.spec.ts`

- [ ] **Step 1: e2e test** `#240 C9 text links are ink, 15 pixels, bold, underlined`: on `/auth/sign-in` the "Create an account" link has colour `rgb(27, 26, 25)` (light), font size 15px, weight 700, `text-decoration-line` underline.
- [ ] **Step 2: Unit test** `#240 C10 small labels are capitals`: `.focus-label` block contains `text-transform: uppercase`, `var(--text-overline-size)`, `var(--overline-tracking)`, `font-weight: 700`; token values as above.
- [ ] **Step 3: Run; expect FAIL. Implement; run; expect PASS. Commit** `feat: ink text links and capital small labels (#240)`.

### Task 4: Session skin and glow (C5, C6)

**Files:**
- Create: `src/app/try/try-frame.tsx` (client component)
- Modify: `src/app/try/layout.tsx`, `src/app/tokens.css` (`.skin-opp` selector becomes `.skin-opp, html.theme-shell:has(.skin-opp)`; add `--tape`; `--page-glow` token), `src/app/globals.css` (`body` background)
- Test: `tests/shared-v4-styles.test.ts`, `e2e/shared-v4-styles.spec.ts`

**Interfaces:**
- Produces: `export function TryFrame({ children }: { children: ReactNode }): JSX.Element` renders `<div className="try-shell">` plus ` skin-opp` when `isSessionPath(pathname)`; `export function isSessionPath(pathname: string): boolean` is true for `/try/goal`, `/try/focus`, `/try/rest`, `/try/end` and anything below them, false for `/try`.

- [ ] **Step 1: Unit test** `#240 C5 session paths use the Oppenheimer skin`: `isSessionPath` true for `/try/goal`, `/try/focus`, `/try/rest`, `/try/end`, `/try/rest/x`; false for `/try`, `/try/goals`, `/`.
- [ ] **Step 2: e2e test** `#240 C5 C6 the goal dialogue uses the Oppenheimer skin in light and dark`: for each scheme, on `/try/goal` the computed `body` background colour is `rgb(20, 13, 18)` and its background image contains `rgb(18, 38, 26)`; on `/try` (light) the body background colour is `rgb(234, 233, 231)` and the image contains `rgb(207, 231, 211)`. Same skin check on `/try/focus` after Start.
- [ ] **Step 3: Run; expect FAIL.**
- [ ] **Step 4: Implement** `--page-glow: radial-gradient(60% 34% at 92% 4%, var(--glow-1), transparent 70%), radial-gradient(70% 44% at 2% 104%, var(--glow-2), transparent 70%)` and `body { background: var(--page-glow), var(--bg); background-attachment: fixed }`; the skin selector change so `html` carries the skin tokens (specificity 0,2,1 beats the dark media block's 0,2,0); `TryFrame` in `layout.tsx` with the existing header inside.
- [ ] **Step 5: Run; expect PASS. Commit** `feat: Oppenheimer skin on session pages and the page glow (#240)`.

### Task 5: Header and tab bar (C7, C8, and the US-PLAT-1 test change)

**Files:**
- Modify: `src/app/shell.tsx`, `src/app/globals.css` (`.app-tab-bar`, `.app-tab`), `src/app/tokens.css` (`--text-tab-size: 0.78125rem`, `--tab-icon: 1.5rem`, `--tab-item-height: 3.25rem`), `e2e/installable-pwa.spec.ts` (US-PLAT-1)
- Test: `tests/shared-v4-styles.test.ts`, `e2e/shared-v4-styles.spec.ts`

**Interfaces:**
- Produces: `export function showsTabBar(pathname: string): boolean` and `export function showsHeader(pathname: string): boolean` in `src/app/shell.tsx` (or a sibling `src/app/shell-rules.ts` if a client file cannot export plain functions cleanly).

- [ ] **Step 1: Unit test** `#240 C8 the tab bar follows the prototype table`: true for `/`, `/goals`, `/companions`, `/companions/oppenheimer`, `/me`, `/me/signals`; false for `/goals/12`, `/me/delete-account`, `/auth/sign-in`, `/safety`, `/try/goal`. `#240 C7 no header on account and safety pages`: `showsHeader` false for `/auth/sign-in`, `/auth/update-password`, `/safety`; true for `/`, `/me`. `#240 C8 tab order` : in `shell.tsx` the labels appear in the order Home, Goals, Companions, Me, each item has an `<svg` with `aria-hidden`.
- [ ] **Step 2: e2e test** `#240 C7 C8 sign in and safety have no header and no tab bar`: on `/auth/sign-in` and `/safety`, `.app-header` count 0 and `getByRole("navigation", { name: "Primary" })` count 0.
- [ ] **Step 3: Change e2e US-PLAT-1** to: at 1280 by 800 on `/auth/sign-in`, `.app-shell` width at most 430 and the Primary navigation count 0. Keep its name.
- [ ] **Step 4: Run; expect FAIL** (new tests fail; US-PLAT-1 fails until the shell changes).
- [ ] **Step 5: Implement** the two functions (`/me/delete-account` is the one excluded page below `/me`), the icon SVG paths copied from the prototype (Home `M4 11l8-7 8 7v9H4z`; Goals `M5 6h14M5 12h14M5 18h9`; Companions circle `9,8,r3.2` plus `M3 20c.8-3.6 3.2-5.4 6-5.4s5.2 1.8 6 5.4` and `M16 5.4a3.2 3.2 0 010 5.8M18 14.8c1.8.8 2.8 2.4 3.2 5.2`; Me circle `12,8,r3.6` plus `M5 20c1-4 3.8-6 7-6s6 2 7 6`), item column layout with 3 pixel gap, the 3 pixel `--mark` bar via `::before` on `[aria-current="page"]` (width 48%, radius 2 pixels, 7 pixels above the item), bar `--bg` with padding 6, 8 and 12 pixels plus safe area. Keep `aria-label="Primary"`, `label: "…"` entries and the logo markup in the header.
- [ ] **Step 6: Run; expect PASS. Commit** `feat: header and tab bar follow prototype v4 (#240)`.

### Task 6: Tape (C11)

**Files:**
- Modify: `src/app/tokens.css` (`--tape-width: 3.625rem`, `--tape-height: 1.0625rem`, `--tape` per skin: `color-mix(in srgb, #c3e0c8 75%, transparent)` day, `color-mix(in srgb, #a1caa8 55%, transparent)` dark and Oppenheimer; `--tape-ring: color-mix(in srgb, var(--tag-edge) 35%, transparent)`), `src/app/globals.css` (`.focus-tape`, `.try-slip::before`, the two thread rules)
- Test: `tests/shared-v4-styles.test.ts`

- [ ] **Step 1: Unit test** `#240 C11 tape matches the prototype`: `.focus-tape` and `.try-slip::before` blocks contain `var(--tape)`, `rotate(-4deg)`, `var(--tape-width)`, `box-shadow: 0 0 0 1px var(--tape-ring)`, no `translateX(-50%)`; the CSS contains `.try-dialogue .try-slip ~ .try-slip::before` and `.rest-log .rest-slip ~ .rest-slip .focus-tape` with `display: none`, and no rule hides `.focus-slip .focus-tape`.
- [ ] **Step 2: Run; expect FAIL. Implement** (tape at `top: calc(var(--tape-height) / -2)`, `left: 1rem`, radius 3 pixels); **run; expect PASS. Commit** `feat: prototype tape and the chat thread rule (#240)`.

### Task 7: Screenshots, docs and the pull request

**Files:**
- Create: `docs/design/prototype/pr-240/` after pictures and side-by-side images; `docs/design/prototype/pr-240/README.md` (table of before, after and prototype per screen and scheme).
- Modify: `docs/design/prototype/GAP_LIST_V4.md` (mark C1 to C11 done or left, with the pull request), `docs/architecture.md` (fonts module and skin wrapper rows).

- [ ] **Step 1:** Run `node scripts/design/capture-app-shared.mjs http://localhost:3240 docs/design/prototype/pr-240 after`; build side-by-side images (prototype | before | after) with Playwright for sign in, goal dialogue and focus in light and dark.
- [ ] **Step 2:** Look at every after picture next to the prototype; list any remaining shared difference in the README as "left, with reason".
- [ ] **Step 3:** Merge `origin/main`; run `npm test`, `CI=1 npm run test:e2e`, `npm run lint`, `npm run format:check`, `npx next build`; all pass.
- [ ] **Step 4:** Open the pull request with the template: `Closes #240`, C1 to C11 done or left, the US-PLAT-1 test change, the `DESIGN.md` change list (sections 3.1 to 3.4, 3.6, 3.8, 3.11, 6.1, 6.6, 6.11, 11), the `docs/FLOW.md` 3.2 tab bar difference, links to the side-by-side images.

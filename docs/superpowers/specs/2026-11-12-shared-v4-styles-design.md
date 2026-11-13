# Shared styling from prototype version 4 (issue #240)

Date: 2026-11-12. Status: approved approach; design for review.

## Why

Prototype version 4 (`docs/design/prototype/wp-prototype_2026-11-12_v4_live-ai.html`) is the design reference. `docs/design/prototype/GAP_LIST_V4.md` lists eleven differences (C1 to C11) that appear on every compared screen. Fixing them once, in shared styles and shared components, lets the ten screen issues (#229 to #238) deal only with their own page layout.

## Goals

Each item below is one row of the gap list. All values are the computed values in `docs/design/prototype/TOKENS_FROM_V4.md` (read in a browser, not from the prototype source).

- **C1 Typefaces.** Load Atkinson Hyperlegible Next and Mono, Bricolage Grotesque and Newsreader with the built-in `next/font/google` (self-hosted at build time, so the browser never calls Google). Weights as the prototype requests: Atkinson Next 400 to 700, Mono 400 to 700, Bricolage 500 to 800 with the optical-size axis, Newsreader 400 and 500 plus italic 400. The token `--type-shell` (controls and system text) points at Atkinson, because the prototype uses Atkinson for every control.
- **C2 Paper-tag buttons.** All button classes: radius 14 pixels (`--r-field`), height 56 pixels (small 44), side padding 18 pixels (small 14), Atkinson 17 pixels at weight 700 (small 14), no letter spacing, 1 pixel outline.
- **C3 Filled button.** New tokens `--tag-fill`, `--tag-ink`, `--tag-edge`: day #C3E0C8 / #050B06 / #517E5A; dark Shell and Oppenheimer #A1CAA8 / #050B06 / #6E9876. Outline and `box-shadow: 0 2px 0 0` in `--tag-edge`. `--control` is unchanged.
- **C4 Secondary button.** `.button-gray` and `.button-tinted` both render as the prototype's secondary button: `--raised` background, 1 pixel `--edge` outline, `--ink` text. `.button-plain` keeps no background and no outline, with `--ink` text.
- **C5 Session skin.** A small client wrapper in `src/app/try/` adds `skin-opp` to the test path frame on `/try/goal`, `/try/focus`, `/try/rest` and `/try/end`, in both light and dark system settings. `html:has(.skin-opp)` carries the same tokens so the page background behind and around the frame is plum black. The test path start page `/try` stays in the Shell.
- **C6 Glow.** The page background is the prototype's two radial glows over `--bg`: `radial-gradient(60% 34% at 92% 4%, var(--glow-1), transparent 70%), radial-gradient(70% 44% at 2% 104%, var(--glow-2), transparent 70%)`. It follows the active skin, so the session skin gets its own glow (#12261A).
- **C7 No header** on `/auth/*` and `/safety`. The header stays on the other account pages.
- **C8 Tab bar** shows where the prototype shows it (table "Where the tab bar shows" below), in the order Home, Goals, Companions, Me. Each item: a 24 pixel icon with a 1.8 stroke (the prototype's SVG paths) over a 12.5 pixel label, gap 3 pixels, item height 52 pixels. Selected: label weight 800 in `--ink` and a 3 pixel `--mark` bar above the item, 48% of its width, 2 pixel radius. Others: weight 600 in `--ink-2`. Bar: `--bg`, 1 pixel `--hairline` on top, padding 6, 8 and 12 pixels plus the safe area.
- **C9 Text links.** `--ink`, 15 pixels, weight 700, underlined. Centring links under a form is page layout and is left to the screen issues.
- **C10 Small labels.** A shared overline style: 12.5 pixels, weight 700, upper case through CSS (the text in the page stays as written, so tests and screen readers are unaffected), letter spacing 0.09em, `--ink-2`. Applied to the existing label class of the focus page (`.focus-label`). Adding new labels such as "SIGN IN" is page content and stays with the screen issues.
- **C11 Tape.** 58 by 17 pixels, 3 pixel radius, at the top left of the slip, rotated −4 degrees, `--tape` (#C3E0C8 at 75% by day, #A1CAA8 at 55% in the dark Shell and the Oppenheimer skin), a 1 pixel ring of `--tag-edge` at 35%. Every slip has tape by default. The one rule that removes it is the prototype's `.thread .note.him:not(:first-child)::before { display: none }`: **inside a chat thread, every slip of his after the first has no tape.** Slips outside a thread (Home, the focus page, the return pop-up, the summary) always keep their tape. See the table "Chat threads and tape" below.

## Where the tab bar shows

Read from prototype version 4 on 2026-11-12: every screen in `scripts/design/reference-screens-v4.json` was opened in a browser and checked for `#phone nav.tabbar`, which the views `home`, `comp`, `cpage`, `cpages`, `me`, `sig`, `rec` and `goals` add with `tabbar()`. A sheet keeps the tab bar of the page under it.

| Prototype screen | Tab bar | App page today |
|---|---|---|
| AUTH-IN, AUTH-UP, AUTH-CONFIRM, AUTH-RESET, AUTH-NEW-PASSWORD | no | `/auth/sign-in`, `/auth/sign-up`, `/auth/forgot-password`, `/auth/update-password` |
| HOME-0, HOME-1, HOME-3, HOME-NONE; sheets HOME-3B and HOME-MENU | yes | `/` |
| COMP (Companions) | yes | `/companions` |
| CPAGE, CPAGE-M (Life Path), CPAGE-S (a Companion with one story) | yes | not built (would sit below `/companions/`) |
| ME; SIG (Signals); ME-CAL (history open); ME-REC (session record) | yes | `/me`; the others are not built (would sit below `/me/`) |
| ACCOUNT-DELETE | no | not built |
| G1, G5, G5-D, G6 (Goals lists); sheet G3 (New goal) | yes | `/goals` |
| G4, G4-N, G4-H (Goal detail) | no | not built (would sit below `/goals/`) |
| GD1 to GD4, GD-F, GD-N1 (goal dialogue) | no | `/try/goal` |
| F1, F1S, F1-E, F1-YOU, F1-N, F2, F3, F3-X; sheets F1-C and F-RET (focus) | no | `/try/focus` |
| R1, R1-C, R-OFF (rest) | no | `/try/rest` |
| S1 (safety) | no | `/safety` |
| END (summary) | no | not built (`/try/end`) |

Implemented as a list in `src/app/shell.tsx`: the tab bar shows on `/`, `/goals`, `/companions` and every page below it, and `/me` and every page below it except a future account deletion page; it hides on everything else, including any future page below `/goals/` (Goal detail). This differs from `docs/FLOW.md` 3.2, which hides the tab bar on CPAGE, CPAGE-S and the session record; the prototype wins for looks, and the pull request lists the FLOW difference for a human.

## Chat threads and tape

Read the same way: each screen was checked for `.thread` and for which of his slips still draw their tape (`::before`).

| Prototype screen | Chat thread | His slips | Slips with tape | App equivalent |
|---|---|---|---|---|
| GD1 to GD4, GD-F, GD-N1 (goal dialogue) | yes | 1 to 4 | only the first | `/try/goal`: the `.try-slip` elements in `.try-dialogue` |
| R1, R-OFF (rest, before he writes) | yes | 0 | none | `/try/rest` |
| R1-C (rest, you answered) | yes | 2 | only the first | `/try/rest`: the `.rest-slip` elements in `.rest-log` |
| HOME-1, HOME-MENU (Home Goal card) | no | 1 | 1 | not in the test path |
| F1 and every focus state with a card | no | 1 | 1 | `/try/focus` slip keeps its tape |
| F-RET (return pop-up) | no | 2 | 2 | return pop-up on `/try/focus` keeps its tape |
| END (summary) | no | 2 | 2 | not built |

The app has no `.thread` element, and page components are not changed here, so the rule is written for the two app threads: in `.try-dialogue` and in `.rest-log`, a slip that follows an earlier slip in the same thread has no tape (`.try-slip ~ .try-slip::before` and `.rest-slip ~ .rest-slip .focus-tape`). The comment in the CSS names the prototype rule it copies.

## Non-goals

- Page layouts, page copy and new page elements (issues #229 to #238).
- `src/lib`, the model gateway and any AI code.
- `DESIGN.md` (agents do not edit it). The pull request lists the changes a human should make there.
- The night accent #89B992 and the focus ring colour #355E3F of the prototype, which are not in C1 to C11. They go into the `DESIGN.md` change list.
- The header on Home, Goals, Companions and Me (not compared; the Home issue decides).

## Anti-goals

- No contrast regression: focus rings and control outlines stay at 3:1 or more, which is why `--control` is not changed.
- No hard-coded colours in components; every new value is a token in `src/app/tokens.css`.

## Constraints

- `AGENTS.md`: tests first, never weaken a test. One e2e test changes on purpose (decided by Yue, option A): `e2e/installable-pwa.spec.ts`, "US-PLAT-1 a wider screen keeps the phone layout", measured the tab bar on `/auth/sign-in`. After C8 it checks that the shell is at most 430 pixels wide there and that there is no tab bar. The tab bar's width limit stays covered by the unit test in `tests/installable-pwa.test.ts`. The pull request states this change.
- Merge `origin/main` before starting and before opening or updating the pull request.

## Approaches

1. **Button colours.** (a, chosen) New `--tag-*` tokens, `--control` unchanged. (b) Change `--control` by day to the pale green: fewer tokens, but focus rings and other `--control` uses would drop below 3:1.
2. **Session skin.** (a, chosen) One wrapper in the test path layout picks the skin by address, plus `html:has(.skin-opp)` for the page background. (b) A class in every session page component: touches the files the screen issues own and invites merge conflicts.

## Verification

- Unit tests (Vitest) read `tokens.css`, `globals.css`, `shell.tsx` and the font module for the values above.
- End-to-end tests (Playwright, 390 by 800) read computed styles: the loaded fonts (`document.fonts.check`), the filled button on sign in (radius 14, height 56, background #C3E0C8, 2 pixel edge), no header or tab bar on sign in and on the safety page, the goal dialogue background #140D12 under a light system setting, link colour `--ink`.
- Screenshots at 390 by 800, light and dark, before (current `main`) and after, next to the prototype reference, for at least sign in, the goal dialogue and the focus page. They are committed under `docs/design/prototype/pr-240/` and linked in the pull request.

## Calls made after the builder check

These were open in the first draft; each is settled here as a call by the author, not something Yue decided.

- **Tape covers both kinds:** the goal dialogue's `.try-slip::before` and the `<span class="focus-tape">` used on the focus page, the return pop-up and the rest page get the same size, rotation, place and colour. `--tape-width` and `--tape-height` keep their names and get the new values. Which slips lose it is set by the chat thread rule above (corrected by Yue on 2026-11-12).
- **`/try/end` does not exist yet.** The skin wrapper matches the address prefixes `/try/goal`, `/try/focus`, `/try/rest` and `/try/end`, so the summary gets the skin when its issue adds it. The test checks the three pages that exist.
- **Shantell Sans is not loaded.** It is the hand layer (DESIGN.md section 7), not one of the four typefaces of C1, and no current screen uses it for text.
- **Tab bar:** follows the table above, taken from the prototype (corrected by Yue on 2026-11-12; the first draft used exact paths only).
- **Tab order** changes to Home, Goals, Companions, Me, and `tests/app-shell.test.ts` is updated for it (the order is set by `docs/FLOW.md` 3.2; the test only checks that the four labels exist, so it keeps passing).

## Left to the builder

- How the tab bar list is written in code, as long as it gives the table's answers.
- File layout of the font module and the skin wrapper.
- How the "only the first slip has tape" selector is written, as long as no page component changes.

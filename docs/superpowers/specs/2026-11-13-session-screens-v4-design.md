# Session screens to prototype v4 (#263): design

Date: 2026-11-13. Issues: #263 (closing issue), #234 GD1, #235 GD2, #236 GD3, #237 GD4, #238 F1, #249 (STEP-EDIT minutes).

## Intent

Yue wants the goal dialogue and the focus page to be a 1:1 version of prototype v4
(`docs/design/prototype/wp-prototype_2026-11-12_v4_live-ai.html`), not only in looks: his lines,
labels, number formats and the plan editor's controls follow the prototype too. One pull request,
closing #263, #234 to #238 and #249.

## Sources, in order

1. Yue's decisions in this conversation (2026-11-13), listed under "Decided".
2. The prototype's source (`V.gd`, `V.focus`, the `gd*` handlers, `commitEdit`, its CSS) and the
   reference screenshots `reference-screenshots/{gd1,gd2,gd3,gd4,f1}.png`.
3. `TOKENS_FROM_V4.md` (measured values) and the shared styles from #244 (paper tags, skin, tape,
   labels, links). Use existing tokens and classes; no hard-coded colours, fonts or spacing.
4. `DESIGN.md` loses to the prototype for looks. `FLOW.md` loses where Yue decided below; every such
   place is listed in the pull request for a later docs update.

## Goals

- `/goal` and `/try/goal` (both render `src/app/try/goal/goal-dialogue.tsx`) match GD1 to GD4.
- `/focus` and `/try/focus` (both render `src/app/_session/focus-body.tsx`) match F1.
- The four extra states match the prototype as well: the open Step editor, the "time read from your
  line" caption, the open "Your steps" list, and the split-failed screen.
- #249: Step minutes are any whole number of at least 1.

## Non-goals and anti-goals

- No change to the sign-in pages, the summary (`/end`), the Life Path, the rest page or the return
  pop-up (beyond what shared classes already give them).
- No change to saving, server actions, the model gateway, session logic, the clock, Done, Undo,
  Pause, swipe, keyboard paging or the safety gate.
- The time question stays a slider (TIME-SLIDER). The prototype's "30 min", "1 hour", "2 hours" chips
  and its typed time box are **not** built.
- Story content (his opening line, cards, chapter) is not changed; it is not design.
- Failure: anything that drops an accessible name an existing test or screen reader relies on
  without a deliberate, listed test change; anything that hides a control below 44 by 44 px.

## Decided

| Item | Decision |
|---|---|
| Scope | 1:1 with the prototype, including copy and the new controls (Yue). |
| GD1 header | "‹", the 40 px round portrait (`/companions/oppenheimer.png`, `.av` style: `--tag-fill` background, 1.5 px `--tag-edge` ring, image at 118 %) and "Oppenheimer" (15 px, weight 700, `--ink`). One small companion constant; the app has only this Companion. |
| Layout | The dialogue becomes the prototype's `.scr`: header row, a scrolling thread (`.thread`, gap 18 px, top padding 22 px), and a bottom dock that holds the composer, the slider, the chips or Start. The dock is pinned; the thread scrolls and scrolls to its end when a turn is added. |
| GD1 composer | Rectangular field (14 px radius, min-height 52 px, `--raised`, 1 px `--edge`), placeholder "Say it in one line"; separate 52 by 52 paper-tag Send (filled tag, 20 px right-arrow icon). "Just split it" is a centred text link under it. "Write one line first" stays. |
| His slips | `align-self:flex-start; max-width:94%` (about 322 px of 346). Only the first slip in the thread has tape (already from #244). |
| User bubbles | `--surface`, 1 px `--hairline`, radius 16 16 4 16, Atkinson 16.5/1.4, `--ink`, right aligned, max-width 84 %. |
| GD2 slip | Reaction and time question in **one** slip, as "<reaction> How long do you have?". The specific-goal reaction pool gets "That has a clear edge to it." as its first line (the other lines stay). |
| GD2 dock | Slider, its value and Send (the same paper-tag Send) at the bottom; "Not sure" as a chip (12 px radius, 44 px, `--raised`, 1.5 px `--edge`, 15 px weight 600) above it. **"Just split it" is not shown on GD2** (Yue: follow the prototype; differs from the current page, list for FLOW). The slider keeps its accessible name "Your time", `aria-valuetext`, the zero hint and the inactive Send. |
| Time format in the dialogue | "N min" always: the user's answer ("60 min", "95 min"), the count line ("2 steps · 60 min"), Step rows ("30 min"), the editor and the understood-time caption. A new `minutesLabel(n)` = `${n} min`. `formatMinutes` stays for the slider's spoken value and for any other caller. |
| Time acknowledgement | The ack slip after a slider answer ("Then I will keep to the same span." and the other one) is **dropped**. `TIME_ACKS` and `timeAck` are removed if nothing else uses them. |
| Not sure | Bubble "Not sure", then his slip "Then thirty minutes. Long enough to start, short enough to keep." (replaces `NOT_SURE_LINE`). |
| Understood time (GOAL-TIME) | A caption with `role="status"`: "Time I understood from your line: **60 min**." followed by a text link "Change" (accessible name "Change time", which contains the visible word). Shown only while on GD3, as now. |
| Understood path (prototype `V.gd`) | When the time is read from the line, **no reaction slip** is shown: goal bubble, then the caption, then the split question. "Change" switches to the asked path (combined slip, slider, then the "N min" bubble, no caption); the separate `"changed"` mode and its "Time:" row go. |
| Slider value (my call) | The slider is not in the prototype (TIME-SLIDER is Yue's own). Its visible value and its `aria-valuetext` stay as today ("1 hour 35 min"); only the user's answer bubble after Send reads "N min". |
| GD3 | His slip "Do you want it cut fine, or kept in a few broad pieces?". "Split it finer" and "Keep it broad" are chips in the dock. After the answer the thread shows the choice as the user's bubble (as now). |
| GD4 intro | "Here is how I would cut it. Argue with it now, in ink, where it’s cheap." (typographic apostrophe, as in the prototype). |
| GD4 card | `role="group"`, name "Your steps"; overline "Your steps"; caption label "Goal" and a text field (48 px) holding the Plan title (starts as the split's title, or the typed goal when there is none). Its value is what Start saves as `title` and what the focus page shows as the Goal. An empty field falls back to the typed goal. Max length 200 (`STEP_TITLE_MAX`, the same limit the save applies to the title; the builder confirms the save's actual title limit and uses that). The safety gate runs on it on Start, as it runs on Step text. |
| GD4 rows | Each row: a button (opens the editor) with a 26 px numbered circle (`--tag-fill` / `--tag-ink`, 800 13 px), the title (500 16.5/1.3) and "N min" in the mono face (600 14 px, `--ink-2`), top border `--hairline`, min-height 56 px; then a column of two small buttons ↑ and ↓ (40 by 26 px visible, radius 8, 1.5 px `--edge`, `--raised`), named "Move up: <title>" and "Move down: <title>", disabled at the ends. Each arrow button keeps a 44 by 44 hit area through padding or a pseudo-element without changing the drawn size. **Descriptions are not shown in the list** (Yue: follow the prototype; list for FLOW). |
| GD4 footer | A row with a top `--hairline`: "+ Add a step" text link on the left, the count caption on the right; then "Split again" as a centred text link, inside the card. |
| Start | Full-width filled paper tag in the dock, pinned. The save-failed line and Retry stay, placed in the dock above Start. |
| Step editor (open) | As the prototype: the row shows the number, "Editing" and "N min"; under it caption labels "Step title" and "Description" with fields (description 76 px, 2 rows); a stepper group named "Minutes": "−" (name "Five minutes fewer"), a typed number field (name "Minutes", 84 px, `min=1`, `inputmode=numeric`), "+" (name "Five minutes more"); then a row with "Done editing" (small secondary paper tag) and "Remove step" (text link, hidden when only one Step is left). Move buttons are not in the editor any more; the rows' arrows do that. |
| Minutes (#249) | ±5 per press, never below 1. A typed whole number of at least 1 is taken; anything else keeps the last value. At 1 the "−" button is `aria-disabled` with a dashed outline and `--faint` text, and the reason is shown in words: "A Step is at least 1 minute." (linked by `aria-describedby`). A new Step starts at 15 minutes. The Goal's time is the sum (D1d), as now. **Upper bound (my call):** the account save refuses a Step above 1440 minutes (`LIMITS.stepMinutes` in `src/lib/goals/start-goal.ts`), so the editor caps at 1440: "+" becomes `aria-disabled` there with the reason "A Step is at most 24 hours.", and a larger typed number is set to 1440. The save is not changed. |
| Add a step | Inserts after the open Step (or at the end) and opens it, as the prototype. |
| Split failed | A `.sys` box (`--raised`, 1.5 px `--edge`, radius 18, padding 20, gap 12) with `role="alert"`: heading "That one wouldn’t split." (Bricolage 800 20 px), "Nothing is lost. Your words are kept: “<goal>”.", "Try again" (filled tag), "Use one step" (secondary tag), and "Change my line" as a centred link. Change my line puts the goal back into the composer. |
| Splitting state | Unchanged in behaviour; the dots become the prototype's typing bubble with `role="status"` and the name "Splitting your line into steps". His splitting slip stays. |
| F1 seam | Top row: "Step 1 of 4" as an overline (left) and the paired ticks (right): per Step two 3 by 16 px bars, the current Step 5 by 24, Steps to do dashed in `--faint`, done in `--ink-2`, gap 9 px, aria-hidden. Then the timer centred, Atkinson Hyperlegible Mono 46/1.05, weight 600, −0.01em. A single-Step plan hides the row, as now. |
| F1 "My goal" | Row: his 48 px round portrait (decorative, empty alt; the prototype's character sheet is not built), then the overline "My goal" and his goal in the voice face, 600 15/1.35. |
| F1 card stack | The slip (`--raised`, 1 px `--hairline`, padding 14 14 10, tape) holds: an overline label in the voice face, the card text (15/1.45) in a 124 px scrolling box with the bottom fade mask, and the pager inside it: "‹" and "›" buttons (44 by 44, 24 px, named "Earlier card" and "Newer card", disabled at the ends) with the dots between them (7 px, 1.5 px `--ink-2` ring, the current one filled `--ink`). With more than one card the stacked edges are drawn with the four-layer shadow. Label: "Where I am" on the first card of Step 1, "Right now" on the newest card, "How I got here" on the others. The test-data caption stays (required, decision 0011). |
| F1 "Your goal" panel | `--raised`, 1 px `--hairline`, radius 14: overline "Your goal", the Goal (600 15.5/1.3), "Now" overline inline with the Step title (13.5/1.35, `--ink-2`), the description in `--faint`, and the toggle as a link-styled button "Your steps ▾" / "Your steps ▴" (600 12.5, underlined, `--ink-2`, `aria-expanded`, `aria-controls`). |
| F1 open list | Under a `--hairline`: one row per Step with the mark ✓ (done), ● (now) or ○ (to do) in `--mark` (aria-hidden) and the title; the current row bold with its description as a caption; done and to-do rows in `--ink-2`; the status stays in words for screen readers. |
| F1 buttons | Done (filled tag) and Pause (secondary tag), 62:38, gap 10, 56 px, pinned at the bottom; the middle scrolls. The Undo toast stays above them. |
| Label case | Product words keep their capital in copy where the code has them today except where the prototype's text is quoted above ("Your steps", "Add a step", "Remove step", "Editing"). |

## Approach

Restructure the two shared components in place and add their styles to `src/app/globals.css`,
using tokens and the #244 classes (`button-filled`, `button-gray`, `.try-link`, overline labels,
tape). Line text lives in `src/lib/prototype/goal-lines.ts`; the minutes rule in `plan-edit.ts`;
the "N min" label in `goal-time.ts`.

Considered and dropped: new components per screen (duplicates the shared work and the
`/try` and signed-in pages would need rewiring), and copying the prototype's CSS verbatim (its token
names and global selectors clash with #244's).

## Tests

- New unit tests for the pure rules: `minutesLabel`, the new `changeMinutes` floor of 1 and ±5,
  typed minutes, `addStep` inserting after the open Step, the Plan title fallback, the new lines.
- New e2e checks on `/try/goal` and `/try/focus`, each named after its issue and criterion
  (`#234 AC1 …`), at 390 by 800, light and dark where the look differs.
- Existing tests that encode the old copy or controls ("1 hour", "Change time" visibility, the ack
  line, Move up/Move down inside the editor, "Your Steps", "‹ Earlier card", 15-minute steps) are
  changed on purpose and each change is listed in the pull request. No test is weakened: each keeps
  checking the same behaviour under the new wording.

## Screenshots

From `/try` (same components; the "Test build" badge and the test-data caption are visible), Yue
approved. The session screens always use the dark Oppenheimer skin (C5), so the prototype has one
picture per screen; it is the reference for both the light and the dark capture, as
`compose-compare.mjs` already maps it (`gd1: ["gd1", "gd1"]`). For each of GD1, GD2, GD3, GD4 and F1, light and dark: reference | before (main) | after,
with `scripts/design/capture-app-shared.mjs` and `compose-compare.mjs` extended to the five screens.
Also the four extra states, after only (the prototype has no screenshot of them).

## For the pull request description

- FLOW.md places to update: 4.3 GD1 (composer), GD2 ("Just split it" gone; one slip; Not sure
  line), GD3 (chips; wording), GD4 (descriptions hidden in the list; Goal field; arrows on rows;
  ±5 minutes and typed minutes instead of steps of 15; "Done editing"; Remove step as a link),
  GD-F (the failed-split wording), 3.7 / F1 (card labels, panel, list marks), and item 21 of the
  open questions if the Just-split default is touched (it is not).
- `plan-edit.ts` places changed: `MINUTES_STEP`, `changeMinutes`, a new typed-minutes setter,
  `addStep` position, `countLine` format.
- `DESIGN.md` places the prototype now overrides (for a human): 6.5 composer and field heights,
  6.10 chips radius, 6.11 user bubble, 3.9 stacked shadows, 3.6 timer size.

## Left to the builder

- Exact class names and how the dock is laid out (flex column with a scrolling middle).
- How the thread scrolls to the end after a turn (respect reduced motion: jump, no smooth scroll).
- Where the companion constant lives.
- Whether `TIME_ACKS` can be deleted (only if unused).

# Session screens against prototype v4 (#263)

Issues #234 (GD1), #235 (GD2), #236 (GD3), #237 (GD4), #238 (F1) and #249 (Step minutes).

## How the pictures were made

- **Prototype:** `../reference-screenshots/<screen>.png`. The session screens always use the dark
  Oppenheimer skin (C5), so one prototype picture is the reference for both the light and the dark
  capture.
- **Before:** `origin/main` at `bfd8ac8`, built with `next build` and served with `next start`.
- **After:** this branch, built the same way.
- Both served with `PROTOTYPE_ENABLED=1`, placeholder Supabase values and no model keys, so the test
  path `/try` uses its labelled test data. `/goal` and `/focus` render the same components
  (`src/app/try/goal/goal-dialogue.tsx`, `src/app/_session/focus-body.tsx`); they need a signed-in
  account, which the local run does not have.
- Chromium at 390 by 800, device pixel ratio 2, light and dark system scheme:
  `node scripts/design/capture-app-shared.mjs <url> docs/design/prototype/pr-263 <before|after> <screens>`,
  then `node scripts/design/compose-compare.mjs docs/design/prototype/pr-263`.

## Screens

| Screen | Light | Dark |
|---|---|---|
| GD1 opening | [compare](compare-gd1-light.png) | [compare](compare-gd1-dark.png) |
| GD2 reaction and time | [compare](compare-gd2-light.png) | [compare](compare-gd2-dark.png) |
| GD3 split question | [compare](compare-gd3-light.png) | [compare](compare-gd3-dark.png) |
| GD4 the plan | [compare](compare-gd4-light.png) | [compare](compare-gd4-dark.png) |
| F1 focus | [compare](compare-f1-light.png) | [compare](compare-f1-dark.png) |
| GD-F the split failed | [compare](compare-gd-f-light.png) | [compare](compare-gd-f-dark.png) |
| F1, Your steps open | [compare](compare-f1-you-light.png) | [compare](compare-f1-you-dark.png) |
| GD4, Step editor open (no prototype picture) | [compare](compare-gd4-edit-light.png) | [compare](compare-gd4-edit-dark.png) |
| GD3, time read from the line (no prototype picture) | [compare](compare-gd3-understood-light.png) | [compare](compare-gd3-understood-dark.png) |

## Differences that remain on purpose

- The "Test build" badge above every `/try` page and the "Test data: chapter 8 cards" caption
  (decision 0011). They push the header down by about 44 pixels.
- The story text: the test path plays chapter 8, the prototype's sample mode chapter 1.
- GD2: the time question is a slider with "Not sure" (TIME-SLIDER), not the prototype's
  "30 min", "1 hour", "2 hours" chips and typed box.
- GD2: his reaction comes from the pool for the goal's shape; the specific-goal pool now starts
  with the prototype's "That has a clear edge to it.", but the second line can also be picked.
- F1: his portrait is a picture only; in the prototype it opens a character sheet that the app
  does not have.
- F1: the timer and the number of Steps differ because the plans differ.
- The prototype's phone frame (rounded corners, the notch line) is not part of the app.

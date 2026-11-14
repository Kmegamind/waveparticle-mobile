# The Goals area against prototype v4 (#73)

Issues #73 (G1, G5, G5-D), #77 (G3), #78 with #39 (G4, G4-N, G4-H), #79 (G2b and the detail footer)
and #80 (G6).

## How the pictures were made

- **Prototype:** `../reference-screenshots/<screen>-day.png` for light and `-night.png` for dark.
- **Before:** `origin/main` (the bare Goals list; Goal detail did not exist and answers "not found").
- **After:** this branch.
- Both were built with `next build` and served with `next start`. Both use
  `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3198`, the test-only Supabase stub
  (`node e2e/support/stub-supabase.mjs`), and `PROTOTYPE_ENABLED=1`. The stub is seeded with the
  prototype's sample Goals (`e2e/support/goals-seed.ts`).
- Chromium at 390 by 800, device pixel ratio 2, light and dark:
  `node scripts/design/capture-goals.mjs <url> docs/design/prototype/pr-goals <before|after>`, then
  `node scripts/design/compose-compare.mjs docs/design/prototype/pr-goals`.

## Screens

| Screen | Light | Dark |
|---|---|---|
| G1 In progress | [compare](compare-g1-light.png) | [compare](compare-g1-dark.png) |
| G3 New goal | [compare](compare-g3-light.png) | [compare](compare-g3-dark.png) |
| G4 Goal detail | [compare](compare-g4-light.png) | [compare](compare-g4-dark.png) |
| G4-N nothing open | [compare](compare-g4-n-light.png) | [compare](compare-g4-n-dark.png) |
| G4-H on hold | [compare](compare-g4-h-light.png) | [compare](compare-g4-h-dark.png) |
| G5 On hold | [compare](compare-g5-light.png) | [compare](compare-g5-dark.png) |
| G5-D Done | [compare](compare-g5-d-light.png) | [compare](compare-g5-d-dark.png) |
| G6 History | [compare](compare-g6-light.png) | [compare](compare-g6-dark.png) |

## Differences that remain on purpose

- **App header:** the app header ("WaveParticle") shows above the Goals pages, as it does on every
  signed-in page (shell rule from #244). The prototype draws no header there.
- **Step descriptions (G4):** the Steps on the detail show their description under the title (Yue,
  #78, #39). The prototype draws titles only.
- **Recent sessions (G4):** the rows also show the titles of the Steps done (#80 AC1).
- **History rows (G6):** each row shows the titles of the Steps done (#80 AC1). The rows are not
  links yet ("›" is not drawn), because the Session Record (#75) does not exist. The "All goals" /
  "This week" filter is not built; it does nothing in the prototype either.
- **Export:** not built ("Export: not drawn." in the prototype).
- **Sample data:** "IELTS listening, section 3" has no sessions in the seed, so it shows no
  "2 done this week" line and has no history rows. The dates and minutes come from the seed.

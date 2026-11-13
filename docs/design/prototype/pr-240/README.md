# Shared styling from prototype version 4: pictures (issue #240)

Each picture shows three phones side by side at 390 by 800 pixels: the prototype (version 4), the app on `main` before this change, and the app after it. "Light" is the light system setting and the prototype's day skin; "dark" is the dark system setting and the night skin. The goal dialogue, the focus page and the safety page have only one prototype picture, because the prototype draws the session pages in the Oppenheimer skin and the safety page in the day skin in both settings.

How they were made: `node scripts/design/capture-app-shared.mjs <app address> docs/design/prototype/pr-240 before|after` with the app started with `PROTOTYPE_ENABLED=1` and placeholder Supabase values (no model key, so the test path uses its labelled test data), then `node scripts/design/compose-compare.mjs`.

| Screen | Light | Dark |
|---|---|---|
| Sign in | [compare](compare-auth-in-light.png) | [compare](compare-auth-in-dark.png) |
| Create an account | [compare](compare-auth-up-light.png) | [compare](compare-auth-up-dark.png) |
| Safety (after a flagged test message) | [compare](compare-s1-light.png) | [compare](compare-s1-dark.png) |
| Test path start page (stands in for the Life Path) | [compare](compare-cpage-light.png) | [compare](compare-cpage-dark.png) |
| Goal dialogue, opening | [compare](compare-gd1-light.png) | [compare](compare-gd1-dark.png) |
| Goal dialogue, the plan | [compare](compare-gd4-light.png) | [compare](compare-gd4-dark.png) |
| Focus page | [compare](compare-f1-light.png) | [compare](compare-f1-dark.png) |
| Tab bar (rendered with the app's style sheet on the sign-in page, because the pages that show it need an account) | [after](tab-bar-light-after.png) | [after](tab-bar-dark-after.png) |

## What is done and what is left

| Row | Status |
|---|---|
| C1 Typefaces | Done. The four typefaces are loaded with `next/font`; controls use Atkinson; the sign-in titles are heavy Bricolage. |
| C2 Paper-tag buttons | Done. |
| C3 Filled button colours | Done, in the day, night and Oppenheimer skins. |
| C4 Secondary button | Done. The crisis page's second button is now a secondary paper tag. |
| C5 Session skin | Done for the goal dialogue, the focus page and the rest page; the summary gets it when its page exists (`/try/end`). |
| C6 Glow | Done on every page, following the active skin. |
| C7 No header | Done on the sign-in pages and the safety page. |
| C8 Tab bar | Done: shown where the prototype shows it, in its order, with its icons, label size and selected bar. |
| C9 Text links | Colour, size and weight done. Centring them under the form is page layout and is left to the sign-in screen issues (#229 to #232). |
| C10 Small labels | Done for the existing labels (the focus page). New labels such as "SIGN IN" are page content and are left to the screen issues. |
| C11 Tape | Done: size, place, angle, colour and ring; inside a chat thread (goal dialogue, rest page) only his first slip has tape. |

Seen in the pictures but not part of C1 to C11 (left to the screen issues): the crisis page buttons are as tall as their layout makes them; the chat composer still has a round send button inside a capsule field; the user's own messages in the goal dialogue are still filled with the accent colour.

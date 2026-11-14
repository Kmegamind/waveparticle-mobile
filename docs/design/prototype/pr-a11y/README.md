# Large text and narrow screens (#100, #101, #5)

Each picture has four columns, first screen only:

1. **Prototype v4 reference** (`../reference-screenshots/`).
2. **This branch at normal text size**, 390 px wide. The focus page's clock is hidden in this capture
   so that the comparison does not depend on the second it was taken.
3. **`origin/main` at 200% text**, 320 px wide (the focus page with 15 Steps).
4. **This branch at 200% text**, 320 px wide.

## How they were made

- `next build` and `next start` with `PROTOTYPE_ENABLED=1` and the test-only Supabase stub, seeded
  with the prototype's sample Goals (`e2e/support/goals-seed.ts`). WebKit, iPhone 14 profile, device
  pixel ratio 3. The 200% text is a root `font-size: 200%`; every size token is in rem.
- Signed-in pages: Home, Goals, Me, Companions. Session page: `/try/focus` (the signed-in `/focus`
  draws the same component).

## Normal size is unchanged

Every signed-in page and session screen was captured at 320 px and 390 px before and after this
branch and compared pixel by pixel:

| Page | 390 px | 320 px |
|---|---|---|
| Home, Goals, History, Goal detail, Companions, Life Path, goal dialogue, focus, rest | identical | identical except a sub-pixel shift of the tab bar labels |
| Me | identical layout (the test account's random id differs) | **changed on purpose**: Appearance and Plain text now wrap; on `main` the Day, Night, System control and Off ran past the right edge |

## Intentional differences at large text only

These apply only when fewer than 16 body-size characters fit across the screen (an em-based
container query), which never happens at normal size on a phone:

- Goals tabs wrap onto a second line instead of overlapping.
- Rows that put text beside a portrait or a button stack: Home's Goal card heading, the Companion
  rows, the Life Path header, the goal dialogue's header, History rows and the focus page's
  "My goal".
- The Life Path timeline and Home's Goal card use a smaller indent and padding.
- A word wider than a whole line (the 64 px "Companions" title) still breaks inside the word.

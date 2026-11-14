# Life Path rows (issue #272: #96, #97)

Approved by Yue on 2026-11-14:
- Finished rows get no arrow yet (no record page; #97 AC1 stays open).
- The "his memory" state is built.
- The rest of the plan needs no further approval.

## What is built
- **Model (`src/lib/summary/life-path.ts`).** `lifePath(progress, startId = first story)`.
  - The stories before the account's starting story are `memory` rows, which are never playable.
  - The current story is the first story from the starting point on that is not finished.
  - Under M1 the start is always chapter 1, so no memory row appears today. There is no stored start yet.
  - **Memory line:** the story's goal sentence, the same input text the current card shows. It is no stored line of his (NO-BACKUP).
- **View (`src/app/companions/oppenheimer/life-path-list.tsx`).** A presentational component, so it can be rendered and screenshotted without an account. The page only loads the data.
  - **Finished row:** a filled dot, the title, and his closing line in the voice face. Screen-reader name "Finished: <title>".
  - **Memory row:** an open ring and italic text. Name "His memory: <title>".
  - **Current row:** a heavy ring and the card, with `id="current-story"`. Name "Current story: <title>".
  - **Later row:** a dotted circle and the title only. It is smaller and lighter than the other rows: 15 px at weight 600 against 16 px at weight 700. Screen readers hear "Later, not available", and the title is hidden from them. The row is not focusable.
  - **Colours:** `--ink-2` for later rows, not the prototype's `--faint`. `--faint` is 4.9:1 on the light page, and #96 AC3 requires at least 5:1.
- **Opening on the current card.** A small client component scrolls `#current-story` into view on load. The logic is `scrollToCurrent(doc)`, testable on its own.
- **Look (measured in prototype v4):**
  - a 1.5 px `--hairline` timeline line, with nodes 15 px across (the current node 20 px with a 5 px `--mark` border);
  - period headings at 12 px, weight 700, 0.1em spacing, capitals;
  - 18 px between rows;
  - the header (back row, portrait, name, tags) sticky at the top;
  - the current card's title at 18 px.
- **Not touched:** Home, the Companions list, the goal dialogue, focus, rest, summary, account screens.

## Plan
1. **Model tests (RED, then GREEN):**
   - the memory rows for a later start;
   - the current story at or after the start;
   - the default start unchanged.
2. **View tests (RED, then GREEN):**
   - the names for each state;
   - later rows: the "Later, not available" label, the title `aria-hidden`, no link and no tabindex;
   - the `current-story` id;
   - `scrollToCurrent`.
3. **CSS** from the measured values, using tokens.
4. **Screenshots:** render the view with sample data (a new account, and an account with stories finished) into the built app page in light and dark. Compare with `cpage-day.png` and `cpage-night.png`, and save the pairs in `docs/design/prototype/pr-272/`.
5. Run unit and e2e tests on free ports (#269), lint, format and build, then open one PR.

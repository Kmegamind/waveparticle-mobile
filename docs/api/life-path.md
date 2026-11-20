# src/lib/summary/life-path.ts

`src/lib/summary/life-path.ts`: `lifePath(progress, startId = chapter 1)` gives `{ periods: [{ name, rows }], currentId }`. Each row is `{ id, title, state, line }`, where `state` is `finished`, `memory` (a story before `startId`; its line is the story's goal sentence; none under M1, #272), `current` or `later`.
  - A finished row's `line` is the closing line of its first completed run.
  - The current row's `line` is the story's goal sentence.
  - A later row has no line.

  The current story is the first story with no completion; `storyForNewSession(progress)` is the story a new signed-in session plays (the current one, or the last). The periods are `PERIOD_DRAFTS` in `src/content/oppenheimer/periods.ts`, drafts until PERIOD-NAMES is approved.

# API
There is no HTTP interface yet. The app is a Next.js application with one page (`src/app/page.tsx`).

Planned: Next.js route handlers for goal planning, story card generation, the rest conversation, safety checks and the return pop-up (see `docs/ai/` and `docs/CONTENT_MODEL.md`). When the first handler exists, document it in `docs/api/openapi.yaml`, generated from the real handler (methods, paths, status codes, bodies).

Public code interfaces:

- `src/lib/clock.ts`: `formatClock(totalSeconds)` returns `MM:SS` and never goes below `00:00`.
- `src/lib/story/start.ts`: `startStory(story, plan)` builds the brief for pressing Start. `plan` is a list of `{ minutes }`. The result carries the whole story, the step count taken from the plan, an instruction that the story is divided into that many steps and that the key slices are facts the writer must use, the facts for each step, and `mergedKeyMoments`. That list is empty when every key slice ended its own step. One step has `hasNextStepCards: false` and continues to the summary. No model is called.

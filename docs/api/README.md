# API
There is no HTTP interface yet. The app is a Next.js application with one page (`src/app/page.tsx`).

Planned: Next.js route handlers for goal planning, story card generation, the rest conversation, safety checks and the return pop-up (see `docs/ai/` and `docs/CONTENT_MODEL.md`). When the first handler exists, document it in `docs/api/openapi.yaml`, generated from the real handler (methods, paths, status codes, bodies).

The public code interfaces today are:

- `src/lib/clock.ts`: `formatClock(totalSeconds)` returns `MM:SS` and never goes below `00:00`.
- `src/lib/story/start.ts`: `startStory(story, plan)` builds the brief for pressing Start. `plan` is a list of `{ minutes }`. The result carries the whole story, the step count taken from the plan, an instruction that the story is divided into that many steps and that the key slices are facts the writer must use, the facts for each step, and `mergedKeyMoments`. That list is empty when every key slice ended its own step. One step has `hasNextStepCards: false` and continues to the summary. No model is called.
- `src/lib/safety/keyword.ts`: `checkSafetyText(text)` returns `{ tier, flagged }` and does not return the text. Reused by the crisis page; do not copy its patterns.
- `src/lib/safety/crisis.ts`: `gateFreeText(text)` returns `{ action: "crisis-page", modelRequest: null }` when the keyword layer reports `crisis`, and `{ action: "continue" }` otherwise. The result never includes the text. `submitStepDraft` clears the draft on that path. `backToStep` returns an empty draft. Legal body text and the regional resource are placeholders until `docs/DECISIONS.md` or `docs/CONTENT_MODEL.md` states them.
- `src/lib/model-gateway/`: server-only `createModelGateway` and `createServerModelGateway`. The five calls are `splitPlan`, `writeStepCards`, `writeStuckStory`, `writeRestReply` and `writeReturnPopup`. There is no HTTP route for them yet.
- `src/lib/prototype/config.ts`: `isPrototypeEnabled(env)` is true only when `PROTOTYPE_ENABLED` is `1`. `isTryPath(pathname)` and `tryPathIsHidden(pathname, enabled)` decide the 404 for `/try` in `src/proxy.ts`.
- `src/lib/supabase/session.ts`: `isPublicPath(pathname, prototypeEnabled)` lists the paths a signed-out visitor may open: `/auth/*`, `/safety`, and `/try` only while the test path is on.
- `src/lib/prototype/store.ts`: browser-only test-path state `{ version, goal, steps, currentStep }` with `loadPrototypeState`, `savePrototypeState` and `resetPrototypeState(storage)`. Broken or blocked storage gives the empty state and never throws.
- `src/lib/prototype/test-story.ts`: server-only `loadTestStory()` returns chapter 8 test data (`isTestData: true`): background card, four Steps with cards, pause message, rest replies, return line and closing line. Used only on `/try`.

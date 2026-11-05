# API
There is no HTTP interface yet. The app is a Next.js application with one page (`src/app/page.tsx`).

Planned: Next.js route handlers for goal planning, story card generation, the rest conversation, safety checks and the return pop-up (see `docs/ai/` and `docs/CONTENT_MODEL.md`). When the first handler exists, document it in `docs/api/openapi.yaml`, generated from the real handler (methods, paths, status codes, bodies).

The public code interfaces today are:

- `src/lib/clock.ts`: `formatClock(totalSeconds)` returns `MM:SS` and never goes below `00:00`.
- `src/lib/model-gateway/`: server-only `createModelGateway` and `createServerModelGateway`. The five calls are `splitPlan`, `writeStepCards`, `writeStuckStory`, `writeRestReply` and `writeReturnPopup`. There is no HTTP route for them yet.

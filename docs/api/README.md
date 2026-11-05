# API
There is no HTTP interface yet. The app is a Next.js application with one page (`src/app/page.tsx`).

Planned: Next.js route handlers for goal planning, story card generation, the rest conversation, safety checks and the return pop-up (see `docs/ai/` and `docs/CONTENT_MODEL.md`). When the first handler exists, document it in `docs/api/openapi.yaml`, generated from the real handler (methods, paths, status codes, bodies).

Public code interfaces:

- `src/lib/clock.ts`: `formatClock(totalSeconds)` returns `MM:SS` and never goes below `00:00`.
- `src/lib/safety/keyword.ts`: `checkSafetyText(text)` returns `{ tier, flagged }` and does not return the text. Reused by the crisis page; do not copy its patterns.
- `src/lib/safety/crisis.ts`: `gateFreeText(text)` returns `{ action: "crisis-page", modelRequest: null }` when the keyword layer reports `crisis`, and `{ action: "continue" }` otherwise. The result never includes the text. `submitStepDraft` clears the draft on that path. `backToStep` returns an empty draft. Legal body text and the regional resource are placeholders until `docs/DECISIONS.md` or `docs/CONTENT_MODEL.md` states them.

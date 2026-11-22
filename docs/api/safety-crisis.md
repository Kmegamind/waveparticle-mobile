# src/lib/safety/crisis.ts

`src/lib/safety/crisis.ts`: `gateFreeText(text)` returns `{ action: "crisis-page", modelRequest: null }` when the keyword layer reports `crisis`, and `{ action: "continue" }` otherwise. The result never includes the text. `submitStepDraft` clears the draft on that path. `backToStep` returns an empty draft. Legal body text and the regional resource are placeholders until `docs/DECISIONS.md` or `docs/CONTENT_MODEL.md` states them. It is the browser's keyword-only check; the server runs the classifier too (`docs/api/safety-classifier.md`, #117).

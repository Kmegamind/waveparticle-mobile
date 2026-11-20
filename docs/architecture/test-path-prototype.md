# Test path (prototype)

Sign-in-free `/try` route for test builds only (the goal dialogue, focus and rest pages use the Oppenheimer skin through `src/app/try/try-frame.tsx`), on when `PROTOTYPE_ENABLED` is `1` (the proxy answers 404 otherwise). Progress stays in the browser; chapter 8 generated content is labelled test data (`docs/decisions/0011`)

Path: `src/app/try/`, `src/lib/prototype/`

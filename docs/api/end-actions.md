# src/app/end/actions.ts

`src/app/end/actions.ts`: server action `finishRunAction({ sessionId })` for `/end`. It answers `signed-out` without a signed-in user, and `failed` when the model is not configured or on any error. It does not depend on `PROTOTYPE_ENABLED` (#278). Before calling it, `/end` sends the device's snapshot through `recordFocusProgress` (#257), so the account knows the session is complete.

# src/lib/prototype/split-goal.ts

`src/lib/prototype/split-goal.ts`: `splitGoal(input, deps)`, the logic behind that action: safety gate first, then the model gateway (when `MODEL_API_KEY`, `MODEL_API_URL` and `MODEL_NAME` are set) or the test-data splitter. A non-`generated` result, an error or a plan that does not add up is `failed`. A total outside 1 to 180 minutes (`SLIDER_MAX_MINUTES`, SLIDER-RANGE) or a goal over 500 characters is `failed` before any check or model call. Never logs the goal text.

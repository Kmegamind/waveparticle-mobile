# src/lib/prototype/split-goal.ts

`src/lib/prototype/split-goal.ts`: `splitGoal(input, deps)`, the logic behind that action: safety gate first, then the model gateway (when `MODEL_API_KEY`, `MODEL_API_URL` and `MODEL_NAME` are set) or the test-data splitter. A non-`generated` result, an error or a plan that does not add up is `failed`. Never logs the goal text.

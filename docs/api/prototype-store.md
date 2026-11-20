# src/lib/prototype/store.ts

`src/lib/prototype/store.ts`: browser-only test-path state `{ version, goal, steps, currentStep, storyId? }` (`storyId`: the chosen story, #254) with `loadPrototypeState`, `savePrototypeState` and `resetPrototypeState(storage)`. Broken or blocked storage gives the empty state and never throws.

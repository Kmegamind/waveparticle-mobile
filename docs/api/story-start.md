# src/lib/story/start.ts

`src/lib/story/start.ts`: `startStory(story, plan)` builds the brief for pressing Start. `plan` is a list of `{ minutes }`. The result carries the whole story, the step count taken from the plan, an instruction that the story is divided into that many steps and that the key slices are facts the writer must use, the facts for each step, and `mergedKeyMoments`. That list is empty when every key slice ended its own step. One step has `hasNextStepCards: false` and continues to the summary. No model is called.

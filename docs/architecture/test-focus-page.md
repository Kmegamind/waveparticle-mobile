# Test focus page

`/try/focus`: Step x of N, the clock from timestamps (holds at 00:00), his cards on a slip one at a time with Earlier and Newer (live cards, #43: the chapter 8 Story divided across the Plan's Steps with `startStory`, no user text in the prompt, the next Step's cards asked for once this Step's are in), Done with the 1.2 second hold, Undo toast, Pause to `/try/rest`, last Done to `/try/end`. Session state stays in the browser under its own key; cards come from the model gateway when it is configured, otherwise from labelled test data. `?speed=60` is a test-only speed-up

Path: `src/app/try/focus/`, `src/app/_session/focus-body.tsx`, `src/lib/prototype/session.ts`, `src/lib/prototype/focus-cards.ts`

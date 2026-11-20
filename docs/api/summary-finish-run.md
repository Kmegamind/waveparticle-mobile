# src/lib/summary/finish-run.ts

`src/lib/summary/finish-run.ts` (server):
  - `summaryOf(progress, sessionId)` gives `{ sessionId, storyTitle, goalTitle, steps, planMinutes, finished }` for the account's own Oppenheimer session, or `null`.
  - `finishAccountRun({ sessionId }, { userId, store, writer, gateway, nowIso })` returns `{ status: "ok", shown: { closingLine, carryLine, next } }` or `{ status: "signed-out" | "invalid" | "not-finished" | "failed" }`. The session must be `completed`.
  - When the session already has its closing line, that line comes back with no call.
  - Otherwise the model gets `closingInputFor(storyId, minutes, earlierLines)`: the story's inputs, the facts of the run and his shown cards in order, never Goal or Step text.
  - `nextStoryAfter` gives the next story only on a story's first completion.

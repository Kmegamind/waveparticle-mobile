# src/app/try/rest/actions.ts

`src/app/try/rest/actions.ts`: server actions `loadPauseMessage` and `loadRestReply` used by `/try/rest`. `loadRestReply` runs the safety gate again on the server. Both return `failed` when the test path is off. Not yet covered by a per-browser daily cap on model calls (to be added when the goal-dialogue cap is on `main`).

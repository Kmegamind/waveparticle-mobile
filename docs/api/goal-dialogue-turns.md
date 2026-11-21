# src/lib/goal-dialogue/

`src/lib/goal-dialogue/turns.ts`: `takeTurn(request, deps)` counts and checks one turn of the goal dialogue on the server (#31, `docs/decisions/0026`).

- Requests:
  - `{ kind: "goal", goal }` starts a new dialogue;
  - `{ kind: "time", token, minutes }` takes 1 to 180 minutes, right after the goal turn;
  - `{ kind: "split", token, goal, splitFiner }` is the split answer, where `splitFiner: null` is "Just split it";
  - `{ kind: "split-again", token, goal }` is Split again or Try again, with no limit.
- Outcomes:
  - `{ status: "turn", token, minutes }`, where `minutes` is the time read from the goal or sent, or `null`;
  - `{ status: "plan", token, plan }`;
  - `{ status: "failed", token }`;
  - `{ status: "crisis" }`;
  - `{ status: "refused" }` for a wrong order, a fourth turn, a changed goal line, a forged or day-old token, or no secret.
- `deps`: `{ secret, now, newId, split }`, where `split` is `splitGoal` with its cost-cap deps.
- `MAX_TURNS` is 3 and `DEFAULT_MINUTES` is 30.

`token.ts`:
- `dialogueSecret(env)` returns `GOAL_DIALOGUE_SECRET` when it has at least 32 characters. Otherwise it returns `null` in production and a random key for each process elsewhere.
- `signDialogueToken(state, secret)` and `verifyDialogueToken(token, secret, now, maxAgeMs)` use HMAC-SHA256. A forged, broken or expired token verifies as `null`.
- `goalHash(goal, secret)` gives the keyed hash of the goal line; the token never holds the words.

`server.ts`: `serverTurnDeps(split)` builds the deps for the two actions. It logs `secret_missing` (feature `goal-dialogue`) when there is no key.

# src/app/try/goal/actions.ts

`src/app/try/goal/actions.ts`: server action `splitGoalAction({ goal, totalMinutes, splitFiner })` for the goal dialogue on `/try`. Returns `{ status: "plan", plan }`, `{ status: "failed" }` or `{ status: "crisis" }`. Answers `failed` when the test path is off. Rules in `docs/decisions/0012`.

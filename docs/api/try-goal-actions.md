# src/app/try/goal/actions.ts

`src/app/try/goal/actions.ts`: server action `goalTurnAction(request)` for the goal dialogue on `/try`, one call per turn (#31). It runs `takeTurn` (`src/lib/goal-dialogue/turns.ts`), whose split uses the cost-cap cookie with path `/try`. It answers `{ status: "refused" }` when the test path is off. `src/app/goal/actions.ts` has the same action for signed-in users, `goalTurnForAccountAction(request)` (cookie path `/goal`; `refused` without a user). Rules in `docs/decisions/0012` and `0026`.

# src/lib/prototype/goal-time.ts

`src/lib/prototype/goal-time.ts`: `parseTypedTime(text)` (5 to 300 minutes, rounded to 15, otherwise `null`), `findTimeInGoal(goal)` (GOAL-TIME), `formatMinutes(minutes)` and `TIME_HINT`.

## Cap on a time read from the goal text (#351)

`findTimeInGoal` still returns what the text says (5 to 300 minutes). The goal turn in `src/lib/goal-dialogue/turns.ts` passes it through `capGoalMinutes`, so a stated time over 180 minutes becomes 180 before the split is asked for. `goalTimeWasCapped(goal)` is true in that case; the plan screen then shows `CAPPED_TIME_NOTE` once. The split's own refusal of totals over 180 is unchanged.

# Goal dialogue (prototype)

`/try/goal`: opening, time, split question, editable Plan card and the failure screen (FLOW 4.3). Each turn (goal, time, split answer, Split again, Try again) is a server action that counts and checks it in a signed token (#31, `docs/decisions/0026`); a refused turn shows GD-F. The split inside a turn runs the safety gate, then the model gateway or labelled test data; at most 20 real model calls per browser per day. Start saves the Plan in the browser store (`docs/decisions/0012`)

Path: `src/app/try/goal/`, `src/lib/goal-dialogue/{turns,token,server}.ts`, `src/lib/prototype/{split-goal,test-splitter,cost-cap,goal-time,goal-lines,plan-edit}.ts`

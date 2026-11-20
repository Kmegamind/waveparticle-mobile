# Goal dialogue (prototype)

`/try/goal`: opening, time, split question, editable Plan card and the failure screen (FLOW 4.3). The split is a server action: safety gate, then the model gateway or labelled test data; at most 20 real model calls per browser per day. Start saves the Plan in the browser store (`docs/decisions/0012`)

Path: `src/app/try/goal/`, `src/lib/prototype/{split-goal,test-splitter,cost-cap,goal-time,goal-lines,plan-edit}.ts`

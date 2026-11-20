# Summary (account)

`/end?session=<id>` (END, #258): the last Done of the signed-in focus page opens it for that account session. It shows the story title, his closing line and the line he still carries (one live gateway call, `writeClosingLine`, with no user text, stored once on the session and never generated again; the failure message with Retry; nothing stored in advance is shown), the Goal, the Steps, and the plan length with the real focus time from this device's clocks. Next opens the Life Path on a story's first completion. The last Done's "Step done" Undo toast stays on the summary for the time it had left (#27 AC4, `src/lib/summary/end-undo.ts`); Undo writes the reopened run to the account, then opens `/focus?goal=<id>` on the last Step. `/try/end` (the test path) has no summary. Exists in every environment for signed-in users (#278)

Path: `src/app/end/`, `src/lib/summary/{run,finish-run,run-writer}.ts`

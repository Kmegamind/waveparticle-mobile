# src/lib/summary/run-writer.ts

`src/lib/summary/run-writer.ts`: `claimClosingLine(sessionId, line)` sets `closing_line` only while it is empty (`claimed` or `taken`). A second tab that finds it taken waits for the stored lines. `insertClosingLine` writes the carried line as a `closing` row with a fixed id, ignoring duplicates. Nothing else on the account is written.

Closes #500

## What changed
Adds the hotline list and a new webhook setting.

## Human steps
<!-- "None", or one numbered step per line: [dev], [prod], [dev, prod] or [repo], what, where. -->
1. [dev, prod] Apply to dev, then prod: 20261201000000_example_table.sql (docs/HUMAN_STEPS.md, Apply migrations).
2. [prod] Add EXAMPLE_WEBHOOK_URL in Vercel, Production and Preview, server only (no NEXT_PUBLIC_ prefix), then redeploy.
3. [repo] Paste the text below into AGENTS.md on this branch before merging.

## How to test
- [x] `npm test` passes

# 0034: Record prompt lab runs in a server-written run log with a steps table
- Status: proposed
- Date: 2026-11-26
- Issue: #476

## Context
AI-RUN-PERMISSION lets admin and writer press Run with no spending cap; the record and a read-only "today's spend" line are the only guards (FR-AILAB-3). So every run must be recorded, the record must be trustworthy (a writer must not be able to write or change run rows, for example a cost or the stub flag), and the model key must stay on the server (FR-AILAB-2). FR-AILAB-8 asks that a multi-step run is one run with its steps listed. Tests and agents use the fake model only (AI-LAB-STUB, AI-RUN-LIVE).

## Options
| Option | For | Against |
|---|---|---|
| Insert policy for content editors on `ai_runs` | Simple | A writer's browser could insert or forge rows (stub flag, cost, who) |
| Security-definer functions that need a content editor only | Who and when set in the database | Still callable from the browser with any content |
| **Security-definer functions that need a content editor and the server's prompt reader token** | Only the server route writes; who and when from the database; no new secret (same pattern as `record_safety_classifier_failure`, 20261127000000) | The prompt reader token now also guards these writes; rotating it touches the run log |
| A new server-only token for the run log | Separate secret | One more secret and production step for the owner |
| One write after the model call | One call | A call stopped or failed between the model and the write is billed with no record |
| **A row written before the call (running), ended after it** | No call reaches the model without a row; a stopped call leaves a running row that counts in the spend | Two writes per run; a row can stay running |
| Steps as a `jsonb` list on the run | One table, one insert | Step tokens and costs cannot be summed or checked by constraints |
| **Steps in a child table `ai_run_steps`** | Each step checked like a run; sums and comparisons in SQL | One more table and policy |
| Cost in code with fixed prices | No setting | Invents prices; prices change |
| **Cost from tokens and an owner-set price in US dollars (`AI_RUN_PRICES`)** | No invented price; null and "price not set" until set | One more server setting |
| `feature_slug` with `on delete cascade` or `set null` | Registry rows can always be deleted | Deleting a row would delete or blur the spend record |
| **`feature_slug` without cascade** | The run log is kept | A registry row with runs cannot be deleted until its runs are |

## Decision
A run's row is written by `public.start_ai_run` (status running) before the model call and ended by `public.finish_ai_run`, both needing a signed-in content editor and the server's existing prompt reader token, with steps in the child table `public.ai_run_steps`, the cost computed on the server from the reported tokens and the owner's `AI_RUN_PRICES` in US dollars (null, "price not set", when unset), and `feature_slug` kept without cascade.

## Consequences
- Content editors read every run and step; app users and anon read nothing; no API role writes directly.
- If the start row cannot be written (no token, a missing hash row, a database error), the route does not call the model (`not-recorded`). After the call, the end may still fail to be stored (a failed finish, or Vercel stopping the function): the row then stays `running`, is counted in the spend as a running run with no cost, and the answer says `recorded: false`. So every call that reached the model has a row, but its cost can be missing; the Runs page (#477) must show running rows.
- The route sets `maxDuration = 150` s for a 120 s lab call; the owner confirms that the Vercel plan and Fluid compute allow it, or both numbers are lowered together. A version's `max_tokens` is capped at 8192 (default 4096).
- The stub flag is set by the server from the model settings (`MODEL_NAME` `stub` or a loopback `MODEL_API_URL`), never by the browser.
- `feature_slug` has no cascade: a registry row with runs cannot be deleted. `registry-seed.mjs --undo` stops before any change and names the rows, and the undo of `20261130000000_ai_features.sql` fails. The run log's undo must come first; deleting runs loses spend history and is an owner decision (export first).
- Rotating `PROMPTS_READ_TOKEN` now also affects the run log: add the new hash row before switching the server setting, and remove the old one after, or Runs answer `not-recorded` in between.
- The sample library (#479) adds the foreign key on `sample_id`; a multi-step run (FR-AILAB-8) passes its steps to `finish_ai_run`.
- Owner: set `AI_RUN_PRICES` for the production model from the provider's USD price list; until then costs are null.

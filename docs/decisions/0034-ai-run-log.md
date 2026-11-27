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
| Security-definer function that needs a content editor only | Who and when set in the database | Still callable from the browser with any content |
| **Security-definer function that needs a content editor and the server's prompt reader token** | Only the server route writes; who and when from the database; no new secret (same pattern as `record_safety_classifier_failure`, 20261127000000) | The prompt reader token now also guards a write; rotating it touches both |
| A new server-only token for the run log | Separate secret | One more secret and production step for the owner |
| Steps as a `jsonb` list on the run | One table, one insert | Step tokens and costs cannot be summed or checked by constraints |
| **Steps in a child table `ai_run_steps`** | Each step checked like a run; sums and comparisons in SQL; written in the same function call | One more table and policy |
| Cost in code with fixed prices | No setting | Invents prices; prices change |
| **Cost from tokens and an owner-set price (`AI_RUN_PRICES`)** | No invented price; null and "price not set" until set | One more server setting |

## Decision
Runs are written only by `public.record_ai_run(server_token, run)`, which needs a signed-in content editor and the server's existing prompt reader token, with steps in the child table `public.ai_run_steps`, and the cost computed on the server from the reported tokens and the owner's `AI_RUN_PRICES` (null, "price not set", when unset).

## Consequences
- Content editors read every run and step; app users and anon read nothing; no API role writes directly.
- The route refuses to call a model when it cannot record (`no-run-log`), so no unrecorded spend.
- The stub flag is set by the server from the model settings (`MODEL_NAME` `stub` or a loopback `MODEL_API_URL`), never by the browser.
- `feature_slug` references `public.ai_features` without cascade: a registry row with runs cannot be deleted (the run log is kept).
- The sample library (#479) adds the foreign key on `sample_id`; a multi-step run (FR-AILAB-8) passes its steps to the same function.
- Owner: set `AI_RUN_PRICES` for the production model from the provider's price list (currency US dollars is proposed here); until then costs are null.

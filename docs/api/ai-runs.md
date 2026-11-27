# Prompt lab runs and the run log (#476)

The server side of the prompt lab's Run (docs/PRD.md section 4.15, FR-AILAB-1 to FR-AILAB-3 and FR-AILAB-8; AI-RUN-PERMISSION, AI-RUN-LIVE, AI-LAB-STUB; `docs/decisions/0034`). There is no screen yet: the Run panel and the Runs page come in #477, the sample library in #479.

## The tables (`supabase/migrations/20261203000000_ai_runs.sql`)

- `public.ai_runs`, one row per Run: `id`, `run_by` (the account; null once deleted), `run_at`, `feature_slug` (`public.ai_features.slug`), `prompt_key`, `prompt_source` (`published`, `draft` or `pasted`), `prompt_version` (null for a pasted text), `pasted_text` (only for `pasted`), `sample_id` (null until #479 adds the library and its foreign key), `model`, `input` (the filled prompt as sent), `output` (null when the model gave none), `input_tokens`, `output_tokens` (as the provider reported them, else null), `cost` (US dollars, `numeric(14, 8)`, null when no price is set or no tokens were reported), `stub` (true when the model was the test stub), `status` (`ok` or `error`) and `error_reason` (required for `error`, else null).
- `public.ai_run_steps`, the steps of a multi-step run (FR-AILAB-8): `run_id`, `position` (1-based), `label`, `prompt_key`, `prompt_version`, `input`, `output`, tokens, `cost`, `status`, `error_reason`. A one-call run has no step rows; a multi-step run's row carries the totals, the first step's input and the last step's output. The route of this issue runs one call; a multi-step run (for example #478) passes its steps to the same function.
- Row level security: content editors (admin or writer) read every row of both tables; accounts without a role and `anon` read nothing. No API role inserts, updates or deletes either table.
- `public.record_ai_run(server_token text, run jsonb) returns uuid`: the only way a run is written. It needs the server's prompt reader token (`PROMPTS_READ_TOKEN`, checked against `private.prompt_reader`) and a signed-in content editor; `42501` otherwise. `run_by` is `auth.uid()` and `run_at` is `now()`; the caller never sends them. `run` holds the columns above and an optional `steps` list. A browser cannot write or forge a run, because only the server holds the token.
- `public.ai_run_spend(from_time timestamptz, to_time timestamptz)` returns `(user_id, email, runs, unpriced_runs, cost)` for `from_time <= run_at < to_time`, one row per account, the largest cost first; content editors only (`42501`). `unpriced_runs` counts runs with a null cost.
- There is no spending cap (AI-RUN-PERMISSION); nothing refuses a run for its cost.

## The route: `POST /admin/ai-runs/run`

`src/app/admin/ai-runs/run/route.ts`; the logic is `runPrompt(request, deps)` in `src/lib/ai-runs/run.ts`.

Body:

```json
{
  "feature": "rest_reply",
  "promptKey": "rest_reply",
  "prompt": { "source": "published" },
  "sample": null,
  "model": "<MODEL_NAME>"
}
```

`prompt` is `{ "source": "published" }` (the active version), `{ "source": "draft", "version": n }` (a stored version; recorded as `published` if it is the active one) or `{ "source": "pasted", "text": "..." }` (at most 20 000 characters, trimmed; it takes the published version's settings for its checks). `promptKey` must be one of the feature's `prompt_keys`. `model` must be the configured `MODEL_NAME`, the only model offered for now. `sample` is a sample id or null; until #479 every id is unknown.

Order of checks: a signed-in admin or writer, else `403 not-allowed` (the proxy already answers `404` under `/admin` to anyone without a role, so an app user or a visitor gets `404`); a well-formed body, else `400 invalid`; a configured model (`503 no-model`), the named model (`400 unknown-model`), the run log (`503 no-run-log` without `PROMPTS_READ_TOKEN`: nothing is sent to a model that cannot be recorded); then the feature (`404 unknown-feature`), the version (`404 unknown-prompt`), the sample (`404 unknown-sample`) and the filled prompt (`422 prompt-problem` with `problems`). A read that fails is `500 failed`. Nothing reaches the model before all of these pass.

The prompt sent: for a runtime feature with a sample that carries the gateway call's input (`sample.calls[<key>]`), the gateway builds the prompt with its own builder and checks the answer with its own parse and line checks (`buildLabCall` in `src/lib/model-gateway/gateway.ts`; one answer, no retry). With a sample that has no call input, `{{variables}}` are filled from `sample.values` (`renderPrompt`). Without a sample, the prompt is sent as written. No user text is ever sent: only a prompt and a sample.

Answer `200`:

```json
{
  "ok": true,
  "runId": "uuid",
  "recorded": true,
  "output": "...",
  "checks": { "applied": true, "passed": false, "failedRules": ["len"] },
  "inputTokens": 120,
  "outputTokens": 30,
  "cost": 0.00018,
  "costNote": null,
  "stub": true,
  "model": "stub",
  "promptVersion": 1
}
```

`checks` is `{ "applied": false, "note": "The checks need a sample." }` for a runtime feature without a sample's call input, and `{ "applied": false, "note": "No checks for a pipeline feature." }` (or `gate`) otherwise. `costNote` is `"price not set"` or `"tokens not reported"` when `cost` is null. `recorded: false` (and `runId: null`) means the answer came but the record failed.

A model error is also `200`, and recorded with `status: "error"`: `{ "ok": false, "error": "model-error", "reason": "request" | "timeout", "runId", "recorded", "stub", "model" }`. Only the fixed reason is kept, never the provider's message. The waiting time is 120 seconds (`LAB_TIME_LIMIT_MS`) and the answer's ceiling is the version's `params.max_tokens` or 4096 tokens (`LAB_MAX_TOKENS`).

## The model and its key

`labModelFromEnv` (`src/lib/ai-runs/model.ts`) reads the gateway's `MODEL_API_KEY`, `MODEL_API_URL` and `MODEL_NAME`. The key stays in the call's closure and goes only into the provider request's `authorization` header (`createHttpModelCall` in `src/lib/model-gateway/http.ts`, which also reads `usage.prompt_tokens` and `usage.completion_tokens`); it is never in a field, an answer, an error or the run log (FR-AILAB-2). The model is marked `stub` when `MODEL_NAME` is `stub` or `MODEL_API_URL` is on a loopback address (the e2e stub model listens on 127.0.0.1).

## Cost

`AI_RUN_PRICES` (server only, Production and Preview) is JSON set by the owner: `{"<MODEL_NAME>": {"input_per_million_tokens": n, "output_per_million_tokens": n}}`, in US dollars. `cost = (input_tokens * input price + output_tokens * output price) / 1 000 000`, rounded to 8 decimals (`runCost` in `src/lib/ai-runs/cost.ts`). Unset, malformed (a negative or missing price included) or without the model's name: the cost is null and the answer says "price not set". No price is written in the code.

## Spend (for the Runs page, #477)

`readRunSpend(rpc, now?)` (`src/lib/ai-runs/spend.ts`) calls `ai_run_spend` for today's UTC day (`todayWindow`) and returns `{ day, runs, unpricedRuns, cost, byUser: [{ userId, email, runs, unpricedRuns, cost }] }`, or null when it cannot be read (a refused role included).

## Tests

`tests/ai-runs.test.ts` (fake models with stub = true and fixed token counts, an invented test price) and `e2e/ai-runs.live.spec.ts` (the "mobile-live" app with the stub model, which answers with 120 input and 30 output tokens and a provider error for the exact prompt `STUB MODEL ERROR`; test price in `playwright.config.ts`). The e2e Supabase stand-in serves `record_ai_run`, `ai_run_spend`, `ai_runs` and `ai_run_steps`. No test calls a real model.

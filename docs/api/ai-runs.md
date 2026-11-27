# Prompt lab runs and the run log (#476)

The server side of the prompt lab's Run (docs/PRD.md section 4.15, FR-AILAB-1 to FR-AILAB-3 and FR-AILAB-8; AI-RUN-PERMISSION, AI-RUN-LIVE, AI-LAB-STUB; `docs/decisions/0034`). The screens are the Run panel and the Runs page (#477, below); the sample library is #479 (`docs/api/ai-samples.md`).

## The tables (`supabase/migrations/20261203000000_ai_runs.sql`)

- `public.ai_runs`, one row per Run: `id`, `run_by` (the account; null once deleted), `run_at`, `finished_at` (null while running), `feature_slug` (`public.ai_features.slug`), `prompt_key`, `prompt_source` (`published`, `draft` or `pasted`), `prompt_version` (null for a pasted text), `pasted_text` (only for `pasted`), `sample_id` (null until #479 adds the library and its foreign key), `model`, `input` (the filled prompt as sent), `output` (null when the model gave none), `input_tokens`, `output_tokens` (as the provider reported them, else null), `cost` (US dollars, `numeric(14, 8)`, with a column comment saying so; null when no price is set, no tokens were reported, or the run is still running), `stub` (true when the model was the test stub), `status` (`running`, `ok` or `error`) and `error_reason` (required for `error`, else null).
- **A run's row is written before the model call** with the status `running`, and ended as `ok` or `error` after it. A row that stays `running` is a call that may have been billed but whose end was never stored (the function was stopped, or the finish failed). It still counts in the spend (`running_runs`), so the Runs page can show it.
- `public.ai_run_steps`, the steps of a multi-step run (FR-AILAB-8): `run_id`, `position` (1-based), `label`, `prompt_key`, `prompt_version`, `input`, `output`, tokens, `cost`, `status` (`ok` or `error`), `error_reason`. A one-call run has no step rows; a multi-step run's row carries the totals, the first step's input and the last step's output. The route of this issue runs one call; a multi-step run (for example #478) passes its steps to `finish_ai_run`.
- Row level security: content editors (admin or writer) read every row of both tables; accounts without a role and `anon` read nothing. No API role inserts, updates or deletes either table.
- `public.start_ai_run(server_token text, run jsonb) returns uuid`: writes the row with the status `running`; `run` holds `feature_slug`, `prompt_key`, `prompt_source`, `prompt_version`, `pasted_text`, `sample_id`, `model`, `input` and `stub`. `run_by` is `auth.uid()` and `run_at` is `now()`; the caller never sends them, nor any result column.
- `public.finish_ai_run(server_token text, run_id uuid, result jsonb) returns void`: ends a running run with `output`, `input_tokens`, `output_tokens`, `cost`, `status` (`ok` or `error`, else `22023`), `error_reason` and an optional `steps` list, and sets `finished_at`. Only the account that started the run can end it, and only once (`P0002` otherwise).
- Both need the server's prompt reader token (`PROMPTS_READ_TOKEN`, checked against `private.prompt_reader` by `private.ai_run_writer_ok`) and a signed-in content editor; `42501` otherwise. A browser cannot write or forge a run, because only the server holds the token.
- `public.ai_run_spend(from_time timestamptz, to_time timestamptz)` returns `(user_id, email, runs, unpriced_runs, running_runs, cost)` for `from_time <= run_at < to_time`, one row per account, the largest cost first; content editors only (`42501`). `unpriced_runs` counts runs with a null cost (running ones included); `running_runs` counts runs never ended.
- There is no spending cap (AI-RUN-PERMISSION); nothing refuses a run for its cost.

**Deleting registry rows.** `feature_slug` has no cascade, on purpose: the run log is the only guard on spending, so it is never deleted with a registry row. Once a row has runs, deleting it fails (`23503`): `scripts/ai-features/registry-seed.mjs --undo` stops before any change and names the rows, and the undo of `20261130000000_ai_features.sql` fails too. The run log's own undo (below) must come first, and deleting runs loses their spend history: an owner decision. Export `public.ai_runs` and `public.ai_run_steps` first if they hold real runs.

Undo of the migration: `drop function public.ai_run_spend(timestamptz, timestamptz); drop function public.finish_ai_run(text, uuid, jsonb); drop function public.start_ai_run(text, jsonb); drop function private.ai_run_writer_ok(text); drop table public.ai_run_steps; drop table public.ai_runs;` then, for the CLI's history, `supabase migration repair --status reverted 20261203000000` (owner only, `docs/HUMAN_STEPS.md`).

## The route: `POST /admin/ai-runs/run`

`src/app/admin/ai-runs/run/route.ts`; the logic is `runPrompt(request, deps)` in `src/lib/ai-runs/run.ts`.

Body (`content-type: application/json`, at most 128 KiB):

```json
{
  "feature": "rest_reply",
  "promptKey": "rest_reply",
  "prompt": { "source": "published" },
  "sample": null,
  "model": "<MODEL_NAME>"
}
```

`prompt` is `{ "source": "published" }` (the active version), `{ "source": "draft", "version": n }` (a stored version; recorded as `published` if it is the active one) or `{ "source": "pasted", "text": "..." }` (at most 20 000 characters, trimmed; it takes the published version's settings for its checks). `promptKey` must be one of the feature's `prompt_keys`. `model` must be the configured `MODEL_NAME`, the only model offered for now. `sample` is a sample id (`public.ai_samples.id`) or null. #477: the route reads the sample and its excerpt with the user's own client (`readLabSample` in `src/lib/ai-samples/variables.ts`); an id the account cannot read is `404 unknown-sample`.

Order of checks:

1. Another site's request (`Sec-Fetch-Site` other than `same-origin`, or an `Origin` whose host is not this host): `403 cross-origin`; a body that is not JSON: `415 not-json`; a body over 128 KiB: `413 too-large` (`runRequestProblem` in `src/lib/ai-runs/request-guard.ts`). A request with neither header is not from a browser and cannot carry a person's cookies by surprise.
2. A signed-in admin or writer, else `403 not-allowed` (the proxy already answers `404` under `/admin` to anyone without a role, so an app user or a visitor gets `404`).
3. A well-formed body (`400 invalid`), a configured model (`503 no-model`), the named model (`400 unknown-model`), a run log (`503 no-run-log` without `PROMPTS_READ_TOKEN`).
4. The feature (`404 unknown-feature`), the version (`404 unknown-prompt`), the sample (`404 unknown-sample`) and the filled prompt (`422 prompt-problem` with `problems`). A read that fails is `500 failed`.
5. The run's row (`start_ai_run`). If it cannot be written: `503 not-recorded`, and **the model is not called**.

Nothing reaches the model before all of these pass.

The prompt sent: for a runtime feature with a sample that carries the gateway call's input (`sample.calls[<key>]`), the gateway builds the prompt with its own builder and checks the answer with its own parse and line checks (`buildLabCall` in `src/lib/model-gateway/gateway.ts`; one answer, no retry). With a sample that has no call input, `{{variables}}` are filled from `sample.values` (`renderPrompt`). #477 (`docs/decisions/0037`): a library sample fills the names of the table `SAMPLE_VARIABLES` (Companion → `{{name}}`, `{{character_name}}`; mode → `{{mode}}`; persona → `{{persona}}`; the excerpt → `{{source_excerpt}}`, `{{story_source}}`; the source named → `{{source_label}}`; background, facts (one per line, "- "), world record, standing task → their snake_case names; the finished plan → `{{plan}}` and its goal → `{{goal}}`). A variable the prompt uses whose sample field is empty stops the run with `422 prompt-problem` ("This sample has no Source excerpt, which {{story_source}} needs."), before the row and the model call; no variable is optional for now. Any other `{{variable}}` stops the run with `422 prompt-problem` naming it, before the row and the model call; with no sample the prompt is sent as written. A runtime prompt run with a library sample answers `checks: { applied: false, note: "The checks need the call's input, which this sample does not hold." }`. Without a sample, the prompt is sent as written. No user text is ever sent: only a prompt and a sample.

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

`checks` is `{ "applied": false, "note": "The checks need a sample." }` for a runtime feature without a sample's call input, and `{ "applied": false, "note": "No checks for a pipeline feature." }` (or `gate`) otherwise. `costNote` is `"price not set"` or `"tokens not reported"` when `cost` is null. `recorded: false` means the answer came but the run's end could not be stored: the row stays `running` (with `runId`) and still counts in the spend; #477 should show this loudly.

A model error is also `200`, and the run ends with `status: "error"`: `{ "ok": false, "error": "model-error", "reason": "request" | "timeout", "runId", "recorded", "stub", "model" }`. Only the fixed reason is kept, never the provider's message.

**Time and tokens.** The lab call waits at most 120 seconds (`LAB_TIME_LIMIT_MS`). The route sets `export const maxDuration = 150` (seconds): the call plus 30 seconds for the reads and the two run log writes. On Vercel this needs a plan and Fluid compute setting that allow 150 s; the owner confirms them (Human steps of #476). If the project's limit is lower, lower `LAB_TIME_LIMIT_MS` and `maxDuration` together, keeping `maxDuration` at least 30 s above the lab wait. If Vercel stops the function anyway, the row stays `running`. The answer asks for the version's `params.max_tokens`, else 4096 tokens (`LAB_MAX_TOKENS`); a value above 8192 (`LAB_MAX_TOKENS_CAP`) is lowered to 8192.

## The model and its key

`labModelFromEnv` (`src/lib/ai-runs/model.ts`) reads the gateway's `MODEL_API_KEY`, `MODEL_API_URL` and `MODEL_NAME`. The key stays in the call's closure and goes only into the provider request's `authorization` header (`createHttpModelCall` in `src/lib/model-gateway/http.ts`, which also reads `usage.prompt_tokens` and `usage.completion_tokens`); it is never in a field, an answer, an error or the run log (FR-AILAB-2). The model is marked `stub` when `MODEL_NAME` is `stub` or `MODEL_API_URL` is on a loopback address (the e2e stub model listens on 127.0.0.1).

## Cost

`AI_RUN_PRICES` (server only, Production and Preview) is JSON set by the owner, in **US dollars**: `{"<MODEL_NAME>": {"input_usd_per_million_tokens": n, "output_usd_per_million_tokens": n}}`. Use the provider's USD price list (some providers also publish other currencies). `cost = (input_tokens * input price + output_tokens * output price) / 1 000 000`, rounded to 8 decimals (`runCost` in `src/lib/ai-runs/cost.ts`). Unset, or without the model's name: the cost is null and the answer says "price not set". Malformed (not JSON, a negative or missing price, other field names): the same, and the server logs one warning `ai_run_prices_malformed` (feature `ai-runs`; never the value). No price is written in the code.

## Spend (for the Runs page, #477)

`readRunSpend(rpc, now?)` (`src/lib/ai-runs/spend.ts`) calls `ai_run_spend` for today's UTC day (`todayWindow`) and returns `{ day, runs, unpricedRuns, runningRuns, cost, byUser: [{ userId, email, runs, unpricedRuns, runningRuns, cost }] }`, or null when it cannot be read (a refused role included).

## Tests

`tests/ai-runs.test.ts` (fake models with stub = true and fixed token counts, an invented test price) and `e2e/ai-runs.live.spec.ts` (the "mobile-live" app with the stub model, which answers with 120 input and 30 output tokens and a provider error for the exact prompt `STUB MODEL ERROR`; test price in `playwright.config.ts`). The e2e Supabase stand-in serves `start_ai_run`, `finish_ai_run`, `ai_run_spend`, `ai_runs` and `ai_run_steps`. No test calls a real model.

## The Run panel (#477): `/admin/ai-features/<slug>/run`

Drawing AIR-3 (`#reg-run`), opened by **Run** in the feature page's header. `src/app/admin/ai-features/[slug]/run/page.tsx` reads the row, its prompt versions (`list_prompt_versions`), the sample library and today's spend with the signed-in user's own client and gives the browser only the model's name and stub flag (never the key). `run-panel.tsx` posts the body above to the route.

- Settings: the prompt key (only when the row has more than one), Published, Draft (the newest draft) or Pasted text, the sample (first sample by default, or "No sample (the prompt as written)"), the model (the configured `MODEL_NAME` only), Run, and "Today's spend (UTC day): $x. Not a cap." Before Run the panel names the prompt's variables a sample does not fill.
- In progress: "Run in progress", what runs, "started by you", the stub marker and a still bar; Run is disabled. There is no Cancel (the server keeps the call once sent).
- Answer: the stub marker "Fake model (stub)" when the fake model ran, the text, the checks that apply (Pass, or each failed rule, or why none ran), tokens, cost ("$0.000180 (stub, no charge)"; "Price not set" when `AI_RUN_PRICES` has no price), prompt version, sample. `recorded: false` shows an alert above the answer: the end was not recorded.
- Errors: a model error and every refusal show an error box with **Retry** (the same settings again).
- **Set as candidate example** and **Confirm** call `setRunExampleAction` (`src/app/admin/ai-runs/actions.ts`, logic `setExampleFromRun` in `src/lib/ai-runs/example.ts`): the run's output is read again on the server by the run's id (only an `ok` run of this feature) and stored through #475's `setFeatureExample` / `set_ai_feature_example`, as candidate or as confirmed (one action, AI-EXAMPLE-CONFIRM), with the "changed since" check and the history.

## The Runs page (#477): `/admin/ai-runs`

Drawing AIR-5 (`#reg-runs`), menu "Runs" (AIR-5). `src/app/admin/ai-runs/page.tsx`, logic in `src/lib/ai-runs/log.ts`; read only, calls no model.

- Tiles: today's spend (`readRunSpend`, with the count of runs without a cost), runs today, stub runs and real model runs (today is the UTC day).
- Total by user, today (UTC): runs and spend per account (`ai_run_spend`), by email.
- Filter: feature, user, model, "Stub runs only"; in the address (`?feature=&user=&model=&stub=1`).
- The log: the newest 500 runs (`RUNS_SHOWN`): when, who, feature, version, sample, model, tokens, cost, stub, result. A run still `running` 180 s after it started (`RUN_END_WAIT_MS`, the route's 150 s plus 30 s) shows "End not recorded".
- Detail (`?run=<id>`, the newest by default): who and when, feature and prompt key, version, sample, model with tokens and cost, result, the input and the output (or the model error with Retry to the Run panel, or the run in progress, or "The end of this run was not recorded"), and the steps of a multi-step run.
- Names: `ai_run_spend` over all time gives each account's email.

The e2e stand-in gives an account its own run log (`e2e/support/stub-ai-runs.mjs`): `POST /__ai_runs { token, log: "own" | "seeded" | null, failFinish? }`.

## The comparison lab (#478): `/admin/ai-lab`

`src/app/admin/ai-lab/` (page, `lab.tsx`, `actions.ts`), the logic in `src/lib/ai-runs/comparison.ts`; drawing AIR-4 (`#reg-lab`); `docs/decisions/0038`. FR-AILAB-4, FR-AILAB-5.

- Settings: Feature (every registry row; `?feature=<slug>` chooses the first one), Prompt (only for a row with more than one key), Sample (the same for both sides, or "No sample"), Side A and Side B, Blind (on by default) and **Run both**. A side is a prompt version (published or draft, on the first model) or a model (the published version, or the draft when there is none, on that model). By default side A is the published version and side B the draft, else the second model.
- **Run both** posts each side to `POST /admin/ai-runs/run` at the same time, through the browser's shared client of the route (`postRun`, `src/lib/ai-runs/client.ts`, also used by the Run panel). Each side is an ordinary run: checked, refused before the model when the sample leaves a variable empty, recorded and priced. A side that fails shows its own error with Retry.
- **Blind** shows the two answers in a random order as "Side 1" and "Side 2", with "Hidden until answered", until every pass question of both sides is answered; then each panel says which side and which version or model it is. Not blind: side A on the left.
- Each side lists the feature's pass questions (`public.ai_features.pass_questions`) with **Yes** and **No**. **Save result** is enabled when both sides have an answer whose run was recorded and every question has yes or no; it calls the server action `saveComparisonAction`, which checks the account and role and calls `public.save_ai_comparison`. A feature without pass questions cannot be saved (the panel says to write them on the feature page).
- Models: the gateway's model (`MODEL_*`), and a second one only when `LAB_MODEL_2_API_KEY`, `LAB_MODEL_2_API_URL` and `LAB_MODEL_2_NAME` are all set and the name differs (`labModelsFromEnv`, `src/lib/ai-runs/model.ts`). The Run route runs the model a request names (`pickLabModel`); any other name is `400 unknown-model`. The browser gets only the names and whether each is the stub. The Run panel still offers the first model only.

### The table (`supabase/migrations/20261206000000_ai_comparisons.sql`)

- `public.ai_comparisons`, one row per saved comparison: `id`, `saved_by`, `saved_at`, `feature_slug`, `sample_id` (null when both ran without one), `run_a`, `run_b` (each `public.ai_runs.id`, each in at most one comparison), `blind` (true when the names stayed hidden until every answer was given), `questions` (the pass questions' texts when the answers were given), `answers_a`, `answers_b` (one boolean per question: true yes, false no).
- `public.save_ai_comparison(comparison jsonb) returns uuid`; `comparison` holds `run_a`, `run_b`, `blind`, `answers_a`, `answers_b`. Only a signed-in content editor (`42501`); both runs must exist (`P0002`), be the caller's own, ended `ok`, different, of one feature and one sample (`22023`); the feature must have pass questions and each list one boolean per question (`22023`); a run already in a comparison is `23505`. Who, when and the questions are set by the function.
- Content editors read every row; no API role writes the table.
- Undo: `drop function public.save_ai_comparison(jsonb); drop table public.ai_comparisons;` (before the run log's own undo).

The e2e stand-in keeps an account's comparisons with its own run log (`e2e/support/stub-ai-comparisons.mjs`): `POST /rest/v1/rpc/save_ai_comparison` and `GET /rest/v1/ai_comparisons`, as the migration.

# Live-generation latency and cost benchmark

## Required benchmark

The benchmark should run the prompts in `docs/ai/` against at least two
approved providers, with 20 sessions per provider. A session must exercise the
live-generation surfaces that affect the focus flow:

- the first story card and a scheduled later story card;
- a stuck-story message;
- a return pop-up;
- a rest-chat reply; and
- a closing line.

For every call, record provider, model, prompt name, input and output token
counts, time to first token, total time, success/check result, and fallback
usage. Do not record goal text, Step text, chat text, or other user data.

The report should calculate:

- median and p95 first-token latency;
- median and p95 total latency;
- cost per call and cost for a one-hour session; and
- the percentage of scheduled cards ready by their reveal time.

A card is ready when its checked output is available before its scheduled
foreground-time boundary. The first card has an immediate boundary and must
therefore be authored or prefetched before the Step opens. Later cards must
arrive before their `y / n`, `2y / n`, ... foreground-time boundaries, subject
to the five-minute minimum gap.

## Benchmark implementation

The repository now contains:

- `scripts/live-generation-benchmark.config.json`, which records the reviewed
  model names, prices, pricing conditions, source URLs and the `$2` cap.
- `scripts/live-generation-benchmark.mjs`, which runs 20 sessions per
  provider across six calls per session: first story card, later story card,
  stuck-story message, return pop-up, rest-chat reply and closing line.
- `tests/live-generation-benchmark.test.ts`, which checks the provider
  configuration, numeric cost calculation, schedule boundary and hard cap.

The configured models and prices reviewed on 2026-11-05 are:

| Provider | API model name | Served/current model | Input / 1M tokens | Output / 1M tokens | Pricing condition |
|---|---|---|---:|---:|---|
| DeepSeek | `deepseek-flash` | DeepSeek-V4.1-Flash-1017 | $0.15 | $0.60 | Uncached input, off-peak |
| Gemini | `gemini-3.8-flash` | Gemini 3.8 Flash | $0.75 | $3.75 | Paid tier standard through 2026-12-31 |

Sources are recorded in the config rather than copied into benchmark output:
[DeepSeek model documentation](https://api-docs.deepseek.com/guides/models),
[DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing),
[Gemini model documentation](https://ai.google.dev/gemini-api/docs/models), and
[Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing).

Run only with credentials already exported by the operator; the script never
loads `.env`:

```bash
DEEPSEEK_API_KEY="$DEEPSEEK_API_KEY" \
GEMINI_API_KEY="$GEMINI_API_KEY" \
node scripts/live-generation-benchmark.mjs > benchmark-results.jsonl
```

The output contains provider/model metadata and numeric metrics only. It never
contains prompts, generated text, credentials or user data. The first card has
an immediate boundary and the later card uses the five-minute minimum
boundary. The runner stops before a request when its estimated cost would
cross `$2`.

## Current run status

No provider run was made in this repository. No provider credentials or
approved provider/model selection were available in the environment at the
time of implementation. Consequently this report contains no fabricated
latency, cost, readiness percentage, or provider recommendation. The runner
is ready for an operator to execute after reviewing the config and confirming
provider retention and billing terms.

The required 20 sessions per provider remain blocked until the product owner
provides approved provider/model configurations through the environment and
approves the retention and billing terms to use for the run.

## Decision status

Decision A7b, provider data retention terms, remains open. The benchmark must
be rerun when either provider, model or price changes, and raw user text must
remain excluded from benchmark logs.

## Implications for the PRD

- Keep authored fallbacks for every model call; no focus screen may wait
  indefinitely for generation.
- Keep the story-card schedule based on foreground timestamps, not provider
  completion time.
- Do not choose a provider or model, promise card readiness, or publish a
  session cost until the real-model benchmark and retention review are complete.
- Treat the missing benchmark as a release-readiness blocker for live
  generation, not as evidence that the feature is fast or inexpensive.

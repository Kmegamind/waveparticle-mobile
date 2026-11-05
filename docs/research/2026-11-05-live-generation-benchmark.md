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

## Current run status

No provider run was made in this repository. No provider credentials or
approved provider/model selection were available in the environment, and no
provider SDK was added. Consequently this report contains no fabricated
latency, cost, readiness percentage, or provider recommendation.

The required 20 sessions per provider remain blocked until the product owner
provides approved provider/model configurations through the environment and
approves the retention and billing terms to use for the run.

## Decision status

Decision A7b, provider data retention terms, remains open. Provider choice and
model choice also remain open. The benchmark must be rerun when either changes,
and raw user text must remain excluded from benchmark logs.

## Implications for the PRD

- Keep authored fallbacks for every model call; no focus screen may wait
  indefinitely for generation.
- Keep the story-card schedule based on foreground timestamps, not provider
  completion time.
- Do not choose a provider or model, promise card readiness, or publish a
  session cost until the real-model benchmark and retention review are complete.
- Treat the missing benchmark as a release-readiness blocker for live
  generation, not as evidence that the feature is fast or inexpensive.

# 0030: Run the offline tests through the app's own code, with a budget stop
- Status: proposed (agent, #42); the targets and what "blocks release" means wait for the owner
- Date: 2026-11-24
- Issue: #42 (US-AI-12)

## Context
US-AI-12 asks for offline runs of the pause message, the rest reply and the split with the real
prompts, compared with targets set before the run. `scripts/live-generation-benchmark.mjs` (#130)
measures providers with invented prompts, so it says nothing about the real prompts and checks.
The gateway is TypeScript with `@/` imports, and the repository has no TypeScript runner for
scripts.

## Options
| Option | For | Against |
|---|---|---|
| A. A runner that calls `pauseMessageFor`, `restReplyFor` and the gateway, started through vitest with its own config | The exact prompts, checks and retries the app uses; no new dependency | A test runner starts a script |
| B. Extend the benchmark script | Exists | It would have to copy the prompts and checks, and drift from them |
| C. Add `tsx` to run TypeScript scripts | A plain script | A new dependency for one script |

## Decision
Option A:
- `scripts/offline-runs/run.mjs` turns its flags into settings and starts `scripts/offline-runs/runner.offline.ts` through `scripts/offline-runs/vitest.config.mts`. The main config includes `tests/**` only.
- A real call needs `--real` and the literal flag `--confirm`, never a value in the environment or `.env` (a one-time token file, `scripts/offline-runs/confirm.mjs`). Otherwise the runner uses the stub.
- The budget stop is required: 3,100 calls and $5 by default, both set by flags.
- The gateway gets an optional `onAttempt` callback, so the runner can count what the checks caught before a retry. The callback carries rule ids only. The app does not pass it.
- The targets are one file, `scripts/offline-runs/data/targets.json`, marked "proposed, not owner-approved". It is copied into each run's folder, so the targets used are the ones set before the run.
- A FAIL names the user story and issue. Nothing is gated automatically.
- Records are appended to `results.jsonl` as they finish, and the report is written in a `finally`, also after Ctrl-C (a stop file the runner watches). A run that did not finish is INCOMPLETE and gets no verdict.

## Consequences
- The safety classifier is not called in the rest and split suites (keyword layer only). It is measured in #117.
- Latency is measured from the owner's machine, not a phone.
- Person-scored measures stay PENDING SCORING until the sheets are filled.

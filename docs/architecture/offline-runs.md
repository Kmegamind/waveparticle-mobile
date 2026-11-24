# Offline runs

#42 (US-AI-12, `docs/decisions/0030`): measures the pause message, the rest reply and the goal split with the real prompts before users see them, and compares the results with targets set before the run. The owner runs it against the real model; tests and agents run it with the stub only.

Path: `src/lib/offline-runs/`, `scripts/offline-runs/`

## What runs

The runner calls the app's own code paths: `pauseMessageFor` and `restReplyFor` (`src/lib/prototype/rest-lines.ts`, with the keyword layer only, so no safety classifier call) and the gateway's `splitPlan`. The gateway is `createServerModelGateway`, behind a fetch that applies the budget and records token use. The prompts are the files in `docs/ai/prompts` (the seed of the prompts table), and the report lists each key and version. The Story content is the seed in `src/content` and `docs/demo`.

The inputs are test data, not product content, in `scripts/offline-runs/data/`. They follow the acceptance criteria as reworded by the decisions:

| File | What | Reworded by |
|---|---|---|
| `pause-runs.json` | Four Stories, 20 runs of five Pauses in one Step each, arm `on` (the code picks category and prop) and arm `off` (none offered, a test arm only). 800 pause messages, two calls each | SCENE-PER-STORY (Stories, not entry states), PAUSE-TWO-CALLS (on is the product), PAUSE-3 (escalation is intended from Pause 3, so it is counted, not judged) |
| `rest-messages.json` | 60 messages in six groups of ten, each the first message of a rest chat at Step 1, 2 and 4 of 4 in `site-search`. 180 replies | CHAT-NO-LABEL (groups label the test set only), CHAT-SPOILER-CHECK (positions), L1 (no Chinese) |
| `goal-lines.json` | 69 English Goal lines, 15 with a duration that describes the thing, each split three times. A person's `kind` label slices the results | GOAL-SHAPE-LOCAL and D1b (no kind from the model), GOAL-TIME (time is read by the local `findTimeInGoal`, once per line), PLAN-PROMPT (`plan_split` v2 and its checks), L1 |
| `targets.json` | Every target, with its user story and issue, "proposed, not owner-approved" | AI_03 A6, AI_04 C, AI_01 sections 8 and 9 |

"Fallbacks" are the failure-message rate everywhere (NO-BACKUP, FAIL-SCREEN).

## Running it

```sh
node scripts/offline-runs/run.mjs --stub                    # the stub model: no network, no cost
node --env-file=.env scripts/offline-runs/run.mjs --real --confirm
```

A real run needs `--real` and `--confirm`, as well as `MODEL_API_KEY`, `MODEL_API_URL` and `MODEL_NAME`. Flags:

- `--suite split,rest,pause` (default `all`).
- `--max-calls` (default 2,600) and `--max-cost` in dollars (default 5): the budget stop. A call that could pass either limit is not made, and the report says the run stopped early.
- `--input-price` and `--output-price` in dollars per million tokens. Without them, the prices come from `scripts/live-generation-benchmark.config.json` for the provider that `MODEL_NAME` names. If it names none, the highest prices in that file are used.
- `--concurrency` (default 4) and `--out` (default `offline-runs/<time>-<mode>`, ignored by git).

The output folder holds:

- `results.json`, every record;
- `targets.json`, the targets as they were at run time;
- `report.md`, which starts with a summary table: PASS, FAIL, PENDING SCORING or NO DATA per target, with the story and issue;
- the scoring sheets `scoring-rest.csv` (blank `relevance` 1 to 5, `in_character` yes/no, `advising` yes/no) and `scoring-pause.csv` (blank `event` yes/no).

After filling in the sheets, `node scripts/offline-runs/run.mjs --score offline-runs/<name>` writes the report again, with no model call. Nothing is gated automatically. A FAIL names the user story and issue. What "blocks release" means is the owner's decision (#42).

The runner goes through vitest (`scripts/offline-runs/vitest.config.mts`) because it imports the app's TypeScript. `npm test` and CI never include it. The gateway's `onAttempt` option reports the rules every attempt failed, which is how retries, advice and event verbs are counted before the checks.

# Evaluation plan: <model call name>

Verified against decisions up to <date>, code <commit>, replaces <file>

Copy this file next to the AI feature specification it evaluates. Generated text cannot be judged by code alone, so a person reads samples. This plan says which samples, how they are scored, who reads how many, and what counts as a pass. Do not invent numbers: if a number is not decided yet, write "Open" and link to `docs/SPEC_MAP.md` section 5.

## What is being evaluated

- AI feature specification: <link>
- Prompt identifier and version: <identifier, number>
- Character and story, if the call is character-specific: <name>

## Golden examples

<The fixed set of inputs used every time, and for each one the kind of output that is good. Say where the files live, who chose the inputs, and how the set grows. Authored cards from earlier work can serve as reference examples here.>

| Set | Where | How many | Chosen by | Covers |
|---|---|---|---|---|
| | | | | |

## Scoring rule

<What the reader marks on each sample, in plain words. Keep the questions few and answerable by yes or no where possible.>

| Question | Answers | Counts as failure when |
|---|---|---|
| | | |

## Who reads how many samples

| Reader | Role | Samples per run | Reads blind (without knowing the prompt version) |
|---|---|---|---|
| | | | |

Record what each reader marked, the date, and the prompt version. Never record user text.

## Pass line

<The exact condition for accepting this prompt version, for example "no sample fails a safety question and no more than X of Y samples fail any other question". If the number is open, say Open.>

## How often it runs

| When | What runs | Who is told |
|---|---|---|
| Every change to the prompt or the rules | | |
| Before each release | | |
| After a change of model or provider | | |

## Results log

| Date | Prompt version | Samples read | Result | Notes |
|---|---|---|---|---|
| | | | | |

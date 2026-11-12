---
name: writing-evaluation-plan
description: Use when deciding how generated text will be judged — golden examples, scoring questions, how many samples a person reads, the pass line, or how often an evaluation runs — for a model call or a character's voice.
---

# Writing an Evaluation Plan

## Overview

Code can check rules, but only a person can say whether generated text is good. An evaluation plan, from `docs/templates/evaluation-plan.md`, fixes the samples, the scoring questions, who reads how many, the pass line, and the schedule, so that "good enough" is the same answer every time.

## Steps

1. **Check the map.** Read `docs/SPEC_MAP.md` section 5 for open decisions about who reads content and how it is recorded. If open, ask the user instead of choosing.
2. **Read the AI feature specification** the plan serves (sections 6 to 8 give the rules, examples and failure behaviour). If it does not exist, write it first with writing-ai-feature-spec.
3. **Copy the template** next to that specification and fill the header line.
4. **Golden examples.** List the fixed inputs, where the files live, who chose them, and what a good output looks like. Authored cards from earlier work are reference examples here, never user-facing text.
5. **Scoring rule.** Few questions, mostly yes or no, in plain words. Mark which questions are safety questions.
6. **Readers and counts.** Fill who reads, in what role, and how many samples. **Do not propose a number that the owner has not decided**: write "Open" and link to the map. Say whether readers see the prompt version.
7. **Pass line and schedule.** State the exact condition, or "Open". Say what runs on every prompt or rule change, before each release, and after a change of model or provider.
8. **Privacy.** Records never contain user text.
9. **Update `docs/SPEC_MAP.md`** and ship with `shipping-backlog-issues`.

## Red Flags: STOP

| Thought | Reality |
|---|---|
| "Twenty samples sounds right" | Counts are the owner's decision per feature. Mark Open. |
| "A model can judge it all" | A human must read samples. A model may only help. |
| "I'll use the sample as a fallback too" | Reference and evaluation only. |
| "We can skip the schedule" | Unscheduled evaluations never run. |

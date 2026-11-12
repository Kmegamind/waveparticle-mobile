---
name: writing-ai-feature-spec
description: Use when writing or rewriting the specification of a feature that calls a language model — a prompt, a generated card, message, plan or reply, its checks, its fallback behaviour, or its speed and cost limits.
---

# Writing an AI Feature Spec

## Overview

One file describes one model call, in twelve sections, from `docs/templates/ai-feature-spec.md`. Prompt text lives in `src/prompts/` and is referenced by identifier and version. The file says what the call is for, what goes in and out, how output is checked, and what the user sees when it fails.

## Steps

1. **Check the map.** Read `docs/SPEC_MAP.md` (the AI documents table and section 5). Open decisions that block this call, such as the failure screen or the waiting limit, must be named to the user, not guessed.
2. **Read the sources.** `docs/DECISIONS.md` (authority), `docs/ai/DIFFERENCES.md` for the old specification's required changes, the old specification, the gateway code in `src/lib/model-gateway/`, and the demo prompts in `scripts/demo-prompts.mjs`. Where they disagree, the decision log wins; note each disagreement.
3. **Copy the template** to `docs/03-ai/<call>.md` (or the folder the map names). Fill the header line.
4. **Fill the twelve sections in order**: purpose and effect, when it triggers, inputs, output shape as a schema, prompt reference by identifier, rules and checks, examples good and bad, what happens when generation fails, evaluation, latency and cost budget, safety and privacy, acceptance tests.
5. **Section 7 is strict.** No authored backup text is ever shown to the user. Write what the user sees for each failure. If that decision is open, write "Open" with a pointer to the map; do not invent a fallback line.
6. **Never invent numbers** for speed, cost or sample counts that were not decided; write "Open" or "to be measured".
7. **Character-neutral.** The call's rules apply to any character. Persona, voice, allowed names and forbidden words come from the Character Pack, not from this file.
8. **Create the evaluation plan** with writing-evaluation-plan and link it in section 9.
9. **Check.** Every rule has a test name in section 12; the schema matches the types in code or says that code does not exist yet; no user text is logged.
10. **Update `docs/SPEC_MAP.md`**, then ship with `shipping-backlog-issues`.

## Red Flags: STOP

| Thought | Reality |
|---|---|
| "A stored fallback line is safer" | It is ruled out. Say what the user sees instead, or mark Open. |
| "I'll paste the prompt into the spec" | Reference it by identifier. One source in code. |
| "Oppenheimer's name can go in the rule" | Rules are character-neutral. |
| "I'll estimate the latency" | Only measured or decided numbers. |

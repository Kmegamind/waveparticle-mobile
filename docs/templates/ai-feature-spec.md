# <Model call name>

Verified against decisions up to <date>, code <commit>, replaces <file>

Copy this file to `docs/03-ai/<call>.md`. One file describes one model call. Keep prompts out of this file: they live in `src/prompts/` and are named here by identifier and version. Link to decisions in `docs/DECISIONS.md` by id; do not copy them. Delete the instruction lines in angle brackets.

## 1. Purpose and effect

<What the user sees or experiences because of this call, in two or three sentences. Name the feature specification it serves.>

## 2. When it triggers

<The exact events that start the call, and the events that must not. For example "after the user taps Pause, every time, including the third".>

## 3. Inputs

| Input | Source | Example | Notes |
|---|---|---|---|
| | The user, the Character Pack, the story, or the session state | | Say what is never sent, such as account details |

## 4. Output shape

<The output as a schema. Use TypeScript types or a JSON schema. State maximum lengths in words and sentences. Say what a parse failure means.>

```ts
type Output = {
  // field: type, limit, meaning
}
```

## 5. Prompt reference

- Prompt identifier: `<identifier in src/prompts/>`
- Version: <number>
- Character-neutral: <yes; character facts come from the Character Pack>

## 6. Rules and checks

<Each rule that accepts or rejects the generated text, one per row. A rule has an identifier, a plain sentence, and whether it is enforced by code or only asked of the model. Link to the shared rule table in code once it exists.>

| Rule | In plain words | Enforced by | On failure |
|---|---|---|---|
| | | Code or prompt | Regenerate within the time limit |

## 7. When generation fails

<No authored backup text is ever shown to the user. Say exactly what the user sees when the check fails after the allowed attempts, when the provider is unreachable, and when there is no network. If the decision is still open, write "Open: see docs/SPEC_MAP.md section 5" and say what the screen must not do.>

| Situation | What the user sees | What the user can do |
|---|---|---|
| Check fails after all attempts | | |
| Provider error or timeout | | |
| No network | | |

## 8. Examples, good and bad

<At least three good and three bad examples. For each bad example say which rule it breaks. Authored cards from earlier work may be used here as reference examples; they are never shown to users.>

| Example text | Good or bad | Why |
|---|---|---|
| | | |

## 9. Evaluation

<Link to the evaluation plan in `docs/03-ai/` made from `docs/templates/evaluation-plan.md`. Say in one sentence what a person must read before this call is accepted.>

## 10. Latency and cost budget

| Measure | Budget | How it is measured |
|---|---|---|
| Time to first result | <seconds, measured by testing> | |
| Total time including retries | | |
| Attempts allowed | | |
| Cost per call and per session | | |

## 11. Safety and privacy

<What user text reaches the provider. What is logged (never the text itself). Which safety tier applies to the input and to the output. What the model must not say. Link to the safety specification.>

## 12. Acceptance tests

<Given, when, then, each naming the test that proves it. Include one for the failure behaviour in section 7 and one for each rule in section 6.>

- Given <state>, when <event>, then <result>.
  Test: `<test file>` / `<test name>`

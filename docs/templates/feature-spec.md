# <Feature name>

Verified against decisions up to <date>, code <commit>, replaces <file>

Copy this file to `docs/01-features/<feature>/spec.md`. Keep it to about one page plus the acceptance tests. Delete every instruction line in angle brackets. Never copy a rule from `docs/DECISIONS.md`: link to its id and name the rule in a few words, so that the rule has one home.

## Brief

- **Problem.** <Who has it, in one or two sentences.>
- **What the user can do after this feature exists.** <One or two sentences.>
- **What this feature does not do.** <Bullet list of non-goals.>
- **How we will know it works.** <A guard against harm, or a plain statement that no measure is planned. Success measures were removed by decision N1.>

## Frequently asked questions

<Five to eight questions a reader would ask, each with a short answer. Include "What happens when it fails?" and "What does the user never see?".>

| Question | Answer |
|---|---|
| | |

## Decisions this feature depends on

<One line per decision: its id in `docs/DECISIONS.md`, a few words saying what it settles, and nothing more. Open decisions point to `docs/SPEC_MAP.md` section 5.>

- <id>: <a few words>

## Requirements and acceptance tests

<One block per requirement. The requirement id is the feature code plus a number, for example GOAL-3. Each acceptance test is written as given, when, then, and names the test that proves it, using the naming rule in `docs/testing.md`. A requirement without a test name is not finished.>

### <ID>: <requirement in one sentence>

- Given <starting state>, when <what the user or system does>, then <what is observable>.
  Test: `<test file>` / `<test name>`
- <Add the failure case and the edge case as separate given, when, then lines.>

## Screens and states

<Link to the screens in `docs/FLOW.md` by their identifiers. Describe only what differs from the registry. List the empty, loading, error and offline states.>

## Model calls

<If the feature calls a model, link to its AI feature specification in `docs/03-ai/`. Otherwise write "None".>

## Issues

<List the GitHub issues this specification blocks or is blocked by.>

## Open questions

<Link to `docs/SPEC_MAP.md` section 5 or write "None".>

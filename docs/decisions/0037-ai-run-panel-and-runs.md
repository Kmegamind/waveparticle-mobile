# 0037: Fill prompt variables from a sample by one fixed table, and show runs that did not end
- Status: proposed
- Date: 2026-11-27
- Issue: #477

## Context
The Run panel (drawing AIR-3, `#reg-run`) runs one prompt of a registry row on a sample of the library (#479, `docs/decisions/0036`) through POST `/admin/ai-runs/run` (#476, `docs/decisions/0034`). The route's `readSample` still answered `unknown-sample` for every id, and the owner left to #477 how a sample's fields fill a prompt's `{{variables}}`.

The variable names differ by prompt. The owner's Pipeline prompts (P-04 to P-06, `story-pipeline/prompt-table-source/en`) use `{{character_name}}`, `{{persona}}`, `{{story_source}}`, `{{background}}`, `{{world_record}}`, `{{plan}}` and `{{mode}}`; the runtime prompts use `{{name}}` and `{{facts}}` and call-only inputs (`{{userMessage}}`, `{{pauseNumber}}`, `{{minutes}}` ...); the drawing writes `{{persona}}` and `{{source_excerpt}}`; S1 to S3 and S5 to S6c use batch inputs (`{{book_title}}`, `{{chapters}}`, `{{character_dir}}` ...) that no sample holds.

Two more points: a run whose end the database did not record (the answer came but `finish_ai_run` failed, or the function was stopped) stays `running` for ever, and FR-AILAB-6 says Set as candidate example and Confirm work "from any run".

## Options
| Option | For | Against |
|---|---|---|
| A mapping per prompt key, stored with the prompt | Exact for each prompt | A new column or table and an editor; nothing to fill it with today |
| **One fixed table in code, the same for every prompt; a field can fill several names** | No migration; the names the prompts already use work; tested in one place | A new prompt that wants a new name needs a code change |
| A variable the sample does not fill is left empty (its line dropped) | Every prompt runs | A half-filled prompt is sent and paid for without anyone asking for it |
| A variable the sample does not fill is sent as written (`{{name}}`) | Every prompt runs | The model reads template marks; the answer means little and costs money |
| **The Run stops before the row and the model call, and names the variables; "No sample" sends the prompt as written** | Nothing is spent on a prompt the sample cannot fill; the panel warns before Run | A runtime prompt with a call-only input runs only without a sample, or as a pasted text |
| A `running` row shown as running for ever | Simple | A call that may have been billed looks like it is still going |
| **After the route's limit plus 30 s (180 s) a `running` row is shown as "End not recorded"** | Clear, never hidden; nothing is written | A slow function between 150 and 180 s shows "Run in progress" a little longer |
| Confirm only after Set as candidate | Two steps, a candidate first | AI-EXAMPLE-CONFIRM asks for one action |
| **Confirm stores the run's output as confirmed in one action; Set as candidate stores it as candidate** | One action; both through #475's `set_ai_feature_example` and its rules | A writer can confirm an answer without a candidate step (allowed by AI-EXAMPLE-CONFIRM) |

## Decision
A sample fills the prompt's `{{variables}}` by this table (`SAMPLE_VARIABLES` in `src/lib/ai-samples/variables.ts`), for every prompt:

| Sample field | Fills |
|---|---|
| Companion | `{{name}}`, `{{character_name}}` |
| Mode (historical or fictional) | `{{mode}}` |
| Persona | `{{persona}}` |
| Source excerpt (the passage) | `{{source_excerpt}}`, `{{story_source}}` |
| Source named | `{{source_label}}` |
| Background | `{{background}}` |
| Facts | `{{facts}}`, one per line, each starting with "- " |
| World record | `{{world_record}}` |
| Standing task | `{{standing_task}}` |
| Finished plan | `{{plan}}`: "Goal: ..." then "1. Title: note" per aim |
| Finished plan's goal | `{{goal}}` |

An empty field fills its variables with nothing, so the template drops each line that has only those variables (the template's rule for optional lines). A `{{variable}}` that is not in the table stops the Run with `422 prompt-problem` before the run's row is written and before the model is called, naming each such variable; the panel says so before Run, and "No sample (the prompt as written)" sends the prompt unfilled. A runtime prompt with a library sample has no gateway checks (the checks need the call's input, which a sample does not hold); the answer says so.

The Runs page shows a run still `running` 180 s after it started (`RUN_END_WAIT_MS`: the route's `maxDuration` of 150 s plus 30 s) as "End not recorded", with an alert in its detail; the Run panel shows `recorded: false` as an alert above the answer.

Set as candidate example and Confirm read the run's output again on the server by the run's id (never text from the browser) and call #475's `setFeatureExample`, so every rule of the example editor holds (any role, 8000 characters, the "changed since" check, the history).

## Consequences
- No migration. The route reads `public.ai_samples` and `public.ai_source_excerpts` with the user's own client; row level security already limits them to content editors.
- Batch prompts (S1 to S3, S5 to S6c) and runtime prompts with call-only inputs run only without a sample or as a pasted text until a sample holds those inputs (a later issue; the gateway's `calls` input of #476 is the place for runtime calls).
- A new variable name in a prompt needs a row in the table, a test and this file.
- The Runs page lists the newest 500 runs (`RUNS_SHOWN`); older runs stay in the database and in the spend.

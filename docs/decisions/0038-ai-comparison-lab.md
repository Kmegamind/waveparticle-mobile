# 0038: The comparison lab runs two ordinary runs and saves the answers in their own table
- Status: proposed
- Date: 2026-11-27
- Issue: #478

## Context
FR-AILAB-4 asks for a separate page that runs the same sample through two prompt versions, or two models, and shows the two answers side by side, with a blind option that hides which side is which until the pass questions are answered. FR-AILAB-5 asks that the yes or no answers to the feature's pass questions be saved with the run. The Run route (#476, `docs/decisions/0034`) already runs, checks, records and prices one prompt; the Run panel (#477, `docs/decisions/0037`) calls it, and only one model (`MODEL_NAME`) was configured.

## Options
| Option | For | Against |
|---|---|---|
| **Each side is one ordinary call of the Run route; answers in a new table that names both runs** | One run route, one permission, one run log and spend; each side has its own row, error and Retry | A new table and a migration |
| A new two-sided route that records one multi-step run | One row per comparison | A second way to run a prompt; the steps table has no place for the answers |
| Answers as new columns on `public.ai_runs` | No new table | A run would hold half a comparison; the pair is not linked |
| A second model from a new settings group (`LAB_MODEL_2_*`) | "Two models" works, each key stays on the server | Three optional settings |

## Decision
Run both posts each side to `POST /admin/ai-runs/run` through one shared browser client (`src/lib/ai-runs/client.ts`), which the Run panel uses too. The answers go into `public.ai_comparisons` through `public.save_ai_comparison`, which checks that both runs are the caller's own, ended ok, of one feature and one sample, copies the pass questions from the feature row, and needs one yes or no per question. A run belongs to at most one comparison. Blind shuffles the panels at Run both and hides their names until every question of both sides is answered. A second model is offered only when `LAB_MODEL_2_API_KEY`, `LAB_MODEL_2_API_URL` and `LAB_MODEL_2_NAME` are all set.

## Consequences
- Every lab side counts in the spend and shows on the Runs page like any run.
- A feature without pass questions can be run in the lab but not saved; the questions are written on the feature page.
- The Runs page does not show saved answers yet; they are read from `public.ai_comparisons`.
- Saving needs no server token: the answers are the person's judgement of their own runs, and the run rows themselves are still written by the server only.

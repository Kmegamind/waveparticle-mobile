# 0012: How the goal dialogue on /try splits a Goal
- Status: accepted
- Date: 2026-11-12
- Issue: #30 (with #33 to #39)

## Context
The goal dialogue on the test path `/try` (`docs/decisions/0011`) must split a Goal into Steps.
CI and local runs have no model keys. Decision NO-BACKUP forbids silent stand-in plans, and
0011 asks for a cap on model calls because anyone with the preview link can spend model credit.

## Decision
- **Split.** A server action (`src/app/try/goal/actions.ts`) runs `splitGoal`
  (`src/lib/prototype/split-goal.ts`). It checks the goal with `gateFreeText` first. A crisis
  goal returns `crisis` and the model is never called. When `MODEL_API_KEY`, `MODEL_API_URL` and
  `MODEL_NAME` are all set, it calls `createServerModelGateway().splitPlan`. A result whose
  `source` is not `generated`, a thrown error, or a plan that does not add up to the time is a
  failure, and the page shows GD-F. No stored plan is shown in its place.
- **Test data.** Without model keys, a deterministic splitter
  (`src/lib/prototype/test-splitter.ts`, labelled TEST DATA) gives Steps in 15-minute units that
  add up to the time. "Split it finer" gives more Steps.
- **Test-only failure.** A goal containing `[fail-split]` makes the test-data split fail, so
  GD-F can be tested end to end. It exists only on `/try`, and only without model keys.
- **Cost cap.** Each browser may make **20 real model calls per day** (UTC). The count is kept
  in the httpOnly cookie `wp_try_model_calls` (`YYYY-MM-DD:N`, path `/try`, one day). Past the
  cap the split fails and the page shows GD-F. Clearing cookies resets the cap, so it slows
  people down but does not stop them; Vercel Deployment Protection is still the real gate.
  Since #256 the owner can switch the limit off with `MODEL_CALL_LIMIT_ENABLED=0` (TEST-NO-CAP, the test-stage setting).
- **Privacy.** The goal text is sent only to the gateway. It is never logged or stored on the
  server. The gateway logs rule ids and timing only.
- **His lines.** FLOW 4.3 takes his dialogue lines from small authored pools
  (`src/lib/prototype/goal-lines.ts`, marked READ-STATUS: written, not read by Yue). The shape of
  the Goal is classified by a local rule in that file, not by the model.

## Consequences
- Whether NO-BACKUP also forbids the authored dialogue lines is an open question for the
  product owner.
- The Plan is saved in the browser store on `/try`. Saving the Goal on the account is done for
  the signed-in `/goal` (#32), which uses the same split with its own cost-cap cookie (path
  `/goal`). The server counts the turns since #31 (`docs/decisions/0026`); the split now runs inside a turn.

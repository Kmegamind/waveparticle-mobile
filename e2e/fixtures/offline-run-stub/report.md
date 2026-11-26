# Offline run (test fixture, #439)

A cut-down #42 offline-run folder for the AI feature pages e2e test, in the shape that
`scripts/offline-runs/run.mjs` writes, stub mode (the fake model). No model was called.

## Summary

| Status          | Story   | Issue | Target                       | Measure          | Target value | Result | Blocks |
| --------------- | ------- | ----- | ---------------------------- | ---------------- | ------------ | ------ | ------ |
| PASS            | US-AI-3 | #56   | `pause.repeat_first_attempt` | Near repeats     | below 0.05   | 0      | yes    |
| PASS            | US-AI-3 | #56   | `pause.failure_rate`         | Failure message  | below 0.05   | 0      | yes    |
| FAIL            | US-AI-3 | #56   | `pause.retry_rate`           | Retries          | below 0.25   | 0.4    | yes    |
| PENDING SCORING | US-AI-3 | #56   | `pause.shown_event`          | Read as an event | max 0        | -      | yes    |

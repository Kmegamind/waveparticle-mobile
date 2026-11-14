# 0013: Use a test-only stub model for the live end-to-end run
- Status: accepted (Yue, 2026-11-13)
- Date: 2026-11-13
- Issue: #254

## Context
The end-to-end run has no model keys, so `/try` shows chapter 8's labelled test data (decision
0011). Issue #254 needs one run in which a model is configured, to prove that a story other than
chapter 8 is generated from its own inputs and that no stored card reaches the page (NO-BACKUP).
No stub existed.

## Options
| Option | For | Against |
|---|---|---|
| Local stub server started by the e2e config | Nothing in the app bundle; the app talks to it through the real HTTP provider | One more server in the e2e run |
| Fake provider inside the app, switched by an environment variable | Less setup | Test code in the server bundle |

## Decision
The e2e config starts `e2e/support/stub-model.mjs` and a second app on port 3101 whose
`MODEL_API_URL` points at it; tests named `*.live.spec.ts` run there (project `mobile-live`).

## Consequences
- The stub (`e2e/support/stub-cards.mjs`) composes answers from the prompt alone (the card count
  and the Step number). It reads no file and holds no stored card text.
- `tests/stub-model.test.ts` checks that its cards pass the existing checks, so a live e2e failure
  points at the app.
- `GET /prompts` on the stub lists the prompts it received, so a test can check what was sent.
- The test-data mode without a model (decision 0011) is unchanged.
- With `E2E_BASE_URL` (a deployed site) the live project is skipped.

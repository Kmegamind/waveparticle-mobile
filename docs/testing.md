# Testing
| Kind | Folder | Runs | Command |
|---|---|---|---|
| Unit / integration | `tests/` | CI, before every PR | `npm test` |
| End-to-end | `e2e/` | CI, before every PR | `npm run test:e2e` |

- `npm run test:e2e` starts two app servers. Port 3100 runs with no model (project `mobile`). Port 3101 runs with `MODEL_API_URL` pointing at the test-only stub model `e2e/support/stub-model.mjs` (project `mobile-live`, files `*.live.spec.ts`; `docs/decisions/0013`).

- Name each test after the acceptance criterion it proves (`test_us1_ac2_rejects_empty_name`).
- Write the failing test before the code.
- Never weaken or delete a test to make CI pass; fix the code or raise it with a human.

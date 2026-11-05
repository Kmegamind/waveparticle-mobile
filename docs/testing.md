# Testing
| Kind | Folder | Runs | Command |
|---|---|---|---|
| Unit / integration | `tests/` | CI, before every PR | `npm test` |
| End-to-end | `e2e/` | CI, before every PR | `npm run test:e2e` |

- Name each test after the acceptance criterion it proves (`test_us1_ac2_rejects_empty_name`).
- Write the failing test before the code.
- Never weaken or delete a test to make CI pass; fix the code or raise it with a human.

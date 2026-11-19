# Testing
| Kind | Folder | Runs | Command |
|---|---|---|---|
| Unit / integration | `tests/` | CI, before every PR | `npm test` |
| End-to-end | `e2e/` | CI, before every PR | `npm run test:e2e` |

- `npm run test:e2e` starts two app servers. Port 3100 runs with no model (project `mobile`). Port 3101 runs with `MODEL_API_URL` pointing at the test-only stub model `e2e/support/stub-model.mjs` (project `mobile-live`, files `*.live.spec.ts`; `docs/decisions/0013`).

- Large text and narrow screens (#100): `e2e/large-text.spec.ts` loads every signed-in page and session screen at 320 px with 200% text (`largeText` in `e2e/support/large-text.ts` sets a 200% root font; every size token is in rem) and fails on anything past the right edge or cut off (`overflowReport`). It also checks reduced motion. A new page belongs in its list. The content admin is not in it: it is desktop-only (ADMIN-DESKTOP); its journeys run at 1280 px and `e2e/admin-look.spec.ts` checks its computed styles against the admin prototype and 1024 px without sideways scroll.

- Name each test after the acceptance criterion it proves (`test_us1_ac2_rejects_empty_name`).
- Write the failing test before the code.
- Never weaken or delete a test to make CI pass; fix the code or raise it with a human.

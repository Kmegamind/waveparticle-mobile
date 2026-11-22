# Testing
| Kind | Folder | Runs | Command |
|---|---|---|---|
| Unit / integration | `tests/` | CI, before every PR | `npm test` |
| End-to-end | `e2e/` | CI, before every PR | `npm run test:e2e` |

- `npm run test:e2e` starts two app servers. Port 3100 runs with no model (project `mobile`). Port 3101 runs with `MODEL_API_URL` pointing at the test-only stub model `e2e/support/stub-model.mjs` (project `mobile-live`, files `*.live.spec.ts`; `docs/decisions/0013`).

- Other ports (#269, #319): set `E2E_PORT` (app, default 3100), `E2E_LIVE_PORT` (live app, default 3101), `E2E_STUB_PORT` (stub model, default 3199) and `E2E_SUPABASE_PORT` (Supabase stub, default 3198), so a second worktree does not collide with a running one. Set all four: outside CI a run reuses a server already on its port, so two sessions on the same Supabase stub port share its seeded data. For example, a session that owns ports 3200 to 3299 runs `E2E_PORT=3200 E2E_LIVE_PORT=3201 E2E_STUB_PORT=3299 E2E_SUPABASE_PORT=3298 npm run test:e2e`. With no variables the ports are the defaults; CI sets none.

- Large text and narrow screens (#100): `e2e/large-text.spec.ts` loads every signed-in page and session screen at 320 px with 200% text (`largeText` in `e2e/support/large-text.ts` sets a 200% root font; every size token is in rem) and fails on anything past the right edge or cut off (`overflowReport`). It also checks reduced motion. A new page belongs in its list. The content admin is not in it: it is desktop-only (ADMIN-DESKTOP); its journeys run at 1280 px and `e2e/admin-look.spec.ts` checks its computed styles against the admin prototype and 1024 px without sideways scroll.

- Name each test after the acceptance criterion it proves (`test_us1_ac2_rejects_empty_name`).
- Write the failing test before the code.
- Never weaken or delete a test to make CI pass; fix the code or raise it with a human.

- Seed card checks (#46): `npm run check:cards` (a CI step of its own) runs the admin card checks and a repeated-lines check on every card of `src/content/<companion>/story-decks.json`; a failing card fails CI and is listed by key.

- Copy rules (#9): `tests/copy-rules.test.ts` scans the code default of every app text key (`src/content/app-text.json`) for "overdue", "behind", "missed", "owe", "catch up", "abandoned", "partial", any streak, and Mission or Task for the user's work. CI fails on a match and lists each key and text.

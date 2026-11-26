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

- Offline runs (#42): `node scripts/offline-runs/run.mjs --stub` runs the three offline suites against the stub model with no network; only the owner runs `--real --confirm` against the real model (`docs/architecture/offline-runs.md`). `tests/offline-runs.test.ts` proves the runner with the stub; `npm test` never starts the runner itself.

- Decision log merges (#482): `.gitattributes` gives `docs/DECISIONS.md` git's union merge driver (`merge=union`), so two branches that each add a row to the same table merge without a conflict; git keeps the lines of both sides. `tests/decisions-union-merge.test.ts` proves it in a temporary git repository and checks that every table in the real `docs/DECISIONS.md` has a header, a separator and rows with the same number of columns. Limits:
  - GitHub's web merge (the merge button and its conflict editor) does not use this driver, so it still reports a conflict. Merge on the command line, as the existing rule says (`git fetch origin && git merge origin/main` in the branch, `AGENTS.md`), then push.
  - Union merge never asks; it keeps both sides' lines. If both branches add the same row, the merged file has it twice. If both branches change the same row, the old and new versions can both stay. The table check still passes in these cases, because each row has the right number of columns.
  - What a reviewer looks for after such a merge: in the merged `docs/DECISIONS.md` diff, check that no decision id appears twice, that an edited row did not keep its old version next to the new one, and that each new row sits in the intended section. Then run `npx vitest run tests/decisions-union-merge.test.ts`.

- Admin visual gate (#435, #483): every `e2e/admin-visual*.spec.ts` file (the `desktop` project), one per admin page, with shared helpers in `e2e/support/admin-visual.ts`. It is judged in GitHub CI, where the `check` job runs inside the official Playwright image (`mcr.microsoft.com/playwright`, tagged with the `@playwright/test` version in `package.json`); a local Mac renders fonts differently (#465 failed six times on GitHub only). Locally the gate files are skipped with "admin visual gate runs in CI (Playwright image); set ADMIN_GATE_LOCAL=1 to run locally, results may differ by font rendering". To run them anyway: `ADMIN_GATE_LOCAL=1 npx playwright test e2e/admin-visual`. `node scripts/admin-visual-inventory.mjs` lists every comparison and exception of the gate, to check that moving rows between files loses none.

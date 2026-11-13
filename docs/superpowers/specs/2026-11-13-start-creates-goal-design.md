# Start creates the Goal and the Plan (issue #32, US-GD-15)

Date: 2026-11-13. Status: approved by Yue on 2026-11-13 (option A; switch; slider option a).

## Why

Pressing Start on the Plan should start the work right away. For a signed-in person, it should also keep the Goal and its Steps on their account, so the Goal appears on Goals on every device (US-ACC-3, decision S3). Today the goal dialogue exists only on the sign-in-free test path `/try`. That path keeps everything in the browser (decisions 0011 and 0012), and Start writes nothing to the account.

## Acceptance criteria (corrected against the decision log)

1. Given I tap Start on the Plan card, then the focus page opens on Step 1, and **the clock starts when his first card is shown**. This replaces "the Step timer starts" because of NO-BACKUP and FAIL-SCREEN: while the failure message is shown, the clock does not start. Corrected by Yue on 2026-11-13.
2. Given this is the first Start for this Goal, then the Goal and the Plan are created now and the Goal appears on Goals. A second Start for the same Plan (a double tap, or Back and Start again) creates nothing new.
3. Given any Step has an empty name, then the server removes it when the Plan is saved.
4. Given the Plan is saved, then the Step names, descriptions and minutes are stored on our server, tied to my account (US-ACC-3). Minutes are kept as given, at least 1 (STEP-EDIT); the server does not round them.
5. **Time question (Yue, 2026-11-12, `_handoff/2026-11-12-spec-audit/01_DECISIONS_FROM_YUE_2026-11-12.md`, round 2, "Time questions").** The dialogue asks how long with a slider from 0 to 3 hours, with no fixed example times such as "1 hour". If the goal text already states a time, the dialogue skips the question and shows the time it understood, which the user can change (GOAL-TIME).
6. `/try` writes nothing to the account.

## Goals

- A signed-in goal dialogue at `/goal`. It reuses the existing dialogue component, so the flow, the lines, the Plan card and the editing stay the same as on `/try`.
- A server action `startGoalAction` that:
  - requires a signed-in user;
  - runs the safety gate on the goal text and on every Step title and description (a crisis result saves nothing);
  - drops Steps whose name is empty after trimming;
  - checks that minutes are whole numbers of at least 1;
  - saves one `goals` row (status `in_progress`; title, text, `shape`, `split_finer`, `total_minutes` equal to the sum of the saved Steps) and its `steps` rows, through the user's own Supabase client, so row-level security applies.
- The save makes the account match the Plan. The page creates a Goal id (a UUID) each time a split produces a Plan; a new split, or opening `/goal` again, means a new Goal. When a Goal with that id already belongs to the user (Start pressed again after a failed save, or after edits), the action keeps that one Goal, updates its fields, and replaces its Steps with the current Plan. So one Plan never makes two Goals, and a Goal left without Steps (lost response, failed clean-up) is repaired by the next Start. (Author's call after the builder check.)
- If writing the Steps fails on the first save, the action deletes the Goal it just created and returns a failure. The page then shows one calm message in the app's voice with a Retry button (FAIL-SCREEN) and does not open the focus page.
- After a successful save, the page stores the Plan in the browser the same way `/try` does and opens the focus page.
- The slider replaces the three preset time buttons **and the typed-minutes box** on both `/try/goal` and `/goal` (Yue, option a). "Not sure" stays. Reading a time from the goal text (GOAL-TIME) stays.
- `/goal` requires sign-in and exists only when `PROTOTYPE_ENABLED=1`, like `/try` (Yue, 2026-11-13). With the switch off it answers 404 until US-FOC-1 (#18) and #31 exist. Its split runs the same `splitGoal` as `/try` (signed-in users only).

## Non-goals

- A signed-in focus page. That is US-FOC-1 (#18). Until it exists, Start on `/goal` opens the only focus page there is, `/try/focus` (see "Open for Yue").
- An account-level limit on model calls (US-GD-14, #31).
- The 15-minute steps of the plan editor. A separate issue will cover them; STEP-EDIT asks for any value of at least 1 minute.
- The layouts of GD1 to GD4 and F1 (issues #234 to #238). The slider gets token-only styling and the screen issues place it.
- The AI card pipeline and the model gateway.
- Sessions (`sessions`, `session_steps`, `session_lines`). They are written when the focus page moves to the account.

## Anti-goals

- No Goal without Steps, and no duplicate Goal from one Plan.
- No goal text in the logs.
- `/try` must never read or write account data.
- No stored text shown in place of a failed save or a failed split.

## Constraints

- AGENTS.md: write the tests first. Never weaken a test; tests that change on purpose are listed in the pull request.
- Decisions: STEP-EDIT, GOAL-TIME, NO-STEP-COUNT, NO-BACKUP, FAIL-SCREEN, S3, X1 (the words Goal and Step).
- `docs/DECISIONS.md` has no row for the slider. This pull request adds a row `TIME-SLIDER` (2026-11-12) that cites the handoff file.
- No new dependency. No database migration (the tables from migration 0008 are enough).

## Approaches

1. **(A, chosen by Yue)** A signed-in `/goal` route that reuses the dialogue component and saves through a server action. `/try` stays browser-only.
2. (B) `/try` saves to the account when someone is signed in. Rejected because it makes the test path write real data, which decision 0011 rules out.

Saving: (a, chosen) two inserts with a compensating delete, and no migration. (b) A Postgres function that inserts both in one transaction. It is atomic, but it needs a migration that a person must apply to the hosted database.

## Slider, as built

- Range from 0 to 180 minutes in steps of 5 (step size: my call, see the list below). It has a visible label "How long do you have?". The current value is shown as text ("1 hour 15 min") and announced through `aria-valuetext`.
- The value starts at 0 and no time is shown until the user moves the slider. Send is inactive at 0 and shows the reason "Choose a time above 0".
- "Not sure" stays. It is not a fixed example time, and FLOW and #35 keep it.
- A time read from the goal text that is more than 3 hours is shown as understood, and the slider starts at 3 hours if the user changes it (my call).

## Decided by Yue after the builder check (2026-11-13)

- `/goal` sits behind the test-build switch `PROTOTYPE_ENABLED` (preview builds only); production answers 404 until US-FOC-1 (#18) and #31 exist.
- Option (a): the slider (0 to 3 hours) replaces the three preset buttons and the typed-minutes box; "Not sure" stays; reading a time from the goal text stays.
- Every test changed on purpose is listed in the pull request. Expected: the #35 e2e tests that press "30 min", "1 hour" or "2 hours" or type a time move to the slider and keep their checks on the resulting Plan.

## Calls made by the author

- The Goal title is the Plan title if there is one, otherwise the goal text. `shape` comes from the existing local classifier.
- Status on Start is `in_progress`, so the Goal shows under In progress on Goals.
- The slider step is 5 minutes.
- "Not sure": the Goal's `total_minutes` is the sum of its Steps.

## Verification

- **Unit (Vitest)**, testing `startGoal` with an in-memory Supabase stand-in:
  - Steps with empty names are dropped;
  - minutes are kept and must be at least 1;
  - a crisis in the goal or in a Step saves nothing;
  - a second call with the same id writes nothing;
  - a failure on the Steps write deletes the Goal;
  - a signed-out user gets `signed-out`.
- **Unit:** `/try` code has no import of the account save path.
- **Unit:** slider value and label formatting.
- **e2e (Playwright):**
  - the slider on `/try/goal` (no preset time buttons; Send inactive at 0);
  - the #35 tests moved to the slider;
  - `/goal` sends a signed-out visitor to sign in.

  CI has no account, so the signed-in save is proven by the unit tests, not end to end.

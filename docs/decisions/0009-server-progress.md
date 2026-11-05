# Decision 0009: Server progress for a Goal's story

Date: 2026-11-05

## Decision

Issue #7 stores story progress on the existing `sessions` row and in two new
tables. A Plan remains the Goal's `steps`, ordered by `position`. There is no
plan table and no progress table.

`sessions` gains `companion_id` and `story_id` as text keys into the imported
story dataset, with no content-library foreign key. Rows that already exist
are backfilled to `unassigned` before those columns are required. The session
also stores `background_card`, `background_card_source` (`authored` or
`generated`), `merged_key_moments`, and `closing_line`. A Goal has at most one
session whose `state` is `open`.

Companion progress is the set of `story_id` values on that account's sessions
where `state` is `completed`, grouped with `companion_id`. A `restarted`
session is not completion.

`session_steps` holds one row per step in a session. `done_at` is null when
Done is undone. `session_lines` stores a shown background card, story card,
pause message, return pop-up, or closing line. The line text is story text.
Shown lines can be inserted and read. There is no update policy.

Both new tables enable row-level security through `sessions.user_id`. Foreign
keys use `on delete cascade`.

## Consequences

- Home, Goals and the Life Path read the same account rows on any device.
- A new deployment does not drop this state, because it lives in Postgres.
- Separate pause, return-event, and card tables are not added. A shown pause
  or return line is a `session_lines` row.

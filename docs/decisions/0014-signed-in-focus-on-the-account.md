# 0014: The signed-in focus and rest pages keep progress on the account, the clock on the device
- Status: accepted (Yue, 2026-11-13, option A)
- Date: 2026-11-13
- Issue: #257

## Context
The focus page, the rest page and the return pop-up existed only on the sign-in-free test path
`/try`, with every piece of state in browser storage (decision 0011). Issue #257 moves them to
signed-in routes, `/focus` and `/rest`, without rebuilding the screens, and keeps progress on the
account. The tables `goals`, `steps`, `sessions`, `session_steps` and `session_lines` already
exist (decision 0009). They have no columns for the running clock (the frozen value, the 1.2
second hold, the Undo window), the number of Pauses per Step, or the rest conversation.

## Options
| Option | For | Against |
|---|---|---|
| A. Progress and shown lines on the account; clock, pause count and rest conversation on the device, keyed by the session id | No migration; the account holds everything that is a record (done Steps, every line he showed) | On another device the current Step starts from its full time and the rest conversation is not there |
| B. A migration that also stores the clock state on the account | Continues on any device to the second | A schema change and a bigger write on every Pause, Done and return |

## Decision
Option A (Yue, 2026-11-13).

- `/focus?goal=<id>` (Start on `/goal`) uses the Goal's open session for its current Plan or
  creates one (`sessions` plus one `session_steps` row per Step). A session for an older Plan of
  the same Goal is marked `restarted` first. `/rest` only continues the open session.
- After each change the page sends a snapshot (current Step, which Steps opened, the lines shown)
  to one server action, `recordFocusProgress`. The server sets `opened_at` and `done_at` once,
  clears `done_at` on Undo, marks the session `completed` and the Goal `done` on the last Done
  (both reopen on Undo), and inserts each newly shown line once: the background card, story cards,
  each pause message with its pause number, and each return pop-up. A stored line is never
  changed (there is no update policy on `session_lines`).
- The device keeps the focus session under `waveparticle.session.<session id>`. When the device
  has none, the session is rebuilt from the account: done Steps stay done, every shown card is
  shown again as it was (never regenerated), and the current Step's clock starts from its full
  time. Cards of the current Step that were not shown yet are not stored, so that Step continues
  with the cards it already showed.
- The signed-in pages have no test data. Without a configured model, or when generation fails,
  the failure screen shows and the clock does not start (FAIL-SCREEN, NO-BACKUP).
- `/goal`, `/focus` and `/rest` stay behind `PROTOTYPE_ENABLED` until the per-account daily cap on
  model calls (#256) exists.

## Consequences
- The screens are shared: `src/app/_session/focus-body.tsx` and `rest-body.tsx` serve `/try` and
  the signed-in pages, which differ only in their paths, server actions and storage.
- The rest conversation the user typed is not stored on the server by this change.
- Revisit with option B if people switch devices in the middle of a Step.

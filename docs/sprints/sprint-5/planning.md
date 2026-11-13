# Sprint 5 planning: Goals and Me (2026-11-26 to 2026-12-02)
Sprint goal: The Goals and Me pages let the user create, hold, finish and reopen Goals, see their history and session records, and set signals.
Attendees: TODO(human)

## Exit criteria
- [ ] Goals page with four tabs, Goal detail, and one-line Goal creation work against the signed-in account (#73, #78, #77).
- [ ] Hold, done and reopen each have Undo (#79).
- [ ] History and session records show past sessions (#80, #75).
- [ ] Me shows account, current and on-hold Goals, and the Signals sub-page stores its four settings (#81, #74).
- [ ] End-to-end journey: `create Goal → hold → reopen → finish → see it in History` passes.
- [ ] Every P0 and P1 issue below is Done; CI is green on `main`; the preview of `main` passes the smoke test.

## Issues
Snapshot of the board on 2026-11-12. The board is the source of truth; priorities follow `../README.md`.

| Priority | Issue | Size | Status |
|---|---|---|---|
| P1 | #73 US-GM-1: Goals page with four tabs and goal rows | L | Ready |
| P1 | #74 US-GM-10: Signals settings for time-up, new cards, lock screen and clock | M | Backlog |
| P1 | #77 US-GM-2: Create a new Goal with one line | S | Ready |
| P1 | #78 US-GM-3: Goal detail with read-only Steps | M | Ready |
| P1 | #79 US-GM-4: Put on hold, mark done and reopen, always with Undo | M | Ready |
| P1 | #80 US-GM-5: History of sessions in Goals | M | Ready |
| P1 | #81 US-GM-7: Me page: account, current Goal and on-hold Goals | M | Ready |
| P2 | #71 US-FOC-11: Setting: keep the clock running when I leave | S | Ready |
| P2 | #72 US-FOC-17: "Where I am now" card from his portrait | S | Ready |
| P2 | #75 US-GM-12: Session Record page and records of finished Steps | L | Ready |
| P2 | #76 US-GM-13: Remove the period summary row from History | S | Ready |
| P2 | #82 US-GM-8: Me page: history as a calendar and a list | M | Ready |
| P2 | #83 US-GM-9: Me page: appearance, plain text and replay of the intro | S | Ready |

## Notes
Note: #74 lists #115 and #116 as dependencies, but those two read the settings #74 stores; see dependency notes.

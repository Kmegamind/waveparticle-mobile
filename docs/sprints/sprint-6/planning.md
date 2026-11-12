# Sprint 6 planning: Companions, Life Path and Home (2026-12-03 to 2026-12-09)
Sprint goal: The user picks a Companion, sees his Life Path with the current Story and later rows, and Home reflects every state of the account.
Attendees: TODO(human)

## Exit criteria
- [ ] Companions list with select-then-Enter; one-Story Companions skip the Life Path (#93, #95).
- [ ] Life Path shows rows in order with ages, row states by shape and name, no counts or locks, and stories unlock in order (#96, #97, #99, #98).
- [ ] Home covers in progress, first visit, welcome back after three days, and the Goal card menu, reading only the signed-in account (#86, #89, #87, #88, #90).
- [ ] End-to-end journey: `Companions → Life Path → Begin → Goal dialogue`, and `Home after a finished Story` pass.
- [ ] Every P0 and P1 issue below is Done; CI is green on `main`; the preview of `main` passes the smoke test.

## Issues
Snapshot of the board on 2026-11-12. The board is the source of truth; priorities follow `../README.md`.

| Priority | Issue | Size | Status |
|---|---|---|---|
| P0 | #96 US-MAP-3: Life Path page with rows, ages and later rows | L | Ready |
| P1 | #86 US-HOME-1: Home with a Goal in progress | M | Ready |
| P1 | #87 US-HOME-3: Welcome back after more than three days, with a calm start-over | S | Ready |
| P1 | #88 US-HOME-4: Goal card menu | S | Ready |
| P1 | #90 US-HOME-6: Home reads only the signed-in account | S | Ready |
| P1 | #93 US-MAP-1: Companions list with select-then-Enter | M | Ready |
| P1 | #97 US-MAP-4: Row states carried by shape and by name | M | Ready |
| P1 | #98 US-MAP-7: Stories unlock in order and are played by the first finisher | M | Ready |
| P1 | #99 US-MAP-8: No counts, markers or locks on the map | S | Ready |
| P2 | #84 US-CON-13: Content inputs for all 26 Oppenheimer Stories | L | Ready |
| P2 | #85 US-FMT-8: Reread a finished Step as the original row of cards | M | Ready |
| P2 | #89 US-HOME-5: First visit shows one card | S | Ready |
| P2 | #91 US-HOME-7: Home after finishing and after a long absence with nothing in progress | M | Ready |
| P2 | #92 US-HOME-8: Quick Replay and starting a new Goal from Home | S | Ready |
| P2 | #94 US-MAP-10: Record of a finished Story | M | Ready |
| P2 | #95 US-MAP-2: Companions with one Story skip the Life Path | S | Ready |

## Notes
Risk: content for all 26 Stories (#84) is size L and Should.

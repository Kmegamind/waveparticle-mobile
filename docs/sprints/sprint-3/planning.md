# Sprint 3 planning: one full loop (2026-11-12 to 2026-11-18)
Sprint goal: A signed-in user writes a Goal, gets a Plan of Steps, works through each Step on the focus page with his cards written live (authored cards as the fallback), presses Done to move on, and reads the summary after the last Step.
Attendees: TODO(human)

## Exit criteria
- [ ] A Goal written in the dialogue is split into Steps by the AI and saved on our server when Start is pressed (#40, #32, #8).
- [ ] The focus page runs a Plan of several Steps with the clock from timestamps; leaving the app freezes it (#18, #11, #19).
- [ ] Each Step opens with one card and new cards arrive one at a time, written live and checked by the content gate, with authored cards when the model fails (#12, #43, #46, #55).
- [ ] Done opens the next Step and can be undone; the last Done opens the summary with the closing line (#26, #27, #52, #41).
- [ ] End-to-end journey: `Goal → Plan → focus → Done on every Step → summary` passes at mobile size against a signed-in test account.
- [ ] Every P0 and P1 issue below is Done; CI is green on `main`; the preview of `main` passes the smoke test.

## Issues
Snapshot of the board on 2026-11-12. The board is the source of truth; priorities follow `../README.md`.

| Priority | Issue | Size | Status |
|---|---|---|---|
| P0 | #8 US-ACC-3: Goal and Step text lives on our server | M | Ready |
| P0 | #12 US-FMT-1: A Step opens with exactly one card, and new cards arrive one at a time | M | In progress |
| P0 | #13 US-FMT-11: A background card in his own voice at the very start of a Goal | M | Ready |
| P0 | #18 US-FOC-1: Focus page for a Plan with several Steps | L | Ready |
| P0 | #32 US-GD-15: Start creates the Goal and the Plan | M | Ready |
| P0 | #43 US-AI-2: The AI writes the Step's cards live, with authored cards as the fallback | L | Ready |
| P0 | #45 US-CON-1: Story records for all Stories of a Companion | M | Ready |
| P0 | #46 US-CON-12: Content review gate and automatic card checks | M | Ready |
| P0 | #49 US-CON-9: Bring in the existing chapter 8 and Trinity content | M | Ready |
| P1 | #5 US-A11Y-3: Timer, live regions and button names | S | Ready |
| P1 | #9 US-GM-14: Copy rules enforced before release | S | In progress |
| P1 | #11 US-PLAT-2: The clock is computed from timestamps | M | Ready |
| P1 | #14 US-FMT-2: The card stack: swipe, buttons and dots | M | Ready |
| P1 | #15 US-FMT-3: How many cards a Step has and how far apart they come | M | Ready |
| P1 | #17 US-FMT-9: The first card of the next Step shows what he finished and what he now faces | M | Ready |
| P1 | #19 US-FOC-10: Leaving the app freezes the clock | M | Ready |
| P1 | #21 US-FOC-16: Failure states: his line fails to load, or there is no network | S | Backlog |
| P1 | #22 US-FOC-18: Your Steps panel and the Step description | S | Ready |
| P1 | #23 US-FOC-2: Focus page for a single Step | S | Ready |
| P1 | #25 US-FOC-4: The last card arrives at 00:00, and nothing else happens | S | Backlog |
| P1 | #26 US-FOC-5: Done opens the next Step, and the clock starts by itself | M | Ready |
| P1 | #27 US-FOC-6: Every Done can be undone, and Done never asks a question | M | Ready |
| P1 | #28 US-FOC-7: Pause freezes the clock and opens the rest page | S | Backlog |
| P1 | #29 US-FOC-8: Pause has no limit and no warning | S | Ready |
| P1 | #31 US-GD-14: The conversation's limits are enforced by the server | M | Ready |
| P1 | #34 US-GD-2: He reacts to the shape of the Goal | M | In progress |
| P1 | #39 US-GD-9: Each Step has a title and a short description | M | In progress |
| P1 | #40 US-AI-1: Split a Goal into Steps with two small AI calls | L | Ready |
| P1 | #41 US-AI-10: The closing line on the summary | M | Ready |
| P1 | #48 US-CON-8: Content for chapter 1 of Oppenheimer | L | Ready |
| P1 | #50 US-MAP-5: Current Story card with Begin | M | Backlog |
| P1 | #51 US-MAP-6: New users start at chapter 1 | S | Backlog |
| P1 | #52 US-MAP-9: Summary after the last Step, with merged key moments | L | In progress |
| P1 | #55 US-SAF-9: Output guard on every AI reply | S | Ready |
| P1 | #189 chore: make every human-only step visible (Human steps in PRs, migration command, post-deploy check) | M | In progress |
| P1 | #225 docs: sprint calendar, priority rules, Definition of Ready and sprint exit criteria | S | In progress |
| P2 | #16 US-FMT-4: Every card can be read on its own | S | Ready |
| P2 | #134 T-13: Run the content checks on authored fallback cards in CI | M | Ready |
| P2 | #216 Gateway: writeStepCards must not send the user's Step title to the model | S | Ready |

## Notes
Load: 39 issues against about 25 closed per week in Sprints 1–2. P2 issues are the first to move. Risks: model latency and cost; #66 (rest page) is needed by #28 and #21 (see dependency notes).

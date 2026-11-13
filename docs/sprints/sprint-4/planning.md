# Sprint 4 planning: pause and rest (2026-11-19 to 2026-11-25)
Sprint goal: Pause opens the rest page, where he writes first and the user can talk with him; coming back shows the return pop-up before the clock restarts. Every AI reply passes the guard and the cost caps.
Attendees: TODO(human)

## Exit criteria
- [ ] Pause freezes the clock and opens the rest page with his live stuck moment, or an authored fallback (#56, #66, #65).
- [ ] The rest conversation replies within the guard and cost caps, with deflection lines as the fallback (#59, #60, #63).
- [ ] Back from rest shows the return pop-up, then the clock restarts (#57, #61, #62, #68, #69).
- [ ] End-to-end journey: `focus → Pause → rest conversation → Back → return pop-up → clock runs` passes.
- [ ] Every P0 and P1 issue below is Done; CI is green on `main`; the preview of `main` passes the smoke test.

## Issues
Snapshot of the board on 2026-11-12. The board is the source of truth; priorities follow `../README.md`.

| Priority | Issue | Size | Status |
|---|---|---|---|
| P0 | #56 US-AI-3: The AI writes his stuck moment when I pause | L | Ready |
| P0 | #59 US-AI-6: The rest conversation replies | L | Ready |
| P0 | #60 US-AI-7: Guard and cost caps for the rest conversation | M | Ready |
| P0 | #64 US-CON-4: Scene table and state tag on every card | M | Ready |
| P0 | #65 US-CON-7: Inputs and fallback set for the live rest scenes | L | Ready |
| P1 | #57 US-AI-4: The AI writes the return pop-up when I come back from rest | M | Ready |
| P1 | #61 US-AI-9: The return pop-up after an absence is generated live | M | Ready |
| P1 | #62 US-CON-10: Authored fallback lines for the return pop-up | M | Ready |
| P1 | #66 US-FOC-13: The rest page: he writes first, and nothing interrupts the rest | M | In progress |
| P1 | #67 US-FOC-14: The rest conversation | M | In progress |
| P1 | #68 US-FOC-15: Back from rest brings the return pop-up, then the clock | S | In progress |
| P1 | #69 US-FOC-19: The return pop-up before the clock restarts | M | In progress |
| P2 | #42 US-AI-12: Offline test runs with the real prompts | M | Ready |
| P2 | #58 US-AI-5: The pause prompt receives the pause number | S | Ready |
| P2 | #63 US-CON-11: Fallback and deflection lines for the rest conversation | M | Ready |
| P2 | #70 US-FOC-9: His message gets stronger from the third pause | S | Ready |
| P2 | #135 T-14: Add logging and error monitoring that never records user text | M | Ready |

## Notes
Risks: cost of the rest conversation; safety of free text (the classifier, #117, is in Sprint 7, so the output guard #55 must be Done first).

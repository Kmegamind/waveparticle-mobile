# Sprint 7 planning: release readiness (2026-12-10 to 2026-12-16)
Sprint goal: The app is ready for a first release to real users: safety, privacy and terms are in place, device features are checked on real phones, and the accessibility audit passes.
Attendees: TODO(human)

## Exit criteria
- [ ] Crisis classifier, real hotlines by region and the legal and clinical review are Done (#117, #118, #121).
- [ ] Privacy notice, export and delete of data, and the stories and Terms page are live (#102, #103, #104).
- [ ] Accessibility: large text, narrow screens, reduced motion, and reading order pass the `DESIGN.md` section 8 checklist (#100, #101).
- [ ] Real-device check on one iPhone and one Android phone is recorded (#153).
- [ ] End-to-end journey: `sign up → full loop → export data → delete account` passes.
- [ ] Every P0 and P1 issue below is Done; CI is green on `main`; the preview of `main` passes the smoke test.

## Issues
Snapshot of the board on 2026-11-12. The board is the source of truth; priorities follow `../README.md`.

| Priority | Issue | Size | Status |
|---|---|---|---|
| P1 | #100 US-A11Y-2: Large text, narrow screens and reduced motion | M | Ready |
| P1 | #101 US-A11Y-4: Cards, rows and reading order | M | Ready |
| P1 | #102 US-ACC-4: Privacy notice in plain English | S | Ready |
| P1 | #103 US-ACC-5: Export and delete my data | M | Ready |
| P1 | #104 US-ACC-6: About these stories and the Terms | S | Ready |
| P1 | #117 US-SAF-4: Classifier for crisis and ordinary stress | M | Ready |
| P1 | #118 US-SAF-5: Real hotlines by region | M | Ready |
| P1 | #121 US-SAF-8: Legal and clinical review before release | L | Ready |
| P1 | #153 T-8b: Test vibration, notifications and the clock on a real iPhone and Android phone | S | Ready |
| P2 | #105 US-AI-11: What may be sent to the AI provider | S | Backlog |
| P2 | #106 US-CON-5: Something new in every story card | L | Backlog |
| P2 | #107 US-FMT-10: Length of the background card | S | Backlog |
| P2 | #109 US-GD-11: Read the time from the Goal text | M | Backlog |
| P2 | #110 US-GD-13: His lines never state the number of Steps | S | Backlog |
| P2 | #111 US-GD-7: Plan editing rules: position, order and pinned Start | S | Backlog |
| P2 | #113 US-HOME-11: Softer first-run wording about the Story's weight | S | Ready |
| P2 | #115 US-PLAT-3: A light haptic at 00:00 where the device supports it | S | Backlog |
| P2 | #116 US-PLAT-4: An opt-in lock-screen notification at time-up | L | Backlog |
| P2 | #119 US-SAF-6: What is logged about safety events | S | Ready |
| P2 | #120 US-SAF-7: Safety test sets and error budget | L | Ready |
| P3 | #108 US-FMT-7: Cards written so that they can be read aloud | M | Backlog |
| P3 | #112 US-GM-6: Find a Goal or a past session | M | Ready |
| P3 | #114 US-MAP-11: Internal research flag that turns the Story off | M | Ready |

## Notes
Many P2 issues here are `blocked`; they stay in Backlog until unblocked and are the first to move to a later release.

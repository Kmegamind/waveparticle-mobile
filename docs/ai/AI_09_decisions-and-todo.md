Imported from the planning folder on 2026-11-05. The decisions file docs/DECISIONS.md overrides this document where they differ.

# AI decisions log and to-do — v2 (2026-11-04, after the user test)

> Replaces AI_09 v1 (earlier version, not imported) as the working log. Source brief: [PROMPTS_user-test-research-round_2026-11-04](../PROMPTS_user-test-research-round_2026-11-04_v1_draft.md), WP2.8. Companion drafts: [AI_03 v2](AI_03_stuck-story-layer.md), [AI_04 v2](AI_04_rest-chat.md), [AI_05 v2](AI_05_safety.md).

## Change list (v1 → v2)

| # | Change |
|---|---|
| 1 | D-AI-4 (third-Pause warning) → **cancelled with the timer-reset rule** (confirm, Q1 below). AI-4 §12 no longer applies |
| 2 | D-AI-5 (safety parked) → **un-parked as a draft** after B18 |
| 3 | New proposals P1 to P6 (below), each with a recommendation, to be decided one at a time |
| 4 | New to-dos T8 to T14 |
| 5 | Questions for WP2.3 and WP2.6 collected at the end |

## Decided (carried forward, unchanged)

| # | Decision | Status |
|---|---|---|
| D-AI-1 | Hybrid: authored spine (AI-2); model for stuck story, rest chat, end line, goal split; always behind checks with authored fallback | Stays |
| D-AI-2 | Stuck story = two calls (stuck on Pause, resolved on Back) | Stays; **modified by P2**: no resolved call for a quiet pause |
| D-AI-3..9 | See v1 | Stays |
| D-AI-4 | No chat reply limit | Stays (only the third-Pause warning is cancelled) |

## Proposals, one question at a time (decide in this order)

| # | Question | Recommendation | Evidence level | Doc |
|---|---|---|---|---|
| **P1** | Is AI-4 §12 (third-Pause warning) cancelled together with the timer-reset rule? | Yes, cancel both. No Pause-count consequence anywhere | Decision by Yue on the timer rule; the warning is my reading | AI-4 v2 |
| **P2** | What does he do on the Kth Pause in a step? | K=1, 2: a new snag. K≥3: a quiet "nothing has moved" line, no snag, no resolved call | Reasoned; test arm B repeats snag 2 | AI-3 v2 §A3 |
| **P3** | How does the rest chat treat task and general-knowledge questions? | Stay in his day: deflect in character, answer only from his side, never explain (option 1); no chips | Need seen in the test; the policy is Reasoned | AI-4 v2 §A |
| **P4** | What does he say when asked "Are you an AI?" | One honest plain sentence in system voice, not in character (verify with legal) | Guess; compliance | AI-4 v2 Q1 |
| **P5** | Does safety get three tiers, and does T2 (low mood) ship in the next test? | Three tiers; T2 step-out line is tested with scripted phrases only | Guess; compliance | AI-5 v2 |
| **P6** | Return line after hours: picked or generated? | Picked from an authored pool; shown as the `return` card and on HOME-2; never mentions time away | Reasoned | AI-3 v2 §C |

## To-do

| # | Item | Owner |
|---|---|---|
| T1 | Safety tiers, resources, logging, test sets, legal checks (AI-5 v2 §7) | Yue + compliance |
| T2 | (cancelled) third-Pause warning wording and R-WARN screen | — |
| T3 | Wireframe: Back button on C1/rest; resolved line placement; fate of timed R2 | WP2.6 |
| T4 | Write `rest_chat_fallback` (6 neutral + 3 deflections per scope), authored snag/quiet/return pools (56 + 24 lines for c1 to c4) | WP2.3 |
| T5 | Chat cost caps (last 6 turns, 300 chars, 30 messages) | Engineering |
| T6 | Update prototype C1 note and NF6 text ("Kth line", "three replies") | Prototype session |
| T7 | Open decisions D-AI-3, 6, 8, 9 | Yue |
| T8 | Offline real-model run for AI-3 snags (AI-3 v2 §A6): 20 runs × 5 Pauses × 4 entry states, categories on and off | WP2.8 (after Yue agrees) |
| T9 | Offline real-model run for rest chat (AI-4 v2 §C): 180 replies | WP2.8 |
| T10 | Wizard of Oz arms for Pauses, chat, return line | Yue recruits real users |
| T11 | Scope label and JSON output for AI-4 (prompt change) | WP2.8 |
| T12 | `used_lines` run store and dedupe check in the AI-6 checker | Engineering |
| T13 | Chinese versions of the rules and test sets | Native speaker, TBD |
| T14 | Authored props / `scene_objects` / `places` / `people` per entry state | WP2.3 |

## What a small test would prove (summary)

| Test | Proves or disproves | Testers |
|---|---|---|
| Offline snag generation, categories on vs off | That code-picked variety lowers repeats and events | None (model only) |
| WoZ, 3 sessions, quiet line vs repeated snag | That K≥3 quiet line feels less repetitive and less guilt-inducing | 8–10 real users who Pause often |
| Offline rest-chat set (180) | In-character rate, leakage, relevance, cost | None |
| WoZ, deflect vs answer-briefly | That deflection is acceptable and not cold | 8–10 real users with a task in progress |
| Safety offline sets | Error budget in AI-5 §4 | None; clinical adviser labels |
| WoZ, T2 step-out line (scripted) | Caring vs intrusive | Adults who agree to sensitive wording; no real distress typed |
| WoZ, return card vs none vs "he waited" | That a stasis line helps without guilt | Users who really left for 3–24 h |

The testers' own feedback in the first test may have been simulated (brief); these tests need **real** people.

## Questions for other sessions

**WP2.3 storydatabase (pool sizes and lists):**
1. Authored snag pool: 8 snags (+ `return` lines) per entry state; quiet pool: 6 per entry state; return-card pool: 6 per entry state (3 short away, 3 long away). For c1 to c4 that is 80 lines; 8 slices would make 160. Acceptable?
2. Per entry state: `props` (about 18), `scene_objects`, `places`, `people`.
3. Deflection lines for `knowledge` and `task`: 3 each per entry state.
4. Post-1942 denylist for the Canyon.
5. Who runs the card-vs-opening contradiction check (B09/B10)?

**WP2.6 focus/break (screens):**
1. Where the quiet line and `return` card appear on R1 and F1.
2. Does R1's first message use the same short delay for quiet lines?
3. Behaviour when the user taps Back after a quiet pause (no resolved call).
4. T2 step-out line: placement in chat (a system line between bubbles) vs a small card.
5. Whether chat history persists across returns to the rest page in the same step.
6. Where `meta` (AI) answers show if out-of-character.

**WP2.4 alive (Home):** the return line for HOME-2 (AI-3 v2 §C2); how tired and low-mood users are treated on Home (T2 never changes Home copy).

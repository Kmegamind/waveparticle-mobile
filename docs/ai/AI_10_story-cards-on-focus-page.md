Imported from the planning folder on 2026-11-05. The decisions file docs/DECISIONS.md overrides this document where they differ.

> **Status after the decisions up to 2026-11-15 (#295): superseded as a design.** The card types of section 1 and the counts of section 2 are replaced:
> - A step opens with exactly one card; further cards arrive one at a time; cards form a stack with Earlier card and Newer card buttons (X2, X6). The background card opens the Goal (T4, D3). There is no separate time-up card (T8) and no back-from-rest card: the return is the live return pop-up (R1).
> - The background card and the step story cards are **made ahead once per story part**, read by a person before publishing and shared by all users (SHARED-STORY, CARDS-PER-PART, READ-STATUS). When the user starts, the app spreads the parts across the user's Steps with plain code (`src/lib/story/start.ts`), with no model call. The earlier rule that the first card of the next step is generated during the previous step no longer applies.
> - Lengths: a step story card is 1 to 3 sentences and at most 45 words; the background card at most 70 words (LEN-CARD). Every card contains something new (CARD-NEW); no year, date or age (DATES-ADMIN-ONLY); never the number of Steps (NO-STEP-COUNT).
> - There are no authored, bundled or ambient fallback cards (NO-BACKUP, NO-FALLBACK-TABLES); section 6 is withdrawn. The closing line is made ahead with the cards (CLOSING-AHEAD); the Canyon `closing_fallback` drafts in section 5 are reference examples only.
> - Open questions 1 (the next Step starts by itself after a 1.2 second hold, X3), 3 (the return is a pop-up, R1) are closed. Open question 5 had the answer 1 to 5 story cards per Step (T7); how that limit applies when several parts fall in one Step is not settled. Kept as history.

# AI-2 / AI-3 / AI-7 · Story cards on the focus page (landing page removed)

> **Date**: 2026-10-29 · **Status**: v1 draft · Part of the [AI index](AI_00_index.md). (Named AI_10 because AI_09 is already the decisions log.)
> **Change (Yue)**: the landing page (L1, L2) is removed. The landing sentence and "his next concern" become the **first story card of the next step** on F1, which now holds **several swipeable cards per step**.
> **What I do not know** (Yue draws the wireframe): how many cards are visible, whether cards from earlier steps stay reachable, what starts the next step's timer now that there is no Next step button (FLOW D-1), what happens to F1-CARD. Everything below marked *hypothesis* fills those gaps and should be changed to match the wireframe.

## 1. Card types: authored or model, and when each is created

| # | Card | Created | Source | Model? | Notes |
|---|---|---|---|---|---|
| C-open | **Opening card** (step 1 only) | Step 1 starts | Authored state line from the first entry state (S0) | No | Replaces the old first state line |
| C-land | **Landing + concern card** (steps 2 to N) | The moment the user taps **Done** on the previous step; shown as the first card of the next step | Authored: `landing` of the highest-priority slice the finished step covered, then `worry` of the next step's first slice (NF3 L1 data, unchanged) | No | Two sentences in one card. Same selection rules as before |
| C-state | **State card** | Every **15 foreground minutes** in the step (the first one at the start, after C-land) | Authored pool for the step's entry state; seeded by `run_id`; no repeats | No | Background time is frozen (FLOW D-3), so no card is created while the app is away |
| C-time | **Time-up card** | Timer reaches 00:00 | Authored `tu` line for the entry state | No | Appended as a card; the timer stays at 00:00 (R-T) |
| C-back | **Back-from-rest card** | The user taps **Back** on the rest page and returns to the step | **AI-3 call 2** (resolved line), written by the model behind AI-6 checks | **Yes** | Fallback is the authored `return` line. Created once, stored, never regenerated |

So **only one card type is model-written (C-back)**; the rest are authored and cost nothing. Nothing is created "after Pause": the stuck message stays on the rest page (R1).

## 2. How many cards per step (hypothesis)

`cards = 1 (C-land, or C-open on step 1) + 1 + floor(foreground_minutes / 15) state cards + 1 time-up (if reached) + one C-back per return from rest`

| Step length | Cards at 00:00 without a Pause |
|---|---|
| 15 min | C-land + 1 state + time-up = 3 |
| 30 min | C-land + 2 state + time-up = 4 |
| 60 min | C-land + 4 state + time-up = 6 |

Pool limits (NF3: S0 has 8 state lines, other entry states 4, plus 4 story `ambient`): a step can show at most 8 state cards before the pool is empty. **Rule: when the pool is used up, stop adding state cards; never repeat one.** A cap of about 8 cards per step also keeps the stack swipeable (hypothesis). Time-up and C-back cards do not use the state pool.

## 3. What AI-2 now picks per step

For each step the code needs: 1 landing+concern pair (from the finished step), N_state state lines, 1 time-up line, and (if a Pause happens) the AI-3 resolved line. Compared with the old design, the **landing and concern are no longer a separate screen**: same data, new place. The user's **Done** is still the only event that creates a new story card of its kind; the clock only adds state cards, and none of them can state a fact from the step's own slices (entry-state rule, unchanged).

Which steps get a C-land: every step except step 1. With N = 1 there is no C-land at all (see §5).

## 4. Checks for cards that stay visible and can be re-read (AI-6)

The old checks assumed one line, replaced after 15 minutes. Cards are a **set that persists**, so add:

| Check | Why | Applies to |
|---|---|---|
| Same rules as before per card (one-way set: no question, no "you", no hook, no clock or duration, no probe words, no dash, ends with a full stop) | Unchanged | All cards |
| **Self-contained**: no reference to another card ("again", "another", "as I said") | A card can be re-read alone, out of order | All cards (offline for authored pools, runtime for C-back) |
| **No near-duplicate inside one step's set** (NF5 P01 to P03 across the displayed set, same three-word opener at most once) | Several cards are on screen history together; repetition is now visible | State cards, time-up, C-back |
| **Immutable once shown**: stored in the run log with an id; re-render reads the stored text, never re-picks or regenerates | The user may swipe back; a changed card would be a leak or a glitch | All cards |
| **No time or count labels on cards** (no "15 min later", no "card 2 of 4") | R-N and no clock | All cards |
| Slice-fact leak check, entry-state rule | Cards of one step must all be true at the step's entry state | State and time-up cards |
| C-back is checked **before** it is appended, not after; on a fail it is the authored `return` line, not an error | Never show an unchecked line | C-back |
| Authored cards: re-run NF5's script and the leak scan whenever a pool changes | They stay on screen the longest | Offline |

Accessibility (hypothesis, for the wireframe): a button or arrow alternative to swiping; new cards are **not announced** and focus does not move (as NF6 did for the status slip); cards in order, each readable alone.

## 5. The last step: no L2

Done on the last step goes straight to **END** (the button wording "Finish" moves to F1's last-step Done, or END opens after Done; Yue decides). What was L2's job moves:

| Was in L2 | Now |
|---|---|
| The landing sentence of the last slice (Canyon: Groves on the school grounds looking out, Oppenheimer quiet) | Becomes **input to AI-7** (`last_moment`, already in the prompt) and is therefore carried by his closing line. END does **not** also show it as a separate authored sentence (hypothesis, avoids saying it twice) |
| The landing for N = 1 (highest-priority slice only; the rest left to END, NF3 §8) | Unchanged: the closing line now carries more, so AI-7 must receive all done `happened` lines, not just the last one |

**What END needs from AI-7**
1. `closing_line` generated from `happened` of the done tasks, the stuck events and how they resolved, and the smooth/rough mode (unchanged).
2. **Start the call when the last Done is tapped** (no L2 to start it on), and open END immediately with the steps list and `carry_line`; let `closing_line` appear when ready, or show the fallback after about 2 s (hypothesis).
3. **`closing_fallback` for the Canyon must be written** (none exists; Trinity has 4). Two drafts, both pass NF5's script as LC-type lines (no warnings): smooth: "Groves stood on the school grounds and looked out from the mesa, and I kept quiet. I am still sorting out what I feel." Rough: "The canyon was wrong and the mesa was not, and I said so once. I am tired in a way I did not expect." Drafts, unread by a content owner. Note both mention the mesa as a fact of the last slice, which is fine at END and not before.

## 6. Fallback when a card fails to load

> **Withdrawn** (NO-BACKUP, NO-FALLBACK-TABLES). Cards are read from the published story content. Kept as history.

| Card | Failure | Result |
|---|---|---|
| C-land, C-state, C-time | Pool cannot load | Bundled lines for the entry state, then `ambient`; if both are used, no new card is added. No error text, no retry, no spinner (NF6 F3) |
| C-back | Model fails, check fails twice, or slow at Back | Authored `return` line for the entry state (the Back tap never waits more than about 1 s) |
| Any card text missing from the stored run | Re-render | Show the bundled line for that card's slot, never an empty card |
| Whole stack missing | | F1 renders with the opening state line only |

## 7. Screen IDs that change

| ID | Change |
|---|---|
| **L1** | **Removed.** Content becomes C-land, the first card of the next step on F1 |
| **L2** | **Removed.** Last Done → END; its sentence is input to AI-7 |
| **F1, F1S** | **Changed**: several swipeable cards per step (F1S single-step also has state and time-up cards) |
| **F1-CARD** | **Review**: his card (his line, where he is now, what he has done so far) overlaps with the card stack; keep, merge or drop (Yue) |
| **F2** | **Changed**: time-up becomes an appended card (timer still 00:00) |
| **F3** | **Changed**: failure fallback is a bundled card in the slot, never an error |
| **F4** | **Minor**: shows the same cards, marked Paused |
| **R2 / Back** | **Changed**: the resolved line (AI-3 call 2) now also lands as C-back on F1 after Back |
| **HOME-4** | **Changed**: "left at a landing card" no longer exists as a state; Continue → F1 of the next step with its first card, timer not started (needs a wireframe) |
| **HOME-1** | Shows the latest card's text, no new line |
| **END** | **Changed**: no L2 before it; carries the last landing weight (§5) |
| (open) | **FLOW D-1** ("user taps Next step") has no button now; what starts the next step's timer must be drawn |

## 8. Latency and cost

Zero model calls for authored cards. C-back is the existing AI-3 call 2. AI-7 starts on the last Done. No new model calls were added by this change.

## 9. Evaluation cases

| # | Case | Expected |
|---|---|---|
| 1 | Canyon, N = 4, finish step 1 | Step 2 opens with C-land (c1 landing + c2-entry worry), then state cards from c2's entry state |
| 2 | 60-min step, no Pause | 4 state cards, then time-up; all distinct; none states a c2 fact |
| 3 | Pause, Back | One C-back appended; it does not change on re-read |
| 4 | Model fails at Back | Authored `return` card, no error |
| 5 | Two state cards share an opener | Offline P03 warn; runtime set check fails the pool, not the run |
| 6 | Last step Done | END opens at once with the steps list; closing line within 2 s or fallback |
| 7 | App restarted mid-step | Same cards, same order, same text |

## 10. Open questions

1. How does the user start the next step now (D-1)?
2. Are earlier steps' cards still reachable, or only the current step's?
3. Is C-back a card, a slip on the rest page, or both (earlier suggestion was the rest-page slip for about 1.5 s)?
4. END: show the last landing as its own line, or only through the closing line (this spec: only through the closing line)?
5. Card cap per step (8 is a guess).

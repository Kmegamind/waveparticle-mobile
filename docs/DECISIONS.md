# Decision log

This file records every product decision that overrides an older document. When this file and another document disagree, this file wins. Each decision has an id that matches the planning folder (`1_Projects/Newfeatures/PRODUCT_doc-map-and-open-decisions_2026-11-04_v1_draft.md`).

Decider: Yue (product owner). Dates are the day the decision was given.

## 1. Decided

### Scope and platform

| Id | Date | Decision | Consequences |
|---|---|---|---|
| S1 | 2026-11-04 | Release 1 contains everything in the current wireframes: Home, companion browsing, Life Path, goal dialogue, Goals and Me, focus page with story cards, rest conversation, summary. | This is larger than the recommended vertical slice. The backlog is split into milestones so that a testable core loop comes first. |
| S3, G5 | 2026-11-04 | The text a user writes (goal names, step names, step descriptions) is stored on our server, tied to the account (Supabase). | History works across devices. A clear privacy notice and account deletion are required. |

### Focus page and rest conversation

| Id | Date | Decision | Consequences |
|---|---|---|---|
| F1 | 2026-11-04, refined 2026-11-05 | Pause has no limit and no timer reset. Pausing never adds a screen, a pop-up or a penalty. Every Pause opens the same conversation: the character first sends a message about the snag his own task has hit and how he feels about it (a Pause means his side of the story has stalled). The message is generated live. The prompt receives the number of the pause. From the third Pause in one step, the prompt changes: the character says more strongly that he cannot finish his task and asks the user not to pause again. | The change lives entirely in the prompt (pause count passed in, rules for the third pause and after). No new screen. The earlier "comments once" idea and the quiet line (A2, C7) are replaced by this. **From the fourth pause on, the same strong tone continues in new words each time; nothing else happens (decided 2026-11-05).** |
| F2 | 2026-11-04 | Leaving the app freezes the step clock. A setting named "Keep the clock running when I leave" is available. | A phone call is not quitting. |
| F3 | 2026-11-04 | Done never asks a question and is always allowed. Every Done can be undone. | A short Undo is shown after each Done, as it already is after the last step. |
| F4 | 2026-11-04 | Enforcement stops at level 1: when the user returns, the character shows a card about his own situation. Level 2 (one opt-in notification) is not built or tested. Level 3 (blocking apps) is never built. | No push notifications in Release 1 for this purpose. |
| F5 | earlier | Signals: a light vibration at 00:00, no vibration for a new card by default, nothing on the lock screen by default. | Whether iPhone web apps can do this depends on home-screen install; verify with engineering. |
| X3 | 2026-11-05 | After Done, the next step opens on the same page. The clock shows the new target, holds for 1.2 seconds, then starts without a tap. Done is greyed out during the hold. | There is no landing page (screens L1 and L2 are removed). |

### Story cards

| Id | Date | Decision | Consequences |
|---|---|---|---|
| X2, X6 | 2026-11-05 | A step opens with exactly one card. Further cards appear one at a time while the user works. Cards form a stack: one card is visible, a new card sits on top, swiping the top card left shows the previous card, swiping right brings the newer card back. Dots show position. Two buttons (Earlier card, Newer card) give the same function without a gesture. | The prototype showed four cards at step start, which is wrong. The content reveal schedule and the number of cards per step must change. |
| C2 | 2026-11-05 | Each story marks 2 to 4 key slices (turning points), confirmed by the content owner. A key slice ends a step when possible. When there are fewer steps than key slices, the summary lists the merged key moments, one first-person line each. | The goal dialogue does not forbid few steps. |
| M2 | 2026-11-05, refined the same day | The background card, told in the character's own voice at the start of the story, introduces the people who are present. There are no short introduction phrases in later cards, and no separate "what you need to know" screen. Names are not tappable. | Replaces the earlier rule of an introduction phrase of about 12 words in the first card where each person appears. A person who arrives mid-chapter is introduced only through the story's own words. |

### Cards, steps and time (2026-11-05)

| Id | Date | Decision | Consequences |
|---|---|---|---|
| T1 | 2026-11-05 | The character's goal mirrors the user's goal. If the user has x steps of y minutes each, the character also has x steps of y minutes each. The whole story is given to the AI with the instruction: the story is divided into x steps; according to the story's progress, split each step sensibly into n story cards. The number n is chosen by the AI for each step and is not fixed (five was only an example). A card appears every y divided by n minutes during that step. | Replaces the fixed 15-minute and 10-minute proposals and the idea of five cards. Cards belong to steps; each step has its own stack that starts again with one card. Assumption to confirm: the n cards include the card shown when the step opens. |
| T2 | 2026-11-05 | The user may choose any number of steps. There is no maximum. The goal dialogue asks, in this order: the user's task, the time available, then whether to split the task into finer steps. The assistant proposes a split and the user can adjust it. The question suits users who have a detailed task. | Replaces the maximum of 5 or 6 steps. |
| T3 | 2026-11-05 | The story is treated as a whole. The number and duration of the user's steps are matched by an AI that distributes the story across them; the content of each step may vary. Story slices do not decide how many steps there are. **Decided: the AI writes each step's cards live from the story's facts and the key turning points (given as must-use facts). Every card passes the same checks as authored cards (first person, no future facts, no clock times). The pre-written cards from the 8 slices remain as the safety net when a card fails the checks or generation is slow.** | The key-slice rule (C2) still holds: key moments are inputs the AI must use, and the summary lists any that were merged. The content team's work shifts to the facts, the leak map, the checks and the fallback cards. |
| T4 | 2026-11-05 | When the user first enters the story, an extra background card is shown first. It is not progress, so it is not counted among the n story cards. It tells who is in the story, the places, and the knowledge needed. | Assumption to confirm: it appears once at the start of the goal, not at the start of every step. |
| T5 | 2026-11-05 | Start over restarts the character's night, because the character's task has failed. | Resolves the open conflict between the story design and the prototype note. |
| T6 | 2026-11-05, final version the same day | **There is no time limit on resuming.** However long the user was away, they can resume their task. Before the clock restarts, a pop-up appears in which the character says what he did during that time and how he felt. When the user taps the start button in the pop-up, the original task resumes and the clock starts. This version replaces the earlier same-day rule and the 24-hour cut-off. | Removes the 24-hour rule, the Start-from-step-1 behaviour, the "not completed" History entry for lapsed tasks, and the older "Home keeps the task after 24 hours" rule. The pop-up text is generated by the AI. Open: in which return cases the pop-up appears (see the open list). |

### Goal dialogue, plan and content (2026-11-05)

| Id | Date | Decision | Consequences |
|---|---|---|---|
| R2 | 2026-11-05 | The rest conversation has no message limit and no hidden cap. | Removes the 30-message cap proposed for cost control; cost control is handled elsewhere (for example per-message length). |
| D1a | 2026-11-05 | The user types their own goal in a free text box. There is no restriction on what a goal can be and no list of unsupported kinds. | Remove "supported kinds" and "explicitly unsupported kinds" from the documents and the user stories. |
| D1b | 2026-11-05 | How a plan is split for different kinds of goals is the job of the AI planning prompt (a planning expert that already exists in the AI workflow). The product documents do not specify splitting rules per kind. | The repository must receive the real planning prompt from the AI workflow; the text in docs/ai/AI_01 is only a placeholder. |
| D1c | 2026-11-05 | Each step has a short title and a description of one or two sentences that expands the title (what to do and what to watch for). Example: title "English reading", description "Do the reading questions; pay attention to ..." | The description is generated with the plan and shown on the focus page. |
| D1d | 2026-11-05 | The plan always matches the time the user gave, so there is no "plan is longer than your time" message. The user can edit fully: change each step's time, the number of steps, the titles and descriptions. If the edits change the total, the goal's time follows the edits. | Removes the over-time line. |
| D3 | 2026-11-05 | The background card is told in the character's own voice, as storytelling: who is here, where this is, and what each person knows. It is never written from a third-party point of view, to keep the experience fully immersive. | Replaces the proposal of a three-line summary. |
| D4 | 2026-11-05, refined the same day | All 26 stories in the story database can be played in the first demo, because the content is generated live by the AI. The Life Path shows all 26 chapters. **Chapters are played in order: chapters ahead of the current one are visible but not tappable.** | The earlier idea of "coming soon" chapters is gone; chapters are not locked because of missing content, only by order. FLOW must not make later rows tappable. Authored fallback cards exist for only two stories. |
| G1 | 2026-11-05 | History shows the date, the duration and the steps the user marked as done. A "step the user marked as done" means a step on which the user pressed Done; it is not text the user typed. A session record page is added. | The weekly total row is removed. |
| G4 | 2026-11-05 | A one-time goal moves to Done automatically when its last step is finished. | |
| X5 | 2026-11-05 | The listen button is not in the first demo. | Confirmed. |

### Return pop-up (2026-11-05)

| Id | Date | Decision | Consequences |
|---|---|---|---|
| R1 | 2026-11-05 | The return pop-up (the character says what he did and how he felt, then the user taps a start button to restart the clock) appears when the user taps Back from the rest conversation, and when the user returns to the app after being away for 5 minutes or more. A shorter glance at another app resumes the clock with no pop-up. | The pop-up text is generated by the AI. The return line on the card stack and the separate "away card" are not needed for this purpose. |

### Defaults accepted by Yue (2026-11-05)

Yue replied "use the defaults" to the following list.

| Id | Decision | Consequences |
|---|---|---|
| D2 | Tone by moment and "three small turns of feeling per step" are rules inside the AI prompts, not product requirements. Every card must make sense on its own so a user can look back at it. A plainer English version is not in the first demo. | The AI prompts carry the tone rules. No reading-level setting in Me. |
| G2 | The session record page shows the date, the duration, the goal name and the steps the user marked done. It opens from Me, History. | Rows in History become tappable. |
| G3 | Settings have one "Signals" sub-page (for example vibration at 00:00 and keeping the clock running when leaving). There is no reading-level setting. | |
| H3 | For tired or low-mood users, only what the character shows is adjusted, never what he says. | |
| H4 | The wording of the "hardest afternoon of his life" promise in user-facing copy is softened. | |
| H5 | After finishing, Home keeps a small trace of the character. | |
| H6 | On the first visit Home shows one card and no sample data. | |
| H7 | After a long absence with nothing in progress, Home shows no "welcome back". | |
| D5 | For the 24 stories without pre-written cards, a few generic fallback lines in the character's voice are shown if generation fails or is slow. | |
| A7 | The end-of-story line is written by the model. Data retention by the model provider depends on the provider's terms and is not decided now. | |
| S2 | Engineering checks which phone features (vibration, lock-screen alerts, background timers) a web app can use on iPhone and Android. | Not a product decision. |

### Goal dialogue order (2026-11-05)

| Id | Date | Decision | Consequences |
|---|---|---|---|
| D1e | 2026-11-05 | The optional "how do you feel about this task?" question is removed. The goal dialogue is: goal, time, then "split into finer steps?". | The plan prompt receives no feeling. FLOW screen GD3 is the split question only. |

### Time-up and card timing (2026-11-05)

| Id | Date | Decision | Consequences |
|---|---|---|---|
| T8 | 2026-11-05 | The last story card of a step arrives exactly when the clock reaches 00:00 and is written to say the character is still at it. There is no separate time-up card. At 00:00 nothing else happens except the light vibration already decided; the clock stays at 00:00 until the user presses Done. | The n story cards of a step arrive at y/n, 2y/n, ... y minutes after the step starts. |
| T9 | 2026-11-05 | Details settled by default while applying the decisions: the first step opens with the background card as its one card; steps after the first open with the card about what he just finished (the landing of the previous step); the n story cards then arrive on the schedule in T8; the background card is the oldest card in the stack and needs no button to dismiss; Home's Continue and the Goals Continue go through the same return pop-up rule as other returns (pop-up when the user was away 5 minutes or more). | Stated here so the documents agree; reverse if Yue disagrees. |

### Goal dialogue and return details (2026-11-05)

| Id | Date | Decision | Consequences |
|---|---|---|---|
| D1f | 2026-11-05 | A vague goal gets no follow-up question. The planning prompt handles vague goals by turning them into concrete first steps, and the user can edit them. The goal dialogue has three turns: goal, time, split question. | Removes FR-START-5's follow-up and the follow-up line slot. |
| T10 | 2026-11-05 | Return details settled by default: with "Keep the clock running when I leave" on, leaving the app does not stop the clock, so there is no return pop-up for that case (the pop-up still appears after Back from the rest conversation); system back on the return pop-up goes to Home and the step stays paused. The Back button on the rest page is named "Back to step" (not "Back to task"), to follow the vocabulary Companion, Goal, Step. | |

### Card limits (2026-11-05)

| Id | Date | Decision | Consequences |
|---|---|---|---|
| T7 | 2026-11-05 | The gap between cards is at least 5 minutes, and a step has between 1 and 5 cards. The AI is told these limits and the app ignores any extra cards it returns. A step of 10 minutes therefore has at most 2 cards. | Limits apply to the n story cards, not to the extra background card. |

### Rules removed or deferred (2026-11-05)

| Id | Date | Decision | Consequences |
|---|---|---|---|
| H8 | 2026-11-05 | The rule "he never waits for the user" is deleted. There is no rule about whether he waits. The AI writes freely; if he says he waits, he waits; if not, nothing is said. User experience comes first. There is no guilt problem now because the bond between user and character is still light. | No prompt change for this. The constitution wording about "waiting for you" needs no change. |
| N1 | 2026-11-05 | The "start rate" north-star measure and the success-measures section are removed from the PRD. Measurement will be designed later. | PRD section 9 becomes a one-line note. |
| ACC | 2026-11-05 | The user must create an account as soon as they open the product. | The earlier plan to ask for sign-up after the first finished step is cancelled. |
| A5b | 2026-11-05 | Safety tier 2 (low mood) is not in the first demo, because its rules are complicated. The first demo has the crisis tier (real hotlines by region) and ordinary stress only. | Amends A5. |

### Story map and entry

| Id | Date | Decision | Consequences |
|---|---|---|---|
| M1 | 2026-11-05 | New users start at chapter 1 of the character's path. There is no designated entry story. | The existing authored content covers chapter 8 ("finding the place") and the Trinity night only. Chapter 1 content must be written. |
| M3 | 2026-11-05 | No markers for turning points or scenes on the map rows or on the current card. | |
| M4 | 2026-11-05 | No user-facing switch to turn the story off in Release 1. An internal research flag only. A Quiet mode may be tested later. | |

### Language

| Id | Date | Decision | Consequences |
|---|---|---|---|
| L1 | 2026-11-05 | Release 1 is English only. There is no language setting anywhere, no Chinese interface, and no Chinese test sets. | Remove the Language row from the prototype and from the Me page. Remove Chinese test-set work from the AI to-do list. |

### Vocabulary and fields

| Id | Date | Decision | Consequences |
|---|---|---|---|
| X1 | 2026-11-05 | The words are Companion, Goal and Step. The words Mission and Task are not used for the user's work. | All documents, screens and code identifiers follow this. |
| X4 | 2026-11-05 | "Start with…" is cancelled everywhere. | The short step description, generated with the plan and shown read-only, replaces it. |

### AI behaviour

| Id | Date | Decision | Consequences |
|---|---|---|---|
| C1 | 2026-11-05 | The AI workflow is already configured: the AI first generates a stuck story, then the character describes his predicament and how he feels. This is live generation. | Authored snag lines become a fallback set only. The content team supplies the generator's inputs (scene table, allowed props, allowed names, rules). |
| A3 | 2026-11-05 | The rest conversation is in the character's world and voice. He may answer questions; he does not have to refuse. | Open: what he does with questions about things he could not know in his time. |
| A4 | 2026-11-05 | The fact that the character is AI is disclosed only in the terms and in settings. The conversation does not mention it. | Legal risk: some regions require a clear answer when a user asks directly. Check with a lawyer before release. |
| A5 | 2026-11-05, amended by A5b | Safety had three tiers (crisis, low mood, ordinary stress) in Release 1; the low-mood tier is now deferred (A5b), with a classifier and real hotlines by region. | Replaces the earlier decision to park safety. Needs legal and clinical review, a hotline list by region, English test sets, and a logging rule. |
| A6, H2 | 2026-11-05 | The line shown when the user returns after hours is generated live by the AI. | A small authored fallback is still required. |

## 2. Superseded rules (do not implement)

| Rule | Replaced by |
|---|---|
| Landing page after each step (screens L1, L2) and a "Next step" button | X3 |
| Home state "Next: Step 3" (HOME-4) | X3 |
| Third-pause warning (R-WARN) and timer reset | F1 |
| Timed return of the character on the rest page (screen R2) | The character stays stuck until the user taps Back |
| "Start with…" field | X4 |
| Reply limit of three in the rest conversation | No limit |
| Designated entry story (chapter 8) for new users | M1 |
| Several cards shown at step start | X2, X6 |
| Words Mission and Task for the user's work | X1 |
| Fixed card cadence of 10 or 15 minutes | T1 |
| Maximum of 5 or 6 steps per goal | T2 |
| Step count tied to the number of story slices | T3 |
| Start over keeps the character's night | T5 |
| Home keeps an unfinished task after 24 hours and Continue starts it | T6 |
| Success measures and north star in the PRD | N1 |
| Sign-up after the first finished step | ACC |
| Comment once on repeated pauses (A2, C7) | F1 refined |

## 3. Open

| Id | Topic |
|---|---|
| P1 | The real AI planning prompt (the "planning expert") must be added to `docs/ai/`; the text in AI_01 is a placeholder |
| S2 | The engineering result on phone features (see above) |
| A7b | Provider data retention terms |
| M5, M6 | Original test data (issues B15 and B17, "low preference" definition); may be skipped |

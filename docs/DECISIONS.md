# Decision log

This file records every product decision that overrides an older document. When this file and another document disagree, this file wins. Each decision has an id that matches the planning folder (`1_Projects/Newfeatures/PRODUCT_doc-map-and-open-decisions_2026-11-04_v1_draft.md`).

Decider: Yue (product owner). Dates are the day the decision was given.

The specification documents were brought in line with the decisions up to 2026-11-15 in issue #295, and with the decisions of 2026-11-21 in issue #369.

## 1. Decided

### Scope and platform

| Id | Date | Decision | Consequences |
|---|---|---|---|
| S1 | 2026-11-04 | Release 1 contains everything in the current wireframes: Home, companion browsing, Life Path, goal dialogue, Goals and Me, focus page with story cards, rest conversation, summary. | This is larger than the recommended vertical slice. The backlog is split into milestones so that a testable core loop comes first. |
| S3, G5 | 2026-11-04 | The text a user writes (goal names, step names, step descriptions) is stored on our server, tied to the account (Supabase). | History works across devices. A clear privacy notice and account deletion are required. |
| S2 | 2026-11-05 | **Partially resolved:** mobile web background timers are not reliable, so the clock must use timestamps. iOS/iPadOS Home Screen web apps support Web Push from 16.4 onward, but notifications still require permission, a service worker and an installed eligible web app. Vibration is optional and is not promised across phones. Physical iPhone and Android installation tests remain open. | Keep haptics and lock-screen notifications capability-gated and opt-in. Do not use a page timer for elapsed time. See [`docs/research/2026-11-05-phone-features.md`](research/2026-11-05-phone-features.md). |

### Focus page and rest conversation

| Id | Date | Decision | Consequences |
|---|---|---|---|
| F1 | 2026-11-04, refined 2026-11-05 | Pause has no limit and no timer reset. Pausing never adds a screen, a pop-up or a penalty. Every Pause opens the same conversation: the character first sends a message about the snag his own task has hit and how he feels about it (a Pause means his side of the story has stalled). The message is generated live. The prompt receives the number of the pause. From the third Pause in one step, the prompt changes: every Pause stalls his own story and he remembers the earlier setbacks, so the new stuck situation is much harder and he says he is worried that he may fail. **Changed 2026-11-12 (decision PAUSE-3): he never gives the user an instruction and never asks the user to stop pausing.** | The change lives entirely in the prompt (pause count passed in, rules for the third pause and after). No new screen. The earlier "comments once" idea and the quiet line (A2, C7) are replaced by this. **From the fourth pause on, the same strong tone continues in new words each time; nothing else happens (decided 2026-11-05).** |
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
| QUOTED-DIALOGUE | 2026-11-21 | The introduction check (M2) ignores text inside quotation marks: straight and curly, double and single where they enclose speech. A line like "My name is Oppenheimer." said to another person is dialogue, not him introducing himself. An introduction in his own voice outside quotes still fails. | Card text is not edited. An apostrophe inside a word (don't) is not a quote. Issue #365. |

### Cards, steps and time (2026-11-05)

| Id | Date | Decision | Consequences |
|---|---|---|---|
| T1 | 2026-11-05 | The character's goal mirrors the user's goal. If the user has x steps of y minutes each, the character also has x steps of y minutes each. The whole story is given to the AI with the instruction: the story is divided into x steps; according to the story's progress, split each step sensibly into n story cards. The number n is chosen by the AI for each step and is not fixed (five was only an example). A card appears every y divided by n minutes during that step. | Replaces the fixed 15-minute and 10-minute proposals and the idea of five cards. Cards belong to steps; each step has its own stack that starts again with one card. Assumption to confirm: the n cards include the card shown when the step opens. |
| T2 | 2026-11-05 | The user may choose any number of steps. There is no maximum. The goal dialogue asks, in this order: the user's task, the time available, then whether to split the task into finer steps. The assistant proposes a split and the user can adjust it. The question suits users who have a detailed task. | Replaces the maximum of 5 or 6 steps. |
| T3 | 2026-11-05 | The story is treated as a whole. The number and duration of the user's steps are matched by an AI that distributes the story across them; the content of each step may vary. Story slices do not decide how many steps there are. **Decided: the AI writes each step's cards live from the story's facts and the key turning points (given as must-use facts). Every card passes the same checks as authored cards (first person, no future facts, no clock times). The pre-written cards from the 8 slices remain as the safety net when a card fails the checks or generation is slow.** **Changed 2026-11-12 (decision NO-BACKUP): there is no safety net of pre-written cards. A card that fails the checks is generated again within the time limit.** **Changed 2026-11-14 (decisions SHARED-STORY and CARDS-PER-PART): story cards are made ahead once per story part and shared; the app spreads the parts across the user's steps.** | The key-slice rule (C2) still holds: key moments are inputs the AI must use, and the summary lists any that were merged. The content team's work shifts to the facts, the leak map, the checks and the reference examples (formerly called fallback cards). |
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
| D4 | 2026-11-05, refined the same day | All 26 stories in the story database can be played in the first demo, because the content is generated live by the AI. The Life Path shows all 26 chapters. **Chapters are played in order: chapters ahead of the current one are visible but not tappable.** | The earlier idea of "coming soon" chapters is gone; chapters are not locked because of missing content, only by order. FLOW must not make later rows tappable. ~~Authored fallback cards exist for only two stories.~~ Changed (NO-BACKUP): no stored or authored text is ever shown; the authored cards of two stories are reference examples and evaluation material only, and the cards shown are the made-ahead, published cards (SHARED-STORY, PUBLISH-FIRST). |
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
| D5 | ~~For the 24 stories without pre-written cards, a few generic fallback lines in the character's voice are shown if generation fails or is slow.~~ **Withdrawn 2026-11-12 (decision NO-BACKUP): no stored lines are ever shown to the user.** | |
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

### Sign-in and model provider (2026-11-05)

| Id | Date | Decision | Consequences |
|---|---|---|---|
| LOGIN | 2026-11-05 | Users sign in with an email address and a password. | Not magic links: a link in an email opens in the browser, not in the app installed to the Home Screen, which gives a session in one place and not the other. The sign-in issues (US-ACC-1, US-ACC-2) need a password reset by email and the rules for a valid password; whether the email address must be confirmed is decided in those issues. Supabase email sign-in is switched on. |
| LOGIN-CONFIRM | 2026-11-05 | Email confirmation is required before a newly registered account can sign in. | Sign-up tells the user to confirm the email first; sign-in remains unavailable until Supabase reports a confirmed account. |
| PROV | 2026-11-05 | DeepSeek is the first model provider to benchmark in issue #130, with Gemini as the comparison. | The benchmark needs a DeepSeek key in the local `.env` (the name is in `.env.example`); issue #130 asks for at least two providers, and Gemini (Google) is the comparison provider (decided 2026-11-05; its key goes in `.env` as `GEMINI_API_KEY`). Open, and not settled by this choice: the provider's data-retention terms (A7b) and where user text is processed. User goals, steps and chat text would be sent to DeepSeek's servers, so the privacy notice (US-ACC-4) and a legal review must cover that before real users are invited. ~~The safety classifier (A5) and the checks on generated text stay in our code, not with the provider.~~ **Changed 2026-11-22 (decision SAFETY-PROVIDER, owner decision): the safety classifier runs through the same provider, and all free text goes to it for classification; the checks on generated text stay in our code.** |

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
| C1 | 2026-11-05 | The AI workflow is already configured: the AI first generates a stuck story, then the character describes his predicament and how he feels. This is live generation. | Authored snag lines become reference examples and evaluation material only and are never shown to the user (changed 2026-11-12, decision NO-BACKUP). The content team supplies the generator's inputs (scene table, allowed props, allowed names, rules). Confirmed 2026-11-21 (PAUSE-TWO-CALLS): two calls, with the category and the prop chosen by code; one scene table per Story (SCENE-PER-STORY). |
| A3 | 2026-11-05 | The rest conversation is in the character's world and voice. He may answer questions; he does not have to refuse. | Resolved 2026-11-12 (decision ERA-ANSWER): he answers as a person of his own time would, and may guess about things he could not know. |
| A4 | 2026-11-05 | The fact that the character is AI is disclosed only in the terms and in settings. The conversation does not mention it. | Legal risk: some regions require a clear answer when a user asks directly. Check with a lawyer before release. |
| A5 | 2026-11-05, amended by A5b | Safety had three tiers (crisis, low mood, ordinary stress) in Release 1; the low-mood tier is now deferred (A5b), with a classifier and real hotlines by region. | Replaces the earlier decision to park safety. Needs legal and clinical review, a hotline list by region, English test sets, and a logging rule. |
| A6, H2 | 2026-11-05 | The line shown when the user returns after hours is generated live by the AI. | ~~A small authored fallback is still required.~~ Withdrawn 2026-11-12 (decision NO-BACKUP). |

### Decisions of 2026-11-12

Yue answered the questions raised by the three audits (AI specifications, product documents, content and character pack). Ids are descriptive on purpose.

| Id | Date | Decision | Consequences |
|---|---|---|---|
| CHAT-QUESTION-END | 2026-11-12 | In the rest conversation, his reply may end on its one question. One-way lines (step cards, stuck story, return pop-up) still end with a full stop. | The line check accepts a rest reply ending in "?" (issue #215). |
| CHAT-NO-RUN-LIST | 2026-11-12 | Rest chat replies are not checked against the per-run list of earlier one-way lines (exact repeat, same three-word opening, similarity). | They answer the user and are not one-way lines. Recorded in issue #215. |
| PAUSE-3 | 2026-11-12 | Every Pause means the character's own story is blocked, and the AI generates a new stuck story each time. From the third Pause the stuck situation is much harder, and because he remembers the earlier setbacks he says he is worried he may fail. The message is never an instruction to the user and never asks the user to stop pausing. | Replaces the wording in F1 that had him ask the user not to pause again. The pause prompt receives the pause number. |
| TIME-WORDS | 2026-11-12 | In the return pop-up the character may describe how the time felt in any words he would use ("a while", "it felt very long"). It is not limited to one phrase. | Applies to R1 and T6. Open: whether exact clock numbers are allowed; until decided they stay out. |
| ERA-ANSWER | 2026-11-12 | When the user asks something the character could not know, he answers exactly as a person of his own time would: he says what he knows, says plainly when he does not know, and may guess. | Resolves the open part of A3. A list of later-knowledge words stays as a check. Refined 2026-11-21 (CHAT-USER-WORD): a later word the user typed himself does not fail his reply. |
| NO-BACKUP | 2026-11-12 | No stored or pre-written text is ever shown to the user. Everything shown (background card, step cards, stuck story, pause message, return pop-up, closing line, goal split) is generated live for the situation, because a backup would make the product features meaningless. The first card of the next step is generated ahead of time, during the previous step. If generation takes long, the user waits up to a time limit that is set by testing. A card that fails the checks is generated again within that limit. **Changed 2026-11-14 (decision SHARED-STORY): the background card, step cards and closing line are made ahead and read before publishing; this rule now covers the live parts only.** **Changed 2026-11-21 (decision PUBLISH-FIRST): they are read after publishing, not before.** | Withdraws the safety nets in T3, D5 and A6/H2 and the fallback role in C1. Existing authored cards (the Trinity night, "finding the place", Moriarty story 1) become reference examples and evaluation material. The model gateway's stored fallback lines must be replaced by the failure behaviour below. |
| FAIL-SCREEN | 2026-11-12 | If generation still fails after retrying within the time limit (for example the network is down), the app shows one calm message in the app's own voice, for example "He is not here right now. Please try again.", with a retry button. The step clock does not start while this message is shown. No stored story text is substituted. | Wording and the time limit are decided later by testing. |
| END-TONE | 2026-11-12 | The closing line at the end of a story tells what happened to the character that day and how he feels about it. It does not count the user's pauses and does not judge the user. | Replaces the smooth-or-rough mood that depended on the number of stuck events. |
| READ-STATUS | 2026-11-12 | Every written or generated piece of content that Yue must judge (for example a character's cards) carries one of three states: written, checked by script, read by a person. Only Yue, or a person Yue names, may set "read by a person". **Changed 2026-11-21 (decision PUBLISH-FIRST): "read by a person" is not a condition for publishing; Yue reads published content on the phone and a published card can be edited.** | A script check passing never counts as "read". ~~Content that nobody has read is not treated as approved.~~ Withdrawn 2026-11-21 (PUBLISH-FIRST): published content that nobody has read is live. |
| PERIODS | 2026-11-12 | The user never sees dates or ages for a story. The Life Path groups stories into named periods, like chapters of a book (for Oppenheimer for example his youth, the Berkeley period, the Manhattan Project period). | Removes the date precision and age rules from the story-record requirements (issue #45) and the approximate-date flag. The period names are drafted later for Yue to approve. |
| CARD-LENGTH | 2026-11-12 | A story card is one to three sentences and at most 45 words. The background card is at most 70 words. | To be revisited after Yue reads real generated cards. |
| CARD-NEW | 2026-11-12 | Every card must contain something new: a card that repeats earlier information is not acceptable. | The checks and the prompts enforce it. |
| KEY-MOMENTS-DRAFT | 2026-11-12 | The machine-derived key moments stay for now, marked unconfirmed. Yue and the content owner review them later. | The confirmed flag set on all of them is reset to unconfirmed. |
| KNOWLEDGE-CHECK | 2026-11-12 | The background knowledge, names and notes in the planning story database are cross-checked first. What can be used directly is imported; for the rest Yue and the team decide the final content together. | Nothing is imported before the cross-check. |
| GOAL-TIME | 2026-11-12 | If the goal text already says how long the user will work ("study chemistry for one hour"), the goal dialogue does not ask for the time again. It shows the time it understood, and the user can change it. | Refines T2 and D1e. |
| TIME-SLIDER | 2026-11-12 | The time question is a slider from 0 to 3 hours. No fixed example times such as "one hour" are shown. If the goal text already states a time, the question is skipped (GOAL-TIME). Source: Yue's round 2 answers, `_handoff/2026-11-12-spec-audit/01_DECISIONS_FROM_YUE_2026-11-12.md`, "Time questions". | Replaces the quick replies (30 min, 1 hour, 2 hours) and the typed time box of US-GD-3. "Not sure" stays. Built in issue #32. |
| STEP-EDIT | 2026-11-12 | The user can edit steps freely: rename, change minutes without a minimum or maximum other than one minute, add, delete, and move up or down with buttons. The goal's time follows the edits (D1d). | Adds the move buttons. |
| NO-STEP-COUNT | 2026-11-12 | The character's lines never state the number of steps or how many are left. He speaks only about his own story. | |
| NO-READ-ALOUD | 2026-11-12 | The writing rules for cards that sound good when read aloud are not done now. | The story "Cards written so that they can be read aloud" (issue #108) is parked. |
| TEST-LATER | 2026-11-12 | The first user test is chosen after the live-generation demo works, so the test uses the real product. | |
| ACCOUNT-SCREENS | 2026-11-12 | The sign-in, sign-up, email confirmation, forgot-password, new-password and account-deletion screens are added to the screen list. | A documentation change only. |
| SUMMARY-RECORD | 2026-11-12 | The record on the summary screen shows only the plan length and the focus time, with no verdict. | |
| OTHER-COMPANIONS | 2026-11-12 | The other six companions of the old product are out of scope for Release 1 until each has a content plan. | Only Oppenheimer and Moriarty are being built. |
| MORIARTY-1 | 2026-11-12 | Moriarty has one overall theme, "The Invisible Empire", and every one of his stories has its own goal that serves that theme. | A character pack has one theme and one goal per story. |
| MORIARTY-2 | 2026-11-12 | The original-novel version is the base and is adapted freely. The BBC-style Moriarty of the old Python application is not used. | |
| MORIARTY-3 | 2026-11-12 | The story does not have to follow the source text, so he may say how he feels; the general voice rule that characters say their feelings directly stays for him. | |
| MORIARTY-4 | 2026-11-12 | His eighth story is included. It ends just before the fall at the waterfall and has an open ending. Because the character is adapted, new stories follow after it. | The waterfall is not the end of his path, so his knowledge cut-off and forbidden words are reworked. |
| MORIARTY-5 | 2026-11-12 | There is no "intellectual game with the user". His game is against Holmes. His relationship with the user is trust. | |
| MORIARTY-6 | 2026-11-12 | Yue first reads the 31 cards of Moriarty story 1 and marks which sound like him and which do not. These become the evaluation baseline. Stories 2 to 7 wait for that. | |

### Decisions of 2026-11-14

| Id | Date | Decision | Consequences |
|---|---|---|---|
| SESSION-PAGES-OPEN | 2026-11-14 | The signed-in session pages (`/goal`, `/focus`, `/rest`, `/end`) are no longer gated by `PROTOTYPE_ENABLED`. They exist in every environment for signed-in users. The owner monitors usage and accepts the model-call cost without a per-account cap. | Every link to them always shows. Sign-in is still required. The per-account daily cap (#256) stays in "Later". The per-browser daily limit of 20 stays on `/goal` and `/try` until #256 (a daily cap per signed-in account) is built. The sign-in-free test path `/try` stays gated exactly as before (`docs/decisions/0011`). Issue #278. |
| SHARED-STORY | 2026-11-14 | The story content is made ahead of time, once per story, and shared by all users: the background card, the step story cards and the closing line. A person reads it before it is published. **Changed 2026-11-21 (decision PUBLISH-FIRST): it is published first; Yue reads it on the phone afterwards and a published card can be edited.** Only the pause message, the rest conversation, the return pop-up and the goal split are generated live. | Reverses the live-card part of T3 and the "everything live" part of NO-BACKUP. NO-BACKUP still holds for the live parts: no stored text stands in for a failed live message, and FAIL-SCREEN applies to them. The existing `step_cards` and `closing_line` prompts become prompts for making stories ahead, not for live calls. |
| CARDS-PER-PART | 2026-11-14 | Story cards are made for each part of a story, not for each number of user steps. When the user starts a story, the app spreads the parts across however many steps the user has (example: 4 parts and 2 steps gives parts 1 and 2 in step 1, parts 3 and 4 in step 2). | Replaces "an AI distributes the story across the steps" in T3. The spreading is plain app code (`src/lib/story/start.ts`), with no model call. |
| ADMIN | 2026-11-14 | A content admin website at `/admin` in the same app lets writers and the product manager edit Companions, stories, cards, app text, prompts and checks. Every change is a draft first and goes live only when someone presses Publish; an older version can be restored. The app reads only published content. | Only signed-in accounts with the admin or writer role can open it, checked on the server. It builds on the prompts table (`docs/decisions/0015`) and the story content tables (#284). Plan and prototype: Yue's product folder, `content-admin/`. |
| APP-TEXT | 2026-11-14 | The app's own words (button labels, messages, empty states) are stored in the database under fixed keys, for example `ui.F3.fail.body`. If the database cannot answer, the app shows the text written in the code, so a screen is never blank. | New. This is interface text, not story text, so NO-BACKUP does not apply to it. |
| PROMPT-PARTS | 2026-11-14 | Every prompt is built from four parts: the shared base, the historical or fictional rules, the Companion, and the story. Each part has its own version. Every generated card and live message records the prompt version that wrote it. | Removes the remaining hard-coded Oppenheimer text from prompts and checks. |
| NAMING | 2026-11-15 | One naming scheme for the admin, the database, the documents and the issues: admin pages `ADM-nn`, pipelines `FL-n`, Companions `chr.<short>.<field>`, stories `<short>.<slug>`, cards `crd.<story>.<part>.<kind>`, app text `ui.<screen>.<slot>`, prompts `PR-<feature>.<name> v<n>`, checks `CK-<letter><nn>` (G all Companions, C one Companion, S one story, H historical only, F fictional only, R rest conversation). Screen ids (`docs/FLOW.md`) and AI feature ids (AI-1 to AI-10) are kept. Short names: `opp`, `mor`, `dra`. | Versions are `v1`, `v2` and are never reused. Card, period and prompt names are refined by NAMING-CODE (2026-11-18). |
| LEN-CARD | 2026-11-15 | CARD-LENGTH applies everywhere: a step story card is 1 to 3 sentences and at most 45 words; the background card at most 70 words; the closing line 1 to 3 sentences and at most 45 words. A card over the limit cannot be published. | The content model's 2 to 4 sentences and 60 words, and the closing line's 40 words in the prompt settings, are replaced. |
| LEN-PAUSE | 2026-11-15 | His pause message (the snag in his own work, on the rest page) is 1 or 2 sentences and at most 30 words. | From the third pause he must say both the harder snag and that he is worried (PAUSE-3); 20 words is too tight. Replaces 20 (prompt settings, AI_03) and 25 (content model). ~~Main still checks 20 words (`docs/ai/prompts/stuck_story.md`); a code gap for the next batch (PAUSE-TWO-CALLS).~~ Built in #56: 30 words, also a cap in code. |
| STORY-PARTS | 2026-11-15 | A story has 2 to 5 parts (the Companion's tasks in that story). | Moriarty's four fit. With CARDS-PER-PART, stories need not have the same number of parts. |
| NO-FALLBACK-TABLES | 2026-11-15 | The hand-written fallback cards and their tables are removed from the content model and the product requirements. | Follows NO-BACKUP and SHARED-STORY. |
| FICTION-RULES | 2026-11-15 | The rule "every quotation must be in the source" applies to historical Companions only. A fictional Companion's notebook may invent freely but must stay consistent with that Companion's world record, which is stored with the Companion. | The fictional notebook prompt is split into the fictional rules and the world record when the prompt library is built. |
| KEY-UNCONFIRMED | 2026-11-15 | The 54 machine-derived key moments are stored as unconfirmed when the content moves into the database, and wait for review. | Applies KEY-MOMENTS-DRAFT to the data, which still marks them all confirmed. |
| DATES-ADMIN-ONLY | 2026-11-15 | Exact dates stay in the notebooks for writers (ordering and fact checks) and are visible only in the admin. They are never passed to a card prompt, and the checks reject a year, date or age in a card. | Applies PERIODS to the model inputs. |
| CHAT-SPOILER-CHECK | 2026-11-15 | Every rest conversation reply passes the same spoiler check as the story cards, against the parts the user has not reached. A failing reply is generated again within the time limit. | New check on the rest reply. Refined 2026-11-21 (CHAT-USER-WORD): a later word the user typed himself does not fail the reply. |
| CLOSING-AHEAD | 2026-11-15 | The closing line is made ahead with the story's cards and read and published with them. | Follows SHARED-STORY. END-TONE still applies. Changed 2026-11-21 (PUBLISH-FIRST): it is published with the cards and read afterwards. |

### Decisions of 2026-11-17

Yue answered the 19 questions that the specs clean-up (issue #295, pull request #296) left open. Recorded in issue #298.

| Id | Date | Decision | Consequences |
|---|---|---|---|
| CARDS-SPREAD | 2026-11-17 | The cards of all parts are spread across the user's Steps in story order. No card is ever dropped, so T7's 1-to-5 limit no longer cuts cards. More cards in a Step means closer together, fewer means further apart. Every Step gets at least one new card. With more Steps than parts, a part's cards are split across neighbouring Steps. There is no special "just finished" card at the start of a Step and no special "still at it" card at 00:00. | Replaces T8's last card and T9's opening card for later Steps, and T7's card limit. |
| LEAK-BY-PART | 2026-11-17 | The spoiler check runs when cards are made and before publishing, against the parts after the card's own part. | "A key slice ends a Step" (C2) is withdrawn. |
| FAIL-PREMADE | 2026-11-17 | If pre-made cards or the closing line fail to load, the app shows the failure screen with Retry (FAIL-SCREEN). The clock does not start. | Extends FAIL-SCREEN to made-ahead content. |
| FIXED-LINES | 2026-11-17 | His goal-dialogue lines picked from written lists are authored fixed lines (APP-TEXT), not "stored text" under NO-BACKUP. | |
| HOME-LINE | 2026-11-17 | The Home card line is the last line he said in the user's most recent session, stored in that session's record. There are no separate status lines. | |
| STEP-RANGE | 2026-11-17 | A Step is 1 to 1440 minutes. | Sets the maximum that STEP-EDIT left open. |
| NO-ROUNDING | 2026-11-17 | The goal time is not rounded to 15 minutes. A new Step defaults to 15 minutes. | |
| SLIDER-RANGE | 2026-11-17 | The time slider runs from 1 minute to 3 hours. There is no 0. | Refines TIME-SLIDER. |
| TAP-SIZE | 2026-11-17 | The Move up and Move down buttons are at least 44 by 44 px. | Code follow-up, not part of the documentation change. Replaces the 44 by 35 px area of pull request #273. |
| OFFLINE-RESUME | 2026-11-17 | Going back to a Step offline shows the failure screen with Retry. | Removes the R-OFF promise "You can still go back to your Step". |
| PORTRAIT-SHEET | 2026-11-17 | Tapping his portrait on the focus page opens the "Who I am" sheet, as in prototype v4 F1-C. | Code follow-up. |
| DONE-LINE | 2026-11-20 | Each finished Step's line under "What I have done" in the "Who I am" sheet is the first sentence of the last card shown in that Step. No model call. | Gives FLOW F1-C's "one line per finished Step" a source, since CARDS-SPREAD removed the "just finished" card the prototype took it from (#72). |
| AGE-TEXT | 2026-11-17 | `{age}` in a Companion's period text is visible only in the admin and never reaches a prompt. | Applies DATES-ADMIN-ONLY. |
| LEN-RETURN | 2026-11-17 | The return pop-up is 1 or 2 sentences and at most 30 words. | Replaces 25 to 40 words (content model) and 14 words (AI spec). |
| SAFETY-PREMADE | 2026-11-21 | Pre-made content (cards, closing line) gets only the banned style words (`BANNED` in `src/lib/model-gateway/checks.ts`), the same as the admin save check, before publishing. The further AI-6 line rules for live replies (hook, form, len, name, back, praise, first_person, failure_text, you) do not apply to pre-made cards. | Changes the 2026-11-17 wording "The output safety check also runs on pre-made content before publishing". The other card checks stay (LEN-CARD, LEAK-BY-PART). Issues #55 and #378. |
| CHAT-QUESTION-END (confirmed) | 2026-11-17 | A rest reply may end with a question. This replaces "never a question before Back". | Confirms CHAT-QUESTION-END of 2026-11-12. |
| US-CON-5 | 2026-11-17 | The user story US-CON-5 is settled by CARD-NEW. | The unrecorded "blocked by C3" is removed. |
| US-FMT-7 | 2026-11-17 | The user story US-FMT-7 stays parked and unchanged. | |

### Decisions of 2026-11-18

Yue approved these five recommendations on 2026-11-17 and 2026-11-18. They answer the points that pull request #299 left open. Recorded in issue #305.

| Id | Date | Decision | Consequences |
|---|---|---|---|
| CARD-TIMING | 2026-11-18 | Cards arrive evenly through the Step's time, as before. The last card of a Step arrives at the end of the Step; it is not a special card. The first card of the next Step is simply the story's next card, at the start of that Step. | Settles the timing that CARDS-SPREAD left open. |
| NO-MERGED-MOMENTS | 2026-11-18 | The summary no longer lists "merged key moments". This covers the summary (END) and the record of a finished Story (`/me/history/<session>/chapter`, US-MAP-10); neither lists key moments. | Withdraws US-MAP-9 AC4, C2's summary list and the key moments on the record (US-MAP-10). |
| LEAK-BY-PART-ONLY | 2026-11-18 | FR-STORY-9 ("a card is limited to what he knew where the Step starts") is replaced by the spoiler check against the parts after the card's own part (LEAK-BY-PART), because parts can be split across Steps. | |
| REST-OFFLINE | 2026-11-18 | The rest page offline also shows the failure screen with Retry. | Removes the "no retry" line of R-OFF. |
| CLOSING-FAIL | 2026-11-18 | If the closing line cannot be loaded, the summary shows the failure screen with Retry. | The summary has no clock, so FAIL-PREMADE's "the clock does not start" does not apply there. |

### The content admin's look (2026-11-18)

Yue decided these on 2026-11-18. Recorded in issue #313.

| Id | Date | Decision | Consequences |
|---|---|---|---|
| ADMIN-DESKTOP | 2026-11-18 | The content admin (`/admin`) is a desktop web tool for company staff, not a phone screen. At desktop widths it looks like the admin prototype (`content-admin/admin-prototype_2026-11-14_v1.html`): its colours light and dark, its type sizes and font lists (as written, none loaded), spacing, buttons, menu rows, tables inside panels, state pills, id chips and breadcrumbs. Its minimum width is 1024 px. It has no phone-width layout, and the phone app's rules (the 44 by 44 px tap size, `DESIGN.md` tokens and controls) do not apply to it. | Reverses the #287 design spec's look choice ("`DESIGN.md` tokens only, no prototype teal, no IBM Plex or Fraunces") for the admin only. The phone app keeps the app's own design (`DESIGN.md`). The admin's values are the `--adm-*` tokens in `src/app/tokens.css`. |
| NAMING-CODE | 2026-11-18 | NAMING is refined to match the code. Period names are numbered: `chr.<short>.period.<n>` (for example `chr.opp.period.2`). Cards are numbered within their part: `crd.<short>.<story>.p<n>.c<n>`, and the background card is `crd.<short>.<story>.bg`; a card's kind is not part of its key. Prompts are named by their table key (`plan_split`, `step_cards`, `stuck_story`, `rest_reply`, `return_popup`, `closing_line`, `retry_hints`) with versions `v1`, `v2`, never reused. | Replaces NAMING's `crd.<story>.<part>.<kind>` and `PR-<feature>.<name> v<n>`, which no code uses. No code changes. |

### Decisions of 2026-11-21

Yue answered the ten questions in `docs/sprints/decisions-needed_2026-11-21.md`. Recorded in issue #369. Decision 7 (the planning prompt) added no new id: P1 stays open.

| Id | Date | Decision | Consequences |
|---|---|---|---|
| STORY-LINES-LATER | 2026-11-21 | The three stored lines of a Story (the present-tense line for the current card, the past-tense memory line and the carry line) are not fixed. Yue will add a framework with the character's inner thoughts later. | Nothing is built for these lines now. Issue #45 waits for that framework and is not closed. Today (main) Life Path rows show the Story's goal sentence and the carry line is written with the closing line; this is a fact about main, not a requirement (FR-MAP-4, FR-MAP-5, FR-END-1, US-CON-1). |
| PUBLISH-FIRST | 2026-11-21 | There is no human review gate. Made-ahead content (the background card, the step story cards, the closing line and the scene table) is published first. Yue reads it on the phone afterwards, and a published card can be edited and published again. | Changes SHARED-STORY, READ-STATUS and CLOSING-AHEAD: "read by a person" is not a condition for publishing, and published content that nobody has read is live. The automatic card checks stay: a card that fails them or is over its length limit cannot be published (LEN-CARD, LEAK-BY-PART, SAFETY-PREMADE). Issues #46, #48 and #84. |
| SCENE-PER-STORY | 2026-11-21 | Each Story has one scene table, as drafted (`scene` in `docs/demo/<story>.stage0.json`: people present, allowed names, props, one pause prop, later words). There are no weather or light scales. Reading it is not a gate (PUBLISH-FIRST). | Replaces the scene per entry state and the one-way scales of rain, wind and sky (C5 proposal, FR-CONTENT-6, US-CON-4). The table is an input to the pause message and to the checks (C1). Issues #64 and #65. |
| PAUSE-TWO-CALLS | 2026-11-21 | The pause message is made with two calls, as in C1 and FR-REST-2: first the stuck story, then his description of the predicament and his feelings. Code chooses the snag category and the prop, as in `docs/ai/AI_03` section A1. The message he shows is 1 or 2 sentences and at most 30 words (LEN-PAUSE). | Confirms C1 and FR-REST-2. ~~Code gap for the next batch: main makes one call (`stuck_story`) with a 20-word limit, no category and no prop, and there is no prompt for the second call (`docs/ai/AI_09`, "Next batch").~~ Built in #56: `stuck_story` version 3 and `pause_predicament` version 1; the code picks the category and the prop. |
| CHAT-NO-LABEL | 2026-11-21 | A rest reply carries no label for the user's message (his world, the user's work, knowledge, him, feelings, unclear). The feelings rule (one line of his own, no advice) and "end on his own situation" are written into the rest reply prompt. | Withdraws the scope label, the `scope` field in the answer and the checks tied to it (`docs/ai/AI_04` sections A2 to A4, AI_09 T11, US-AI-6). The advice and one-question checks keep running on every reply. Issue #59. |
| CHAT-USER-WORD | 2026-11-21 | In the rest conversation he may repeat a later word that the user typed himself. Example: "I have never heard of a computer" passes when the user wrote "computer". | Refines the later-knowledge words check (ERA-ANSWER) and the spoiler check on replies (CHAT-SPOILER-CHECK): a later word fails a reply only when the user did not type it. Issues #59 and #60. |
| GOAL-SHAPE-LOCAL | 2026-11-21 | Version 1 decides the Goal's shape (specific, vague, big or unknown) with the local rule `classifyGoalShape` (`src/lib/prototype/goal-lines.ts`), with no model call. A model call may be added later. | Changes FR-START-5, FR-AI-3, FR-AI-5 and FR-AI-9: the goal text goes to the model only for the split (and to the safety classifier). The problem points in the current prompts are to be marked for a later full rewrite (`docs/ai/AI_01`, `AI_01a`). Issue #40. |
| NO-DENYLIST | 2026-11-21 | There is no word list of dangerous method or instruction words. The output guard is the shared checks (the AI-6 rules and the banned words in `src/lib/model-gateway/checks.ts`); the style checks stay. | Withdraws "an output guard with a denylist owned by compliance" (FR-SAFETY-12, `docs/ai/AI_05` section 3, US-SAF-9). SAFETY-PREMADE still holds, as changed on 2026-11-21: pre-made content gets only the banned style words before publishing, not the other AI-6 line rules. Issue #55. |
| END-LINE-PENDING | 2026-11-21 | His line after the final Story must exist; its prompt is designed later. Finishing all Stories also unlocks a long-term chat with that Companion. Both are pending. | Listed with the Later items (section 4; PRD 10.5). FR-MAP-11 and FR-END-6 wait for that prompt. Whether a new session after the end replays the last Story is not decided. Issue #52. |

### Safety classifier (2026-11-22)

Yue decided the blocking gaps of issue #117 (US-SAF-4) on 2026-11-22; the other answers follow the engineering recommendations accepted the same day.

| Id | Date | Decision | Consequences |
|---|---|---|---|
| SAFETY-PROVIDER | 2026-11-22 | The safety classifier runs through the same AI provider as the other live calls, through the gateway's provider settings. Optional separate settings (`SAFETY_MODEL_API_KEY`, `SAFETY_MODEL_API_URL`, `SAFETY_MODEL_NAME`) can point it at another model. All free text goes to the provider for classification. | Changes PROV ("the classifier stays in our code") and FR-SAFETY-3 ("never sends it to a model"): crisis text is never sent to the reply model; a message the keyword layer flags is sent to no model at all, the classifier included. Privacy notice and A7b cover the classifier too. Issue #117. |
| SAFETY-CHECK-FIRST | 2026-11-22 | The classifier runs before the reply call, the split or any save, not in parallel with them. It has one attempt and 1.5 seconds, the prompt read included. | Adds at most 1.5 s to a free-text submission. Replaces "in parallel with the AI-1 or AI-4 call" in `docs/ai/AI_05_safety.md` section 4. |
| SAFETY-TIERS-2 | 2026-11-22 | The classifier answers `crisis`, `stress` (everyday pressure) or `none`, or `unsure`, which counts as crisis (an ambiguous message is treated as a crisis). An answer that is not exactly one of these is a classifier failure. The keyword layer's low-mood match counts as stress (A5b). The higher tier wins. English only; no language field (L1). | The prompt is `safety_classifier` in `public.prompts` (`docs/ai/prompts/safety_classifier.md`). |
| SAFETY-CONTEXT | 2026-11-22 | The classifier sees the message and at most the two earlier messages of the same field: in the rest chat the person's earlier messages (never his); in the goal dialogue and single-value fields none. Nothing is stored for this. | Earlier messages the keyword layer flagged are left out. |
| SAFETY-ALARM | 2026-11-22 | When the classifier fails or takes longer than 1.5 seconds, the keyword layer decides alone, the server logs an error line, and a webhook is posted to the server-only setting `SAFETY_ALARM_WEBHOOK_URL` at most once a day (UTC), on the day's first failure, with its time and reason; later failures that day are in the server log and the day counter, not in the webhook (fix round 1, I2: a post on the first failure cannot carry the day's total; whether the owner also wants a daily digest is an open question). The webhook never carries user text. Without the setting the server only logs. | A day counter shared by all server instances (`private.safety_alarm_days`). Issue #117. |
| SAFETY-FIELDS | 2026-11-22 | The classifier runs on every free-text field with a server-side check: the rest chat (both pages), the goal dialogue's goal line, the split, Start (the goal, the title and the Plan as one text) and the Goal rename. The browser keeps its keyword-only check; the Goals search box stays on the device. | The cost of one extra call per submission is accepted (SESSION-PAGES-OPEN); it does not count toward the `/try` daily limit. |

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
| The character asks the user not to pause again (third pause) | PAUSE-3 |
| Stored or pre-written text shown when generation fails or is slow (T3 safety net, D5, A6 and H2 fallback) | NO-BACKUP and FAIL-SCREEN |
| Closing line mood that depends on the number of stuck events | END-TONE |
| Dates, ages and approximate-date flags shown for a story | PERIODS |
| A Pause or return line limited to exact fixed phrases | TIME-WORDS |
| Story cards written live for each user (the "decided" part of T3) | SHARED-STORY |
| An AI distributes the story across the user's steps (T3) | CARDS-PER-PART |
| The first card of the next step is generated during the previous step (NO-BACKUP) | SHARED-STORY |
| A later Step opens with a card about what he just finished (T9); the last card of a Step says he is still at it at 00:00 (T8); 1 to 5 cards per Step, extra cards ignored (T7) | CARDS-SPREAD |
| A key slice ends a Step (C2) | LEAK-BY-PART |
| "No connection. You can still go back to your Step." (R-OFF) | OFFLINE-RESUME |
| The summary lists the merged key moments, one first-person line each (C2, US-MAP-9 AC4) | NO-MERGED-MOMENTS |
| During a Step all cards presuppose only what he could know where the Step starts (FR-STORY-9) | LEAK-BY-PART-ONLY |
| No retry on the rest page without network (R-OFF) | REST-OFFLINE |
| "The clock does not start" when the closing line fails to load (FAIL-PREMADE, on the summary) | CLOSING-FAIL |
| His last message before Back is never a question | CHAT-QUESTION-END |
| A person reads made-ahead content before it is published, and content that nobody has read is not treated as approved (SHARED-STORY, READ-STATUS, CLOSING-AHEAD) | PUBLISH-FIRST |
| The three stored lines of a Story (present-tense line, past-tense memory line, carry line) as fixed fields loaded from the draft path-lines file (US-CON-1) | STORY-LINES-LATER |
| A scene per entry state with one-way scales of rain, wind and sky, or of weather and light (C5 proposal, FR-CONTENT-6, US-CON-4) | SCENE-PER-STORY |
| A label for the user's message (scope) returned with each rest reply, and the checks tied to it (AI_04 sections A2 to A4) | CHAT-NO-LABEL |
| A later word fails a rest reply even when the user typed it | CHAT-USER-WORD |
| A small model call classifies the Goal's shape (FR-START-5, AI_01 call 1a) | GOAL-SHAPE-LOCAL |
| An output guard with a denylist of method and instruction words owned by compliance (FR-SAFETY-12, AI_05 section 3) | NO-DENYLIST |

## 3. Open

| Id | Topic |
|---|---|
| P1 | The real AI planning prompt (the "planning expert") must be added to `docs/ai/`; the text in AI_01 is a placeholder. Still open on 2026-11-21: Yue will supply the prompt file; engineering does not draft one (#40) |
| S2 | The engineering result on phone features (see above) |
| A7b | Provider data retention terms |
| M5, M6 | Original test data (issues B15 and B17, "low preference" definition); may be skipped |
| TIME-LIMIT | The length of the waiting time limit for live generation and the wording of the failure message (FAIL-SCREEN); set by testing |
| CLOCK-NUMBERS | Whether the return pop-up may use exact clock numbers (TIME-WORDS) |
| KEY-REVIEW | The review of the machine-derived key moments (KEY-MOMENTS-DRAFT) |
| PERIOD-NAMES | The named periods of each character's Life Path (PERIODS), drafted for Yue to approve |
| MORIARTY-READ | Yue's reading of the 31 cards of Moriarty story 1 (MORIARTY-6) |

## 4. Later

- Chat rules for rest chat, a limit after round 10, and free chat: see #337 (waits until version 1 is done).
- Adding a Companion from a novel through staged, reusable prompts, then in batch: see #339 (waits until version 1 is done).
- Pending: his one line after the final Story. It must exist; its prompt is designed later (END-LINE-PENDING, #52).
- Pending: a long-term chat with a Companion, unlocked when the user has finished all of that Companion's Stories (END-LINE-PENDING).

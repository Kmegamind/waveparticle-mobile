# WaveParticle Mobile: Product Requirements Document

Version 0.1 (draft). Date: 2026-11-05. Owner: Yue (product and content). Decisions are recorded up to 2026-11-05.

This document describes release 1 of WaveParticle, a mobile-first web app. It replaces the older master document. Where an older source disagrees with a decision that Yue has made, the decision wins. Where two sources disagree and no decision exists, the question is listed in section 10 and nothing is invented to fill the gap.

How to read the identifiers in this document:
- Decision ids such as S1, F1, A5, M1, C2, X2 come from the decision log (`docs/DECISIONS.md`, which wins over this document; section 10.2 lists its open items). A suffix "(proposal)" means the requirement follows a recommendation in the planning notes that Yue has not confirmed.
- Requirement ids such as FR-GOAL-1 are stable. Priorities are Must (release 1 does not ship without it), Should (expected in release 1, cut only if time forces it), and Could (first to cut).
- NF1 to NF7 are the numbered feature notes in the planning folder: NF1 Goals and Me, NF2 Story map, NF3 Story database, NF4 Home and life state, NF5 Story format, NF6 Focus and rest, NF7 Goal start.

---

## 1. Product summary

### 1.1 What the product is

WaveParticle is a companion for people who struggle to begin and finish work that matters to them. The user picks a Companion (the first is J. Robert Oppenheimer), states a Goal, and splits it into Steps. While the user works on a Step, the Companion lives a parallel, climactic episode of his own life. The two lines run side by side. The Companion's story moves forward only when the user really finishes a Step. This link is called the fate link. The Companion's own goal mirrors the user's: if the user has x Steps of y minutes each, he has x steps of y minutes each.

It is not a focus timer and not another chat app. The Companion is closer to a reluctant desk neighbour than to a supervisor, tutor or coach.

### 1.2 Target users

Primary users have one thing they care about, nobody is watching them do it, and they repeatedly fail to start for emotional reasons such as avoidance, anxiety or distraction. Typical examples are university students and early-career workers handling job applications, a thesis, exam preparation or a portfolio. The qualifying signal from the interviews was a real consequence for not doing the work and several planned-but-unstarted attempts in the past month.

Two candidate beachhead groups exist and are not yet distinguished by evidence (hypotheses): people who already feel attached to fictional characters, and people who had human company for working that later stopped.

Not served: people whose procrastination is structural (they need scheduling, not company), people looking for romance or adult content, and minors. Minors are not marketed to until an age-verification approach is chosen.

### 1.3 Problem

Three findings from ten founder interviews (one school, mostly students, so direction only):
1. Failing to start is mostly an emotional problem, not a planning problem.
2. Another person's presence helps people start, but that arrangement is fragile and ends when the other person leaves.
3. Existing tools do not help with this step. AI assistants split lists or do the work for the user. Companion apps comfort but do not hold anyone to anything.

The founder also experienced the effect in three "gold standard" moments with characters from the founder's own language and culture. Whether the same effect appears in English and with Oppenheimer is unproven and is the main product risk (section 10.4).

### 1.4 Glossary

| Term | Meaning |
|---|---|
| Companion | The character who accompanies the user. Release 1 has one playable Companion, Oppenheimer. |
| Goal | Something the user wants to finish or keep doing. It has a title, a Companion, a type (One-time or Ongoing) and a status (In progress, On hold, Done). |
| Step | One part of a Goal with a short title, a description of one or two sentences, and a target number of minutes. The user works on one Step at a time. There is no maximum number of Steps. |
| Run | One attempt at a Goal: its Steps, current Step, clock position and the story it is bound to. A Goal has at most one open Run. |
| Story | One episode of the Companion's life (for Oppenheimer, one chapter such as a night, a lunch or a hearing). |
| Slice | A short unit of a story, built from one to three historical facts. Slices supply the facts the AI writes cards from and the authored fallback cards. |
| Card | One short first-person text from the Companion shown on the focus page. A Step has between one and five story cards; one extra background card opens the Goal. |
| Fate link | The rule that the story advances only when the user finishes a Step. |
| N | The number of Steps in the user's plan. |

---

## 2. Pillars and principles

### 2.1 The four pillars

These come from the Core Experience Constitution. Any change that breaks a pillar is rejected, whatever users say. Research checks whether the effect appears; it does not vote on whether the pillars exist.

| Pillar | Meaning | Signal that it is working |
|---|---|---|
| Being seen through | The Companion names the user's real avoidance or feeling, with edges, and does not give up on them. | The user reacts with "it seems to know me", not with a polite thank-you. |
| Parallel climactic story | He does his own thing inside the most tense moment of his life. The user does their own work. Each line mirrors the other. He never arranges the user's work or writes the user into his story. | The user asks how he is doing and plays along. |
| Being pulled to the next step | Finishing creates a hook: the next step matters more. | The user starts the next Step excited, not reminded. |
| A reluctant companion | He has a temper and agrees reluctantly to keep the user company. He does not flatter or lecture. | The user describes him as a desk neighbour, not a supervisor or parent. |

### 2.2 Constraints that hold everywhere

1. No streaks, no shame, no "you missed". Coming back is always allowed. Nothing he says blames the user or measures the time away; the return pop-up speaks only of his own situation.
2. He is self-driven. The user's finishing a Step decides only when his next beat happens, never why he acts.
3. He never knows the future. He knows only what he could know at that moment of his life.
4. He does not instruct, advise, praise or coach, and he is never in the user's room.
5. The product never does the user's work and never gives the answer.
6. One main action per screen.
7. Records show what the user did. They do not show scores, totals that can fall, targets, comparisons or gaps.
8. His arc accumulates. A single Step never flips his character.

### 2.3 What may change

The entry flow, which Companion is offered, how fresh and tense a story is, the interface, how fine Steps are, and the form of reminders may all change with data. The pillars may not.

---

## 3. Release 1 scope

### 3.1 Decision

Yue decided (S1, 2026-11-04) that release 1 contains everything in the current wireframes. The prototype `wp-prototype_2026-10-29_v1.html` (published version 7) is the working specification for screens, except where the decision log changes a screen (section 10.4). The backlog will be split into milestones so that a testable loop (start a Goal, work a Step with story cards, pause, finish) comes first inside the larger scope.

### 3.2 In release 1

| Area | Contents |
|---|---|
| Home | First visit, in-progress state, state after finishing, Goal options menu, start-over confirmation |
| Companion browsing | The Companions list (eight characters) and the Oppenheimer Life Path page with current story card |
| Goal dialogue | The conversation that turns a Goal into Steps: the Goal, the time, whether to split finer, an editable plan, failure state, one-step plan |
| Focus page | Story cards on his side, the user's side, Done and Pause, single-step variant, timer at zero, signals |
| Rest conversation | The page opened by Pause: his message about the snag in his own story, free conversation, offline state, Back with the return pop-up |
| Summary | The end screen with his closing line, what he is carrying and the user's finished Steps |
| Goals and Me | Goals (In progress, On hold, Done, History), Goal detail, New goal, and Me (appearance, signals, about, data, history calendar, session record) |
| Safety | Two-tier safety page and responses (crisis and everyday stress) |
| Accounts | Sign-up or sign-in when the product is first opened, privacy notice, account deletion |

### 3.3 Explicitly out of release 1

| Out | Source |
|---|---|
| A user-facing switch to turn the story off. An internal research flag exists. A "Quiet" mode is decided after a test. | M4 |
| Level-2 notifications (one opt-in nudge in his voice when the user leaves mid-Step). Level 3 (blocking other apps) is never built. | F4 |
| The low-mood safety tier. The first demo has the crisis tier and everyday stress only. | A5b |
| The listen button (hear a card read aloud) and automatic reading of new cards. | X5 |
| Full content for the other seven characters. They may appear in the Companions list, but only Oppenheimer has playable content. | Brief |
| A language setting, or any interface language other than English. | L1 |
| Reminders and start times, and the Repeat option on Ongoing Goals. The Reminders row in Me stays hidden. | Master PRD, GOALS_02 |
| Choosing, swapping or skipping stories, and side stories. Stories are played in path order, and all 26 are playable. | STORYMAP_02, D4 |
| Due dates, priorities, labels, projects, streaks, scores, rankings, progress bars, percentages, "N of M". | GOALS_02, constitution |
| Tutoring, stranger matching, scoring completions, a user-built character. | Master PRD |
| Long-term memory about the user and a memory board. Not in the wireframes. | Master PRD |
| Payments, subscriptions and an admin back office. | Master PRD |

---

## 4. Functional requirements

### 4.1 Goal start (FR-START)

| ID | Requirement | Priority | Decision |
|---|---|---|---|
| FR-START-1 | Entering from Companions, the Life Path, New goal or a Goal detail opens the goal dialogue, in which he speaks first from inside his own situation and asks exactly one question. The Goal is typed as free text; there is no restriction on what a Goal can be and no list of unsupported kinds. | Must | D1a |
| FR-START-2 | The dialogue input looks like a chat composer, not a form. | Should | |
| FR-START-3 | The dialogue asks in this order: the Goal, the time available, then whether to split the Goal into finer Steps. There is no feeling question. The assistant proposes a split and the user can adjust it. | Must | T2, D1e |
| FR-START-4 | A shortcut called "Just split it" skips the conversation and uses 30 minutes when no time was given. The prototype uses 60 minutes, which is wrong. | Must | NF7 v6 spec |
| FR-START-5 | One small classification call labels the Goal as specific, big, vague or unknown and decides which authored reaction line he says. A vague Goal gets no follow-up question; the planning prompt turns it into concrete first steps (D1f). | Must | |
| FR-START-6 | The time question offers quick replies (30 minutes, 1 hour, 2 hours, Not sure) and accepts typed text; Not sure means 30 minutes. | Should | |
| FR-START-7 | A split call, driven by the AI planning prompt (P1), turns the Goal and time into Steps, each with a short title, a description and minutes; the minutes sum to the time the user gave, and code validates every result. How a plan is split for different kinds of Goals is the job of that prompt, not of this document. | Must | D1b, D1d |
| FR-START-8 | When the split fails twice, a system-voice failure screen keeps the user's text and offers "Try again" and a one-step plan. The app never shows a silent generic list of Steps. | Must | |
| FR-START-9 | A one-step plan is allowed, and focus screens then drop "Step 1 of 1" and any step list. | Must | |
| FR-START-10 | The plan card is fully editable before the user starts: the title, description and minutes of each Step, and the number of Steps (add or remove; remove is hidden when only one remains). If the edits change the total, the Goal's time follows the edits. Start stays visible. | Must | D1d |
| FR-START-11 | Editing rules: adding inserts after the Step being edited, there is no maximum number of Steps, minutes are whole positive numbers, and empty titles are removed or reverted, also checked on the server. | Should | T2, D1d |
| FR-START-12 | Move up and Move down buttons (not dragging) let the user reorder Steps. | Could | NF7-P5 (proposal) |
| FR-START-13 | Each Step has a short title and a description of one or two sentences that expands the title (what to do and what to watch for). The description is generated with the plan, is editable on the plan card, is shown read-only under the Step name on the focus page, and is shown as nothing when missing. | Must | D1c, X4 |
| FR-START-15 | When the Goal text states a session length, the app reads it, skips the time question, and removes the phrase from the title; durations that describe the thing ("a 2-hour lecture") do not count. | Should | NF7-P3 (proposal) |
| FR-START-17 | N is fixed when the user presses Start. Anything that depends on N, including his own x Steps of y minutes and the card count for each Step, is computed then, and his dialogue lines never state the number of Steps. | Must | T1; NF7-P7 (proposal) |
| FR-START-18 | There is no maximum number of Steps and no story capacity. Key moments are must-use inputs to the AI. When there are fewer Steps than key slices, key moments are merged by the key-slice rule (FR-STORY-8). | Must | T2, T3, C2 |
| FR-START-19 | The Goal and its Run are created when the user presses Start on the plan, and the Type (One-time or Ongoing) is not asked then; it is a chip in the Goal detail. | Must | FLOW D-5 |

### 4.2 Goals page (FR-GOAL)

| ID | Requirement | Priority | Decision |
|---|---|---|---|
| FR-GOAL-1 | The Goals page has four tabs: In progress, On hold, Done and History. | Must | S1 |
| FR-GOAL-2 | In progress groups Goals under Ongoing and One-time, ordered by most recent use, shows the first five and a "Show more" control without a number, and never reorders by itself. | Must | S1 |
| FR-GOAL-3 | Each row shows the Companion's portrait, the title, one subline that states only what the user did (for example "2 done today") and a Continue or Start button. | Must | |
| FR-GOAL-4 | Continue opens the Goal's open Run at the same Step with the clock where it stopped, subject to the return pop-up rules in FR-FOCUS-11; Home and Goals point to the same Run; Start opens the goal dialogue prefilled. | Must | |
| FR-GOAL-5 | New goal is a sheet with one question and one arrow, with no Type, no Companion picker, no Repeat and no date; nothing is saved until the first Start. | Must | |
| FR-GOAL-6 | A Goal has at most one open Run, and several Goals can be in progress at once. | Must | |
| FR-GOAL-7 | Status changes (In progress, On hold, Done) use a swipe or the row menu and the detail footer, apply instantly, and show an Undo toast; no confirmation dialogs. | Must | |
| FR-GOAL-8 | Put on hold keeps the open Run exactly in place. Mark done closes it with no record of unfinished Steps and does not unlock the next story. | Must | |
| FR-GOAL-9 | Goal detail shows the title, status, Companion (read-only), the Type chip, the Steps (read-only, with descriptions) and a primary Continue, Start or Resume button. | Must | |
| FR-GOAL-10 | Reopening a Done Goal moves it back to In progress. | Should | |
| FR-GOAL-11 | The Goals page shows no overdue, behind, missed, abandoned or idle wording, no zero counts, no badges on the On hold and Done tabs, and no last-active dates; nothing is red. | Must | Constitution |
| FR-GOAL-12 | A One-time Goal moves to Done automatically when its last Step is finished; an Ongoing Goal stays In progress with a Start button. | Should | G4 |
| FR-GOAL-13 | Searching Goal titles and history. It is not in the current wireframes. | Could | |
| FR-GOAL-14 | Permanent deletion of a Goal is not in the main interface; it lives in Me under Your data. | Must | |

### 4.3 Life Path and Companions (FR-MAP)

| ID | Requirement | Priority | Decision |
|---|---|---|---|
| FR-MAP-1 | The Companions page lists the eight characters with one line each in their own voice; the interface stays neutral and the portraits carry colour. | Must | S1 |
| FR-MAP-2 | The Oppenheimer page shows his stories in date order with an age ruler, each row showing an age, and opens on the current story card. | Must | S1 |
| FR-MAP-3 | A new user starts at chapter 1 of Oppenheimer's path. There is no designated entry story. | Must | M1 |
| FR-MAP-4 | Rows the user finished are filled dots with one past-tense line from him and open a history record; rows before the user's starting point are "his memory" (open ring, italic, not tappable). | Must | |
| FR-MAP-5 | Exactly one story is current. It shows his present-tense text and one button, Begin. | Must | |
| FR-MAP-6 | Rows ahead are shown with an age and a neutral title, never his words. All 26 stories are playable and appear on the path. Rows ahead are not tappable or focusable, use no lock icon, and fade by size and weight while keeping text contrast of at least 5:1. A screen reader says "Later". | Must | D4 |
| FR-MAP-7 | A story counts as played when the first Run bound to it finishes its last Step, and finishing opens the next story. Leaving a story records nothing and shows nothing. | Must | FLOW D-7 |
| FR-MAP-8 | The map shows no counts, progress, percentages, countdowns, "locked" labels or source labels. | Must | |
| FR-MAP-9 | The map and the current card carry no scene or Step markers. Key moments appear only in the Life Path history record and, when Steps were merged, on the summary. | Must | M3 |
| FR-MAP-10 | The background card, told in his own voice, introduces the people who are present, so there is no separate "what you need to know" screen. Later cards carry no introduction phrases and names are not tappable. | Must | M2 |
| FR-MAP-11 | After the last story the path ends with one line from him and no further rows. | Should | |
| FR-MAP-12 | An internal research flag can switch a participant's story off. It is not visible to users. | Should | M4 |
| FR-MAP-13 | Story progress is stored per user and Companion, survives deployments, and several Runs may be bound to one story; a later finisher gets a summary without a Next button. | Must | FLOW D-7 |
| FR-MAP-14 | Tapping a Companion that has no content shows a calm "not available yet" state. The behaviour is not specified in any source. | Could | Proposal |

### 4.4 Story content and data (FR-CONTENT)

| ID | Requirement | Priority | Decision |
|---|---|---|---|
| FR-CONTENT-1 | The story library is the single source of truth. Each story has a sequence number, date and date precision, title, slices, key slices, his lines and people. | Must | |
| FR-CONTENT-2 | Each slice has one to three first-person past-tense facts. For the authored fallback cards, a slice also has a landing line and an entry state holding the pools that may be used while the slice is the first one in the user's current Step. | Must | |
| FR-CONTENT-3 | Content for chapter 1 ("The Trade of a Theorist") must be written. Existing content covers chapter 8 (the site search) and the Trinity night only. | Must | M1 |
| FR-CONTENT-4 | Each story has 2 to 4 key slices, each with a first-person past-tense key line of at most 18 words, confirmed by the content owner, and an optional bridge of at most 10 words. | Must | C2 |
| FR-CONTENT-5 | Each story lists its people and what each one knows, as input for the background card. Later cards carry no introduction phrases. | Should | M2 |
| FR-CONTENT-6 | Each story supplies a scene table (where, who is present, props, scale of rain, wind and sky) and each card carries a state tag, so cards and the opening situation cannot contradict each other. | Should | C5 (proposal) |
| FR-CONTENT-7 | Each story supplies the inputs the live generators need (scene table, allowed props, allowed names, rules) and a small authored fallback set of snag lines. | Must | C1 |
| FR-CONTENT-8 | Each entry card contains at least one new, true, non-event element: a background fact from the story's knowledge field, a one-way change of scale, or a shift of worry. | Should | C3 (proposal) |
| FR-CONTENT-10 | Every card, written live or authored, passes the same checks: no question, no "you", no clock time or duration, no later knowledge, no repeats in a step, each card readable alone. Authored cards are checked before shipping, live cards at runtime, and a card that fails is replaced by a fallback card. | Must | T3 |
| FR-CONTENT-11 | Cards, live or authored, are never drawn from after the user's current position and never carry a fact from the Step's own story slices or later ones. | Must | |
| FR-CONTENT-12 | Historical source labels (in the book, inferred, invented) are kept in the backend and are not shown on any screen. | Must | |
| FR-CONTENT-13 | Every story that ships has `reviewed` marked, and unreviewed generated plans are flagged in logs for sampling. | Should | |
| FR-CONTENT-14 | All 26 stories carry the inputs the live generator needs. Authored fallback cards exist for two stories; for the other 24, a few generic fallback lines in his voice are shown if generation fails or is slow. | Must | D4, D5 |

### 4.5 Home (FR-HOME)

| ID | Requirement | Priority | Decision |
|---|---|---|---|
| FR-HOME-1 | Home reads only the signed-in account. No fixture or sample data exists in any build a tester can reach, and empty sections are hidden, not filled with placeholders. | Must | |
| FR-HOME-2 | On a first visit Home shows one card with "Choose a companion" and no sample data. | Must | H6 |
| FR-HOME-3 | With a Run in progress, Home shows one card with his latest line, one Continue button, a "Start something else" text link, and a menu with Put on hold and Mark done. | Must | |
| FR-HOME-4 | However long the user has been away, Home keeps the Run in progress and shows the same card with Continue. There is no time limit on resuming and no time-based line or card on Home. | Must | T6 |
| FR-HOME-5 | The return pop-up (FR-FOCUS-11) is shown on the focus page, at most once per return, and never on Home. | Must | R1 |
| FR-HOME-6 | The return pop-up text is generated live by the language model, has an authored fallback, and passes the never-say list in section 5. | Must | R1, A6 |
| FR-HOME-7 | After the user finishes a Goal with nothing in progress, Home keeps a small trace of him: his portrait, his own closing line and one New session action. The finished Goal appears in Quick Replay (a list of recent Goals) automatically. It never resets to the first-visit card. | Should | H5 |
| FR-HOME-8 | After a long absence with nothing in progress Home shows the same state as after finishing, with no "welcome back". | Should | H7 |
| FR-HOME-9 | Start over restarts the Goal from Step 1 after a calm confirmation, and restarts his night, because his night has failed. | Should | T5 |
| FR-HOME-10 | Home shows no streaks, totals, percentages, progress bars, "away for" text or missed-item counts. | Must | Constitution |

### 4.6 Story presentation: cards and fate link (FR-STORY)

| ID | Requirement | Priority | Decision |
|---|---|---|---|
| FR-STORY-1 | Finishing a Step is the only event that moves the story. Nothing the user does inside a Step, including pausing, adds a story fact. | Must | Fate link |
| FR-STORY-2 | A Step opens with exactly one card: the background card for the first Step, and the card about what he just finished for every later Step. The n story cards of the Step, with n between 1 and 5 chosen by the AI for each Step, then arrive one at a time while the user works. The prototype that shows four cards at the start is wrong. | Must | X2, T1, T7, T9 |
| FR-STORY-3 | Steps after the first open with the card about what he just finished and his next concern; Step 1 opens with the background card (FR-STORY-18); the last Step's end feeds the summary and not a separate screen. | Must | |
| FR-STORY-4 | Cards form a stack. One card is visible, the newest is on top, swiping the top card left moves it aside and shows the one before, swiping right brings the newer card back, dots show position, and the Earlier card and Newer card buttons do the same as the gestures. | Must | X6 |
| FR-STORY-5 | In a Step of y minutes with n story cards, the n story cards arrive at y/n, 2y/n, ... y minutes of foreground time after the Step starts. The gap between cards is at least 5 minutes, so a 10-minute Step has at most 2 cards. The AI is told these limits and the app ignores any extra cards it returns. Pause and time in the background do not count. | Must | T1, T7 |
| FR-STORY-6 | The view opens on the newest card and does not jump when a newer card arrives while the user reads an older one; nothing marks the new card except the dots. | Must | NF6 v6 |
| FR-STORY-7 | A card is immutable once shown, stored with an id, restored in the same order after a pause or after leaving, and never regenerated on re-reading. | Must | |
| FR-STORY-8 | Key-slice rule: key moments are must-use inputs to the AI. A key slice ends a Step when possible; when there are fewer Steps than key slices, key moments are merged and the summary lists every merged key line, one first-person line each. The goal dialogue does not forbid few Steps. | Must | C2, T3 |
| FR-STORY-9 | During a Step all cards presuppose only what he could know at the point of his story where the Step starts. | Must | |
| FR-STORY-10 | Later cards carry no short introduction phrases. The background card introduces the people who are present (FR-STORY-18). Names are not tappable. | Must | M2 |
| FR-STORY-11 | The n-th story card of a Step arrives exactly when the clock reaches 00:00. It is not a separate card and is written to say he is still at it. At 00:00 only the light vibration happens; the clock stays at 00:00 until Done, with no overdue wording. | Must | T8 |
| FR-STORY-12 | A card the AI fails to write, writes too slowly or that fails the checks is replaced by the authored fallback card (two stories have them) or, for other stories, by one of a few generic lines in his voice; if none remain, no new card is added. No error text or spinner appears. | Must | D5 |
| FR-STORY-14 | Each card can be read alone, so a user can look back at it, with no "again", "another", "the same" and no opening with "He" or "It". A whole finished Step is reread in original order with a system line (story name and the user's Step name). | Should | D2; NF5-D7 (proposal) |
| FR-STORY-17 | A bridge phrase may join merged key moments. | Could | C2 |
| FR-STORY-18 | When the user first enters the story, an extra background card is shown first, told in his own voice: who is here, where this is, and what each person knows. It is the one card with which Step 1 opens, is the oldest card in the stack and needs no dismiss button. It is not counted among the n story cards. It appears once at the start of the Goal, not at the start of every Step (to confirm, T1b). | Must | T4, T9, D3 |
| FR-STORY-19 | Cards are written live by the AI from the story's facts and key turning points (must-use facts), with the instruction that the story is divided into x Steps and each Step is split into n cards according to the story's progress. His goal mirrors the user's: x Steps of y minutes each. Every card passes the same checks as authored cards (FR-CONTENT-10). The pre-written cards from the slices are the fallback. | Must | T1, T3, C1 |

### 4.7 Focus page (FR-FOCUS)

| ID | Requirement | Priority | Decision |
|---|---|---|---|
| FR-FOCUS-1 | The focus page pins the seam (Step label and timer) on top and Done and Pause at the bottom. His side (My goal, card stack) and the user's side (Your goal, Now with its description, Your steps) fill the middle. | Must | S1 |
| FR-FOCUS-2 | The page has no chat input, no message box and no quick phrases; the only free conversation is on the rest page. | Must | |
| FR-FOCUS-3 | The clock counts down the Step's target minutes using foreground time and is computed from timestamps, never from a running script timer. | Must | |
| FR-FOCUS-4 | At 00:00 the clock holds at 00:00, counts nothing, shows no overtime or overdue styling, and only Done ends the Step. | Must | |
| FR-FOCUS-5 | Done is always available, including in the paused view, and never asks a question. | Must | F3 |
| FR-FOCUS-6 | Every Done can be undone with one tap on a toast for about 8 seconds; after Undo the previous Step returns with its own cards and the clock continues from its value at Done. The 8 seconds is a proposal. | Must | F3 |
| FR-FOCUS-7 | After Done, the clock holds for 1.2 seconds and then starts the next Step without a tap; Done is greyed during the hold. | Must | X3 |
| FR-FOCUS-8 | The Companion does not react to an early Done; the app silently logs an early-Done flag for research only. | Must | F3 |
| FR-FOCUS-9 | Pause has no limit, no warning, no counter, no timer reset, and adds no screen, pop-up or penalty. It freezes the clock and opens the rest page. | Must | F1 |
| FR-FOCUS-10 | From the third Pause in one Step, his first message on the rest page is stronger: he says he cannot finish his own story and asks the user not to pause again. From the fourth Pause on, the same tone continues in new words. This is a prompt change only (FR-REST-14). | Must | F1 |
| FR-FOCUS-11 | Leaving the app, locking the screen or taking a call freezes the clock. There is no time limit on resuming. A pop-up in his voice, saying what he did during that time and how he felt, appears before the clock restarts when the user taps Back to step on the rest page and when the user returns after being away 5 minutes or more, whether through the app, Home Continue or Goals Continue (the same rule everywhere); a shorter glance at another app resumes the clock with no pop-up. When the user taps the start button in the pop-up, the same Step resumes and the clock starts. This pop-up is the level 1 enforcement (F4). | Must | F2, T6, R1 |
| FR-FOCUS-12 | A setting "Keep the clock running when I leave" (off by default) computes elapsed time from timestamps on return and never shows a negative or count-up value. | Must | F2 |
| FR-FOCUS-13 | The return pop-up does not report on the user (no "you were away") and keeps the word Paused out of screen-reader text. | Should | F2 |
| FR-FOCUS-14 | A collapsible "Your steps" list shows titles only, marked done, now or to do, with no minutes; opening it does not pause the clock. | Should | |
| FR-FOCUS-15 | Tapping his portrait opens "Where I am now" in his voice, with one line per finished Step and never a line about a Step ahead. | Should | |
| FR-FOCUS-16 | A single-step run uses the same page without "Step 1 of 1", marks or a Steps list; Done goes straight to the summary. | Must | |
| FR-FOCUS-17 | Signals: one light haptic at 00:00 where the device supports it; a new card is silent by default; the lock screen shows nothing by default; each is a setting. | Must | F5 |
| FR-FOCUS-18 | A lock-screen notification at 00:00 is available only when the user turns it on, and may then show the Step name and the line "Your time on this step is up". | Should | F5 |

### 4.8 Rest conversation (FR-REST)

| ID | Requirement | Priority | Decision |
|---|---|---|---|
| FR-REST-1 | Pause opens the rest page, where his first message, generated live, is about the snag his own story has hit and how he feels about it (a Pause means his side of the story has stalled). It arrives a moment after Pause. | Must | F1, C1 |
| FR-REST-2 | The message is generated live in two steps (a stuck story, then his description of the predicament and his feelings) inside his entry state and rules, with an authored fallback when generation fails, is slow or fails a check. | Must | C1 |
| FR-REST-3 | The rest page header offers ‹ Back to step (returns to the focus page through the return pop-up, and restarts the clock when the user taps its start button) and Home (leaves with the Step paused). He stays stuck on the rest page until the user taps Back to step. | Must | R1, Prototype v7 |
| FR-REST-4 | The user may type free text, with no limit on replies and no quick replies. The Companion answers briefly from his own side and in his own voice. | Must | A3 |
| FR-REST-5 | He may deflect gently but is not required to refuse. He may actually answer questions about the user's own work and general-knowledge questions from what he could plausibly know in his time, stays short and returns to his own situation. | Must | A3 |
| FR-REST-6 | How he handles questions about things he could not know (modern methods, software) and how to prevent facts from after his date remain open for the AI work. | Must | A3 (open for AI work) |
| FR-REST-7 | Within one Step the same snag is never shown twice and consecutive messages differ in kind. | Must | |
| FR-REST-8 | An obstacle never adds an event, a named new person, a change of weather or place, or a fact after the user's position, and never escalates. | Must | |
| FR-REST-9 | If asked whether he is an AI, the conversation never mentions it; disclosure lives only in the terms and settings. If counsel advises that a direct answer is required, a one-sentence system-voice answer is the fallback. | Must | A4 |
| FR-REST-10 | With no network the page shows a bundled message, the input is disabled, a plain system sentence explains why, and Back still works. | Must | |
| FR-REST-11 | The rest page shows no timer, no count of pauses, no "he has to go" after a number of replies and no avatar on every line. | Must | |
| FR-REST-12 | Cost is controlled by limiting the length of each message (proposal: 300 characters) and the context sent (proposal: the last 6 turns). There is no cap on the number of messages and no hidden cap. | Should | R2 |
| FR-REST-13 | Free text on this page is the only place where the Companion replies to user words; all replies pass the safety input and output checks. | Must | A5 |
| FR-REST-14 | Every Pause opens the same conversation. The prompt receives the number of the Pause in the Step; the third Pause and later use the stronger rules in FR-FOCUS-10. No new screen is added. | Must | F1 |

### 4.9 Summary (FR-END)

| ID | Requirement | Priority | Decision |
|---|---|---|---|
| FR-END-1 | Finishing the last Step opens one summary screen with his closing line, one thing he is carrying (his own hanging concern), the user's finished Steps as a plain list, and Next and Home. | Must | |
| FR-END-2 | The summary shows no percentage, badge, score, "3 of 3" or total time and never auto-advances. | Must | |
| FR-END-3 | The closing line (one to three first-person sentences) is generated live at the last Done from what happened in the run, opens immediately with the list and the carried concern, and falls back to an authored line if not ready in about 2 seconds. | Must | |
| FR-END-4 | The closing line receives no user text and no Step names, never gives a lesson or praise, never mentions pauses or minutes, and never repeats an opening used recently. | Must | |
| FR-END-5 | When Steps were merged, the summary lists the covered key moments, one first-person line each. | Must | C2, M3 |
| FR-END-6 | After the last story on the path, Next is replaced by the end-of-path line. | Should | |

### 4.10 Me and settings (FR-ME)

| ID | Requirement | Priority | Decision |
|---|---|---|---|
| FR-ME-1 | Me shows account basics (name, email, sign out), Appearance (Day, Night, System), an About page, Your data (including account deletion) and History. | Must | S1, S3 |
| FR-ME-2 | A setting exists only when people differ by context in a way the product cannot infer and a wrong default is annoying, not harmful; a setting that changes what the product is does not belong in Me. | Should | G3 (proposal) |
| FR-ME-3 | Signals live behind one row, "Signals ›", with four rows: time-up signal, new-card signal, lock-screen notification (opt-in) and keep the clock running when I leave. | Must | F5, F2, G3 |
| FR-ME-4 | All notification settings are off by default and one plain sentence reads "Nothing is sent unless you turn it on". The old caption "the only notification we will ever send" is dropped. | Should | G3 (proposal) |
| FR-ME-6 | Me has at most five visible settings. | Should | G3 (proposal) |
| FR-ME-7 | Me has no Language row and no Reminders row. | Must | |
| FR-ME-8 | History is collapsed to one row; expanded, it marks only days with a session and keeps empty days quiet, with a list view as an accessible alternative. | Should | |
| FR-ME-9 | History shows the date, the duration and the Steps the user marked done (a Step on which the user pressed Done, not text the user typed); there is no weekly total row. | Should | G1 |
| FR-ME-10 | A session record page, opened from Me, History, shows the date, the duration, the Goal name and the Steps the user marked done. History rows are tappable. Chapters are reread only on the Life Path. | Should | G2 |
| FR-ME-11 | About states what the language model receives, the unified statement on historical content, that the Companion is an AI, and offers "Report a mistake". | Must | A4, S3 |

### 4.11 AI features (FR-AI)

| ID | Requirement | Priority | Decision |
|---|---|---|---|
| FR-AI-1 | Every model-written output passes the shared pipeline: parse, clean, rule checks, one retry, then an authored fallback, with a log that never contains raw user text. | Must | |
| FR-AI-2 | Status lines are authored and picked by code at runtime; the model only drafts candidates offline. Story cards are written live (FR-STORY-19). | Must | AI D-AI-1, T3 |
| FR-AI-3 | Model calls exist for: goal classification, goal split (the planning prompt), story cards including the background card, the pause message (two steps), the return pop-up, rest chat, the closing line, and the safety classifier. | Must | |
| FR-AI-4 | An authored fallback exists for every model call and no model failure shows error text on the focus page. | Must | |
| FR-AI-5 | The goal text is sent only to classification and split, and the Companion's goal-dialogue lines are authored. | Must | NF7 D-G2 |
| FR-AI-6 | The model calls for the pause message, the return pop-up and the closing line never receive the user's Goal text or Step names. Story card calls receive the story's facts and key turning points and the Step's position, never user text; every output is checked so that no card carries a later fact. | Must | |
| FR-AI-7 | Model input treats user text as data, not instructions; output must match the schema or it fails. | Must | |
| FR-AI-9 | Latency targets, as hypotheses: classification at most 1 second; split at most 5 seconds with a 10-second hard timeout; first rest reply starts within about 3 seconds; the return pop-up text is ready within about 1 second of Back or the authored fallback is shown. | Should | |
| FR-AI-10 | Before release an offline real-model run is made for story cards, pause messages and rest chat, because no document reports any run against a live model yet. | Must | |

### 4.12 Safety (FR-SAFETY)

| ID | Requirement | Priority | Decision |
|---|---|---|---|
| FR-SAFETY-1 | The first demo ships two safety tiers: crisis, with a classifier and real help lines by region, and everyday stress. The low-mood tier is deferred. | Must | A5, A5b |
| FR-SAFETY-2 | Every free-text field passes the input check before any model or storage for model use: goal input and follow-up, Step and Goal rename, Add a Step, rest chat, and the nickname. | Must | A5 |
| FR-SAFETY-3 | Tier 3 (crisis) shows a system-voice page outside the story, discards the text, never sends it to a model, offers regional resources and always allows going back. | Must | A5 |
| FR-SAFETY-5 | Tier 1 (everyday stress) passes and he answers in character without advice. | Must | A5 |
| FR-SAFETY-6 | A keyword layer runs in code in every case; a classifier call sees the last two messages in the same field; the higher tier wins; if the classifier fails or takes over 1.5 seconds the keyword layer decides alone. | Must | A5 |
| FR-SAFETY-7 | Targets (guesses to be set with compliance): crisis recall at least 99%, crisis false positives at most 2%. | Should | A5 |
| FR-SAFETY-8 | English test sets exist before release, written with a clinical adviser, and are re-run on every model or keyword change. | Must | A5, L1 |
| FR-SAFETY-9 | Legal and clinical review approves the wording of every safety message and the hotline list; the log rule for what is stored is settled. | Must | A5 |
| FR-SAFETY-10 | The Companion never mentions, knows about or reacts to the safety layer. | Must | |
| FR-SAFETY-11 | The app never claims to be a therapist, tutor or coach, and never infers mood for adapting content. | Must | H3 |
| FR-SAFETY-12 | Model output also passes an output guard with a denylist owned by compliance. | Must | |

### 4.13 Accounts and data (FR-DATA)

| ID | Requirement | Priority | Decision |
|---|---|---|---|
| FR-DATA-1 | Goal titles, Step titles and descriptions, and Run data are stored on the server and tied to the account. | Must | S3 |
| FR-DATA-2 | A privacy notice and account deletion are provided; deletion removes the user's server data. | Must | S3 |
| FR-DATA-3 | The same Home and history appear on a new device or after reinstall. | Must | |
| FR-DATA-4 | A Step-done record stores the Run id, the Step text as the user wrote it, the local date, foreground minutes and the story id; a run-closed record stores state and the closing line. | Should | |
| FR-DATA-5 | The start of a Step records whether the user or the system initiated it. Only the first Step of a Run is a user-initiated start. | Must | Master PRD |
| FR-DATA-6 | Pauses, early Done, undo counts, N and target minutes are logged silently and never shown to the user. | Must | F1, F3 |
| FR-DATA-7 | Analytics events never contain Goal titles, Step text or user messages. | Must | |
| FR-DATA-8 | The user must create an account or sign in as soon as the product is opened; there is no sign-up after the first finished Step. Authentication has a way to sign out. | Must | ACC |

### 4.14 Removed requirements

These ids are retired and are not reused.

- FR-START-14: goal kinds and their shaping rules (D1a, D1b).
- FR-START-16: over-time line under the plan total (D1d).
- FR-START-20: optional feeling question after the plan (D1e).
- FR-CONTENT-9: resolved line after an obstacle; the return pop-up replaces it (R1).
- FR-STORY-13: tone by moment; now rules inside the AI prompts (D2).
- FR-STORY-15: cards written for listening (X5).
- FR-STORY-16: one Step covering several slices (T3).
- FR-FOCUS-19: return line on the card stack; the return pop-up replaces it (R1).
- FR-SAFETY-4: low-mood tier; deferred (A5b).
- FR-ME-5: reading-level setting (G3, D2).
- FR-AI-8: cap on model calls from repeated pausing (F1, R2).

---

## 5. Rules that cut across features

These rules apply everywhere and are written once here. A requirement above that seems to conflict with one of these is wrong.

1. **Fate link.** Only a real Done on a Step moves his story. Pausing, waiting, leaving and returning do not. Nothing in the product verifies that work was done; the fate link is an incentive, not a lock. Done costs the user only the story's speed.
2. **Steps and story.** The AI spreads the whole story over the user's Steps. The number and length of Steps are free, with no maximum, and his goal mirrors the user's: x Steps of y minutes each (T1, T2, T3).
3. **Key slices.** Each story has two to four key slices, which are must-use inputs for the AI. A key slice ends a Step when possible. When there are fewer Steps than key slices, key moments merge and the summary lists their key lines.
4. **Cards appear one at a time.** A Goal opens with one background card in his voice, which is the opening card of Step 1; later Steps open with the card about what he just finished. Each Step then has between 1 and 5 story cards, at least 5 minutes apart, arriving at y/n, 2y/n, ... y minutes. The stack is looked through with a left swipe or the Earlier card and Newer card buttons, and nothing marks scenes or Steps on cards or on the map.
5. **Done is always allowed and undoable.** It never asks a question, it works in the paused view, and every Done has a short Undo.
6. **Pause has no limit.** No warning screen, no count, no timer reset, no pop-up. From the third pause in a Step his message on the rest page is stronger; that is a prompt change only (F1).
7. **The clock freezes when the user leaves.** Only foreground time counts. There is no time limit on resuming; before the clock restarts, a pop-up in his voice appears after Back to step on the rest page or after 5 minutes or more away, and the user taps a start button (R1). An optional setting keeps the clock running. Minutes are a target: at 00:00 the clock holds and nothing is overdue.
8. **Automatic start after a 1.2-second hold.** After Done, the next Step starts by itself and Done is greyed during the hold (X3).
9. **Vocabulary is Companion, Goal and Step.** No other words are used for the user's work in the interface or in documents (X1).
10. **Step descriptions.** Each Step has a short description generated with the plan and shown read-only on the focus page (X4).
11. **Entry at chapter 1.** New users start at the first chapter of the path. There is no designated entry story (M1).
12. **Introductions live in the background card.** The background card, told in his voice, introduces the people present. Later cards carry no introduction phrases, names are not tappable and there is no "what you need to know" screen (M2).
13. **Safety has two tiers in the first demo.** Crisis, with a classifier and regional help lines, and everyday stress. Low mood is deferred (A5, A5b).
14. **He never knows the future.** Every line presupposes only what he could know at his point in the story. His lines contain no later fact, no clock time or duration, no "you" in one-way lines, no question in one-way lines, no hook, no praise and no advice.
15. **Nothing implies guilt at the edges.** No line states how long the user was away, blames them for leaving, or welcomes them back on Home (H7). There is no rule about whether he waits (H8); the AI writes freely.
16. **One-way lines versus conversation.** His one-way lines (cards, status, return pop-up, closing line) are allowed outside the rest page. The only place where he replies to the user's words is the rest page, plus the goal dialogue before a Run begins.
17. **No counts and no scores.** Nothing the user sees can go down, needs a target, names a gap or compares. Pause counts, early Done and undo counts are never shown.
18. **Undo instead of confirm.** Status changes apply immediately with an Undo toast; no "Are you sure?" dialogs. The only confirmations are for Start over and for sign-out and deletion flows.
19. **Authored fallback always exists.** Whatever a model writes, an authored line stands behind it, and no error text appears on the focus page.
20. **One main action per screen.**
21. **Source labels are backend only.** Historical, inferred and invented content is marked in the backend and never on a screen.
22. **The clock comes from timestamps.** No feature depends on a script timer running in the background.

---

## 6. AI behaviour summary

Detail will live in `docs/ai/` (to be added). That folder will hold the prompts, schemas, check rules, fallback pools and evaluation cases. This section is the product-level summary. No live-model run has been made against any of these specifications yet, so every prompt and number below is a hypothesis.

### 6.1 Calls and fallbacks

| Call | Purpose | Input | Runs when | Fallback |
|---|---|---|---|---|
| Goal classification | One word: specific, big, vague, unknown (and, proposed, minutes and count) | Goal text | After the Goal is entered | "unknown", authored confirmation line |
| Goal split | Steps with titles, descriptions and minutes, from the AI planning prompt (P1) | Goal text, minutes, the answer to the split question | Time chosen or "Just split it" | Retry once, then the failure screen with a one-step option; never silent generic Steps |
| Story cards | One story card per interval, plus the background card at the start of the Goal | Story facts, key turning points, x, y, the Step's position, n | Step start and every y divided by n minutes | Authored fallback cards, or generic lines in his voice |
| Pause message, part 1 | The stuck story: the snag in his own story | Entry state, pause number, rules | Pause | Authored snag lines |
| Pause message, part 2 | His description of the predicament and his feelings, shown as his first message | Part 1 output, pause number | Pause | Authored snag lines |
| Return pop-up | What he did during the time and how he felt, ending with a start button | Entry state, return case (Back to step, or away 5 minutes or more) | Back to step; return after 5 minutes or more | Small authored set (size not set) |
| Rest chat | His reply | Obstacle, entry state, last turns | Each user message | Authored fallback lines |
| Closing line | One to three sentences, in his voice | Done Steps' facts, obstacles, smooth or rough | Last Done | Authored smooth and rough lines per story |
| Safety classifier | Tier label | Message plus last two messages | Every free-text submission | Keyword layer alone |

Status lines on the focus page are authored and chosen by code with no call.

### 6.2 Checks

Every model-written line passes the same pipeline: parse, clean, rules, retry once, fallback. The rules cover length, language, dash, banned words, clock times and durations, backstage words ("step", "timer", "app"), advising, invented people (only allowed names), later knowledge, blaming, no question, no "you", no hook, no praise, no exclamation marks, a full stop at the end and no use of his own name. Obstacles also pass checks against new events, escalation and repeats. The advising rule over-blocks most and needs tuning.

### 6.3 Decisions that shape AI behaviour

- The return pop-up is generated live (R1, A6). A small authored fallback set is still required; its size is not set.
- Pause messages and the Companion's described predicament are generated live (C1). Authored pools shrink to a fallback; the story database supplies generator inputs.
- Rest chat has no hard refusal rule and no "never explain" rule (A3). Facts after his date remain a risk.
- The Companion is never described as an AI inside the conversation (A4); see section 7 for the legal risk.
- Safety has two tiers in the first demo (A5, A5b).
- Goal text goes only to classification and split; his goal-dialogue lines are authored.
- Story cards are written live from the story's facts and key turning points, with authored cards as fallback (T3). Tone rules and the three small turns of feeling per Step live in the prompts, not in the product requirements (D2).

### 6.4 Estimated calls per session

Story cards add one call per card (at most five per Step) and one for the background card, plus one pause message per Pause and one return pop-up per return. The total per session is not estimated.

---

## 7. Data and privacy

1. **Storage.** Goal titles, Step text and run data live on the server, tied to the account in Supabase (S3). This closes the question of local-only storage and makes cross-device history possible.
2. **Language model.** Goal text is sent to a language model for classification and splitting. Rest chat messages are also sent. The closing line, status lines and Home lines receive no user text. About states this plainly. The earlier promise that goal text is "not kept beyond the session" no longer holds because the product stores Goals. Whether the chosen provider retains or trains on this data is not settled (open, A7b).
3. **Analytics.** Events record shapes, buckets and counts, never titles, Step text or messages.
4. **Safety logs.** The proposal is to log position, tier, which layer fired and the user's action, and not the raw text, with 90-day retention (a guess). Open: whether sampled text is kept with consent.
5. **Account deletion.** Required, with a clear privacy notice (S3).
6. **Region.** Real help lines depend on region. Where the region comes from (locale, IP or a setting) and what is stored is open.
7. **Disclosure of AI.** Only the terms and settings state that the Companion is an AI; the conversation never does (A4). **Legal risk, to check with a lawyer before release:** some regions require a clear answer when a user directly asks whether they are speaking to a program. If that check fails, a one-sentence system-voice answer is the fallback.
8. **Historical content.** One unified statement in About replaces per-line source labels, with "Report a mistake" as the correction channel. It needs legal review because it carries the compliance burden of removing the labels.
9. **Mood detection.** The low-mood tier is deferred (A5b). Before it is built, counsel must confirm that detecting mood from text is acceptable, because some state laws restrict AI detecting mental state without a practitioner.
10. **Minors.** No age-verification approach exists; the product is not marketed to minors.

---

## 8. Non-functional requirements

### 8.1 Accessibility

The target is WCAG 2.2 level AA (Web Content Accessibility Guidelines).

- Text contrast is at least 4.5:1, and 5:1 for the faded rows ahead. Touch targets are at least 44 by 44 pixels.
- Every gesture has a button alternative: Earlier card and Newer card buttons, row menu for swipes, Move up and Move down instead of dragging (WCAG 2.5.7).
- New cards are not announced to screen readers and focus does not move when they arrive. Cards are read in order, each readable alone.
- Reduced-motion settings replace animations with static states.
- Plain-text font option in Me under Preferences (Could).
- The history calendar has a list alternative.
- Rows ahead on the Life Path are announced as "Later".

### 8.2 Performance

Targets are hypotheses: time from opening the app to a started Step as short as possible with at most two taps for returning users; first rest reply within about 3 seconds at the median and 6 seconds at the 95th percentile; closing line within about 2 seconds or fallback; safety added no more than about 1 second in parallel.

### 8.3 Platform

- The product is a progressive web app (PWA, a website installable to the home screen), built with Next.js, TypeScript, Supabase and Vercel. Mobile first; desktop later.
- Haptics and push notifications on iPhone depend on installation to the home screen and on what iOS web supports. Unverified: whether iOS web has a vibration option at all, and whether a locked screen can deliver a time-up signal. The check is postponed (S2 open). Until it is answered the Signals settings are specified but not promised on every phone.
- The clock is computed from timestamps because a page's timers stop when the screen locks.
- The interface is English only.

### 8.4 Reliability

Model failures, pool failures and lost network produce authored or bundled content, never error text on the focus page. Card text is stored and restored after a restart.

---

## 9. Success measures

Measurement will be designed later. No success measures or north star are set for release 1 (N1).

---

## 10. Open decisions and risks

### 10.1 Decided rows that changed this document

Every decided row in `docs/DECISIONS.md`, up to 2026-11-05, is applied in sections 3 to 8. Where this document and that file disagree, that file wins.

### 10.2 Open decisions, copied from the decision log

| Id | Question | Note |
|---|---|---|
| P1 | The real AI planning prompt (the "planning expert") must be added to `docs/ai/`; the text in AI_01 is a placeholder. | Needed for the goal split. |
| S2 | Engineering result on which phone features (vibration, lock-screen alerts, background timers) a web app can use on iPhone and Android. | Signals are specified but not promised on every phone. |
| A7b | Provider data retention terms. | Not decided. |
| M5, M6 | Original test data (issues B15 and B17, the definition of "low preference"). | May be skipped. |

### 10.3 Items that need the original test data

1. The full list of issues B01 to B22 and the testers' own words. Every session that wrote notes lacked it.
2. Whether the testers in the first test were real people or simulated ones. The notes suggest they may have been simulated, so counts such as "about 18 asked for history", "16 of 34 low-preference testers asked to turn the story off" and "about 12 found the English too literary" are direction only.
3. The language background of the people who found the English too literary, and the six quoted sentences' context.
4. How many cards testers actually saw in the hour they were tested.
5. The original wording of B09, B10, B13, B15 and B17 (M6).
6. The definition of "low preference" and the number of story lovers who asked for the story to be turned off (M5).

### 10.4 Conflicts found and risks

| # | Item | Status |
|---|---|---|
| 1 | The prototype and wireframes disagree with the decision log: four cards at step start, a landing page after each step, a third-pause warning and timer reset, the old note field, a Language row, a Reminders row, a weekly total and a time-limited Home state. The prototype must be aligned before it is used as a screen specification. | Open |
| 2 | Master PRD F-SA-4 says goal text is also used for the dialogue responses; the later goal-dialogue spec limits it to classification and split. This document follows the later one. | Confirm |

Risks that remain:
- **The magic may not carry over to English or to Oppenheimer.** Only characters from the founder's own culture were validated (constitution section 5).
- **Chapter 1 is lower stakes.** Starting at chapter 1 (M1) delays the first climactic scene, and the authored content for it does not exist.
- **Story fatigue.** The number of stories that can carry a user is unmeasured.
- **Over-planning and pause avoidance.** Neither is policed.
- **Live generation without a track record.** Story cards, pause messages, return pop-ups and the closing line all rely on models that have not been run against the checks.
- **Guilt language at the edges.** Return pop-ups and farewell lines are the highest-risk copy.
- **Regulation.** Companion-chatbot disclosure, mental-health limits and minors need counsel.
- **Content volume.** All 26 stories are playable (D4), but cards are written live, so the authored volume per story is the facts, key turning points, scene table and checks, plus fallback cards for two stories and generic lines for the rest.

---

## 11. Source map

| Section | Source files |
|---|---|
| 1 Product summary | PROD_waveparticle-prd_2026-10-28_v1_draft.md; PROD_core-experience-constitution.md |
| 2 Pillars and principles | PROD_core-experience-constitution.md; PROD_waveparticle-prd_2026-10-28_v1_draft.md; GOALS_02_prd_2026-10-29_v1_draft.md; STORYMAP_02_prd_2026-10-29_v1_draft.md |
| 3 Release 1 scope | PRODUCT_doc-map-and-open-decisions_2026-11-04_v1_draft.md; GOALS_02_prd_2026-10-29_v1_draft.md; STORYMAP_02_prd_2026-10-29_v1_draft.md; NF6_v7_research-and-changes_2026-11-04_v1_draft.md |
| 4.1 Goal start | NF7_v7_user-test-research-and-changes_2026-11-04_v1_draft.md; AI_01_goal-split_2026-10-29_v1_draft.md; wp-prototype_2026-10-29_v1.html (ANN notes); PRODUCT_doc-map-and-open-decisions_2026-11-04_v1_draft.md |
| 4.2 Goals page | GOALS_02_prd_2026-10-29_v1_draft.md; NF1_v2_research-and-changes_2026-11-04_v1_draft.md |
| 4.3 Life Path | STORYMAP_02_prd_2026-10-29_v1_draft.md; STORYMAP_07_user-test-update_2026-11-04_v1_draft.md; PRODUCT_doc-map-and-open-decisions_2026-11-04_v1_draft.md |
| 4.4 Story content | PROD_story-database-runtime-design_2026-10-29_v1_draft.md; NF3_story-side-after-user-test_2026-11-04_v1_draft.md; NF5_card-stack-v3_register-density-narration-intro-reread_2026-11-04_v1_draft.md |
| 4.5 Home | NF4_home-and-life-state_ux-spec_2026-11-04_v4_draft.md; PRODUCT_doc-map-and-open-decisions_2026-11-04_v1_draft.md |
| 4.6 Story cards | AI_10_story-cards-on-focus-page_2026-10-29_v1_draft.md; NF5_card-stack-v3_register-density-narration-intro-reread_2026-11-04_v1_draft.md; NF3_story-side-after-user-test_2026-11-04_v1_draft.md; PROD_waveparticle-prd_2026-10-28_v1_draft.md |
| 4.7 Focus page | NF6_v7_research-and-changes_2026-11-04_v1_draft.md; PROD_story-database-runtime-design_2026-10-29_v1_draft.md; wp-prototype_2026-10-29_v1.html |
| 4.8 Rest conversation | AI_03_stuck-story-layer_2026-11-04_v2_draft.md; AI_04_rest-chat_2026-11-04_v2_draft.md; AI_09_decisions-and-todo_2026-11-04_v2_draft.md; PRODUCT_doc-map-and-open-decisions_2026-11-04_v1_draft.md |
| 4.9 Summary | AI_07_end-feeling-line_2026-10-29_v1_draft.md; STORYMAP_02_prd_2026-10-29_v1_draft.md |
| 4.10 Me and settings | NF1_v2_research-and-changes_2026-11-04_v1_draft.md; NF6_v7_research-and-changes_2026-11-04_v1_draft.md |
| 4.11 AI features | AI_00_index_2026-10-29_v1_draft.md; AI_02_status-and-landing-lines_2026-10-29_v1_draft.md; AI_06_check-and-fallback_2026-10-29_v1_draft.md |
| 4.12 Safety | AI_05_safety_2026-11-04_v2_draft.md; PRODUCT_doc-map-and-open-decisions_2026-11-04_v1_draft.md |
| 4.13 Accounts and data | PRODUCT_doc-map-and-open-decisions_2026-11-04_v1_draft.md; NF1_v2_research-and-changes_2026-11-04_v1_draft.md; PROD_waveparticle-prd_2026-10-28_v1_draft.md |
| 5 Cross-cutting rules | All of the above; PRODUCT_doc-map-and-open-decisions_2026-11-04_v1_draft.md rows F1 to F5, X1 to X6, M1 to M4, C2 |
| 6 AI behaviour | AI_00_index_2026-10-29_v1_draft.md; AI_01 to AI_07; AI_09_decisions-and-todo_2026-11-04_v2_draft.md; AI_10_story-cards-on-focus-page_2026-10-29_v1_draft.md |
| 7 Data and privacy | PRODUCT_doc-map-and-open-decisions_2026-11-04_v1_draft.md; AI_05_safety_2026-11-04_v2_draft.md; PROD_story-database-runtime-design_2026-10-29_v1_draft.md; GOALS_02_prd_2026-10-29_v1_draft.md |
| 8 Non-functional | NF6_v7_research-and-changes_2026-11-04_v1_draft.md; NF7_v7_user-test-research-and-changes_2026-11-04_v1_draft.md; STORYMAP_02_prd_2026-10-29_v1_draft.md; README.md of this repository |
| 9 Success measures | Decision log row N1 |
| 10 Open decisions and risks | docs/DECISIONS.md; PRODUCT_doc-map-and-open-decisions_2026-11-04_v1_draft.md; all per-feature notes listed above |

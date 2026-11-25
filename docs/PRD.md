# WaveParticle Mobile: Product Requirements Document

Version 0.1 (draft). Date: 2026-11-05. Owner: Yue (product and content). Decisions are recorded up to 2026-11-15 (issue #295).

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
| Companion | The character who accompanies the user. Release 1 builds two Companions, Oppenheimer and Moriarty (OTHER-COMPANIONS). |
| Goal | Something the user wants to finish or keep doing. It has a title, a Companion, a type (One-time or Ongoing) and a status (In progress, On hold, Done). |
| Step | One part of a Goal with a short title, a description of one or two sentences, and a target number of minutes. The user works on one Step at a time. There is no maximum number of Steps. |
| Run | One attempt at a Goal: its Steps, current Step, clock position and the story it is bound to. A Goal has at most one open Run. |
| Story | One episode of the Companion's life (for Oppenheimer, one chapter such as a night, a lunch or a hearing). A story has 2 to 5 parts (STORY-PARTS). |
| Part | One of the Companion's tasks in a story. Story cards are made ahead for each part, and the app spreads the parts across the user's Steps (CARDS-PER-PART). |
| Slice | A short unit of a story, built from one to three historical facts. Slices supply the facts the story cards are made from. |
| Card | One short first-person text from the Companion shown on the focus page. Story cards are made ahead once per story part, published and shared by all users, and read by a person after publishing (SHARED-STORY, PUBLISH-FIRST); one extra background card opens the Goal. |
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

1. No streaks, no shame, no "you missed". Coming back is always allowed. Nothing he says blames the user or measures the time away; the return pop-up speaks only of his own situation, and he may say how the time felt to him in his own words (TIME-WORDS).
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
| Companion browsing | The Companions list (Oppenheimer and Moriarty, OTHER-COMPANIONS) and the Oppenheimer Life Path page with current story card |
| Goal dialogue | The conversation that turns a Goal into Steps: the Goal, the time, whether to split finer, an editable plan, failure state, one-step plan |
| Focus page | Story cards on his side, the user's side, Done and Pause, single-step variant, timer at zero, signals |
| Rest conversation | The page opened by Pause: his message about the snag in his own story, free conversation, offline state, Back with the return pop-up |
| Summary | The end screen with his closing line, what he is carrying and the user's finished Steps |
| Goals and Me | Goals (In progress, On hold, Done, History), Goal detail, New goal, and Me (appearance, signals, about, data, history calendar, session record) |
| Safety | Two-tier safety page and responses (crisis and everyday stress) |
| Accounts | Sign-up or sign-in when the product is first opened, privacy notice, account deletion |
| Content admin | A website at `/admin` for writers and the product manager to edit Companions, stories, cards, app text, prompts and checks; changes go live only on Publish (ADMIN). It has one page per AI feature, with its purpose, pass standard, approach, status, prompt text and test results (AI-PAGES, `docs/ai/AI_11_feature-pages.md`) |

### 3.3 Explicitly out of release 1

| Out | Source |
|---|---|
| A user-facing switch to turn the story off. An internal research flag exists. A "Quiet" mode is decided after a test. | M4 |
| Level-2 notifications (one opt-in nudge in his voice when the user leaves mid-Step). Level 3 (blocking other apps) is never built. | F4 |
| The low-mood safety tier. The first demo has the crisis tier and everyday stress only. | A5b |
| The listen button (hear a card read aloud) and automatic reading of new cards. | X5 |
| The other six companions of the old product, until each has a content plan. Only Oppenheimer and Moriarty are being built. | OTHER-COMPANIONS |
| A language setting, or any interface language other than English. | L1 |
| Reminders and start times, and the Repeat option on Ongoing Goals. The Reminders row in Me stays hidden. | Master PRD, GOALS_02 |
| Choosing, swapping or skipping stories, and side stories. Stories are played in path order, and all 26 are playable. | STORYMAP_02, D4 |
| Due dates, priorities, labels, projects, streaks, scores, rankings, progress bars, percentages, "N of M". | GOALS_02, constitution |
| Tutoring, stranger matching, scoring completions, a user-built character. | Master PRD |
| Long-term memory about the user and a memory board. Not in the wireframes. | Master PRD |
| Payments and subscriptions. | Master PRD |

---

## 4. Functional requirements

### 4.1 Goal start (FR-START)

| ID | Requirement | Priority | Decision |
|---|---|---|---|
| FR-START-1 | Entering from Companions, the Life Path, New goal or a Goal detail opens the goal dialogue, in which he speaks first from inside his own situation and asks exactly one question. The Goal is typed as free text; there is no restriction on what a Goal can be and no list of unsupported kinds. | Must | D1a |
| FR-START-2 | The dialogue input looks like a chat composer, not a form. | Should | |
| FR-START-3 | The dialogue asks in this order: the Goal, the time available, then whether to split the Goal into finer Steps. There is no feeling question. The assistant proposes a split and the user can adjust it. | Must | T2, D1e |
| FR-START-4 | A shortcut called "Just split it" skips the conversation and uses 30 minutes when no time was given. The prototype uses 60 minutes, which is wrong. | Must | NF7 v6 spec |
| FR-START-5 | A local rule in code (`classifyGoalShape`), with no model call, labels the Goal as specific, big, vague or unknown and decides which authored reaction line he says. A model call may be added later. A vague Goal gets no follow-up question; the planning prompt turns it into concrete first steps (D1f). | Must | GOAL-SHAPE-LOCAL |
| FR-START-6 | The time question is a slider from 1 minute to 3 hours (there is no 0) with no fixed example times, plus Not sure; Not sure means 30 minutes. The goal time is not rounded to 15 minutes. | Should | TIME-SLIDER, SLIDER-RANGE, NO-ROUNDING |
| FR-START-7 | A split call, driven by the AI planning prompt (PLAN-PROMPT, `docs/ai/AI_01` section 4), turns the Goal and time into Steps, each with a short title, a description and minutes; the minutes sum to the time the user gave, and code validates every result. How a plan is split for different kinds of Goals is the job of that prompt, not of this document. | Must | D1b, D1d |
| FR-START-8 | When the split fails twice, a system-voice failure screen keeps the user's text and offers "Try again" and a one-step plan. The app never shows a silent generic list of Steps. | Must | |
| FR-START-9 | A one-step plan is allowed, and focus screens then drop "Step 1 of 1" and any step list. | Must | |
| FR-START-10 | The plan card is fully editable before the user starts: the title, description and minutes of each Step, and the number of Steps (add or remove; remove is hidden when only one remains). If the edits change the total, the Goal's time follows the edits. Start stays visible. | Must | D1d |
| FR-START-11 | Editing rules: adding inserts after the Step being edited with a default of 15 minutes, there is no maximum number of Steps, and empty titles are removed or reverted, also checked on the server. A Step's minutes are changed with −5 and +5 buttons or by typing a whole number from 1 to 1440; at either end the reason is shown in words. | Should | T2, D1d, STEP-EDIT (#249), STEP-RANGE, NO-ROUNDING |
| FR-START-12 | Move up and Move down buttons (not dragging), each at least 44 by 44 px, let the user reorder Steps. | Could | STEP-EDIT, TAP-SIZE |
| FR-START-13 | Each Step has a short title and a description of one or two sentences that expands the title (what to do and what to watch for). The description is generated with the plan, is editable on the plan card, is shown read-only under the Step name on the focus page, and is shown as nothing when missing. | Must | D1c, X4 |
| FR-START-15 | When the Goal text states a session length, the app reads it, does not ask the time question again, shows the time it understood so the user can change it, and removes the phrase from the title; durations that describe the thing ("a 2-hour lecture") do not count. | Should | GOAL-TIME; NF7-P3 (proposal, for the title) |
| FR-START-17 | N is fixed when the user presses Start. Anything that depends on N, including his own x Steps of y minutes and which story parts fall in each Step (plain app code, no model call), is computed then. His lines never state the number of Steps or how many are left. | Must | T1, CARDS-PER-PART, NO-STEP-COUNT |
| FR-START-18 | There is no maximum number of Steps and no story capacity. Key moments are must-use inputs when the story's cards are made ahead. The summary lists no merged key moments (NO-MERGED-MOMENTS). | Must | T2, T3, C2, NO-MERGED-MOMENTS |
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
| FR-MAP-1 | The Companions page lists Oppenheimer and Moriarty with one line each in their own voice; the interface stays neutral and the portraits carry colour. | Must | S1, OTHER-COMPANIONS |
| FR-MAP-2 | The Oppenheimer page shows his stories in path order, grouped into named periods like chapters of a book, with no dates or ages, and opens on the current story card. | Must | S1, PERIODS |
| FR-MAP-3 | A new user starts at chapter 1 of Oppenheimer's path. There is no designated entry story. | Must | M1 |
| FR-MAP-4 | Rows the user finished are filled dots with one past-tense line from him and open a history record; rows before the user's starting point are "his memory" (open ring, italic, not tappable). The stored past-tense line is not fixed and waits for Yue's inner-thoughts framework. Today (main) the row shows the Story's goal sentence; nothing new is built until the framework exists. | Must | STORY-LINES-LATER |
| FR-MAP-5 | Exactly one story is current. It shows his present-tense text and one button, Begin. The stored present-tense line is not fixed and waits for Yue's inner-thoughts framework. | Must | STORY-LINES-LATER |
| FR-MAP-6 | Rows ahead are shown with a neutral title only, never an age or date and never his words. All 26 stories are playable and appear on the path. Rows ahead are not tappable or focusable, use no lock icon, and fade by size and weight while keeping text contrast of at least 5:1. A screen reader says "Later". | Must | D4, PERIODS |
| FR-MAP-7 | A story counts as played when the first Run bound to it finishes its last Step, and finishing opens the next story. Leaving a story records nothing and shows nothing. | Must | FLOW D-7 |
| FR-MAP-8 | The map shows no counts, progress, percentages, countdowns, "locked" labels or source labels. | Must | |
| FR-MAP-9 | The map and the current card carry no scene or Step markers. Key moments appear only in the Life Path history record, never on the summary (NO-MERGED-MOMENTS). | Must | M3, NO-MERGED-MOMENTS |
| FR-MAP-10 | The background card, told in his own voice, introduces the people who are present, so there is no separate "what you need to know" screen. Later cards carry no introduction phrases and names are not tappable. | Must | M2 |
| FR-MAP-11 | After the last story the path ends with one line from him and no further rows. The line must exist; its prompt is designed later (pending, section 10.5). Finishing all stories also unlocks a long-term chat with that Companion (pending). | Should | END-LINE-PENDING |
| FR-MAP-12 | An internal research flag can switch a participant's story off. It is not visible to users. | Should | M4 |
| FR-MAP-13 | Story progress is stored per user and Companion, survives deployments, and several Runs may be bound to one story; a later finisher gets a summary without a Next button. | Must | FLOW D-7 |
| FR-MAP-14 | Tapping a Companion that has no content shows a calm "not available yet" state. The behaviour is not specified in any source. | Could | Proposal |

### 4.4 Story content and data (FR-CONTENT)

| ID | Requirement | Priority | Decision |
|---|---|---|---|
| FR-CONTENT-1 | The story library is the single source of truth. Each story has a sequence number, a period, a title, 2 to 5 parts, slices, key slices, his lines and people. The exact date stays in the notebook for writers, is visible only in the admin and is never passed to a card prompt. `{age}` in a Companion's period text is likewise visible only in the admin and never reaches a prompt. | Must | PERIODS, DATES-ADMIN-ONLY, STORY-PARTS, AGE-TEXT |
| FR-CONTENT-2 | Each slice has one to three first-person past-tense facts. | Must | NO-FALLBACK-TABLES |
| FR-CONTENT-3 | Content for chapter 1 ("The Trade of a Theorist") must be written. The existing authored cards (chapter 8, the site search, and the Trinity night) are reference examples and evaluation material only. | Must | M1, NO-BACKUP |
| FR-CONTENT-4 | Each story has 2 to 4 key slices, each with a first-person past-tense key line of at most 18 words, confirmed by the content owner, and an optional bridge of at most 10 words. The machine-derived key moments are stored as unconfirmed until that review. | Must | C2, KEY-MOMENTS-DRAFT, KEY-UNCONFIRMED |
| FR-CONTENT-5 | Each story lists its people and what each one knows, as input for the background card. Later cards carry no introduction phrases. | Should | M2 |
| FR-CONTENT-6 | Each story supplies one scene table, as drafted (who is present, allowed names, props, one pause prop, later words), with no weather or light scales, and each card carries a state tag, so cards and the opening situation cannot contradict each other. Reading the table is not a gate. | Should | C5 (proposal), SCENE-PER-STORY |
| FR-CONTENT-7 | Each story supplies the inputs the live generators need (scene table, allowed props, allowed names, rules). There are no fallback snag lines (NO-BACKUP). | Must | C1, SCENE-PER-STORY |
| FR-CONTENT-8 | Every card contains something new; a card that repeats earlier information is not acceptable. Examples of something new: a background fact from the story's knowledge field, a new prop from the story's scene table, or a shift of worry. There are no weather or light scales to move. | Should | CARD-NEW, SCENE-PER-STORY |
| FR-CONTENT-10 | Every card passes the same checks: no question, no "you", no clock time or duration, no year, date or age, no number of Steps, no later knowledge, no repeats in a step, each card readable alone. A step story card is 1 to 3 sentences and at most 45 words; the background card is at most 70 words. Cards are made ahead and checked before they are published, and read by a person after publishing; a card that fails or is over the limit cannot be published. | Must | SHARED-STORY, PUBLISH-FIRST, LEN-CARD, DATES-ADMIN-ONLY, NO-STEP-COUNT |
| FR-CONTENT-11 | Cards are never drawn from after the user's current position. The spoiler check runs when cards are made and before publishing, against the parts after the card's own part. | Must | LEAK-BY-PART |
| FR-CONTENT-12 | Historical source labels (in the book, inferred, invented) are kept in the backend and are not shown on any screen. | Must | |
| FR-CONTENT-13 | Every piece of content that Yue must judge carries one of three states: written, checked by script, read by a person. Only Yue, or a person Yue names, may set "read by a person"; a passing script check never counts as read. Reading is not a condition for publishing: published content that nobody has read is live, Yue reads it on the phone and a published card can be edited. Unreviewed generated plans are flagged in logs for sampling. | Should | READ-STATUS, PUBLISH-FIRST |
| FR-CONTENT-14 | All 26 stories carry the inputs the generator needs. Their cards are made ahead per story part and published before users see them. There are no fallback lines. Today all 26 Oppenheimer stories have a drafted scene table (`docs/demo/<story>.stage0.json`) and a published background card and part cards (version 1, `public.story_cards`, #293), none of them read by a person yet; no story has a stored closing line. | Must | SHARED-STORY, NO-FALLBACK-TABLES |
| FR-CONTENT-15 | The rule "every quotation must be in the source" applies to historical Companions only. A fictional Companion's notebook may invent freely but must stay consistent with that Companion's world record, which is stored with the Companion. | Must | FICTION-RULES |
| FR-CONTENT-16 | The closing line is made ahead with the story's cards, is published with them and is read by a person afterwards. | Must | CLOSING-AHEAD, PUBLISH-FIRST |

### 4.5 Home (FR-HOME)

| ID | Requirement | Priority | Decision |
|---|---|---|---|
| FR-HOME-1 | Home reads only the signed-in account. No fixture or sample data exists in any build a tester can reach, and empty sections are hidden, not filled with placeholders. | Must | |
| FR-HOME-2 | On a first visit Home shows one card with "Choose a companion" and no sample data. | Must | H6 |
| FR-HOME-3 | With a Run in progress, Home shows one card with his latest line (the last line he said in the user's most recent session, stored in that session's record; there are no separate status lines), one Continue button, a "Start something else" text link, and a menu with Put on hold and Mark done. | Must | HOME-LINE |
| FR-HOME-4 | However long the user has been away, Home keeps the Run in progress and shows the same card with Continue. There is no time limit on resuming and no time-based line or card on Home. | Must | T6 |
| FR-HOME-5 | The return pop-up (FR-FOCUS-11) is shown on the focus page, at most once per return, and never on Home. | Must | R1 |
| FR-HOME-6 | The return pop-up text is generated live by the language model and passes the never-say list in section 5. If generation fails, the failure message with Retry is shown (FAIL-SCREEN). | Must | R1, A6, NO-BACKUP |
| FR-HOME-7 | After the user finishes a Goal with nothing in progress, Home keeps a small trace of him: his portrait, his own closing line and one New session action. The finished Goal appears in Quick Replay (a list of recent Goals) automatically. It never resets to the first-visit card. | Should | H5 |
| FR-HOME-8 | After a long absence with nothing in progress Home shows the same state as after finishing, with no "welcome back". | Should | H7 |
| FR-HOME-9 | Start over restarts the Goal from Step 1 after a calm confirmation, and restarts his night, because his night has failed. | Should | T5 |
| FR-HOME-10 | Home shows no streaks, totals, percentages, progress bars, "away for" text or missed-item counts. | Must | Constitution |

### 4.6 Story presentation: cards and fate link (FR-STORY)

| ID | Requirement | Priority | Decision |
|---|---|---|---|
| FR-STORY-1 | Finishing a Step is the only event that moves the story. Nothing the user does inside a Step, including pausing, adds a story fact. | Must | Fate link |
| FR-STORY-2 | The first Step opens with the background card. The cards of all parts are spread across the user's Steps in story order, and the n story cards placed in a Step arrive one at a time while the user works. No card is ever dropped, and every Step gets at least one new card. With more Steps than parts, a part's cards are split across neighbouring Steps. There is no special "just finished" card at the start of a later Step. The prototype that shows four cards at the start is wrong. | Must | X2, T1, T9, CARDS-PER-PART, CARDS-SPREAD |
| FR-STORY-3 | Step 1 opens with the background card (FR-STORY-18); later Steps have no special opening card; the last Step's end feeds the summary and not a separate screen. | Must | CARDS-SPREAD |
| FR-STORY-4 | Cards form a stack. One card is visible, the newest is on top, swiping the top card left moves it aside and shows the one before, swiping right brings the newer card back, dots show position, and the Earlier card and Newer card buttons do the same as the gestures. | Must | X6 |
| FR-STORY-5 | In a Step of y minutes with n story cards, the n story cards arrive at y/n, 2y/n, ... y minutes of foreground time after the Step starts. More cards in a Step means closer together, fewer means further apart; no card is dropped. Pause and time in the background do not count. | Must | T1, CARDS-SPREAD |
| FR-STORY-6 | The view opens on the newest card and does not jump when a newer card arrives while the user reads an older one; nothing marks the new card except the dots. | Must | NF6 v6 |
| FR-STORY-7 | A card is immutable once shown, stored with an id, restored in the same order after a pause or after leaving, and never regenerated on re-reading. | Must | |
| FR-STORY-8 | Key-slice rule: key moments are must-use inputs when the cards are made ahead. ("A key slice ends a Step" is withdrawn, LEAK-BY-PART.) The summary lists no merged key moments (NO-MERGED-MOMENTS). The goal dialogue does not forbid few Steps. | Must | C2, T3, LEAK-BY-PART, NO-MERGED-MOMENTS |
| FR-STORY-9 | A card names nothing from the parts after its own part: the spoiler check runs when the cards are made and before publishing, against those later parts. This replaces "cards presuppose only what he could know where the Step starts", because parts can be split across Steps. | Must | LEAK-BY-PART, LEAK-BY-PART-ONLY |
| FR-STORY-10 | Later cards carry no short introduction phrases. The background card introduces the people who are present (FR-STORY-18). Names are not tappable. | Must | M2 |
| FR-STORY-11 | Cards arrive evenly through the Step; the last story card of a Step arrives when the clock reaches 00:00 and the next Step's first card is the story's next card at the start of that Step; there is no special "still at it" card. At 00:00 only the light vibration happens; the clock stays at 00:00 until Done, with no overdue wording. | Must | T8, CARDS-SPREAD, CARD-TIMING |
| FR-STORY-12 | Story cards are read from the published cards of the story. No fallback lines exist. If the published cards fail to load, the failure screen with Retry is shown and the clock does not start. If the closing line fails to load, the summary shows the failure screen with Retry (it has no clock). | Must | SHARED-STORY, FAIL-PREMADE, CLOSING-FAIL |
| FR-STORY-14 | Each card can be read alone, so a user can look back at it, with no "again", "another", "the same" and no opening with "He" or "It". A whole finished Step is reread in original order with a system line (story name and the user's Step name). | Should | D2; NF5-D7 (proposal) |
| FR-STORY-17 | ~~A bridge phrase may join merged key moments.~~ Withdrawn: the summary lists no merged key moments. | Could | C2, NO-MERGED-MOMENTS |
| FR-STORY-18 | When the user first enters the story, an extra background card is shown first, told in his own voice: who is here, where this is, and what each person knows. It is the one card with which Step 1 opens, is the oldest card in the stack and needs no dismiss button. It is not counted among the n story cards. It appears once at the start of the Goal, not at the start of every Step (to confirm, T1b). | Must | T4, T9, D3 |
| FR-STORY-19 | Cards are made ahead once per story part from the story's facts and key turning points (must-use facts). When the user starts, the app spreads the parts across the user's x Steps. Every card passes the checks (FR-CONTENT-10). | Must | SHARED-STORY, CARDS-PER-PART |

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
| FR-FOCUS-10 | Every Pause means his own story is blocked, and a new stuck story is generated each time. From the third Pause in one Step the stuck situation is much harder, and because he remembers the earlier setbacks he says he is worried he may fail. From the fourth Pause on, the same tone continues in new words. He never gives the user an instruction and never asks the user to stop pausing. This is a prompt change only (FR-REST-14). | Must | F1, PAUSE-3 |
| FR-FOCUS-11 | Leaving the app, locking the screen or taking a call freezes the clock. There is no time limit on resuming. A pop-up in his voice, saying what he did during that time and how he felt, appears before the clock restarts when the user taps Back to step on the rest page and when the user returns after being away 5 minutes or more, whether through the app, Home Continue or Goals Continue (the same rule everywhere); a shorter glance at another app resumes the clock with no pop-up. When the user taps the start button in the pop-up, the same Step resumes and the clock starts. This pop-up is the level 1 enforcement (F4). | Must | F2, T6, R1 |
| FR-FOCUS-12 | A setting "Keep the clock running when I leave" (off by default) computes elapsed time from timestamps on return and never shows a negative or count-up value. | Must | F2 |
| FR-FOCUS-13 | The return pop-up does not report on the user (no "you were away") and keeps the word Paused out of screen-reader text. | Should | F2 |
| FR-FOCUS-14 | A collapsible "Your steps" list shows titles only, marked done, now or to do, with no minutes; opening it does not pause the clock. | Should | |
| FR-FOCUS-15 | Tapping his portrait on the focus page opens the "Who I am" sheet, as in prototype v4 F1-C (code follow-up). | Should | PORTRAIT-SHEET |
| FR-FOCUS-16 | A single-step run uses the same page without "Step 1 of 1", marks or a Steps list; Done goes straight to the summary. | Must | |
| FR-FOCUS-17 | Signals: one light haptic at 00:00 where the device supports it; a new card is silent by default; the lock screen shows nothing by default; each is a setting. | Must | F5 |
| FR-FOCUS-18 | A lock-screen notification at 00:00 is available only when the user turns it on, and may then show the Step name and the line "Your time on this step is up". | Should | F5 |

### 4.8 Rest conversation (FR-REST)

| ID | Requirement | Priority | Decision |
|---|---|---|---|
| FR-REST-1 | Pause opens the rest page, where his first message, generated live, is about the snag his own story has hit and how he feels about it (a Pause means his side of the story has stalled). It arrives a moment after Pause. | Must | F1, C1 |
| FR-REST-2 | The message is generated live in two steps (a stuck story, then his description of the predicament and his feelings) inside his entry state and rules, 1 or 2 sentences and at most 30 words. Code chooses the snag category and the prop (AI_03 section A1). Call one (the stuck story) returns `{prop, story}`: the offered prop and the stuck story. Call two returns his words about the predicament and his feelings, which are the message he shows. Call two is plain text, not JSON, and there is no `why` or `back` field: he never urges (AI_03 section A4, owner decision 2026-11-21). If generation fails, the failure message with Retry is shown. Main makes one call with a 20-word limit: a code gap for the next batch. | Must | C1, LEN-PAUSE, NO-BACKUP, PAUSE-TWO-CALLS |
| FR-REST-3 | The rest page header offers ‹ Back to step (returns to the focus page through the return pop-up, and restarts the clock when the user taps its start button) and Home (leaves with the Step paused). He stays stuck on the rest page until the user taps Back to step. | Must | R1, Prototype v7 |
| FR-REST-4 | The user may type free text, with no limit on replies and no quick replies. The Companion answers briefly from his own side and in his own voice. | Must | A3 |
| FR-REST-5 | He may deflect gently but is not required to refuse. He may actually answer questions about the user's own work and general-knowledge questions from what he could plausibly know in his time, stays short and returns to his own situation. | Must | A3 |
| FR-REST-6 | When the user asks about something he could not know (modern methods, software), he answers exactly as a person of his own time would: he says what he knows, says plainly when he does not know, and may guess. A list of later-knowledge words stays as a check. | Must | A3, ERA-ANSWER |
| FR-REST-7 | Within one Step the same snag is never shown twice and consecutive messages differ in kind. | Must | |
| FR-REST-8 | An obstacle never adds an event, a named new person, a change of weather or place, or a fact after the user's position. It does not escalate in the first two Pauses of a Step; from the third Pause the stuck situation is much harder (FR-FOCUS-10). | Must | PAUSE-3 |
| FR-REST-9 | If asked whether he is an AI, the conversation never mentions it; disclosure lives only in the terms and settings. If counsel advises that a direct answer is required, a one-sentence system-voice answer is the fallback. | Must | A4 |
| FR-REST-10 | With no network the page shows the failure message in the app's own voice with Retry, never a stored line of his; the input is disabled and a plain system sentence explains why. Going back to the Step offline shows the failure screen with Retry. | Must | NO-BACKUP, FAIL-SCREEN, OFFLINE-RESUME |
| FR-REST-11 | The rest page shows no timer, no count of pauses, no "he has to go" after a number of replies and no avatar on every line. | Must | |
| FR-REST-12 | Cost is controlled by limiting the length of each message (at most 1000 characters; a longer message is shortened) and the context sent (the last 6 turns). There is no cap on the number of messages and no hidden cap. | Should | R2 |
| FR-REST-13 | Free text on this page is the only place where the Companion replies to user words; all replies pass the safety input and output checks. | Must | A5 |
| FR-REST-14 | Every Pause opens the same conversation. The prompt receives the number of the Pause in the Step; the third Pause and later use the stronger rules in FR-FOCUS-10. No new screen is added. | Must | F1, PAUSE-3 |
| FR-REST-15 | Every reply passes the same spoiler check as the story cards, against the parts the user has not reached; a failing reply is generated again within the time limit. A reply may end with a question (CHAT-QUESTION-END, confirmed 2026-11-17). Replies are not checked against the per-run list of earlier one-way lines. A later word that the user typed himself does not fail a reply (CHAT-USER-WORD). A reply carries no label for the user's message; the prompt holds the feelings rule (one line of his own, no advice) and ends on his own situation (CHAT-NO-LABEL). | Must | CHAT-SPOILER-CHECK, CHAT-QUESTION-END, CHAT-NO-RUN-LIST, CHAT-USER-WORD, CHAT-NO-LABEL |

### 4.9 Summary (FR-END)

| ID | Requirement | Priority | Decision |
|---|---|---|---|
| FR-END-1 | Finishing the last Step opens one summary screen with his closing line, one thing he is carrying (his own hanging concern), the user's finished Steps as a plain list, the record, and Next and Home. The stored carry line is not fixed and waits for Yue's inner-thoughts framework; today (main) the carry line is written with the closing line. | Must | STORY-LINES-LATER |
| FR-END-2 | The summary shows no percentage, badge, score or "3 of 3" and never auto-advances. The record shows only the plan length and the focus time, with no verdict. | Must | SUMMARY-RECORD |
| FR-END-3 | The closing line (1 to 3 first-person sentences, at most 45 words) is made ahead once per story with the story's cards, published with them and read by a person afterwards (FR-CONTENT-16, PUBLISH-FIRST). The summary shows the published line with the list and the carried concern. There is no fallback line. | Must | CLOSING-AHEAD, LEN-CARD, NO-FALLBACK-TABLES |
| FR-END-4 | The closing line tells what happened to him that day and how he feels about it. It receives no user text and no Step names, does not count the user's pauses, does not judge the user, never gives a lesson or praise and never mentions minutes. | Must | END-TONE |
| FR-END-5 | ~~When Steps were merged, the summary lists the covered key moments.~~ Withdrawn: the summary lists no merged key moments. | Must | C2, M3, NO-MERGED-MOMENTS |
| FR-END-6 | After the last story on the path, Next is replaced by the end-of-path line (pending: its prompt is designed later). | Should | END-LINE-PENDING |

### 4.10 Me and settings (FR-ME)

| ID | Requirement | Priority | Decision |
|---|---|---|---|
| FR-ME-1 | Me shows account basics (name, email, sign out), Appearance (Day, Night, System), Country (for help lines, ME-REGION), an About page, Your data (including account deletion) and History. | Must | S1, S3, SAFETY-REGION |
| FR-ME-2 | A setting exists only when people differ by context in a way the product does not infer and a wrong default is annoying, not harmful. Where a wrong default could harm, the setting has no default: the product shows what is safe without it and asks the user to choose (the Country for help lines, SAFETY-REGION). A setting that changes what the product is does not belong in Me. | Should | G3 (proposal), SAFETY-REGION |
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
| FR-AI-1 | Every model-written output passes the shared pipeline: parse, clean, rule checks, with a log that never contains raw user text. A live output that fails is generated again within the time limit; if it still fails, the failure message with Retry is shown and no stored text is substituted. Made-ahead content that fails cannot be published. | Must | NO-BACKUP, FAIL-SCREEN, SHARED-STORY |
| FR-AI-2 | There are no separate status lines (HOME-LINE). Story cards, the background card and the closing line are made ahead once per story and shared (FR-STORY-19). Only the pause message, the rest conversation, the return pop-up and the goal split are generated live. | Must | SHARED-STORY, HOME-LINE |
| FR-AI-3 | Live model calls exist for: goal split (the planning prompt), the pause message (two calls), the return pop-up, rest chat, and the safety classifier. The Goal's shape is decided by a local rule in version 1, with no model call; a model call may be added later. Prompts for making stories ahead write the story cards, the background card and the closing line. | Must | SHARED-STORY, CLOSING-AHEAD, GOAL-SHAPE-LOCAL, PAUSE-TWO-CALLS |
| FR-AI-4 | No stored or pre-written text stands in for a failed or slow live message. When a live call still fails after retrying within the time limit, the app shows one calm message in its own voice with a Retry button, and the step clock does not start while it is shown. | Must | NO-BACKUP, FAIL-SCREEN |
| FR-AI-5 | The goal text is sent to the model only for the split (and to the safety classifier); its shape is decided locally (GOAL-SHAPE-LOCAL). The Companion's goal-dialogue lines are authored fixed lines picked from written lists (APP-TEXT), not stored text under NO-BACKUP. | Must | NF7 D-G2, FIXED-LINES, GOAL-SHAPE-LOCAL |
| FR-AI-6 | The model calls for the pause message, the return pop-up and the closing line never receive the user's Goal text or Step names. The prompts that make story cards ahead receive the story's facts and key turning points and the part, never user text and never an exact date; every output is checked, when made and before publishing, so that no card carries a fact from the parts after its own part (LEAK-BY-PART). | Must | SHARED-STORY, DATES-ADMIN-ONLY |
| FR-AI-7 | Model input treats user text as data, not instructions; output must match the schema or it fails. | Must | |
| FR-AI-9 | Latency targets, as hypotheses: the Goal's shape is decided locally with no wait (GOAL-SHAPE-LOCAL); split at most 5 seconds with a 10-second hard timeout; first rest reply starts within about 3 seconds; the return pop-up text is ready within about 1 second of Back; otherwise the user waits up to the time limit and then sees the failure message. | Should | FAIL-SCREEN, TIME-LIMIT (open) |
| FR-AI-10 | Before release an offline real-model run is made for story cards, pause messages and rest chat, because no document reports any run against a live model yet. | Must | |
| FR-AI-11 | Every prompt is built from four parts: the shared base, the historical or fictional rules, the Companion, and the story. Each part has its own version, and every generated card and live message records the prompt version that wrote it. | Must | PROMPT-PARTS |

### 4.12 Safety (FR-SAFETY)

| ID | Requirement | Priority | Decision |
|---|---|---|---|
| FR-SAFETY-1 | The first demo ships two safety tiers: crisis, with a classifier and real help lines by region, and everyday stress. The low-mood tier is deferred. | Must | A5, A5b |
| FR-SAFETY-2 | Every free-text field passes the input check before any model or storage for model use: goal input, Step and Goal rename, Add a Step, rest chat, and the nickname. | Must | A5 |
| FR-SAFETY-3 | Tier 3 (crisis) shows a system-voice page outside the story, discards the text, never sends it to the reply model, offers regional resources and always allows going back. Text the keyword layer flags is sent to no model at all; all other free text also goes to the provider for the safety classifier, before any reply or save (owner decision of 2026-11-22). | Must | A5, SAFETY-PROVIDER |
| FR-SAFETY-5 | Tier 1 (everyday stress) passes and he answers in character without advice. | Must | A5 |
| FR-SAFETY-6 | A keyword layer runs in code in every case; a classifier call, before the reply call or any save, sees the message and the last two messages in the same field; the higher tier wins and an unsure answer is a crisis; if the classifier fails or takes over 1.5 seconds the keyword layer decides alone and a webhook alarm is sent at most once a day. | Must | A5, SAFETY-CHECK-FIRST, SAFETY-TIERS-2, SAFETY-ALARM |
| FR-SAFETY-7 | Targets (guesses to be set with compliance): crisis recall at least 99%, crisis false positives at most 2%. | Should | A5 |
| FR-SAFETY-8 | English test sets exist before release, written with a clinical adviser, and are re-run on every model or keyword change. | Must | A5, L1 |
| FR-SAFETY-9 | Legal and clinical review approves the wording of every safety message and the hotline list; the log rule for what is stored is settled. | Must | A5 |
| FR-SAFETY-10 | The Companion never mentions, knows about or reacts to the safety layer. | Must | |
| FR-SAFETY-11 | The app never claims to be a therapist, tutor or coach, and never infers mood for adapting content. | Must | H3 |
| FR-SAFETY-12 | Model output also passes the output guard: the shared checks (FR-AI-1), including the style checks. There is no word list of method or instruction words. Pre-made content gets only the banned style words before publishing, the same as the admin save check (no further AI-6 line rules). | Must | SAFETY-PREMADE, NO-DENYLIST |
| FR-SAFETY-13 | S1 offers help for the country the user chose under Me, Country; the app never reads a location and has no default country. With no country chosen, S1 shows the international directory link (Find A Helpline), the labelled line "If you are in the United States: call or text 988" and a "Choose your country" link to Me; with a chosen country that has an entry, that entry; with one that has none, the directory. The directory link is always shown, as a text link. The country is stored on the account with a copy on the phone, and is in the data export. | Must | SAFETY-REGION, SAFETY-REGION-STORE, SAFETY-DIRECTORY |
| FR-SAFETY-14 | The hotline list is edited in the admin (draft, Publish, restore, Publish history) by the admin role and owned by the product owner; each entry records when it was last checked and by whom, and every entry is checked at least every 6 months and before each release. The only starting entry is the United States (988). When no country is known or neither the phone copy nor the database can be read, a copy of the S1-0 content written in the code is shown (the directory link and the labelled line "If you are in the United States: call or text 988"; the "Choose your country" link is left out when offline), never an unlabelled US entry. | Must | HOTLINES |

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
2. **Steps and story.** The app spreads the story's parts over the user's Steps with plain code and no model call (CARDS-PER-PART). The number and length of Steps are free, with no maximum, and his goal mirrors the user's: x Steps of y minutes each (T1, T2).
3. **Key slices.** Each story has two to four key slices, which are must-use inputs when the cards are made ahead. When there are fewer Steps than key slices, several key moments fall in one Step; the summary lists no merged key moments and no key lines (FR-END-5, NO-MERGED-MOMENTS).
4. **Cards appear one at a time.** A Goal opens with one background card in his voice, which is the opening card of Step 1. The cards of all parts are spread across the Steps in story order; no card is dropped, every Step gets at least one new card, and a Step's n cards arrive at y/n, 2y/n, ... y minutes (CARDS-SPREAD). The stack is looked through with a left swipe or the Earlier card and Newer card buttons, and nothing marks scenes or Steps on cards or on the map.
5. **Done is always allowed and undoable.** It never asks a question, it works in the paused view, and every Done has a short Undo.
6. **Pause has no limit.** No warning screen, no count, no timer reset, no pop-up. Every Pause blocks his own story; from the third pause in a Step the stuck situation is much harder and he says he is worried he may fail, never telling the user what to do. That is a prompt change only (F1, PAUSE-3).
7. **The clock freezes when the user leaves.** Only foreground time counts. There is no time limit on resuming; before the clock restarts, a pop-up in his voice appears after Back to step on the rest page or after 5 minutes or more away, and the user taps a start button (R1). An optional setting keeps the clock running. Minutes are a target: at 00:00 the clock holds and nothing is overdue.
8. **Automatic start after a 1.2-second hold.** After Done, the next Step starts by itself and Done is greyed during the hold (X3).
9. **Vocabulary is Companion, Goal and Step.** No other words are used for the user's work in the interface or in documents (X1).
10. **Step descriptions.** Each Step has a short description generated with the plan and shown read-only on the focus page (X4).
11. **Entry at chapter 1.** New users start at the first chapter of the path. There is no designated entry story (M1).
12. **Introductions live in the background card.** The background card, told in his voice, introduces the people present. Later cards carry no introduction phrases, names are not tappable and there is no "what you need to know" screen (M2).
13. **Safety has two tiers in the first demo.** Crisis, with a classifier and regional help lines, and everyday stress. Low mood is deferred (A5, A5b).
14. **He never knows the future.** Every line presupposes only what he could know at his point in the story. His lines contain no later fact, no clock time or duration, no year, date or age (DATES-ADMIN-ONLY), no number of Steps (NO-STEP-COUNT), no "you" in one-way lines, no question in one-way lines, no hook, no praise and no advice.
15. **Nothing implies guilt at the edges.** No line states how long the user was away (in the return pop-up he may say how the time felt in his own words, but exact clock numbers stay out until decided; TIME-WORDS, CLOCK-NUMBERS), blames them for leaving, or welcomes them back on Home (H7). There is no rule about whether he waits (H8); the AI writes freely.
16. **One-way lines versus conversation.** His one-way lines (cards, return pop-up, closing line) are allowed outside the rest page. The only place where he replies to the user's words is the rest page, plus the goal dialogue before a Run begins.
17. **No counts and no scores.** Nothing the user sees can go down, needs a target, names a gap or compares. Pause counts, early Done and undo counts are never shown.
18. **Undo instead of confirm.** Status changes apply immediately with an Undo toast; no "Are you sure?" dialogs. The only confirmations are for Start over and for sign-out and deletion flows.
19. **No backup text.** No stored or pre-written text stands in for a failed or slow live message. If a live call still fails within the time limit, or pre-made cards or the closing line fail to load, the app shows one calm message in its own voice with Retry, and the clock does not start (NO-BACKUP, FAIL-SCREEN, FAIL-PREMADE). His goal-dialogue lines picked from written lists are authored fixed lines, not stored text (FIXED-LINES). The app's own interface words have a default written in the code (APP-TEXT); that is interface text, not story text.
20. **One main action per screen.**
21. **Source labels are backend only.** Historical, inferred and invented content is marked in the backend and never on a screen.
22. **The clock comes from timestamps.** No feature depends on a script timer running in the background.

---

## 6. AI behaviour summary

Detail lives in `docs/ai/`: the prompts (`docs/ai/prompts/`, read from the database), schemas, check rules and evaluation cases. There are no fallback pools (NO-BACKUP, NO-FALLBACK-TABLES). This section is the product-level summary. No live-model run has been made against any of these specifications yet, so every prompt and number below is a hypothesis.

### 6.1 Calls and failure behaviour

Only the goal dialogue calls, the pause message, the return pop-up and the rest conversation run live. The background card, the story cards and the closing line are made ahead once per story and published, then read by a person afterwards (SHARED-STORY, CLOSING-AHEAD, PUBLISH-FIRST). A live call that still fails within the time limit shows the failure message with Retry (FAIL-SCREEN).

| Call | Purpose | Input | Runs when | On failure |
|---|---|---|---|---|
| Goal shape (no model call in version 1) | One word: specific, big, vague, unknown, decided by the local rule `classifyGoalShape` (GOAL-SHAPE-LOCAL); a model call may be added later | Goal text | After the Goal is entered | "unknown", authored confirmation line |
| Goal split | Steps with titles, descriptions and minutes, from the AI planning prompt (PLAN-PROMPT) | Goal text, minutes, the answer to the split question | Time chosen or "Just split it" | Retry once, then the failure screen with a one-step option; never silent generic Steps |
| Story cards (made ahead) | The story cards of each story part, plus the background card | Story facts, key turning points, the part; never an exact date | Once per story, before publishing | Cannot be published; if published cards fail to load at run time, the failure screen with Retry (FAIL-PREMADE) |
| Pause message, part 1 | The stuck story: the snag in his own story | Entry state, pause number, rules, the Story's scene table (SCENE-PER-STORY), the category and prop chosen by code (PAUSE-TWO-CALLS) | Pause | Failure message with Retry |
| Pause message, part 2 | His description of the predicament and his feelings, shown as his first message (1 or 2 sentences, at most 30 words, LEN-PAUSE) | Part 1 output, pause number | Pause | Failure message with Retry |
| Return pop-up | What he did during the time and how he felt (1 or 2 sentences, at most 30 words, LEN-RETURN), in any words for how the time felt (TIME-WORDS), ending with a start button | Entry state, return case (Back to step, or away 5 minutes or more) | Back to step; return after 5 minutes or more | Failure message with Retry; the clock does not start |
| Rest chat | His reply | Obstacle, entry state, last turns | Each user message | Generated again within the time limit, then the failure message with Retry |
| Closing line (made ahead) | One to three sentences, at most 45 words, in his voice: what happened to him that day and how he feels (END-TONE) | The story's facts | Once per story, with its cards | Cannot be published |
| Safety classifier | Tier label: crisis, stress, none or unsure (SAFETY-TIERS-2) | Message plus last two messages in the same field | Every free-text submission with a server-side check, including the display name, before the reply call or the save (SAFETY-CHECK-FIRST, SAFETY-FIELDS, SAFETY-FIELDS-NAME) | Keyword layer alone, error log line and the once-a-day webhook alarm (SAFETY-ALARM) |

There are no status lines on the focus page (HOME-LINE).

### 6.2 Checks

Every model-written line passes the same pipeline: parse, clean, rules. A live line that fails is generated again within the time limit, then the failure message is shown; a made-ahead line that fails cannot be published; made-ahead content also passes the banned style words check, and no further AI-6 line rules, before publishing (SAFETY-PREMADE). The rules cover length, language, dash, banned words, clock times and durations, backstage words ("step", "timer", "app"), advising, invented people (only allowed names), later knowledge, blaming, no question, no "you", no hook, no praise, no exclamation marks, a full stop at the end and no use of his own name. Obstacles also pass checks against new events, escalation and repeats. The advising rule over-blocks most and needs tuning.

### 6.3 Decisions that shape AI behaviour

- The return pop-up is generated live (R1, A6). There is no authored fallback set (NO-BACKUP).
- Pause messages and the Companion's described predicament are generated live in two calls (C1, PAUSE-3, PAUSE-TWO-CALLS). Authored snag lines are reference examples and evaluation material only; the story database supplies generator inputs.
- Rest chat has no hard refusal rule and no "never explain" rule (A3). He answers as a person of his own time would and may guess (ERA-ANSWER). Every reply passes the spoiler check (CHAT-SPOILER-CHECK).
- The Companion is never described as an AI inside the conversation (A4); see section 7 for the legal risk.
- Safety has two tiers in the first demo (A5, A5b).
- Goal text goes to the model only for the split; its shape is decided by a local rule (GOAL-SHAPE-LOCAL); his goal-dialogue lines are authored.
- Story cards are made ahead once per story part from the story's facts and key turning points, published and shared by all users, and read by a person afterwards (PUBLISH-FIRST); there are no fallback cards (SHARED-STORY, CARDS-PER-PART, NO-FALLBACK-TABLES). Tone rules and the three small turns of feeling per Step live in the prompts, not in the product requirements (D2).

### 6.4 Estimated calls per session

Story cards, the background card and the closing line add no call per session, because they are made ahead (SHARED-STORY). A session makes the goal dialogue calls, one pause message per Pause, one rest reply per user message and one return pop-up per return. The total per session is not estimated.

---

## 7. Data and privacy

1. **Storage.** Goal titles, Step text and run data live on the server, tied to the account in Supabase (S3). This closes the question of local-only storage and makes cross-device history possible.
2. **Language model.** Goal text is sent to a language model for splitting; its shape is decided by a local rule (GOAL-SHAPE-LOCAL). Rest chat messages are also sent. The closing line and the card lines receive no user text. About states this plainly. The earlier promise that goal text is "not kept beyond the session" no longer holds because the product stores Goals. Whether the chosen provider retains or trains on this data is not settled (open, A7b).
3. **Analytics.** Events record shapes, buckets and counts, never titles, Step text or messages.
4. **Safety logs.** The proposal is to log position, tier, which layer fired and the user's action, and not the raw text, with 90-day retention (a guess). Open: whether sampled text is kept with consent.
5. **Account deletion.** Required, with a clear privacy notice (S3).
6. **Region.** Real help lines depend on region. Decided 2026-11-23 (SAFETY-REGION, SAFETY-REGION-STORE): the user chooses a country under Me; the app never reads a location and has no default country. The country is stored on the account, with a copy on the phone, and is included in the data export.
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

Targets are hypotheses: time from opening the app to a started Step as short as possible with at most two taps for returning users; first rest reply within about 3 seconds at the median and 6 seconds at the 95th percentile; the closing line is made ahead and needs no wait (CLOSING-AHEAD); safety added no more than about 1 second in parallel.

### 8.3 Platform

- The product is a progressive web app (PWA, a website installable to the home screen), built with Next.js, TypeScript, Supabase and Vercel. Mobile first; desktop later.
- Haptics and push notifications on iPhone depend on installation to the home screen and on what iOS web supports. The product owner tested vibration, notifications and the clock on a real iPhone and Android phone on 2026-11-24 (S2 resolved, #153). That test covered what the phones can do; how a time-up notification reaches a locked screen is still for the owner to decide (#116). The Signals settings stay capability-gated: nothing happens on a device that lacks the feature.
- The clock is computed from timestamps because a page's timers stop when the screen locks.
- The interface is English only.

### 8.4 Reliability

When a live call fails or the network is lost, the app shows one calm message in its own voice with Retry and the clock does not start; no stored story text is substituted (NO-BACKUP, FAIL-SCREEN). Story cards are read from published content; if it fails to load, the failure screen with Retry is shown (FAIL-PREMADE). Card text is stored and restored after a restart.

---

## 9. Success measures

Measurement will be designed later. No success measures or north star are set for release 1 (N1).

---

## 10. Open decisions and risks

### 10.1 Decided rows that changed this document

Every decided row in `docs/DECISIONS.md`, up to 2026-11-17, is applied in sections 3 to 8 (issues #295 and #298). The decisions of 2026-11-21 are applied in issue #369. Where this document and that file disagree, that file wins.

### 10.2 Open decisions, copied from the decision log

| Id | Question | Note |
|---|---|---|
| A7b | Provider data retention terms. | Not decided. |
| M5, M6 | Original test data (issues B15 and B17, the definition of "low preference"). | May be skipped. |
| TIME-LIMIT | The length of the waiting time limit for live generation and the wording of the failure message (FAIL-SCREEN). | Set by testing. |
| CLOCK-NUMBERS | Whether the return pop-up may use exact clock numbers (TIME-WORDS). | Kept out until decided. |
| KEY-REVIEW | The review of the machine-derived key moments (KEY-MOMENTS-DRAFT). | Stored unconfirmed. |
| PERIOD-NAMES | The named periods of each character's Life Path (PERIODS). | Drafted for Yue to approve. |
| MORIARTY-READ | Yue's reading of the 31 cards of Moriarty story 1 (MORIARTY-6). | Stories 2 to 7 wait for it. |

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
| 2 | Master PRD F-SA-4 says goal text is also used for the dialogue responses; the later goal-dialogue spec limits it to classification and split. This document follows the later one; since GOAL-SHAPE-LOCAL the shape is decided by a local rule, so goal text goes to one model call, the split. | Confirm |

Risks that remain:
- **The magic may not carry over to English or to Oppenheimer.** Only characters from the founder's own culture were validated (constitution section 5).
- **Chapter 1 is lower stakes.** Starting at chapter 1 (M1) delays the first climactic scene, and the authored content for it does not exist.
- **Story fatigue.** The number of stories that can carry a user is unmeasured.
- **Over-planning and pause avoidance.** Neither is policed.
- **Generation without a track record.** Pause messages, rest replies and return pop-ups are generated live, and story cards and closing lines are made ahead, all by models that have not been run against the checks. Made-ahead content is published first and read by a person afterwards, on the phone (PUBLISH-FIRST); until then only the automatic checks have judged it.
- **Guilt language at the edges.** Return pop-ups and farewell lines are the highest-risk copy.
- **Regulation.** Companion-chatbot disclosure, mental-health limits and minors need counsel.
- **Content volume.** All 26 stories are playable (D4). Each story's cards and closing line are made ahead per part, published, and read by a person afterwards, so the work per story is the facts, key turning points, scene table and checks, plus reading every published card (SHARED-STORY, PUBLISH-FIRST).

### 10.5 Later and pending

These wait until version 1 is done, or wait for a prompt still to be designed. They are listed in `docs/DECISIONS.md` section 4.

| Item | Status |
|---|---|
| Chat rules for rest chat, a limit after round 10, and free chat | Later: #337 |
| Adding a Companion from a novel through staged, reusable prompts, then in batch | Later: #339 |
| His one line after the final Story (FR-MAP-11, FR-END-6). It must exist; its prompt is designed later. | Pending (END-LINE-PENDING, #52) |
| A long-term chat with a Companion, unlocked when the user has finished all of that Companion's Stories | Pending (END-LINE-PENDING) |

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

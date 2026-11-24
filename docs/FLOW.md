# WaveParticle: screens and jump rules

This document is the single list of screens in the WaveParticle mobile web app and the rules for moving between them. It covers what each screen is for, what it shows, what the user can do, where each action leads, what the system back gesture does, and how the screen behaves when it is empty, loading, failing or offline. It also states the global rules: the launch router, the tab bar, away and return, the return pop-up, how Pause, Back and Home relate, how Done moves to the next step on the same page, the undo after Done, and the hold of 1.2 seconds.

Status: draft, written on 2026-11-05 from the design documents of 2026-10-29 to 2026-11-04. Where an older document and a later decision disagree, the decision recorded in `DECISIONS.md` wins. This file was brought in line with the decisions up to 2026-11-15 and with prototype version 4 of the goal dialogue and focus page (pull request #273) in issue #295. Questions that no decision settles are collected at the end under "Open questions".

## 1. Product vocabulary

The user works on a **Goal** that is split into **Steps**. A character, called a **Companion**, lives a parallel story that appears as **story cards**. The first Companion is J. Robert Oppenheimer. The user's work is always called a Goal and its Steps, in the interface and in documents.

Some screen names below name a state of a page rather than a separate page. For example, F1-N is the focus page in the first moment after a Step is done. Such states are marked "state of F1" and share the same route as the page.

## 2. Screen registry at a glance

| Id | Name | Group |
|---|---|---|
| HOME-0 | Home, first visit | Home (tab) |
| HOME-1 | Home, Goal in progress, up to 3 days since last activity | Home (tab) |
| HOME-3 | Home, welcome back after more than 3 days | Home (tab) |
| HOME-3B | Start over, confirmation | Home (sheet) |
| HOME-MENU | Goal options menu on the Home card | Home (sheet) |
| COMP | Companions | Companions (tab) |
| CPAGE | Oppenheimer, Life Path | Companions (child page) |
| CPAGE-S | A Companion with one story | Companions (child page) |
| GD1 | Goal dialogue, opening | Goal dialogue |
| GD2 | Goal dialogue, he reacts and asks how long | Goal dialogue |
| GD3 | Goal dialogue, split it finer | Goal dialogue |
| GD4 | Goal dialogue, the plan | Goal dialogue |
| GD-F | Goal dialogue, the split failed | Goal dialogue |
| GD-N1 | Goal dialogue, a one-Step plan | Goal dialogue |
| F1 | Focus | Session |
| F1S | Focus, single Step | Session |
| F1-E | Focus, looking at an earlier card | Session (state of F1) |
| F1-YOU | Focus, your Steps open | Session (state of F1) |
| F1-C | Focus, "Where I am now" | Session (sheet over F1) |
| F1-N | Focus, first frame of the next Step | Session (state of F1) |
| F-RET | Return pop-up | Session (modal over F1) |
| F2 | Focus, timer at 00:00 | Session (state of F1) |
| F3 | Focus, cards failed to load | Session (state of F1) |
| R1 | Rest, he writes first | Session |
| R1-C | Rest, you answered (chatting) | Session (state of R1) |
| R-OFF | Rest, no network | Session (state of R1) |
| S1 | Safety | System |
| S1-0 | Safety, no country chosen | System (state of S1) |
| S1-E | Safety, an entry for the chosen country | System (state of S1) |
| S1-N | Safety, no entry for the chosen country | System (state of S1) |
| END | Summary | Session |
| ME | Me | Me (tab) |
| ME-CAL | Me, history open | Me (state of ME) |
| ME-REC | Session record | Me (child page) |
| ME-REGION | Country for help lines | Me (child page) |
| G1 | Goals, in progress | Goals (tab) |
| G2b | Goal menu | Goals (sheet) |
| G3 | New goal | Goals (sheet) |
| G4 | Goal detail, with an open Step plan | Goals (child page) |
| G4-N | Goal detail, nothing open | Goals (child page) |
| G4-H | Goal detail, on hold | Goals (child page) |
| G5 | Goals, on hold | Goals (tab) |
| G5-D | Goals, done | Goals (tab) |
| G6 | Goals, history | Goals (tab) |
| ADM-14 | Hotlines, the list | Content admin (desktop, ADMIN-DESKTOP) |
| ADM-15 | Hotline entry | Content admin (desktop, ADMIN-DESKTOP) |

## 3. Global rules

### 3.1 Principles

1. Leaving the app does not change the state of the user's work. The launch router in section 3.3 decides where a reopened app lands, however long the user was away.
2. There are no dead ends. Every screen has a clear exit, and no screen can be left only by closing the app.
3. At most one overlay is open at a time. A sheet never opens on top of another sheet.
4. Screens inside a flow (goal dialogue, focus, rest, safety, summary, goal detail) are full screen and have no tab bar.
5. Going back, failing, or closing a sheet never destroys what the user has typed. The only exception is text that triggered the safety screen (S1), which is discarded.
6. The product never shows counts or labels that read as a verdict: no streaks, no "N of M", no totals of Steps, no "abandoned" or "partial", no red marks, no "you were away for". The number of pauses, early Done presses and undo presses are logged silently and never shown.
7. His words are one-way everywhere except the rest page and the goal dialogue. On the focus page he never asks a question and never speaks to the user. The return pop-up (F-RET) is one-way too: it never asks a question.
8. "Step x of N" appears only on the focus page, and not at all for a single Step. Home, Goals, the Life Path, History, the session record and the summary show no total number of Steps. There is no maximum number of Steps.
9. The minutes of a Step are a target, not a limit. At 00:00 the clock stays at 00:00 and never counts up. Only the Done button ends a Step. No message about running over time exists.

### 3.2 Tab bar

The tab bar has four items: **Home**, **Goals**, **Companions**, **Me**. It appears where prototype version 4 shows it (decided by Yue on 2026-11-13): the Home states, G1, G5, G5-D and G6, COMP, CPAGE (the Life Path, also CPAGE-M), CPAGE-S, ME, the Signals sub-page, ME-CAL, and the session record ME-REC. It does not appear on the sign-in and account pages, on account deletion, on goal detail pages (G4), in the goal dialogue, on the focus or rest pages, on S1, or on END. Sheets sit over a page and keep it and its tab bar visible but inactive. The per-screen table read from the prototype is in `docs/superpowers/specs/2026-11-12-shared-v4-styles-design.md` ("Where the tab bar shows").

The last tab used inside Goals (in progress, on hold, done, history) is remembered. Tab items carry no badges and no counts.

### 3.3 Launch router

Every time the app opens, it decides the first screen as follows. "Last activity" is the time of the last Done, Pause, Back, a message sent on the rest page, or a tap on Continue or Start in the return pop-up. Opening the app or switching tabs does not count. The moment the app goes to the background is also recorded as last activity.

1. **The user is not signed in.** An account is required from the first open, so sign-in and sign-up come first (not part of this screen set; see Open questions, item 13).
2. **No Goal was ever started on this account.** The app opens on HOME-0.
3. **A Goal is in progress, the last screen was inside a flow, and the user did not leave through Home or Back to Home.** There is no time limit: resuming is always possible, however long the user was away.
   - If the last screen was the focus page (F1 or F1S): open it with the clock frozen where it stopped. If the user was away 5 minutes or more, F-RET opens over it and the clock restarts when the user taps Start. If the user was away less than 5 minutes, the clock resumes with no pop-up.
   - If the last screen was the rest page (R1, R1-C or R-OFF): open it again exactly as it was, with the conversation and any unsent draft. No new first message arrives.
   - If the last screen was in the goal dialogue (GD1 to GD4, GD-F, GD-N1): open it again with the conversation and chosen answers kept. The dialogue creates no Goal; the Goal is created only when the user presses Start on GD4 or GD-N1.
   - A sheet is never restored. The app opens the screen under the sheet.
4. **Otherwise** (the user left through the Home link or system back on the rest page, or the last screen was not inside a flow): open a Home state chosen by the time since last activity.
   - Up to 3 days: HOME-1.
   - More than 3 days: HOME-3.
   - These time bands are calculated only when the router lands on Home. They are not used when a flow screen is restored.
5. **No Goal in progress but the account has history.** Home is shown with a small trace of the Companion and no welcome back (Open questions, item 4).
6. If several Goals are in progress, Home offers only the one with the most recent activity. The others are in Goals. Home never says "N more".

### 3.4 Away and return

- **Leaving the app freezes the clock.** Switching to another app, locking the screen or taking a call freezes the Step clock. Only time in the foreground counts, and the cards also count foreground time. Leaving is not "quitting": it may only be a phone call.
- **Setting "Keep the clock running when I leave"** (decided; off by default; on the Signals sub-page of Me). When on, the clock is computed from timestamps on return, never shows a negative or counting-up value, and the cards still count foreground time only.
- **Return after 5 minutes or more.** The user sees the focus page with F-RET over it (section 3.5). A shorter glance at another app resumes the clock with no pop-up.
- **No time limit on resuming.** However long the user was away, the Step stays exactly where it was and can be resumed. Nothing is recorded as late, lapsed or missed, and nothing is shown about it.
- **If the user leaves right after Done**, the hold of 1.2 seconds has not finished. The new Step counts as not started: the clock shows the full target, and it starts when the hold completes (under 5 minutes away) or when the user taps Start in F-RET (5 minutes or more).
- **Leaving through Home.** If the user leaves the rest page through Home, or leaves F-RET through system back, the Step stays paused. Continue on Home or on Goals follows the same return rule as every other return: F-RET opens if the user was away 5 minutes or more, or came from Back to step; otherwise the clock resumes with no pop-up.

### 3.5 The return pop-up (F-RET)

When the user comes back to a Step whose clock is stopped, a pop-up in the Companion's voice appears before the clock restarts. It says what he did during that time and how he felt. It is generated live by the AI. No stored line stands in when generation fails or is too slow (NO-BACKUP); the failure message with Retry is shown instead and the clock does not start (FAIL-SCREEN). It has one button, **Start**. When the user taps Start, the Step resumes and the clock starts.

It appears in these cases:

- the user taps **‹ Back to step** on the rest page;
- the user returns to the app after being away for 5 minutes or more;
- the user taps Continue on Home or on Goals and was away 5 minutes or more (the same rule as for any other return).

It never appears for a glance at another app of under 5 minutes. It replaces the return line on the card stack and the separate away card. It does not state how long the user was away, never says "you", and never asks a question.

### 3.6 Pause, Back and Home

| Control | Where | What it does |
|---|---|---|
| **Pause** | F1, F1S, and in the hold of F1-N | Freezes the Step clock and opens the rest page R1. It is the only way into the rest page. There is no "Take a break" after a Step. Pause has no limit. |
| **‹ Back to step** (header, left) | R1, R1-C, R-OFF | Returns to the focus page through F-RET. The clock stays frozen until the user taps Start in F-RET. |
| **Home** (small text link, header, right) | R1, R1-C, R-OFF | Leaves to Home. The Step stays paused. |
| **System back** | R1, R1-C, R-OFF | Same as Home. If the keyboard is open, the first press closes the keyboard and the next press leaves to Home. |
| **Continue** (on Home) | HOME-1, HOME-3 | Opens the focus page at the same Step. F-RET opens over it if the user was away 5 minutes or more, or after Back to step; the clock restarts at Start. Goals Continue follows the same rule. |
| **Start** | F-RET | Closes the pop-up and starts the clock from the frozen value. |

Pause has no limit, no counter, no warning screen, no pop-up and no penalty. The clock is never reset by pausing. Every Pause opens the same rest page: his first message is generated live by the AI, about the snag his own work has hit and how he feels about it, because a Pause means his side of the story has stalled. The prompt receives the number of the pause. Every Pause means his own story is blocked, and a new stuck story is generated each time. From the third Pause in one Step the stuck situation is much harder, and because he remembers the earlier setbacks he says he is worried he may fail. The message is never an instruction to the user and never asks the user to stop pausing (PAUSE-3). It is 1 or 2 sentences and at most 30 words (LEN-PAUSE). From the fourth Pause on, the same strong tone continues in new words each time. Nothing else changes: it is the same screen, and the stuck state lasts until the user returns to the Step. He does not write again on his own while the user is silent.

### 3.7 Done moves to the next Step on the same page

There is no landing page and no "Next step" button. Pressing **Done** on a Step that is not the last one:

1. Changes the page in place with a cross-fade of about 200 milliseconds (an instant swap when the user prefers reduced motion). The Step label, the paired Step marks (one place on), the user's side (Step name and short description), the card stack and the clock all change at once. The state is F1-N.
2. Shows the new Step's target on the clock and **holds the clock still for 1.2 seconds**, then starts it with no tap from the user. During the hold, Done is greyed out so that a double tap cannot skip a Step. Pause works during the hold; the Step is then paused at its full target.
3. Shows the new Step's card stack; there is no special opening card about what he just finished. The Step's story cards arrive one at a time while the user works (section 3.8, CARDS-SPREAD).
4. Announces once, politely, to screen readers: "Step 3 of 4, [Step name]". Focus stays where it was. No banner, no "Step 3 begins", no celebration, no sound.
5. Shows a toast "Step done" with **Undo** (section 3.9).

Pressing **Done** on the last Step goes straight to END with a fade of about 200 milliseconds and the same Undo toast. A one-time Goal moves to Done automatically when its last Step is finished; Undo returns it to In progress.

Done never asks a question. He does not react to an early Done.

### 3.8 Story cards on the focus page

- One card is visible at a time. Cards form a stack: the newest card sits on top.
- The character's goal mirrors the user's: if the user has x Steps of y minutes, his story has x Steps of y minutes. A story has 2 to 5 parts (STORY-PARTS), and its cards are made for each part, not for each number of user Steps (CARDS-PER-PART). When the user starts a story, the app spreads the parts across however many Steps the user has, in plain code with no model call (for example 4 parts and 2 Steps gives parts 1 and 2 in Step 1, parts 3 and 4 in Step 2). The cards of all parts are spread across the user's Steps in story order, and no card is ever dropped. More cards in a Step means closer together, fewer means further apart. Every Step gets at least one new card. With more Steps than parts, a part's cards are split across neighbouring Steps (CARDS-SPREAD).
- The first Step opens with the background card. A later Step has no special opening card about what he just finished, and there is no special "still at it" card at 00:00 (CARDS-SPREAD). A Step's n story cards arrive one at a time at y/n, 2y/n, ... y minutes of foreground time after the Step starts, so the last card arrives at the end of the Step and is not a special card; the first card of the next Step is the story's next card, at the start of that Step (CARD-TIMING). Each Step has its own stack.
- At the very start of the Goal, one extra background card is shown first. It is told in his own voice, as storytelling: who is here, where this is, and what each person knows. It is never written from an outside point of view. It is the opening card of the first Step, the oldest card in the stack, and has no dismiss button. It is not one of the n story cards and appears once, at the start of the Goal, not at the start of every Step. It introduces the people who are present.
- The background card, the step story cards and the closing line are made ahead of time, once per story, and shared by all users. They are published first and a person reads them afterwards, on the phone; a published card can be edited (SHARED-STORY, PUBLISH-FIRST, CLOSING-AHEAD). They are not written live for each user. Every card passes the checks (first person, no future facts, no clock times, something new in every card (CARD-NEW), and no year, date or age (DATES-ADMIN-ONLY)). The spoiler check runs when the cards are made and before publishing, against the parts after the card's own part (LEAK-BY-PART), and the banned style words are also checked before publishing, with no further AI-6 line rules (SAFETY-PREMADE). A step story card is 1 to 3 sentences and at most 45 words; the background card is at most 70 words; a card over the limit cannot be published (LEN-CARD). If the made-ahead cards cannot be loaded, F3 shows the failure message with **Retry** and the clock does not start; no stored text stands in (NO-BACKUP, FAIL-SCREEN, FAIL-PREMADE). Every card makes sense on its own, so the user can look back at it.
- Inside the card, a small label names it: **Where I am** for the background card of the first Step, **Right now** for the newest card, and **How I got here** for older cards. The label, the text, the dots and the ‹ › buttons sit inside the card (prototype version 4).
- To look back, swipe the top card **left**: it moves aside and shows the card before it. Swiping **right** brings the newer card back. Dots show the position. The buttons **‹** (Earlier card) and **›** (Newer card) do the same without a gesture. Arrow keys work when the card area has focus.
- The view shows the newest card by default. It resets to the newest card when the app reopens and when the user taps Start in F-RET.
- When a new card arrives while the user is looking at an earlier card, the view does not move and nothing marks the new card: no ring, no count, no colour, no sound, no vibration. By default a new card is silent.
- The card area is not announced as a live region. A new card is never read aloud over the user's work.
- The first Step opens with the background card; the story starts at chapter 1.
- Later cards carry no short introduction phrases; the background card introduces the people present. Names are not tappable.
- A card never says what happens next. No card marks a scene or a key moment ahead.

### 3.9 Undo after Done

Every Done can be undone, not only the last. After Done, a toast reads "Step done" with **Undo** for about 8 seconds. One tap, no questions, no dialog. After Undo the previous Step returns with its own cards, and its clock continues from the value it had at Done (time spent while the toast was open is not counted), after the same hold of 1.2 seconds. On the last Step, the toast appears over END and Undo returns to the last Step. Both are one component.

Cards of the next Step that the user has already seen stay read and are not rewritten. Whether this is acceptable to the story rules is open (Open questions, item 3).

### 3.10 The back controls and what each one means

| Control | Where | Goes to |
|---|---|---|
| **‹** (top left arrow) | Goal dialogue, CPAGE, goal detail, and other pushed pages | The previous screen of the same flow. Typed text is kept. Accessible name says where, for example "Back to Goals". |
| **Back** (header) | R1 family | The focus page with F-RET over it (see section 3.6). |
| **Home** (link) | R1 family | Home (see section 3.6). |
| **Close** | Sheets: HOME-MENU, HOME-3B, F1-C, G2b, G3 | The screen that opened the sheet. |
| **Back to my Goal** | S1 | The screen that triggered S1, with the text field emptied. |

Every swipe action has a visible alternative that needs no gesture.

### 3.11 Free text and the safety layer

Every free-text field passes through the safety check before anything is sent to the AI, saved or shown. The fields are:

- the goal in the goal dialogue, the title and description of a Step, the Goal field on the plan, and the name of an added Step;
- each message on the rest page;
- the Goal title in G4 and in G3;
- the name in Me;
- the search box in Goals (checked on the device only).

Safety has two tiers in the first demo.

- **Crisis:** a clear and current intent to seriously hurt oneself or others. The text is discarded and never sent to a model. The user sees S1, with real help for the country the user chose under Me, or the international directory (SAFETY-REGION).
- **Ordinary stress:** normal pressure, tiredness or frustration. It passes, and he answers in character.

A low-mood tier (hopelessness or heavy distress without clear intent) is deferred and not part of the first demo.

The character never knows about, mentions or reacts to the safety layer. The classifier and real hotlines by region are part of the first release. The wording of S1 needs legal and clinical review. What is logged is not yet settled (Open questions, item 14).

### 3.12 States common to every screen

These rules apply unless a screen says otherwise.

- **Session pages (focus, return pop-up, rest, summary):** no stored or pre-written text stands in when his text cannot be shown or a live message fails or is slow (NO-BACKUP). After retrying within the time limit, the page shows one calm message in the app's own voice, for example "He is not here right now. Please try again.", with **Retry**. The Step clock does not start while it is shown (FAIL-SCREEN). The wording and the time limit are set by testing (TIME-LIMIT). This message is app text, not story text (APP-TEXT).
- **Goals pages:** loading shows grey skeleton rows. An empty list shows one plain sentence and, where useful, one text link, with no illustration. A failed save shows the toast "Couldn't save. Try again." with **Retry**, and the change rolls back. Offline, Goals reads from stored data, changes wait in a queue, and the toast "Saved offline" appears.
- **Every other screen:** the sources do not define loading, empty, error or offline behaviour. Each such gap is marked "Not yet specified" below and listed in Open questions, item 17.

## 4. Screens

Each entry gives: **Frame** (page, sheet or state), **Purpose**, **Shows**, **Can do and leads to**, **System back**, and **States**.

### 4.1 Home

#### HOME-0 · Home, first visit

- **Frame:** top-level page with the tab bar.
- **Purpose:** welcome a user whose account has never started a Goal and offer the one first action.
- **Shows:** his portrait at a desk with the label "At your desk", and one card: "Let's launch your first wave", with one button. No sample data. No streak, no day count, no metrics, no progress bar, no achievement, no "last active".
- **Can do and leads to:** **Choose a Companion** opens COMP. Tab bar items open their tabs.
- **System back:** not specified (Open questions, item 16).
- **States:** empty sections are hidden, not filled with placeholders. No sample data is ever shown. Loading, error and offline: not yet specified.

#### HOME-1 · Home, Goal in progress, up to 3 days

- **Frame:** top-level page with the tab bar.
- **Purpose:** return the user to the Step they were working on.
- **Shows:** the Goal card with the Goal title, the current Step, and on a paper note the last line he said in the user's most recent session, stored in that session's record; there are no separate status lines (HOME-LINE). No "away for" text, no percentages, no progress bar, no "started 3 days ago", no counts. A text link "Start something else" sits below the card and ranks below Continue. A ⋯ button on the card opens HOME-MENU.
- **Can do and leads to:**
  - **Continue** opens F1 at the same Step. F-RET opens over it if the user was away 5 minutes or more, or after Back to step (sections 3.5 and 3.6).
  - **Start something else** opens a way to start another Goal (destination unsettled, Open questions, item 5).
  - **⋯** opens HOME-MENU.
- **System back:** not specified.
- **States:** loading, error and offline: not yet specified. Home shows only the Goal with the most recent activity; other Goals are in Goals.

#### HOME-3 · Home, welcome back after more than 3 days

- **Frame:** top-level page with the tab bar.
- **Purpose:** offer a calm choice after a long absence.
- **Shows:** a system card (not his voice) welcoming the user back. No day count, no guilt, no "Meanwhile" line, no "abandoned". "Pick it back up" is the default.
- **Can do and leads to:**
  - **Pick it back up** opens F1 at the same Step, with F-RET over it (the user has been away more than 5 minutes).
  - **Start over** opens HOME-3B.
- **System back:** not specified.
- **States:** not yet specified.

#### HOME-3B · Start over, confirmation

- **Frame:** sheet over HOME-3.
- **Purpose:** confirm a restart of the Steps in calm words.
- **Shows:** a short calm message that nothing is lost and that his night begins again from the start. No "you will lose progress", no Step count, no "abandon".
- **Can do and leads to:**
  - **Start from Step 1** restarts the Steps and his night, and opens F1 at Step 1.
  - **Not now** closes the sheet and returns to HOME-3.
- **System back:** same as Close, which returns to HOME-3.
- **States:** not yet specified.

#### HOME-MENU · Goal options

- **Frame:** sheet over HOME-1 or HOME-3.
- **Purpose:** the only way to close a Goal from Home.
- **Shows:** two quiet actions: **Put on hold** and **Mark done**. No Delete, no "End session", no red.
- **Can do and leads to:** either action takes the Goal off Home with no confirmation dialog and shows a toast with Undo for 5 seconds. Home then shows the next most recent Goal, or the Home state for a user with nothing in progress, which keeps a small trace of the Companion (Open questions, item 4). **Close** returns to Home.
- **System back:** same as Close.
- **States:** not yet specified.

### 4.2 Companions

#### COMP · Companions

- **Frame:** top-level page with the tab bar.
- **Purpose:** let the user choose who sits with them.
- **Shows:** the title "Companions" and a list of the Companions of Release 1, Oppenheimer and Moriarty, in a fixed order (OTHER-COMPANIONS). Each card has a portrait, a name, three tags and one line in the Companion's own voice. One **Enter** button is pinned below the list, above the tab bar. No stage, particles, roster strip, dossier panel, count, "new" marker or "Last Observed".
- **Can do and leads to:**
  - Tap a card to select it, one at a time. Nothing is selected on entry and Enter is inactive until a choice is made.
  - **Enter** with Oppenheimer selected opens CPAGE. Enter with Moriarty selected opens the goal dialogue (GD1) directly, or CPAGE-S (see Open questions, item 7).
- **System back:** goes to Home.
- **States:** the sources do not define loading, error or offline behaviour here. A Companion with no story yet shows a plain notice that it is not available.

#### CPAGE · Oppenheimer, Life Path

- **Frame:** child page of Companions with a ‹ "Back to Companions" and the heading "Oppenheimer"; with the tab bar (section 3.2). It opens scrolled to the current card.
- **Purpose:** show his life as a path of stories and start the next one.
- **Shows:** a plain ruler with ticks and a marker and no fill, and a list of rows with every story of the path. Shape carries the state of each row:
  - Finished (you finished it): solid dot and ›, the story title and his past-tense line. Tappable.
  - Current (exactly one): heavy ring, a card with his first-person line, and the **Begin** button.
  - The stored past-tense and present-tense lines are not fixed; they wait for Yue's inner-thoughts framework. Today (main) the rows show the story's goal sentence; nothing new is built until the framework exists (STORY-LINES-LATER).
  - The other stories of the path: all 26 chapters are shown with their titles, grouped under named periods, with no dates or ages (PERIODS, DATES-ADMIN-ONLY). Chapters ahead of the current one are visible but not tappable, play is in order, and none is marked locked or "coming soon".
  - New users start at chapter 1. No marker of any kind is shown for scenes or key moments on the rows or on the current card. No totals, future dates or source labels.
- **Can do and leads to:**
  - **Begin** opens GD1.
  - A finished row opens the record of that story (a screen that is not in this set; Open questions, item 9).
  - **‹** returns to COMP.
- **System back:** same as ‹, which goes to COMP.
- **States:** Network failure on the path: show the stored path if there is one, otherwise a plain error with **Retry** ("Couldn't load."). Loading and empty: not yet specified.

#### CPAGE-S · A Companion with one story

- **Frame:** child page of Companions, with the tab bar (section 3.2).
- **Purpose:** introduce a Companion that has one climactic story and no path.
- **Shows:** the Companion's portrait, name and tags, and one card with "One story" and a first-person story line. No path and no progress count.
- **Can do and leads to:** **Begin** opens GD1. **‹** returns to COMP.
- **System back:** same as ‹.
- **States:** not yet specified. Whether this screen exists at all is an open conflict (Open questions, item 7).

### 4.3 Goal dialogue

The goal dialogue is one chat-style page that grows downward. He speaks first, from inside his own afternoon, and asks one question at a time. The user answers with typed text for the goal, a slider for the time (TIME-SLIDER) and chips for the split question. The page has a header with ‹, his portrait and his name, a thread that scrolls, and a dock at the bottom that stays put (prototype version 4). The boundary is built into the product: the number of turns is counted on the server, the input box disappears when the plan appears, the split question has chips only, and he does not react to any change the user makes to the plan.

The dialogue has at most three turns, in this order: the goal, the time, and whether to split the goal into finer Steps; there is no follow-up question for a vague goal, because the planning prompt makes a vague goal concrete. The goal is free text. There is no restriction on what a goal can be and no list of unsupported kinds. His lines come from authored pools; they are fixed lines written for the app (APP-TEXT), not stored text under NO-BACKUP (FIXED-LINES). The goal text goes to the AI for exactly two purposes, classifying the shape of the goal and splitting it into Steps (the planning prompt of the AI workflow), and not to the writing of his lines. A returning user who already has a Goal with this Companion sees a shorter opening: one line that is the question itself (a variant of GD1, not a separate screen).

#### GD1 · Opening

- **Frame:** full page, no tab bar.
- **Purpose:** let him open and ask what the user is working on.
- **Shows:** his opening on a paper slip (at most three sentences and about 45 words, ending with the question), a rectangular input field with the placeholder "Say it in one line" next to a separate **Send** button, and a text link **Just split it** centred under them for users who do not want to talk. No label, no Continue button, no long monologue.
- **Can do and leads to:**
  - **Send** opens GD2 with his reaction. If the goal text already says how long the user will work, the time question is skipped and GD3 follows (GOAL-TIME). If the goal is empty, a short system line says "Write one line first".
  - **Just split it** uses the written goal and, if no time was chosen, a default of 30 minutes, and opens GD4. If the goal is empty it keeps the user on GD1 and shows the same hint.
  - **‹** returns to the screen that opened the dialogue (CPAGE, COMP, Home or Goals; see Open questions, item 6).
- **System back:** same as ‹. The typed text is kept.
- **States:** a goal that triggers the safety layer opens S1. Offline and loading: not yet specified.

#### GD2 · He reacts, asks how long

- **Frame:** the same page, scrolled; full page, no tab bar.
- **Purpose:** respond to the shape of the goal and learn how long the user will work.
- **Shows:** the user's goal as their own message, then one slip of his that holds both his reaction to the shape of the goal (specific, vague or too big), without repeating the user's words, and the question "How long do you have?". In the dock: a slider from 1 minute to 3 hours, with no 0, its value in words beside it, a Send button, and a **Not sure** chip. No fixed example times (TIME-SLIDER, SLIDER-RANGE). The goal time is not rounded to 15 minutes (NO-ROUNDING). **Just split it** is not offered on GD2. A vague goal gets no follow-up question (D1f). A goal that is too big is not questioned: the split cuts it to the part that fits the time given. The plan always matches that time.
- **Can do and leads to:** sending a time from the slider opens GD3. **Not sure** makes him set 30 minutes with the line "Then thirty minutes. Long enough to start, short enough to keep." and opens GD3. When the goal text already states a time, GD2 is not shown: he gives no reaction, and GD3 shows the caption "Time I understood from your line: N min." with **Change** (GOAL-TIME). **Change** opens the slider at that time (at most 3 hours).
- **System back:** goes to the previous turn. The user's previous answer can be changed and his reply is chosen again from the pool.
- **States:** the shape of the goal is decided by a local rule with no model call, so there is no loading while it is classified (GOAL-SHAPE-LOCAL); an `unknown` shape uses the generic reply. Offline: not yet specified.

#### GD3 · Split it finer?

- **Frame:** the same page, scrolled; no tab bar.
- **Purpose:** ask whether the goal should be split into finer Steps. The question suits a user with a detailed goal.
- **Shows:** the user's answer as their own message (for example "60 min"), then his question "Do you want it cut fine, or kept in a few broad pieces?" and two chips in the dock: **Split it finer** and **Keep it broad**. He does not acknowledge the time with a separate line. When the time was read from the goal, the caption "Time I understood from your line: N min." with **Change** is shown instead of the user's answer (GOAL-TIME). There is no input box.
- **Can do and leads to:** either answer opens GD4 with the proposed split.
- **System back:** goes to the previous turn (GD2).
- **States:** not yet specified.

#### GD4 · The plan

- **Frame:** the same page, scrolled; no tab bar. The input box is gone.
- **Purpose:** show the Steps as his slip of paper and let the user change them before starting.
- **Shows:** his short introduction, "Here is how I would cut it. Argue with it now, in ink, where it's cheap.", then the plan card. The card starts with the small label "YOUR STEPS" and an editable **Goal** field. Each Step row has a numbered circle, the short title, its minutes and move **↑** / **↓** buttons of at least 44 by 44 px (STEP-EDIT, TAP-SIZE); the list does not show the Step descriptions, which are in the editor only. **+ Add a step** sits on the same row as the count line, which always reads "N steps · N min" (for example "3 steps · 60 min"). A text link **Split again** is centred inside the card. **Start** is a full-width button pinned at the bottom. An optional closing line of his does not repeat the user's content or state a number.
- **Step editor:** tapping a Step opens it in place and its row reads "Editing". The editor has **Step title**, **Description**, and the minutes as **−5**, a typed whole number and **+5**, from 1 to 1440 minutes; at either end the reason is shown in words (STEP-EDIT, STEP-RANGE, issue #249). A new Step defaults to 15 minutes (NO-ROUNDING). Then **Done editing**, and **Remove step** as a text link. **Add a step** inserts the new Step after the open one. The user can edit fully: rename, change minutes, add, remove and move Steps. On each row, **Move up** is stacked above **Move down** (as in prototype v4), each 44 by 44 px to touch, so the Step title keeps its width (issue #340). There is no maximum number of Steps. If the edits change the total, the Goal's time follows the edits (D1d).
- **Can do and leads to:**
  - **Start** creates the Goal and its Step plan and opens F1 at Step 1, with the background card shown first. The Goal field is saved as the Goal title; if it is left empty, the typed goal is saved.
  - **Split again** shows the splitting state and returns to GD4 with a new plan, or to GD-F if it fails.
  - **‹** goes to GD3.
- **System back:** goes to GD3 (or GD2). The plan is kept. If the user changed the goal or the time, the plan is generated again and manual edits are lost.
- **States:** while splitting, a state shows one of his lines (from a pool) with a small wave that settles into a dot, and the text "Splitting your line into steps" is announced once; with reduced motion, a static row of dots is shown. Failure opens GD-F. The descriptions are generated with the plan and show read-only on the focus page. How a plan is split for a given goal is the job of the AI planning prompt (Open questions, item 10).

#### GD-F · The split failed

- **Frame:** the same page, full page.
- **Purpose:** say plainly that the split failed, without hiding it.
- **Shows:** a system-voice message (not his), in bold border and text and not in red: "That one wouldn't split." and "Nothing is lost. Your words are kept: "…"." with the user's goal quoted. The user's words are kept.
- **Can do and leads to:** **Try again** returns to GD4 with a new split. **Use one step** opens GD-N1. **Change my line** returns to GD1 with the goal put back in the input field.
- **System back:** goes to the previous turn.
- **States:** the message is announced as an alert. No silent generic Steps are ever created on failure.

#### GD-N1 · A one-Step plan

- **Frame:** the same page, full page.
- **Purpose:** allow a plan with exactly one Step.
- **Shows:** the plan card with one Step and the count line "1 step · 30 min" (the real number of minutes). No "Step 1 of 1" and no Remove button. No nudge to split it.
- **Can do and leads to:** **Start** opens F1S.
- **System back:** goes to the previous turn.
- **States:** not yet specified.

### 4.4 Session

#### F1 · Focus

- **Frame:** full page, no tab bar. The top bar and the bottom buttons are pinned and the middle scrolls only when it must.
- **Purpose:** hold the user's work on one Step next to his story.
- **Shows:**
  - Pinned at the top: "Step x of N", the paired Step marks and the clock.
  - His side, in his own first-person voice: "My goal" (one static line about an aim, not an outcome) next to his portrait, and the card stack (section 3.8). The card holds its label ("Where I am", "Right now" or "How I got here"), the text, the dots and the ‹ and › buttons. Newest card first; at the start of the Goal, the background card is the only card, and it has no dismiss button. No name label, no "His…", no counter on the cards, no chat.
  - The user's side, in plain system type: a "Your goal" panel with "Now", the current Step name and its short description (shown only when there is one), and **Your steps ▾**, which opens the list (F1-YOU).
  - Pinned at the bottom: **Done | Pause**, full-size buttons side by side.
- **Can do and leads to:**
  - **Done** moves to the next Step on this same page (state F1-N). On the last Step it opens END (section 3.7).
  - **Pause** opens R1 (section 3.6).
  - Tap his **portrait** to open F1-C, the "Who I am" sheet, as in prototype version 4 (PORTRAIT-SHEET).
  - **Your steps ▾** opens the list in place (F1-YOU).
  - **‹** (Earlier card) and **›** (Newer card), or swipe, browse the cards (F1-E).
- **System back:** acts as Pause: the clock freezes and R1 opens. This is inherited from the earlier flow document and has not been re-confirmed (Open questions, item 16).
- **States:** clock reaches 00:00 (F2); cards fail to load (F3); first frame after Done (F1-N); back from rest or after 5 minutes away (F-RET over F1). Offline: no stored cards stand in; if the cards cannot be shown, F3 applies (NO-BACKUP, FAIL-SCREEN).

#### F1S · Focus, single Step

- **Frame:** the same as F1.
- **Purpose:** the same as F1 for a plan with one Step.
- **Shows:** the same screen without "Step 1 of 1", the Step marks or the "Your steps" list.
- **Can do and leads to:** **Done** opens END. **Pause** opens R1. Other controls as F1. With one Step the whole story is one Step, and cards follow the rules of section 3.8.
- **System back:** acts as Pause.
- **States:** as F1.

#### F1-E · Focus, looking at an earlier card

- **Frame:** state of F1.
- **Purpose:** let the user reread an earlier card without the page jumping.
- **Shows:** an earlier card with its dots position. Nothing marks any newer card.
- **Can do and leads to:** swipe right or **›** (Newer card) returns toward the newest card. Reopening the app and tapping Start in F-RET reset the view to the newest card.
- **System back:** as F1.
- **States:** a card that arrives in the background does not move the view and is not announced.

#### F1-YOU · Focus, your Steps open

- **Frame:** state of F1.
- **Purpose:** show the user's own Steps without letting them edit.
- **Shows:** Step titles only, marked done (✓), now (●) or to do (○) by shape, with no minutes. The short description appears only under the current Step. The middle area scrolls if the cards and the list do not fit together; the clock and Done | Pause never move.
- **Can do and leads to:** tap again to close.
- **System back:** as F1.
- **States:** Steps cannot be edited here; editing happens before the Goal starts.

#### F1-C · "Where I am now"

- **Frame:** sheet over F1, opened by tapping his portrait (PORTRAIT-SHEET). The clock keeps running behind it.
- **Purpose:** let the user see who he is and what he has done so far, in his own words.
- **Shows:** the title "Where I am now", "Who I am" (one or two first-person sentences) and "What I have done" (one line per finished Step, never a row beyond them). Each line is the first sentence of the last card shown in that Step, with no model call (DONE-LINE); before the first finished Step it says "Nothing yet tonight." No adjectives written about him, no quotation, no future plans, no name used as a label.
- **Can do and leads to:** **Close** returns to F1.
- **System back:** same as Close. Escape also closes.
- **States:** not yet specified.

#### F1-N · First frame of the next Step

- **Frame:** state of F1, just after Done.
- **Purpose:** carry the user to the next Step with one calm change.
- **Shows:** the new Step label and marks, the user's side, the new Step's card stack with no special opening card (CARDS-SPREAD), and the clock holding still for 1.2 seconds. Done is greyed. A toast "Step done" with Undo (section 3.9). No banner, no Next step button, no celebration.
- **Can do and leads to:** wait 1.2 seconds and the clock starts; or press **Pause** to open R1; or **Undo** to return to the previous Step.
- **System back:** acts as Pause.
- **States:** as F1.

#### F2 · Timer at 00:00

- **Frame:** state of F1.
- **Purpose:** mark the target time quietly.
- **Shows:** the clock stays at 00:00 and does not count up. The last story card of the Step arrives at this moment and is not a separate card (CARD-TIMING). No overdue colour or word, no overtime counter, no pop-up and no forced rest. At 00:00 only the light vibration happens, once, by default, on devices that support it; no sound.
- **Can do and leads to:** **Done** moves on. **Pause** opens R1.
- **System back:** acts as Pause.
- **States:** a screen reader hears one polite "Step time reached". The vibration follows the time-up signal on SIG and does nothing on a device without haptics (S2, resolved 2026-11-24).

#### F3 · Cards failed to load

- **Frame:** state of F1.
- **Purpose:** say calmly that his cards cannot be shown, without substituting other text.
- **Shows:** in place of the card, one calm message in the app's own voice, for example "He is not here right now. Please try again.", with **Retry** (FAIL-SCREEN). No stored or pre-written card stands in (NO-BACKUP). The Step clock does not start while the message is shown. The "My goal" line is static data and still shows. If the goal line is also missing, that row is omitted and the portrait stays.
- **Can do and leads to:** **Retry** tries again; when the cards can be shown, the page continues as F1. Pause as F1.
- **System back:** acts as Pause.
- **States:** the wording and the waiting time limit are set by testing (TIME-LIMIT).

#### F-RET · Return pop-up

- **Frame:** modal over F1 or F1S. The focus page stays visible behind it with the clock frozen. Any open sheet is closed first.
- **Purpose:** restart the clock with a word from him after the user comes back.
- **Shows:** one message in his first-person voice: what he did during that time and how he felt. One button, **Start**. No close button, no second button, no question, no time away, no counter. The message is 1 or 2 sentences and at most 30 words (LEN-RETURN). It is generated live by the AI. He may describe how the time felt in any words he would use, without exact clock numbers (TIME-WORDS, CLOCK-NUMBERS). If generation fails or is slow, and when offline, no stored line stands in: the failure message with **Retry** is shown and the clock does not start (NO-BACKUP, FAIL-SCREEN). The clock behind it shows where it froze (the full target if the user left right after Done).
- **Appears:** after ‹ Back to step on the rest page, and after returning to the app (including Continue on Home or Goals) from 5 minutes or more away (section 3.5).
- **Can do and leads to:** **Start** closes the pop-up and the clock starts from the frozen value. The card view shows the newest card.
- **System back:** leaves to Home. The Step stays paused (Open questions, item 16).
- **States:** focus moves to Start when the pop-up opens, and the message is read once to screen readers. With reduced motion it appears without animation. The Start label has no wireframe (Open questions, item 2).

#### R1 · Rest, he writes first

- **Frame:** full page, no tab bar.
- **Purpose:** give the user a break in conversation with him, while the clock is frozen.
- **Shows:** a slim header with **‹ Back to step** on the left, the label "Paused" in the middle and a small **Home** link on the right. There is no name and no portrait. His first message is written live by the AI about the snag his own story has hit (a new stuck story each time, made in two calls: the stuck story, then his description of the predicament and his feelings, with the category and the prop chosen by code; PAUSE-TWO-CALLS), one to two and a half seconds after Pause. As in the prototype, the stuck story appears first on a taped slip, then his description on a second slip without tape; his description is 1 or 2 sentences and at most 30 words (LEN-PAUSE). No authored snag stands in if the AI is not ready; the failure message with **Retry** is shown instead (NO-BACKUP, FAIL-SCREEN). A text box is pinned at the bottom. No timer, no limit on messages, no quick replies, no instruction to write. From the third Pause in one Step his stuck situation is much harder and he says he is worried he may fail; he never instructs the user or asks the user to stop pausing (PAUSE-3, section 3.6). The screen is the same.
- **Can do and leads to:**
  - **‹ Back to step** opens F1 through F-RET.
  - **Home** opens Home with the Step paused.
  - Typing and sending a message opens R1-C.
- **System back:** same as Home.
- **States:** while a reply is awaited, three quiet dots appear after 600 milliseconds (this relaxes the earlier "no typing indicator" rule and needs a decision, Open questions, item 15). Replies are expected within about three seconds. No authored reply stands in; after the time limit the failure message with **Retry** is shown (NO-BACKUP, FAIL-SCREEN). With the keyboard open the header keeps Back and the log keeps at least one message. The page may be restored by the launch router. He may answer questions in his own voice; about things he could not know he answers as a person of his own time would, says plainly when he does not know, and may guess (ERA-ANSWER). He does not state that he is a program (that is only in the terms and in settings).

#### R1-C · Rest, you answered

- **Frame:** state of R1.
- **Purpose:** hold a free conversation with no limit.
- **Shows:** his short replies from his own side and the user's messages in plain bubbles. No limit on messages, no ending line, no counter, no avatars, no "he has to go".
- **Can do and leads to:** as R1.
- **System back:** same as Home. If the keyboard is open, the first press closes it.
- **States:** a message that triggers the crisis tier opens S1. A reply may end on its one question (CHAT-QUESTION-END). Every reply passes the same spoiler check as the story cards, against the parts the user has not reached, and a failing reply is generated again within the time limit (CHAT-SPOILER-CHECK). If the AI still fails, no authored reply is used: the failure message with **Retry** is shown (NO-BACKUP, FAIL-SCREEN). Silent safeguards limit the history sent to the AI and the length of a message, without any visible change. There is no limit on the number of messages.

#### R-OFF · Rest, no network

- **Frame:** state of R1.
- **Purpose:** show that there is no connection.
- **Shows:** a disabled text box and the failure screen with **Retry** (FAIL-SCREEN, REST-OFFLINE). No stored message of his stands in (NO-BACKUP). A typed draft is kept. No error code and no red banner.
- **Can do and leads to:** **Retry** tries again. **‹ Back to step** with no connection shows the failure screen with **Retry** (FAIL-SCREEN, OFFLINE-RESUME). **Home** opens Home.
- **System back:** same as Home.
- **States:** when the connection returns, the box is enabled again without a notice.

#### S1 · Safety

- **Frame:** full page, outside the story: system voice, no serif type, no tape.
- **Purpose:** respond to a crisis in plain human words.
- **Shows:** "This is outside the story.", a short body supplied after legal and clinical review, the support resource for the country the user chose under Me (SAFETY-REGION), and two buttons. The app never reads a location and has no default country. Below the resource, always, the international directory as a text link: Find A Helpline (findahelpline.com, SAFETY-DIRECTORY). It is never a third button. What the resource area shows depends on the state below.
- **Can do and leads to:** **Get support now** opens an outside resource: the entry's main contact in S1-E (for example a `tel:` link on a phone), the directory in S1-0 and S1-N. The directory link opens Find A Helpline. **Choose your country** (S1-0 only) opens ME-REGION. **Back to my Goal** returns to the screen that triggered it with the text field emptied.
- **System back:** same as Back to my Goal.
- **States:** it never blocks Back or Home. S1 needs no network: it reads the copy of the chosen country and its published entry kept on the phone (SAFETY-REGION-STORE). When no country is known, or the phone copy cannot be read and the database cannot answer, it shows S1-0 from a copy written in the code (the directory link and the labelled line "If you are in the United States: call or text 988"; the "Choose your country" link is left out when offline), never an unlabelled US entry (HOTLINES). Loading: none, because nothing waits on the network.

#### S1-0 · Safety, no country chosen

- **Frame:** state of S1.
- **Shows:** the directory link; a clearly labelled line "If you are in the United States: call or text 988" (plain text, not a link: Get support now is the one action); a **Choose your country** text link to ME-REGION. Signed out (the `/try` test build only, US-ACC-1), the Choose your country link is not shown.
- **Can do and leads to:** **Get support now** opens the directory. Choose your country opens ME-REGION; its back returns to Me, not to S1.

#### S1-E · Safety, an entry for the chosen country

- **Frame:** state of S1.
- **Shows:** the country's name in plain text ("Help in <country>"), the entry's service name when it has one (the name is optional; an entry with no name shows only its contact line, so the US entry reads "Call or text 988"), its main contact and, when there is one, a second contact as a text link (for example "Text 988"), and the directory link.
- **Can do and leads to:** **Get support now** opens the main contact.

#### S1-N · Safety, no entry for the chosen country

- **Frame:** state of S1.
- **Shows:** one plain line that no line is listed for the chosen country yet, a line to contact local emergency services in immediate danger, and the directory link. No US line. The wording of both lines is app text and waits for the legal review (US-SAF-8).
- **Can do and leads to:** **Get support now** opens the directory.

#### END · Summary

- **Frame:** full page, no tab bar, no ‹. It is a destination.
- **Purpose:** close the session with his last line and the user's finished Steps.
- **Shows:** his closing line, one thing he leaves hanging that is about himself, and the user's Steps as a plain list. The closing line is made ahead with the story's cards, published with them and read by a person afterwards (CLOSING-AHEAD, PUBLISH-FIRST); it passes the spoiler check and the banned style words check before publishing (LEAK-BY-PART, SAFETY-PREMADE); if it cannot be loaded, the failure screen with **Retry** is shown (CLOSING-FAIL); it is 1 to 3 sentences and at most 45 words (LEN-CARD), and tells what happened to him that day and how he feels about it, without counting the user's pauses or judging the user (END-TONE). A one-time Goal has moved to Done automatically. There is no list of merged key moments (NO-MERGED-MOMENTS). No percentage, badge, score, total time, "3/3" or "Keep going!". The toast "Step done" with Undo is shown on arrival (section 3.9).
- **Can do and leads to:** **Next** opens CPAGE with the next story current. It is offered only to the first finisher of a story. **Home** opens Home. **Undo** returns to the last Step.
- **System back:** goes to Home.
- **States:** a user who finishes a story that was already played, or when nothing further is playable, sees **Home** only. If the closing line cannot be shown, no other text stands in: the failure screen with **Retry** is shown (NO-BACKUP, FAIL-SCREEN, CLOSING-FAIL). The summary has no clock.

### 4.5 Me

#### ME · Me

- **Frame:** top-level page with the tab bar.
- **Purpose:** hold account basics and settings.
- **Shows:** name, email and a sign-out link; Appearance; Signals; Country (for help lines; shows the chosen country or "Not chosen", SAFETY-REGION); History as one row until opened; About the stories; Data. A **Signals** row opens a sub-page with the time-up signal (default: one light vibration at 00:00), the new-card signal (default off), the lock-screen notification (default off; may show the Step name once the user turns it on), and "Keep the clock running when I leave" (default off). English only, with no language switch and no reading-level setting. Reminders stay hidden until the start-time feature exists. No streaks, totals or badges.
- **Can do and leads to:** **History** opens ME-CAL. **Country** opens ME-REGION. **About** opens a page that explains where the stories come from in one unified statement and holds the disclosure that the Companion is an AI program. **Data** offers export and deletion of the user's data and account, with a privacy notice. **Sign out** signs out. The user's Goal and Step text are stored on the server and tied to the account.
- **System back:** not specified.
- **States:** the Signals sub-page has no drawn screen yet (Open questions, item 12). Loading, error and offline: not yet specified.

#### ME-CAL · Me, history open

- **Frame:** state of ME.
- **Purpose:** show the days on which the user worked, and open the record of a session.
- **Shows:** a month calendar where days with a session carry a small mark and empty days stay quiet. No cross, no streak flame, no "you missed". Expanding and collapsing is a button with a clear state.
- **Can do and leads to:** tap a day to list that day's sessions (Goal and duration); tap a session to open ME-REC. Tap History again to collapse.
- **System back:** as ME.
- **States:** not yet specified.

#### ME-REC · Session record

- **Frame:** child page of Me with ‹ "Back to History"; with the tab bar (section 3.2). It is also opened from rows in G6 and G4.
- **Purpose:** show one finished session as a plain record.
- **Shows:** the date, the duration, the Goal name, and the Steps on which the user pressed Done (Step titles only). A Step is shown as done only because Done was pressed, never from text the user typed. No score, no total, no "N of M", no "partial".
- **Can do and leads to:** **‹** returns to the screen that opened it.
- **System back:** same as ‹.
- **States:** not yet specified.

#### ME-REGION · Country for help lines

- **Frame:** child page of Me with ‹ "Me", like the Signals page; with the tab bar.
- **Purpose:** let the user choose the country whose help lines S1 shows (SAFETY-REGION).
- **Shows:** one sentence saying that the country is used only to show help lines on the safety page; a search box; "No country" at the top; then every country by its English name, sorted (ISO 3166-1). The chosen one is marked. The app never suggests a country from the location, the network or the browser language.
- **Can do and leads to:** tap a country to choose it; it is saved to the account and copied to the phone, and the page returns to Me with the row showing it. "No country" clears the choice (S1 then shows S1-0).
- **System back:** same as ‹.
- **States:** a failed save shows the toast "Couldn't save. Try again." with **Retry**, and the choice rolls back. Offline: not yet specified (open question 17).

### 4.6 Goals

#### G1 · Goals, in progress

- **Frame:** top-level page with the tab bar and four top tabs: **In progress**, **On hold**, **Done**, **History**.
- **Purpose:** list the Goals the user is working on.
- **Shows:** a header with the title "Goals" and **+ New goal**, a search box, and the rows in two groups, Ongoing and One-time (a group is hidden when empty). A row has the Companion portrait, the Goal title (up to two lines), one subline, **Continue** or **Start**, and **⋯**. Rows are ordered by most recent use. The first five show, then a text link **Show more** with no number. The subline says only what the user did today or this week; it is blank otherwise. Never a total, a count of Steps, "N of M", "last active", a red dot or a debt.
- **Can do and leads to:**
  - **Continue** opens F1 at the same Step (the same Goal as on Home), with the same return pop-up rule as Home Continue.
  - **Start** opens GD1.
  - Tap a row to open G4, G4-N or G4-H.
  - **⋯** opens G2b. **+ New goal** opens G3.
- **System back:** not specified.
- **States:** a first-time user has exactly one row, not an empty state. A true empty state reads "No goals yet." with a **New goal** text link. Loading shows skeleton rows. Offline reads from stored data. Search finds no match: "No matches." Error: toast "Couldn't save. Try again." with **Retry**.

#### G2b · Goal menu

- **Frame:** sheet over G1.
- **Purpose:** offer the swipe actions without a gesture.
- **Shows:** **Put on hold** and **Mark done**. No Delete.
- **Can do and leads to:** either action applies at once and shows a toast with Undo for 5 seconds. **Close** returns to G1.
- **System back:** same as Close.
- **States:** a change is blocked while a clock is running elsewhere: "Finish or pause your session first."

#### G3 · New goal

- **Frame:** sheet over G1.
- **Purpose:** take one line for a new Goal.
- **Shows:** the title "New goal", **Close**, and one question with an arrow. No type, repeat, date or Companion picker.
- **Can do and leads to:** the arrow opens GD1 with nothing created yet. **Close** returns to G1 and keeps the draft for this visit.
- **System back:** same as Close.
- **States:** the goal text passes the safety check. Not yet specified for offline.

#### G4 · Goal detail, with an open Step plan

- **Frame:** child page of Goals with ‹ "Back to Goals"; no tab bar.
- **Purpose:** show one Goal and its current Steps.
- **Shows:** the Goal title (editable), a status pill, the Companion, a **Type** choice (One-time by default, or Ongoing, editable at any time), the Steps read-only with done ones marked and each with its short description, a short history of the last few sessions (date and duration, each row opens ME-REC) with **See all**, and the main button. Footer text actions: **Put on hold**, **Mark done**, **Export**. Tapping a Step checkbox does nothing and shows "Complete steps in your session."
- **Can do and leads to:** **Continue** opens F1. **See all** opens G6 for this Goal. **Put on hold** and **Mark done** apply with Undo for 5 seconds. A one-time Goal moves to Done by itself when its last Step is finished. **‹** returns to G1.
- **System back:** same as ‹.
- **States:** the Goal title passes the safety check. Offline: reads from stored data.

#### G4-N · Goal detail, nothing open

- **Frame:** child page of Goals; no tab bar.
- **Purpose:** show a Goal that has no open Step plan.
- **Shows:** as G4 without Steps, with the sentence "Nothing open right now." and the main button **Start**.
- **Can do and leads to:** **Start** opens GD1. **‹** returns to G1.
- **System back:** same as ‹.
- **States:** as G4.

#### G4-H · Goal detail, on hold

- **Frame:** child page of Goals; no tab bar.
- **Purpose:** show a Goal that is put aside, not abandoned.
- **Shows:** as G4, with the main button **Resume**. No dates and no "how long it has been waiting". The Step plan stays exactly where it was.
- **Can do and leads to:** **Resume** moves the Goal to In progress, at the same Step; F-RET follows the same return rule (away 5 minutes or more) when the Step is next opened. **‹** returns to G5.
- **System back:** same as ‹.
- **States:** as G4.

#### G5 · Goals, on hold

- **Frame:** top-level page with the tab bar, **On hold** tab selected.
- **Purpose:** list Goals the user put aside.
- **Shows:** a flat list of rows with a portrait, a title, **Resume** (quiet, secondary) and ⋯. No section labels, no count, no dates, no nudges, no sublines.
- **Can do and leads to:** **Resume** moves the Goal back to In progress. Tap a row to open G4-H.
- **System back:** not specified.
- **States:** empty reads "Nothing on hold."

#### G5-D · Goals, done

- **Frame:** top-level page with the tab bar, **Done** tab selected.
- **Purpose:** list closed Goals.
- **Shows:** the same rows with **Reopen**. No badges and no scores.
- **Can do and leads to:** **Reopen** puts the Goal back in In progress. A new open Step plan is created at the next start.
- **System back:** not specified.
- **States:** empty reads "Nothing finished yet."

#### G6 · Goals, history

- **Frame:** top-level page with the tab bar, **History** tab selected.
- **Purpose:** show a plain list of sessions the user has done.
- **Shows:** two filters, All Goals and This week (ranges: this week, this month, all time), and rows with the date and Goal on the left and the minutes on the right. A session appears if at least one Step was finished. No empty days, calendar grid, streak, Step count, "partial" or "abandoned". Each row shows the date, the duration and the Goal, and is tappable: it opens ME-REC. There is no weekly total row.
- **Can do and leads to:** switch tabs or filters; tap a row to open ME-REC.
- **System back:** not specified.
- **States:** empty reads "Your sessions will show up here."

### 4.7 Content admin: hotlines

The content admin is a desktop tool (ADMIN, ADMIN-DESKTOP); these two screens are listed here because S1 depends on them (HOTLINES). The admin role edits and publishes; writers may read. They are drawn in `docs/design/prototype/admin-hotlines_2026-11-23_v1.html` (#404), in the look of the owner's admin prototype; the owner's `content-admin/admin-prototype_2026-11-14_v1.html` stays the reference for every other admin page.

#### ADM-14 · Hotlines, the list

- **Shows:** one row per entry: country, service name, main contact, state (draft or published), last checked date and who checked it. An entry not checked in the last 6 months is marked.
- **Can do and leads to:** open a row (ADM-15); add an entry for a country that has none (ADM-15, empty).

#### ADM-15 · Hotline entry

- **Shows:** a short note that a new or changed entry should be checked against the legal review (#121) before Publish (a note, not a block); the country (ISO 3166-1 alpha-2 code and English name, fixed once saved), the service name (optional), the main contact (kind: phone, text or web; and its value), an optional second contact, a short note, the last checked date and who checked it, and the versions.
- **Can do and leads to:** Save draft; **Publish** (admin role only), which writes a Publish history row of kind `hotline` (`docs/decisions/0018`); restore an older version.
- **States:** a contact that is not a valid phone number or `https` address cannot be saved.

## 5. Removed screens

| Id | Why it is removed |
|---|---|
| L1 | The landing card shown after Done is gone. The landing of the finished Step is now the first card of the next Step on the same page, and there is no "Next step" button. |
| L2 | The landing card after the last Step is gone. Done on the last Step goes straight to END, and the last landing is shown in END. |
| HOME-2 | The return line it carried is replaced by the return pop-up (F-RET), so it no longer differs from HOME-1. HOME-1 now covers the whole range up to 3 days. |
| HOME-4 | The Home variant "Next: Step 3" is gone, because there is no landing page to return to. Home shows the ordinary Goal card. |
| R2 | The timed screen "he went back on his own" is gone. His stuck state lasts until the user presses Back, and the chat has no ending to time. |
| R-WARN | The third-pause warning and the timer reset are cancelled. Pause has no limit. From the third pause only his message on the same rest page changes. |
| F4 | Focus, back after leaving, with Resume and Done. Replaced by F-RET: one pop-up with one Start button. |
| F1-R | The first frame after rest with a resolved line as a card. Replaced by F-RET. |
| F1-HIS | The separate list of his finished Steps is gone. It is merged into "What I have done" inside F1-C. |

Also removed, not as screens but as rules: the 24-hour limit on resuming, the cap on messages on the rest page, the maximum number of Steps, and the rule that he never waits for the user.

## 6. Screens that sources mention but this set does not contain

| Screen | Source and meaning | Open question |
|---|---|---|
| PICK | A goal picker sheet between Begin and the dialogue. Deferred in the story-map specification. | 8 |
| LPH | The record of a finished story, opened from finished rows on CPAGE. | 9 |
| S6 | The end of the path, shown after the last story. His one line must exist; its prompt is designed later. Finishing all stories also unlocks a long-term chat with the Companion. Both are pending (END-LINE-PENDING). | 9 |
| Signals page | Sub-page of Me for the four signal settings. Decided, not yet drawn. | 12 |
| Sign-in, sign-up, account deletion | Needed because an account is required at first open and Goal and Step text is stored on the server tied to the account. | 13 |
| GD1-R | The shorter opening for returning users, described here as a variant of GD1. | 5 |
| Lock-screen notification | A notification with the Step name and one line, only if the user turns it on. | 12 |

## 7. Prototype differences to fix

The interactive prototype `wp-prototype_2026-10-29_v1.html` is the current visual reference, but it differs from the decisions in these ways. Follow the decisions.

1. **Cards at the start of a Step.** The prototype shows several story cards when a Step opens. The first Step opens with the background card; the cards of all parts are spread across the Steps in story order, none dropped, at least one new card per Step, with no special opening card for later Steps (CARDS-SPREAD). The cards are made ahead once per story part, published and shared by all users, and read by a person afterwards, with no fallback cards (SHARED-STORY, CARDS-PER-PART, PUBLISH-FIRST, NO-FALLBACK-TABLES).
2. **Background card.** The prototype has none. One background card, told in his own voice, is shown first at the start of the Goal.
3. **Gesture direction.** The prototype moves to an earlier card when the user swipes right and uses a row with the oldest card at the left. Decided: a stack, where swiping the top card left shows the previous card and swiping right brings the newer card back.
4. **Third pause.** The prototype shows R-WARN on the third pause and restarts the Step clock after resting. Both are cancelled. Pause has no limit and no reset. From the third pause the same rest page opens with a stronger message from him.
5. **Rest page.** The prototype limits his replies. There is no limit on messages.
6. **Return.** The prototype's F4 offers Resume and Done and depends on a 24-hour cut-off. Replace it with F-RET: a pop-up in his voice with one Start button, after Back to step and after 5 minutes or more away. There is no time limit on resuming.
7. **Undo after Done.** The prototype offers a 5-second Undo only after the last Step and returns with the clock frozen. Every Done is undoable, for about 8 seconds, and the previous Step's clock continues from the value at Done after the hold of 1.2 seconds.
8. **Goal dialogue and plan.** The prototype limits the number of Steps and the minutes per Step and asks a feeling question. Decided: goal, time, then whether to split finer; no maximum number of Steps; full editing of titles, descriptions, minutes and number of Steps.
9. **One-time Goals.** A one-time Goal moves to Done automatically when its last Step is finished.
10. **Starting hint field.** The prototype's Home card note and its stored field for a free-text starting hint are cancelled. The short Step description replaces them.
11. **Words for the user's work.** The prototype's Home menu title, its notes and its toasts use an older word for the Goal. Use Goal and Step, and Companion.
12. **Home fixtures and state after finishing.** The prototype Home always shows two Quick Replay chips and an "In progress" row from sample data, and a hard-coded name, whatever the account holds. After the last Step or after Put on hold, it falls back to the first-visit card "Let's launch your first wave". Home must read only the signed-in account and, with nothing in progress, keep a small trace of the Companion.
13. **Companions list.** The prototype opens a Companion's page when its row is tapped. The decision is select first, then press one **Enter** button.
14. **Life Path.** The prototype opens on chapter 8 with seven "his memory" rows above it and later rows that cannot be opened. New users start at chapter 1, and all stories are shown and played in order; chapters ahead of the current one are visible but not tappable (D4).
15. **Tab bar on CPAGE.** The story-map specification says CPAGE has no tab bar. Decided (Yue, 2026-11-13): as in the prototype, the tab bar shows on CPAGE, CPAGE-S and the session record (section 3.2).
16. **Me page.** The prototype's Me has a Language row with a disabled Chinese option, a Reminders row and a Replay intro row, and no signal settings. English only, Reminders hidden until the start-time feature exists, and a Signals sub-page is added.
17. **History.** The prototype's history rows cannot be opened. Rows open the session record (ME-REC), and there is no weekly total row.
18. **Safety.** The prototype uses one keyword test and one page. The decision is a classifier with two tiers, crisis and ordinary stress, and real hotlines by region.
19. **Start over.** The prototype note says his night does not restart. Start over restarts his night.
20. **Summary button.** The prototype labels the button "Next night". The label is "Next".
21. **Just split it.** The prototype sets 60 minutes. The dialogue specification of 2026-10-29 says 30 minutes.

## 8. Open questions

Each item names the files that disagree or leave the point open. File names are in the folder `1_Projects/Newfeatures` unless a folder is given.

1. **Return pop-up edge cases.** Settled by default (T10): with "Keep the clock running when I leave" on, leaving the app does not stop the clock, so no pop-up appears for that; the pop-up still appears after Back to step from the rest page. System back on the pop-up goes to Home and the step stays paused. File: `DECISIONS.md` (T6, R1, T10).
2. **F-RET content.** The Start button label and the screen-reader announcement have no wireframe. The length is settled: 1 or 2 sentences, at most 30 words (LEN-RETURN).
3. **Details of Undo.** The duration is about 8 seconds in `NF6_v7_research-and-changes` and 5 seconds in `wireframes_NF6_v6..._EN`. After Undo, the next Step's first card has already been read, and whether that is acceptable to the story rules is a request to the story sessions. What happens if the user leaves the app while the toast is open is not specified. Whether Undo on the last Step also moves a one-time Goal out of Done is assumed yes.
4. **What Home shows with nothing in progress.** Decided: after finishing, Home keeps a small trace of the Companion; on a first visit it shows one card and no sample data; after a long absence with nothing in progress it shows no welcome back. Not decided: what the trace shows and whether a New session action sits beside it. File: `NF4_home-and-life-state_ux-spec_..._v4`.
5. **Where "Start something else" leads.** The prototype opens Companions. `PRDs_MomTest/NF7_v6_goal-dialogue-spec` (sections 2.3 and 12) opens the shorter returning opening. `FLOW_jump-rules-and-screen-registry_2026-10-29_v1_draft` used a sheet that is now deferred.
6. **Where ‹ on GD1 leads.** `NF7_v6_goal-dialogue-spec` (section 5) says Companions; the prototype goes to CPAGE or to Home if a Goal is in progress.
7. **CPAGE and CPAGE-S.** `StoryMap_Feature_Docs/STORYMAP_03_ux-functional-spec` says the seven single-story Companions skip CPAGE (Enter opens GD1) and that CPAGE has no tab bar; the prototype and the screen set include CPAGE-S. The tab bar part is decided: it shows on CPAGE and CPAGE-S, as in the prototype (section 3.2). The same file says system back on the Life Path goes to Home in one table and to COMP in another.
8. **Begin with several Goals.** The goal picker (PICK) is deferred, so Begin always opens GD1. `Goals_Feature_Docs/GOALS_03_ux-functional-spec` (section 6.5) and `STORYMAP_03_ux-functional-spec` (section 5) leave open what happens when the current story already has an open Step plan for a Goal.
9. **Finished rows, LPH, S6, END record.** Finished rows should open a record screen (LPH) that is not in this set. S6 is not in the set; its line and the long-term chat it unlocks are pending (END-LINE-PENDING). `STORYMAP_03_ux-functional-spec` leaves "Your record" on END, and his pending thing card, undecided.
10. **Plan editing.** Decided: no maximum number of Steps, full editing, a short title and a description of one or two sentences per Step, the plan matches the time given, move up and down buttons, and minutes edited with −5 / +5 and a typed whole number from 1 to 1440 (STEP-EDIT, STEP-RANGE, issue #249); a new Step defaults to 15 minutes (NO-ROUNDING); the move buttons are at least 44 by 44 px (TAP-SIZE). Not decided: the real AI planning prompt, which must replace the placeholder in `docs/ai/AI_01` (P1).
11. **Session record.** Decided: a record page opened from Me, History. This document also opens it from G6 and G4 rows. Not decided: whether those entries are wanted, and whether the record is kept at the Step and shown at the day. Files: `PRDs_MomTest/NF1_v2_research-and-changes`, `GOALS_03_ux-functional-spec`.
12. **Signals sub-page.** Decided as a sub-page of Me, but no screen is drawn. Whether vibration and lock-screen notifications work on iPhone is for engineering to check. File: `NF6_v7_research-and-changes` (section 9).
13. **Sign-in, sign-up and account deletion.** An account is required from the first open. Decided (ACCOUNT-SCREENS): the sign-in, sign-up, email confirmation, forgot-password, new-password and account-deletion screens are added to the screen list; their entries are not yet written here. Files: `PRODUCT_doc-map-and-open-decisions` (S3), `Goals_Feature_Docs/GOALS_03_ux-functional-spec` (ME row "Keep your progress").
14. **Safety details.** What is logged and the exact wording of S1. The hotline list, the region source and the directory are decided (SAFETY-REGION, SAFETY-REGION-STORE, SAFETY-DIRECTORY, HOTLINES, 2026-11-23); the entries and the directory wait for the legal review (#121). The low-mood tier is deferred; when it returns, the rule for how often its sentence may appear is open. Files: `PRODUCT_doc-map-and-open-decisions` (A5), `AI_Specs/AI_05_safety_2026-11-04_v2_draft`.
15. **Waiting dots on the rest page.** They override the earlier rule of no typing indicator and need a decision. File: `PRDs_MomTest/wireframes_NF6_v5_rest-conversation_EN_2026-10-29.html`.
16. **System back on Home, Goals, Me, F-RET, and the root of Companions, and on F1.** Nothing states these for the current flow. System back on F1 as Pause comes from `FLOW_jump-rules-and-screen-registry_2026-10-29_v1_draft` and has not been re-confirmed.
17. **Loading, error and offline states** are not specified for most screens outside Goals, the focus page, the rest page and S1 (whose offline state is in its entry): Home, Companions, the goal dialogue, END, Me and the sheets.
18. **Rest-chat questions about things he could not know.** Decided (ERA-ANSWER): he answers as a person of his own time would, says plainly when he does not know, and may guess. A list of later-knowledge words stays as a check.
19. **HOME-3 and Start over.** Start over restarts his night, but the decision on resuming removes the old Start-from-Step-1 behaviour for lapsed Goals. This document keeps HOME-3 and Start over as a choice the user makes. File: `DECISIONS.md` (T5, T6).
20. **Story content.** New users start at chapter 1 (M1). There are no fallback cards or lines (NO-BACKUP, NO-FALLBACK-TABLES); the formerly authored cards (the Trinity night, "finding the place", Moriarty story 1) are reference examples and evaluation material only. Every story's cards and closing line must be made ahead and published; a person reads them afterwards (SHARED-STORY, PUBLISH-FIRST).
21. **Waiting time limit.** The length of the waiting time limit for live generation and the wording of the failure message are set by testing (TIME-LIMIT).

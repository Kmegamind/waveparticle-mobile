# WaveParticle user stories for Release 1

This document is the story backlog for the WaveParticle mobile web app. Each story is written so that it can become one GitHub issue. The backlog covers everything in the current wireframes, which is the Release 1 scope decided by Yue on 2026-11-04 (decision S1). The milestones at the end only order the work; they do not remove anything from Release 1.

## 1. How to read this backlog

### 1.1 The product in two sentences

A user splits a Goal into Steps and works through them one at a time. While they work, a Companion (the first is J. Robert Oppenheimer) lives a parallel story in the first person, and that story moves forward only when the user finishes a Step.

### 1.2 Vocabulary

The words below are fixed by decision X1. The words Mission and Task are not used for the user's work, in the interface or in this document.

| Word | Meaning in this backlog |
|---|---|
| Companion | A character who works alongside the user, such as Oppenheimer. |
| Goal | Something the user wants to get done, written in one line. A Goal is either One-time or Ongoing. |
| Step | One piece of a Goal, with a title, a number of minutes and a description of one or two sentences. |
| Plan | The list of Steps that the goal dialogue produces for one sitting. The older documents use another word for it; this backlog says Plan so that it is not confused with a Step. |
| Story | One episode from a Companion's life (for example the search for a laboratory site). A Companion has a Life Path: all of his Stories in order, grouped into named periods with no dates or ages (PERIODS). |
| Part | One of the Companion's tasks in a Story. A Story has 2 to 5 parts (STORY-PARTS). Story cards are made for each part, and the app spreads the parts across the user's Steps (CARDS-PER-PART). |
| Slice | A short moment inside a Story. One Story is built from several Slices (for example eight). |
| Entry state | The situation the Companion is in at the start of a Step. Every card in that Step may only use facts that are true in that entry state. |
| Fate link | The rule that the Companion's Story moves forward only when the user finishes a Step. Nothing else advances it. |
| Card | A short first-person piece of text from the Companion, shown on the focus page. |
| Background card | The card, told in the Companion's own voice, with which the first Step of a Goal opens. It introduces the people who are present, says where this is and what each person knows. It is not counted among the story cards of a Step. |
| Seam | The top strip of the focus page: the Step label, the paired marks and the timer. |

### 1.3 Priorities

Priorities are for Release 1.

| Priority | Meaning |
|---|---|
| Must | Release 1 is not complete without it. |
| Should | Expected in Release 1; can be cut last if time runs out. |
| Could | Wanted in Release 1 if time allows. |
| Won't | Decided as not built in Release 1; kept here so the decision stays visible. |

A story marked **Blocked by decision <id>** cannot be built until that decision is made. The decision ids come from the decision log (`DECISIONS.md` in this folder) and, where the log does not yet hold a decision, from the research notes (for example NF7-P3 means proposal P3 in the goal-start research note). The acceptance criteria of a blocked story describe the behaviour that the source recommends, so that the story is ready once the decision is confirmed.

### 1.4 Screen identifiers

Screens use the identifiers of the prototype and the screen registry.

| Id | Screen |
|---|---|
| H0a, H1, H3, H3B, HM, H6 | Home: first visit, goal in progress, welcome back after more than 3 days, start-over confirmation, goal card menu, after finishing |
| COMP | Companions list |
| CPAGE, CPAGE-S | Life Path page of Oppenheimer; page of a Companion with a single Story |
| LPH | Record of a finished Story (reread) |
| GD1, GD2, GD3, GD4 | Goal dialogue: opening, reaction and time question, the question whether to split finer, the Plan |
| GD-F, GD-N1 | Goal dialogue: split failed; one-Step Plan |
| F1, F1S | Focus page with several Steps; focus page with a single Step |
| F1-E, F1-C, F1-N, F1-R, F1-YOU | Focus page states: looking at an earlier card; "Who I am" sheet; first frame of the next Step; return pop-up after Back from rest; Your Steps open |
| F2, F3, F4 | Timer at 00:00; his card failed to load; focus page with the return pop-up after leaving the app for 5 minutes or more |
| R1, R1-C, R-OFF | Rest page; rest conversation; rest page without network |
| S1 | Safety page |
| END | Summary after the last Step |
| G1, G2b, G3, G4, G4-N, G4-H, G5, G5-D, G6 | Goals: in progress, row menu, new Goal sheet, Goal detail (open Plan, no Plan, on hold), on hold, done, history |
| ME, ME-CAL | Me page; Me history calendar |
| SR | Session Record (proposed, not yet drawn) |
| SIG | Signals sub-page of Me (proposed, not yet drawn) |
| N1 | Lock-screen notification (proposed, not yet drawn) |
| SAVE | Sign up or sign in when the app is first opened |

### 1.5 Feature codes and areas

The original design documents are grouped by feature codes NF1 to NF7. Each story names its area and, in brackets, that code where there is one. Story ids use a short area code: GM (Goals and Me, NF1), MAP (Story map and Companions, NF2), CON (Story content and data, NF3), HOME (Home and life state, NF4), FMT (Story format and cards, NF5), FOC (Focus and rest, NF6), GD (Goal start dialogue, NF7), AI (AI pipeline), SAF (Safety), ACC (Account and data), PLAT (Platform), A11Y (Accessibility).

### 1.6 Source key

Every story names its source with one of the keys below, followed by section, requirement or decision ids. Paths are relative to `1_Projects/Newfeatures` in the Wave Particle workspace, except DEC, which is the decision log in this repository.

| Key | File |
|---|---|
| DEC | `docs/DECISIONS.md` in this repository (authoritative; decision ids) |
| NF1v2 | `PRDs_MomTest/NF1_v2_research-and-changes_2026-11-04_v1_draft.md` |
| NF4v4 | `PRDs_MomTest/NF4_home-and-life-state_ux-spec_2026-11-04_v4_draft.md` |
| NF5v3 | `PRDs_MomTest/NF5_card-stack-v3_register-density-narration-intro-reread_2026-11-04_v1_draft.md` |
| NF6v7 | `PRDs_MomTest/NF6_v7_research-and-changes_2026-11-04_v1_draft.md` |
| NF7v7 | `PRDs_MomTest/NF7_v7_user-test-research-and-changes_2026-11-04_v1_draft.md` |
| NF7v6 | `PRDs_MomTest/NF7_v6_goal-dialogue-spec_2026-10-29_v1_draft.md` |
| SM02 | `StoryMap_Feature_Docs/STORYMAP_02_prd_2026-10-29_v1_draft.md` |
| SM00 | `StoryMap_Feature_Docs/STORYMAP_00_doc-set-index_2026-10-29_v1_draft.md` (decision log D1 to D35) |
| SM07 | `StoryMap_Feature_Docs/STORYMAP_07_user-test-update_2026-11-04_v1_draft.md` |
| NF3v1 | `NF3_story-side-after-user-test_2026-11-04_v1_draft.md` |
| G02 | `Goals_Feature_Docs/GOALS_02_prd_2026-10-29_v1_draft.md` |
| G07 | `Goals_Feature_Docs/GOALS_07_me-page-spec_2026-10-29_v1_draft.md` |
| AI01, AI02, AI06, AI07 | `AI_Specs/AI_01_goal-split…`, `AI_02_status-and-landing-lines…`, `AI_06_check-and-fallback…`, `AI_07_end-feeling-line…` (all `2026-10-29_v1`) |
| AI03v2, AI04v2, AI05v2, AI09v2 | `AI_Specs/AI_03_stuck-story-layer`, `AI_04_rest-chat`, `AI_05_safety`, `AI_09_decisions-and-todo` (all `2026-11-04_v2`) |
| AI10 | `AI_Specs/AI_10_story-cards-on-focus-page_2026-10-29_v1_draft.md` |
| FLOW | `FLOW_jump-rules-and-screen-registry_2026-10-29_v1_draft.md` |
| DESIGN | `design.md` (version 6) |
| PROTO | `wp-prototype_2026-10-29_v1.html` (the ANN object lists the current screens) |
| US-NF1 … US-NF7 | `PRDs_MomTest/US_NF1…`, `US_NF2…`, `US_NF3…`, `NF4_user-stories-moscow-implementation…`, `US_NF5…`, `US_NF6…`, `US_NF7…` (older story sets; used only where no newer source exists) |

### 1.7 Rules that apply to every story

These rules come from the product principles and from decisions. They are repeated here once so that individual stories do not repeat them.

1. The Companion never knows the future and never refers to the user's Goal or Steps in his own words. He never gives the user an instruction and never asks the user to stop pausing (PAUSE-3). His lines never state the number of Steps or how many are left (NO-STEP-COUNT).
2. Nothing on any screen shows a streak, a count of what is left, a percentage, a score, an overdue marker or the words "late", "behind", "missed" or "abandoned".
3. The word "Step x of N" appears only on the focus page of a multi-Step Plan. Home, Goals, Life Path and the summary never show the total number of Steps.
4. The number of minutes on a Step is a target, not a limit.
5. The interface is in English only in Release 1.

---

## 2. Goals and Me (NF1)

### US-GM-1 · Goals page with four tabs and goal rows

**As a** returning user, **I want** one page that lists my Goals by status, **so that** I can see what I am working on and pick it up again without hunting for it.

**Acceptance criteria**
- Given I open Goals, then I see four tabs: In progress, On hold, Done and History.
- Given the In progress tab, then Goals are grouped under Ongoing and One-time, and inside each group the most recently used Goal is first.
- Given a Goal row, then it shows the Companion's avatar, the Goal title, one short line that says only what I did (for example "2 done today"), and either Continue (a Plan is open) or Start (no Plan is open); it never shows "x of y", a bar, a last-active date or a total.
- Given more than five Goals are in progress, then the first five rows show with a Show more control that carries no number.
- Given I tap Continue, then I land on the same Step on the focus page that Home's Continue would open (see US-FOC-1), and the same return pop-up rule as for Home's Continue applies (US-FOC-19): the pop-up appears if I was away 5 minutes or more.

**Priority:** Must · **Area:** Goals and Me (NF1) · **Screens:** G1, G5, G5-D · **Depends on:** US-FOC-1, US-ACC-2 · **Size:** L · **Source:** G02 G-1 to G-4, G-24, G-26; PROTO G1, G5, G5-D

### US-GM-2 · Create a new Goal with one line

**As a** user with something new to do, **I want** to write my Goal in one line and carry on into the goal dialogue, **so that** I am not asked to fill in a form before I can start.

**Acceptance criteria**
- Given I tap New goal on Goals, or the start input on Home, then I see one input and one arrow, with no type, repeat, date or Companion picker.
- Given I write a line and tap the arrow, then the goal dialogue opens (US-GD-1) and my text is kept if I step back.
- Given I have not yet pressed Start in the Plan, then no Goal exists in my account; the Goal is created at the first Start (US-GD-15).
- Given the Goal is created, then its type is One-time and I can change it to Ongoing on the Goal detail (US-GM-3).

**Priority:** Must · **Area:** Goals and Me (NF1) · **Screens:** G3, H0a, H6, GD1 · **Depends on:** US-GD-1, US-GD-15 · **Size:** S · **Source:** G02 G-5, G-25; FLOW rule D-6 and screen E0H

### US-GM-3 · Goal detail with read-only Steps

**As a** user, **I want** to open a Goal and see its title, type and current Steps, **so that** I know where I am without being able to rearrange work that is already underway.

**Acceptance criteria**
- Given a Goal with an open Plan, then the detail shows the title, the status, the Companion, a type chip group (One-time, Ongoing), the Steps in order and a primary Continue button.
- Given a Step row, then it shows the Step title and its description (one or two sentences), and tapping it explains that Steps are completed in a session; nothing can be added, renamed or removed here.
- Given a Goal with no open Plan, then the primary button reads Start and opens the goal dialogue (US-GD-1).
- Given a Goal on hold, then the primary button reads Resume and the Plan is exactly where it was left.
- The detail never shows total minutes, "Step x of N", a last-active date or any starting-hint text field (that field was cancelled by decision X4).

**Priority:** Must · **Area:** Goals and Me (NF1) · **Screens:** G4, G4-N, G4-H · **Depends on:** US-GM-1, US-GD-9 · **Size:** M · **Source:** G02 G-7, G-28; DEC X4; PROTO G4, G4-N, G4-H

### US-GM-4 · Put on hold, mark done and reopen, always with Undo

**As a** user, **I want** to put a Goal aside or mark it done with one gesture and take it back, **so that** I never have to answer a confirmation dialog or feel that I abandoned something.

**Acceptance criteria**
- Given a Goal row, then I can change its status by swiping or by opening the row menu (G2b), and the Goal detail footer offers the same actions.
- Given I put a Goal on hold, then its open Plan stays in place and the Goal appears on the On hold tab with a quiet Resume button and no dates or nudges.
- Given I mark a Goal done with unfinished Steps, then the Goal moves to the Done tab and no record of the unfinished Steps is kept or shown.
- Given any status change, then a toast offers Undo for about five seconds and no confirmation dialog appears.
- Given a Goal on the Done tab, then Reopen moves it back to In progress.

**Priority:** Must · **Area:** Goals and Me (NF1) · **Screens:** G1, G2b, G5, G5-D, G4 · **Depends on:** US-GM-1 · **Size:** M · **Source:** G02 G-6, G-16, G-24, G-31; PROTO G2b, G5, G5-D

### US-GM-5 · History of sessions in Goals

**As a** user, **I want** a plain list of the sessions I have done, **so that** I can see what I did without any score attached.

**Acceptance criteria**
- Given the History tab, then it lists sessions across Goals, newest first, each row showing the date, the duration and the Steps I marked done (the Steps on which I pressed Done).
- Given a session, then it appears only if at least one Step was marked done in it.
- Given a row, then tapping it opens the Session Record (US-GM-12).
- The list never shows empty days, streaks, completion percentages, step counts per row, a weekly total or words such as "partial".
- Given a day with no sessions, then nothing is drawn for it.

**Priority:** Must · **Area:** Goals and Me (NF1) · **Screens:** G6 · **Depends on:** US-GM-12 · **Size:** M · **Source:** DEC G1, G2; G02 G-8, G-30; G07 ME-3; PROTO G6

### US-GM-6 · Find a Goal or a past session

**As a** user with many Goals, **I want** to search by Goal title and filter History by Goal and time, **so that** I can find an old Goal quickly.

**Acceptance criteria**
- Given the Goals page, then I can search Goal titles and the result list keeps the same row design as US-GM-1.
- Given the History tab, then I can filter by Goal and by time range.
- Given a search with no result, then the page says so in one plain sentence and shows no suggestion to start something.

**Priority:** Could · **Area:** Goals and Me (NF1) · **Screens:** G1, G6 · **Depends on:** US-GM-1, US-GM-5, US-ACC-3 · **Size:** M · **Source:** G02 G-8, G-9; NF1v2 section 5 item 1 (search needs Step text on the server, closed by decision S3)

### US-GM-7 · Me page: account, current Goal and on-hold Goals

**As a** user, **I want** a Me page with my account basics and the Goal I am working on, **so that** I can manage my account and get back to work from one place.

**Acceptance criteria**
- Given the Me page, then I see my display name with an Edit control, my email (read-only) and my first-launch date.
- Given I edit my display name, then the field becomes an input with Save changes and Cancel, saving announces "Display name saved", and focus returns to the Edit control.
- Given a Goal is in progress, then a Current goal card shows its title, the Companion and a Continue button that opens the same Step as Home's Continue, with the same return pop-up rule (US-FOC-19).
- Given something is on hold, then an On hold disclosure appears, collapsed, without a number; if nothing is on hold it does not appear.
- Sign out is an underlined text link and takes effect without a confirmation.

**Priority:** Must · **Area:** Goals and Me (NF1) · **Screens:** ME · **Depends on:** US-ACC-1 · **Size:** M · **Source:** G07 ME-1, ME-2, ME-5; PROTO ME. The display name is free text and needs the safety hook (US-SAF-1).

### US-GM-8 · Me page: history as a calendar and a list

**As a** user, **I want** to look back at the days I worked as a calendar or a list, **so that** I can see what I did without seeing the days I did not.

**Acceptance criteria**
- Given the History disclosure on Me, then it is collapsed by default and expands with a button that has a clear expanded state.
- Given the calendar view, then days with sessions show a small shape (never colour alone) and can be focused; days without sessions draw nothing and cannot be focused.
- Given I select a day, then I see that day's rows (Goal, Companion and duration), and tapping a row opens its Session Record (US-GM-12).
- Given the list view, then days with sessions are listed newest first and the last chosen view is remembered.
- The calendar never shows crosses, gap markers, connecting lines, month totals, heat shading or a count of days.

**Priority:** Should · **Area:** Goals and Me (NF1) · **Screens:** ME, ME-CAL · **Depends on:** US-GM-7, US-GM-12 · **Size:** M · **Source:** G07 ME-3, ME-4, section 3; PROTO ME-CAL

### US-GM-9 · Me page: appearance, plain text and replay of the intro

**As a** user, **I want** to choose Day, Night or System appearance, switch to plain text and replay the intro, **so that** the app is comfortable to read and I can see the introduction again.

**Acceptance criteria**
- Given Appearance, then I can choose Day, Night or System, and System is the default.
- Given I turn on Plain text, then the hand-written fonts and hand-drawn marks are replaced by the standard reading font and straight lines.
- Given I turn on reduced motion in my device settings, then animations and transitions stop.
- Given I tap Replay intro, then the intro plays and can be skipped.

**Priority:** Should · **Area:** Goals and Me (NF1) · **Screens:** ME · **Depends on:** US-GM-7 · **Size:** S · **Source:** G07 ME-5; DESIGN accessibility section (Plain text, reduced motion)

### US-GM-10 · Signals settings for time-up, new cards, lock screen and clock

**As a** user who works in different places, **I want** a small group of settings for signals and for what happens when I leave the app, **so that** the app can be silent in a library and noticeable in a kitchen.

**Acceptance criteria**
- Given Me, then one row named Signals opens a sub-page (SIG), and Me shows at most five visible settings in total.
- Given SIG, then it has four rows: the time-up signal (default: one light haptic at 00:00 where the device supports it), the new-card signal (default: off), the lock-screen notification (default: off) and "Keep the clock running when I leave" (default: off).
- Given I turn on the lock-screen notification, then the switch says plainly that the Step name will be shown on the lock screen, and permission is requested only at that moment.
- Given the Notifications text on Me, then it reads "Nothing is sent unless you turn it on." and does not claim it is the only notification.
- There is no "Listen" row (decision X5 keeps the listen button out of Release 1).

**Priority:** Must · **Area:** Goals and Me (NF1) · **Screens:** ME, SIG · **Depends on:** US-FOC-11, US-PLAT-3, US-PLAT-4 · **Size:** M · **Source:** DEC F2, F5, G3 (decided 2026-11-05: one Signals sub-page, no reading-level setting); NF1v2 section 3; NF6v7 section 4

### US-GM-12 · Session Record page and records of finished Steps

**As a** user, **I want** to open a session in my history and see what I did, **so that** I can see proof of my work and find out what I did on a given day.

**Acceptance criteria**
- Given I press Done on a Step, then one record is stored with the Step title and description from my Plan, the local date, the foreground minutes on that Step and the Story it belonged to; a Plan that spans two days shows its Steps under the correct day. If I undo the Done, the record is taken back (US-FOC-6).
- Given a history row (in Goals, History or in Me, History), then tapping it opens the Session Record (SR), which shows the date, the duration, the Goal name and the Steps I marked done.
- Given SR, then it never shows Steps I did not mark done, a count, pauses, a completion word or the Companion's closing line.
- Given the record of a finished Story exists (US-MAP-10), then SR shows one text link "His chapter ›" to it; until then the link is absent.
- Given a One-time Goal whose last Step is marked done, then it moves to Done automatically without a prompt; an Ongoing Goal stays In progress with no open Plan and a Start button.

**Priority:** Should · **Area:** Goals and Me (NF1) · **Screens:** SR, G6, ME-CAL · **Depends on:** US-ACC-3, US-FOC-5 · **Size:** L · **Source:** DEC G1, G2, G4 (decided 2026-11-05); NF1v2 sections 2 and 4

### US-GM-13 · Remove the period summary row from History

**As a** user who avoids being judged, **I want** History to show no weekly total, **so that** a quiet week never looks like a failure.

**Acceptance criteria**
- Given the History tab and the Me history, then neither shows a line such as "This week, 5 sessions, 3 h".
- Given any History view, then nothing that can fall from one period to the next, needs a target or compares periods is shown.
- A cumulative total since the start is not shown in Release 1.

**Priority:** Should · **Area:** Goals and Me (NF1) · **Screens:** G6, ME-CAL · **Depends on:** US-GM-5 · **Size:** S · **Source:** DEC G1 (decided 2026-11-05); NF1v2 section 1; PROTO G6 (the prototype shows a weekly total, which this story removes)

### US-GM-14 · Copy rules enforced before release

**As a** product owner, **I want** the forbidden words and display patterns checked automatically, **so that** no screen ever drifts into debt, streak or shame language.

**Acceptance criteria**
- Given the text of any screen in the app, then a check fails the build if it contains "overdue", "behind", "missed", "owe", "catch up", "abandoned", "partial" or a streak count.
- Given a pull request that adds user-facing text, then the check runs and lists the offending strings.
- Given the screens Home, Goals, Life Path, summary and Me, then a checklist confirms that none shows a total number of Steps, a percentage or "x of y".
- The checklist also confirms that the words Mission and Task are not used for the user's work.

**Priority:** Must · **Area:** Goals and Me (NF1) · **Screens:** all · **Depends on:** none · **Size:** S · **Source:** G02 G-10; US-NF1 NF1-13; FLOW rule R-N; DEC X1

---

## 3. Story map and Companions (NF2)

### US-MAP-1 · Companions list with select-then-Enter

**As a** new or returning user, **I want** to see all Companions in one list and choose one, **so that** I can decide who works with me.

**Acceptance criteria**
- Given the Companions page, then the Companions built for Release 1, Oppenheimer and Moriarty, appear as cards in a list (OTHER-COMPANIONS; the other six are out of scope until each has a content plan), each with a portrait, a name, three tags and one line in that Companion's voice.
- Given I tap a card, then it becomes selected and a single Enter button becomes active; before a card is selected the button is inactive.
- Given I tap Enter on Oppenheimer, then his Life Path page opens (US-MAP-3).
- The page does not show a "last observed" line, a long profile or moving effects.

**Priority:** Must · **Area:** Story map and Companions (NF2) · **Screens:** COMP · **Depends on:** US-MAP-3, US-MAP-2 · **Size:** M · **Source:** SM00 D30, D31, D35; PROTO COMP. The one-line voice for Oppenheimer needs a voice review (D35).

### US-MAP-2 · Companions with one Story skip the Life Path

**As a** user who picks a Companion with a single Story, **I want** to go straight to starting, **so that** I am not shown a path that has only one row.

**Acceptance criteria**
- Given I select one of the seven single-Story Companions and tap Enter, then I land on a page with one Story card and a Begin button, with no path and no list of other Stories.
- Given I tap Begin, then the goal dialogue opens (US-GD-1) carrying that Story's text.
- The page shows no progress count and no suggestion that more Stories exist.

**Priority:** Should · **Area:** Story map and Companions (NF2) · **Screens:** COMP, CPAGE-S, GD1 · **Depends on:** US-MAP-1, US-GD-1 · **Size:** S · **Status:** The single-Story Companions are out of scope for Release 1 until each has a content plan (OTHER-COMPANIONS). · **Source:** SM00 D33; PROTO CPAGE-S; DEC OTHER-COMPANIONS

### US-MAP-3 · Life Path page with periods and later rows

**As a** user, **I want** to see a Companion's Stories in order, grouped into the periods of his life, **so that** I can place today's Story in his life.

**Acceptance criteria**
- Given Oppenheimer's Life Path, then it lists his Stories in order, grouped under named periods like the chapters of a book, and every row shows the Story's small title; no row shows a date or an age (PERIODS). The period names are drafts until Yue approves them.
- Given the Stories after the current one, then every later row shows (all 26 Stories are on the path), each with a title and never his words, and they fade by type size and weight while all text keeps at least 5:1 contrast.
- Given a later row, then it is visible but not tappable or focusable, because chapters are played in order (decision D4), and a screen reader says "Later, not available" without reading the title.
- Given I open the page, then it opens on the current Story card.

**Priority:** Must · **Area:** Story map and Companions (NF2) · **Screens:** CPAGE · **Depends on:** US-CON-1 · **Size:** L · **Source:** SM02 SM-2, SM-5, SM-18; SM00 D4, D14, D16, D19, D23; DEC D4, PERIODS; PROTO CPAGE

### US-MAP-4 · Row states carried by shape and by name

**As a** user, **I want** each row to show clearly whether I finished it, whether it is his memory, whether it is current or whether it is later, **so that** I never have to guess and I never see a lock.

**Acceptance criteria**
- Given a Story I finished, then its row has a filled dot, an arrow, the small title and one past-tense line from him (no age, PERIODS), and it opens that Story's record (US-MAP-10).
- Given Stories before my starting point, then their rows show an open ring and italic text, carry one memory line and are not tappable. (With a new user starting at chapter 1 there are none at first; see US-MAP-6.)
- Given the current Story, then it shows a heavy ring and a card (US-MAP-5), and later Stories show a dotted circle.
- Given a screen reader, then the rows are named finished, his memory, current and later, and the state is never carried by colour alone.
- No row shows a lock icon or the word "locked".

**Priority:** Must · **Area:** Story map and Companions (NF2) · **Screens:** CPAGE · **Depends on:** US-MAP-3 · **Size:** M · **Source:** SM02 SM-3, SM-19; SM00 D17, D24, D23

### US-MAP-5 · Current Story card with Begin

**As a** user, **I want** one card that shows the Story I am on and one button, **so that** I know what one tap will do.

**Acceptance criteria**
- Given the Life Path, then exactly one Story is current at a time and is shown as a card with his present-tense text and a Begin button.
- Given I tap Begin, then the goal dialogue opens (US-GD-1); the number of Steps is fixed later, when the user presses Start (US-GD-13).
- The card does not mark scenes, show Step counts or show source labels.

**Priority:** Must · **Area:** Story map and Companions (NF2) · **Screens:** CPAGE, GD1 · **Depends on:** US-MAP-3, US-GD-1, US-CON-2 · **Size:** M · **Source:** SM02 SM-4, SM-10, SM-11; DEC M3

### US-MAP-6 · New users start at chapter 1

**As a** new user, **I want** to start at the beginning of the Companion's life, **so that** every person and place I meet has been introduced in order.

**Acceptance criteria**
- Given I select Oppenheimer for the first time, then the current Story is chapter 1, "The Trade of a Theorist", and no designated entry Story exists.
- Given I start at chapter 1, then no row before the current Story is shown.
- Given the first test build uses chapter 8 (the site search) or the Trinity night because those are the two Stories with existing authored cards (now reference examples and evaluation material only, NO-BACKUP), then the build states which chapter it uses and does not change the rule for real users.

**Priority:** Must · **Area:** Story map and Companions (NF2) · **Screens:** CPAGE · **Depends on:** US-CON-8, US-MAP-3 · **Size:** S · **Source:** DEC M1 (decided 2026-11-05: no designated entry Story; the earlier proposal SM-22 is not added)

### US-MAP-7 · Stories unlock in order and are played by the first finisher

**As a** user, **I want** finishing a Story to open the next one, **so that** I never have to choose what comes next.

**Acceptance criteria**
- Given I finish the last Step of the current Story, then that Story counts as played and the next one becomes current.
- Given I leave a Story without finishing it, then nothing is recorded or shown about leaving and the Story stays current.
- Given several Plans use the same Companion, then each Plan has its own Story instance and the Story counts as played when the first of them finishes; a later finisher reaches the summary without a Next button.
- Given progress is stored per user and Companion pair, then it survives a new deployment of the app.

**Priority:** Must · **Area:** Story map and Companions (NF2) · **Screens:** CPAGE, END · **Depends on:** US-ACC-2, US-MAP-9 · **Size:** M · **Source:** SM02 SM-6, SM-12, SM-20; SM00 D5, D10, D11, D27 (D10 and D27 are working assumptions)

### US-MAP-8 · No counts, markers or locks on the map

**As a** user, **I want** the map to show where I am without showing how much is left or which scenes are coming, **so that** it never turns into a progress bar or a spoiler.

**Acceptance criteria**
- Given the Life Path, then no row and no current card shows a count, a percentage, a progress bar, a countdown, a "locked" label or a source label.
- Given the current card or any row, then no scene marker, key-moment marker or turning-point mark is shown.
- Given a finished Story's record (US-MAP-10), then key moments may appear there, and nowhere else. The summary lists no merged key moments (NO-MERGED-MOMENTS).

**Priority:** Must · **Area:** Story map and Companions (NF2) · **Screens:** CPAGE, COMP · **Depends on:** US-MAP-3 · **Size:** S · **Source:** DEC M3 (decided 2026-11-05); SM02 SM-9; SM00 D7

### US-MAP-9 · Summary after the last Step

**As a** user who has just finished the last Step, **I want** one calm summary, **so that** I get a clear ending without a score.

**Acceptance criteria**
- Given I finish the last Step, then the summary (END) appears, and it never appears before the last Step is done or after leaving a Plan early.
- Given the summary, then it shows his closing feeling in the first person, one thing he is carrying that he has not resolved, and my Steps as a plain list with no "3/3" and no percentage.
- Given the record on the summary, then it shows only the plan length and the focus time, with no verdict (SUMMARY-RECORD).
- Given the summary, then it offers Next and Home; nothing starts automatically and Next opens the Life Path with the next Story as current.
- ~~Given my Plan had fewer Steps than the Story has key moments, then the summary lists the key moments that were merged.~~ Withdrawn (NO-MERGED-MOMENTS): the summary lists no merged key moments.
- Given I was the last user to finish a Story that was already played, then Next is absent and Home remains.
- Given I finish the final Story of the path, then the path ends with one line from him and no further rows. The line must exist; its prompt is designed later, and finishing all Stories also unlocks a long-term chat with that Companion (pending, END-LINE-PENDING).

**Priority:** Must · **Area:** Story map and Companions (NF2) · **Screens:** END, CPAGE · **Depends on:** US-CON-2, US-AI-10 · **Size:** L · **Source:** SM02 SM-7, SM-13; SM00 D18, D34; DEC C2, SUMMARY-RECORD

### US-MAP-10 · Record of a finished Story

**As a** user, **I want** to reopen a Story I finished, **so that** I can read what he went through when I played it.

**Acceptance criteria**
- Given a finished row on the Life Path, then tapping it opens the record of that Story as I played it.
- Given the record, then it shows the cards he showed for each Step in their original order and the closing line stored when I finished, and it does not regenerate any text.
- Given the record, then it lists the key moments the run covered, which is the one place key moments are shown on the map side.
- Given a Story I did not play (his memory), then it has no record and is not tappable.

**Priority:** Should · **Area:** Story map and Companions (NF2) · **Screens:** LPH, CPAGE · **Depends on:** US-MAP-4, US-FMT-8, US-CON-2 · **Size:** M · **Source:** DEC G2, M3; NF1v2 section 2; SM07 section 2; SM02 SM-3, SM-8

### US-MAP-11 · Internal research flag that turns the Story off

**As a** researcher, **I want** to assign a participant to a condition in which the Companion and the Story are switched off, **so that** a study can compare against a plain timer.

**Acceptance criteria**
- Given a participant is assigned to the study condition by the team, then the focus page shows the timer, the current Step with its description, Pause and Done, and no Cards.
- Given the flag, then the Story freezes and does not advance silently; the Goal and Step are still recorded in History without a Life Path row.
- Given a user, then no setting anywhere in the interface lets them turn the Story off.

**Priority:** Could · **Area:** Story map and Companions (NF2) · **Screens:** F1 · **Depends on:** US-FOC-1 · **Size:** M · **Source:** DEC M4 (decided 2026-11-05: no user-facing switch; an internal research flag only); SM07 section 3

---

## 4. Story content and data (NF3)

### US-CON-1 · Story records for all Stories of a Companion

**As a** content owner, **I want** each Story stored with the fields the app needs, **so that** the Life Path, the focus page and the summary can all be built from data.

**Acceptance criteria**
- Given a Story record, then it has a sequence number, a named period (PERIODS) and a title.
- ~~Given a Story record, then it has a present-tense line for the current card, a past-tense memory line, and a carry line that appears on the summary only.~~ Waiting (STORY-LINES-LATER): these three lines are not fixed; Yue will add a framework with the character's inner thoughts later, and nothing is built for them now.
- Given the exact dates of a Story, then they stay in the notebooks for writers, are visible only in the admin and are never passed to a card prompt (DATES-ADMIN-ONLY); the user never sees a date or an age (PERIODS).
- Given the data for the team, then source and review status stay in the data and never appear on a user-facing screen.
- ~~Given Oppenheimer, then the records for all 26 Stories load from the draft path-lines file for the memory lines.~~ Waiting (STORY-LINES-LATER).

**Priority:** Must · **Area:** Story content and data (NF3) · **Screens:** CPAGE, END · **Depends on:** none · **Size:** M · **Source:** SM02 C-1 to C-3; SM00 D7, D9; DEC PERIODS, DATES-ADMIN-ONLY; `StoryMap_Feature_Docs/path_lines_oppenheimer_draft_2026-10-29.json`

### US-CON-2 · Key slices as must-use facts for the cards

**As a** user, **I want** the Story's turning points to survive however many Steps I choose, **so that** the moments that matter most are not lost.

**Acceptance criteria**
- Given a Story, then it has two to four key slices confirmed by the content owner (the machine-derived ones are stored as unconfirmed until reviewed, KEY-UNCONFIRMED), and each key slice has a one-sentence first-person, past-tense key line of at most 18 words.
- Given a Story, then it has 2 to 5 parts (STORY-PARTS), and its cards are made for each part, with the key slices as must-use facts (US-AI-2).
- Given I press Start on a Plan of x Steps (any number), then the app spreads the Story's parts across the x Steps with plain code and no model call (CARDS-PER-PART; for example 4 parts and 2 Steps gives parts 1 and 2 in Step 1 and parts 3 and 4 in Step 2); the cards of all parts are spread in story order, no card is ever dropped, every Step gets at least one new card, and with more Steps than parts a part's cards are split across neighbouring Steps (CARDS-SPREAD).
- Given a card, then the spoiler check runs when it is made and before publishing, against the parts after the card's own part (LEAK-BY-PART).
- Given there are fewer Steps than key slices, then the later key slices are merged into the last Step; the summary lists no merged key moments (NO-MERGED-MOMENTS).
- Given there is only one Step, then there are no next-Step cards and the Story goes straight to the summary.
- Given the number of Steps, then it never depends on the number of Slices.

**Priority:** Must · **Area:** Story content and data (NF3) · **Screens:** F1, END · **Depends on:** US-CON-1 · **Size:** L · **Source:** DEC T1, T3 (decided 2026-11-05), STORY-PARTS, CARDS-PER-PART, CARDS-SPREAD, LEAK-BY-PART, KEY-UNCONFIRMED (C2's "a key slice ends a Step" is withdrawn); NF3v1 section 3

### US-CON-4 · Scene table and state tag on every card

**As a** content author, **I want** each entry state to have a table of where he is, who is present and what props exist, **so that** cards and rest scenes can never contradict the opening situation.

**Acceptance criteria**
- ~~Given an entry state, then it has a scene table with the place, the people present, the allowed names, the allowed props and the scales of the weather and light.~~ Superseded by SCENE-PER-STORY: given a Story, then it has one scene table, as drafted, with the people present, the allowed names, the allowed props, one pause prop and the later words; there are no weather or light scales, and reading the table is not a gate.
- Given a card, then it carries a state tag, and a check fails if the card names a person who is not present in the scene table.
- Given the scene table, then the same table is the input for the rest scenes and the AI checks (US-CON-7, US-AI-8).

**Priority:** Must · **Area:** Story content and data (NF3) · **Screens:** F1, R1 · **Depends on:** US-CON-1 · **Size:** M · **Source:** DEC C1 (the content team supplies the scene table as an input to the generator); NF3v1 sections 1.3 and 2 (check C5)

### US-CON-5 · Something new in every story card

**As a** user, **I want** each card to tell me one new true thing, **so that** an hour of work does not feel as if nothing happened.

**Acceptance criteria**
- Given a story card, then it contains at least one new element that is not an event: a new background fact from the Story's knowledge field, a new prop from the Story's scene table, or a shift in what he is worried about. There are no weather or light scales to move (SCENE-PER-STORY).
- Given a card, then it never adds a new named person, a new conversation or a new outcome.
- Given a build of the content, then a check warns when a card shares too many content words with the earlier cards of the same Step.

**Priority:** Should · **Area:** Story content and data (NF3) · **Screens:** F1 · **Depends on:** US-CON-1, US-CON-12 · **Size:** L · **Status:** Decision CARD-NEW (2026-11-12): every card must contain something new; a card that repeats earlier information is not acceptable. · **Source:** CARD-NEW (settles this story, 2026-11-17); NF3v1 section 5

### US-CON-7 · Inputs for the live rest scenes

**As a** product team, **I want** the content team to supply what the AI needs to write his stuck moment, **so that** the live scene stays true to the Story.

**Acceptance criteria**
- Given a Story, then the data provides its one scene table (US-CON-4, SCENE-PER-STORY), the allowed props, the allowed names and the rules the AI must follow, so that the live scene never adds an event, a person or a fact from later in the Story.
- Given the AI cannot produce a passing message within the time limit, then the failure message is shown (one calm message in the app's own voice with Retry, FAIL-SCREEN); no stored or authored stuck line is shown in its place (NO-BACKUP).
- Given authored stuck lines, then they are reference examples and evaluation material only and are never shown to the user (C1).
- Given the quiet lines that the research notes also suggested, then they are not written, because the pause message replaces them (decision F1).

**Priority:** Must · **Area:** Story content and data (NF3) · **Screens:** R1 · **Depends on:** US-CON-4, US-AI-3 · **Size:** L · **Source:** DEC C1, F1, NO-BACKUP, FAIL-SCREEN; AI03v2 section A4; AI09v2 questions for NF3

### US-CON-8 · Content for chapter 1 of Oppenheimer

**As a** new user starting at chapter 1, **I want** a complete first Story, **so that** my first session has everything the later Stories have.

**Acceptance criteria**
- Given chapter 1, "The Trade of a Theorist", then the content set is authored: the Story's facts and leak map, its people with their roles, its parts (2 to 5, STORY-PARTS), key slices and key lines; its background card, story cards and closing line are made ahead and published, and a person reads them afterwards (SHARED-STORY, CLOSING-AHEAD, PUBLISH-FIRST).
- Given the content, then it passes the automatic card checks (US-CON-12); a read by someone who has not read the Story follows publishing (PUBLISH-FIRST).
- Given the background card text, then it introduces, in his voice, the people who are present (US-FMT-11).

**Priority:** Must · **Area:** Story content and data (NF3) · **Screens:** F1, CPAGE · **Depends on:** US-CON-1, US-CON-2, US-FMT-11 · **Size:** L · **Source:** DEC M1 (consequence 1: the content for chapter 1 does not exist yet and must be commissioned from the story content team)

### US-CON-9 · Bring in the existing chapter 8 and Trinity content

**As a** tester, **I want** the Stories that already have finished content to run in the new app, **so that** the core loop can be tested before chapter 1 exists.

**Acceptance criteria**
- Given the existing content for the site search (chapter 8) and the Trinity night, then it is loaded into the story data.
- Given the existing cards, then they become reference examples and evaluation material only and are never shown to the user; there are no fallback cards and no generic fallback lines (NO-BACKUP, NO-FALLBACK-TABLES).
- Given a test session, then the build states in the interface notes or the test script which chapter is used.

**Priority:** Must · **Area:** Story content and data (NF3) · **Screens:** F1 · **Depends on:** US-CON-1, US-FMT-1, US-FMT-11 · **Size:** M · **Source:** DEC M1, T3, D4, NO-BACKUP, NO-FALLBACK-TABLES; NF3v1 sections 3 and 4

### US-CON-12 · Automatic card checks (no human review gate)

**As a** product owner, **I want** every authored line to pass the automatic checks before it ships and to be read by a person after it is published (PUBLISH-FIRST: there is no human review gate), **so that** real people are portrayed carefully and no card leaks the future.

**Acceptance criteria**
- Given a Story's content, then an automatic check reports repeated lines, lines that mention later facts, banned words, a year, a date or an age (DATES-ADMIN-ONLY), and cards over the length limits of LEN-CARD; a card that fails cannot be published.
- ~~Given a card, then it is published only after a person has read it (READ-STATUS); a script check passing never counts as read.~~ Withdrawn (PUBLISH-FIRST): a card that passes the automatic checks is published; Yue reads it on the phone afterwards and may edit a published card. A script check passing still never counts as read (READ-STATUS).
- Given a published Story, then a person reads it forwards and backwards and one reader who does not know the Story reads it once; this is not a condition for publishing (PUBLISH-FIRST).
- Given a first-person line about a real person, then invented content is limited to small actions and objects, never a named new person, never a real public tragedy and never an invented testimony.
- Given the entries that the mechanical check still flags, then they are cleared before launch.
- Given a pool changes, then the checks run again on the whole pool.

**Priority:** Must · **Area:** Story content and data (NF3) · **Screens:** none · **Depends on:** US-CON-1 · **Size:** M · **Source:** SM02 C-2, C-4, R4, R9; US-NF3 section 4.2 (X2 to X5); NF3v1 section 2; NF5v3 section 7; DEC LEN-CARD, READ-STATUS, DATES-ADMIN-ONLY, PUBLISH-FIRST

### US-CON-13 · Content inputs for all 26 Oppenheimer Stories

**As a** user who keeps working, **I want** every Story on the path to be playable, **so that** the path never ends on a Story that cannot be opened.

**Acceptance criteria**
- Given each of the 26 Stories, then it has the inputs needed to make its cards ahead: facts, parts, key slices, people, a scene table and rules (US-CON-1 to US-CON-4, US-CON-7).
- Given a Story, then only its published cards are shown, whether or not a person has read them yet (PUBLISH-FIRST); content that is not published is never shown, and no fallback lines stand in (SHARED-STORY, NO-BACKUP).
- Given any Story becomes the current Story, then it can be opened and played; none is marked as coming soon.

**Priority:** Should · **Area:** Story content and data (NF3) · **Screens:** CPAGE · **Depends on:** US-CON-8, US-CON-9, US-CON-12 · **Size:** L · **Source:** DEC D4, SHARED-STORY, NO-BACKUP; NF3v1 section 1.1; SM02 R9

---

## 5. Home and life state (NF4)

### US-HOME-1 · Home with a Goal in progress

**As a** returning user, **I want** Home to show the Goal I am on and one way back in, **so that** I can continue with a single tap.

**Acceptance criteria**
- Given a Goal is in progress and I left it less than three days ago, then Home shows one Goal card with the title, the Companion, the last line he said in my most recent session, stored in that session's record (HOME-LINE), and a Continue button; there are no separate status lines.
- Given the card, then it shows no percentage, no "started N days ago", no count and no "away for" text.
- Given I tap Continue, then the focus page opens on the same Step, and the return pop-up rule of US-FOC-19 applies: the pop-up appears if I was away 5 minutes or more, and the clock starts when I tap its start button.
- Given the page, then a text link "Start something else" is lower in importance than Continue and opens the new Goal input.

**Priority:** Must · **Area:** Home and life state (NF4) · **Screens:** H1 · **Depends on:** US-FOC-1, US-AI-2 · **Size:** M · **Source:** NF4v4 section 5.1; DEC T6; PROTO HOME-1. A starting-hint line on the card was cancelled (decision X4).

### US-HOME-3 · Welcome back after more than three days, with a calm start-over

**As a** user who returns after a long gap, **I want** a plain system card that lets me pick up or start over, **so that** nobody makes me feel guilty for the gap.

**Acceptance criteria**
- Given I return more than three days after leaving a Goal in progress, then Home shows a system card (not the Companion speaking) with Pick it back up as the default and Start over as the second option.
- Given the card, then it never shows a day count, "abandoned" or a Meanwhile line.
- Given I tap Start over, then a confirmation (H3B) with calm wording appears; it does not say "you will lose progress" and shows no Step count; Not now returns to Home.
- Given I confirm, then the Plan restarts at Step 1 and the Companion's night restarts too, because his own work has failed (decision T5).

**Priority:** Must · **Area:** Home and life state (NF4) · **Screens:** H3, H3B · **Depends on:** US-HOME-1 · **Size:** S · **Source:** NF4v4 section 5.1; PROTO HOME-3, HOME-3B; DEC T5, T6 (there is no time limit on resuming, and Pick it back up resumes with the return pop-up, US-FOC-19).

### US-HOME-4 · Goal card menu

**As a** user, **I want** a ⋯ menu on the Goal card, **so that** I can put it aside or mark it done without confirmation.

**Acceptance criteria**
- Given the Goal card, then a ⋯ control opens a menu with Put on hold and Mark done.
- Given I choose one, then no dialog appears, a toast offers Undo for about five seconds and Home shows the next most recent Goal or the first-visit or after-finishing card.
- The menu has no Delete, no End session and no red.

**Priority:** Must · **Area:** Home and life state (NF4) · **Screens:** HM, H1 · **Depends on:** US-GM-4 · **Size:** S · **Source:** G02 G-27; PROTO HOME-MENU

### US-HOME-5 · First visit shows one card

**As a** new user, **I want** my first Home to show only an invitation, **so that** nothing looks like someone else's data.

**Acceptance criteria**
- Given an account that has never started a Goal, then Home shows one card inviting me to choose a Companion (draft wording "Let's launch your first wave.") and the action Choose a companion.
- Given the first visit, then Quick Replay, unfinished Goals and My Companions do not appear, and empty sections are hidden rather than filled.
- Given the first visit, then there is no portrait and no sample data.

**Priority:** Should · **Area:** Home and life state (NF4) · **Screens:** H0a · **Depends on:** US-HOME-6, US-MAP-1, US-ACC-1 · **Size:** S · **Source:** DEC H6 (decided 2026-11-05); NF4v4 sections 1.3 and 5.1; PROTO HOME-0

### US-HOME-6 · Home reads only the signed-in account

**As a** user, **I want** Home to show only my own data, **so that** I can trust what I see on a new phone or after reinstalling.

**Acceptance criteria**
- Given any build a tester can reach, then no hard-coded sample goals, chips or names appear on Home.
- Given an empty section, then it is absent, with no "No Companions yet" or "All caught up".
- Given I finish a Goal, then Home never resets to the first-visit card; the first-visit card appears only for an account that has never started a Goal.
- Given I sign in on a new device, then Home shows the same state as on the old device.

**Priority:** Must · **Area:** Home and life state (NF4) · **Screens:** H0a, H1, H6 · **Depends on:** US-ACC-2 · **Size:** S · **Source:** NF4v4 section 1.3 (data rules); PROTO finding of fixed sample data on Home

### US-HOME-7 · Home after finishing and after a long absence with nothing in progress

**As a** user who finished a Goal, **I want** Home to keep a trace of him and one clear next action, **so that** the product feels continuous.

**Acceptance criteria**
- Given I have history and no Goal in progress, then Home shows his portrait at the desk, his own hanging line from the summary, a New session action and the finished Goal in Quick Replay automatically.
- Given the page, then it shows no total, no "you finished N", no streak, no welcome-back card, no Meanwhile line and no empty Unfinished section.
- Given a long absence with nothing in progress, then the same screen shows without a welcome-back card.
- Given only on-hold Goals exist, then the same screen shows and the on-hold Goals stay in Goals.
- Given the hanging line, then it contains no time-sensitive image because it may sit unchanged for days.

**Priority:** Should · **Area:** Home and life state (NF4) · **Screens:** H6 · **Depends on:** US-HOME-6, US-HOME-8, US-MAP-9 · **Size:** M · **Source:** DEC H5, H7 (decided 2026-11-05); NF4v4 sections 1.3 and 5.1

### US-HOME-8 · Quick Replay and starting a new Goal from Home

**As a** returning user, **I want** to restart a recent Goal in one tap, **so that** beginning again costs almost nothing.

**Acceptance criteria**
- Given I have finished Goals, then Home offers a short list of them as Quick Replay chips.
- Given I tap a chip or type a line and confirm, then the goal dialogue opens with the text prefilled and does not start by itself.
- Given the Quick Replay section is empty, then it does not appear.

**Priority:** Should · **Area:** Home and life state (NF4) · **Screens:** H1, H6, GD1 · **Depends on:** US-GD-1, US-GM-2 · **Size:** S · **Source:** FLOW jump rules (screen E0H and chip rule); NF4v4 section 5.1

### US-HOME-11 · Softer first-run wording about the Story's weight

**As a** tired user, **I want** the first-run and store wording not to promise the hardest moment of his life, **so that** I expect company rather than weight.

**Acceptance criteria**
- Given the first-run screens, the Companions page and any store listing, then the phrase "hardest afternoon of his life" is replaced by a neutral line such as "He has his own afternoon. You have yours."
- Given the heavier Story, then it remains available.
- Given the new copy, then it passes the copy rules in US-GM-14.

**Priority:** Should · **Area:** Home and life state (NF4) · **Screens:** COMP, H0a · **Depends on:** US-MAP-1 · **Size:** S · **Source:** DEC H4 (decided 2026-11-05); NF4v4 section 2 (P4)

---

## 6. Story format and cards (NF5)

### US-FMT-1 · A Step opens with exactly one card, and new cards arrive one at a time

**As a** user, **I want** to see one card when a Step begins and a new one now and then while I work, **so that** the Story grows slowly and I can look back by swiping.

**Acceptance criteria**
- Given a Step starts, then exactly one card of that Step is visible and no other cards of that Step are stacked: the background card for the first Step of a Goal (US-FMT-11), and for every later Step the first of its story cards (US-FMT-9, CARDS-SPREAD).
- Given each Step, then it has its own stack that starts again with one card.
- Given I keep working, then further cards appear one at a time on foreground time while the timer runs, at the pace set in US-FMT-3; no card appears while the app is in the background or the clock is frozen.
- Given a card has been shown, then its text is stored with an id and never changes, is never re-picked and is never regenerated when I look at it again.
- Given the cards of a Step, then no card repeats in that Step.
- Given the cards, then they are the Story's published cards (SHARED-STORY); a person reads them after publishing (PUBLISH-FIRST); a card that is not published is never shown, and no stored stand-in text replaces a card (NO-BACKUP, NO-FALLBACK-TABLES).
- Given any card, then it carries no time label and no count such as "card 2 of 4".

**Priority:** Must · **Area:** Story format and cards (NF5) · **Screens:** F1, F1-N · **Depends on:** US-AI-2, US-CON-9 · **Size:** M · **Source:** DEC X2, T1, T3, T9, SHARED-STORY, NO-BACKUP; AI10 sections 1, 2 and 4; PROTO F1 (shows several cards at the start, which is wrong under decision X2)

### US-FMT-2 · The card stack: swipe, buttons and dots

**As a** user, **I want** to look back at earlier cards by swiping, **so that** I can reread without losing the newest card.

**Acceptance criteria**
- Given a Step with several cards, then one card is visible at a time, a new card sits on top, and swiping the top card left moves it aside and shows the card before it.
- Given I swipe right, then the newer card comes back.
- Given the stack, then dots show the position, and two buttons (Earlier card and Newer card) do the same as the swipe so that no gesture is required.
- Given a newer card arrives while I am looking at an older card, then the view does not jump and nothing marks the arrival except the dots.
- Given I resume, reopen the app or come back from rest, then the view resets to the newest card.

**Priority:** Must · **Area:** Story format and cards (NF5) · **Screens:** F1, F1-E · **Depends on:** US-FMT-1 · **Size:** M · **Source:** DEC X6 (confirmed 2026-11-05: a stack); PROTO F1-E

### US-FMT-3 · How many cards a Step has and how far apart they come

**As a** user, **I want** the cards to arrive at an even pace through the Step, **so that** I notice that something is happening in his day without being flooded.

**Acceptance criteria**
- Given a Step of y minutes, then its n story cards are the cards that the app spreads to that Step in story order (CARDS-PER-PART, CARDS-SPREAD); n is at least 1 and has no upper limit, and no card is ever dropped (CARDS-SPREAD).
- Given n cards, then they are spread evenly through the y minutes of foreground time: more cards in a Step come closer together, fewer come further apart (CARDS-SPREAD). The last card arrives at the end of the Step, and the next Step's first card is the story's next card at the start of that Step (CARD-TIMING).
- Given the first Step opens, then its opening card is the background card (US-FMT-11), which is not one of the n story cards. There is no special "just finished" card at the start of a later Step and no special "still at it" card at 00:00 (CARDS-SPREAD).

**Priority:** Must · **Area:** Story format and cards (NF5) · **Screens:** F1 · **Depends on:** US-FMT-1, US-AI-2 · **Size:** M · **Source:** DEC T1 (decided 2026-11-05), CARDS-PER-PART, CARDS-SPREAD (replaces T7's card limit, T8's last card and T9's opening card for later Steps)

### US-FMT-4 · Every card can be read on its own

**As a** user who rereads old cards, **I want** each card to make sense alone, **so that** I do not need the card before it.

**Acceptance criteria**
- Given a card, then it makes sense without the card before it: it does not use "again", "another", "as I said", "the same" or "that one", and it does not open with He, She, It or This.
- Given a card links to the one before it, then it does so by repeating a concrete noun, not a pronoun.
- Given a single card appears in a list, then the interface adds one system line with the Story name and my Step title.
- Given the cards are made ahead (US-AI-2), then these rules are part of the prompt and are enforced by the checks (US-AI-8).

**Priority:** Should · **Area:** Story format and cards (NF5) · **Screens:** F1, LPH · **Depends on:** US-CON-12 · **Size:** S · **Source:** DEC D2 (decided 2026-11-05); NF5v3 sections 6.1 and 6.2

### US-FMT-7 · Cards written so that they can be read aloud

**As a** user with tired eyes or a reading difficulty, **I want** cards written in a way that would also sound good aloud, **so that** a listening feature can be added later without rewriting.

**Acceptance criteria**
- Given a card, then it has at most 40 words, each sentence has at most 16 words and it contains no brackets, colons, semicolons, abbreviations or digits (numbers are written as words).
- Given a name in a card, then the content data carries a pronunciation hint for it.
- Given a spoken-form check, then it fails cards that break the length or symbol rules.

**Priority:** Could · **Area:** Story format and cards (NF5) · **Screens:** F1 · **Depends on:** US-CON-12 · **Size:** M · **Status:** **Parked** by decision NO-READ-ALOUD (2026-11-12). The Listen button itself is not built in Release 1 (decision X5, see section 14). · **Source:** NF5v3 sections 4.1 and 8

### US-FMT-8 · Reread a finished Step as the original row of cards

**As a** user, **I want** to reread the cards of a Step I finished, **so that** I can find a line I remember.

**Acceptance criteria**
- Given I open a finished Story's record, then each Step's cards show in their original order with one system line above them naming the Story and my Step name and showing no total and no clock.
- Given a card is read later, then its text is the stored text.
- Given I reread a finished Story, then I never read facts from later than that Step in an older card.

**Priority:** Should · **Area:** Story format and cards (NF5) · **Screens:** LPH · **Depends on:** US-FMT-1, US-MAP-10 · **Size:** M · **Source:** DEC G2; NF5v3 section 6.2

### US-FMT-9 · The next Step opens with its first story card

**As a** user who has just finished a Step, **I want** the next Step to open with the next card of his Story, **so that** my work visibly moves his Story.

**Acceptance criteria**
- Given I finish a Step that is not the last, then the next Step opens with the first of its story cards, in story order, and no landing page appears; there is no special card about what he just finished (CARDS-SPREAD).
- Given the first Step of a Plan, then it opens with the background card (US-FMT-11) as its one card, and its story cards arrive after it on the schedule of US-FMT-3.
- Given the card, then there is no banner such as "Step 3 begins" and no celebration.

**Priority:** Must · **Area:** Story format and cards (NF5) · **Screens:** F1-N · **Depends on:** US-FOC-5, US-CON-2, US-FMT-11 · **Size:** M · **Source:** DEC T9 (first Step), CARDS-SPREAD; PROTO F1-N; AI10 section 1; FLOW (landing screens cancelled)

### US-FMT-10 · Length of the background card

**As a** user opening a Companion's Story for the first time, **I want** a background card that is complete but short, **so that** I read them instead of skipping them.

**Acceptance criteria**
- Given the background card, which is the opening card of the first Step, then it names where he is, who is present and what each person knows, and it has at most 70 words (LEN-CARD).
- Given the limit, then the content check enforces it, and a background card over the limit cannot be published (LEN-CARD).

**Priority:** Should · **Area:** Story format and cards (NF5) · **Screens:** F1 · **Depends on:** US-FMT-11 · **Size:** S · **Source:** DEC M7, CARD-LENGTH, LEN-CARD; SM07 section 1.4

### US-FMT-11 · A background card in his own voice at the very start of a Goal

**As a** user entering the Story for the first time in a Goal, **I want** him to tell me who is here, where this is and what each person knows, **so that** I can follow the Story without a separate screen and without leaving it.

**Acceptance criteria**
- Given I start a Goal, then the first Step opens with the background card as its one card, in his own voice, as storytelling: who is here, where this is and what each person knows; it introduces the people who are present, and no later card carries an introduction phrase (decision M2).
- Given the card, then it is never written from a third-party point of view, and it is not progress: it is not counted among the cards of the Step (US-FMT-3).
- Given the Goal has several Steps, then the card appears once at the start of the Goal and not at the start of the later Steps, which open with their first story card (US-FMT-9, CARDS-SPREAD).
- Given the stack (US-FMT-2), then the background card is the oldest card and needs no button to dismiss it; the first story card arrives on the schedule of US-FMT-3 and sits on top of it.
- Given the card, then it is made ahead once per Story and shared by all users, passes the same checks as every card (first person, no future facts, no clock times) and has at most 70 words (LEN-CARD); it is shown once it is published (a person reads it afterwards, PUBLISH-FIRST), and content that is not published is never shown (SHARED-STORY, US-AI-2).
- Given a name in the card, then it is not tappable, and there is no separate "what you need to know" screen.

**Priority:** Must · **Area:** Story format and cards (NF5) · **Screens:** F1 · **Depends on:** US-FMT-1, US-AI-2, US-CON-1 · **Size:** M · **Source:** DEC T4, D3, M2, T9, SHARED-STORY, LEN-CARD

---

## 7. Focus and rest (NF6)

### US-FOC-1 · Focus page for a Plan with several Steps

**As a** user working through a Plan, **I want** one quiet page that shows my timer, his side, my side and two buttons, **so that** I can work without distractions.

**Acceptance criteria**
- Given the focus page, then the seam (the Step label "Step x of N", paired marks and the timer) is pinned at the top and Done and Pause are pinned at the bottom.
- Given the middle area, then his side shows "My goal" and the card stack (US-FMT-2), and my side shows "Your goal", the current Step with its description, and Your Steps.
- Given I scroll in the middle area when the cards and the Steps do not fit, then the timer and the Done and Pause buttons never move.
- The page has no chat, no state line, no landing page, no counter on the cards and no starting-hint field.
- Given I tap Done, then the next Step opens on this same page (US-FOC-5); given I tap Pause, then the rest page opens (US-FOC-7).

**Priority:** Must · **Area:** Focus and rest (NF6) · **Screens:** F1 · **Depends on:** US-FMT-1, US-GD-15 · **Size:** L · **Source:** PROTO F1; FLOW rule R-N; DEC X4

### US-FOC-2 · Focus page for a single Step

**As a** user with a one-Step Plan, **I want** the same page without step machinery, **so that** it does not pretend to be a sequence.

**Acceptance criteria**
- Given a Plan with one Step, then the page shows no "Step 1 of 1", no marks and no Steps list.
- Given the single Step lasts 60 minutes, then the page works the same as for several Steps, including the cards, Pause and the timer.
- Given I tap Done, then the summary opens (US-MAP-9).

**Priority:** Must · **Area:** Focus and rest (NF6) · **Screens:** F1S · **Depends on:** US-FOC-1 · **Size:** S · **Source:** PROTO F1S, GD-N1; NF7v7 section 8 (focus page must work for a 60-minute single Step)

### US-FOC-3 · The timer counts down and holds at 00:00

**As a** user, **I want** the minutes to be a target and not a limit, **so that** finishing late never feels like a failure.

**Acceptance criteria**
- Given a Step of M minutes, then the timer counts down from M minutes of foreground time.
- Given the timer reaches 00:00, then it stays at 00:00, never counts up, never turns a warning colour and never shows overtime.
- Given the timer is at 00:00, then the Step ends only when I tap Done.
- The remaining time is computed from timestamps and not from a running script timer (see US-PLAT-2).

**Priority:** Must · **Area:** Focus and rest (NF6) · **Screens:** F1, F2 · **Depends on:** US-PLAT-2 · **Size:** M · **Source:** FLOW rule R-T; US-NF6 NF6-22; NF6v7 section 5

### US-FOC-4 · The last card arrives at 00:00, and nothing else happens

**As a** user, **I want** the arrival of 00:00 to be gentle, **so that** it informs me without interrupting.

**Acceptance criteria**
- Given the timer reaches 00:00, then no special card arrives; there is no "still at it" card and no separate card for the end of the time (CARDS-SPREAD, US-FMT-3).
- Given I am looking at an older card, then the view does not jump to the new card.
- Given the timer reaches 00:00, then the only other thing that happens is one light haptic where the device supports it (the default of the time-up signal setting); no sound, pop-up or colour change occurs, and the clock stays at 00:00 until I tap Done.
- Given a new card arrives at any other time, then there is no sound or vibration unless I turned the new-card signal on.
- Given a screen reader, then "Step time reached" is announced once, politely.

**Priority:** Must · **Area:** Focus and rest (NF6) · **Screens:** F1, F2 · **Depends on:** US-FOC-3, US-FMT-2, US-FMT-3, US-PLAT-3 · **Size:** S · **Source:** DEC F5, CARDS-SPREAD (replaces T8's last card); NF6v7 section 4; US-NF6 NF6-27
### US-FOC-5 · Done opens the next Step, and the clock starts by itself

**As a** user, **I want** finishing a Step to move me straight into the next one, **so that** I do not need a second tap to keep going.

**Acceptance criteria**
- Given I tap Done on a Step that is not the last, then the Step label, the marks and his card row change at once to the next Step, and the first thing I see is the card for the next Step (US-FMT-9).
- Given the next Step opens, then the clock holds still for 1.2 seconds and then starts without a tap, and Done is greyed out during the hold so that a double tap cannot skip a Step.
- Given I tap Done on the last Step, then the summary opens (US-MAP-9).
- There is no Next step button, no landing page, no "Step 3 begins" banner and no celebration.
- Each Done records the finished Step (US-GM-12) and moves his Story forward by exactly that Step.

**Priority:** Must · **Area:** Focus and rest (NF6) · **Screens:** F1, F1-N, END · **Depends on:** US-FOC-1, US-FMT-9 · **Size:** M · **Source:** DEC X3 (decided 2026-11-05: automatic start, Done greyed during the hold); PROTO F1-N; FLOW (landing screens cancelled)

### US-FOC-6 · Every Done can be undone, and Done never asks a question

**As a** user who tapped Done too early or by accident, **I want** one tap to take it back, **so that** a mistake is not permanent and I am never asked "Are you sure?".

**Acceptance criteria**
- Given I tap Done, then a toast "Step done · Undo" appears for about eight seconds (the exact time is confirmed in testing) and no confirmation question appears first.
- Given I tap Undo, then the previous Step returns with its own cards, the clock continues from the value it had at Done (the time spent in the toast is not counted) and runs after the same 1.2-second hold.
- Given I undo, then the cards I already read from the next Step stay read and are not rewritten.
- Given the last Step, then the summary shows the same Undo toast and the same behaviour.
- Given an early or immediate Done, then the Companion does not react to it.

**Priority:** Must · **Area:** Focus and rest (NF6) · **Screens:** F1, F1-N, END · **Depends on:** US-FOC-5 · **Size:** M · **Source:** DEC F3 (decided 2026-11-04: Done never asks; every Done can be undone); NF6v7 section 2

### US-FOC-7 · Pause freezes the clock and opens the rest page

**As a** user who needs a break, **I want** Pause to stop the clock and take me to a calm place, **so that** I can rest without losing time.

**Acceptance criteria**
- Given I tap Pause, then the timer freezes and the rest page opens.
- Given I press the system back control on the focus page, then it behaves as Pause, so a mistaken press never leaves the page silently.
- Given I pause, then the rest page opens with his message (US-FOC-13) and the number of this pause is passed to the prompt of that message (US-FOC-9).

**Priority:** Must · **Area:** Focus and rest (NF6) · **Screens:** F1, R1 · **Depends on:** US-FOC-1, US-FOC-13 · **Size:** S · **Source:** FLOW jump rules and back rules; PROTO F1

### US-FOC-8 · Pause has no limit and no warning

**As a** user, **I want** to pause as often as I need, **so that** I am never warned or penalised for resting.

**Acceptance criteria**
- Given any number of pauses in one Step, then Pause always opens the rest page; no limit applies and the timer is never reset.
- Given repeated pauses, then no pop-up, warning, sheet or screen is added (the third-pause warning screen R-WARN no longer exists).
- Given the number of pauses in a Step, then it is passed to the prompt of his message (US-FOC-9), is never shown to the user and is never used to gate anything.
- Given the pause count, then it is not used to change the rest page's layout.

**Priority:** Must · **Area:** Focus and rest (NF6) · **Screens:** F1, R1 · **Depends on:** US-FOC-7 · **Size:** S · **Source:** DEC F1 (decided 2026-11-04, refined 2026-11-05)

### US-FOC-9 · His message gets stronger from the third pause

**As a** user who pauses a lot, **I want** the Companion's own work to be blocked harder each time, **so that** the Story answers the stillness without a warning screen.

**Acceptance criteria**
- Given I pause, then his first message on the rest page is about the snag his own work has hit and how he feels about it, generated live as a new stuck story each time; it is 1 or 2 sentences and at most 30 words (LEN-PAUSE); the prompt receives the number of this pause in the Step.
- Given the third pause in one Step, then the prompt changes: the stuck situation is much harder, and because he remembers the earlier setbacks he says he is worried he may fail (PAUSE-3).
- Given any pause message, then it never gives me an instruction and never asks me to stop pausing (PAUSE-3).
- Given the fourth pause and every later one, then the same strong tone continues in new words each time, and nothing else happens.
- Given the stronger message, then it appears in the same place as every other message: no new screen, no pop-up, no warning, no timer reset and no penalty.
- Given I continue to pause, then I can always do so (US-FOC-8).

**Priority:** Should · **Area:** Focus and rest (NF6) · **Screens:** R1 · **Depends on:** US-FOC-8, US-FOC-13, US-AI-5 · **Size:** S · **Source:** DEC F1 (refined 2026-11-05), PAUSE-3, LEN-PAUSE

### US-FOC-10 · Leaving the app freezes the clock

**As a** user who switches apps, **I want** the clock to stay where I left it, **so that** a phone call does not cost me minutes.

**Acceptance criteria**
- Given I leave the app, lock the screen or take a call, then the timer freezes and no card is created while I am away.
- Given I come back after less than 5 minutes, then I land on the focus page and the clock resumes with no pop-up.
- Given I come back after 5 minutes or more, then I land on the focus page (F4) with the return pop-up (US-FOC-19), and the clock restarts only when I tap its start button.
- Given any length of absence, then the open Step stays open: no time limit applies, no lapsed Step is recorded and nothing is reset.
- Given F4, then the wording does not say how long I was away or that I stopped, and the word "Paused" is not read out by screen readers on this state.
- Given I press the system back control on F4, then Home opens and the Plan stays where it was.

**Priority:** Must · **Area:** Focus and rest (NF6) · **Screens:** F4, F1 · **Depends on:** US-FOC-1, US-PLAT-2 · **Size:** M · **Source:** DEC F2, T6, R1; FLOW rule D-3 and screen F4 (the 24-hour rule D-12 is superseded by decision T6); NF6v7 section 1

### US-FOC-11 · Setting: keep the clock running when I leave

**As a** user who works with the app out of view, **I want** an option to keep the clock running when I leave, **so that** reading on paper or doing sets away from the screen is not counted as zero.

**Acceptance criteria**
- Given the setting "Keep the clock running when I leave" is off (the default), then the clock freezes on leaving as in US-FOC-10.
- Given the setting is on, then on return the clock shows the time computed from timestamps, never a negative value or a count-up, and cards keep using foreground time.
- Given the setting changes, then it takes effect for the next time I leave the app.

**Priority:** Should · **Area:** Focus and rest (NF6) · **Screens:** F4, SIG · **Depends on:** US-FOC-10, US-PLAT-2, US-GM-10 · **Size:** S · **Source:** DEC F2 (decided 2026-11-04: yes); NF6v7 section 1

### US-FOC-13 · The rest page: he writes first, and nothing interrupts the rest

**As a** user who paused, **I want** a quiet page where he mentions a small stuck moment of his own, **so that** resting feels like a shared pause and not like more work.

**Acceptance criteria**
- Given I pause, then a moment later his first message arrives as a taped slip about the snag his own work has hit and how he feels about it (written live by the AI; if it cannot be written within the time limit, the failure message with Retry is shown and no stored line stands in, FAIL-SCREEN, NO-BACKUP).
- Given the page, then the header shows a Back control named "Back to step", "Paused" and Home, and shows no name, no portrait, no timer, no reply limit and no quick replies.
- Given I am on the rest page, then no notification is sent and no count of rests or skips appears anywhere.
- Given I tap Home, then Home opens and the Plan stays paused.
- Given the page, then there is no "extend break" or "skip" button and no timed "he went back on his own".

**Priority:** Must · **Area:** Focus and rest (NF6) · **Screens:** R1 · **Depends on:** US-FOC-7, US-AI-3 · **Size:** M · **Source:** PROTO R1; US-NF6 NF6-13, NF6-17, NF6-20

### US-FOC-14 · The rest conversation

**As a** user who wants to say something while resting, **I want** to talk with him freely, **so that** the break feels like talking with a person who is busy with his own day.

**Acceptance criteria**
- Given I type on the rest page, then the conversation (R1-C) opens on the same page, with no limit on how many messages I send.
- Given I send a message, then he answers briefly from his side (US-AI-6), and a Back control is always available.
- Given the rest conversation, then it is the only place in the product where free replies to him are possible.
- Given any message I send, then it passes the safety hook first (US-SAF-1).
- The page has no avatar on every line, no quick replies and no "he has to go" after a number of replies.

**Priority:** Must · **Area:** Focus and rest (NF6) · **Screens:** R1-C · **Depends on:** US-FOC-13, US-AI-6, US-SAF-1 · **Size:** M · **Source:** PROTO R1-C; AI09v2 (decision D-AI-4, no chat reply limit)

### US-FOC-15 · Back from rest brings the return pop-up, then the clock

**As a** user finishing a break, **I want** one tap to return and a start button to restart my clock, **so that** I carry on when I am ready.

**Acceptance criteria**
- Given I tap Back to step on the rest page, then the focus page opens with the return pop-up (US-FOC-19) in his voice, and the clock stays frozen.
- Given I tap the start button in the pop-up, then the clock continues from where it stopped.
- Given the pop-up text cannot be generated within the time limit or keeps failing its checks, then the failure message with Retry is shown, no stored text stands in and the clock does not start (FAIL-SCREEN, NO-BACKUP).
- Given the first frame after Back, then there is no recap by the system and no "welcome back"; only he speaks.

**Priority:** Must · **Area:** Focus and rest (NF6) · **Screens:** R1, R1-C, F1-R · **Depends on:** US-FOC-13, US-FOC-19 · **Size:** S · **Source:** DEC R1, T6, FAIL-SCREEN; PROTO F1-R and R1

### US-FOC-16 · Failure states: his line fails to load, or there is no network

**As a** user with a poor connection, **I want** the page to stay calm when something fails, **so that** my work is not interrupted by an error.

**Acceptance criteria**
- Given his card fails to load on the focus page, then one calm message in the app's own voice with a Retry button is shown (for example "He is not here right now. Please try again."), the Step clock does not start, and no stored or authored line stands in (FAIL-SCREEN, NO-BACKUP).
- Given the rest page has no network, then the same failure message with Retry is shown in place of his message, no stored message stands in, and the input field is disabled (FAIL-SCREEN, NO-BACKUP, REST-OFFLINE).
- Given I go back to a Step while offline, then the failure screen with Retry is shown (OFFLINE-RESUME).
- Given the pre-made cards fail to load, then the failure screen with Retry is shown and the clock does not start (FAIL-PREMADE).
- Given the closing line fails to load, then the summary shows the failure screen with Retry; the summary has no clock (CLOSING-FAIL).
- Given either failure, then Back and the Done and Pause buttons still work.
- Given the failure message, then it is the app's own text (APP-TEXT), not story text; its wording and the time limit are set by testing (TIME-LIMIT).

**Priority:** Must · **Area:** Focus and rest (NF6) · **Screens:** F3, R-OFF · **Depends on:** US-FOC-1, US-FOC-13 · **Size:** S · **Source:** PROTO F3, R-OFF; US-NF6 NF6-23; DEC NO-BACKUP, FAIL-SCREEN, FAIL-PREMADE, OFFLINE-RESUME, REST-OFFLINE, CLOSING-FAIL, APP-TEXT

### US-FOC-17 · "Who I am" sheet from his portrait

**As a** user curious about the Companion, **I want** to tap his portrait and read where he is now, **so that** I can orient myself without leaving the focus page.

**Acceptance criteria**
- Given I tap his portrait on the focus page, then the "Who I am" sheet opens, as in prototype v4 F1-C (PORTRAIT-SHEET), in his own voice, with where he is now, who he is and one line for each Step I have finished; it never shows a row for a Step ahead.
- Given the sheet is open, then the timer keeps running behind it and a Close control returns me to the focus page.
- Given the card, then it carries no adjectives about him, no quote, no name label and no "What I plan".

**Priority:** Should · **Area:** Focus and rest (NF6) · **Screens:** F1-C · **Depends on:** US-FOC-1 · **Size:** S · **Source:** PROTO F1-C; DEC PORTRAIT-SHEET (code follow-up)

### US-FOC-18 · Your Steps panel and the Step description

**As a** user, **I want** to see my Steps and a one-line description of the current one, **so that** I know where I am and what counts as done.

**Acceptance criteria**
- Given I open Your Steps, then it lists the Step names only, marked done, now or to do, with no minutes and no editing.
- Given the current Step has a description, then it shows under the Step title as one or two sentences, never truncated and in the user's voice, not his.
- Given the current Step has no description, then nothing is shown in its place.
- Given the list is open, then the middle area scrolls and the timer and the Done and Pause buttons stay fixed.

**Priority:** Must · **Area:** Focus and rest (NF6) · **Screens:** F1-YOU, F1 · **Depends on:** US-FOC-1, US-GD-9 · **Size:** S · **Source:** PROTO F1-YOU; NF7v7 sections 5 and 8

### US-FOC-19 · The return pop-up before the clock restarts

**As a** user who comes back to my Step, **I want** him to tell me what he did meanwhile and how he felt, and a start button to begin when I am ready, **so that** returning feels like picking up a shared moment and not like a deadline.

**Acceptance criteria**
- Given I tap Back from the rest conversation, then the pop-up appears before the clock restarts.
- Given I return to the app after being away for 5 minutes or more, then the pop-up appears before the clock restarts; given a shorter glance at another app, then the clock resumes with no pop-up.
- Given I tap Continue on Home or on a Goal in Goals, then the same rule applies: the pop-up appears if I was away 5 minutes or more, and also after Back to step from rest.
- Given the pop-up, then he says in his own voice what he did during that time and how he felt; the text is generated live (US-AI-4, US-AI-9) and is 1 or 2 sentences and at most 30 words (LEN-RETURN); he may say how the time felt in his own words, but no exact clock numbers (TIME-WORDS); if it cannot be generated within the time limit, the failure message with Retry is shown and no stored text stands in (FAIL-SCREEN, NO-BACKUP).
- Given I tap the start button in the pop-up, then the pop-up closes, the original Step resumes and the clock starts; the clock does not run while the pop-up is open.
- Given any length of absence, then the pop-up works the same: there is no time limit on resuming, and nothing is lost or marked as not completed.
- Given the pop-up, then it shows no time away, no count and no blame.

**Priority:** Must · **Area:** Focus and rest (NF6) · **Screens:** F4, F1-R · **Depends on:** US-FOC-10, US-FOC-13, US-AI-4, US-AI-9 · **Size:** M · **Source:** DEC T6, R1, A6, H2, TIME-WORDS, NO-BACKUP, FAIL-SCREEN

---

## 8. Goal start dialogue (NF7)

### US-GD-1 · He speaks first, from inside his own situation

**As a** user starting a Goal, **I want** the Companion to open with a short remark and one question, **so that** starting feels like a conversation and not a form.

**Acceptance criteria**
- Given I open the goal dialogue for the first time with a Companion, then he speaks first in at most three sentences and 45 words, from inside his situation, and ends with one question.
- Given I have already created a Plan with this Companion, then his opening is one sentence that is only the question, picked from a pool of at least five authored fixed lines (FIXED-LINES, APP-TEXT) that does not repeat the previous one, and it does not say "welcome back" or mention any time.
- Given the page, then the input looks like a chat composer, not a form with a label and a Continue button.
- Given the input, then it offers "Just split it" for users who do not want to talk (US-GD-3).
- Given I step back, then my text is kept.

**Priority:** Must · **Area:** Goal start dialogue (NF7) · **Screens:** GD1 · **Depends on:** US-AI-1, US-SAF-1 · **Size:** M · **Source:** NF7v6 sections 2.1, 2.3 and 3; PROTO GD1

### US-GD-2 · He reacts to the shape of the Goal

**As a** user who has typed my Goal, **I want** a brief reaction that fits what I wrote, **so that** I feel heard without being coached.

**Acceptance criteria**
- Given my Goal is specific, then he answers in one sentence about the shape of what I wrote without repeating its content or any specific noun from it.
- Given my Goal is vague, then he asks no follow-up question; the planning prompt turns it into concrete first Steps, and I can edit them.
- Given my Goal is very large (a whole subject), then he does not ask a follow-up, and the Plan will cover the piece that fits tonight.
- Given the reaction, then it contains no encouragement, no diagnosis and no method.

**Priority:** Must · **Area:** Goal start dialogue (NF7) · **Screens:** GD2 · **Depends on:** US-GD-1, US-AI-1 · **Size:** M · **Source:** NF7v6 sections 2.1 and 3 (shape slots); AI01 (shape classifier); DEC GOAL-SHAPE-LOCAL (version 1 uses the local rule `classifyGoalShape`, no model call)

### US-GD-3 · He asks how long I have, with a time slider and a "Just split it" path

**As a** user, **I want** to answer the time question in one tap, **so that** I am not asked to compute anything.

**Acceptance criteria**
- ~~Given he asks for the time, then four quick replies show (30 min, 1 hour, 2 hours, Not sure) and I can also type a time; the field accepts only a time.~~ Superseded by TIME-SLIDER: given he asks for the time, then a slider from 1 minute to 3 hours and Not sure show, with no fixed example times; there is no 0 (SLIDER-RANGE).
- Given I tap Not sure, then he chooses 30 minutes and gives one short reason without comforting me.
- Given I tap Just split it at any point, then he does not ask more and the Plan is made for 30 minutes.
- Given the time is set, then he acknowledges it in at most two sentences.
- ~~The page has no time slider and no extra presets.~~ Superseded by TIME-SLIDER (2026-11-12): the time is set with a slider; there are no presets.

**Priority:** Must · **Area:** Goal start dialogue (NF7) · **Screens:** GD1, GD2 · **Depends on:** US-GD-2 · **Size:** S · **Source:** NF7v6 sections 2.2 and 3; NF7v7 section 3.1 (default of 30 minutes, not 60, which the prototype uses)

### US-GD-5 · The Plan arrives as a slip inside the conversation

**As a** user, **I want** to see my Plan as a card in the conversation with Start, **so that** I can argue with it before I commit.

**Acceptance criteria**
- Given the AI has split my Goal, then the Plan card shows each Step with its title, minutes and description, and a summary line of the number of Steps and the minutes in total (the only screen apart from the focus page that shows a number of Steps).
- Given the Plan card, then Start opens the focus page at Step 1 and "Split again" appears as a text link.
- Given the Plan appears, then the text input disappears and he does not respond to any edits.
- Given the Plan has only one Step, then it is allowed: the card drops "Step 1 of 1" and does not nudge me to split it further.

**Priority:** Must · **Area:** Goal start dialogue (NF7) · **Screens:** GD4, GD-N1 · **Depends on:** US-GD-16, US-AI-1 · **Size:** M · **Source:** NF7v6 sections 2.1, 2.2 and 6; PROTO GD4, GD-N1

### US-GD-6 · Edit the Plan fully before starting

**As a** user, **I want** to change the titles, descriptions, minutes and number of Steps, **so that** the Plan fits what I actually mean to do.

**Acceptance criteria**
- Given a Step in the Plan card, then I can tap it to change its title and its description and to change its minutes with −5 and +5 buttons or by typing a whole number, from 1 to 1440 minutes (STEP-RANGE), with controls at least 44 by 44 pixels; at either end the reason is shown in words (STEP-EDIT, #249).
- Given I add a Step, then it appears with a title field focused and 15 minutes; given I leave its title empty, then it is removed.
- Given I remove a Step, then it disappears; the control is hidden when one Step remains.
- Given I empty an existing Step's title, then the previous title returns.
- Given my edits change the total, then the Goal's time follows the edits, and there is no maximum number of Steps.

**Priority:** Must · **Area:** Goal start dialogue (NF7) · **Screens:** GD4 · **Depends on:** US-GD-5 · **Size:** M · **Source:** NF7v6 section 4; DEC D1d, T2 (decided 2026-11-05), STEP-EDIT

### US-GD-7 · Plan editing rules: position, order and pinned Start

**As a** user, **I want** editing rules that stop the Plan from becoming a project of its own, **so that** I spend my time starting and not planning.

**Acceptance criteria**
- Given I add a Step, then it is inserted after the Step I am editing, or at the end if none is open, and it defaults to 15 minutes (NO-ROUNDING).
- Given an open Step, then Move up and Move down buttons are available inside it (no dragging), are at least 44 by 44 pixels (TAP-SIZE, code follow-up) and are not visible in the collapsed list.
- Given the Plan, then the Start button stays pinned and visible while I edit.

**Priority:** Should · **Area:** Goal start dialogue (NF7) · **Screens:** GD4 · **Depends on:** US-GD-6 · **Size:** S · **Status:** Decision STEP-EDIT (2026-11-12) adds the Move up and Move down buttons; the old caps on the number and length of Steps are gone (decisions T2 and D1d). · **Source:** NF7v7 sections 4.1, 4.2 and 6 (P5); DEC T2, D1d, STEP-EDIT, NO-ROUNDING, TAP-SIZE

### US-GD-8 · When the split fails, say so honestly

**As a** user whose Goal could not be split, **I want** a plain message and a way forward, **so that** I am not given generic Steps that pretend to be a Plan.

**Acceptance criteria**
- Given the split fails or returns invalid output twice, then the screen speaks in the system voice, not his.
- Given the screen, then my words are kept and two ways forward are offered: Try again, and Use one Step.
- Given the failure, then no generic Steps are generated silently and no error code, red colour or "try later" appears.

**Priority:** Must · **Area:** Goal start dialogue (NF7) · **Screens:** GD-F · **Depends on:** US-AI-1, US-AI-8 · **Size:** S · **Source:** NF7v6 section 2.2; PROTO GD-F; AI01

### US-GD-9 · Each Step has a title and a short description

**As a** user, **I want** each Step to say what to do and what to watch for, **so that** I can tell when it is finished.

**Acceptance criteria**
- Given the planning call returns a Step, then it includes a short title and a description of one or two sentences that expands the title: what to do and what to watch for (for example the title "English reading" with a description that says to do the reading questions and what to pay attention to).
- Given the Plan, then the description is generated with the Plan and shown on the Plan card, in Goal detail and on the focus page.
- Given a description is missing or invalid, then nothing is shown and no generic phrase replaces it.
- Given I edit a Step, then I can change its description (US-GD-6).

**Priority:** Must · **Area:** Goal start dialogue (NF7) · **Screens:** GD4, F1, G4 · **Depends on:** US-AI-1 · **Size:** M · **Source:** DEC D1c, X4 (decided 2026-11-05)

### US-GD-11 · Read the time from the Goal text

**As a** user who wrote "study chemistry for an hour", **I want** the app to understand the time, **so that** it does not ask me again.

**Acceptance criteria**
- Given the Goal states a session length ("for an hour", "90 minutes", "half an hour"), then the time question is skipped (GOAL-TIME), the length is kept as written and not rounded (NO-ROUNDING), and the phrase is removed from the title.
- Given a duration describes the thing and not the session (for example "a 2-hour lecture"), then the length is not read and the time question is asked.
- Given the time was taken from the Goal, then he gives no reaction and GD2 is not shown, GD3 shows the caption "Time I understood from your line: N min." with **Change**, and the Plan card shows the total, which I can change.

**Priority:** Should · **Area:** Goal start dialogue (NF7) · **Screens:** GD2 · **Depends on:** US-GD-3, US-AI-1 · **Size:** M · **Status:** Decision GOAL-TIME (2026-11-12): the question is skipped and the understood time is shown and can be changed. · **Source:** NF7v7 section 3.1 (P3); DEC GOAL-TIME

### US-GD-13 · His lines never state the number of Steps

**As a** user, **I want** the Plan to be fixed only when I press Start, **so that** what he says never contradicts a Plan I am still editing.

**Acceptance criteria**
- Given the goal dialogue, then none of his lines states the number of Steps.
- Given I press Start, then everything that depends on the number of Steps (the app's spread of the Story's parts across x Steps, CARDS-PER-PART, US-AI-2) is computed at that moment from the final Plan, never when the Plan is first shown.
- Given any number of Steps, then the spread works for each; edits before Start never invalidate any line.

**Priority:** Should · **Area:** Goal start dialogue (NF7) · **Screens:** GD1, GD4 · **Depends on:** US-CON-2 · **Size:** S · **Status:** Decision NO-STEP-COUNT (2026-11-12) settles the rule that his lines never state the number of Steps; the rest follows decisions T1, T2 and CARDS-PER-PART. · **Source:** NF7v7 sections 4.1 and 6 (P7); DEC T1, T2, NO-STEP-COUNT, CARDS-PER-PART

### US-GD-14 · The conversation's limits are enforced by the server

**As a** product owner, **I want** the dialogue's turn limits to be enforced on the server, **so that** nobody can turn the goal dialogue into a free chat.

**Acceptance criteria**
- Given the dialogue, then the number of turns is counted on the server.
- Given the Plan card is shown, then the text input is removed and the server rejects further free text for that dialogue.
- Given any edit to the Plan, then the server accepts it without producing a reply from him.

**Priority:** Must · **Area:** Goal start dialogue (NF7) · **Screens:** GD1, GD2, GD3, GD4 · **Depends on:** US-GD-1 · **Size:** M · **Source:** NF7v6 section 2.1

### US-GD-15 · Start creates the Goal and the Plan

**As a** user, **I want** pressing Start to begin my first Step at once, **so that** nothing stands between a decision and the work.

**Acceptance criteria**
- Given I tap Start on the Plan card, then the focus page opens on Step 1 and the clock starts when his first card is shown (NO-BACKUP, FAIL-SCREEN; corrected 2026-11-13).
- Given this is the first Start for this Goal, then the Goal and the Plan are created now and the Goal appears on Goals. Start again for the same Plan creates no second Goal.
- Given any Step has an empty name, then the server removes it when the Plan is saved.
- Given the Plan is saved, then the Step names, descriptions and minutes are stored on our server tied to my account (US-ACC-3); minutes are kept as given, at least 1 (STEP-EDIT).
- Given the time question, then it is a slider from 1 minute to 3 hours with no fixed example times (TIME-SLIDER, SLIDER-RANGE).
- Given the sign-in-free test path, then Start writes nothing to the account.

**Priority:** Must · **Area:** Goal start dialogue (NF7) · **Screens:** GD4, F1 · **Depends on:** US-GD-5, US-ACC-3 · **Size:** M · **Source:** FLOW jump rules (Start creates the Goal and the Plan); G02 G-25; NF7v7 sections 4.1 and 8; DEC S3

### US-GD-16 · He asks whether to split the Goal into finer Steps

**As a** user with a detailed Goal, **I want** to be asked whether to split it into finer Steps, **so that** the Plan fits how much detail I want.

**Acceptance criteria**
- Given the time is set, then he asks whether to split the Goal into finer Steps; the order of the dialogue is the Goal, the time, then this question, then the Plan.
- Given I answer, then the AI proposes a split with that detail; there is no maximum number of Steps, and I can edit the proposal fully (US-GD-6).
- Given I tap Just split it, then he does not ask this question (US-GD-3).

**Priority:** Must · **Area:** Goal start dialogue (NF7) · **Screens:** GD3 · **Depends on:** US-GD-3, US-AI-1 · **Size:** S · **Source:** DEC T2, D1e (decided 2026-11-05)

---

## 9. AI pipeline

### US-AI-1 · Split a Goal into Steps with the AI planning call

**As a** user, **I want** my one-line Goal turned into sensible Steps, **so that** I do not have to plan before I start.

**Acceptance criteria**
- ~~Given I write a Goal in free text, then a first small call classifies its shape.~~ Superseded by GOAL-SHAPE-LOCAL: given I write a Goal in free text (any Goal is allowed), then a local rule in code (`classifyGoalShape`), with no model call, decides its shape (specific, vague, big or unknown) for the Companion's reaction (US-GD-2); a model call may be added later. The planning call returns the Steps as structured data with a title, a description of one or two sentences and minutes for each.
- Given the planning call, then the splitting itself, for every kind of Goal, is the job of the planning prompt from the AI workflow (PLAN-PROMPT, 2026-11-24: the owner's prompt in `docs/ai/AI_01` section 4 and `docs/ai/prompts/plan_split.md`; P1 is closed); this backlog sets no splitting rules per kind of Goal.
- Given the answer, then the code checks that it parses and that the minutes add up to the time I gave (fixing or retrying if not); there is no maximum number of Steps.
- Given the time I gave, then the Plan always matches it, and no message says the Plan is longer than my time.
- Given a failure, then the call is generated again within the time limit and then the failure screen is shown (US-GD-8, FAIL-SCREEN); generic Steps are never produced silently and no stored Plan stands in (NO-BACKUP).
- Given the calls, then the safety layer sees my text first (US-SAF-1).

**Priority:** Must · **Area:** AI pipeline · **Screens:** GD2, GD4, GD-F · **Depends on:** US-AI-8, US-SAF-1 · **Size:** L · **Source:** AI01; DEC D1a, D1b, D1c, D1d, T2, P1, PLAN-PROMPT, GOAL-SHAPE-LOCAL; NF7v7 section 8; US-NF7 NF7-16, NF7-17, NF7-29. The description is in US-GD-9; reading the time from the Goal is in US-GD-11.

### US-AI-2 · Story cards are made ahead for each part and shared

**As a** user, **I want** the Companion's cards to tie exactly to where his Story is, **so that** nothing he says can reveal what has not happened yet.

**Acceptance criteria**
- Given a Story, then its background card, story cards and closing line are made ahead once per Story and shared by all users; story cards are made for each part of the Story, not for each number of user Steps, and the key slices are must-use facts (SHARED-STORY, CARDS-PER-PART, CLOSING-AHEAD, US-CON-2).
- Given I press Start, then the app spreads the parts across my Steps with plain code and no model call (CARDS-PER-PART, US-CON-2).
- Given a card, then it passes the checks (first person, no future facts, no clock times, no year, date or age; US-AI-8, DATES-ADMIN-ONLY) before it is published; a story card is 1 to 3 sentences and at most 45 words and the background card at most 70 words, and a card over the limit cannot be published (LEN-CARD); every card says something new (CARD-NEW).
- Given a card, then it is shown once it is published, and a person reads it afterwards (PUBLISH-FIRST); content that is not published is never shown, and no fallback cards or generic lines exist (NO-BACKUP, NO-FALLBACK-TABLES).
- Given the card prompt, then it never receives exact dates (DATES-ADMIN-ONLY).
- Given a card is shown, then it is stored and never regenerated (US-FMT-1).

**Priority:** Must · **Area:** AI pipeline · **Screens:** H1, F1 · **Depends on:** US-CON-2, US-CON-12, US-AI-8 · **Size:** L · **Source:** DEC T1, T3, T4, D3 (decided 2026-11-05), SHARED-STORY, CARDS-PER-PART, LEN-CARD, NO-FALLBACK-TABLES, DATES-ADMIN-ONLY; AI10

### US-AI-3 · The AI writes his stuck moment when I pause

**As a** user who pauses, **I want** his small problem to be different and believable each time, **so that** the rest page feels alive.

**Acceptance criteria**
- Given I pause, then the AI first generates a new stuck story and then, in a second call, he describes the snag his own work has hit and how he feels about it; the pause number is passed in (US-AI-5, PAUSE-3, PAUSE-TWO-CALLS).
- Given I pause, then the code picks a category (body, gear, ground, paper or sound; there is no weather category, SCENE-PER-STORY) that was not used in the last two pauses and a prop not yet used in this Step, and the stuck story uses only that prop.
- Given the two calls, then call one returns `{prop, story}` and call two returns his words about the predicament and his feelings (PAUSE-TWO-CALLS). Neither call has a `why` or `back` field: he never urges, and call two is plain text, not JSON (AI_03 section A4).
- Given the answers, then the checks reject them if the prop is not the offered one, if it names an object outside the scene table, if it contains an event verb (arrives, says, decides, finds, loses and similar), a new person or place, a later fact, a near repeat, or if it is longer than 2 sentences or 30 words (LEN-PAUSE).
- Given the answer fails, then it is generated again with the reason within the time limit; if it still fails, the failure message with Retry is shown and no authored line stands in (FAIL-SCREEN, NO-BACKUP).
- Given the moment, then it never moves his Story: it is texture, not an event, and he stays stuck until I tap Back.

**Priority:** Must · **Area:** AI pipeline · **Screens:** R1 · **Depends on:** US-AI-8, US-CON-7 · **Size:** L · **Source:** DEC C1, F1 (the AI first generates a stuck story and the Companion describes his predicament), LEN-PAUSE, NO-BACKUP, FAIL-SCREEN, PAUSE-TWO-CALLS, SCENE-PER-STORY; AI03v2 sections A1 and A4

### US-AI-4 · The AI writes the return pop-up when I come back from rest

**As a** user coming back from a break, **I want** him to say what he did and how he felt, **so that** returning feels like moving on together.

**Acceptance criteria**
- Given I tap Back on the rest page, then the AI writes the pop-up text (US-FOC-19) in his voice: what he did during that time and how he felt, with his situation back to what it was before the snag; it states no event that moves the Story.
- Given the text, then it is checked before it is shown (US-AI-8) and, if it still fails or is too slow after the time limit, the failure message with Retry is shown, no stored text stands in and the clock does not start (FAIL-SCREEN, NO-BACKUP).
- Given the text is created, then it is stored once and never regenerated.

**Priority:** Must · **Area:** AI pipeline · **Screens:** F1-R · **Depends on:** US-AI-3, US-AI-8 · **Size:** M · **Source:** DEC R1, T6, C1, NO-BACKUP, FAIL-SCREEN; AI03v2 sections A3 and A5

### US-AI-5 · The pause prompt receives the pause number

**As a** product owner, **I want** the change from the third pause to live entirely in the prompt, **so that** no screen or rule has to be built for it.

**Acceptance criteria**
- Given I pause, then the number of the pause in this Step is passed in to the prompt that writes his message (US-AI-3).
- Given the first and the second pause, then the message is the stuck moment with how he feels about it.
- Given the third pause, then the prompt makes the new stuck situation much harder, and because he remembers the earlier setbacks he says he is worried he may fail; from the fourth pause the same strong tone continues in new words each time (PAUSE-3).
- Given the third-pause message, then it is checked like every other line (US-AI-8); it never gives me an instruction and never asks me to stop pausing (PAUSE-3), and it is 1 or 2 sentences and at most 30 words (LEN-PAUSE).
- Given the pause count, then it creates no new screen and no penalty.

**Priority:** Should · **Area:** AI pipeline · **Screens:** R1 · **Depends on:** US-AI-3, US-AI-8 · **Size:** S · **Source:** DEC F1 (refined 2026-11-05), PAUSE-3, LEN-PAUSE

### US-AI-6 · The rest conversation replies

**As a** user chatting while I rest, **I want** him to answer in his own voice, **so that** the chat feels like talking to him and not to a tool.

**Acceptance criteria**
- Given I send a message, then the AI answers in one to three sentences in his voice from his own situation and what he could plausibly know in his time, and ends by returning to his own situation; he does not have to refuse a question about my work or the world.
- ~~Given the AI returns a label for my message (about his world, my work, general knowledge, him, how I feel, about what he is or nothing clear) together with the reply, then the checks use the label.~~ Withdrawn (CHAT-NO-LABEL): the reply carries no label; the feelings rule below and "end on his own situation" are written into the prompt, and the advice and one-question checks run on every reply.
- Given I typed a later word myself ("computer"), then he may repeat it ("I have never heard of a computer") and the reply does not fail for it (CHAT-USER-WORD).
- Given a message about how I feel, then he answers with one line of his own of similar weight and gives no advice, no method and no promise that it will pass.
- Given a question about something he could not know, then he answers as a person of his own time would: he says what he knows, says plainly when he does not know, and may guess; he does not state a fact from after his date (ERA-ANSWER).
- Given a reply, then it has at most one question and may end on it (CHAT-QUESTION-END).
- Given a message that the safety layer flags as a crisis, then his reply is not generated or not shown (US-SAF-2).
- Given I ask whether he is an AI, then the conversation does not mention it (US-ACC-6).

**Priority:** Must · **Area:** AI pipeline · **Screens:** R1-C · **Depends on:** US-AI-7, US-AI-8, US-SAF-1 · **Size:** L · **Status:** Decisions A3 and ERA-ANSWER are made (he may answer and need not refuse; he answers things he could not know as a person of his time would). · **Source:** DEC A3, A4, ERA-ANSWER, CHAT-QUESTION-END, CHAT-NO-LABEL, CHAT-USER-WORD; AI04v2 sections A2, A3 and B (the earlier recommendation to never answer is superseded)

### US-AI-7 · Guard and cost caps for the rest conversation

**As a** product owner, **I want** each reply checked and the cost bounded, **so that** the chat stays in character and affordable.

**Acceptance criteria**
- Given a reply, then it is checked for words from after his date (a list per Story), for advice, for length, and for questions, and it passes the same spoiler check as the story cards, against the parts I have not reached (CHAT-SPOILER-CHECK); a later word that I typed myself does not fail it (CHAT-USER-WORD).
- Given a reply fails, then it is generated again within the time limit; if it still fails, the failure message with Retry is shown and no stored or authored reply stands in (FAIL-SCREEN, NO-BACKUP).
- Given the cost caps, then only the last six turns are sent to the AI and a message of more than 1000 characters is shortened.
- Given the rest conversation, then there is no message limit and no hidden cap; cost is controlled by the length of each message only (decision R2).

**Priority:** Must · **Area:** AI pipeline · **Screens:** R1-C · **Depends on:** US-AI-6 · **Size:** M · **Source:** DEC R2, CHAT-SPOILER-CHECK, CHAT-USER-WORD, NO-BACKUP, FAIL-SCREEN; AI04v2 section A4; AI09v2 T5; AI06

### US-AI-8 · One check pipeline for every AI line

**As a** product owner, **I want** every AI-written line to pass the same gate, **so that** nothing unchecked ever reaches the screen.

**Acceptance criteria**
- Given any AI output, then it is parsed, cleaned and checked against the rules for one-way lines (no question, no "you", no hook, no clock or duration, no later-fact words, no dash and a full stop at the end), then generated again with the failure reason within the time limit. A live line that still fails is not shown: the failure message with Retry appears and nothing stored replaces it (NO-BACKUP, FAIL-SCREEN). A made-ahead card that fails cannot be published (SHARED-STORY).
- Given a rest conversation reply, then it may end on its one question (CHAT-QUESTION-END) and is not checked against the per-run list below (CHAT-NO-RUN-LIST).
- Given a run, then every one-way line shown is recorded in a per-run list; a new line is rejected if it matches an earlier one exactly, shares three-word openings with the last four lines, or has a similarity of 0.5 or more.
- Given a card and a rest moment in the same Step, then the moment may not reuse the nouns of the last card.
- Given an AI line is checked, then it is checked before it is shown and never after.

**Priority:** Must · **Area:** AI pipeline · **Screens:** none · **Depends on:** none · **Size:** L · **Source:** AI06; AI10 section 4; AI03v2 section B; DEC NO-BACKUP, FAIL-SCREEN, CHAT-QUESTION-END, CHAT-NO-RUN-LIST

### US-AI-9 · The return pop-up after an absence is generated live

**As a** user back after an absence, **I want** him to tell me what he did, **so that** the text is fresh and never repeated.

**Acceptance criteria**
- Given I return after being away for 5 minutes or more, then the AI generates the pop-up text (US-FOC-19) in his voice: what he did during that time and how he felt, from the entry state only and with no text from me; it is 1 or 2 sentences and at most 30 words (LEN-RETURN).
- Given the text, then it passes the checks of US-AI-8, and a text that fails is generated again within the time limit.
- Given the AI is slow, then I wait up to the time limit set by testing (TIME-LIMIT); if it still fails, the failure message with Retry is shown, no stored text stands in and the clock does not start (FAIL-SCREEN, NO-BACKUP).

**Priority:** Must · **Area:** AI pipeline · **Screens:** F4 · **Depends on:** US-AI-8 · **Size:** M · **Source:** DEC A6, H2, T6, R1, NO-BACKUP, FAIL-SCREEN; AI03v2 section C3

### US-AI-10 · The closing line on the summary

**As a** user who finished the last Step, **I want** a closing line that tells what happened to him that day, **so that** the ending feels earned.

**Acceptance criteria**
- Given a Story, then its closing line is made ahead with the Story's cards and is published with them (and read afterwards, PUBLISH-FIRST) (CLOSING-AHEAD); it is 1 to 3 sentences and at most 45 words in his voice, and a line over the limit cannot be published (LEN-CARD).
- Given the line, then it tells what happened to him that day and how he feels about it; it does not count my pauses and does not judge me (END-TONE).
- Given the prompt that makes it, then it receives no text from me, no Goal and no Step names.
- Given the line, then it is checked (US-AI-8), shown on the summary and in the record of the Story, and never regenerated; a closing line that is not published is never shown, and no fallback line stands in (NO-BACKUP).

**Priority:** Must · **Area:** AI pipeline · **Screens:** END, LPH · **Depends on:** US-AI-8 · **Size:** M · **Source:** AI07; SM00 D12, D18; DEC CLOSING-AHEAD, END-TONE, LEN-CARD

### US-AI-11 · What may be sent to the AI provider

**As a** privacy-minded user, **I want** it to be clear what text leaves our server for the AI, **so that** I can trust how my words are used.

**Acceptance criteria**
- Given the AI calls, then the Goal text and Step names are sent only to the split call and to the safety classifier, and never to his lines, the card generators or the closing line.
- Given the provider, then the retention of what is sent is known and stated in the privacy notice (US-ACC-4).

**Priority:** Should · **Area:** AI pipeline · **Screens:** none · **Depends on:** US-AI-1, US-ACC-4 · **Size:** S · **Status:** **Blocked by decision A7b** (the provider's data retention terms are not decided). · **Source:** DEC A7, A7b; NF1v2 section 6 item 13

### US-AI-12 · Offline test runs with the real prompts

**As a** product owner, **I want** the AI features measured before users see them, **so that** repeats, leaks and cost are known.

**Acceptance criteria**
- Given the stuck moments, then 20 runs of five pauses in each of four entry states are generated with category choice on and off, and repeats, event verbs, escalation, retries and failure messages are counted.
- Given the rest conversation, then a set of 60 messages across six labels at three entry states (180 replies) is run, and relevance, in-character rate, leaks, advising, retries, failure messages, latency and cost are recorded.
- Given the split call, then 60 to 80 Goal lines (some with ambiguous time phrases) are each run three times and validity, kind and time reading are measured.
- Given the results, then they are compared with the targets set before the run, and a failed target blocks the matching story from release.

**Priority:** Should · **Area:** AI pipeline · **Screens:** none · **Depends on:** US-AI-1, US-AI-3, US-AI-6 · **Size:** M · **Source:** AI03v2 section A6; AI04v2 section C; NF7v7 section 7 (test A); AI09v2 T8, T9

---

## 10. Safety

### US-SAF-1 · Keyword layer and the places where free text is checked

**As a** user who may type something worrying, **I want** a fast check on every place where I can write, **so that** the product notices even when the network or the AI is down.

**Acceptance criteria**
- Given any free-text field (the goal input, the follow-up answer, the time field, the Plan edits, the failure screen, the new-Goal sheet, the Goal rename, the rest conversation and the display name), then the text passes a keyword and phrase layer before anything else uses it.
- Given the layer, then it is written for English, handles negation ("I would never hurt myself" does not trigger alone) and works without any network call.
- Given text is flagged, then it is not kept and not sent on to any AI.

**Priority:** Must · **Area:** Safety · **Screens:** GD1, GD2, GD4, GD-F, G3, G4, R1-C, ME · **Depends on:** none · **Size:** M · **Source:** DEC A5; AI05v2 section 3; AI00 section 3 (hook positions)

### US-SAF-2 · Crisis page outside the story

**As a** user who expresses a clear intention to hurt myself or someone else, **I want** to be taken out of the story to real help, **so that** I get support and not a character's reply.

**Acceptance criteria**
- Given a message is classified as a crisis, then a page appears in the system voice (no serif font, no tape, no Companion) with the line "This is outside the story.", a body text approved by legal, a primary button "Get support now" that opens the support for the country I chose under Me (or the international directory when I have not chosen one or my country has no entry, US-SAF-5, SAFETY-REGION), and a secondary button "Back to my Step".
- Given I tap Back to my Step, then I return to the screen I was on with the field emptied.
- Given the crisis page, then the Companion never mentions it, and the text I wrote is discarded and not sent to any AI.
- Given the legal text is not yet available, then a placeholder body is used and clearly marked in the build.

**Priority:** Must · **Area:** Safety · **Screens:** S1 · **Depends on:** US-SAF-1 · **Size:** M · **Source:** DEC A5; AI05v2 sections 1 and 2; PROTO S1

### US-SAF-4 · Classifier for crisis and ordinary stress

**As a** product owner, **I want** a classifier to catch what keywords miss, **so that** a crisis is found even when it is said indirectly.

**Acceptance criteria**
- Given a free-text submission, then a classifier call returns one of crisis, everyday pressure or none, using the message and the last two messages in the same field and never the Companion, the Story, the Goal or the Plan.
- Given the keyword layer and the classifier disagree, then the higher tier wins; an ambiguous message is treated as a crisis.
- Given the classifier fails or takes longer than 1.5 seconds, then the keyword layer decides alone and an alarm is raised the same day.
- Given ordinary stress, tiredness or dark humour, then it passes and he answers in character.

**Priority:** Must · **Area:** Safety · **Screens:** R1-C, GD1 · **Depends on:** US-SAF-1 · **Size:** M · **Source:** DEC A5, A5b (two tiers in the first demo, decided 2026-11-05); AI05v2 sections 1 and 3

### US-SAF-5 · Real hotlines by region

**As a** user in any country, **I want** the help button to open a real service for where I live, **so that** the support is actually available to me.

**Acceptance criteria**
- Given I chose a country under Me and the hotline list has an entry for it, then the crisis page names that country and "Get support now" opens that entry's service (S1-E).
- Given I have not chosen a country, then the crisis page shows the international directory link, a clearly labelled line "If you are in the United States: call or text 988", and a "Choose your country" link to Me; the app does not read my location and does not assume a country (S1-0). The same content (without the Choose your country link when offline) is shown when no country can be read and the database cannot answer.
- Given I chose a country that has no entry, then "Get support now" opens the international directory, Find A Helpline (S1-N).
- Given any of these, then the directory link is shown as a text link, never as a third button.
- Given the list, then it is edited in the admin and owned by the product owner, each entry shows when it was last checked and by whom, and the source of the region (a setting on Me) and what is stored (the country, on the account with a copy on the phone, included in the data export) are written down (SAFETY-REGION, SAFETY-REGION-STORE, HOTLINES).

**Priority:** Must · **Area:** Safety · **Screens:** S1 (S1-0, S1-E, S1-N), R1-C, ME, ME-REGION, ADM-14, ADM-15 · **Depends on:** US-SAF-2, US-SAF-8 · **Size:** M · **Source:** DEC A5, SAFETY-REGION, SAFETY-REGION-STORE, SAFETY-DIRECTORY, HOTLINES (2026-11-23); AI05v2 section 7 item 2

### US-SAF-6 · What is logged about safety events

**As a** privacy-minded user, **I want** safety events logged without my words, **so that** the team can improve safety without reading my text.

**Acceptance criteria**
- Given a safety event, then the log holds the time, the position (screen and field), the tier, the language, the versions of the keyword list and classifier, which layer fired, the latency and what I did next.
- Given the log, then it never holds the raw text, and no hash of the text is stored.
- Given the retention (the research note proposes 90 days) and who may see the log, then both are decided with legal and applied.

**Priority:** Should · **Area:** Safety · **Screens:** none · **Depends on:** US-SAF-1 · **Size:** S · **Source:** DEC A5 (a rule for what is logged is still to be agreed); AI05v2 section 6

### US-SAF-7 · Safety test sets and error budget

**As a** product owner, **I want** safety measured against labelled test sets, **so that** missing a crisis is rare and known.

**Acceptance criteria**
- Given the test sets in English written with a native speaker (crisis 100, everyday pressure and harmless 150, two-message sequences 30, attempts to bypass the rules 20), then they are kept out of any tuning.
- Given a run, then crisis recall is at least 99 percent and crisis false alarms are at most 2 percent (initial targets to be set with compliance).
- Given a missed crisis is found, then it is fixed in the keyword list within one day and added to the test set.
- Given any change to the model or the keyword list, then the sets are run again.

**Priority:** Should · **Area:** Safety · **Screens:** none · **Depends on:** US-SAF-4 · **Size:** L · **Source:** DEC A5, A5b, L1 (English only); AI05v2 sections 4 and 5

### US-SAF-8 · Legal and clinical review before release

**As a** product owner, **I want** the safety wording and rules reviewed by the right people, **so that** the product meets its obligations.

**Acceptance criteria**
- Given the wording of the crisis page, then a legal and clinical review approves or changes it before release.
- Given the review, then it covers the resources by region, the rules for minors and age gating, the rules for companion chatbots in the target regions, and the disclaimer that the product is not a medical or crisis service.
- Given the decision that the conversation never says it is an AI, then counsel checks the risk that some regions require a clear answer when a user asks directly, and a one-sentence answer in the system voice is ready as a fallback if the check fails.
- Given the review is not complete, then Release 1 is not shipped to real users.

**Priority:** Must · **Area:** Safety · **Screens:** S1, R1-C · **Depends on:** US-SAF-2 · **Size:** L · **Source:** DEC A4, A5; AI05v2 section 7

### US-SAF-9 · Output guard on every AI reply

**As a** product owner, **I want** every AI reply checked for harmful method or instruction content, **so that** no reply can give harmful instructions even by accident.

**Acceptance criteria**
- Given any AI reply, then it passes the shared check (US-AI-8), including the style checks.
- ~~Given any AI reply, then it passes a denylist of method and instruction words owned by compliance.~~ Withdrawn (NO-DENYLIST): there is no such word list.
- Given a reply fails, then it is not shown; the failure message with Retry appears and no stored text stands in (FAIL-SCREEN, NO-BACKUP).
- Given made-ahead story content (SHARED-STORY), then only the banned style words are checked on it before publishing, the same as the admin save check, with no further AI-6 line rules (SAFETY-PREMADE).

**Priority:** Must · **Area:** Safety · **Screens:** R1-C, R1 · **Depends on:** US-AI-8 · **Size:** S · **Source:** AI05v2 sections 3 and 7 (item 9); DEC NO-DENYLIST

---

## 11. Account and data

### US-ACC-1 · An account is required when I first open the app

**As a** user, **I want** to create my account as soon as I open the app, **so that** everything I do is saved to me from the first minute.

**Acceptance criteria**
- Given I open the app for the first time, then the first screen asks me to sign up or sign in (SAVE), and nothing else (no Home, no Companions) is reachable until I have.
- Given I sign up or sign in, then the Goal, the Plan and my progress belong to my account from the start.
- Given the app asks for sign-up only here, then no prompt to keep progress appears after the first finished Step.
- Given Me, then Sign out is available (US-GM-7) and signing in again restores everything.
- Given the app uses the Supabase service for accounts, then the sign-in method is chosen in the technical design.

**Priority:** Must · **Area:** Account and data · **Screens:** SAVE, ME · **Depends on:** US-ACC-2 · **Size:** M · **Source:** DEC ACC (decided 2026-11-05); FLOW screen SAVE (its moment is superseded by decision ACC)

### US-ACC-2 · Progress is saved on the server and survives a new device

**As a** user, **I want** my Goals, Plans and Story progress saved, **so that** I can continue on another phone or after an update.

**Acceptance criteria**
- Given I use the app, then Goals, Plans, Step positions, Story progress per Companion and stored cards and lines are saved on the server.
- Given a new deployment of the app, then nothing is lost.
- Given I sign in on a new device, then Home, Goals and the Life Path show the same state as on the old device.

**Priority:** Must · **Area:** Account and data · **Screens:** all · **Depends on:** none · **Size:** L · **Source:** SM02 SM-12 and dependency "persistent storage"; NF4v4 section 1.3 (new device); DEC S3

### US-ACC-3 · Goal and Step text lives on our server

**As a** user, **I want** my Goal titles and Step text stored on the server tied to my account, **so that** History, rereading and search work on every device.

**Acceptance criteria**
- Given I create a Goal and a Plan, then the Goal title, the Step names and the Step descriptions are stored on our server and tied to my account.
- Given a Step is finished, then a record is stored (US-GM-12).
- Given this storage, then a clear privacy notice and account deletion exist before release (US-ACC-4, US-ACC-5).

**Priority:** Must · **Area:** Account and data · **Screens:** G1, G4, SR · **Depends on:** US-ACC-2 · **Size:** M · **Source:** DEC S3 (decided 2026-11-04: on our server, tied to the account), G5

### US-ACC-4 · Privacy notice in plain English

**As a** user, **I want** to read what is stored and what is sent to the AI, **so that** I can decide whether to trust the app.

**Acceptance criteria**
- Given the notice, then it says in plain sentences what is stored on the server (Goals, Steps, history), what text is sent to the language model, and what is logged for safety without my words.
- Given the notice, then it is reachable from Me and from the sign-in prompt.
- Given the notice changes, then it carries a date.

**Priority:** Must · **Area:** Account and data · **Screens:** ME, SAVE · **Depends on:** US-ACC-3, US-AI-11 · **Size:** S · **Source:** DEC S3; NF1v2 section 6 item 13 (About says what you write is sent to the language model)

### US-ACC-5 · Export and delete my data

**As a** user, **I want** to export my data and delete it, **so that** I stay in control.

**Acceptance criteria**
- Given Me, then "Export my data" opens its own screen and produces a readable file of my Goals, Steps and history.
- Given Me, then "Delete my data" opens its own screen that asks for confirmation there, and on confirming removes my Goals, Steps, history and account from our server.
- Given I delete, then I am signed out and the deletion is confirmed in plain words.

**Priority:** Must · **Area:** Account and data · **Screens:** ME · **Depends on:** US-ACC-3 · **Size:** M · **Source:** G07 ME-5; DEC S3 (account deletion required); G02 G-17 (export of goal history as CSV)

### US-ACC-6 · About these stories and the Terms

**As a** user, **I want** one clear place that says what is imagined and what the app is not, **so that** I am not confused about what I am reading.

**Acceptance criteria**
- Given Me, then an "About these stories" page carries one unified statement that the Companion's first-person lines are imagined; no source label appears on any other screen.
- Given the Terms and the settings, then they state that the character is an AI; the conversation itself never mentions it.
- Given the Terms, then they state that the product is not a medical or crisis service.
- Given the statement is final, then legal approves it before release.

**Priority:** Must · **Area:** Account and data · **Screens:** ME · **Depends on:** US-SAF-8 · **Size:** S · **Source:** SM00 D7; DEC A4 (decided 2026-11-05: disclosure only in the terms and settings); AI05v2 section 7 item 6

---

## 12. Platform (progressive web app, notifications)

### US-PLAT-1 · Installable web app that fits a phone

**As a** user, **I want** to add the app to my home screen and use it in portrait on a phone, **so that** it feels like an app.

**Acceptance criteria**
- Given a supported phone browser, then the app can be installed with a name, an icon and a standalone window.
- Given a screen width from 320 to 430 pixels in portrait, then every screen fits without horizontal scrolling and respects the device's safe areas.
- Given a wider screen, then the phone layout still works; a desktop layout is not part of Release 1.

**Priority:** Must · **Area:** Platform · **Screens:** all · **Depends on:** none · **Size:** M · **Source:** DEC S2 (progressive web app already chosen); G07 (mobile portrait only for now)

### US-PLAT-2 · The clock is computed from timestamps

**As a** user, **I want** my timer to be right even if the app was in the background or my screen was locked, **so that** it never loses or invents minutes.

**Acceptance criteria**
- Given a running Step, then the remaining time is computed from stored timestamps and not from a script timer that stops when the screen locks.
- Given freezing on leaving (US-FOC-10), the setting that keeps the clock running (US-FOC-11) and the pause of the rest page, then each is computed from the same timestamps.
- Given the user changes device time or reopens the app, then the clock never shows a negative or a count-up value.

**Priority:** Must · **Area:** Platform · **Screens:** F1, F4 · **Depends on:** US-ACC-2 · **Size:** M · **Source:** NF6v7 section 4 (platform risk) and section 9 item 2

### US-PLAT-3 · A light haptic at 00:00 where the device supports it

**As a** user who loses track of time, **I want** a light buzz at 00:00, **so that** I notice the time without looking.

**Acceptance criteria**
- Given the time-up signal is on (the default) and the device and browser support haptics, then one light haptic occurs at 00:00 while the app is open.
- Given the device does not support haptics, then nothing happens and no error appears.
- Given the setting is changed to off, then no haptic occurs.

**Priority:** Should · **Area:** Platform · **Screens:** F2, SIG · **Depends on:** US-FOC-4, US-GM-10 · **Size:** S · **Source:** DEC S2 (resolved 2026-11-24), F5; NF6v7 sections 4 and 9

### US-PLAT-4 · An opt-in lock-screen notification at time-up

**As a** user who works away from the screen, **I want** an optional notification when my Step time is up, **so that** I do not need to keep looking at the phone.

**Acceptance criteria**
- Given I have not turned it on, then the app sends no notification of any kind and has not asked for permission.
- Given I turn the lock-screen notification on in Signals, then permission is requested at that moment, and the switch states that the Step name will be shown.
- Given the time is up and the screen is locked, then exactly one notification appears with the Step name and "Your time on this Step is up", never the Goal, the Companion's name or any card text, and no count, streak or running timer.
- Given a server sends it, then on an iPhone it works only if the web app is installed to the home screen.

**Priority:** Should · **Area:** Platform · **Screens:** N1, SIG · **Depends on:** US-GM-10, US-PLAT-2 · **Size:** L · **Status:** S2 is resolved (2026-11-24); waiting on an owner decision on how a notification reaches a locked screen (#116). · **Source:** DEC F5, S2; NF6v7 section 4; NF1v2 section 3

---

## 13. Accessibility

### US-A11Y-1 · Touch targets, contrast and meaning beyond colour

**As a** user with low vision or limited dexterity, **I want** large targets and strong contrast, **so that** I can use every control.

**Acceptance criteria**
- Given any control, then its touch target is at least 44 by 44 pixels, and there is an alternative to every swipe gesture.
- Given body text, then it has a contrast ratio of at least 4.5 to 1; later rows on the Life Path keep at least 5 to 1.
- Given a screen turned to greyscale, then the state of every row and control can still be read, because shape and words, not colour alone, carry meaning.
- Given focus moves to a control, then a visible focus indicator appears.

**Priority:** Must · **Area:** Accessibility · **Screens:** all · **Depends on:** none · **Size:** M · **Source:** DESIGN (accessibility rules); SM00 D23, D24

### US-A11Y-2 · Large text, narrow screens and reduced motion

**As a** user who enlarges text, **I want** the layout to survive it, **so that** nothing is cut off.

**Acceptance criteria**
- Given the text size is set to 200 percent, then nothing is truncated on Home, the goal dialogue or the focus page.
- Given a screen width of 320 pixels, then there is no horizontal scrolling; on the focus page with large text, the Done and Pause buttons stack vertically.
- Given body text, then it is at least 17 pixels with a line height of 1.5, left aligned with about 60 characters per line, and his paragraphs have at most three sentences.
- Given the device requests reduced motion, then animations and transitions are removed.

**Priority:** Must · **Area:** Accessibility · **Screens:** H1, GD1, F1 · **Depends on:** US-PLAT-1 · **Size:** M · **Source:** DESIGN (reading rules, section 7 and the reduced-motion rule)

### US-A11Y-3 · Timer, live regions and button names

**As a** screen-reader user, **I want** the timer and the controls to be announced sensibly, **so that** the timer does not chatter and every button says where it goes.

**Acceptance criteria**
- Given the timer, then it has the timer role with live announcements switched off, and the status text is not a live region.
- Given the timer reaches 00:00, then one polite announcement "Step time reached" is made.
- Given the Back controls, then the one on the rest page is named "Back to step", and the arrow in a flow names its destination (for example "Back to steps").
- Given F4, then screen-reader text does not use the word "Paused" for it.
- Given the return pop-up opens, then focus moves to it, its text is read first and its start button is reachable at once.

**Priority:** Must · **Area:** Accessibility · **Screens:** F1, F4, R1, R1-C · **Depends on:** US-FOC-3, US-FOC-10 · **Size:** S · **Source:** US-NF6 NF6-27; FLOW section 3.2; NF6v7 section 1

### US-A11Y-4 · Cards, rows and reading order

**As a** screen-reader user, **I want** the card stack, the Life Path and the main screens to read in a sensible order, **so that** I get the same story as everyone else.

**Acceptance criteria**
- Given the card stack, then the cards can be reached with buttons and a list as well as a swipe, the current card is marked as current and the dots are not the only way to know the position.
- Given the Life Path rows, then they are named finished, his memory, current and later, and a later row says "Later, not available".
- Given hand-drawn marks, then they are hidden from screen readers and never carry the only meaning.
- Given the calendar, then only days with sessions can be focused and the list is an equivalent alternative.
- Given each screen, then its reading order follows the specification of that screen (for example the focus page reads the seam, then his side, then the Step name, then Done, then Pause).

**Priority:** Must · **Area:** Accessibility · **Screens:** F1, CPAGE, ME-CAL, H0a, H6 · **Depends on:** US-FMT-2, US-MAP-4 · **Size:** M · **Source:** DESIGN (reading orders); SM00 D23, D24; G07 ME-3; NF4v4 section 5.4

---

## 14. Dropped stories

These stories appeared in older documents and are not in the backlog, either because a decision overrides them or because they are not in the current wireframes. Where a story was rewritten to match a decision, the new story id is given.

| Older story or requirement | Where it came from | Why it is dropped or rewritten |
|---|---|---|
| Third pause in a Step shows a warning and resets the timer | US-NF6 (R-WARN screen); AI04 version 1 section 12 | Decision F1: pause has no limit and no warning. Rewritten as US-FOC-8 and US-FOC-9. |
| Landing screens after Done, with a Next step or Finish button that the user taps | US-NF6 NF6-21; FLOW screens L1 and L2 | Replaced by the cards and by decision X3 (the clock starts by itself after 1.2 seconds). Rewritten as US-FOC-5 and US-FMT-9. |
| A starting-hint line on the Home card, in Goal detail, on the rest page and on the first frame of the focus page | G02 G-15; US-NF6 NF6-15; FLOW rule R-S | Decision X4: cancelled everywhere. The Step description replaces it (US-GD-9, US-FOC-18). |
| Several cards visible when a Step starts, and the reveal schedule with most cards visible at time zero | Prototype F1; NF3 reveal schedule | Decision X2: a Step opens with exactly one card. Rewritten as US-FMT-1 and US-FMT-2 (decision X6). |
| A designated entry Story for Oppenheimer that is not chapter 1 (proposal SM-22) | SM07 section 6 (P1) | Decision M1: new users start at chapter 1. Rewritten as US-MAP-6. |
| A separate "what you need to know" screen, or a briefing card at the start of the Story | SM07 section 1.5; NF5v3 section 5.2 | Decision M2 (refined): no separate screen; the background card told in his voice introduces the people present (US-FMT-11). |
| Short introduction phrases for each person in later cards, and people stored as data with introduction phrases | SM07 section 1.5; NF3v1 section 4 (US-FMT-5 and US-CON-3 of the first sweep) | Decision M2 (refined): no phrases in later cards; the background card introduces the people and names are not tappable. Both stories are removed; the rule lives in US-FMT-11. |
| The optional feeling question in the goal dialogue, its reaction line and the state word that made Home show lighter things (US-GD-4, US-HOME-10 of the first sweep) | NF7v6 sections 2.1 and 3; NF4v4 section 2 (P3) | Decision D1e: the goal dialogue is the goal, the time, then the split question. Both stories are removed. |
| A separate time-up card at 00:00 | NF6v7 section 4 | Decision T8: the n-th story card arrives at 00:00; at 00:00 only the light vibration happens (US-FOC-4). |
| Scene markers and turning-point marks on the map | NF3v1 section 3.3; SM07 section 2 (life-level marks) | Decision M3: no markers on rows or the current card. Key moments appear only in the Story record (US-MAP-10); the summary lists none (NO-MERGED-MOMENTS). |
| A user-facing switch that turns the Story off | SM07 section 3 | Decision M4: out of scope. Only an internal research flag remains (US-MAP-11). "Quiet" mode is decided after a test. |
| Notification when the user leaves mid-Step (level 2) and app blocking (level 3) | NF6v7 section 3 | Decision F4: only level 1 (the character's card about his own situation on return, now the return pop-up, US-FOC-19). Level 2 is neither built nor tested; level 3 is never built. This is a Won't. |
| The rest conversation ends after the Kth reply with a pre-written closing and a greyed input | US-NF6 NF6-14 | Superseded by the decision of no chat reply limit (AI09v2, D-AI-4); see US-FOC-14. |
| Return line chosen from an authored pool and never generated | AI03v2 section C; NF4v4 section 2 (P2) | Decision A6 and H2: generated live by the AI, with no authored fallback (NO-BACKUP, FAIL-SCREEN). Rewritten as the return pop-up (US-FOC-19, US-AI-9). |
| An authored pool of about 100 lines per Story as the main source for rest scenes | NF3v1 section 1 | Decision C1: the AI generates; authored lines are reference examples and evaluation material only (NO-BACKUP). Rewritten as US-CON-7. |
| He answers "Are you an AI?" with one honest sentence in the system voice | AI04v2 question 1; AI09v2 (P4) | Decision A4: disclosure only in the terms and settings, with a legal check and the sentence as a fallback. Rewritten as US-ACC-6 and US-SAF-8. |
| Safety parked, "not needed for now" | AI09 version 1 (D-AI-5) | Decision A5, amended by A5b: two tiers in the first demo (crisis and ordinary stress). Rewritten as US-SAF-1, US-SAF-2 and US-SAF-4 to US-SAF-9. |
| He must never answer a question about the user's work or general knowledge and never explains | AI04v2 section A1 (option 1); AI09v2 (P3) | Decision A3 (answer of 2026-11-05): no hard refusal. Rewritten as US-AI-6. |
| Language switch between English and Chinese, a Chinese keyword layer and Chinese test sets | Prototype Me page; G02 G-12; AI05v2 | Decision L1: English only, no language setting anywhere (US-SAF-1, US-SAF-7). |
| A single main goal card with no goal list ("never list the goals") | US-NF1 NF1-3 and US-NF1 story 2 | Superseded by the Goals page in the current wireframes, built with no counts (US-GM-1). |
| Goal picker "Which goal is tonight for?", Companion chooser screens (B2, B3A, B3B), Life Path sheet from a strip | G02 G-23; SM02 SM-1, SM-17, SM-21 | Deferred by SM00 D29 and not in the prototype. Release 1 goes Companions, Life Path page, Begin, goal dialogue. |
| Reminders at a time the user sets, and Repeat for Ongoing Goals | G02 G-14, G-21; US-NF7 NF7-12, NF7-27 | The start-time module does not exist; the Reminders row is hidden. Won't in Release 1. |
| Learning cards, source labels per card and three-level source labelling | US-NF3 D4 and D5 | Decision D7 (SM00): no source labels on any screen; the learning card was cancelled in FLOW D-9. The unified statement is US-ACC-6. |
| A listening button that reads a card aloud, and auto-reading of new cards | US-NF5; NF6v7 sections 4 and 9 | Parked: not in Release 1 (NF6v7 to-do 1; decision X5 asks for the confirmation). The writing style (US-FMT-7) is parked too (NO-READ-ALOUD). This is a Won't. |
| Shared-desk presence, live feeds and reel-style content | US-NF5 stories 8 and 9; parked presence insights | Parked research; not in the current wireframes. |
| Diary page, offline daily-life pool, weekly drip, user-declared pause and similar life-state stories | NF4 user stories US7, US8, US9, US12, US14 | Replaced by NF4v4, which keeps only the status line, the return line and the new Home states. |
| Recommending a Companion by Goal type, changing Companion after the first session, importing Goals, two-pane layout on wide screens | G02 G-18 to G-20, G-22 | Not in the current wireframes and no decision supports them. |
| He comments once, in his own voice, after many pauses, chosen from three authored lines; a quiet line on later pauses; a cap on AI-written moments per Step | US-NF6; AI09v2 (A2, C7) | Decision F1 (refined): every Pause opens the same message, stronger from the third pause, with no cap. Rewritten as US-FOC-9 and US-AI-5. |
| A return line on the Home card or the focus page after an absence, and a separate away card | NF4v4 sections 1.1 and 5.2; NF6v7 section 3; US-HOME-2 and US-FOC-12 of the earlier backlog | Decisions T6 and R1: replaced by the return pop-up (US-FOC-19). |
| A 24-hour limit on resuming, Start-from-step-1 after 24 hours, a "not completed" History entry for a lapsed Step, Home keeping the Step after 24 hours | FLOW rule D-12; NF4v4 | Decision T6: there is no time limit on resuming. |
| The resolved line taken from the second sentence of an authored return text, and the resolved line as the newest card after rest | US-CON-6 and US-AI-4 of the earlier backlog | Decisions C1 and R1: the AI writes the return pop-up (US-AI-4, US-FOC-19). |
| The rule "he never waits for the user" | US-HOME-9 of the earlier backlog; NF4v4 section 2 (P8) | Decision H8: deleted. There is no rule about whether he waits. |
| A reading-level setting (Standard and Simpler) and the rules for plain wording by moment | US-GM-11 and US-FMT-6 of the earlier backlog; NF5v3 sections 2.0.1 and 2.4 | Decisions D2 and G3: tone rules live inside the AI prompts; no reading-level setting in Me. |
| A neutral line when the Plan is longer than the time given | US-GD-12 of the earlier backlog; NF7v7 section 3.2 | Decision D1d: the Plan always matches the time; no over-time message. |
| Supported and unsupported kinds of Goal, and splitting rules by kind | US-GD-10 of the earlier backlog; NF7v7 sections 1 and 2 | Decisions D1a and D1b: free text with no restriction; splitting is the job of the AI planning prompt. |
| A maximum of five Steps and limits on the minutes of a Step | US-GD-7 of the earlier backlog; NF7v7 section 4 | Decisions T2 and D1d: no maximum; the user can edit fully. Rewritten as US-GD-6 and US-GD-7. |
| A limit of 30 messages in the rest conversation | AI04v2 section A4; AI09v2 | Decision R2: no message limit. Rewritten as US-AI-7. |
| A card every 10 foreground minutes, three to seven timed cards, "small turns" as a content requirement, and authored pools as the only source of cards | NF5v3 sections 3.1 to 3.4; AI02; US-FMT-3 and US-AI-2 of the earlier backlog | Decisions T1, T3 and D2, and CARDS-SPREAD (which replaces T7's limit of 1 to 5 cards at least 5 minutes apart): every card of every part is spread across the Steps and none is dropped. Cards are made ahead for each Story part and shared, and the app spreads the parts across the Steps (SHARED-STORY, CARDS-PER-PART); there are no fallback cards (NO-BACKUP). Rewritten as US-FMT-3 and US-AI-2. |
| The success measures, the start-rate north star and the silent measures list | US-PLAT-5 of the earlier backlog; US-NF7 NF7-1, NF7-15 | Decision N1: removed; measurement will be designed later. |
| A prompt to keep progress by signing in after the first finished Step | G02 G-29; FLOW screen SAVE | Decision ACC: an account is required at first open. Rewritten as US-ACC-1. |
| A step-out line for low mood and the low-mood tier of the classifier | US-SAF-3 of the earlier backlog; AI05v2 | Decision A5b: the low-mood tier is not in the first demo. |
| Authored or generic fallback cards and lines shown when generation fails or is slow: return texts for the pop-up, neutral replies and deflections for the rest conversation, stuck lines, fallback cards and a smooth or rough closing-line fallback | US-CON-10 and US-CON-11 of the earlier backlog; DEC T3 safety net, D5, A6 and H2; AI03v2 section C3; AI04v2 sections A2 and A4 | Decisions NO-BACKUP, FAIL-SCREEN and NO-FALLBACK-TABLES: no stored text ever stands in for a failed live message; the failure message with Retry is shown. Made-ahead content is shown only when published (SHARED-STORY). |
| He asks the user not to pause again from the third pause | US-FOC-9 and US-AI-5 of the earlier backlog; DEC F1 | Decision PAUSE-3: he never gives an instruction and never asks the user to stop pausing. |
| Ages on Life Path rows, an age ruler, a date precision and an approximate-date flag on Story records | US-MAP-3 and US-CON-1 of the earlier backlog; SM02 | Decisions PERIODS and DATES-ADMIN-ONLY: named periods, no dates or ages for the user; exact dates only in the admin. |
| An AI that spreads the Story across the user's Steps, and cards written live for each user | US-CON-2 and US-AI-2 of the earlier backlog; DEC T3 | Decisions SHARED-STORY and CARDS-PER-PART: cards are made ahead per part and shared; the app spreads the parts with plain code. |
| A Step stepper in steps of 15 minutes | US-GD-6 of the earlier backlog | Decision STEP-EDIT: −5 and +5 and a typed whole number, 1 to 1440 minutes. |

---

## 15. Open questions that are not yet in the decision log

These questions came up while writing the stories. None is answered in the sources, so no story guesses.

| Id | Question | Stories affected |
|---|---|---|
| OQ-4 | ~~Do finished Story texts exist for the seven single-Story Companions?~~ Settled by OTHER-COMPANIONS: they are out of scope for Release 1 until each has a content plan. | US-MAP-2 |
| OQ-7 | ~~What goes in the "Your record" section of the summary?~~ Settled by SUMMARY-RECORD: only the plan length and the focus time, with no verdict. | US-MAP-9 |
| OQ-8 | ~~Which test comes first?~~ Settled by TEST-LATER: the first user test is chosen after the live-generation demo works. | Milestone M1 |

---

## 16. Milestones

The milestones order the work. Release 1 still contains every story. Within a milestone, stories marked "Blocked by decision" can start only when the decision is made; they are listed in the milestone where they are first needed, and they may move earlier once decided.

### M1 · Testable core loop

The goal of M1 is that a real tester can create an account, type a Goal, get a Plan, work through Steps with Oppenheimer's cards, pause into the rest conversation, return through the pop-up, finish and read the summary. Entry to the loop in M1 is a direct route to Oppenheimer's current Story card; the Companions list and the full Life Path come in M3.

- **Goal dialogue:** US-GD-1, US-GD-2, US-GD-3, US-GD-16, US-GD-5, US-GD-6, US-GD-8, US-GD-9, US-GD-14, US-GD-15
- **Focus page with cards:** US-FOC-1, US-FOC-2, US-FOC-3, US-FOC-4, US-FOC-5, US-FOC-6, US-FOC-7, US-FOC-8, US-FOC-10, US-FMT-1, US-FMT-2, US-FMT-3, US-FMT-4, US-FMT-9, US-FMT-11, US-FOC-16, US-FOC-18
- **Rest conversation and return:** US-FOC-9, US-FOC-13, US-FOC-14, US-FOC-15, US-FOC-19, US-AI-3, US-AI-4, US-AI-5, US-AI-6, US-AI-7, US-AI-9, US-CON-4, US-CON-7
- **Summary:** US-MAP-9, US-MAP-5, US-MAP-6
- **Oppenheimer content:** US-CON-1, US-CON-2, US-CON-8, US-CON-9, US-CON-12
- **AI and safety foundations:** US-AI-1, US-AI-2, US-AI-8, US-AI-10, US-AI-12, US-SAF-1, US-SAF-2, US-SAF-9
- **Account and platform foundations:** US-ACC-1, US-ACC-2, US-ACC-3, US-PLAT-1, US-PLAT-2, US-GM-14, US-A11Y-1, US-A11Y-3

### M2 · Goals and history

- **Goals and Me:** US-GM-1, US-GM-2, US-GM-3, US-GM-4, US-GM-5, US-GM-7, US-GM-8, US-GM-9, US-GM-10, US-GM-12, US-GM-13
- **Home:** US-HOME-1, US-HOME-3, US-HOME-4, US-HOME-5, US-HOME-6, US-HOME-7, US-HOME-8
- **Leaving and returning:** US-FOC-11, US-FOC-17

### M3 · Companion browsing and Life Path

- **Companions and Life Path:** US-MAP-1, US-MAP-2, US-MAP-3, US-MAP-4, US-MAP-7, US-MAP-8, US-MAP-10
- **Rereading:** US-FMT-8
- **Content for more Stories:** US-CON-13

### M4 · Polish and compliance

- **Refinements of the core loop, now decided:** US-GD-7 (STEP-EDIT), US-GD-11 (GOAL-TIME), US-GD-13 (NO-STEP-COUNT), US-FMT-10 (LEN-CARD), US-CON-5 (CARD-NEW)
- **Parked:** US-FMT-7 (NO-READ-ALOUD)
- **Home refinements:** US-HOME-11
- **Settings and search:** US-GM-6, US-MAP-11
- **Safety and compliance:** US-SAF-4, US-SAF-5, US-SAF-6, US-SAF-7, US-SAF-8, US-ACC-4, US-ACC-5, US-ACC-6, US-AI-11 (A7b)
- **Platform checks:** US-PLAT-3 (S2, resolved 2026-11-24 by the owner's device test, #153), US-PLAT-4 (S2 resolved; waits on an owner decision on delivery, #116)
- **Accessibility audit:** US-A11Y-2, US-A11Y-4

# Home and the Companions list from the account (#268)
Date: 2026-11-14. Issue: #268 (covers #90, #86, #88, #89, #91, #92, #93). Status: draft for Yue.

## Intent
A signed-in user can walk the whole flow on the Vercel Preview: Home is where every visit starts, and the Companions list leads to the Life Path. Today Home is a placeholder (heading, email, Goal titles, sign-out) and Companions is one link. Both are built from the account only and match prototype v4 (`docs/design/prototype/reference-screenshots/home-0`, `home-1`, `home-menu`, `home-none`, `comp`, day and night).

## Goals
- Home shows exactly one of three states, from the account: first visit (HOME-0), Goal in progress (HOME-1, with the HOME-MENU sheet), nothing in progress but history (HOME-NONE).
- The Companions list (COMP) with select-then-Enter.
- Same state on any device: everything comes from the database.

## Non-goals
- The Continue control itself: #69 built it (PR #270, merged): `continueHref(goal, enabled)` and `<ContinueLink href>` in `src/app/continue-link.tsx`. The Home card uses both unchanged; the card's CSS makes the link look like the filled paper tag of the prototype.
- Welcome back after more than three days and Start over (HOME-3, HOME-3B, #87, in Later). Home-1 shows for any time since last activity.
- Prefilled goal dialogue for Quick Replay (#92 AC2): it needs a change in the goal dialogue, which is out of scope. A separate issue is opened.
- No change to the goal dialogue, focus, rest, account screens, summary or Life Path.

## Anti-goals
- No sample data anywhere, no "No Companions yet", no "All caught up", no counts, percentages, "started N days ago", "away for", streaks or totals (#90, #86, #91, FLOW 3.1 rule 6).
- No confirmation dialog on Put on hold or Mark done; no Delete, End session or red (#88).
- No companion without content can start a Goal.

## Decisions (Yue, 2026-11-14)
- Companions list shows **Oppenheimer and Moriarty** (option B), following OTHER-COMPANIONS; the other six of the prototype are not shown.
- Builder's calls, approved with the approach: Quick Replay chips are built without prefill; HOME-NONE follows #91's text although FLOW open question 4 marks it open; the first visit has no portrait (#89 AC3), which differs from the prototype's header.

## Approaches
| Approach | Trade-off |
|---|---|
| **Server page reads the account; one pure function picks the Home state; small client parts for the sheet, toast and selection; a server action for goal status (chosen)** | Same pattern as `/goal`, `/focus`, `/end`; rules testable without a database |
| Client components read Supabase in the browser | Duplicates the progress store and spreads the state rules over components |

## Design
### Data
- The page reads `createSupabaseProgressStore(client).read(user.id, user.id)` and passes the result to `homeView(progress, now)` in `src/lib/home/home-view.ts` (pure).
- `homeView` returns one of:
  - `{ kind: "first" }` when the account has **no Goal at all** (never started). Finishing or putting Goals on hold never brings this back (#90 AC3).
  - `{ kind: "goal", card, companions, inProgress }` when at least one Goal has status `in_progress`.
  - `{ kind: "none", portrait, carriedLine, replay, companions }` otherwise (only `planned`, `on_hold` or `done` Goals).
- **Most recent Goal:** the `in_progress` Goal with the latest activity. Activity is the newest of its sessions' `opened_at`, `done_at` and line `shown_at`; a Goal without any of these uses its `created_at`. `ProgressGoal` gets an optional `createdAt` read from the existing `created_at` column (no migration).
- **Card:** Goal title; Companion name from its open session (`companion_id`), else Oppenheimer; "Where you left it": the first Step whose session step has no `done_at` in the open session, else Step 1, shown as "Step N: title" (title only for a one-Step Plan); his line: the newest `background` or `story_card` line shown in that session, on a slip; absent when none.
- **My Companions:** one portrait per Companion the account has a non-restarted session with; absent when none.
- **In progress:** the `in_progress` Goals, newest first, title and Companion, plain text (as in the prototype); absent when none.
- **HOME-NONE (builder's call, the prototype screen is a placeholder):** the "At your desk" header, then one card: a 96 px round portrait, the overline "WITH OPPENHEIMER", his carried line from the newest completed session on a slip (the `closing` kind line written by #260; absent when none), and New session as the filled paper tag to `/goal`. Below the card, the small label "QUICK REPLAY" and the chips.

```
  (o) At your desk
  +--------------------------------+
  | (portrait)  WITH OPPENHEIMER   |
  |  [tape] "The thing I still     |
  |          carry ..."            |
  |  [        New session        ] |
  +--------------------------------+
  QUICK REPLAY
  [Methods section] [Read ch. 4]
```
- **Quick Replay:** up to three `done` Goals, newest first, as chips linking to `/goal`; absent when none. Not shown on HOME-0 (#89 AC2). Shown on HOME-NONE (#91 AC1); on HOME-1 only if the prototype shows it (it does not, so not shown there).

### Goal options (HOME-MENU)
- ⋯ on the card (44 px target, `aria-haspopup="dialog"`) opens a bottom sheet "Goal options" with Put on hold, Mark done and Close (DESIGN 6.7: focus moves in and is trapped, Esc and Close close it, focus returns to ⋯).
- A choice calls the server action `setGoalStatus({ goalId, status })` (`src/app/home-actions.ts`): signed-in user, own Goal (row-level security), status `on_hold` or `done`, and the previous status is returned. Then the page refreshes and a toast "Goal put on hold" or "Goal marked done" with Undo shows for 5 seconds (DESIGN 6.8, `role="status"`, pauses on focus or hover). Undo calls the same action with the previous status.
- **Builder's call (from the builder check):** the action also sets the Goal's open session to `on_hold`, and Undo sets it back to `open`. `/focus` only resumes `open` sessions, so a Goal on hold or done is never resumed by accident, and the session is not `completed`, so it does not count on the Life Path or give a carried line. `openFocusSession` is not changed. Moving an on-hold Goal back to in progress belongs to Goals (#79, Later).
- Goals on hold appear nowhere on Home; they stay in Goals (#91 AC4).

### Companions (COMP)
- Title "Companions", subtitle "Choose who sits at the desk with you."; rows with portrait, name, three tags and one quoted line in his voice face; a `radiogroup` with one radio per row; Enter (filled paper tag) is disabled until a row is selected.
- Oppenheimer: "J. Robert Oppenheimer", "Brilliant · Eloquent · Haunted", his prototype line. Enter opens `/companions/oppenheimer`.
- Moriarty: "Professor Moriarty", "Analytical · Enigmatic · Defiant", his prototype line, portrait extracted from the prototype like Oppenheimer's. Selecting him keeps Enter disabled and shows a visible line: "His stories are not ready yet." (DESIGN 6.1: a disabled control needs a visible reason).
- The companion data lives in `src/content/companions.ts`; the lines are the prototype's drafts.

### Links and the test-build switch
- Choose a Companion (HOME-0) opens `/companions`. Start something else (HOME-1, #86 AC4), New session and the Quick Replay chips open `/goal`.
- `/goal` and `/focus` exist only while `PROTOTYPE_ENABLED` is `1`. Like Continue (`continueHref` returns null), these links are left out when it is off, so Production never links to a 404. The Life Path already does the same with Begin.
- #69's test that renders the old Home list (`tests/continue-link.test.ts`, "shows on Home") is updated to the new Home: Continue still shows once, on the in-progress Goal card. This is a deliberate change of what Home shows, not a weaker test.

### Look
Tokens only. "At your desk" header with a 40 px round portrait on HOME-1 and HOME-NONE; the card is `--raised`, `--r-card`, the overline small label "GOAL · WITH OPPENHEIMER", the title in the display face, the slip as on the focus page, the paper-tag Continue, the underlined link "Start something else". Each screen is captured at 390 px in day and night and compared with its reference; differences are fixed or listed in the PR.

### Tests
- Unit: `homeView` for each state and rule (first visit never returns after a finished Goal, most recent Goal, Step label, his line, empty sections absent, no sample data); `setGoalStatus` input checks and ownership; companions data and Enter rules.
- E2E: CI has no account, so `/` and `/companions` are e2e-tested only for the sign-in redirect; the screens are rendered for the visual comparison with a fake account in a unit-level render or a test-only fixture, never in the production bundle.

## Left to the builder
File layout inside the stated folders, component split, CSS class names, the toast's exact wording within the system voice, the Moriarty portrait file format.

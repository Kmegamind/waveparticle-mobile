# The Me area and the record pages (#81)
Date: 2026-11-14. Closing issue: #81. Also covers #82, #83, #74, #71, #75, #94. Status: draft for Yue.

## Intent
A signed-in user has a Me area as in prototype v4 (`reference-screenshots/me`, `me-cal`, `me-rec`, `sig`, day and night): account basics, the Goal they are on, settings, and a history that opens a plain record of each session and, from there, the record of a finished Story. Everything is read from the account; no model call, no new content.

## Goals, non-goals, anti-goals
- **Goals:** ME, ME-CAL (calendar and list), SIG, ME-REC (session record), and the record of a finished Story (LPH), with their links.
- **Non-goals (frozen scope; listed under "Left for later" in the PR):** the focus page reading the clock and signal settings (#71 behaviour, #74 time-up and new-card behaviour); writing a record at each Done and moving a One-time Goal to Done (#75 AC1, AC5); the intro and its replay (#83, no intro exists); a hand layer for Plain text to switch off (none is used yet); the Life Path row that opens a Story record (#94 AC1, Life Path rows are not touched); About the stories and Data pages; the lock-screen notification itself (#116).
- **Anti-goals:** no counts, totals, streaks, heat shading, crosses or gap marks; no Steps not marked done; no closing line on ME-REC; no regeneration of any text.

## Decisions (Yue, 2026-11-14)
- **Duration** on ME-REC and history rows is the Plan minutes of the Steps marked done (option A). Focus time is not on the account (decision 0014).
- Builder's calls, accepted with option A: Appearance is Day, Night and System, System by default (#83 over the prototype's two segments); signals are per device; "Keep the clock running" is on the account (`profiles.keep_clock_running`).

## Approaches
| Approach | Trade-off |
|---|---|
| **Server pages read the account with the progress store and `profiles`; pure view functions; small client parts for the disclosure, calendar, segmented control and switches; server actions for name and clock setting (chosen)** | Same pattern as Home and the summary; rules testable without a database |
| Client pages reading Supabase in the browser | Duplicates the store; state rules spread over components |

## Design
### Data
- **Sessions of history:** an account session counts when at least one of its Steps has `done_at` (FLOW: a session appears if at least one Step was finished). Its day is the local date of its first `done_at` (the browser formats it; the server passes ISO times). Restarted sessions count too when they have a done Step.
- **Duration:** the sum of the Plan minutes of its done Steps.
- `meView(progress)` (`src/lib/me/me-view.ts`, pure): current Goal (the same most-recent in-progress Goal as Home's `homeView`), on-hold Goals (titles), and history entries `{ sessionId, goalTitle, companion, firstDoneAt, minutes }` newest first.
- `sessionRecord(progress, sessionId)`: date, minutes, Goal title, done Step titles in Step order, and `storyRecordHref` when the session is `completed` (else null).
- `storyRecord(progress, sessionId)`: story title, cards per Step in original order (`background` and `story_card` lines by Step position then `seq`), the closing line stored on the session, and the merged key moments (`mergedKeyMoments` ids mapped to the story's key slice lines; empty list hides the section). Only for `completed` sessions of this account.

### Screens
- **ME (`/me`)**: title "Me"; avatar with initials, display name with Edit (input with Save changes and Cancel; saving announces "Display name saved" and returns focus to Edit), email read-only, "Since <first-launch date>" (the account's `created_at`); Current goal card (title, Companion, #69's Continue) when a Goal is in progress; On hold disclosure (collapsed, no number) when any; Appearance segmented control (Day, Night, System); History disclosure (collapsed); Signals row; Notifications line "Nothing is sent unless you turn it on."; Sign out as an underlined link (existing `SignOutButton`, kept). At most five visible settings.
- **ME-CAL (History open)**: a view switch Calendar and List (remembered on the device); the calendar shows the current month with a small dot under days with a session; only those days are buttons; choosing one lists its rows (Goal, Companion, minutes), each opening ME-REC; arrows move between months that have sessions. The list shows days newest first with the same rows.
- **SIG (`/me/signals`)**: ‹ ME; "Signals"; the line "Nothing is sent unless you turn it on."; four rows with the prototype's On or Off paper-tag toggles (`role="switch"`, `aria-checked`): Time-up signal (default On), New-card signal (Off), Lock-screen notification (Off; turning it on first asks the browser for notification permission; if refused it stays Off and says so), Keep the clock running when I leave (Off; saved to the account). No Listen row.
- **ME-REC (`/me/history/<sessionId>`)**: ‹ HISTORY; Goal title; "Nov 3 · 30 min"; "Steps you marked done" with a check list; "His chapter ›" to the Story record when the session is completed. Nothing else.
- **Story record (`/me/history/<sessionId>/chapter`)**: ‹ back to the session record; story title; per Step the cards on slips in their order; his closing line; "Key moments" list when the run merged any.

### Settings storage
- Appearance: device storage key `waveparticle.appearance` (`day`, `night`, `system`), applied as `theme-light` or `theme-dark` on `<html>` by a one-line inline script in the root layout before paint and by the control at once; `system` removes both.
- Plain text: device key `waveparticle.plain-text`; sets the class `plain-text` on `<html>` the same way.
- Signals: device key `waveparticle.signals` `{ timeUp, newCard, lockScreen }`.
- Display name and clock: `profiles` (`nickname`, `keep_clock_running`) through server actions with the user's own client (upsert on `user_id`, row-level security).

### Tests
Unit: view functions (history rules, duration, record contents, story record only for completed), settings parsing and defaults, server action input checks, render tests for each screen. E2E: the sign-in redirect for `/me`, `/me/signals` and `/me/history/x`. Visual comparison with a temporary uncommitted fixture, as in #268.

## Left to the builder
File layout inside `src/app/me/` and `src/lib/me/`, component split, class names, the month navigation details.

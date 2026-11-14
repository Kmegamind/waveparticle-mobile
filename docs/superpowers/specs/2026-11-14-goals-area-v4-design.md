# The Goals area to prototype v4: design

Date: 2026-11-14. Issues: #73 (G1 tabs and rows), #77 (G3 New goal), #78 with #39 AC2 (G4, G4-N,
G4-H detail with read-only Steps), #79 (G2b, hold, done, reopen, Undo), #80 (G6 History). One pull
request with one closing issue.

## Intent

Yue wants the signed-in Goals area built so the complete flow can be walked on Preview: one page that
lists the user's Goals by status, a detail page per Goal, a one-line New goal, status changes with
Undo and no confirmation, and a plain history of sessions. Look and behaviour follow prototype v4
(`docs/design/prototype/wp-prototype_2026-11-12_v4_live-ai.html`, `V.goals`, `V.detail`, the `g*`
handlers) and its reference screenshots `reference-screenshots/{g1,g3,g4,g4-n,g4-h,g5,g5-d,g6}-{day,night}.png`.

## Sources, in order

1. Yue's decisions (2026-11-14): scope as listed; a migration for the Goal type; one optional
   starting-line prop on the goal dialogue; Steps show a title and a short description.
2. The prototype's source and screenshots for look and behaviour.
3. The issues' acceptance criteria where the prototype is silent.
4. `TOKENS_FROM_V4.md` and the shared styles from #244 (paper tags, tabs, chips, toast, sheet).

## Goals

- `/goals`: G1 (In progress), G5 (On hold), G5-D (Done), G6 (History) as four tabs; G2b menu; G3 sheet.
- `/goals/[id]`: G4 (open Plan), G4-N (nothing open), G4-H (on hold), and the Done case.
- Status changes from the row menu, the On hold and Done rows, and the detail footer, each with a
  five-second Undo toast and no confirmation.

## Non-goals and anti-goals

- No change to Home, the Me page, the Life Path, focus, rest or summary, and the goal dialogue only
  by the one prop below. No model calls, prompts, caps or content work. No new issues.
- Not built (go under "Left for later" in the pull request): the Session Record (#75), so History
  and Recent sessions rows are not links; swipe gestures on rows (#79 AC1 says "swiping or the row
  menu"; the menu is built); Export; the "This week" history filter (unfinished in the prototype);
  deleting the unfinished Steps of a Goal marked done.
- Failure: any "x of y", bar, last-active date, total minutes, streak, percentage, weekly total or
  per-row Step count; any confirmation dialog; any Goal text in a log.

## Decided

### Data
| Item | Decision |
|---|---|
| Goal type | New migration `supabase/migrations/20261114000000_goal_kind.sql`: `alter table public.goals add column kind text not null default 'one_time' check (kind in ('one_time','ongoing'))`. Existing and new Goals are One-time (#77 AC4). A human applies it to the Supabase project. |
| Missing `kind` column | The reader selects `*` and treats a missing or unknown `kind` as One-time, so the pages work before the migration is applied; `setGoalKindAction` then returns `failed` and the chips say "Could not change the type. Please try again." The pull request asks a human to apply the migration before merging (builder check 4). |
| Reading | A new reader `src/lib/goals/goals-reader.ts` through the user's own Supabase client (row-level security): goals (id, title, status, kind, created_at, updated_at), steps, sessions (id, goal_id, state, companion_id, started_at, last_active_at, completed_at), session_steps (session_id, step_id, position, done_at). It does not change `src/lib/progress/`. |
| Pure rules | `src/lib/goals/goals-view.ts`: tabs, groups, rows, the activity line, history rows, detail state. Unit-tested; no Supabase import. |
| Writes | `src/app/goals/actions.ts` (server actions): `setGoalStatusAction` calls main's `setGoalStatus` with `createSupabaseGoalStatusWriter` unchanged; `resumeGoalAction` finds the Goal's newest `on_hold` session and calls `setGoalStatus({status:"in_progress", sessionId})` so that exact session reopens; `setGoalKindAction`; `renameGoalAction` (trimmed, 1 to 1000 characters, safety gate `gateFreeText`; a crisis result opens `/safety` and nothing is saved). Every action checks its input shape (public endpoint) and returns `{status:"ok"}` or `{status:"failed"}` with no Goal text. |

### Derived values (`goals-view.ts`)
| Value | Rule |
|---|---|
| Last used | The newest of the Goal's sessions' `last_active_at`, `started_at`, any `done_at`, else the Goal's `updated_at`, else `created_at`. |
| Open Plan | The Goal is `in_progress` (or `planned`) and has at least one Step, or it is `on_hold` (its parked session is resumed by Resume). Its Steps are the Goal's Steps in position order; a Step shows done when the Goal's `open` session (else its newest `on_hold` session) has `done_at` set for it. (My call, builder check 2: the focus page resumes only `open` sessions, so Continue on an in-progress Goal opens that session or a fresh one of the same Steps.) |
| Activity line (G1 `<small>`) | Only on the In progress tab: if Steps were marked done today (device local day) across the Goal's sessions, "N done today"; else if this week (Monday start), "N done this week"; else nothing. Never a total, a date or "x of y". |
| Row action | In progress: "Continue" when `continueHref(goal, sessionPagesEnabled)` is not null and the Goal has Steps; "Start" when it has no Steps (the app never creates such a Goal today; builder check 1). On hold: "Resume". Done: "Reopen". |
| `planned` | Shown on the In progress tab like `in_progress` (builder check 3); its status caption reads "In progress". |
| Reopen | `setGoalStatus({status:"in_progress"})` with no session id: the session parked by Mark done stays parked, and Continue starts a fresh run of the same Steps (#79 AC3: no record of unfinished Steps is kept or shown). Undo within five seconds of Mark done still reopens the parked session (main's rule). |
| Start | Opens `/goal?line=<title>`; the dialogue starts with that line in its composer (Yue: one prop). Start then creates a new Goal, as the prototype's `gstart` does; only Goals with no Steps show Start. |
| Session pages off (production) | `/goal` and `/focus` exist only when `PROTOTYPE_ENABLED=1`. When off: no "+ New goal", no Continue or Start; Resume, Reopen, the menu and detail still work. |
| Groups | In progress: "Ongoing" then "One-time" (a group with no rows is not drawn); inside each, last used first. On hold, Done: flat, last used first. |
| Show more | In progress shows the first five rows across both groups, then a "Show more" text link with no number; it shows the rest. |
| History rows | Sessions with at least one Step done, newest first by their newest `done_at`. Row: "Nov 3 · Lab report" (month short name and day, `en-US`, device time zone) and "N min ›" without the link arrow (not a link, see non-goals), where N is the sum of the planned minutes of the Steps marked done in that session (my call: the app stores no measured duration). Under the title, a caption with the titles of the Steps marked done (#80 AC1), comma separated. |
| Search | One field "Search goals and history"; case-insensitive substring on Goal titles (all tabs) and on the Goal title of History rows. Empty result: "No matches." |
| Empty tabs | In progress: "No goals yet." with a "New goal" link (when session pages are on); On hold: "Nothing on hold."; Done: "Nothing finished yet."; History: "Your sessions will show up here." |

### Screens
| Screen | Decision |
|---|---|
| G1 header | "Goals" display title; "+ New goal" small secondary paper tag (accessible name "New goal") on the right; the search field (44 px, `--raised`, 1 px `--edge`, radius 14) under it. |
| Tabs | `role="tablist"` "Goal lists" with four `role="tab"` buttons ("In progress", "On hold", "Done", "History"; each named "<label>, tab n of 4"), `aria-selected`, arrow keys move between tabs. Style from the prototype `.tabs`: 44 px, 14 px weight 500 `--ink-2`; selected weight 700 `--ink` with a 2 px `--ink` bottom border; a 1 px `--hairline` under the row. The tab is kept in the URL (`/goals?tab=hold`) with `router.replace`, so Back from detail returns to it. |
| Goal row | `.grow-r`: min-height 64, 1 px `--hairline` bottom border. A button (opens `/goals/<id>`) holding the 40 px portrait of the Companion of the Goal's newest session (Oppenheimer when none) and the title (600 16/1.25) with the activity line (400 13/1.3 `--faint`); then the row action as a small secondary paper tag named "<Action> <title>"; then "⋯" (44 × 44, 22 px, named "More actions for <title>", `aria-haspopup="dialog"`). |
| G2b | A bottom sheet (`<dialog>`, as Home's): title "Goal menu", "Put on hold" and "Mark done" (secondary paper tags), "Close" (ghost). On a Goal already on hold the menu offers "Mark done" only; on a Done Goal, "Put on hold" only. |
| Toasts | One toast at a time (`role="status"`, five seconds, paused on focus or hover, the shared toast style): "Put on hold." / "Marked done." / "Back in progress." / "Reopened." with "Undo". Undo sends the previous status and the parked session id (main's `undoRequest` shape). A failed change says "Could not change the Goal. Please try again." and keeps the row as it was; a failed Undo says "Could not undo. Please try again." with Undo again. After a change the page refreshes (`router.refresh`) and the tab stays. |
| G3 | "+ New goal" opens a bottom sheet "New goal" with "Close" (text link) at the top right, the caption label "What are you working on?", a composer: field (placeholder "e.g. Methods section for Friday", name "Your goal") and the 52 px paper-tag Send named "Next: choose steps". Send with an empty line does nothing; with text it opens `/goal?line=<text>`. The draft is kept in `sessionStorage` (`waveparticle.goals.draft`) while typing and after Close, and cleared once sent (#77 AC2). Enter sends. |
| `/goal?line=` | `src/app/goal/page.tsx` reads `line` (trimmed, at most 1000 characters) and passes `initialDraft` to `GoalDialogue`; `goal-dialogue.tsx` gets one optional prop `initialDraft?: string` that seeds its `draft` state. Nothing else in the dialogue changes. The safety gate runs when the user sends, as today. |
| G4 header | "‹" (named "Back to Goals") and the overline "Goals" (a link to `/goals?tab=<the Goal's tab>`). No tab bar (shell rule already). |
| G4 title | Overline label "Goal", a text field with the title (saved on blur and on Enter through `renameGoalAction`; an empty field puts the old title back), then a caption "In progress · with Oppenheimer" (status word: In progress, On hold, Done). |
| Type | Overline "Type", a `role="radiogroup"` "Type" of two chips ("One-time", "Ongoing"), `role="radio"`, `aria-checked`, the checked one with "✓ " and the `--tag-fill` background (prototype `.chip-f.on`), capsule, 44 px, 1.5 px `--edge`. Choosing one saves through `setGoalKindAction` with no toast. |
| Your steps | Overline "Your steps". With an open Plan: a list, each Step a button row with "✓" (done) or "○" (not done, aria-hidden, plus "(done)" / "(not done)" for screen readers), the title (500 15.5/1.3) and, under it, the description as a caption (Yue: title and short description; nothing when it is empty, #39 AC3). Tapping a Step shows the toast "Complete steps in your session." with no action (G4 note). Without an open Plan: the caption "Nothing open right now." |
| Recent sessions | Overline "Recent sessions": up to three of this Goal's History rows (date and minutes), then "See all" (link to `/goals?tab=history`). None: "None yet." |
| G4 footer | Pinned at the bottom: the primary filled paper tag, full width: "Resume" (on hold), "Continue" (open Plan and session pages on), "Start" (no open Plan, session pages on), "Reopen" (Done; my call, the prototype draws no Done detail). Under it, centred text links "Put on hold" (not when on hold) and "Mark done" (not when done). No Export. |
| Missing Goal | `/goals/<id>` for a Goal that is not this account's or does not exist: `notFound()`. Signed out: redirect to `/auth/sign-in`. |

## Approaches

1. **Chosen:** server pages that read the account once (new Goals reader), pure view rules, small
   client components for the tabs, sheet, menu and toast, and Goals server actions that reuse main's
   status rule unchanged.
2. Extend the shared progress store and Home's components: rejected, it touches Home, focus and
   the summary, which are out of scope.
3. A client-only page fetching through actions: rejected, slower first paint and duplicates the
   server read.

## Tests and screenshots

- Unit (`tests/goals-view.test.ts`): every row in "Derived values", named after its criterion
  (`#73 AC2 groups In progress under Ongoing and One-time, last used first`, ...); the actions' input
  checks; the Resume rule with a fake writer; the rename safety gate; `/goal?line` parsing.
- Unit (`tests/goals-schema.test.ts`): the migration adds `kind` with its default and check.
- E2E and screenshots (Yue, 2026-11-14: a test-only Supabase stub): `e2e/support/stub-supabase.mjs`,
  an in-memory stand-in for the Supabase endpoints the app calls (`/auth/v1/user` and the
  `/rest/v1/<table>` reads and writes with `eq`, `in` and `order` filters), seeded per test through
  a test-only HTTP endpoint of the stub. It is never imported by the app. A new Playwright project
  `mobile-account` runs a second app server with `NEXT_PUBLIC_SUPABASE_URL` pointing at the stub;
  the test sets the Supabase auth cookie for a stub user. E2E tests cover every criterion of the
  five issues on `/goals` and `/goals/[id]`, and the screenshots of G1, G3, G4, G4-N, G4-H, G5,
  G5-D and G6 come from the same setup, next to the reference pictures.

## Left to the builder

- Class names, file split of the client components, and how the toast and sheet are shared between
  the list and detail pages.
- Exact date formatting helper and local-day boundaries (device time zone).

# Summary, closing line, Life Path and current Story card (issue #258)

Closes #52, #41, #50 and #51 where satisfied. Visual reference: prototype v4, screens END and CPAGE
(`docs/design/prototype/reference-screenshots/end.png`, `cpage-day.png`, `cpage-night.png`).

## Intent

A signed-in run of Oppenheimer has an end and a next step. After the last Done, the user sees what
happened to him that day, their own Goal and Steps, and how long they planned and really focused.
Then the Life Path shows where they are in his life, and one Begin starts the next story. Today the
last Done goes to `/try/end`, which does not exist, and the Life Path is a bare list of ids.

## Goals

- END: the story title, his closing line on a taped slip, one thing he still carries on a second
  slip, the user's Goal, the Steps as a plain list with check marks, "Your record" with plan length
  and focus time, Next (filled) and Home (link). No tab bar, dark Oppenheimer skin.
- The closing line and the carried line come from one live gateway call (NO-BACKUP, END-TONE) that
  receives no user text. A failure shows "He is not here right now. Please try again." with Retry
  (FAIL-SCREEN). The result is stored with the run and never generated again.
- The finished run is saved on the account; the Goal moves to Done.
- CPAGE: all 26 stories in order under the six named periods (drafts, PERIODS), no dates or ages;
  finished rows show the closing line stored from that run; exactly one current card with his goal
  sentence and Begin; later rows show the title only. New users start at chapter 1 (M1).

## Non-goals

- The focus page, rest page and goal dialogue are not changed (user instruction).
- The Undo toast over END, the merged key moments list (#52 AC4), the path end line from him
  (#52 AC6, S6), the story record LPH and ME-REC.
- Moriarty, other Companions, new card prompt rules.

## Anti-goals

- Any stored or authored line shown on END or on the Life Path card text (NO-BACKUP). Interface
  labels (period names, the tags under his name) are not his lines.
- A verdict, score, percentage, "3/3", Step count, streak or pause count anywhere.

## Constraints

- The run is browser-only: `/try/focus` keeps it under `waveparticle.prototype.session`; the Plan and
  the chosen story are in `waveparticle.prototype` (`storyId`). The browser does not know the
  account Goal's id.
- `/goal` and the whole test path exist only when `PROTOTYPE_ENABLED` is `1`. So do END and Begin.
- Signed-in pages cannot run in e2e (no test account); logic is tested in Vitest with the memory
  progress store and a fake gateway.

## Approaches considered

1. **Match by Plan (picked by Yue).** `/try/end` sends a signed-in user to `/end`. The server finds
   the user's `in_progress` Goal whose Steps (title, description, minutes, order) equal the run's
   Plan; the Plan in the browser was written from the saved Steps, so they match. Newest wins if two
   match. Nothing in the protected screens changes.
2. Cookie set at Start in `src/app/goal/actions.ts`: exact, but changes the goal dialogue's code.
3. No saving: Next could not work.

Carried line: generated in the same call as the closing line (picked by Yue).

## Design

### Routes

- `/try/end` (new, server page): signed in → `redirect("/end")`. Signed out → the test path
  summary is not built here; it shows "There is no summary to show." with a link to `/try`
  (builder's call; the test path end is out of scope).
- `/end` (new, signed in, prototype flag, `TryFrame` skin, added to `SESSION_PATHS`, no tab bar).
  Signed out → `/auth/sign-in`. A client component reads the browser Plan and session; if the
  session is not finished it shows "There is no finished Step to sum up." with a link Home.
- `/companions/oppenheimer` (new, signed in): the Life Path, with ‹ "Back to Companions" and the
  tab bar (FLOW 3.2 and the shell rules). `/companions` links to it.

### Finishing a run: `finishRun` server action

Input (checked at run time, a public endpoint): `{ runId: uuid, storyId, steps: [{title,
description, minutes}], focusSeconds: number[] }`. `runId` is made in the browser once per finished
session and kept in a small browser record (`waveparticle.summary`, keyed by the session's
`planKey`) together with the result, so a reload shows the same lines without a call.

Server steps (`src/lib/summary/finish-run.ts`, pure with injected store and gateway):
1. Signed in, or `{status: "signed-out"}`.
2. Find the account Goal by the Plan (approach 1). None → `{status: "no-goal"}`; END then shows the
   lines it can and says "This Goal is not on your account." without saving (builder's call).
3. If that Goal already has a completed session, return its stored lines (never regenerated).
4. Otherwise call `gateway.writeClosingLine` once. Failure → `{status: "failed"}`, nothing saved.
5. Save a `completed` session (`companion_id` "oppenheimer", `story_id`, `closing_line`, the carried
   line as a `session_lines` row of kind `closing`), its `session_steps` with `done_at`, and set the
   Goal to `done`. Return the lines, the plan minutes, the focus seconds, and `next`: the next
   story id when this run is the first completion of that story and a later story exists, else null.

### The closing call (`writeClosingLine` in the model gateway)

Input: who he is, the place, the story's goal sentence and forbidden terms (`generationInputs`),
the facts of the slices covered by the done Steps (`startStory` on the plan minutes), and the last
moment (the last slice's facts). Output: JSON `{closing_line, carry_line}`. Prompt from
`docs/ai/AI_07` section 4 with END-TONE: what happened to him that day and how he feels; no
counts, no pauses, no judging, no "you". Both lines go through the existing one-way line checks
(1 to 3 sentences, at most 45 words, his words) and the existing retry within the time limit.
No new rule is added. Without a configured model the call fails (no test data on END).

### Focus time

The sum over Steps of the clock's elapsed time at Done (`elapsedBeforeRunMs` of the paused clock),
in real seconds; shown in whole minutes, "Under 1 min" below 30 seconds. Plan length is the sum of
the Plan's minutes.

### Life Path model (`src/lib/summary/life-path.ts`)

`lifePath(progress)` → periods with rows. A row is `finished` (a completed Oppenheimer session for
that story; shows its stored closing line), `current` (the first story in order without one), or
`later`. Period names: `PERIOD_DRAFTS` in `src/content/oppenheimer/periods.ts`, the prototype's six
names and its chapter-to-period map, each marked "draft, not approved (PERIOD-NAMES)". Card text
for the current story: its goal sentence (`goalShort` from the story inputs, as `/try` shows it).

### Begin

A client button that writes `storyId` of the current story into the browser Plan store (clearing an
old finished Plan) and then opens `/goal`. The run then generates from that story (#254).

## Left to the builder

Exact CSS (from the prototype as rendered), copy for empty and error states, the portrait in the
Life Path header (use the prototype's image if it is embedded, otherwise a plain box), test names.

## Criteria this does not meet

#52 AC4 (merged key moments), #52 AC6 (his line at the end of the path), the Undo toast on END,
#41 "smooth or rough" and "fallback" (superseded by END-TONE and NO-BACKUP).

## Calls made after the builder check (marked as mine, for Yue to check)

1. **Finished rows on the Life Path show the closing line generated for that user's own run.** It was generated live and stored with the run (#41: "shown in the record of the Story"). NO-BACKUP forbids pre-written or substituted text, not a user's own stored result. The carried line appears only on END.
2. **The current story is always the first story in order with no completed session.** Begin exists only on the current card, so the Life Path cannot replay a story. If a story has two completions (possible through the test path), its row shows the line of the first one.
3. **The browser `runId` becomes the session's `id`.** Saving is an upsert on that id, so a reload, a retry or a second tab writes the same row. No migration is needed. Once a Goal has a completed session, `finishRun` returns that session's stored lines.
4. **`finishRun` returns `{status: "invalid"}` for a malformed input or an unknown `storyId`.** END then shows the plain message "There is no finished Step to sum up." After chapter 26, `next` is null, so END shows Home only.
5. **The Plan match compares Steps in order.** Titles are compared after trimming, minutes must be equal, and an empty description equals a missing one. The goal dialogue cannot edit Steps after Start, so the saved Steps and the browser's Steps come from the same answer.
6. **"no-goal" makes no model call.** END shows the Goal, the Steps and the record with the plain note "This Goal is not on your account.", plus a Home link. It shows no line from him and saves nothing.

## Revised after #257 (approved by Yue on 2026-11-13)

#257 moved signed-in runs onto the account: Start on `/goal` opens `/focus?goal=<id>`, and the last Done completes the session and the Goal there. Matching a browser Plan (approach 1) no longer applies. Yue allowed two small changes in the focus page's code.

- `accountPathsFor(sessionId)` in `src/app/_session/paths.ts` makes the last Done open `/end?session=<id>`. `src/app/focus/account-focus.tsx` uses it.
- `src/app/focus/account-progress.ts` gives a new session the Life Path's current story (`storyForNewSession`) instead of chapter 8. Begin is therefore a plain link to `/goal`.

`/end` reads that completed session and its Goal. Before asking for the lines, it sends the device's snapshot through `recordFocusProgress`, so the completion is on the account even if the last Done's own request was cut off by the page change. It then writes the closing line onto the session (only while the session has none) and the carried line as a `closing` row. The focus time comes from this device's clocks. On another device it reads "Not on this device".

`/try/end` stays a plain page with no summary.

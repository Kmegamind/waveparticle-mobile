# 0031: The research flag is a closed table set by SQL, and the Story is off per session
- Status: proposed (agent, #114); the owner confirms RESEARCH-FLAG and STUDY-SESSION in `docs/DECISIONS.md`
- Date: 2026-11-24
- Issue: #114 (US-MAP-11, decision M4)

## Context
M4 allows no user-facing switch to turn the Story off, only an internal research flag. The team
must be able to put one participant in a study condition (a plain timer) without the participant
being able to see or change it. Story progress is the completed sessions grouped by
`companion_id` and `story_id` (`docs/architecture/README.md`), and the Life Path counts only
Oppenheimer's sessions.

## Options
| Option | For | Against |
|---|---|---|
| A. A column on `profiles` | One column | The owner may update their own profile row through the API, so a participant could turn it off |
| B. A list of emails in a server setting | No migration | Personal data in configuration; every change needs a redeploy; the database does not know which sessions were in the study |
| C. A small admin page | The team clicks | A new screen in a content tool, a role for it and more to test, for a Could story |
| D. A table with row level security and no policy, read through a `security definer` function for `auth.uid()`, set with one SQL command | The same pattern as content roles (`0016`); nobody can write it through the API | The team uses the SQL editor |

## Decision
Option D:
- `public.research_conditions` (`user_id` primary key, `condition` `no_story`, `assigned_at`),
  row level security on, no policy, revoked from `anon` and `authenticated`, cascading from
  `auth.users`. `public.research_condition()` returns the caller's condition or null.
- `src/lib/research/condition.ts` reads it through the user's own client. A failed read throws: the
  focus page then does not open, so a participant never falls back to the Story. A missing function
  (the migration has not run, was dropped, or the schema cache is stale) throws too when the server
  setting `RESEARCH_STUDY_ACTIVE` is `1`, set before the first participant is assigned; unset, it
  reads as no condition with one warning per server process.
- The Story is off **per session**: `sessions.story_off_at` (added by the same migration) is when it
  went off. The session keeps its Companion and story, so the record says which story it played;
  a Step done before `story_off_at` was done with the Story on. The flag decides only on `/focus`,
  where a new session is opened Story-off and an open Story session gets `story_off_at` in place
  (its done Steps and shown cards stay). A session for an older Plan is restarted unchanged. The
  Life Path, the summary and the Story record skip sessions with `story_off_at`.
  (First version of this PR: `companion_id` and `story_id` `none`; changed in review because it
  erased the story and mixed sessions with Story-on Steps into the study data.)
- The pause message, the rest reply and the return pop-up actions refuse a flagged account on the
  server, so no model call is made for it even if the browser asks.

## Consequences
- Assigning and removing is one SQL command each (`docs/deploy.md`, Research flag).
- Removing the flag does not change a Story-off session that is open; the next session plays the
  Life Path's current story, which did not move.
- The participant's own session can call `research_condition()`; it answers only for them and
  cannot change anything. The condition is not in the data export (RESEARCH-EXPORT, open).

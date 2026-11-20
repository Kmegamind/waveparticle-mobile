# Goals area

`/goals` (#73, #77, #79, #80, #112): four tabs (In progress grouped Ongoing and One-time, On hold, Done, History), search, History filters by Goal and time range (All time, This week from Monday, This month, on the device calendar; `filterHistory`), the Goal menu with Put on hold and Mark done, Resume and Reopen, a five-second Undo, and the New goal sheet that opens `/goal?line=`. `/goals/[id]` (#78, #39): title, status, Companion, type, read-only Steps with descriptions, recent sessions, and the footer actions. Read once per page through the user's own Supabase client; status changes reuse `setGoalStatus` from `src/lib/home/`. `goals.kind` is One-time or Ongoing. At the last Done a One-time Goal moves to Done; an Ongoing Goal stays In progress with its run completed, and its row offers Start, a new run of the same Steps (#75 AC5)

Path: `src/app/goals/`, `src/lib/goals/{goals-view,goals-reader,goal-edits}.ts`, `supabase/migrations/20261114000000_goal_kind.sql`

# Goal dialogue (account)

`/goal` (#32): the same dialogue for a signed-in user. Start saves the Goal (`in_progress`) and its Steps on the account through the user's Supabase client (row-level security): safety gate first, empty Steps dropped, minutes kept as given, one Goal per Plan. Then it opens `/focus?goal=<id>` (#257). Exists in every environment for signed-in users, with no per-account cap (#278, SESSION-PAGES-OPEN)

Path: `src/app/goal/`, `src/lib/goals/`

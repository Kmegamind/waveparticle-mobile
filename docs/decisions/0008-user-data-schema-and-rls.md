# Decision 0008: Account-owned user-data schema and RLS

Date: 2026-11-06

## Decision

The first Supabase migration creates only the user-data tables needed for
Goals to start: `profiles`, `goals`, `steps`, and `sessions`.

Every table has row-level security enabled. Directly owned rows use
`auth.uid()` policies for select, insert, update, and delete. Steps are owned
through their Goal, so a user can access a Step only when they own its Goal.

Foreign keys from `profiles`, `goals`, and `sessions` to `auth.users` use
`on delete cascade`. Steps cascade from their Goal, and Sessions cascade from
their Goal. Account deletion therefore removes the account's profile, Goals,
Steps, and Sessions without a separate cleanup job.

## Consequences

- Goal and Step text is stored server-side on rows tied to the signed-in
  account.
- The database enforces the account boundary independently of application
  queries.
- Pause, card, return-event, history, and other later-feature tables are
  intentionally deferred to their feature issues.
- The migration includes no content-library foreign keys because the content
  tables are not part of this issue.

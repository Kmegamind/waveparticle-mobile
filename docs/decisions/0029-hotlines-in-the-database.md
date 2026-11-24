# 0029: Keep the hotline list in the database and S1's help on the phone
- Status: accepted (owner, 2026-11-23; `docs/DECISIONS.md` SAFETY-REGION, SAFETY-REGION-STORE, HOTLINES)
- Date: 2026-11-24
- Issue: #118 (spec #402, prototype #404)

## Context
S1 must show the help line for the country the user chose, edited in the admin and owned by the
product owner, and it must work offline: a person in crisis may have no connection, and S1 opens
in place inside screens that are already loaded. The app must never read a location or assume a
country.

## Options
| Option | For | Against |
|---|---|---|
| A. `public.hotlines` with versions and admin-only functions (as story cards and prompts); `profiles.help_country`; S1 reads a copy on the phone refreshed by the app shell | Admin editing with draft, Publish, restore and history; S1 needs no network | One more table and request per page load |
| B. The list in a file in the repository | No database change | Not editable in the admin (owner answer 2) |
| C. S1 reads the account and the list from the server when it opens | Always current | Fails offline, and adds a wait on the crisis page |

## Decision
Option A.

- The table and its functions are in `supabase/migrations/20261128000000_hotlines.sql`, with the
  seed (the US entry only) and the `hotline` Publish history kind (0018 addition).
- The phone copy is `waveparticle.helpLine` in local storage: the country and its published entry.
  `HelpLineSync` refreshes it once per page load, Me and ME-REGION write it, and sign out removes it.
- The copy carries the account's user id. It is removed at sign out, account deletion, on the
  sign-in pages and when the refresh finds no session or another user; on public pages it shows
  only for the session the page knows (review of #406, I-1). A failed read keeps it (I-2).
- No copy, an unreadable copy or no country is S1-0, written in the code: never a US entry.

## Consequences
- Production runs the migration before the deploy; until then the Me page still reads (the
  profile read falls back to the old columns) but choosing a country fails and S1 shows S1-0.
- A change published in the admin reaches a phone on its next page load with a connection.
- The service name is optional and the editor's legal-review note is not a block, until the owner
  answers (review of #403, I-2 and M-1).

# Focus and rest (account)

`/focus` and `/rest` (#257) for a signed-in user on the account's Goal and session. Done Steps and every shown line are written to the account; the clock, pause count and rest conversation stay on the device (`docs/decisions/0014`). His cards are the story's published pre-made cards, spread across the Steps and pinned per session in `sessions.card_versions` (`src/lib/progress/premade-cards.ts`, #300, `docs/decisions/0021`); no model call for cards, and a failed read shows the failure screen with the clock stopped. No test data: without the model his live lines fail. Exist in every environment for signed-in users (#278)

Path: `src/app/focus/`, `src/app/rest/`, `src/lib/progress/focus-session.ts`, `src/lib/progress/account-lines.ts`

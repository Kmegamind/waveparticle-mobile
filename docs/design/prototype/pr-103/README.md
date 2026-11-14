# Account and privacy pages (#103, #102, #104): prototype v4 next to the app

Captured at 390 by 800, device pixel ratio 2, light and dark, from a production build against the
test-only Supabase stub (`scripts/design/capture-account.mjs`, then `compose-compare.mjs`).

| Screen | Prototype v4 | Notes |
|---|---|---|
| ME (`compare-me-*`) | `me-day`, `me-night` | "About the stories" and "Data" follow Signals, as in the prototype. Me's earlier state is in `../pr-81/` |
| ACCOUNT-DELETE (`compare-account-delete-*`) | `account-delete-day`, `account-delete-night` | Same card, title, buttons and order |
| Data, About the stories, Privacy notice, Terms, Export my data | not drawn | Built in the Me style: back row, display title, rows or plain text |

Differences on purpose:
- The app header ("WaveParticle") shows above these pages, as on every signed-in page (#244), so the delete card sits a little lower.
- The prototype's dashed "OPEN" box on ACCOUNT-DELETE is a design annotation, not app copy; it is not built.
- The delete card's sentence also names "the lines he showed you" and says "It cannot be undone.", because those are true and the user should know before confirming.

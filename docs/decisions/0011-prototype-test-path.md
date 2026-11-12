# 0011: Add a sign-in-free test path for the prototype
- Status: accepted
- Date: 2026-11-12
- Issue: #208

## Context
The product owner wants to click through the core loop on a Vercel preview now. The product
requires an account (decision ACC in `docs/DECISIONS.md`) and shows no stored text to users
(NO-BACKUP). Building the account flow first would delay the first walk-through by many issues.

## Options
| Option | For | Against |
|---|---|---|
| Wait for the account-based screens | Matches the spec | No prototype for weeks |
| Test-only route `/try` behind a flag, progress in the browser | Clickable now; the loop components are reused later with account data | Not in the spec; an open route can call the paid model |
| Static demo page (`docs/demo`) | Already exists | Not the app; no real screens or state |

## Decision
Add `/try`, public only when `PROTOTYPE_ENABLED` is exactly `1`, with progress kept in the
browser and chapter 8 ("site search") generated content as labelled test data when the model is
not used; `PROTOTYPE_ENABLED` is set for **Preview only**, never Production.

## Consequences
- Every `/try` screen shows a "Test build" label. Test data is never shown outside `/try`, so
  NO-BACKUP still holds for real users.
- **Cost risk:** once `/try` calls the model, anyone who can open the preview can spend model
  credit. Keep Vercel Deployment Protection on for previews, cap the calls per visit, and never
  enable the flag in Production.
- The loop screens must take their data through an interface so the same components can later
  read the signed-in account (Supabase) instead of the browser.
- Remove `/try` (or keep it test-only) before launch; track that in the release checklist.

# 0026: Count the goal dialogue's turns in a signed token
- Status: accepted
- Date: 2026-11-20
- Issue: #31 (US-GD-14)

## Context
FLOW 4.3 limits the goal dialogue to three turns in a fixed order: the goal line, the time (skipped
when the goal states one, GOAL-TIME), and the split answer (chips only). Once the Plan is shown, the
input box is gone and he does not answer edits. Until now all of this lived in the browser: the
server saw only independent split requests carrying any goal text (`docs/decisions/0012`). US-GD-14
asks the server to count the turns and to refuse further free text once the Plan is shown.

The owner decided on 2026-11-20: (1) Split again and Try again have no limit inside one dialogue,
and the daily cap of 20 model calls stays; (2) a new goal line after a Plan starts a new dialogue,
and a changed goal inside the same dialogue is refused; (3) a refused turn shows the existing GD-F
screen. The state must work the same on `/try` (signed out) and `/goal` (signed in), with no
database change.

## Options
| Option | For | Against |
|---|---|---|
| Signed token (HMAC-SHA256) carried by the browser | Same on `/try` and `/goal`; no migration; no database call per turn | Needs a new server secret; replaying an earlier token is possible |
| `goal_dialogues` table for `/goal`, plus a cookie for `/try` | Durable on the account | Two mechanisms; a migration and a write per turn; `/try` still needs a cookie |

## Decision
Every turn is a server action (`goalTurnAction` on `/try`, `goalTurnForAccountAction` on `/goal`)
that runs `takeTurn` (`src/lib/goal-dialogue/turns.ts`). The server keeps the dialogue's state in a
token it signs with `GOAL_DIALOGUE_SECRET` (`src/lib/goal-dialogue/token.ts`). The state is a
dialogue id, a keyed hash of the goal line (never the words), the turn count, the minutes, the split
answer, whether a split has run, and the time it was signed. The token expires after one day.

- A goal turn always starts a new dialogue (decision 2) and is the only request that takes new
  free text.
- A time turn is accepted only right after the goal turn, from 1 minute to 3 hours.
- The split answer is accepted only once the time is known. "Just split it" may come before the
  time and uses 30 minutes. At most three turns are taken.
- After a split, only Split again and Try again are accepted, with no limit (decision 1). They must
  carry the same goal line; a different line is refused (decision 2).
- The minutes and the split answer come from the token, not from the browser.
- Any refusal returns `refused`, and the page shows GD-F (decision 3).
- Going back a turn sends an earlier token again. That is accepted because FLOW lets the user
  change an earlier answer.
- Plan edits are never a turn, so they never reach a model and get no reply from him.

**Missing secret.** In production (`NODE_ENV=production`) a missing secret, or one shorter than 32
characters, refuses every turn: the dialogue shows GD-F and one log line `secret_missing` is
written (feature `goal-dialogue`, no user text). Outside production (`npm run dev`, Vitest) a random
key is made once per process, so nothing needs setting. Tokens then stop working when the process
restarts, which only sends that dialogue to GD-F. The e2e servers run `next start` in production
mode, so `playwright.config.ts` sets a test-only value; CI uses that value.

## Consequences
- `GOAL_DIALOGUE_SECRET` must be set in Vercel (Production and Preview) before this change is
  deployed, or the goal dialogue shows GD-F for everyone.
- The old split actions (`splitGoalAction`, `splitGoalForAccountAction`) are removed, so no server
  action splits a goal outside the turn rules.
- Each turn is now one server round trip; before, only the split was.
- Clearing the token and typing the goal again starts a new dialogue. That is allowed by
  decision 2, so the limit stops a long chat inside one dialogue, not new dialogues. Model cost
  stays bounded by the daily cap (`docs/decisions/0012`).

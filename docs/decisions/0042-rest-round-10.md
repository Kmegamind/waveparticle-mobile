# 0042: The rest chat stops at round 10, counted on the server per Pause
- Status: proposed
- Date: 2026-11-28
- Issue: #518 (owner decision on #337, 2026-11-26; prototype R1-C10, #501 and #503)

## Context
REST-ROUND-10 reverses R2: in one Pause, his reply to the user's tenth message says that his own work is going to fail, and then he stops replying (the text field and Send disappear). The count starts again at every Pause, a failed tenth reply that is retried must still end the chat, and a reload must not reset the count. The rest chat is two calls since #517 (REST-TWO-CALLS); the tenth reply's extra instruction belongs to call one (`rest_reply`). Until now the pause count and the whole conversation stayed on the device (`docs/decisions/0014`), and the server had no notion of a Pause.

## Options
| Option | For | Against |
|---|---|---|
| Count the replies in the history the phone sends | No database change | The phone decides: a reload with a cleared store, another device or a crafted request starts again; not "kept on the server" |
| Key the count by the device's pause number (session, Step, number) | No new id | The device's pause count starts at 0 again when its store is cleared, so a new Pause could land on an old, ended count |
| **A random id per Pause, made on the phone at Pause, and a count per session and id on the server** | A reload keeps the id (the rest is saved with the session); a new Pause gets a new id, so it starts at round 1; the server decides the round and refuses after 10 | A migration (Human step); a Pause whose device store is lost, or a session opened on another device, becomes a new Pause |

## Decision
- **Pause id.** `startRest` gives the rest a random UUID (`rest.key`); a rest stored before #518 gets one when the rest page opens (`withPauseKey`).
- **Server count** (`supabase/migrations/20261210000000_rest_rounds.sql`, a Human step): `private.rest_rounds (session_id, pause_key, rounds 0..10)`, closed to the API. `public.rest_round(session, pause)` reads the count of the caller's own session (0 otherwise); `public.record_rest_round(session, pause, shown_round)` counts only the next round and refuses another account's session. No message text is stored. Rows go with their session.
- **Round.** The signed-in rest reply (`loadAccountRestReply`) reads the count first: after 10 no model call is made (`{ status: "ended" }`; the safety check still runs and a crisis message still opens S1). Otherwise the round is count + 1; round 10 passes `lastRound` to the gateway, then adds `REST_LAST_ROUND_INSTRUCTION` (`src/lib/model-gateway/rest-round.ts`) after the `rest_reply` prompt, whichever version is active. Only a reply that was produced is recorded, so a failed reply is not counted and its retry keeps the round. The reply of round 10 carries `ended: true`.
- **Without the count** (owner decision 2026-11-28): when the count cannot be read (the migration not applied yet, or a database error), the reply is made as before REST-ROUND-10: the safety check runs, no round, no ending, and the server logs `rest_round_read_failed`. A count that cannot be written after a reply keeps the reply and logs `rest_round_write_failed`.
- **Call two** (`rest_reply_review`) is not made for the tenth reply (owner decision 2026-11-28), so the ending is kept as written; rounds 1 to 9 are unchanged.
- **Phone.** `ended` is kept in the rest state; the composer is not rendered and the failure box is hidden. On opening, the signed-in rest page asks the server (`loadAccountRestEnded`) whether this Pause already ended, so a reload on the same device shows R1-C10 even when the device lost that mark (the Pause id itself lives in the device's store). The log scrolls to its end on each new message, as in the prototype.
- **Test path** `/try` (no account): the round comes from the history the page sends (the browser's store); nothing is written on the server.

## Consequences
- The migration can be applied before or after the merge: until it is, the chat answers uncounted (no round-10 stop) and the server logs a warning on each reply.
- The wording of the added instruction was approved by the owner on 2026-11-28 as built. It is not a prompt row and is not in `docs/ai/prompts/`; later polishing comes as a new prompt version.
- Parallel requests for the same Pause (only a crafted client; the page sends one at a time) can each get the same round.

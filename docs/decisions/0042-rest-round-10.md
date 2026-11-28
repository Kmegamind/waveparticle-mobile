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
| **A random id per Pause, made on the phone at Pause, and a count per session and id on the server** | A reload keeps the id (the rest is saved with the session); a new Pause gets a new id, so it starts at round 1; the server decides the round and refuses after 10 | A migration (Human step); a Pause whose device store is lost becomes a new Pause |

## Decision
- **Pause id.** `startRest` gives the rest a random UUID (`rest.key`); a rest stored before #518 gets one when the rest page opens (`withPauseKey`).
- **Server count** (`supabase/migrations/20261210000000_rest_rounds.sql`, a Human step): `private.rest_rounds (session_id, pause_key, rounds 0..10)`, closed to the API. `public.rest_round(session, pause)` reads the count of the caller's own session (0 otherwise); `public.record_rest_round(session, pause, shown_round)` counts only the next round and refuses another account's session. No message text is stored. Rows go with their session.
- **Round.** The signed-in rest reply (`loadAccountRestReply`) reads the count first: after 10 no model call is made (`{ status: "ended" }`; the safety check still runs and a crisis message still opens S1). Otherwise the round is count + 1; round 10 passes `lastRound` to the gateway, which adds `REST_LAST_ROUND_INSTRUCTION` (`src/lib/model-gateway/rest-round.ts`) after the `rest_reply` prompt, whichever version is active. Only a reply that was produced is recorded, so a failed reply is not counted and its retry keeps the round. A count that cannot be read or written is a failure with Retry, never an uncounted reply. The reply of round 10 carries `ended: true`.
- **Call two** (`rest_reply_review`) is unchanged: it reads the tenth reply as `{{draft}}`; with no active version the chat is one call, as before.
- **Phone.** `ended` is kept in the rest state; the composer is not rendered and the failure box is hidden. On opening, the signed-in rest page asks the server (`loadAccountRestEnded`) whether this Pause already ended, so a reload or another device shows R1-C10 even when the device lost that mark. The log scrolls to its end on each new message, as in the prototype.
- **Test path** `/try` (no account): the round comes from the history the page sends (the browser's store); nothing is written on the server.

## Consequences
- Until the owner applies the migration, every signed-in rest reply fails with Retry (the count cannot be read). The migration must be applied before the deploy of #518 reaches production.
- The wording of the added instruction is proposed in the pull request; the owner approves or changes it there. It is not a prompt row and is not in `docs/ai/prompts/`.
- An active review prompt could rewrite the ending into a reply that no longer says his work fails; the chat still ends. Whether the review should also get the instruction on round 10 is an owner question.

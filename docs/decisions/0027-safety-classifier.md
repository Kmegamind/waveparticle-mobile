# 0027: The safety classifier runs on the provider before the reply, with a webhook alarm
- Status: accepted
- Date: 2026-11-22
- Issue: #117 (US-SAF-4)

## Context
US-SAF-4 asks for a classifier that catches a crisis the keyword layer misses, using the message
and the last two messages of the same field, with the keyword layer deciding alone and a same-day
alarm when the classifier fails or takes longer than 1.5 seconds. The spec left open which model
runs it (PROV said "in our code, not with the provider"; FR-AI-3 lists it as a live model call),
how the alarm reaches a person (no alerting existed; Vercel keeps logs for 1 hour to 1 day), and
whether it runs before or alongside the reply call. The gaps were listed for the owner first
(issue #117), and the owner decided on 2026-11-22.

## Options
| Question | Options | Chosen |
|---|---|---|
| Who classifies | Same provider through the gateway's settings; a local model in our server; a third-party moderation service | Same provider, with optional `SAFETY_MODEL_*` settings (SAFETY-PROVIDER) |
| When | In parallel with the reply call (AI_05 section 4); before it | Before the reply, the split or any save (SAFETY-CHECK-FIRST): crisis text never reaches the reply model |
| Alarm | Log line only; webhook; email; GitHub issue; admin page | Webhook to `SAFETY_ALARM_WEBHOOK_URL`, at most once a day, plus an error log line (SAFETY-ALARM) |
| "Once a day" across server instances | In memory per instance; one database row per day | A row per UTC day in `private.safety_alarm_days`, counted through `record_safety_classifier_failure`, with an in-memory fallback |

## Decision
`src/lib/safety/check.ts` runs the keyword layer first; a keyword crisis ends the check and the
text reaches no model. Otherwise `src/lib/safety/classifier.ts` makes one call (prompt
`safety_classifier`, one attempt, 1.5 s including the prompt read) and the higher tier wins;
`unsure` is crisis, and any other answer that is not exactly one tier is a failure. A failure lets
the keyword layer decide, logs `safety_classifier_failed` and, after the response, posts the
webhook if it is the day's first (`src/lib/safety/alarm.ts`). Every server function with free text
takes the check as a dependency; the server actions pass `serverSafetyCheck()`.

The day counter reuses the prompt reader token (`PROMPTS_READ_TOKEN`) so no new secret is needed;
the function only counts and answers "first today or not".

## Consequences
- All free text goes to the provider for classification; the privacy notice and A7b must say so.
- A free-text submission can take up to 1.5 s longer.
- One extra model call per submission (accepted, SESSION-PAGES-OPEN); not counted toward `/try`'s
  daily limit.
- The webhook is posted on the day's first failure, so it says "first failure today" with the time
  and reason, not a day's total; later failures are in the server log and the day counter (fix
  round 1, I2). A daily digest is an open question for the owner.
- Anyone holding `PROMPTS_READ_TOKEN` can now also call the counter, and could call it early each
  UTC day to mark the day as alarmed and so suppress that day's webhook (review M1). The token is a
  server-only secret; a separate token would remove this, at the cost of one more secret.
- If the webhook post fails after the counter marked the day, that day's alarm is lost; the error
  log lines remain. A slow provider can make the classifier time out often; the latency is logged
  and the alarm is at most daily.
- The browser keeps its keyword-only check as an early stop.

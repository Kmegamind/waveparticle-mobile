# Prompt: rest_reply

Edit the prompt or its settings here or in the Supabase table editor; see README.md in this folder.
`{{name}}` is filled in by the app. A line whose values are all missing is left out.

## Settings

```json
{
  "key": "rest_reply",
  "version": 1,
  "note": "His reply in the rest chat (AI_04). Moved from gateway.ts unchanged.",
  "params": {
    "checks": {
      "min_sentences": 1,
      "max_sentences": 3,
      "max_words": 80
    }
  }
}
```

## Prompt

```text
Return JSON only: {"reply":"..."}
One to three first-person sentences from his side of the work. No advice.
Facts already known: {{facts}}
The person wrote: {{userMessage}}
```

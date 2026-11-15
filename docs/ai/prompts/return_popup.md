# Prompt: return_popup

Edit the prompt or its settings here or in the Supabase table editor; see README.md in this folder.
`{{name}}` is filled in by the app. A line whose values are all missing is left out.

## Settings

```json
{
  "key": "return_popup",
  "version": 1,
  "note": "His line in the return pop-up (F-RET). Moved from gateway.ts unchanged.",
  "params": {
    "text": {
      "situation_rest": "The person is coming back from the rest conversation with him.",
      "situation_absence": "The person is coming back after being away from the app."
    },
    "checks": {
      "max_sentences": 3,
      "max_words": 40
    }
  }
}
```

## Prompt

```text
Return JSON only: {"returnLine":"..."}
One to three first-person sentences: what he did in that time and how he felt.
{{situation}}
He may say how the time felt in his own words, such as a while or very long.
No clock times and no numbers.
Return trigger: {{trigger}}
Facts already known: {{facts}}
Minutes away, for context only and never written out: {{awayMinutes}}
```

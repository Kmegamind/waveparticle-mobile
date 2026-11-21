# Prompt: return_popup

Edit the prompt or its settings here or in the Supabase table editor; see README.md in this folder.
`{{name}}` is filled in by the app. A line whose values are all missing is left out.

## Settings

```json
{
  "key": "return_popup",
  "version": 2,
  "note": "Return pop-up is 1 or 2 sentences and at most 30 words (LEN-RETURN, #57, #61); his situation is back to before the snag and no event moves his story.",
  "params": {
    "checks": {
      "max_sentences": 2,
      "max_words": 30
    },
    "text": {
      "situation_absence": "The person is coming back after being away from the app.",
      "situation_rest": "The person is coming back from the rest conversation with him."
    }
  }
}
```

## Prompt

```text
Return JSON only: {"returnLine":"..."}
One or two first-person sentences, at most 30 words: what he did in that time and how he felt.
His situation is back to what it was before his snag. He states no event that moves his story forward.
{{situation}}
He may say how the time felt in his own words, such as a while or very long.
No clock times and no numbers.
Return trigger: {{trigger}}
Facts already known: {{facts}}
Minutes away, for context only and never written out: {{awayMinutes}}
```

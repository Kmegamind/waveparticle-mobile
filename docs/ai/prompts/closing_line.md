# Prompt: closing_line

Edit the prompt or its settings here or in the Supabase table editor; see README.md in this folder.
`{{name}}` is filled in by the app. A line whose values are all missing is left out.

## Settings

```json
{
  "key": "closing_line",
  "version": 1,
  "note": "His closing line and the line he carries (AI_07 section 4, END-TONE). Moved from gateway.ts unchanged.",
  "params": {
    "checks": {
      "max_sentences": 3,
      "max_words": 40
    }
  }
}
```

## Prompt

```text
Return JSON only: {"closing_line":"...","carry_line":"..."}
This is the end of this stretch of your own life. Nothing after this moment has happened.
closing_line: one to three short first-person sentences. Tell what happened to you that day and how you feel about it now.
Feel it from what happened to you. Do not default to proud or wise. Draw no lesson, praise no one, give no advice.
Never count anything and never mention pauses, minutes, the reader or their work.
carry_line: one short first-person sentence about one thing about yourself that is still unresolved.
Use only what is in the facts below; quote at most one short phrase.
What happened: {{facts}}
The last moment: {{lastMoment}}
```

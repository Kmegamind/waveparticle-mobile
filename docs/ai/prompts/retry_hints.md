# Prompt: retry_hints

Edit the prompt or its settings here or in the Supabase table editor; see README.md in this folder.
`{{name}}` is filled in by the app. A line whose values are all missing is left out.

## Settings

```json
{
  "key": "retry_hints",
  "version": 1,
  "note": "Added to a prompt after a rejected answer: one fix per check that failed. Rule ids only, never user text. Moved from gateway.ts unchanged.",
  "params": {
    "fixes": {
      "back": "Use no behind-the-scenes words such as step, session, app, screen or task.",
      "ban": "Use none of the banned words.",
      "blame": "Do not blame the person for being away.",
      "card_nouns": "Do not reuse the nouns of the last card.",
      "cjk": "Write in English only.",
      "clock": "Use no clock times, numbers of minutes or durations.",
      "cmd": "Give no orders or advice.",
      "dash": "Use no dashes.",
      "empty": "Write a non-empty line within the size asked for.",
      "failure_text": "Do not mention errors or failures.",
      "first_person": "Write in his first person.",
      "form": "Use no exclamation marks, emoji or links, and end with a full stop.",
      "hook": "Use no hook words such as more, later, soon or next.",
      "leak": "Use none of the forbidden words.",
      "len": "Keep within the length asked for.",
      "minutes": "Use positive whole minutes that add up to the total.",
      "name": "Never say his own name.",
      "opening": "Do not start with the same three words as a recent line.",
      "parse": "Return valid JSON in exactly the shape asked for.",
      "praise": "Give no praise.",
      "question": "Ask no question, or at most one where a question is allowed.",
      "repeat": "Do not repeat a line already shown.",
      "similar": "Do not write a line close to one already shown.",
      "you": "Do not address the person as you."
    }
  }
}
```

## Prompt

```text
The last answer was rejected. Fix this: {{fixes}}
```

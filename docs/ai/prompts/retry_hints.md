# Prompt: retry_hints

Edit the prompt or its settings here or in the Supabase table editor; see README.md in this folder.
`{{name}}` is filled in by the app. A line whose values are all missing is left out.

## Settings

```json
{
  "key": "retry_hints",
  "version": 2,
  "note": "Added to a prompt after a rejected answer: one fix per check that failed. Rule ids only, never user text. Version 2 (#56): fixes for the pause checks (prop, object, event, place, plain).",
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
      "event": "Nothing may happen in his story: no one arrives, speaks, decides, finds, loses or breaks anything.",
      "failure_text": "Do not mention errors or failures.",
      "first_person": "Write in his first person.",
      "form": "Use no exclamation marks, emoji or links, and end with a full stop.",
      "hook": "Use no hook words such as more, later, soon or next.",
      "leak": "Use none of the forbidden words.",
      "len": "Keep within the length asked for.",
      "minutes": "Use positive whole minutes that add up to the total.",
      "name": "Never say his own name.",
      "object": "Name no object other than the objects listed.",
      "opening": "Do not start with the same three words as a recent line.",
      "parse": "Return valid JSON in exactly the shape asked for.",
      "people": "Name no people or places other than the names listed.",
      "place": "Name no place other than the names listed.",
      "plain": "Write plain text only, not JSON.",
      "praise": "Give no praise.",
      "prop": "Use the object chosen for you and no other object, and give it back as prop exactly as written.",
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

# Prompt: stuck_story

Edit the prompt or its settings here or in the Supabase table editor; see README.md in this folder.
`{{name}}` is filled in by the app. A line whose values are all missing is left out.

## Settings

```json
{
  "key": "stuck_story",
  "version": 1,
  "note": "His stuck situation when the person pauses (AI_03, PAUSE-3). Moved from gateway.ts unchanged.",
  "params": {
    "checks": {
      "max_sentences": 2,
      "max_words": 20
    },
    "harder_from_pause": 3,
    "text": {
      "situation_first": "A new small snag that holds up his own work, and how he feels about it.",
      "situation_harder": "Every pause has stalled his own work, and he remembers the earlier setbacks.\nSo this new stuck situation is much harder than the earlier ones.\nHe says he is worried he may fail."
    }
  }
}
```

## Prompt

```text
Return JSON only: {"story":"..."}
One or two short first-person sentences about where his own work is stuck.
{{situation}}
Never tell the person what to do and never ask the person to stop pausing.
Pause number: {{pauseNumber}}
Facts already known: {{facts}}
```

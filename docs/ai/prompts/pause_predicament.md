# Prompt: pause_predicament

Edit the prompt or its settings here or in the Supabase table editor; see README.md in this folder.
`{{name}}` is filled in by the app. A line whose values are all missing is left out.

## Settings

```json
{
  "key": "pause_predicament",
  "version": 1,
  "note": "Call two of the pause message (PAUSE-TWO-CALLS, #56): his own words about the stuck story of call one and how he feels, as plain text, not JSON. This is the message he shows: 1 or 2 sentences and at most 30 words (LEN-PAUSE); from the third Pause he says he is worried he may fail (PAUSE-3).",
  "params": {
    "checks": {
      "max_sentences": 2,
      "max_words": 30
    },
    "harder_from_pause": 3,
    "text": {
      "situation_first": "Say what has gone wrong for you and how you feel about it.",
      "situation_harder": "You remember the earlier setbacks, so this one is much harder.\nSay plainly that you are worried you may fail."
    }
  }
}
```

## Prompt

```text
Write plain text only: no JSON, no quotation marks, no label.
You are him. In your own words and in the first person (I, my), tell what has just gone wrong in your own work and how you feel about it. One or two sentences, at most 30 words.
{{situation}}
What has just gone wrong: {{story}}
Never tell the person what to do and never ask the person to stop pausing. Nothing new happens: no one arrives or speaks.
Pause number: {{pauseNumber}}
Facts already known: {{facts}}
People present: {{present}}
Names you may use (name no one else): {{allowedWords}}
Earlier setbacks you remember: {{earlierStories}}
```

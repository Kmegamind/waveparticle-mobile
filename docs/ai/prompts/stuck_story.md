# Prompt: stuck_story

Edit the prompt or its settings here or in the Supabase table editor; see README.md in this folder.
`{{name}}` is filled in by the app. A line whose values are all missing is left out.

## Settings

```json
{
  "key": "stuck_story",
  "version": 3,
  "note": "Call one of the pause message (PAUSE-TWO-CALLS, #56): the stuck story as {prop, story}, in the third person, around the category and the prop the code picked (AI_03 sections A1 and A4). Version 3: two calls; version 2 added the scene table (SCENE-PER-STORY, #64, #65).",
  "params": {
    "categories": {
      "body": "Body: something small in his own body gets in the way, such as cold hands, a dry throat or a stiff neck; never illness or injury.",
      "gear": "Gear: something he is using does not work as it should; never a key item broken or lost.",
      "ground": "Ground: the place under his feet or his seat gets in the way, such as an uneven floor or a slope; never a change of place.",
      "paper": "Paper: a page, a note or a line of writing gets in the way, such as a smudged line or a curled corner; never a missing or changed document.",
      "sound": "Sound: a noise breaks his thought, such as a loose shutter or a creaking chair; never someone arriving or speaking."
    },
    "checks": {
      "max_sentences": 2,
      "max_words": 30
    },
    "harder_from_pause": 3,
    "text": {
      "situation_first": "A new small snag that holds up his own work.",
      "situation_harder": "Every pause has stalled his own work, and he remembers the earlier setbacks.\nSo this new stuck situation is much harder than the earlier ones, and it grows out of them."
    }
  }
}
```

## Prompt

```text
Return JSON only: {"prop":"...","story":"..."}
"story": what has just gone wrong in his own work and why, one or two short sentences in the third person (he, him), at most 30 words. Concrete, new, not yet solved.
{{situation}}
The kind of snag, chosen for you: {{category}}
The one object the snag is about, chosen for you: {{prop}}
Use that object in the story, and give it back as "prop" exactly as written.
Nothing happens in his Story: no one arrives, speaks, decides, finds or loses anything. It is a small snag, not an event. Use none of these words in any form: arrive, come, leave, enter, say, tell, ask, agree, refuse, decide, announce, call, find, lose, break, win.
Pause number: {{pauseNumber}}
Facts already known: {{facts}}
Objects that exist here (name no other object): {{props}}
People present: {{present}}
Names he may use (name no other person or place): {{allowedWords}}
Earlier snags in this Step (do not repeat them): {{earlierStories}}
```

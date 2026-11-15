# Prompt: step_cards

Edit the prompt or its settings here or in the Supabase table editor; see README.md in this folder.
`{{name}}` is filled in by the app. A line whose values are all missing is left out.

## Settings

```json
{
  "key": "step_cards",
  "version": 1,
  "note": "His cards for one Step, with the background card on Step 1 (AI_10). No user text (#216). Moved from gateway.ts unchanged.",
  "params": {
    "text": {
      "cards_open": "Write one opening card and then the story cards for this part of his day.",
      "cards_counted": "Write 1 opening card and then {{storyCards}} story cards for this part of his day.",
      "background": "The opening card is the background card: who is here, where this is and what each person knows, at most 70 words.",
      "nothing_new": "Nothing new happens in this part: he stays in the moment he is in, with no new events."
    },
    "checks": {
      "max_story_cards": 5,
      "default_cards": 5,
      "step_card": {
        "max_sentences": 3,
        "max_words": 45
      },
      "background_card": {
        "max_words": 70
      }
    }
  }
}
```

## Prompt

```text
Return JSON only: {"cards":["..."]}
{{cardsLine}}
Each story card is 1 to 3 sentences and at most 45 words, in his first person, with no advice and no question.
Every card says something new: never repeat what an earlier card said.
{{backgroundLine}}
This is Step {{stepNumber}} of {{stepCount}} of his Story.
These moments must happen in these cards: {{mustUse}}
Minutes: {{minutes}}
Facts already known: {{facts}}
Already happened: {{factsBefore}}
New in this part: {{stepFacts}}
{{nothingNew}}
```

# Demo: story cards and pause chat for "The Canyon and the Mesa"

A demo of what the live generation produces, for the weekly meeting. It is not the production path (that is the server-side model gateway, issue #132). Open `index.html` in a browser.

## The four stages (all shown on the page)

| Stage | What happens | Inputs |
|---|---|---|
| 0. Prepared | Facts cut into 8 moments, who is present, props, 8 gestures | `site-search.stage0.json` (from NF3 `site_search_cards`, plus draft additions) |
| 1. Story | Background card (once), what he just finished, why it is hard, what is in front of him | Facts before the Step's entry moment only, scene, voice notes, two example cards |
| 2. Feeling | A second call reads the stage 1 cards and says how it feels | Stage 1 cards, smooth or rough mode |
| 3. Pause | One small snag built around a prop the code picks; roleplay chat (opening action, then 1 to 3 sentences) with mood, answer-first blocks, gestures and format policy from the prompt canvas; resolved card | Canvas blocks (`scripts/demo-prompts.mjs`), three candidates per turn |
| 4. Ending | The run log goes back to the model once; smooth and rough variants | Facts, snag log, mode |

The page can swap every card for the hand-written NF3 draft where one exists, so the two can be compared.

## Files

| File | What it is |
|---|---|
| `site-search.stage0.json` | Stage 0 data. Slices, people, where-now lines and authored cards are from NF3; the step mapping, leak words, props, gestures, voice notes and example lines were drafted for this demo and are unreviewed |
| `site-search.source.json` | The story entry from the database (issue #133) |
| `site-search.generated.json` | Output of the last run, including the prompts and every try |
| `index.html` | One self-contained page at phone width |

## Regenerate

```bash
node --env-file=.env scripts/demo-story.mjs
node scripts/build-demo-page.mjs
```

Needs `DEEPSEEK_API_KEY` in the local `.env`. A run is about 35 calls and about one US cent.

## What the checks cover and what they do not

`scripts/demo-checks.mjs` applies a subset of `docs/ai/AI_06_check-and-fallback.md`: no question or "you" in cards, no dashes, durations or clock times, full stop, forbidden and not-yet-known terms, unknown names, repeated openers and phrases, advice and comfort methods, breaking character, and for chat the opening action (present only when the format asks, 3 to 16 words, no pronouns, not a repeat). A failing item is regenerated up to three times.

The checks cannot tell whether a sentence invents a detail that is not in the facts (the demo allows small scene details, as the NF3 "now" cards do). Read the output before showing it.

## Findings for the model gateway (#132)

- The served model (`deepseek-flash`) reasons before it answers, and reasoning tokens count toward `max_tokens`. With 400 tokens the answer came back empty. The benchmark config's `maxOutputTokensPerCall` of 120 is too small for it.
- Per `docs/ai/AI_10_story-cards-on-focus-page.md` the production plan has authored state cards; here the model writes them to show the range.

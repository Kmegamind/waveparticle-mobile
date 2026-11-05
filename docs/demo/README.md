# Demo: story cards and pause chat for "The Canyon and the Mesa"

A demo of what the live generation produces, for the weekly meeting. It is not the production path (that is the server-side model gateway, issue #132).

| File | What it is |
|---|---|
| `site-search.source.json` | The one story entry used (copied from the story database, issue #133) |
| `site-search.generated.json` | Output: four Steps with three cards each, one stuck message, a four-message pause chat and a back-from-rest card |
| `index.html` | One self-contained page that shows the output at phone width (open it in a browser) |

## Regenerate

```bash
node --env-file=.env scripts/demo-story.mjs
node scripts/build-demo-page.mjs
```

Needs `DEEPSEEK_API_KEY` in the local `.env`. A run is about 10 to 15 model calls and costs well under one US cent.

## What the checks cover and what they do not

`scripts/demo-checks.mjs` applies a subset of `docs/ai/AI_06_check-and-fallback.md`: no question, no addressing the reader, no dashes, durations or clock times, full stop at the end, forbidden and not-yet-known terms, repeated openers and phrases, advice, breaking character. A failing item is regenerated up to three times, then replaced by a plain authored line and marked.

The checks cannot tell whether a sentence invents a detail that is not in the facts. Read the output before showing it.

## Findings for the model gateway (#132)

- The served model (`deepseek-flash`) reasons before it answers, and reasoning tokens count toward `max_tokens`. With 400 tokens the answer came back empty. The benchmark config's `maxOutputTokensPerCall` of 120 is too small for it, so the gateway and the benchmark need a larger budget or a non-reasoning model.
- Per `docs/ai/AI_10_story-cards-on-focus-page.md` only the back-from-rest card is model-written in production; opening, landing and state cards are authored. The state cards here are model-written only to show the range.

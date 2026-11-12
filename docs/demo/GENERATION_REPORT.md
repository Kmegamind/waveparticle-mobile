# Generation report: 25 Oppenheimer stories (demo cache)

Issue 207. Date of the run: 2026-11-12. Model: `deepseek-flash` through the existing generator `scripts/demo-story.mjs`.

## What these files are

- The generated cards in `docs/demo/<story-id>.generated.json` are **demo cache and reference material**. They are never shown to users and never used as a stored fallback (decision NO-BACKUP, 2026-11-12).
- The input files `docs/demo/<story-id>.stage0.json` were written by an AI from `src/content/oppenheimer/stories.json`. Their status is "written, checked by script, not read by a person" (decision READ-STATUS). The scene details, the people's role lines, the "where he is now" lines, the Step titles, the "why it is hard" lines, the props, the gestures, the voice notes, the example lines, the lists of words that must not be said early, and the allowed names are all invented and unreviewed. Each file lists this in its `_note` field.
- A script check passing does not mean anyone has read a card. **Nothing here is read by a person.** Whether any voice sounds like Oppenheimer needs Yue's reading.

## Money

| | |
|---|---|
| Total spent | **0.2397 US dollars** (cap was 1 US dollar) |
| Model calls | 839 |
| Per story | between 0.0078 and 0.0118 US dollars (listed below) |
| Estimate before the run | 0.25 to 0.40 US dollars |
| Stories that could not be generated | none (all 25 produced a file) |

One extra run of `site-search` (0.0084 US dollars, not kept) confirmed that the generalised script still works with no argument, so the whole job cost about 0.2481 US dollars.

Cost is taken from the token counts that DeepSeek returned, times the prices in `scripts/live-generation-benchmark.config.json`.

## What was run, and what changed in the generator

For each story the generator writes a background card, then for every Step a "what he just finished" card (from Step 2 on), a "why it is hard" card, a "what is in front of him" card and a "how it feels" card. Then it writes a stuck message for the pause, six chat turns (three candidate replies each, the best one kept), a resolved card, and two closing lines. A card that fails its checks is generated again, up to three tries, and the attempt with the fewest failures is kept. No failed card was replaced by written text.

The generator needed these small changes (it was not rewritten): it takes the story id as an argument (default `site-search`), it no longer has names, the prop "map" or the question "who's Dudley" built in, and it has an optional spending limit per run. The check rules in `scripts/demo-checks.mjs` were not changed. `site-search.stage0.json` got two extra fields (`pauseProp`, `laterWords`) so that it behaves as before.

## Results per story

How to read the table:

- "Story cards" means the background card, the Step cards, the stuck message, the resolved card and the two closing lines.
- "Second or third try" counts cards from a model call that needed more than one try. The Step cards of one Step come from one call, so they are counted together.
- A card listed under "still fail" used all three tries and kept the best attempt. The chat turns use three candidate replies written at once, not three sequential tries; the failure is listed only when none of the candidates passed.
- Checks that failed, by name, are in the last column. No story failed the checks "forbidden term" or "not known yet" (words that would reveal a later moment).

| # | Story | Steps | Cost (USD) | Model calls | Story cards that pass / total | Cards written on a second or third try | Pause chat turns that pass / 6 | Cards that still fail (all three tries used) |
|---|---|---|---|---|---|---|---|---|
| 1 | bohr-difficulties | 5 | 0.0088 | 33 | 24 / 24 | 0 | 4 / 6 | chat 1: repeated phrase (0 of 3 candidates passed); chat 4: repeated phrase (0 of 3 candidates passed) |
| 2 | tolman-lecture | 4 | 0.0090 | 34 | 19 / 20 | 4 | 4 / 6 | stuck message: unknown name: Leiden, unknown name: Thursday; chat 1: unknown name: Leiden, unknown name: Thursday (0 of 3 candidates passed); chat 4: repeated phrase, too long (0 of 3 candidates passed) |
| 3 | truchas-morning | 3 | 0.0090 | 31 | 15 / 16 | 0 | 5 / 6 | step 1 opening: unknown name: Sangre, unknown name: Cristo, too many sentences; chat 6: action where none is wanted (0 of 1 candidates passed) |
| 4 | midnight-pamphlet | 3 | 0.0090 | 31 | 16 / 16 | 1 | 5 / 6 | chat 1: dash (0 of 3 candidates passed) |
| 5 | marry-a-friend | 4 | 0.0103 | 37 | 19 / 20 | 8 | 4 / 6 | chat 1: repeated phrase, too many sentences (0 of 3 candidates passed); chat 4: repeated phrase (0 of 3 candidates passed); resolved: refers to another card |
| 6 | union-meeting | 4 | 0.0088 | 31 | 20 / 20 | 0 | 5 / 6 | chat 1: repeated phrase (0 of 3 candidates passed) |
| 7 | groves-berkeley | 5 | 0.0099 | 35 | 24 / 24 | 1 | 5 / 6 | chat 5: repeated phrase (0 of 1 candidates passed) |
| 8 | kitchen-martinis | 3 | 0.0088 | 31 | 15 / 16 | 0 | 5 / 6 | step 1 opening: too many sentences; chat 1: too many sentences (0 of 3 candidates passed) |
| 9 | pash-interview | 5 | 0.0096 | 33 | 24 / 24 | 0 | 6 / 6 | none |
| 10 | gadget-meeting | 4 | 0.0088 | 32 | 20 / 20 | 3 | 4 / 6 | chat 2: repeated phrase (0 of 1 candidates passed); chat 4: repeated phrase (0 of 3 candidates passed) |
| 11 | interim-committee | 5 | 0.0098 | 37 | 24 / 24 | 7 | 5 / 6 | chat 1: too many sentences (0 of 3 candidates passed) |
| 12 | trinity | 4 | 0.0098 | 33 | 20 / 20 | 4 | 4 / 6 | chat 4: repeated phrase (0 of 3 candidates passed); chat 5: repeated phrase (0 of 2 candidates passed) |
| 13 | panel-final-report | 4 | 0.0091 | 33 | 19 / 20 | 0 | 4 / 6 | step 1 opening: too many sentences; chat 1: too many sentences (0 of 3 candidates passed); chat 6: unknown name: Los, unknown name: Alamos (0 of 1 candidates passed) |
| 14 | farewell-ceremony | 4 | 0.0083 | 31 | 20 / 20 | 0 | 5 / 6 | chat 2: repeated phrase (0 of 2 candidates passed) |
| 15 | oval-office | 4 | 0.0109 | 35 | 20 / 20 | 2 | 6 / 6 | none |
| 16 | eagle-hill-garden | 5 | 0.0105 | 35 | 24 / 24 | 1 | 6 / 6 | none |
| 17 | shelter-island | 4 | 0.0100 | 33 | 20 / 20 | 1 | 6 / 6 | none |
| 18 | huac-closed-session | 5 | 0.0100 | 34 | 24 / 24 | 3 | 6 / 6 | none |
| 19 | letter-to-uncle-jim | 4 | 0.0100 | 34 | 20 / 20 | 5 | 5 / 6 | chat 4: repeated phrase (0 of 3 candidates passed) |
| 20 | face-to-face-with-crouch | 4 | 0.0095 | 33 | 20 / 20 | 1 | 5 / 6 | chat 5: repeated phrase (0 of 3 candidates passed) |
| 21 | griggs-in-princeton | 3 | 0.0078 | 30 | 16 / 16 | 1 | 4 / 6 | chat 1: too many sentences (0 of 3 candidates passed); chat 4: repeated phrase (0 of 3 candidates passed) |
| 22 | strauss-ultimatum | 5 | 0.0099 | 35 | 24 / 24 | 3 | 5 / 6 | chat 4: action repeats a recent one (0 of 3 candidates passed) |
| 23 | cross-examination | 5 | 0.0107 | 36 | 24 / 24 | 4 | 5 / 6 | chat 6: no answer from the model (0 of 1 candidates passed) |
| 24 | dreadful-weapon | 4 | 0.0096 | 35 | 19 / 20 | 2 | 5 / 6 | step 1 opening: refers to another card; chat 5: repeated phrase (0 of 1 candidates passed) |
| 25 | fermi-award | 5 | 0.0118 | 37 | 24 / 24 | 5 | 6 / 6 | none |

Totals: 520 story cards, 514 pass all checks, 6 still fail. 124 of 150 pause chat turns pass. 56 cards were written on a second or third try.

### Which checks failed, and how often

| Check | Cards that failed it |
|---|---|
| repeated phrase (a four-word run also used in an earlier text of the same story) | 16, all in the pause chat |
| too many sentences | 8 (five in chat replies, three in cards) |
| unknown name (a capitalised name that is not on the allowed list) | 8 words in 4 cards |
| refers to another card ("again", "another") | 2 |
| dash | 1 |
| too long | 1 |
| action repeats a recent one / action where none is wanted | 1 each |
| no answer from the model | 1 |

Failures in the chat are most often "repeated phrase" on chat turns 1 and 4. Turn 1 is "hey" and turn 4 is "what are you doing right now?". I did not read the candidates to find out what they repeated.

## The five cards I think are weakest

These are my reading of the text, not a judgment of voice.

1. **marry-a-friend, Step 2 "why it is hard".** "I have personal news for an old friend of the woman I mean to marry, and it sits in me while I talk about Spain." The Step 1 card already said the same thing. This breaks the rule that every card carries new information (decision CARD-NEW). The checks do not catch it.
2. **strauss-ultimatum, Step 4 "what he just finished".** "I read the draft charges through and said some could be denied, some were correct." The Step 3 card of this story says nearly the same. Again, no new information.
3. **trinity, Step 2 "what is in front of him".** "My coffee has gone cold in the cup. Rain is still loud on the tin roof." The first sentence is the same as the first sentence of the Step 1 card, and the cold coffee comes back in the stuck message and the closing lines.
4. **kitchen-martinis, background card (still fails: too many sentences).** "Kitty and I are giving Haakon and Barbara a proper goodbye at the house in Berkeley. Kitty is my wife and runs the evening better than I do. Haakon is a physicist and an old friend, and Barbara is his wife. They know we leave soon. They do not know where or for what." Five sentences where the rule is three or four, and "runs the evening better than I do" is an invented remark.
5. **tolman-lecture, stuck message (still fails: unknown names).** "The notebook I filled at Leiden is not on the desk. Half my lecture for Thursday is in it, and the room was swept last night." Leiden and Thursday are not in the facts, so the model made up a place and a day. The checks caught it and it failed on all three tries.

## What I noticed about quality across stories

These are observations from reading cards and counting, not a verdict.

- **Cards repeat each other across Steps.** In all 25 stories at least two Step cards share a four-word run (215 pairs in total), and in many cases the same idea. The existing check only compares cards written in the same call, so it passes them. This is the biggest gap against CARD-NEW. A "what he just finished" card often restates the previous Step's card, and the "why it is hard" card often restates the one before it.
- **The "how it feels" card is uniform.** All 105 of them start with "I am" or "I feel", usually followed by "uneasy", "tired" or "wary", then one prop. "Tired" appears in 41 of 420 Step cards.
- **The same prop comes back.** The model picks the first props in the list (coffee cup, lectern, pen, notebook, chalk) for most "what is in front of him" cards, so several cards in a story describe the same object.
- **Length.** Only one Step card is over 45 words (the current limit, CARD-LENGTH); the generator's prompt still says 50, which I did not change. 25 of 445 Step cards and resolved cards have more than three sentences, but the check allows four. Background cards are 38 to 64 words, all within 70.
- **Invented detail.** The model sometimes adds a place, a day, a remark or an object that is not in the facts (the Leiden notebook above, "runs the evening better than I do"). The checks catch only invented capitalised names. Small invented objects pass.
- **Facts are used well, later facts are not leaked.** No card was rejected for a forbidden term or a word from a later moment. Whether a card says something he could not yet know, in words not on the list, is not checked and needs reading.
- **Closing lines.** They still use the "smooth or rough" mood that decision END-TONE (2026-11-12) replaces, and the stuck message and pause chat still use one fixed pause setup (no pause number, decision PAUSE-3). Both are generator behaviour I was told not to change here.
- **Thin material.** Stories with only seven or nine facts (for example truchas-morning, tolman-lecture) were cut into eight moments by splitting sentences, so some moments are very close together. Stories with sixteen to twenty facts (cross-examination, pash-interview) have moments with four facts each. These cuts are in each input file and should be reviewed with the key moments.
- **Voice.** I do not judge whether the voice is good. It needs Yue's reading, starting with the cards listed above and the chat replies.

## How to run again

```bash
node --env-file=.env scripts/demo-story.mjs <story-id>
```

The input file `docs/demo/<story-id>.stage0.json` must exist. A run costs about one US cent. `DEMO_BUDGET_USD` stops a run when its own cost passes that number.

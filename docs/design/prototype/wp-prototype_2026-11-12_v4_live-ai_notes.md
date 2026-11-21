# Live prototype (version 4): what it is and what it is not

File: `wp-prototype_2026-11-12_v4_live-ai.html`. It is version 3 (the wireframe) with Claude writing the text. It runs on claude.ai as a private page, because the page asks Claude directly and needs no key. Opened as a local file, Claude is not connected and the page falls back to version 3's sample text and says so. The switch "Where the text comes from" in the demo controls changes the source.

## What Claude writes live, and which prompt it follows

| Screen content | Prompt source | Checks before it is shown |
|---|---|---|
| Background card (once, at most 70 words) | Demo `backgroundPrompt` | First person, no "you", no questions, no dashes, no durations, clock times, years or ages, names must be known, no words from later in the story, no repeated four-word phrase |
| Story cards of each Step: what he just finished, why it is hard, what is in front of him, how it feels (one to three sentences, at most 45 words, each new) | Demo `storyCardsPrompt` and `feelingPrompt`, changed for CARD-LENGTH and CARD-NEW | Same, plus length and sentence count |
| Next Step's cards | Generated in the background while the user works on the current Step | Same |
| Pause message | Demo `stuckPrompt`, rewritten for PAUSE-3: a new stuck situation each time, from the third pause much harder and he is worried he may fail, remembering the earlier snags | Same, plus no advice, no question, no "you", no talk about pausing or stopping |
| Rest chat replies | Demo `chatSystem`, with ERA-ANSWER added; no opening action | Scope label, sentence limit, no advice, no breaking character, no repeated phrases |
| Return pop-up | New prompt for TIME-WORDS: what he did and how the time felt, in any words, no clock numbers | Same as cards |
| Closing line and the line he leaves hanging | Demo `closingPrompt`, changed for END-TONE: what happened that day and how he feels, never counts pauses | Same as cards |
| Goal split | `docs/ai/AI_01_goal-split.md`, step 1b, with descriptions and no maximum | JSON, minutes in multiples of 15 that add up to the total |

A failed check is retried up to three times with the reasons given to the model. After three failures, or after 45 seconds, the failure screen appears (F3-X on the focus page, the same box on the rest page, the return pop-up, the summary). Nothing stored is shown instead. The 45 seconds is a placeholder (OPEN: set by testing).

The side panel has a "Live generation log": every call, its tries, the failures and the exact prompt sent, so prompts can be reviewed.

## Limits

- (Replaced in the fourth round, see below.) Earlier only chapter 8 had prepared inputs.
- A user's Steps are mapped to the eight story slices by position (Step k starts at slice k times 8 divided by the number of Steps). The decision log says an AI does this; this is a simple stand-in.
- Cards per Step are at most three (why, now, feeling). Cadence follows version 3's clock.
- The goal dialogue's own lines (GD1 to GD3) are still fixed text. Whether they are live is Open question 7 of the version 3 note.
- Prompts and checks are ported from the demo scripts, not from the production gateway. The checks are a subset of the planned ones.
- I tested the logic with a stand-in model on a local file. I could not run the real Claude calls from this session, so tone and length of real output have not been seen.

## Checks relaxed on 2026-11-12 (after the first real trial)

The first checks were too strict for real output. Now: the list of allowed names and the "mull" rule are gone; the "again" word rule, the repeated-opener rule and the full-stop rule are gone (the page adds a missing full stop and turns dashes into commas by itself); a repeat now means six shared words in a row, not four; chat replies are no longer checked against the later-story words or the pause words, may be one sentence over the limit, and may contain more than one question. Still enforced: card length (45 and 70 words, three sentences), first person, no "you", no questions in cards, no years, ages, durations or clock times, forbidden story terms, no advice, no breaking character, and no mention of pausing in the pause message.

## Second round (after the independent audit, 2026-11-12)

Audit report: `prompt-rules-audit.md` in the shared notes folder. Applied without needing a decision:
- The no-dates-and-ages decision (PERIODS) is a Life Path display rule only. It no longer touches any generated text.
- Conversation (pause message, chat, return pop-up): the only check left is "not empty" and "he never tells the user to pause or stop" (PAUSE-3). No repeat check, no scope label check, no length cap beyond about 120 words, no sentence limits.
- Story cards: no duration check, "you" is allowed inside quotation marks, forbidden and later-story words match whole words only ("generally" and "a little boy" no longer trigger), repeats mean eight shared words, and the prompt no longer bans "again" or "another" (only references to other cards).
- A failed feeling card no longer fails the step. Steps are generated in order, so the "already told" list is complete. Each try has its own 45 seconds.
- Closing line: no question, no talk of the other person's pauses or absence, forbidden terms.
- Goal split: any whole number of minutes (STEP-EDIT), not only multiples of 15.
- Prompts: cards use a narrator persona (no "to a friend", which invited "you"); the return pop-up asks no question; chat may use up to four sentences and must not volunteer later events or names.

Still for the owner (from the audit): whether "you" in quoted speech is fine in cards; the return pop-up text in FLOW says it never speaks to the user; what he does if asked "are you an AI?"; a crisis message in chat has no safety route in this prototype; whether one failed card should show the failure screen for the whole step.

## Third round: prompt panel and two-step pause

- The panel beside the phone (below it on narrow screens) lists every model call, newest first, with a label: live conversation (pause message, chat reply, return pop-up), story card generation (background card, story cards, feeling card, stuck situation, closing line) or goal split. Each entry shows the character data sent, the full prompt, the raw reply of every try, and every check rule with pass or fail and the reason. The filter buttons show all, only conversation, or only story cards.
- Pause is now two calls in order. First "Stuck situation (new story state)": the page picks a prop that was not used before in this Step, and Claude writes what has gone wrong in his story and why; from the third pause it must be much harder and grow out of the earlier ones. Then "Pause message": he tells the user about it and how he feels, and from the third pause says he is worried he may fail. Chat replies after that carry the situation. Before this change both were one call.

## Fourth round: all 26 stories connected

The stage 0 inputs of all 26 Oppenheimer stories (facts, people, props, voice notes, forbidden and later words, per story) are embedded in the page. The 25 new ones come from the open pull request docs/207-demo-stories-all (read through the GitHub interface; nothing was checked out or changed in the repository); the 26th is the Canyon story. They are AI-written drafts that no person has read, as the pull request says. The stored cards inside them and the DeepSeek-generated cache are NOT used: under decision NO-BACKUP stored text is never shown, so every card is written live from these inputs.
Each chapter on the Life Path now plays its own story. The goal sentence on the chapter card and on the focus page, the "Who I am" sheet and the opening line of the goal dialogue come from that story's inputs. New users start at chapter 1 again (decision M1). In sample-text mode the cards are still the Göttingen mock text for every chapter; only live mode follows the story.

## Fifth round: Moriarty added (2026-11-12)

Moriarty now opens his own Life Path (screen id CPAGE-M): five stories in three named periods, no dates or ages. The Quiet Web: One Line in Hallam's Ledger (story 1), The Rule of No Names (story 2). The Closing Net: The Leak (3), The Net Closes (4). The Duel: The Last Road (5). Only story 1 is playable; the others show as outlines with Begin missing. Story 1 plays through the same live pipeline as Oppenheimer's: goal dialogue, plan, background card, story cards, pause (two calls), chat, return pop-up, closing line.
Source files, read only, from 2_Areas/Product/Moriarty: tools/pipeline/moriarty-story1.stage0.json (embedded), demo-prompts.fiction.mjs (its five changes are in the page prompts, applied only when a story has a persona and scene details: the persona sentence from the data, the fiction card rules, the invented scene details block, the diary-like feeling instruction; card length 45 words was already applied everywhere), and demo-checks.mjs (the page uses its own checks, which are the relaxed ones agreed on 2026-11-12, not the unchanged repository copy).
Not used: the private note of each Step and the hidden detail layer in tools/notebook/story1_notebook_run2.json. The stage 0 file does not use them and no document says where the user sees the notes. Not run: a safety route in chat, Moriarty's avatar and background (still the old placeholders).

## Sixth round: Life Path in the layout Yue sent as a screenshot

Both Companions use one Life Path layout: fixed header with a gray portrait box, the name and three tags; a vertical timeline with nodes; period headings; no dates or ages. A finished story shows its title and one italic first-person line; the current story is a card with its goal and a gray Begin button; later stories show the title only (Moriarty's outlines say "Outline only"); the tab bar is shown. The italic lines for Oppenheimer come from StoryMap_Feature_Docs/path_lines_oppenheimer_draft_2026-10-29.json (draft, read by no person). For Moriarty's story 1 the line is built here from two facts in his data, because no path line exists for him. The Guide link for the Oppenheimer Life Path opens a demo account with chapters 1 to 7 finished, so the full look is visible; a new account starts at chapter 1.

## Seventh round: the visual design of the earlier designed prototype restored

The look of `wp-prototype_2026-10-29_v1.html` (the designed prototype, published version 8) is back in the live prototype; the wireframe rules of version 2 (grayscale, no images, system font) no longer apply to this file. What was brought over: the Google Fonts (Atkinson Hyperlegible Next and Mono, Bricolage Grotesque, Newsreader; the only outside request), the page chrome with logo, the phone shell with its glows, the three skins (day and night skins for Home, Companions, Goals and Me, switchable under Me > Appearance; the dark Oppenheimer skin with the canyon art for the goal dialogue, focus page, rest page and summary), paper-tag buttons, taped slips for his voice, cards, fields, chips, the real portrait images, the tab bar icons, sheets and toast, thread bubbles, the plan step rows, the Life Path, the Companion rows, calendar, settings rows, the focus page (my-goal row, panels, paired step ticks, mono timer, card stack and pager) and the rest page. The canyon art is drawn only for the Canyon story. Moriarty uses the same dark skin as Oppenheimer; he has his own portrait.
All behaviour is unchanged: screen ids, the Guide, demo controls, prompt panel, live generation with checks, the two-step pause, return pop-up, closing line, goal split, the 26 Oppenheimer stories and Moriarty story 1, the skip-sign-in buttons and the waiting and failure states. Ages are not shown (the period headings stay). In live mode a Guide jump to a focus screen first shows the waiting state until the cards are written, so the screen id briefly reads F3.
Life Path rows now follow Yue's screenshot: a fixed header (portrait, name, tags), a timeline with named periods, then every chapter with a small title and a description. The 31 AI-drafted scene descriptions (26 for Oppenheimer, 5 for Moriarty, listed in wp-prototype_2026-11-12_life-path-descriptions.md, read by nobody) are the current card text and the description line of every later chapter; finished chapters show the italic path line. The Guide jump for the Oppenheimer Life Path opens a demo account with chapters 1 to 7 finished, as in the screenshot.
Not verified: the real fonts were loaded in the test, but only with the stand-in model; I did not look at every screen in both skins (day, night and the dark Oppenheimer skin were seen on Companions, the Life Paths, the plan, the focus page and the rest page); the page weighs about 1.2 MB, mostly the portrait images.

## Sixth round: decisions of 2026-11-21 (issue #369 follow-up)

- R1 shows the two-call pause in order: first his stuck story (the code picks the category and a prop; the model returns the prop and the story), then his description of the predicament and his feelings (PAUSE-TWO-CALLS). Quiet demo notes above each slip say which call it is; they are shown only before the user has written.
- R1-C: no category label and no per-message label; the chat reply prompt no longer asks for a scope field (CHAT-NO-LABEL).
- GD2 carries a demo note that the goal shape uses the local rule with no model call (GOAL-SHAPE-LOCAL).
- CPAGE, CPAGE-M and END carry a demo note that their lines wait for the owner's inner-thoughts framework (STORY-LINES-LATER, END-LINE-PENDING). These screens are not redrawn. S6 and the long-term chat are not drawn.

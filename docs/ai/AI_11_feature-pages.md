# AI-11 · One admin page per AI feature

> **Date**: 2026-11-25 · **Status**: rule decided by the owner (decisions AI-PAGES to AI-PAGE-TITLES in `docs/DECISIONS.md`, 2026-11-25); the per-feature texts in section 3 are **drafts for the owner to edit**. Issue #431, part of #430. The decision log wins where this file disagrees with it.
> **What this file is for**: the rule for the admin page of each AI feature (section 1), and the first values of sections (a) purpose, (b) pass standard and (c) current approach for each of the 7 features (section 3). The database table of #430 (AI-PAGE-STORE) is seeded from section 3. After that, the owner edits the texts in the admin, and the admin, not this file, holds the current text.
> **Extended 2026-11-26** (issue #466): the 7 pages are now the Runtime rows of **one registry of all AI features** (AI-REGISTRY, which supersedes AI-PAGES-7). Each row has the fields of AI-REGISTRY-FIELDS, which extend sections (a) to (f) below; the requirements are `docs/PRD.md` sections 4.14 (FR-AIREG) and 4.15 (FR-AILAB, the prompt lab and run log); the related decisions are AI-REGISTRY to AI-REQUIREMENT-FIELD in `docs/DECISIONS.md`. Section 5 lists the 19 rows. The rules of section 1 still hold for every row.

## 1. The rule for an AI feature page

### 1.1 The pages

There are 7 pages, one per AI feature (AI-PAGES). The page title is the feature's name followed by its prompt key or keys in brackets (AI-PAGE-TITLES):

| # | Page title | Prompt keys in `public.prompts` |
|---|---|---|
| 1 | Goal split (plan_split) | `plan_split` |
| 2 | Step cards (step_cards) | `step_cards` |
| 3 | Pause message (stuck_story + pause_predicament) | `stuck_story` (call one), `pause_predicament` (call two); two calls (FR-REST-2, PAUSE-TWO-CALLS) |
| 4 | Rest reply (rest_reply) | `rest_reply` |
| 5 | Return pop-up (return_popup) | `return_popup` |
| 6 | Closing line (closing_line) | `closing_line` |
| 7 | Safety classifier (safety_classifier) | `safety_classifier` |

`retry_hints` has no page of its own. Every page shows it in a section named **"Fix added after a rejected answer"**: the fixes of `retry_hints` that the feature's checks can add when its answer is rejected (`docs/ai/prompts/retry_hints.md` line 12; the retry path is `docs/ai/AI_06_check-and-fallback.md` line 23).

The owner's message named "8 pages" but listed 7. The owner confirmed 7 pages on 2026-11-25 (`docs/DECISIONS.md`, AI-PAGES-7, which closes AI-PAGES-COUNT). AI-PAGES-7 is superseded by AI-REGISTRY (2026-11-26): these 7 are the Runtime rows R-01 to R-07 of section 5, and they keep their slugs, prompt keys and sections.

### 1.2 The sections of every page

| Section | What it shows | Where it lives (AI-PAGE-STORE, AI-PAGE-RUNS) |
|---|---|---|
| (a) Purpose | What the feature does for the user, in one or two sentences | Database table, edited in the admin |
| (b) Pass standard | Loose yes/no questions a person answers after reading a small batch of samples | Database table, edited in the admin |
| (c) Current approach | Which prompt, how many calls, which checks | Database table, edited in the admin |
| (d) Status | One of: not started, exploring, passed, frozen | Database table, with its history (AI-PAGE-STATUS) |
| (e) Prompt text | The full current text of each key: the published version, and the draft when one exists | Read live from `public.prompts`; never copied |
| (f) Test results | The offline runs of #42 and the stub runs | Imported into a table (AI-PAGE-RUNS) |
| Fix added after a rejected answer | The `retry_hints` fixes that apply | Read live from `public.prompts` (`retry_hints`) |

Rules for the sections:

1. **Never invented.** The first values of (a), (b) and (c) are drafted only from `docs/ai/AI_*.md`, `docs/PRD.md` and the two story-pipeline files named in section 2, with the source quoted as file and line and the label "draft - owner to edit". The current approach (c) may also quote `docs/DECISIONS.md` and the prompt seed files `docs/ai/prompts/<key>.md`, which record what is built.
2. **No source means "Not written yet".** A section with no source shows the plain words "Not written yet", never filler text.
3. **Pass questions.** A pass question may be reworded as a yes/no question only from a stated requirement of a source. Where a source has only numbers (targets, error budgets), the question asks whether the number is met and quotes that line. The method the questions follow: 3 to 5 yes/no questions, answered by a person who reads a small batch of samples, and loose, for example 4 "yes" out of 5 passes (`story-pipeline/ROADMAP_ai-features-to-done_2026-11-23_v1.md` line 12; `story-pipeline/PASS-CRITERIA_features-1-to-3_2026-11-23_v1.md` line 9). Where section 3 lists more than 5 drafts, the owner chooses.
4. **Status.** The four values are the story pipeline's four (`story-pipeline/ROADMAP_ai-features-to-done_2026-11-23_v1.md` line 14). Every feature starts as **exploring**. Only the admin role changes a status, and every change is kept in its history (AI-PAGE-STATUS).
5. **Test results.** A run made with the fake model (the stub) is marked as such on the page. Until the first real run (#413) the real-run part of (f) reads **"No real run yet"** (AI-PAGE-RUNS).
6. **Titles** follow section 1.1 (AI-PAGE-TITLES).

## 2. Sources and how they are quoted

- Repository files are quoted as `<path>:<line>`, with the line as of this pull request (base `origin/main` at `284ad05`).
- Two files are outside the repository, in the product folder `2_Areas/Product/story-pipeline/`. They are quoted by file name and line only:
  - `ROADMAP_ai-features-to-done_2026-11-23_v1.md` (short: **RM**), the story pipeline's road map of 2026-11-23;
  - `PASS-CRITERIA_features-1-to-3_2026-11-23_v1.md` (short: **PC**), its pass questions for features 1 to 3.
  Both are written in Chinese. The lines below are English translations, kept close to the original.
- PC and RM features 1 to 4 were written for the story pipeline (fictional Companions; test set: three chapters of one novel, PC line 7), not for the app's prompt keys. Where a draft below uses them, the owner decides whether they apply.
- Format of every draft line: `- draft - owner to edit: <text> (source: <file>:<line>)`.

## 3. The seven features

Every feature: **(d) status: exploring** (AI-PAGE-STATUS). **(e)** is read live from `public.prompts`. **(f)** comes from imported test runs, fake-model runs marked; real runs: "No real run yet" until #413.

### 3.1 Goal split (plan_split)

**(a) Purpose**

- draft - owner to edit: Turn the goal the person typed and the minutes they gave into steps they can start. (source: docs/ai/AI_01_goal-split.md:13)

**(b) Pass standard**

The story pipeline puts the app's own goal split outside its road map (RM line 65), so no pass questions exist there. Drafts from the owner's planning prompt:

- draft - owner to edit: Is every Step a concrete action someone would really do, starting with a verb? (source: docs/ai/AI_01_goal-split.md:79)
- draft - owner to edit: Are there no generic labels such as Research, Plan or Review, unless the Goal itself is research, planning or review? (source: docs/ai/AI_01_goal-split.md:79)
- draft - owner to edit: Are the Steps in the order the work would really happen, with no work the Goal does not mention? (source: docs/ai/AI_01_goal-split.md:79)
- draft - owner to edit: Can the first Step be started within the first minute? (source: docs/ai/AI_01_goal-split.md:79)
- draft - owner to edit: Is there never a silent generic list such as "Research materials for …"? (source: docs/ai/AI_01_goal-split.md:122)
- draft - owner to edit: Does the split arrive within 5 seconds, with a 10-second hard timeout (a hypothesis target)? (source: docs/PRD.md:324)

**(c) Current approach**

- draft - owner to edit: One model call, the split; the Goal's shape is the local rule `classifyGoalShape`, with no model call. (source: docs/DECISIONS.md:278)
- draft - owner to edit: The owner's planning prompt, word for word: `plan_split` version 2. (source: docs/DECISIONS.md:312)
- draft - owner to edit: The code checks every answer: it parses as JSON; the title is 1 to 40 characters; at least one Step; each Step title 1 to 80 characters; each description 1 to 40 words; minutes are positive whole numbers that add up to the total. A failed answer is retried with the fix added, within the time limit, then the failure screen. (source: docs/ai/AI_01_goal-split.md:84)

### 3.2 Step cards (step_cards)

**(a) Purpose**

- draft - owner to edit: While the user works, his story cards arrive one at a time, spread across the user's Steps in story order. (source: docs/PRD.md:228)
- draft - owner to edit: Step 1 opens with a background card told in his own voice: who is here, where this is, and what each person knows. (source: docs/PRD.md:241)
- draft - owner to edit: (story-pipeline cards) What the user sees reads like role-play of "what he is doing and thinking right now", with a person in it, not a plot summary; after the few cards of one of his purposes, the user can say what happened, what he cares about and what he will do next. (source: ROADMAP_ai-features-to-done_2026-11-23_v1.md:46)

**(b) Pass standard**

Drafts from PC feature 3, written for the story pipeline's cards; whether they apply to `step_cards` is the owner's choice. PC counts a feature as passed when each test story gets at least 4 "yes" out of 5 and breaks no red line (PC line 9).

- draft - owner to edit: Can each card, read alone, be understood without guessing from the cards around it? (source: PASS-CRITERIA_features-1-to-3_2026-11-23_v1.md:46)
- draft - owner to edit: Does it read like him speaking and thinking, in his voice, not like a narrator retelling the plot? (source: PASS-CRITERIA_features-1-to-3_2026-11-23_v1.md:47)
- draft - owner to edit: In at least half of the cards, can I see how the event relates to what he is trying to do (his plan)? (source: PASS-CRITERIA_features-1-to-3_2026-11-23_v1.md:48)
- draft - owner to edit: Is the order of events right, with the important events told and none clearly missing? (source: PASS-CRITERIA_features-1-to-3_2026-11-23_v1.md:49)
- draft - owner to edit: Read as a whole, does it feel like this person is doing something right now, and does it make me want to see the next card? (source: PASS-CRITERIA_features-1-to-3_2026-11-23_v1.md:50)
- draft - owner to edit: Red line: is there no sentence that reads as awkwardly lifted from the source text (no beginning or end, unclear speaker, not how this person talks)? (source: PASS-CRITERIA_features-1-to-3_2026-11-23_v1.md:11)
- draft - owner to edit: Red line: is there no person or thing that does not belong to this story or this person? (source: PASS-CRITERIA_features-1-to-3_2026-11-23_v1.md:12)
- draft - owner to edit: Red line: is nothing said that happens only after this story? (source: PASS-CRITERIA_features-1-to-3_2026-11-23_v1.md:13)
- draft - owner to edit: Red line: can a stranger who reads it tell what happened? (source: PASS-CRITERIA_features-1-to-3_2026-11-23_v1.md:14)

**(c) Current approach**

- draft - owner to edit: Made ahead once per story and shared by all users (the background card and the step story cards); not a live call. (source: docs/DECISIONS.md:204)
- draft - owner to edit: Cards are made per story part; the app spreads the parts across the user's Steps with plain code, no model call. (source: docs/DECISIONS.md:205)
- draft - owner to edit: Published first; Yue reads them on the phone afterwards, and a published card can be edited. (source: docs/DECISIONS.md:273)
- draft - owner to edit: A step story card is 1 to 3 sentences and at most 45 words; the background card at most 70 words; a card over the limit cannot be published. (source: docs/DECISIONS.md:210)
- draft - owner to edit: `step_cards` version 2: story cards carry no introduction phrase. (source: docs/ai/prompts/step_cards.md:12)

### 3.3 Pause message (stuck_story + pause_predicament)

**(a) Purpose**

- draft - owner to edit: Pause opens the rest page, where his first message, generated live, is about the snag his own story has hit and how he feels about it. (source: docs/PRD.md:271)
- draft - owner to edit: (story-pipeline dialogue) When the user pauses or rests, what he says sounds like his own trouble, not like customer service, and does not preach. (source: ROADMAP_ai-features-to-done_2026-11-23_v1.md:60)

**(b) Pass standard**

The story pipeline's pass standard for dialogue is "to be written, after reading the current prompts and 10 test replies" (RM line 61). Drafts from stated requirements and numbers:

- draft - owner to edit: Does what he says sound like his own trouble, not like customer service, and without preaching? (source: ROADMAP_ai-features-to-done_2026-11-23_v1.md:60)
- draft - owner to edit: Did his troubles feel real? (source: docs/ai/AI_03_stuck-story-layer.md:105)
- draft - owner to edit: Did he seem to repeat himself? (wanted answer: no) (source: docs/ai/AI_03_stuck-story-layer.md:105)
- draft - owner to edit: Did pausing feel like it cost him something, a guilt for the user? (wanted answer: no) (source: docs/ai/AI_03_stuck-story-layer.md:105)
- draft - owner to edit: Does the message add no event, no named new person, no change of weather or place, and no fact after the user's position? (source: docs/PRD.md:278)
- draft - owner to edit: Within one Step, is the same snag never shown twice? (source: docs/PRD.md:277)
- draft - owner to edit: From the third Pause in a Step, is the stuck situation much harder, and does he say he is worried he may fail, without telling the user what to do? (source: docs/PRD.md:386)
- draft - owner to edit: After the checks, are there 0 new events in 400 stuck stories (a guessed pass bar)? (source: docs/ai/AI_03_stuck-story-layer.md:103)
- draft - owner to edit: Before the checks, are fewer than 5% of stuck stories near repeats (a guessed pass bar)? (source: docs/ai/AI_03_stuck-story-layer.md:103)

**(c) Current approach**

- draft - owner to edit: Two calls: first the stuck story, then his description of the predicament and his feelings; code chooses the snag category and the prop; the message he shows is 1 or 2 sentences and at most 30 words. (source: docs/DECISIONS.md:275)
- draft - owner to edit: The props come from the story's scene table; a category not used in the last two Pauses, a prop not used before in this Step. (source: docs/ai/AI_03_stuck-story-layer.md:46)
- draft - owner to edit: Call one, `stuck_story` version 3: the stuck story as `{prop, story}` around the category and prop the code picked. (source: docs/ai/prompts/stuck_story.md:12)
- draft - owner to edit: Call two, `pause_predicament` version 1: his own words about the stuck story and how he feels, plain text, 1 or 2 sentences, at most 30 words; from the third Pause he says he is worried he may fail. (source: docs/ai/prompts/pause_predicament.md:12)
- draft - owner to edit: Checks built in #56: prop echo, scene objects, event verbs, people and place, later knowledge, near repeat, wrong shape. (source: docs/ai/AI_03_stuck-story-layer.md:78)

### 3.4 Rest reply (rest_reply)

**(a) Purpose**

- draft - owner to edit: The user may type free text, with no limit on replies; the Companion answers briefly from his own side and in his own voice. (source: docs/PRD.md:274)
- draft - owner to edit: (story-pipeline dialogue) When the user pauses or rests, what he says sounds like his own trouble, not like customer service, and does not preach. (source: ROADMAP_ai-features-to-done_2026-11-23_v1.md:60)

**(b) Pass standard**

The story pipeline's pass standard for dialogue is "to be written" (RM line 61). Drafts from stated requirements and the targets of `docs/ai/AI_04_rest-chat.md` section C (guesses, set before running):

- draft - owner to edit: Does what he says sound like his own trouble, not like customer service, and without preaching? (source: ROADMAP_ai-features-to-done_2026-11-23_v1.md:60)
- draft - owner to edit: Does the reply respond to what the person said, even when he deflects (scored 4 or 5 out of 5 on at least 80% of replies)? (source: docs/ai/AI_04_rest-chat.md:113)
- draft - owner to edit: Is he in character: no coach, no anachronism, no assistant voice (on at least 95% of replies)? (source: docs/ai/AI_04_rest-chat.md:114)
- draft - owner to edit: Does no reply leak a future fact (0 in 180)? (source: docs/ai/AI_04_rest-chat.md:116)
- draft - owner to edit: Did it feel like talking to him, not to an assistant? (source: docs/ai/AI_04_rest-chat.md:126)
- draft - owner to edit: Asked about something he could not know, does he answer as a person of his own time: says what he knows, says plainly when he does not know, and may guess? (source: docs/PRD.md:276)
- draft - owner to edit: Does an everyday-stress message get an answer in character, without advice? (source: docs/PRD.md:335)
- draft - owner to edit: Does the advice check fire on fewer than 10% of replies before retry? (source: docs/ai/AI_04_rest-chat.md:117)
- draft - owner to edit: Are fewer than 25% of replies retried? (The fallback target on the same line is withdrawn: there is no fallback text, NO-BACKUP.) (source: docs/ai/AI_04_rest-chat.md:118)
- draft - owner to edit: Are fewer than 10% of blocked replies ones a person finds fine (over-block)? (source: docs/ai/AI_04_rest-chat.md:119)
- draft - owner to edit: Is the reply shown within 3 seconds at the median and 6 seconds at the 95th percentile? (source: docs/ai/AI_04_rest-chat.md:120)

**(c) Current approach**

- draft - owner to edit: One call per message of the user, `rest_reply` version 2: no label for the user's message; the feelings rule and ending on his own situation; a later word the person typed may be repeated; never mentions being an AI. (source: docs/ai/prompts/rest_reply.md:12)
- draft - owner to edit: Every reply passes the same spoiler check as the story cards; a failing reply is generated again within the time limit. (source: docs/ai/AI_04_rest-chat.md:6)
- draft - owner to edit: Check: later-knowledge words; a word the user typed himself is allowed. (source: docs/ai/AI_04_rest-chat.md:90)
- draft - owner to edit: Check: at most one question, and the reply may end on it. (source: docs/ai/AI_04_rest-chat.md:92)
- draft - owner to edit: Check: 1 to 3 sentences. (source: docs/ai/AI_04_rest-chat.md:93)

### 3.5 Return pop-up (return_popup)

**(a) Purpose**

- draft - owner to edit: Before the clock restarts, a pop-up in his voice says what he did during that time and how he felt; it appears after Back to step on the rest page and after 5 minutes or more away. (source: docs/PRD.md:258)

**(b) Pass standard**

Neither story-pipeline file covers the return pop-up. Drafts from the PRD's stated requirements:

- draft - owner to edit: Does it say, in his voice, what he did during that time and how he felt? (source: docs/PRD.md:258)
- draft - owner to edit: Does it say nothing about the user, such as "you were away"? (source: docs/PRD.md:260)
- draft - owner to edit: Does it state no length of time away and not blame the user for leaving (his own words for how the time felt are allowed)? (source: docs/PRD.md:395)
- draft - owner to edit: Is it free of later facts, clock times, "you", a question, a hook, praise and advice? (source: docs/PRD.md:394)
- draft - owner to edit: Does no event move his story (leaving and returning do not move it)? (source: docs/PRD.md:381)
- draft - owner to edit: Is the text ready within about 1 second of Back (a hypothesis target)? (source: docs/PRD.md:324)

**(c) Current approach**

- draft - owner to edit: Generated live by the AI when the user taps Back from the rest conversation and when the user returns after 5 minutes or more away. (source: docs/DECISIONS.md:69)
- draft - owner to edit: `return_popup` version 2: 1 or 2 sentences, at most 30 words; his situation is back to before the snag and no event moves his story. (source: docs/ai/prompts/return_popup.md:12)
- draft - owner to edit: He may describe how the time felt in his own words; exact clock numbers stay out until decided. (source: docs/DECISIONS.md:172)

### 3.6 Closing line (closing_line)

**(a) Purpose**

- draft - owner to edit: At the end of a story the closing line tells what happened to him that day and how he feels about it. (source: docs/PRD.md:294)

**(b) Pass standard**

Neither story-pipeline file covers the closing line. Drafts:

- draft - owner to edit: Does it tell what happened to him that day and how he feels about it? (source: docs/PRD.md:294)
- draft - owner to edit: Does it leave out the user's text, Step names, the user's pauses, any judgement of the user, any lesson or praise, and minutes? (source: docs/PRD.md:294)
- draft - owner to edit: Would the user recognise the mood, without being praised or taught? (source: docs/ai/AI_07_end-feeling-line.md:11)
- draft - owner to edit: Does the feeling come from what happened, not a default "proud" or "wise"? (source: docs/ai/AI_07_end-feeling-line.md:58)

**(c) Current approach**

- draft - owner to edit: Made ahead with the story's cards and published with them; not a live call. (source: docs/DECISIONS.md:218)
- draft - owner to edit: 1 to 3 sentences and at most 45 words; a line over the limit cannot be published. (source: docs/DECISIONS.md:210)
- draft - owner to edit: `closing_line` version 1: his closing line and the line he carries, moved from `gateway.ts` unchanged. (source: docs/ai/prompts/closing_line.md:12)

Note for the owner: the seed's check setting is still 40 words (`docs/ai/prompts/closing_line.md` line 16), while LEN-CARD says 45 and replaces "the closing line's 40 words in the prompt settings" (`docs/DECISIONS.md` line 210). Not changed here (docs only); listed as an open question in #431.

### 3.7 Safety classifier (safety_classifier)

**(a) Purpose**

- draft - owner to edit: Before any reply or save, a classifier call sorts a free-text message as crisis, stress or none, seeing the message and the last two messages in the same field; the higher tier of the keyword layer and the classifier wins, and an unsure answer is a crisis. (source: docs/PRD.md:336)

**(b) Pass standard**

No yes/no questions exist in any source. The error budget has numbers (guesses, to be set with compliance):

- draft - owner to edit: Does it catch at least 99% of the crisis set, and all explicit statements? (source: docs/ai/AI_05_safety.md:77)
- draft - owner to edit: Does it flag at most 2% of the harmless set as crisis? (source: docs/ai/AI_05_safety.md:78)
- draft - owner to edit: Does it add at most 1.5 seconds before the reply or split call? (source: docs/ai/AI_05_safety.md:81)

The low-mood rows of the same table (lines 79 and 80) are not drafted: that tier is deferred (A5b).

**(c) Current approach**

- draft - owner to edit: The classifier runs through the same AI provider as the other live calls, with optional separate settings. (source: docs/DECISIONS.md:288)
- draft - owner to edit: It runs before the reply call, the split or any save, with one attempt and 1.5 seconds, the prompt read included. (source: docs/DECISIONS.md:289)
- draft - owner to edit: It answers crisis, stress, none or unsure; unsure counts as crisis, and any other answer is a classifier failure. (source: docs/DECISIONS.md:290)
- draft - owner to edit: When it fails or takes longer than 1.5 seconds, the keyword layer decides alone and an alarm is sent at most once a day. (source: docs/DECISIONS.md:292)
- draft - owner to edit: `safety_classifier` version 1, two tiers. (source: docs/ai/prompts/safety_classifier.md:12)

## 4. What is "Not written yet"

With the drafts above, every feature has at least one sourced line in (a), (b) and (c). Where a draft rests only on story-pipeline text written for other cards (step cards, (b)) or on guessed numbers (pause message, rest reply, safety classifier, (b)), the owner decides whether it stays; if the owner removes every line of a section, that section shows "Not written yet".

These parts have no source and show "Not written yet":

- The purpose of `retry_hints` for the user: it is never shown to a user, so its section is described for the admin only (section 1.1).
- A status from a source: none of the app's prompt keys has a status in any source; every feature starts as exploring by decision (AI-PAGE-STATUS). RM line 62 gives "not started" for the story pipeline's dialogue feature (fictional Companions), not for these keys.

## 5. The registry of all AI features (2026-11-26)

The owner's decisions of 2026-11-26 (AI-REGISTRY to AI-ROLEPLAY-FORMAT, and the owner's additions AI-REGISTRY-STORE, AI-LAB-STUB, AI-SAMPLES-LOCAL and AI-PROPOSED4-HOLD, and the owner's answers AI-RUN-LIVE, AI-SEED-STATUS, AI-PROMPT-CATEGORY and AI-REQUIREMENT-FIELD in `docs/DECISIONS.md`) turn the 7 pages into one registry. The requirements are `docs/PRD.md` sections 4.14 and 4.15.

### 5.1 What changes for the rules above

- The rules of section 1.2 (never invented, "Not written yet", pass questions, status, test results, titles) hold for every row, Pipeline and Quality gate rows included (FR-AIREG-4).
- The fields of a row are those of AI-REGISTRY-FIELDS (PRD section 4.14, Fields). They add to sections (a) to (f); they do not replace them.
- Writers edit every field except the status and the category (AI-PAGE-EDIT, extended 2026-11-26). Any role may mark an example candidate or confirmed (AI-EXAMPLE-CONFIRM).
- The rows live in the existing tables (`public.ai_features` and its status history and test runs). There is no second registry table (AI-REGISTRY-STORE). The Feature ID is a new column next to the slug (AI-PROMPT-CATEGORY).
- Rule 4 of section 1.2 ("every feature starts as exploring") applied to the first 7. The 12 new rows take the status given in the seed; the 7 Runtime rows keep their current status (AI-SEED-STATUS).
- The Runtime rows keep section (a) purpose as it is and get the requirement as a separate field, filled from the seed (AI-REQUIREMENT-FIELD).
- Admin and writer both may press Run on the live admin; agents and tests never do (AI-RUN-LIVE).
- Every test and end-to-end run uses the fake model, and the stub marker shows (AI-LAB-STUB, as rule 5 of section 1.2).
- ~~Source excerpts and sample texts from books are never committed~~ (dropped by the owner on 2026-11-28, TEXT-IN-GIT-DROPPED: the repository will be made private later); test fixtures use short invented text (AI-SAMPLES-LOCAL).
- A prompt holds no information about one character (AI-CHARACTER-NEUTRAL; the code fix of `checks.ts` is #468).
- The proposed prompts in `prompt-table-source/proposed4/` are not imported or published in this work (AI-PROPOSED4-HOLD).

### 5.2 The 19 rows

From the owner's `registry-seed.json` (`story-pipeline/admin-handoff_2026-11-26/`, 2026-11-26). Only the id, name, category, where it appears and the prompt named by the seed are listed here; the other fields (requirement, output format, rationale, room to improve, example, notes, status) stay in the seed file and reach the database through the seed script, run by the owner (AI-REGISTRY-STORE, AI-SAMPLES-LOCAL). The seed's prompt names are the owner's file names, not keys of `public.prompts`. The last column gives the key in `public.prompts` and its category (AI-PROMPT-CATEGORY): the Runtime rows keep their keys; the Pipeline and Quality gate keys are new, made from the Feature ID and the name in the existing key format, and reach the database by the owner's migration and import.

| ID | Name | Category | Where it appears | Prompt named in the seed | Key in `public.prompts` (category) |
|---|---|---|---|---|---|
| P-01 | Find episodes | Pipeline | Book to story library, first step | S1_find-episodes v1.0 | `p01_find_episodes` (pipeline) |
| P-02 | Select stories | Pipeline | After find episodes | S2_select-stories v1.0 | `p02_select_stories` (pipeline) |
| P-03 | Cut source | Pipeline | After selection | S3_cut-source v1.0 | `p03_cut_source` (pipeline) |
| P-04 | Plan (historical) | Pipeline | Story library, historical Companions | S4_notebook-historical v4-final | `p04_plan_historical` (pipeline) |
| P-05 | Plan (fictional) | Pipeline | Story library, fictional Companions | S4_notebook-fictional v4.1 (the prompt file's version; the seed says v3.5, AI-P05-VERSION) | `p05_plan_fictional` (pipeline) |
| P-06 | Merged titles | Pipeline | Plan page when the user has fewer than five steps | S4e_merged-titles v0.4 | `p06_merged_titles` (pipeline) |
| P-07 | Story cards | Pipeline | Focus page, one by one while the user works | scripts/deepseek_cards v0.5 (DeepSeek, one call) | `p07_story_cards` (pipeline) |
| G-01 | Judge plan | Quality gate | After two plan runs | S5_judge-two-runs v1.0 | `g01_judge_plan` (gate) |
| G-02 | Fix plan | Quality gate | After judging | S6_fix-entry v1.0 | `g02_fix_plan` (gate) |
| G-03 | Judge cards | Quality gate | After two card runs | S5c_judge-cards v0.1 | `g03_judge_cards` (gate) |
| G-04 | Fix cards | Quality gate | After judging cards | S6c_fix-cards v0.1 | `g04_fix_cards` (gate) |
| G-05 | Simulated user | Quality gate | End of each round, before the owner reads | S7_simulated-user v0.1 | `g05_simulated_user` (gate) |
| R-01 | Goal split | Runtime | Goal dialogue, after the user types a goal and minutes | plan_split v2 | `plan_split` (runtime) |
| R-02 | Step cards | Runtime | Focus page, per step | step_cards v2 (the seed adds "v4 proposed", not shown: AI-PROPOSED-SEED-TEXT) | `step_cards` (runtime) |
| R-03 | Pause message | Runtime | When the user pauses (two calls) | stuck_story v3 + pause_predicament v1 | `stuck_story`, `pause_predicament` (runtime) |
| R-04 | Rest reply | Runtime | Rest chat | rest_reply v1 | `rest_reply` (runtime) |
| R-05 | Return pop-up | Runtime | After Back or a long absence | return_popup v1 | `return_popup` (runtime) |
| R-06 | Closing line | Runtime | Summary at the end of a story | closing_line v1 | `closing_line` (runtime) |
| R-07 | Safety classifier | Runtime | Every free-text message | safety_classifier v1 | `safety_classifier` (runtime) |

R-01 to R-07 are the 7 pages of section 3, in the same order. The seed's version numbers are the owner's; the published version of each Runtime key is read live from `public.prompts` (section (e)) and may differ (for example `rest_reply` is version 2 in `docs/ai/prompts/rest_reply.md`, and `return_popup` version 2 in `docs/ai/prompts/return_popup.md`).

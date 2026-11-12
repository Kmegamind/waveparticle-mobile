# Content model and content format

This document describes the data an engineer needs in order to build the story side of the WaveParticle mobile app: what the entities are, what the real content files look like, how a user's steps map onto a story, which card appears when, where each line comes from, which checks every line must pass, and a proposed relational schema for Supabase.

Every field name, type and example below is taken from the real content files unless it is marked "proposed". Where a file and a decision disagree, `docs/DECISIONS.md` wins and the disagreement is stated.

## 0. How to read this document

Status labels used throughout:

| Label | Meaning |
|---|---|
| Decided | Decided by Yue on 2026-11-04 or 2026-11-05 and recorded in `docs/DECISIONS.md`. Authoritative. |
| Current rule | Written in a current rules document (card stack rules, version 2) and not reversed since. |
| Draft | Proposed in a draft document and not yet confirmed. Do not build it as if it were settled. |
| Missing | Needed by the app but not yet written anywhere. |

Words used with a fixed meaning:

| Term | Meaning |
|---|---|
| Companion | The historical character the user works alongside (Oppenheimer and Heisenberg have data today). The interface word is "Companion". |
| Goal | The user's own goal, typed in the goal dialogue. |
| Step | One part of the user's plan, with a title, a short description and a number of minutes. |
| Story | One episode of a companion's life, for example "The Canyon and the Mesa". The database calls it a story; the map calls it a chapter. |
| Slice | One small unit of a story, holding one to three facts. Slices exist only for the two stories with authored cards and are used only for the fallback (section 3.1). |
| Entry state | What the companion knows and is living through just before a given slice. Used by the authored fallback cards, which may only rely on the entry state of the slice the step starts in. |
| Fate link | The rule that the story moves forward only when the user taps Done. A step's cards may move within the step's own stretch of the story but never into the next step's (section 3). |
| Background card | The card told in the character's own voice that opens the first step of a goal (2.13). |
| Return pop-up | The modal in which the character says what he did while the user was away, with one start button (2.9). |
| Foreground minutes | Minutes the app has been on screen. The clock is frozen while the user is away unless the setting "Keep the clock running when I leave" is on (Decided, F2). |

Content files used as the real data (all in the planning folder under `1_Projects/Newfeatures/NF3_content/` unless stated): `site_search_cards_2026-10-29.json`, `trinity_chains_2026-10-29.json`, `trinity_leakmap_2026-10-29.json`, `dialogue_pools_2026-10-29.json`, `story_openers_2026-10-29.json`, `snag_sample_trinity_s4_2026-11-04.json`, `nf5_records_2026-10-29.json`, plus the story database under `2_Areas/Product/oppenheimer-stories/en/database/` (index, `entries/*.plan.json`, `personas.json`). The repository import is `src/content/oppenheimer/stories.json`, exposed through `src/content/oppenheimer/index.ts`.

The repository import contains the 26 story goals, ordered facts, forbidden terms, and provenance. Key slices are represented by task-level cut points: content-owner `added_later` markers are preferred, and the first two task cut points are used when a story has fewer than two markers. Each imported key slice is marked `confirmed` and records the fact ids it covers. Its `keyLine` is one first-person past-tense sentence of at most 18 words. This selection is data, not a limit on the number of user Steps. Pressing Start calls `startStory` in `src/lib/story/start.ts`, which gives the whole story to the card writer with the instruction that it is divided into the plan's steps and that the key slices are facts the writer must use. That function does not call a model.

No person has read any of the authored lines for voice. They were written from the story database entries and passed by script only.

## 1. How the pieces fit

```
Companion ──< Story ──< Story fact (key moments marked)   (content, read-only for users)
                │
                ├──< Slice ──< Card      (authored fallback, two stories only)
                ├──< Snag                (rest-page content, grouped by Scene)
                └── Scene                (rules that keep cards consistent)

User ──< Goal ──< Step                   (the user's plan; user text; step has title and description)
            │
            └──< Session ──┬── Background card
                           └──< Session step ──┬──< Pause          (his message; pause number goes to the prompt)
                                               ├──< Return event   (return pop-up)
                                               └──< Cards seen     (n story cards, 1 to 5)
```

A Session binds one Goal to one Story of one Companion. The AI shares the Story out among the Goal's N steps (section 3) and writes each step's cards live from the story facts. The step opens with one card and the rest appear at the pacing of section 5. When the user taps Done, the next step opens on the same page with its one card. The authored cards (slices, snags) are the fallback for two stories.

Authored card ids are stable and never reused, for example `site-search.s3.c2` or `trinity.s4.ch2.wry`. Generated cards get a row in `cards_seen` when shown. A card that has been shown is never edited or regenerated (it may be reread).

## 2. Entities

### 2.1 Companion

The character who "lives" the story. The data is split over `personas.json` and `dialogue_pools_2026-10-29.json`.

| Field | Type | Example (real data) |
|---|---|---|
| id | text | `oppenheimer`, `heisenberg` |
| voice | text | "He talks short and direct: plain spoken sentences, contractions, a dry one-line joke, sometimes a sharp edge of arrogance. He is never loud." (`personas.json`, Oppenheimer) |
| periods | list of {until, text} | `{"until": "1927-12-31", "text": "A young physicist, {age}, brilliant, lonely and badly unhappy, ..."}`. Six periods; the last `until` is `2100-01-01`. `{age}` is filled in at runtime. |
| dialogue lines | map from slot to list of text | `GD0: ["You found me on a mesa held together by cigarettes and arithmetic. What are you working on?", ...]` |
| default opener | list of text | The character-level `GD0` list; used when a story has no opener of its own. |
| his (Heisenberg only) | list of {id, current_text, done_text} | `{"id": "h1", "current_text": "I'm building the bell.", "done_text": "I built the bell."}` (four segments h1 to h4) |

The dialogue slots (goal-setting conversation) and their limits come from the `_meta.slots` block of `dialogue_pools_2026-10-29.json`:

| Slot | What it is | Limit |
|---|---|---|
| GD0 | Opening line plus the one question | 2 sentences, 30 words |
| GD0R | Returning user: one question | 1 sentence, 12 words |
| GD1S, GD1B, GD1V | Reaction to a specific, too big, or vague goal | 1 sentence, 24, 24, 14 words, no question |
| GD2 | How long can you give it | 14 words |
| GD2R_short, GD2R_mid, GD2R_long | Reaction to the time chosen | 20 words |
| GD2S (proposed, no line written) | He asks whether to split the goal into finer steps | 14 words |
| GD2N | He sets thirty minutes | 18 words |
| GD4P | He offers the plan | 2 sentences, 24 words |
| GD4C | His own half-sentence after the plan | 2 sentences, 24 words |

`turns` in the same file lists which slots may follow each other (for example `["GD1S", "GD2"]`, `["GD2S", "GD4P"]`). The decided order of questions is: the user's goal, the time available, then whether to split the goal into finer steps (Decided, T2); the pool file predates this and has no slot for the third question. The reaction slots GD1S, GD1B and GD1V react to the size of a goal; no kind of goal is refused or redirected (Decided, D1a).

Note: `PROD_story-database-runtime-design` gives the opener limit as 36 words, the pool file as 30. The pool file is used here because it is the one the checks were run against.

Only two companions have data in these files. The older Flask product has eight characters; their data is not in the content files read for this document. The language is English only; there is no language setting (Decided, L1).

### 2.2 Story

One episode. The story database holds 26 Oppenheimer stories (`entries/<id>.plan.json`). The runtime layer adds the fields marked "runtime".

| Field | Type | Example |
|---|---|---|
| id | text | `site-search` |
| seq | integer, 1 to 26 | `8`. Chapter number; time order. All 26 stories are playable and shown on the Life Path, in order, with chapters ahead of the current one visible and not tappable (Decided, D4); a new user starts at chapter 1 (Decided, M1). Chapter 1 is `bohr-difficulties` ("The Trade of a Theorist"), chapter 8 is `site-search`, chapter 13 is `trinity` ("The Storm Before the Shot"). From `story_openers_2026-10-29.json`. The numbering in the database index table is a different order and must not be used as the chapter number. |
| title | text | "The Canyon and the Mesa" |
| era | text | `era3` |
| date | text | `1942-11-16`. Several dates are placeholders (see the database index, section "Left for Yue by the fixers"). Never shown inside his lines. |
| place | text | "Jemez Springs and the Pajarito Plateau, northwest of Santa Fe, New Mexico" |
| context | text | Background paragraph; backend only. |
| hook | text | Third-person summary; no longer shown to users. |
| feel_tags | list of text | `["high desert", ...]` |
| probe_words | list of text | `["Groves approved", "Project Y", "Manhattan Project", "Hiroshima", ...]`. Words that must never appear in his lines. In the card files the same list is called `forbid_terms`. |
| notebook.goal | text | Backend goal sentence. |
| detail.goal | {why, stakes, obstacle, if_then} | Backend only. |
| detail.tasks | list | The database's own cut of the story into 3 to 5 tasks of the character (here 4; an internal field name), each with `id`, `done_when`, `added_later`, `steps`, `obstacle`, `if_then`, `knowledge` (background facts, about 20 per story), `happened` (facts from the book, 11 for this story), `anchors`, `tone`. Source material for live generation: the `happened` facts, in order, become the story facts the AI distributes across the user's steps (section 3). It no longer decides the number of steps. |
| story goal (short, full) | text, text | `short`: "I want the laboratory built where my people can live and work." `full`: "I want to choose well, and I do not yet have the power to choose, so I have to see it clearly and say it simply." Shown as "My goal" on the companion's card. Not the same thing as the user's Goal. |
| who_i_am | text | "I'm a physicist from Berkeley, asked to run a laboratory the Army has not yet found a home for." (key `where_now.who`) |
| slice count (runtime) | integer | `8` for `site-search`, `7` for `trinity`; none for the other stories. Equals the number of authored slices. It is not a limit on the number of steps (Decided, T2). Earlier called capacity. |
| allowed_cut_points (runtime) | list of text | `["after s1", ..., "after s7"]`. Fallback only. |
| key moments | list of {fact ids, key_line} | 2 to 4 per story, confirmed by the content owner (Decided, C2). Imported as `keySlices`. Given to the AI as must-use facts. `keyLine`: one first-person past-tense sentence of at most 18 words. |
| forbid_terms (runtime) | list of text | Ending words of the whole story; checked on every generated card. Trinity: `["Hiroshima", "Nagasaki", "Little Boy", "Fat Man", "Truman", "Potsdam", "Enola Gay", "destroyer of worlds", "White Sands", "Cold War", "hearing"]` |
| dialogue_open (runtime) | list of text | Opening line of the goal conversation in this story's starting situation: "I have given up the bench and I am betting everything on a calculation. What are you working on?" (chapter 1). Rules: at most 2 sentences and 30 words, exactly one question and it is the last sentence, first person, nothing that happens after the story starts, no time-of-day words, no "we". |
| step_lines (runtime) | map slice id to {current, done, plan} | See 2.3. |
| status | text | `"draft mock; every line is authored ... nobody has read them for voice"` |

Today only Trinity has three openers; the other 25 Oppenheimer stories have one each. Heisenberg has four scene openers (`h.device_bench`, `h.hector_room`, `h.dea_bait`, `h.bell_wait`) instead of stories.

### 2.3 Slice

For the two stories with authored cards, the story is cut into slices. A slice holds one to three facts from the book. Facts are backend-only and may contain clock times or outcomes; they are never shown. Slices are used only for the authored fallback (section 3.1); live generation works from the story facts (2.2).

| Field | Type | Example (`site-search`, slice s4) |
|---|---|---|
| id | text | `s4` |
| priority | integer 1 to 3 | `2`. For the authored fallback: when a step covers several slices, the landing card of the highest-priority slice is used; on a tie the last one wins. |
| facts | list of text | `["We were still arguing when General Groves showed up.", "Groves took one look at Jemez Springs and said, \"This will never do.\""]` |
| landing_card | card id | `site-search.s4.land` |
| where_now | text | "I'm in the canyon, arguing the case against it to an officer who has made up his mind." (the entry state of s4, in his voice, only what has already happened) |
| current, done, plan | text, text, text | `current`: "I'm waiting on Dudley's answer." `done`: "I heard the general's verdict." `plan`: "I want to hear who has the last word." At most 10 words each, first person. `plan` states an intention only and presupposes no fact. |
| key (draft) | boolean | Missing from the JSON. See section 4. For other stories the key moments are marked on the story facts (2.2). |
| key_line (draft) | text | Missing from the JSON. At most 18 words, first person, past tense, no future. |
| bridge (draft) | text | Missing. Optional, at most 10 words, joins cause and effect when a slice is merged away. |

Real slice priorities for `site-search`: s1 1, s2 2, s3 2, s4 2, s5 1, s6 3, s7 1, s8 3. For `trinity`: s1 1, s2 1, s3 1, s4 2, s5 2, s6 3, s7 2.

### 2.4 Card

A card is one first-person text the companion shows while the user works. Cards are written live by the AI from the story facts (Decided, T3, D4); the live shape is Shape C. The two authored shapes below exist for two stories and are the fallback.

Shape A, `site-search` (older mock, 41 cards):

| Field | Type | Example |
|---|---|---|
| id | text | `site-search.s1.c2` (entry cards `cN`, landing cards `sN.land`) |
| segment | text | `s1` |
| role | `opening`, `landing`, `why`, `worry`, `now` | `why` |
| type | `what`, `why`, `worry`, `now` | `why` |
| text | text | "I know the canyon from my horseback trips, and I have always remembered it as lovely. That is the trouble, because a memory of a place is not a plan for a town." |
| origin | `authored` | all 41 are authored |
| kind | `authored-from-facts` or `invented` | the 16 `now` cards are `invented` (small scenes such as lighting a cigarette) |
| entry_of | slice id | on entry cards: the slice whose entry state the card belongs to |
| completes, shown_first_at_entry_of | slice id | on landing cards: the slice the card completes, and the slice at whose entry it first appears |
| fidelity | `database` or `single-account` | on landing cards; the line "This is the place" in s8 is `single-account` (the book says "by one account"). Not shown to users. |

Counts: 8 landing cards, 8 `why`, 8 `worry`, 16 `now`, 1 `opening`.

Shape B, `trinity` chains (current rule set, 135 cards: 105 chain cards and 30 return cards):

| Field | Type | Example |
|---|---|---|
| id | text | `trinity.s2.ch1.evm` |
| type | code | one of the codes below |
| text | text | "Fermi told me he favors a postponement, because the wind could drench the camp with radioactive rain. That makes his warning the first thing I have to weigh." |
| entry_state | text | `s2` (the card belongs to the state before slice s2) |
| checker_segment | integer | `1` (entry state number minus one; used by the leak check) |
| chain | integer 1 to 3 | which of three alternative chains for this entry state |
| origin | `authored` | |
| pause_item, depth | text, text | on return cards only: `s1.p1`, `T0-T1` or `T2-T3` |

Card types of shape B, in the order they appear in a chain. The 105 chain cards also include 21 cards of an older role that announced the end of the time; the live design has no such role and they may serve only as fallback text for the n-th card (the card that arrives at 00:00):

| Code | Role | Counts today |
|---|---|---|
| SIT | The situation. In the fallback, the first story card of step 1 only. | 3 (one per chain of entry state s1) |
| EVM | What just happened and why it matters: first sentence a fact in the past tense (the landing line of the slice just completed, compressed), second sentence the consequence. First card of steps 2 to N. | 18 |
| WRY | What he worries about; follows from the EVM card. | 21 |
| DOI | What he is doing because of that; actions only, no results. | 21 |
| NTC | A small thing he notices; texture only, no new fact, no new person. | 21 |
| RET | Retired as a card. The return after rest is now the return pop-up (2.9). The 30 existing cards may serve as fallback texts for it. | 30 (15 pause items times two depths) |

Grouping records in the same file:

- `ROW`: `{"id": "row.s1.ch1", "type": "ROW", "cards": ["trinity.s1.ch1.sit", "trinity.s1.ch1.wry", "trinity.s1.ch1.doi", "trinity.s1.ch1.ntc"], "first_step": true}`. One row is one chain for one entry state: 21 rows.
- `RUN`: `{"id": "run.ch1", "type": "RUN", "rows": ["row.s1.ch1", ..., "row.s7.ch1"]}`. Three runs, one per chain number, each walking seven entry states. Used by the checks that compare neighbouring steps.

Randomness in the authored fallback comes from choosing which chain to use for an entry state (seeded by the session), not from drawing single sentences. This is a Current rule.

Shape C, live card (proposed; stored in `cards_seen`):

| Field | Type | Notes |
|---|---|---|
| position | integer | Order in the step's stack, 1 to n (the background card is not in it, 2.13). |
| text | text | First person. Passes the checks of section 7. Never edited after it is shown. |
| source | `generated`, `authored`, `generic` | `authored` is an authored fallback card (Shape A or B); `generic` is a generic fallback line (Decided, D5). |
| facts used | list of fact ids | Which story facts the card draws on; used by the leak check. |
| due time | integer | Foreground seconds at which it is revealed (2.14). |

Every card must make sense on its own, so a user can look back at it (Decided, D2). Tone by moment and "three small turns of feeling per step" are rules inside the AI prompts, not product requirements.

### 2.5 Step

There are two things called a step. Do not confuse them.

User step (user content, stored on the server and tied to the account; Decided, S3). It is produced by the planning prompt (the AI "planning expert"). The real planning prompt is still to be supplied (open, P1); the format below is the placeholder format of `docs/ai/AI_01`, extended with the description (Decided, D1c):

```json
{"title": "<the goal in at most 40 characters>",
 "steps": [{"title": "English reading", "description": "Do the reading questions; pay attention to ...", "minutes": 15}]}
```

| Field | Rule |
|---|---|
| title | Short, non-empty, at most 80 characters. |
| description | One or two sentences that expand the title: what to do and what to watch for (Decided, D1c). Generated with the plan, shown on the focus page, read only there. Proposed limit: at most about 40 words. |
| minutes | A positive whole number. At creation the minutes add up to the time the user gave (D1d), so there is no "plan is longer than your time" message. |

The user may edit everything: each step's time, the number of steps, the titles and the descriptions. If the edits change the total, the goal's time follows the edits (Decided, D1d). There is no maximum number of steps (Decided, T2). How a plan is split for different kinds of goals is the planning prompt's job, not a rule of this document (Decided, D1b).

Rules checked in code: the JSON parses; at least one step; titles non-empty; minutes are positive whole numbers; at creation the minutes add up to the total. The older split specification also checks that minutes are multiples of 15 between 15 and 120 and caps the step count at the story's capacity; those were placeholder rules of that specification and are not decisions (the capacity cap is superseded by T2).

Story step: the AI's allocation of the story to one user step (Decided, T1, T3). The AI receives the whole story as facts, the key moments as must-use facts, the number of steps x and their minutes, and the instruction: the story is divided into x steps; according to the story's progress, split each step sensibly into n story cards. The character's goal mirrors the user's: if the user has x steps of y minutes each, the character also has x steps of y minutes each. Proposed record (not an existing file):

```json
{"step": 2, "minutes": 30, "n": 3, "interval_min": 10,
 "portion": {"from_fact": 9, "to_fact": 15},
 "key_moments": ["f12"],
 "cards": [{"position": 1, "due_min": 10}, {"position": 2, "due_min": 20}, {"position": 3, "due_min": 30}]}
```

The fact cut and the must-use key slices come from `startStory` (`src/lib/story/start.ts`) when the user presses Start. It does not choose n and it does not call a model. The pacing fields are defined in 2.14. For the two stories with authored cards, `site_search_cards_2026-10-29.json` also lists one precomputed step per slice (8 steps), each with `cards`, `current`, `done`, `plan` and `where_now`. Those are used only as the fallback (section 6). Its `reveal_foreground_min` values are not used: they showed four cards at time zero, which contradicts the decision that a step opens with one card.

### 2.6 Goal (the user's)

| Field | Type | Notes |
|---|---|---|
| text | text | What the user typed in a free text box, at most about 200 characters (limit pending). There is no restriction on what a goal can be and no list of unsupported kinds (Decided, D1a). Stored on our server (Decided, S3). Goes to the model only in the planning prompt and in the shape classification; the story cards do not receive it (Current rule, not revisited by a decision). |
| title | text | At most 40 characters, produced by the planning prompt. |
| shape | `specific`, `vague`, `big`, `unknown` | One-word classification that selects his reaction line (slots GD1S, GD1V, GD1B). It never refuses or redirects a goal. |
| total minutes | integer | The time the user gave; follows the user's edits to the steps (Decided, D1d). |
| split finer | boolean | Proposed: the user's answer to the question asked after the time, whether to split the goal into finer steps. Passed to the planning prompt. |
| status | text | planned, in progress, on hold, done. A one-time goal moves to done automatically when its last step is finished (Decided, G4). One goal has at most one session in progress (goal management rule). |

### 2.7 Session

One run of one Goal against one Story. The planning documents call this a "run" (`story_run` in the runtime design). It starts when the user confirms the plan and ends at the summary. An account is required from the first open (Decided, ACC), so every session belongs to a user.

| Field | Notes |
|---|---|
| user, goal, companion, story | The story is fixed when the session is created. Any of the 26 stories can be chosen (Decided, D4), and a new user starts at chapter 1 (Decided, M1). |
| step count | N, fixed for the session once it starts. No maximum. |
| state | `open`, `on_hold`, `completed`, `restarted`. "Start over" restarts the character's night from the beginning of the story with the same steps; the old session is kept and marked restarted (Decided, T5). There is no early-ending or abandoned state, and no state caused by time away: there is no time limit on resuming (Decided, T6). |
| seed | Makes non-repeating picks reproducible (authored fallback choice, snag choice). |
| last active time | The clock freezes when the app leaves the screen, unless the keep-running setting is on (Decided, F2). |
| background card | The background card text and its source (2.13). One per session. |
| merged key moments | Key moments that did not get their own step (section 4). The summary lists each with its key line (Decided, C2). |
| closing line | The end-of-story line (model-written, with an authored fallback; see section 6). |
| log | Which step is done (a step on which Done was pressed and not undone), and for each step which pauses and return events happened. The goal text is not repeated in the log. |

A Session is also the unit of the session record (2.15).

### 2.8 Pause

Pause is the only way into the rest page. Decided (F1, refined 2026-11-05): there is no limit on pauses and no timer reset. Pausing never adds a screen, a pop-up or a penalty. Every Pause opens the same conversation: the character first sends a message about the snag his own task has hit and how he feels about it (a Pause means his side of the story has stalled). The message is generated live. The earlier ideas of a quiet line and of one comment after many pauses are replaced by this.

| Field | Notes |
|---|---|
| number within the step | Counted per step; never shown to the user. Passed to the prompt as the pause number. |
| start and end time | |
| his message | Generated live from a snag (2.10) and checked, with an authored fallback (section 6). |
| source of that text | generated or authored |
| rejected rules | Rule ids of any failed attempt; never raw user text. |

What the pause number changes (prompt only, Decided, F1):

| Pause number in one step | His message |
|---|---|
| 1 and 2 | The snag his own task has hit and how he feels about it. |
| 3 | The prompt changes: he says more strongly that he cannot finish his task and asks the user not to pause again. |
| 4 and later | The same strong tone continues, in new words each time. Nothing else happens. |

No new screen, no warning page. The return after a pause is a return pop-up (2.9), not a line of this entity.

### 2.9 Return pop-up

A modal in which the character says what he did while the user was away and how he felt, with one start button. When the user taps it, the original step resumes and the clock starts (Decided, T6). There is no time limit on resuming: however long the user was away, the step can be resumed. The 24-hour rule, "Start from step 1", the "not completed" History entry for lapsed goals and the Home rule that keeps an unfinished goal for 24 hours are all removed.

When it appears (Decided, R1):

1. After the user taps Back to step on the rest page.
2. When the user returns to the app after being away for 5 minutes or more.
3. Continue on Home and Continue in Goals follow the same rule: the pop-up appears if the user was away 5 minutes or more (Decided, T9).

A shorter glance at another app resumes the clock with no pop-up. The return line on Home, the return card in the stack (type RET) and the separate "away card" are not needed (Decided, R1). Home shows no "welcome back" (Decided, H7). Not decided: what the pop-up does when the keep-running setting is on and the clock never stopped.

The text is generated live (Decided, T6, A6, H2) and checked. An authored fallback is still required whenever generation fails or is too slow; its size is not decided.

| Field | Meaning |
|---|---|
| trigger | `back_from_rest` or `away_5min`. |
| away seconds | How long the app was away or the rest page was open. Stored; whether the prompt receives it is not decided. |
| text | His message: what he did during that time and how he felt. First person. |
| source | generated or authored. |
| shown at, started at | When the pop-up opened and when the user tapped the start button (the clock restarts at that moment). |

Authored data that can serve as fallback text after review (`snag_sample_trinity_s4_2026-11-04.json` and the Trinity return cards): `ret_line`, `ret_short` and `ret_long`, and the 30 RET cards. They are no longer cards in the stack. Mapping the short and long forms to the two triggers is to be confirmed.

Length: the earlier return card rule (25 to 40 words, at most three sentences, Yue 2026-10-29) is the proposed limit for the pop-up text until a decision says otherwise. Proposed checks, kept from the older list: no blame aimed at the user, no clock time, no hook, no news that moves the story beyond the step's portion. The old rule against "I waited" no longer applies: there is no rule about whether he waits (Decided, H8). Whether he may refer to the length of the absence is not decided; T6 says he says what he did during that time.

### 2.10 Snag

A small obstacle in his own world that his message on the rest page is built from when the user pauses (Decided, C1: the AI first generates a stuck story, then the character describes his predicament and how he feels). It must not be an event.

| Field | Type | Example (`s4.p1`) |
|---|---|---|
| id | text | `s4.p1` |
| family | text | `weather-on-body`. Other families in the sample: hardware, light, footing, smoke, clothing, wind-and-hat, cold-hands. |
| props | list of text | `["collar", "hat"]`. Every prop must appear in the obstacle text. |
| obstacle | text | "Rain is running off my hat brim into my collar, so I'm turning it up." |
| ret_line, ret_short, ret_long | text | Authored return texts; see 2.9 for their use as fallback. |
| origin | `authored` | |
| kind | `invented` | All snags are invented small actions, not facts from the book. |
| valid_from (draft) | slice id | First entry state in which the snag's words are allowed (a bunker door needs the bunker to exist). |

The sample holds 8 snags for Trinity entry state s4. The same file holds 4 quiet lines; they are not used, because the quiet line was replaced by the pause-number rule (2.8). Variety rules: no snag repeats inside one step; two snags in a row never share a family; across steps and sessions the oldest used one is reused first (kept in a per-user, per-companion list of used items). With no limit on pauses, these rules must keep working for many pauses in one step.

### 2.11 People (no separate content type)

Decided (M2, refined): there is no person content type, no introduction phrase and no list of people with phrases. The people who are present in a story are named in the scene table (2.12) as `present` and `allowed_names`, and the background card (2.13) introduces them in his own voice. Later cards carry no introduction phrases. Names are not tappable and there is no separate "what you need to know" screen. Every later line (cards, his message on the rest page, the return pop-up, rest chat) may use only names in `allowed_names`.

### 2.12 Scene

A table that keeps cards and snags consistent about where he is, who is there, and what objects exist. Draft (recommended, not confirmed: C5). Real sample (`_meta.scene` in the snag file):

```json
{"state": "s4", "where": "outside the bunker, in the wind and rain",
 "present": ["Groves"], "allowed_names": ["Groves"],
 "props": ["coat", "collar", "hat", "brim", "bunker door", "door", "hands", "pockets", "boots", "mud", "match", "cigarette", "flashlight", "button", "fingers", "ground", "wall"],
 "one_way_scales": {"rain": "steady", "wind": "strong", "sky": "unchanged"}}
```

`one_way_scales` lists things only the story may move (rain, wind, sky). A snag may not move them. The same data is the input the live generator needs (allowed props, allowed names, rules), because the authored pool is no longer the main source (Decided, C1). The content team supplies it for every story.

A scene covers several entry states that share place and props. Trinity needs about three scenes: the mess hall (s1 to s2), on the way and outside the bunker (s3 to s6), and the early morning (s7).


### 2.13 Background card

The card that opens the first step of a goal (Decided, T4, T9). It is not progress, so it is not counted among the n story cards and is not subject to their limits (Decided, T7).

| Field | Notes |
|---|---|
| text | Told in the character's own voice, as storytelling: who is here, where this is, and what each person knows (Decided, D3). It introduces the people who are present; no later card introduces anyone (Decided, M2). Never from a third-party point of view, so that the experience stays immersive. Replaces the earlier proposal of a three-line summary. |
| source | generated live, or the authored fallback (section 6). |
| when | Once, as the one card with which the first step opens; later steps open with the card about what he just finished (2.14, section 3). It is the oldest card in the first step's stack and needs no button to dismiss it (Decided, T9). |
| input | Story facts true at the start: the story's `who_i_am`, the opening `where_now`, the people and the `knowledge` field. Nothing that happens later. |
| checks | The per-line checks of section 7.1 (first person, no clock times, no future facts, leak map). A length limit is Missing; it has to be set by the content owner. |

### 2.14 Card pacing

Decided (T1, T7): each step has between 1 and 5 story cards. The number n is chosen by the AI for each step and is not fixed. The n story cards arrive at y/n, 2y/n, and so on up to y minutes after the step starts, where y is the step's minutes: interval = step minutes / n. The n-th card is due at the step's end time, when the clock reaches 00:00 (Decided, T8). The gap between cards is at least 5 minutes. The AI is told these limits, and the app ignores any extra cards it returns.

| Field | Rule |
|---|---|
| n | Integer from 1 to 5, and at most floor(step minutes / 5). |
| interval | step minutes / n, in minutes; never below 5. |
| due time of card k | k x interval, in foreground minutes, so the n-th card is due at the step's end time. The card with which the step opens (the background card, or the card about what he just finished) is not one of the n (Decided, T9). |
| foreground only | Nothing is added while the app is away or the step is paused (unless the keep-running setting is on; how pacing then works is not specified). |

Examples: a 10-minute step has at most 2 cards, 5 minutes apart; a 25-minute step can have 5 cards, 5 minutes apart; a 60-minute step has at most 5 cards, 12 minutes apart if n is 5. A step of under 10 minutes has one card.

The pause count is not part of pacing. It is passed only to the pause prompt (2.8).

### 2.15 Session record

Decided (G1, G2): History shows the date, the duration and the steps the user marked as done. A step "marked as done" is a step on which the user pressed Done and did not undo it; it is not text the user typed. Each row in History is tappable and opens the session record page from Me, History. The weekly total row is removed.

| Shown | Source |
|---|---|
| date | `sessions.started_at` |
| duration | Proposed: the sum of the foreground seconds of the session's steps. Not decided. |
| goal name | `goals.title` |
| steps marked done | Titles of the session steps whose `done_at` is not null |

The session record is a read model over sessions and session steps; it needs no table of its own.

## 3. How the user's steps share out the story

Let N be the number of steps the user confirmed. There is no maximum (Decided, T2), and few steps are allowed (Decided, C2).

1. **The story as a whole.** The story is treated as a whole. The AI distributes it across the user's N steps; slices do not decide how many steps there are, and the content of each step may vary (Decided, T3). Each step covers a consecutive stretch of the story's facts, in story order. The character has the same number of steps with the same minutes as the user (Decided, T1).
2. **Facts a card may use.** Cards of a step may use the facts of that step's own stretch, in order, so that later cards of the step can move on within it. They never use the facts of later steps, the story's ending words (the forbid list) or the per-fact leak words. This follows from T1 and T3 and is to be confirmed. The leak and forbid checks of section 7 are run on every generated card.
3. **Key moments.** They are inputs the AI must use, and a key moment ends a step when possible (section 4).
4. **Opening card of step k.** Step 1 opens with the background card (2.13) as its one card. Step k (k from 2) opens with exactly one card about what he just finished in the previous step (Decided, T9). There is no screen between steps.
5. **Cards while a step runs.** The step's n story cards arrive at y/n, 2y/n ... y minutes (2.14); the n-th arrives at 00:00.
6. **Last step.** Done on the last step goes straight to the summary. There is no landing screen and no "next" card.
7. **N equals 1.** One step covers the whole story. It has between 1 and 5 cards; the summary and the closing line carry the rest, and the summary lists the key moments.

### 3.1 Choosing the authored fallback card

Authored cards exist only for the two stories `site-search` and `trinity`, and are used only when a live card fails the checks or generation is slow (Decided, T3, D5). The authored sets were cut by slice, so a fallback card is chosen by the slice the step's stretch starts in:

- Step 1: the opening card is the background card (its fallback is in section 6); the story cards start with the first card of the entry state of slice 1.
- Step k (k from 2): the landing card of the highest-priority slice covered by step k-1 (a tie goes to the last slice).
- Later cards of the same step: the next unused card of that entry state, in the order of its chain.
- If every authored card is used, add no card. For the other 24 stories the generic fallback lines are used (section 6).

Worked example, `site-search`, N = 4 (default cut s1 to s2, s3 to s4, s5 to s6, s7 to s8):

| Step | Covers | Fallback opening card | Fallback entry cards come from |
|---|---|---|---|
| 1 | s1, s2 | `site-search.s1.c1` (the opening card) | entry state s1 |
| 2 | s3, s4 | `site-search.s2.land` (s2 has the higher priority) | entry state s3 |
| 3 | s5, s6 | `site-search.s4.land` (s3 and s4 tie at 2, last wins) | entry state s5 |
| 4 | s7, s8 | `site-search.s6.land` (s6 has priority 3) | entry state s7 |
| End | | `site-search.s8.land` | |

The slice boundaries are only a fallback device. They are not a limit on the number of steps.

Open problem (Draft): the Trinity chains were written for the default cut only. When a step covers several slices, the fallback card for the opening has to be the highest-priority one and the following card may not connect to it. For fallback use this is accepted; the content team may widen the chains later.

## 4. Key slices

Decided (C2): each story has two to four key slices (key moments), confirmed by the content owner. A key slice ends a step whenever possible. When there are fewer steps than key slices, the summary lists the merged key moments, one first-person line each. The stronger rule (never offer fewer steps than key slices) was not chosen, and the goal dialogue does not forbid few steps. Key moments are inputs the AI must use when it writes the cards (Decided, T3); the summary lists any that were merged.

Draft rules from the story database workstream that follow from this:

- A slice is key when, after it, the nature of what he has to do changes, not merely when things go further.
- A key slice is always the last slice of its step, so the final card of the step carries the key scene.
- If N is at least the number of key slices, each key slice ends a step and any extra cut points go into the stretch with the most facts. If N is smaller, the latest key slices are merged and the end screen lists every key slice the session covered, each with its `key_line`.
- There are no markers for turning points or scenes on the map rows or on the current card (Decided, M3); key moments appear only in the summary.

The import marks key slices on all 26 stories. The slice ids below are an earlier proposal for the two authored stories, and the table is the worked example the tests use. They are not the task ids stored for `site-search` (`offer_the_mesa`, `show_groves_the_mesa`) or `trinity` (`weigh_the_storm`, `answer_the_reporter`):

| Story | Key slices |
|---|---|
| `site-search` | s4 (Groves says the canyon will never do), s6 (he names the mesa and the boys' school), s8 (Groves says "this is the place") |
| `trinity` | s4 (the time of the shot is fixed), s6 (the light and the roar) |

How the cut falls for `site-search` with the key slices s4, s6, s8:

| N | Steps | Landing shown at the end of each step | End screen lists |
|---|---|---|---|
| 1 | s1 to s8 | none | key lines of s4, s6, s8 |
| 2 | s1 to s4, s5 to s8 | s4 | key lines of s6, s8 |
| 3 | s1 to s4, s5 to s6, s7 to s8 | s4, s6 | key line of s8 |
| 4 | s1 to s2, s3 to s4, s5 to s6, s7 to s8 | s2, s4, s6 | key line of s8 |
| 5 | s1 to s2, s3, s4, s5 to s6, s7 to s8 | s2, s3, s4, s6 | key line of s8 |

For N above 5 there is no limit (Decided, T2): each key slice still ends a step and the extra cut points go where the story has the most facts. The "landing shown" column describes the authored fallback; with live cards the final card of the step carries the key scene.

`startStory` follows that cut. Extra steps are split inside the stretch with the most facts, larger parts first, and a tie goes to the earlier stretch. Facts after the last key slice stay in that step until the plan has a spare step, which then takes those facts so the key slice can end the step before them. When there are fewer steps than key slices, the later key slices merge into the last step and the summary lists each merged key line. When nothing was merged, that list is empty: for N of 3 or more in the table, the summary does not list s8, because that key slice ended its own step (US-MAP-9). One step has no next-step card and goes straight to the summary. The step count is the plan's count and does not depend on the number of slices.

## 5. Which card appears when

Decided (X2, X6): a step opens with exactly one card. More cards appear one at a time while the user works. The user sees one card at a time in a stack: a new card sits on top; swiping the top card to the left moves it aside and shows the card before it; swiping right brings the newer card back; dots show position (they appear as cards appear; no total and no placeholder dots); the two buttons "Earlier card" and "Newer card" do the same without a gesture. A new card does not slide in by itself while someone is reading an older one. The stack resets at each step, and the user cannot swipe back into the previous step.

| Event | What appears | Source |
|---|---|---|
| The goal starts (first step opens) | The background card, told in his voice (2.13), as the one card of the first step. No button is needed to dismiss it. | Decided (T4, T9) |
| A step opens (Start, or Done on the previous step) | Exactly one card: the background card for the first step, the card about what he just finished for later steps. Neither is one of the n story cards. | Decided (X2, T1, T9) |
| Done on a step that is not the last | The next step opens on the same page with its one card. The clock shows the new target, holds for 1.2 seconds, then starts without a tap. Done is greyed out during the hold. No landing screen, no button to begin. | Decided (X3) |
| Done on the last step | No card. The summary opens. | Current rule |
| Foreground time passes | The next story card, at y/n, 2y/n ... y minutes (2.14; at least 5 minutes apart). Nothing is added while paused or away. | Decided (T1, T7, T8) |
| The clock reaches 00:00 | The n-th story card arrives, written to say he is still at it. The only other thing is the light vibration. The clock stays at 00:00 until Done. | Decided (T8) |
| Pause | No card. The rest page shows his message; the pause number goes to the prompt. | Decided (F1) |
| Back to step on the rest page | No card. The return pop-up (2.9) opens; the start button restarts the clock. | Decided (R1, T6) |
| The user returns after 5 minutes or more away, or taps Continue on Home or in Goals after that time | The return pop-up (2.9). Under 5 minutes: nothing, the clock resumes. | Decided (R1, T9) |
| The user leaves the app | The clock freezes and no card is added, unless the keep-running setting is on. What happens to card timing while the clock keeps running is not specified. | Decided (F2) |
| Done is undone (every Done can be undone) | The step is open again; no new card. How cards already shown in the next step are treated is not specified. | Decided (F3) |

Card count of a step: n, from 1 to 5, chosen by the AI, with at least 5 minutes between cards; the background card is extra (2.14).

Authored fallback data: the step records of `site_search_cards_2026-10-29.json` list four cards at time zero. Used as a fallback, none is visible when the step opens beyond the opening card, and the cards are released one at a time at the due times of 2.14.

## 6. Where each content type comes from, and its fallback

"Authored" means written by a person in advance and picked by code. "Model-written" means generated at runtime by a language model, then passed through the same checks as authored lines. A model-written line is never shown unchecked. The general ladder is: parse, clean, check the rules, retry once, then use the fallback. All 26 stories are playable because the cards are written live (Decided, D4). Authored cards exist for two stories only; the other 24 have a few generic fallback lines in the character's voice (Decided, D5).

| Content type | Source | Fallback if generation fails or is too slow |
|---|---|---|
| Goal conversation lines (GD0 to GD4C) | Authored pools; the model only classifies the goal's shape and splits the plan. The order is goal, time, then whether to split finer (Decided, T2). | The older fixed lines (welcome, confirm goal, generating, plan ready) |
| Plan: step titles, descriptions and minutes | Model-written by the planning prompt (placeholder until the real prompt is supplied, P1) | Retry once, then an honest failure screen with the text kept; a one-step plan built in code. No silent generic steps. |
| Story cards (the n cards of a step) | Model-written live from the story's facts and the key moments (must-use facts). Every card passes the same checks as authored cards (Decided, T3). | Authored cards for `site-search` and `trinity` (section 3.1); for the other 24 stories a few generic fallback lines (D5). If those are used up, add no card. Never an error text. |
| Background card | Model-written live, told in the character's voice (Decided, D3, T4) | The story's `who_i_am` line, then a generic opening line (to write) |
| His message on the rest page (snag) | Model-written live (Decided, C1, F1) from allowed props, names and rules supplied by the story data; receives the pause number | The authored snag pool for the entry state (Trinity s4 sample only). Missing: fallback wording for the third pause and later. Open: how many fallback lines are enough, who writes the generator's checks. |
| Return pop-up text | Model-written live (Decided, T6, R1, A6, H2) | Authored `ret_line`, `ret_short`, `ret_long` for the snag; otherwise a small authored set (size not decided) |
| Rest chat reply | Model-written, no message limit (Decided, R2). Decided (A3): he answers in the character's world and voice, may answer questions, does not have to refuse, keeps it short and returns to his own situation. Open: what he does with questions about things he could not know in his time. | Authored chat fallback lines; not yet written |
| End-of-story feeling line | Model-written, 1 to 3 sentences, from what happened and how it went (Decided, A7) | Authored closing fallback by mode: smooth (2) and rough (2). Trinity has them; `site-search` has none (drafts exist in the AI specification); the other 24 stories need generic ones. |
| Key lines (the merged key moments on the summary) | Authored from the story database, one first-person line each (Decided, C2) | None |
| Story goal, where-now | Authored from the story database for `site-search`; for other stories the generator builds them from the story facts and the same checks apply | None |
| Safety response | Code plus a small classifier; two tiers in the first demo: crisis (real hotlines by region) and ordinary stress. Low mood is deferred (Decided, A5b). The crisis page is system voice, not his. | Keyword layer alone if the classifier fails; the user can always go back to the step |

Disclosure that the companion is an AI appears only in the terms and the settings; the conversation never mentions it (Decided, A4). If a legal check shows some regions need a clear answer to a direct question, the fallback is one sentence in system voice.

## 7. Checks every line must pass

These apply to every line the companion shows, whether authored or model-written, unless a row says otherwise. Rule ids are the ones used in the check script of the card stack rules.

### 7.1 Per line (failure means the line is not shown or not accepted)

| Check | Rule |
|---|---|
| First person | The text contains "I", "my" or "me" (rule K01). Capital "I" only; "my", "me" and "mine" are case-insensitive. Fragments without a subject fail. |
| No clock times | No clock times, dates, years or durations (R02, R03). In the goal opener also no time-of-day words. Facts in the backend may contain them; lines may not. |
| No future facts | "will", "going to" and "'ll" are allowed only inside his own worry or someone else's stated prediction, marked by words such as "says", "thinks", "warned", "forecast", "can't tell", "don't know", "whether", "if", "neither/nor" (K02). "The sky will clear at dawn." fails. "Neither Fermi nor Hubbard can tell me what the sky will do." passes. |
| Leak map | A card may not use words that belong to facts of later steps (K04 for ending words; the leak map for per-fact or per-slice words, rule RW8). For the authored fallback, a card at entry state k may not use words that belong to slice k or later. Also no word from the story's forbid list. |
| Length | See the limits table below. |
| No question | No question marks (R01), except the one question in the goal opener and the goal conversation, and at most one question in a rest chat reply (`docs/ai/AI_04_rest-chat.md` section B). |
| Not addressed to the user | No "you" (R04), except in the goal conversation and the rest chat reply, which answers the user (`docs/ai/AI_06_check-and-fallback.md` section 4). |
| No hooks | None of: more, later, tomorrow, soon, continue, find out, next (R06; "next to" is allowed). |
| No praise, no talk about absence, no source notes, no behind-the-scenes words | R07 to R10. The return pop-up is exempt from the absence rule, because he says what he did during the time away (Decided, T6). |
| Form | No dashes, no exclamation marks or emoji, no links, ends with a full stop, never names himself (R11 to R15). |
| Warnings only | "we" and "us" (R05 is a warning for cards because he talks about himself and the people around him), words about other people's pronouns (R20), time-of-day words (R22). These are waived card by card in the current data. |

### 7.2 Length limits

| Line | Limit |
|---|---|
| Live story card; SIT, EVM, WRY, DOI, NTC | 2 to 4 sentences, at most 60 words (one sentence gives a warning) |
| Return pop-up text | Proposed from the earlier return card rule: at most 3 sentences, 25 to 40 words (fewer than 25 gives a warning) |
| Background card | Not set (Missing, 2.13) |
| His message on the rest page (obstacle) and `ret_line` | At most 2 sentences, 25 words |
| Single status line (older design, still in the Trinity pool) | 1 sentence, 14 words |
| Opening of the goal conversation | 2 sentences, 30 words, one question and it comes last |
| Step lines `current`, `done`, `plan` | At most 10 words, first person |
| `key_line` | At most 18 words |
| `bridge` | At most 10 words |
| End-of-story feeling line | 1 to 3 sentences, first person, no "you", no numbers or durations |
| Rest chat reply | 1 to 3 sentences (deflections: 1 to 2) |

The AI specification adds a stricter limit for model-written snags (at most 20 words and 2 sentences) and a limit of 14 words for the resolved line, which conflicts with the return text above; see `docs/ai/DIFFERENCES.md`. When two limits apply, use the stricter one, except where a decision settles it.

### 7.3 Per row and per run (cards of one step, and neighbouring steps)

| Check | Rule |
|---|---|
| Start and size (RW1) | A step opens with exactly one card and has between 1 and 5 story cards; the app drops any extra cards the AI returns (Decided, T7). The opening card is not counted, and the n-th card is due at 00:00 (T8). For the authored fallback: the story cards of step 1 start with SIT, and those of steps 2 to N start with EVM. |
| Order (RW2) | Authored fallback only: WRY, then DOI, then NTC. Live cards follow the story's order within the step's stretch. |
| Connected (RW3) | Each card connects to the one before: shares a content word or uses so, because, but, which. |
| No forward reference (RW4) | A card never depends on a later card, so any prefix of the row is complete. |
| No repetition (RW6) | No two cards of a row overlap by half their words or repeat a sentence. |
| Consistency (RW7, RN1) | Optional state tags (for example `{"rain": 3}`) change in one direction only along a row and a run. |
| No spoilers by slice (RW8) | A card of slice s may not contain terms of later slices. |
| No echo between steps (RN2, RN3) | The same sentence never appears in two rows; the first card of the next row continues rather than repeats the last card of the previous row. |
| Self-contained | No "again", "another", "as I said", "the same" pointing at another card, because a card may be reread on its own. |

### 7.4 Snag and return pop-up rules

- Use only the props listed for the scene, and every declared prop must appear in the obstacle text.
- No new named person; only names in `allowed_names`.
- No move on a one-way scale (rain, wind, sky). Words like cleared, eased, died down, worse, better are blocked.
- No event verbs (arrives, comes, says, tells, asks, decides, finds, loses, breaks and similar) and no new objects.
- The resolution restores the situation as it was.
- No fact of slice k or later; no forbid term.
- No repetition inside one step; two snags in a row never share a family. Pauses are unlimited, so this must hold for many pauses.
- The return pop-up has no blame aimed at the user, no clock time, no hook and no news that moves the story beyond the step's portion. There is no rule about whether he waits (Decided, H8).
- From the third pause the message says more strongly that he cannot finish his task and asks the user not to pause again (Decided, F1). That message addresses the user, so the no-"you" check and the no-imperative check need an exception for it; this is not yet decided.

### 7.5 Checks by hand

The script cannot judge cause and effect or voice. Each row needs a person to: read it forwards ("is each card the consequence of the one before?"), read it backwards, cut it after every card and see whether any card refers to something later, give it to a stranger and ask what happened and why he worries, and compare it with the previous row for echo. No row has had this reading yet.

### 7.6 Current check results

The Trinity chain pool (135 cards, 21 rows, 3 runs) passes the script with no failures and no warnings. The `site-search` cards (41) pass the failure rules using temporarily widened length limits. The Trinity snag sample (8 snags) passes with no failures. The card stack version 3 proposals are not adopted; pacing is decided in section 5. Live cards have not been run through the script yet.

## 8. Proposed relational schema for Supabase

This is a proposal, not a decision. It follows the entities above. Content tables are filled from the JSON files and the story database and are read-only for users. User tables hold the user's own text and are tied to the account (Decided, S3). An account is required from the first open (Decided, ACC), so there is no anonymous use: every user table carries `user_id` and uses row-level security so that a signed-in user can read and write only their own rows. Deleting the account deletes these rows (a privacy notice and account deletion are required). Types are Postgres types.

### 8.1 Content tables (seeded from the JSON files and the story database)

```
companions(
  id text primary key,                 -- 'oppenheimer'
  name text not null,
  voice text,
  periods jsonb                        -- [{until, text}]
)

stories(
  id text primary key,                 -- 'site-search'
  companion_id text references companions,
  seq integer not null,                -- chapter number, 1 to 26
  title text not null,
  era text, story_date text, place text, context text,
  goal_short text, goal_full text, who_i_am text,
  slice_count integer,                 -- authored slices; null when none. Fallback only, not a limit on steps
  forbid_terms text[] not null default '{}',
  status text,                         -- review status text
  unique (companion_id, seq)
)

story_facts(                           -- input for live generation, in story order
  story_id text references stories,
  seq integer,                         -- order inside the story
  text text not null,                  -- backend only; may contain clock times or outcomes
  source_task text,                    -- database task id, internal name
  key boolean not null default false,  -- key moment (2 to 4 per story)
  key_line text,                       -- first person, at most 18 words; used on the summary
  primary key (story_id, seq)
)

slices(                                -- authored fallback only
  story_id text references stories,
  id text,                             -- 's4'
  position integer not null,
  priority smallint not null check (priority between 1 and 3),
  facts text[] not null,               -- backend only
  where_now text,
  step_current text, step_done text, step_plan text,
  primary key (story_id, id)
)

leak_terms(story_id text, fact_seq integer, term text)     -- from the leak map; per fact, or per slice for authored stories

scenes(
  story_id text, id text,
  entry_slices text[],                 -- entry states this scene covers
  where_text text, present text[], allowed_names text[], props text[],
  one_way_scales jsonb,
  primary key (story_id, id)
)

cards(                                 -- authored fallback cards
  id text primary key,                 -- 'trinity.s2.ch1.evm'
  story_id text references stories,
  entry_slice text,                    -- slice whose entry state the card belongs to
  completes_slice text,                -- for landing cards
  type text not null,                  -- SIT, EVM, WRY, DOI, NTC, or what/why/worry/now
  role text,                           -- opening, landing, why, worry, now
  chain smallint,                      -- 1 to 3 for chain cards
  position smallint,                   -- order inside the entry state
  text text not null,
  origin text not null check (origin in ('authored')),
  kind text,                           -- authored-from-facts, invented
  fidelity text                        -- database, single-account
)

generic_fallback_lines(                -- D5: a few lines per story without authored cards
  id text primary key,
  story_id text,                       -- null for companion level
  companion_id text references companions,
  use text not null check (use in ('card','background','pause','return','closing')),
  text text not null
)

snags(
  id text primary key, story_id text, scene_id text,
  family text, props text[], valid_from_slice text,
  obstacle text, ret_line text, ret_short text, ret_long text,   -- ret_* serve as fallback for the return pop-up
  origin text, kind text
)

dialogue_lines(
  id text primary key,
  companion_id text references companions,
  story_id text,                       -- null for character-level lines
  scene_id text,                       -- Heisenberg scene openers
  slot text not null,                  -- GD0, GD1S, ..., GD4C; GD2S proposed
  variant text,                        -- short, mid, long
  text text not null
)

closing_fallbacks(id text primary key, story_id text, mode text check (mode in ('smooth','rough')), text text)
return_popup_fallbacks(id text primary key, story_id text, entry_slice text, trigger text check (trigger in ('back_from_rest','away_5min')), text text)
```

### 8.2 User tables

```
profiles(
  user_id uuid primary key references auth.users,   -- account required (ACC)
  nickname text,
  keep_clock_running boolean not null default false,   -- decided setting (F2), under Me, Signals
  created_at timestamptz default now()
)

goals(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users,
  companion_id text references companions,
  title text, text text not null,                    -- free text, no restriction on kinds (D1a)
  shape text check (shape in ('specific','vague','big','unknown')),
  split_finer boolean,                               -- answer to the finer-split question (proposed)
  total_minutes integer,                             -- follows the user's edits to the steps (D1d)
  status text not null default 'planned',            -- planned, in_progress, on_hold, done; one-time goals move to done automatically (G4)
  created_at timestamptz default now(), updated_at timestamptz default now()
)

steps(
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals on delete cascade,
  position integer not null,
  title text not null,
  description text,                          -- one or two sentences (D1c)
  minutes integer not null check (minutes > 0),   -- no maximum number of steps (T2)
  unique (goal_id, position)
)

sessions(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users,
  goal_id uuid not null references goals,
  companion_id text not null,                -- text key into the imported story dataset; no content-library foreign key
  story_id text not null,                    -- text key; no content-library foreign key
  step_count integer not null,
  state text not null default 'open',        -- open, on_hold, completed, restarted
  seed text not null,
  started_at timestamptz, last_active_at timestamptz, completed_at timestamptz,
  background_card text,
  background_card_source text,               -- authored or generated; null when there is no background card
  merged_key_moments jsonb,                  -- key moments that did not get their own step
  closing_line text
)
-- one goal has at most one session with state = 'open' (partial unique index)

session_steps(                               -- decided for US-ACC-2
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions on delete cascade,
  step_id uuid not null references steps on delete cascade,
  position integer not null,
  opened_at timestamptz,
  done_at timestamptz,                       -- null when Done is undone
  unique (session_id, position)
)

session_lines(                               -- decided for US-ACC-2; replaces pauses, return_events and cards_seen
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions on delete cascade,
  session_step_id uuid references session_steps on delete cascade,  -- null for the background card
  seq integer not null,
  kind text not null,                        -- background, story_card, pause_message, return_popup, closing
  card_id text,                              -- authored card id; null when the line was generated
  source text not null,                      -- authored or generated
  text text not null,                        -- story text, not text the user wrote
  pause_number integer,                      -- set only when kind is pause_message
  shown_at timestamptz not null default now()
)
-- insert and select policies only, so a shown line is not edited in place

used_items(user_id uuid, companion_id text, item_id text, used_at timestamptz, primary key (user_id, companion_id, item_id))
   -- non-repeat across sessions: authored fallback snags and fallback lines

safety_events(
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  position text not null,                    -- screen and field
  tier text not null check (tier in ('crisis','stress')),   -- two tiers in the first demo (A5b)
  layer text, classifier_version text,
  latency_ms integer, user_action text, created_at timestamptz default now()
)   -- proposed in the AI specification; no raw text is stored; wording and retention need legal review
```

Notes for the schema:

- `session_lines.text` is the line that was shown. A shown line is insert-only, so rereading does not regenerate it. The background card is also copied onto `sessions.background_card`. `session_steps.done_at` is cleared when Done is undone; there is no Done-event table.
- Pause messages and return pop-ups are `session_lines` rows (`pause_message` and `return_popup`). There is no pause table and no return-event table.
- The session record page (2.15) reads from `sessions`, `goals` and `session_steps`; it needs no table.
- Rest chat messages are not given a table, and with no message limit (Decided, R2) whether to store them is not decided.
- Story progress for a Companion is the completed sessions grouped by `companion_id` and `story_id`. A `restarted` session does not count. There is no progress table. All 26 stories are shown on the Life Path (Decided, D4).
- Content ids are text so that the JSON ids can be used unchanged.

## 9. What exists today and what is missing

Cards are written live, so a story needs facts, key moments and fallback lines rather than a full authored card set (Decided, D4). The table shows what exists as input and as fallback.

| Content | Chapter 8, "The Canyon and the Mesa" (`site-search`) | The Trinity night, chapter 13 (`trinity`) | Chapter 1, "The Trade of a Theorist" (`bohr-difficulties`) | Other Oppenheimer chapters |
|---|---|---|---|---|
| Story database entry (facts, goal, background) | Yes | Yes | Yes (5 database tasks; date is a placeholder) | Yes, all 26 |
| Key moments (2 to 4) and key lines | None in the data (proposed s4, s6, s8) | None in the data (proposed s4, s6) | None | None |
| Slices (authored fallback only) | 8 slices | 7 slices | No | No (24 of 26 have none) |
| Authored fallback cards | 41 cards, older shape | 135 cards: 21 rows of chain cards plus 30 return cards, current shape | None | None |
| Generic fallback lines (D5) | n/a | n/a | None | None |
| Step lines and where-now | Yes, all 8 slices | The older pool has 22 such records (type HIS); not in the new shape | None | None |
| Background card fallback (`who_i_am`) | Yes | Yes | Yes | Yes, all 26 |
| Goal opener | One | Three | One | One each |
| Snags | None | Sample for s4 only (8); the older pool has 15 pause items | None | None |
| Return pop-up fallback texts | None | 30 return cards, reusable after review | None | None |
| Closing fallback lines | None (two drafts exist only in the AI specification) | 4 (smooth 2, rough 2) plus a hanging line | None | None |
| Leak map | No separate file (forbid list and a checking script) | Yes (7 slices) | None | None |
| Scene table (generator input) | None | One scene (s4) in the sample | None | None |
| Safety, rest chat fallback lines | Not written for any story | Not written | Not written | Not written |

Decision M1 (2026-11-05): new users start at chapter 1, with no designated entry story. Chapter 1 is playable from its database entry because cards are live, but it needs its key moments, its generic fallback lines and its generator inputs (scene table, allowed props, allowed names, rules). The authored fallback cards cover chapter 8 and the Trinity night only. Any demo for the first test must say which chapter it uses.

Other missing pieces:

- The real planning prompt (open, P1). The text in `docs/ai/AI_01` is a placeholder.
- Key moments (2 to 4) and first-person key lines for every story.
- Generator inputs for all 26 stories: scene tables, allowed props, allowed names and rules, and the leak words per fact.
- The generic fallback lines for the 24 stories without authored cards (D5), and the fallback wording for the third pause and later.
- The length limit of the background card and of the return pop-up text.
- The fallback set for live-generated snags and return pop-ups: its size and who writes the generator checks.
- The rest chat fallback lines and the closing fallbacks for `site-search` and the other stories.
- Companion data for six of the eight characters in the older product, and Heisenberg stories beyond four scene openers and four line segments.

## 10. Source documents

All in the planning folder (`1_Projects/Newfeatures/` unless noted):

- `docs/DECISIONS.md` (authoritative).
- `NF3_content/` JSON files listed in section 0.
- `PRODUCT_doc-map-and-open-decisions_2026-11-04_v1_draft.md` for the decisions.
- `PRDs_MomTest/NF5_content-rules-v2-card-stack_2026-10-29_v1_draft.md` (current card rules and Yue's answers of 2026-10-29).
- `PRDs_MomTest/NF5_card-stack-v3_register-density-narration-intro-reread_2026-11-04_v1_draft.md` (draft proposals; not adopted).
- `NF3_story-side-after-user-test_2026-11-04_v1_draft.md` (snags, key slices, people, scenes).
- `NF3_trinity-chains_2026-10-29_v1_draft.md` and `NF3_cards-and-first-person-mock_2026-10-29_v1_draft.md`.
- `2_Areas/Product/PROD_story-database-runtime-design_2026-10-29_v1_draft.md`.
- `2_Areas/Product/oppenheimer-stories/en/database/00_DATABASE_INDEX.md`, `entries/`, `personas.json`.
- The AI specification copies in `docs/ai/`.

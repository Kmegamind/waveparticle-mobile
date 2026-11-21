# Content model and content format

This document describes the data an engineer needs in order to build the story side of the WaveParticle mobile app: what the entities are, what the real content files look like, how a user's steps map onto a story, which card appears when, where each line comes from, which checks every line must pass, and a proposed relational schema for Supabase.

Every field name, type and example below is taken from the real content files unless it is marked "proposed". Where a file and a decision disagree, `docs/DECISIONS.md` wins and the disagreement is stated.

> **Changed 2026-11-14 and 2026-11-15 (`docs/DECISIONS.md`, decisions SHARED-STORY to CLOSING-AHEAD).** The background card, the step story cards and the closing line are made ahead once per story part, published and shared by all users, and read by a person afterwards (changed 2026-11-21, PUBLISH-FIRST); only the pause message, the rest conversation, the return pop-up and the goal split are live. There are no authored or generic fallback lines (NO-BACKUP, NO-FALLBACK-TABLES). The authored cards of two stories are reference examples and evaluation material only. This document was brought in line with these decisions in issue #295, and with the decisions of 2026-11-17 in issue #298.

## 0. How to read this document

Status labels used throughout:

| Label | Meaning |
|---|---|
| Decided | Decided by Yue and recorded in `docs/DECISIONS.md`. Authoritative. |
| Current rule | Written in a current rules document (card stack rules, version 2) and not reversed since. |
| Draft | Proposed in a draft document and not yet confirmed. Do not build it as if it were settled. |
| Missing | Needed by the app but not yet written anywhere. |

Words used with a fixed meaning:

| Term | Meaning |
|---|---|
| Companion | The historical or fictional character the user works alongside. Only Oppenheimer and Moriarty are being built for Release 1 (OTHER-COMPANIONS); the content files also hold Heisenberg data. The interface word is "Companion". |
| Goal | The user's own goal, typed in the goal dialogue. |
| Step | One part of the user's plan, with a title, a short description and a number of minutes. |
| Story | One episode of a companion's life, for example "The Canyon and the Mesa". The database calls it a story; the map calls it a chapter. |
| Part | One of the Companion's tasks in a story. A story has 2 to 5 parts (STORY-PARTS). Story cards are made per part, and the app spreads the parts across the user's steps (CARDS-PER-PART, section 3). |
| Slice | One small unit of a story, holding one to three facts. Slices exist only for the two stories with authored cards, which are reference examples and evaluation material only (NO-FALLBACK-TABLES). |
| Entry state | What the companion knows and is living through just before a given slice. Used by the authored reference cards. |
| Fate link | The rule that the story moves forward only when the user taps Done. A step's cards may move within the step's own parts of the story but never into the next step's (section 3). |
| Background card | The card told in the character's own voice that opens the first step of a goal (2.13). Made ahead once per story (SHARED-STORY). |
| Return pop-up | The modal in which the character says what he did while the user was away, with one start button (2.9). |
| Foreground minutes | Minutes the app has been on screen. The clock is frozen while the user is away unless the setting "Keep the clock running when I leave" is on (Decided, F2). |

Content files used as the real data (all in the planning folder under `1_Projects/Newfeatures/NF3_content/` unless stated): `site_search_cards_2026-10-29.json`, `trinity_chains_2026-10-29.json`, `trinity_leakmap_2026-10-29.json`, `dialogue_pools_2026-10-29.json`, `story_openers_2026-10-29.json`, `snag_sample_trinity_s4_2026-11-04.json`, `nf5_records_2026-10-29.json`, plus the story database under `2_Areas/Product/oppenheimer-stories/en/database/` (index, `entries/*.plan.json`, `personas.json`). The repository import is `src/content/oppenheimer/stories.json`, now the seed of the database tables named below.

The repository import contains the 26 story goals, ordered facts, forbidden terms, and provenance. Key slices are represented by task-level cut points: content-owner `added_later` markers are preferred, and the first two task cut points are used when a story has fewer than two markers. Each imported key slice is marked `confirmed` in today's file; in the database it is stored as unconfirmed (KEY-UNCONFIRMED). Each key slice records the fact ids it covers. Its `keyLine` is one first-person past-tense sentence of at most 18 words. This selection is data, not a limit on the number of user Steps. Pressing Start calls `startStory` in `src/lib/story/start.ts`, which spreads the story's parts across the plan's steps with plain code and does not call a model (CARDS-PER-PART).

Since issue #284 the story content lives in the database: `public.companions`, `public.stories` and `public.story_inputs` (`supabase/migrations/20261119000000_story_content.sql`, `docs/decisions/0019`). The files above are the seed. Stored cards are issue #293.

No person has read any of the authored lines for voice. They were written from the story database entries and passed by script only: their state is "checked by script", not "read by a person" (READ-STATUS).

## 1. How the pieces fit

```
Companion ──< Story ──< Story fact (key moments marked)   (content, read-only for users)
                │
                ├──< Part ──< Card       (made ahead, read, published, shared; 2 to 5 parts)
                ├── Background card, Closing line (made ahead with the cards)
                ├──< Slice ──< Card      (authored reference cards, two stories only)
                ├──< Snag                (reference samples for the live stuck story, grouped by Scene)
                └── Scene                (rules that keep cards consistent)

User ──< Goal ──< Step                   (the user's plan; user text; step has title and description)
            │
            └──< Session ──┬── Background card
                           └──< Session step ──┬──< Pause          (his message; pause number goes to the prompt)
                                               ├──< Return event   (return pop-up)
                                               └──< Cards seen     (n story cards, 1 to 5)
```

A Session binds one Goal to one Story of one Companion. The story's cards are made ahead once per part and shared by all users (SHARED-STORY, CARDS-PER-PART); when the user presses Start, the app spreads the parts across the Goal's N steps with plain code (section 3). The step opens with one card and the rest appear at the pacing of section 5. When the user taps Done, the next step opens on the same page with its one card. The authored cards (slices, snags) are reference examples and evaluation material only and are never shown (NO-FALLBACK-TABLES).

Card ids are stable and never reused. Made-ahead cards follow the naming scheme `crd.<short>.<story>.p<n>.c<n>`, and `crd.<short>.<story>.bg` for the background card (NAMING-CODE); the authored reference cards keep ids such as `site-search.s3.c2` or `trinity.s4.ch2.wry`. A card gets a `session_lines` row when it is shown. A card that has been shown is never edited or regenerated (it may be reread).

## 2. Entities

### 2.1 Companion

The character who "lives" the story. The data is split over `personas.json` and `dialogue_pools_2026-10-29.json`.

| Field | Type | Example (real data) |
|---|---|---|
| id | text | `oppenheimer`, `heisenberg` |
| voice | text | "He talks short and direct: plain spoken sentences, contractions, a dry one-line joke, sometimes a sharp edge of arrogance. He is never loud." (`personas.json`, Oppenheimer) |
| periods | list of {until, text} | `{"until": "1927-12-31", "text": "A young physicist, {age}, brilliant, lonely and badly unhappy, ..."}`. Six periods; the last `until` is `2100-01-01`. `{age}` is visible only in the admin and never reaches a prompt (AGE-TEXT). The user never sees dates or ages (PERIODS); dates are never passed to a card prompt and no card may state an age (DATES-ADMIN-ONLY). |
| world record (fictional Companions only) | text | Missing. Stored with the Companion; a fictional Companion's notebook must stay consistent with it (FICTION-RULES). |
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

Only two companions have data in these files. The older Flask product has eight characters; their data is not in the content files read for this document. Release 1 builds only Oppenheimer and Moriarty (OTHER-COMPANIONS). The language is English only; there is no language setting (Decided, L1).

### 2.2 Story

One episode. The story database holds 26 Oppenheimer stories (`entries/<id>.plan.json`). The runtime layer adds the fields marked "runtime".

| Field | Type | Example |
|---|---|---|
| id | text | `site-search` |
| seq | integer, 1 to 26 | `8`. Chapter number; time order. All 26 stories are playable and shown on the Life Path, in order, with chapters ahead of the current one visible and not tappable (Decided, D4); a new user starts at chapter 1 (Decided, M1). Chapter 1 is `bohr-difficulties` ("The Trade of a Theorist"), chapter 8 is `site-search`, chapter 13 is `trinity` ("The Storm Before the Shot"). From `story_openers_2026-10-29.json`. The numbering in the database index table is a different order and must not be used as the chapter number. |
| title | text | "The Canyon and the Mesa" |
| era | text | `era3` |
| period | text | The named Life Path period the story belongs to, never a date (PERIODS). Stored as `stories.period`. |
| date | text | `1942-11-16`. Several dates are placeholders (see the database index, section "Left for Yue by the fixers"). Visible only in the admin and never passed to a card prompt; the checks reject a year, date or age in a card (DATES-ADMIN-ONLY). |
| place | text | "Jemez Springs and the Pajarito Plateau, northwest of Santa Fe, New Mexico" |
| context | text | Background paragraph; backend only. |
| hook | text | Third-person summary; no longer shown to users. |
| feel_tags | list of text | `["high desert", ...]` |
| probe_words | list of text | `["Groves approved", "Project Y", "Manhattan Project", "Hiroshima", ...]`. Words that must never appear in his lines. In the card files the same list is called `forbid_terms`. |
| notebook.goal | text | Backend goal sentence. For a historical Companion every quotation in the notebook must be in the source; a fictional Companion's notebook may invent freely but must stay consistent with that Companion's world record (FICTION-RULES). Exact dates stay in the notebook for writers (DATES-ADMIN-ONLY). |
| detail.goal | {why, stakes, obstacle, if_then} | Backend only. |
| detail.tasks | list | The story's parts: the character's tasks in that story, 2 to 5 per story (STORY-PARTS; here 4; an internal field name), each with `id`, `done_when`, `added_later`, `steps`, `obstacle`, `if_then`, `knowledge` (background facts, about 20 per story), `happened` (facts from the book, 11 for this story), `anchors`, `tone`. Each part's cards are made ahead from its `happened` facts (CARDS-PER-PART), and the app spreads the parts across the user's steps (section 3). The parts do not decide the number of steps. |
| story goal (short, full) | text, text | `short`: "I want the laboratory built where my people can live and work." `full`: "I want to choose well, and I do not yet have the power to choose, so I have to see it clearly and say it simply." Shown as "My goal" on the companion's card. Not the same thing as the user's Goal. |
| who_i_am | text | "I'm a physicist from Berkeley, asked to run a laboratory the Army has not yet found a home for." (key `where_now.who`). Shown in the "Who I am" sheet, which opens when the user taps his portrait on the focus page, as in prototype v4 F1-C (PORTRAIT-SHEET; code follow-up). |
| slice count (runtime) | integer | `8` for `site-search`, `7` for `trinity`; none for the other stories. Equals the number of authored slices. It is not a limit on the number of steps (Decided, T2). Earlier called capacity. Reference data only. |
| allowed_cut_points (runtime) | list of text | `["after s1", ..., "after s7"]`. Reference data only (NO-FALLBACK-TABLES). |
| key moments | list of {fact ids, key_line} | 2 to 4 per story (Decided, C2). Stored as unconfirmed until the content owner reviews them (KEY-MOMENTS-DRAFT, KEY-UNCONFIRMED). Imported as `keySlices`. Must-use facts when the story's cards are made ahead. `keyLine`: one first-person past-tense sentence of at most 18 words. |
| forbid_terms (runtime) | list of text | Ending words of the whole story; checked on every card and live line. Trinity: `["Hiroshima", "Nagasaki", "Little Boy", "Fat Man", "Truman", "Potsdam", "Enola Gay", "destroyer of worlds", "White Sands", "Cold War", "hearing"]` |
| dialogue_open (runtime) | list of text | Opening line of the goal conversation in this story's starting situation: "I have given up the bench and I am betting everything on a calculation. What are you working on?" (chapter 1). Rules: at most 2 sentences and 30 words, exactly one question and it is the last sentence, first person, nothing that happens after the story starts, no time-of-day words, no "we". |
| step_lines (runtime) | map slice id to {current, done, plan} | See 2.3. |
| status | text | `"draft mock; every line is authored ... nobody has read them for voice"`. Content that Yue must judge carries one of three states: written, checked by script, read by a person. Only Yue, or a person Yue names, may set "read by a person"; a passing script never counts as read (READ-STATUS). |

Today only Trinity has three openers; the other 25 Oppenheimer stories have one each. Heisenberg has four scene openers (`h.device_bench`, `h.hector_room`, `h.dea_bait`, `h.bell_wait`) instead of stories.

### 2.3 Slice

For the two stories with authored cards, the story is cut into slices. A slice holds one to three facts from the book. Facts are backend-only and may contain clock times or outcomes; they are never shown. Slices belong to the authored reference cards only (NO-FALLBACK-TABLES); story cards are made per part from the story facts (2.2, CARDS-PER-PART).

| Field | Type | Example (`site-search`, slice s4) |
|---|---|---|
| id | text | `s4` |
| priority | integer 1 to 3 | `2`. Used by the removed cut-by-slice rule; reference data only. |
| facts | list of text | `["We were still arguing when General Groves showed up.", "Groves took one look at Jemez Springs and said, \"This will never do.\""]` |
| landing_card | card id | `site-search.s4.land` |
| where_now | text | "I'm in the canyon, arguing the case against it to an officer who has made up his mind." (the entry state of s4, in his voice, only what has already happened) |
| current, done, plan | text, text, text | `current`: "I'm waiting on Dudley's answer." `done`: "I heard the general's verdict." `plan`: "I want to hear who has the last word." At most 10 words each, first person. `plan` states an intention only and presupposes no fact. |
| key (draft) | boolean | Missing from the JSON. See section 4. For other stories the key moments are marked on the story facts (2.2). |
| key_line (draft) | text | Missing from the JSON. At most 18 words, first person, past tense, no future. |
| bridge (draft) | text | Missing. Optional, at most 10 words, joins cause and effect when a slice is merged away. |

Real slice priorities for `site-search`: s1 1, s2 2, s3 2, s4 2, s5 1, s6 3, s7 1, s8 3. For `trinity`: s1 1, s2 1, s3 1, s4 2, s5 2, s6 3, s7 2.

### 2.4 Card

A card is one first-person text the companion shows while the user works. Story cards are made ahead once per story part from the story facts, checked and published, then shared by all users; a person reads them after publishing and may edit a published card (SHARED-STORY, CARDS-PER-PART, READ-STATUS, PUBLISH-FIRST); their shape is Shape C. The two authored shapes A and B below exist for two stories and are reference examples and evaluation material only; they are never shown to the user (NO-BACKUP, NO-FALLBACK-TABLES).

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

Card types of shape B, in the order they appear in a chain. The 105 chain cards also include 21 cards of an older role that announced the end of the time; the current design has no such role (CARDS-SPREAD):

| Code | Role | Counts today |
|---|---|---|
| SIT | The situation. In the chains, the first card of entry state s1 only. | 3 (one per chain of entry state s1) |
| EVM | What just happened and why it matters: first sentence a fact in the past tense (the landing line of the slice just completed, compressed), second sentence the consequence. In the chains, the first card of entry states s2 to s7. | 18 |
| WRY | What he worries about; follows from the EVM card. | 21 |
| DOI | What he is doing because of that; actions only, no results. | 21 |
| NTC | A small thing he notices; texture only, no new fact, no new person. | 21 |
| RET | Retired as a card. The return after rest is now the return pop-up (2.9), which is generated live. The 30 existing cards are reference material only (NO-BACKUP). | 30 (15 pause items times two depths) |

Grouping records in the same file:

- `ROW`: `{"id": "row.s1.ch1", "type": "ROW", "cards": ["trinity.s1.ch1.sit", "trinity.s1.ch1.wry", "trinity.s1.ch1.doi", "trinity.s1.ch1.ntc"], "first_step": true}`. One row is one chain for one entry state: 21 rows.
- `RUN`: `{"id": "run.ch1", "type": "RUN", "rows": ["row.s1.ch1", ..., "row.s7.ch1"]}`. Three runs, one per chain number, each walking seven entry states. Used by the checks that compare neighbouring steps.

Shape C, made-ahead card (proposed; stored cards are issue #293 and not built yet):

| Field | Type | Notes |
|---|---|---|
| id | text | `crd.<short>.<story>.p<n>.c<n>`, or `crd.<short>.<story>.bg` (NAMING-CODE). |
| part | integer | The story part the card belongs to (CARDS-PER-PART). |
| position | integer | Order inside its part. |
| text | text | First person. Passes the checks of section 7; a card over the length limit cannot be published (LEN-CARD). A published card can be edited and published again (PUBLISH-FIRST); a line already shown in a session is not changed (`session_lines` is insert-only; `docs/decisions/0021`). |
| state | `written`, `checked by script`, `read by a person` | Only published cards are shown (ADMIN). The state is not a condition for publishing: a published card may still be `written` or `checked by script` (READ-STATUS, PUBLISH-FIRST). |
| prompt version | text | The prompt version that wrote it (PROMPT-PARTS). |
| facts used | list of fact ids | Which story facts the card draws on; used by the leak check. |

When a card is revealed in a session (its due time in foreground seconds) is worked out for that session from the user's step minutes (2.14).

Every card must make sense on its own, so a user can look back at it (Decided, D2), and must contain something new (CARD-NEW). Tone by moment and "three small turns of feeling per step" are rules inside the AI prompts, not product requirements.

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
| minutes | A whole number from 1 to 1440 (STEP-RANGE). A new step defaults to 15 minutes (NO-ROUNDING). At creation the minutes add up to the time the user gave (D1d), so there is no "plan is longer than your time" message. |

The user may edit everything: rename a step, change its minutes, add, delete, and move a step up or down with buttons of at least 44 by 44 px (STEP-EDIT, TAP-SIZE; code follow-up). Minutes change with −5 and +5 or a typed whole number, from 1 to 1440; at either end the reason is shown in words (#249). If the edits change the total, the goal's time follows the edits (Decided, D1d). There is no maximum number of steps (Decided, T2). How a plan is split for different kinds of goals is the planning prompt's job, not a rule of this document (Decided, D1b).

Rules checked in code: the JSON parses; at least one step; titles non-empty; minutes are whole numbers from 1 to 1440; at creation the minutes add up to the total. There is no step size of 15 minutes and no cap on the step count (STEP-EDIT, T2).

Story step: the story parts the app gives to one user step (CARDS-PER-PART). When the user presses Start, `startStory` (`src/lib/story/start.ts`) spreads the story's parts across the user's steps, in order, with plain code and no model call. Example: 4 parts and 2 steps gives parts 1 and 2 in step 1, parts 3 and 4 in step 2. With more steps than parts, a part's cards are split across neighbouring steps (CARDS-SPREAD). The character's goal mirrors the user's: if the user has x steps of y minutes each, the character also has x steps of y minutes each (T1). Proposed record (not an existing file):

```json
{"step": 2, "minutes": 30, "n": 3, "interval_min": 10,
 "parts": [3, 4],
 "key_moments": ["f12"],
 "cards": [{"position": 1, "due_min": 10}, {"position": 2, "due_min": 20}, {"position": 3, "due_min": 30}]}
```

The pacing fields are defined in 2.14. For the two stories with authored cards, `site_search_cards_2026-10-29.json` also lists one precomputed step per slice (8 steps), each with `cards`, `current`, `done`, `plan` and `where_now`. Those are reference material only (NO-FALLBACK-TABLES). Its `reveal_foreground_min` values are not used: they showed four cards at time zero, which contradicts the decision that a step opens with one card.

### 2.6 Goal (the user's)

| Field | Type | Notes |
|---|---|---|
| text | text | What the user typed in a free text box, at most about 200 characters (limit pending). There is no restriction on what a goal can be and no list of unsupported kinds (Decided, D1a). Stored on our server (Decided, S3). Goes to the model only in the planning prompt; its shape is decided by a local rule (GOAL-SHAPE-LOCAL); the story cards are made ahead and shared, so they never receive it (SHARED-STORY). |
| title | text | At most 40 characters, produced by the planning prompt. |
| shape | `specific`, `vague`, `big`, `unknown` | One-word shape, decided in version 1 by the local rule `classifyGoalShape` with no model call (GOAL-SHAPE-LOCAL), that selects his reaction line (slots GD1S, GD1V, GD1B). It never refuses or redirects a goal. |
| total minutes | integer | The time the user gave, on a time slider from 1 minute to 3 hours with no 0 (SLIDER-RANGE); not rounded to 15 minutes (NO-ROUNDING). Follows the user's edits to the steps (Decided, D1d). |
| split finer | boolean | Proposed: the user's answer to the question asked after the time, whether to split the goal into finer steps. Passed to the planning prompt. |
| status | text | planned, in progress, on hold, done. A one-time goal moves to done automatically when its last step is finished (Decided, G4). One goal has at most one session in progress (goal management rule). |

### 2.7 Session

One run of one Goal against one Story. The planning documents call this a "run" (`story_run` in the runtime design). It starts when the user confirms the plan and ends at the summary. An account is required from the first open (Decided, ACC), so every session belongs to a user.

| Field | Notes |
|---|---|
| user, goal, companion, story | The story is fixed when the session is created. Any of the 26 stories can be chosen (Decided, D4), and a new user starts at chapter 1 (Decided, M1). |
| step count | N, fixed for the session once it starts. No maximum. |
| state | `open`, `on_hold`, `completed`, `restarted`. "Start over" restarts the character's night from the beginning of the story with the same steps; the old session is kept and marked restarted (Decided, T5). There is no early-ending or abandoned state, and no state caused by time away: there is no time limit on resuming (Decided, T6). |
| seed | Makes non-repeating picks reproducible. |
| last active time | The clock freezes when the app leaves the screen, unless the keep-running setting is on (Decided, F2). |
| background card | The story's published background card as shown (2.13). One per session. |
| closing line | The story's published closing line, made ahead with its cards (CLOSING-AHEAD, END-TONE; section 6). |
| log | Which step is done (a step on which Done was pressed and not undone), and for each step which pauses and return events happened. The goal text is not repeated in the log. |

A Session is also the unit of the session record (2.15).

### 2.8 Pause

Pause is the only way into the rest page. Decided (F1, refined 2026-11-05): there is no limit on pauses and no timer reset. Pausing never adds a screen, a pop-up or a penalty. Every Pause opens the same conversation: the character first sends a message about the snag his own task has hit and how he feels about it (a Pause means his side of the story has stalled). The message is generated live. The earlier ideas of a quiet line and of one comment after many pauses are replaced by this.

| Field | Notes |
|---|---|
| number within the step | Counted per step; never shown to the user. Passed to the prompt as the pause number. |
| start and end time | |
| his message | Generated live from a new stuck story each time (2.10, PAUSE-3) and checked. No stored text stands in for it; a failure shows the failure message with Retry (NO-BACKUP, FAIL-SCREEN). |
| source of that text | generated |
| rejected rules | Rule ids of any failed attempt; never raw user text. |

What the pause number changes (prompt only, Decided, F1):

| Pause number in one step | His message |
|---|---|
| 1 and 2 | The snag his own task has hit and how he feels about it, from a new stuck story each time (PAUSE-3). |
| 3 | The prompt changes: the snag is much harder and, remembering the earlier setbacks, he says he is worried he may fail. It is never an instruction to the user and never asks the user to stop pausing (PAUSE-3). |
| 4 and later | The same strong tone continues, in new words each time. Nothing else happens. |

No new screen, no warning page. The return after a pause is a return pop-up (2.9), not a line of this entity.

### 2.9 Return pop-up

A modal in which the character says what he did while the user was away and how he felt, with one start button. When the user taps it, the original step resumes and the clock starts (Decided, T6). There is no time limit on resuming: however long the user was away, the step can be resumed. The 24-hour rule, "Start from step 1", the "not completed" History entry for lapsed goals and the Home rule that keeps an unfinished goal for 24 hours are all removed.

When it appears (Decided, R1):

1. After the user taps Back to step on the rest page.
2. When the user returns to the app after being away for 5 minutes or more.
3. Continue on Home and Continue in Goals follow the same rule: the pop-up appears if the user was away 5 minutes or more (Decided, T9).

A shorter glance at another app resumes the clock with no pop-up. The return line on Home, the return card in the stack (type RET) and the separate "away card" are not needed (Decided, R1). Home shows no "welcome back" (Decided, H7). Not decided: what the pop-up does when the keep-running setting is on and the clock never stopped.

The text is generated live (Decided, T6, A6, H2) and checked. There is no authored fallback (NO-BACKUP); a failure shows the failure message with Retry (FAIL-SCREEN). Going back to a step offline also shows the failure screen with Retry (OFFLINE-RESUME).

| Field | Meaning |
|---|---|
| trigger | `back_from_rest` or `away_5min`. |
| away seconds | How long the app was away or the rest page was open. Stored; whether the prompt receives it is not decided. |
| text | His message: what he did during that time and how he felt. First person. |
| source | generated. |
| shown at, started at | When the pop-up opened and when the user tapped the start button (the clock restarts at that moment). |

The authored return texts (`ret_line`, `ret_short` and `ret_long` in `snag_sample_trinity_s4_2026-11-04.json`, and the 30 Trinity RET cards) are reference examples and evaluation material only and are never shown (NO-BACKUP).

Length: 1 or 2 sentences, at most 30 words (LEN-RETURN). Proposed checks, kept from the older list: no blame aimed at the user, no clock time, no hook, no news that moves the story beyond the step's parts. The old rule against "I waited" no longer applies: there is no rule about whether he waits (Decided, H8). He may describe how the time felt in any words he would use, such as "a while" (TIME-WORDS); whether exact clock numbers are allowed is open (CLOCK-NUMBERS), and until decided they stay out.

### 2.10 Snag

A small obstacle in his own world that his message on the rest page is built from when the user pauses (Decided, C1: the AI first generates a stuck story, then the character describes his predicament and how he feels). It must not be an event. The AI generates a new stuck story at every Pause (PAUSE-3). The message is made with two calls, and code chooses the category and the prop (PAUSE-TWO-CALLS). The authored snags below are reference examples and evaluation material only (C1, NO-BACKUP).

| Field | Type | Example (`s4.p1`) |
|---|---|---|
| id | text | `s4.p1` |
| family | text | `weather-on-body`. Other families in the sample: hardware, light, footing, smoke, clothing, wind-and-hat, cold-hands. |
| props | list of text | `["collar", "hat"]`. Every prop must appear in the obstacle text. |
| obstacle | text | "Rain is running off my hat brim into my collar, so I'm turning it up." |
| ret_line, ret_short, ret_long | text | Authored return texts; reference only (2.9). |
| origin | `authored` | |
| kind | `invented` | All snags are invented small actions, not facts from the book. |
| valid_from (draft) | slice id | First entry state in which the snag's words are allowed (a bunker door needs the bunker to exist). |

The sample holds 8 snags for Trinity entry state s4. The same file holds 4 quiet lines; they are not used, because the quiet line was replaced by the pause-number rule (2.8). Variety rules: no snag repeats inside one step; two snags in a row never share a family. With no limit on pauses, these rules must keep working for many pauses in one step.

### 2.11 People (no separate content type)

Decided (M2, refined): there is no person content type, no introduction phrase and no list of people with phrases. The people who are present in a story are named in the scene table (2.12) as `present` and `allowed_names`, and the background card (2.13) introduces them in his own voice. Later cards carry no introduction phrases. Names are not tappable and there is no separate "what you need to know" screen. Every later line (cards, his message on the rest page, the return pop-up, rest chat) may use only names in `allowed_names`.

### 2.12 Scene

A table that keeps cards and snags consistent about where he is, who is there, and what objects exist. Decided 2026-11-21 (SCENE-PER-STORY): one scene table per story, as drafted in `docs/demo/<story>.stage0.json` (field `scene`), with no weather or light scales. Reading it is not a gate (PUBLISH-FIRST). Drafted shape (`bohr-difficulties`, lists shortened):

```json
{"present": [], "allowedWords": ["Cambridge", "Dirac", "Rutherford", "Bohr"],
 "props": ["desk", "lamp", "notebook", "pencil", "blackboard", "chalk", "teacup"],
 "pauseProp": "notebook", "laterWords": ["Kapitza", "Club"]}
```

`present` lists the people present and `allowedWords` the names a line may use (the `allowed_names` of section 2.11); `props` are the objects that exist; `pauseProp` is the one prop offered to the pause message; `laterWords` are words a line may not use yet. The same data is the input the live generator needs (allowed props, allowed names, rules), because no authored pool is ever shown (Decided, C1; NO-BACKUP). Today only the demo scripts read it, not the app.

The older sample (`_meta.scene` in the Trinity snag file: one scene per entry state, with `one_way_scales` of rain, wind and sky) is reference only. The scene per entry state and the one-way scales are withdrawn (SCENE-PER-STORY).


### 2.13 Background card

The card that opens the first step of a goal (Decided, T4, T9). It is not progress, so it is not counted among the story cards of a step.

| Field | Notes |
|---|---|
| text | Told in the character's own voice, as storytelling: who is here, where this is, and what each person knows (Decided, D3). It introduces the people who are present; no later card introduces anyone (Decided, M2). Never from a third-party point of view, so that the experience stays immersive. Replaces the earlier proposal of a three-line summary. |
| source | Made ahead once per story and published, then shared by all users; read by a person afterwards (SHARED-STORY, PUBLISH-FIRST). |
| when | Once, as the one card with which the first step opens; later steps have no special opening card (CARDS-SPREAD). It is the oldest card in the first step's stack and needs no button to dismiss it (Decided, T9). |
| input | Story facts true at the start: the story's `who_i_am`, the opening `where_now`, the people and the `knowledge` field. Nothing that happens later, and no dates (DATES-ADMIN-ONLY). |
| checks | The per-line checks of section 7.1 (first person, no clock times, dates, years or ages, no future facts, leak map). At most 70 words; a background card over the limit cannot be published (LEN-CARD). |

### 2.14 Card pacing

Decided (CARDS-SPREAD, T1): the cards of all parts are spread across the user's steps in story order. No card is ever dropped, so there is no upper limit on a step's cards. A step's n is the number of cards it receives; every step gets at least one new card. More cards in a step means closer together, fewer means further apart. The n story cards arrive at y/n, 2y/n, and so on up to y minutes after the step starts, where y is the step's minutes: interval = step minutes / n. The last card arrives at the end of the step, and the first card of the next step is the story's next card at the start of that step (CARD-TIMING). There is no special "just finished" card at the start of a later step and no special "still at it" card at 00:00.

| Field | Rule |
|---|---|
| n | The number of cards the step receives; at least 1, no upper limit (CARDS-SPREAD). |
| interval | step minutes / n, in minutes. |
| due time of card k | k x interval, in foreground minutes, so the n-th card is due at the step's end time. The background card with which the first step opens is not one of the n (Decided, T9). |
| foreground only | Nothing is added while the app is away or the step is paused (unless the keep-running setting is on; how pacing then works is not specified). |

Examples: a 30-minute step that receives 3 cards shows one every 10 minutes; a 30-minute step that receives 6 cards shows one every 5 minutes.

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

The Home card line is the last line he said in the user's most recent session, stored in that session's record. There are no separate status lines (HOME-LINE).

## 3. How the user's steps share out the story

Let N be the number of steps the user confirmed. There is no maximum (Decided, T2), and few steps are allowed (Decided, C2).

1. **The story in parts.** A story has 2 to 5 parts (STORY-PARTS), and its cards are made ahead once per part (CARDS-PER-PART). When the user presses Start, the app spreads the parts across the user's N steps in story order with plain code, with no model call (`src/lib/story/start.ts`). Example: 4 parts and 2 steps gives parts 1 and 2 in step 1, parts 3 and 4 in step 2. The parts do not decide how many steps there are (Decided, T2, T3). The character has the same number of steps with the same minutes as the user (Decided, T1).
2. **Facts a card may use.** A card of a part may use the facts of that part, in order. It never uses the facts of later parts, the story's ending words (the forbid list) or the per-fact leak words. The spoiler check runs when cards are made and again before publishing, against the parts after the card's own part (LEAK-BY-PART).
3. **Key moments.** They are inputs the AI must use (section 4). A key moment no longer ends a step (LEAK-BY-PART).
4. **Opening card of step k.** Step 1 opens with the background card (2.13) as its one card. A later step has no special opening card; it continues with its share of the story's cards (CARDS-SPREAD). There is no screen between steps.
5. **Cards while a step runs.** The step's n story cards arrive at y/n, 2y/n ... y minutes (2.14). The last of them arrives at 00:00 but is not a special card (CARDS-SPREAD, CARD-TIMING).
6. **Last step.** Done on the last step goes straight to the summary. There is no landing screen and no "next" card.
7. **N equals 1.** One step covers the whole story and receives all its cards (CARDS-SPREAD); the summary and the closing line carry the rest, and the summary lists the key moments.

## 4. Key slices

Decided (C2): each story has two to four key slices (key moments), confirmed by the content owner. Today the 54 machine-derived key moments are stored as unconfirmed and wait for review (KEY-UNCONFIRMED, KEY-REVIEW). "A key slice ends a step" is withdrawn (LEAK-BY-PART). The summary does not list merged key moments (NO-MERGED-MOMENTS). The stronger rule (never offer fewer steps than key slices) was not chosen, and the goal dialogue does not forbid few steps. Key moments are inputs the AI must use when the story's cards are made ahead (T3, SHARED-STORY).

Draft rules from the story database workstream that follow from this:

- A slice is key when, after it, the nature of what he has to do changes, not merely when things go further.
- There are no markers for turning points or scenes on the map rows or on the current card (Decided, M3); key moments appear only in the summary.

The import marks key slices on all 26 stories. The slice ids below are an earlier proposal for the two authored stories, and the table is the worked example the tests use. They are not the task ids stored for `site-search` (`offer_the_mesa`, `show_groves_the_mesa`) or `trinity` (`weigh_the_storm`, `answer_the_reporter`):

| Story | Key slices |
|---|---|
| `site-search` | s4 (Groves says the canyon will never do), s6 (he names the mesa and the boys' school), s8 (Groves says "this is the place") |
| `trinity` | s4 (the time of the shot is fixed), s6 (the light and the roar) |

How the cut fell for `site-search` with the key slices s4, s6, s8 under the withdrawn rule that a key slice ends a step (kept as a record; LEAK-BY-PART withdraws it, and NO-MERGED-MOMENTS withdraws the "End screen lists" column):

| N | Steps | Landing shown at the end of each step | End screen lists |
|---|---|---|---|
| 1 | s1 to s8 | none | key lines of s4, s6, s8 |
| 2 | s1 to s4, s5 to s8 | s4 | key lines of s6, s8 |
| 3 | s1 to s4, s5 to s6, s7 to s8 | s4, s6 | key line of s8 |
| 4 | s1 to s2, s3 to s4, s5 to s6, s7 to s8 | s2, s4, s6 | key line of s8 |
| 5 | s1 to s2, s3, s4, s5 to s6, s7 to s8 | s2, s3, s4, s6 | key line of s8 |

For N above 5 there is no limit (Decided, T2). The "landing shown" column describes the authored reference cards.

Today `startStory` still follows that cut (code follow-up of LEAK-BY-PART). Extra steps are split inside the stretch with the most facts, larger parts first, and a tie goes to the earlier stretch. Facts after the last key slice stay in that step until the plan has a spare step, which then takes those facts so the key slice can end the step before them. When there are fewer steps than key slices, the later key slices merge into the last step; the summary lists nothing for them (NO-MERGED-MOMENTS). One step has no next-step card and goes straight to the summary. The step count is the plan's count and does not depend on the number of slices.

## 5. Which card appears when

Decided (X2, X6): a step opens with exactly one card. More cards appear one at a time while the user works. The user sees one card at a time in a stack: a new card sits on top; swiping the top card to the left moves it aside and shows the card before it; swiping right brings the newer card back; dots show position (they appear as cards appear; no total and no placeholder dots); the two buttons "Earlier card" and "Newer card" do the same without a gesture. A new card does not slide in by itself while someone is reading an older one. The stack resets at each step, and the user cannot swipe back into the previous step.

| Event | What appears | Source |
|---|---|---|
| The goal starts (first step opens) | The background card, told in his voice (2.13), as the one card of the first step. No button is needed to dismiss it. | Decided (T4, T9) |
| A step opens (Start, or Done on the previous step) | Exactly one card: the background card for the first step (not one of the n story cards); for a later step, the first of its share of the story's cards. There is no special "just finished" card. | Decided (X2, T1, T9, CARDS-SPREAD) |
| Done on a step that is not the last | The next step opens on the same page with its one card. The clock shows the new target, holds for 1.2 seconds, then starts without a tap. Done is greyed out during the hold. No landing screen, no button to begin. | Decided (X3) |
| Done on the last step | No card. The summary opens. | Current rule |
| Foreground time passes | The next story card, at y/n, 2y/n ... y minutes (2.14). Nothing is added while paused or away. | Decided (T1, CARDS-SPREAD) |
| The clock reaches 00:00 | No special card. The light vibration. The clock stays at 00:00 until Done. | Decided (CARDS-SPREAD) |
| Pause | No card. The rest page shows his message; the pause number goes to the prompt. | Decided (F1) |
| Back to step on the rest page | No card. The return pop-up (2.9) opens; the start button restarts the clock. | Decided (R1, T6) |
| The user returns after 5 minutes or more away, or taps Continue on Home or in Goals after that time | The return pop-up (2.9). Under 5 minutes: nothing, the clock resumes. | Decided (R1, T9) |
| The user leaves the app | The clock freezes and no card is added, unless the keep-running setting is on. What happens to card timing while the clock keeps running is not specified. | Decided (F2) |
| Done is undone (every Done can be undone) | The step is open again; no new card. How cards already shown in the next step are treated is not specified. | Decided (F3) |

Card count of a step: n, the cards it receives, at least 1 and no upper limit; no card is dropped; the background card is extra (2.14, CARDS-SPREAD).

## 6. Where each content type comes from

"Made ahead" means generated once per story part, checked and published, then read by a person afterwards (decisions SHARED-STORY, PUBLISH-FIRST); every user sees the published version. "Live" means generated for this user at runtime and checked before it is shown. His goal-dialogue lines picked from written lists are authored fixed lines (FIXED-LINES, APP-TEXT), not stored text under NO-BACKUP. Nothing stored ever stands in for a failed live line (NO-BACKUP): after the retries within the time limit, the screen shows the failure message with Retry (FAIL-SCREEN).

| Content type | Source | If generation fails |
|---|---|---|
| Goal conversation lines (GD0 to GD4C) | Authored pools; the goal's shape is decided by a local rule (GOAL-SHAPE-LOCAL) and the model only splits the plan (Decided, T2) | Failure message with Retry |
| Plan: step titles, descriptions and minutes | Live, from the planning prompt (P1) | Failure message with Retry; the typed text is kept |
| Background card | Made ahead, once per story (SHARED-STORY) | If it fails to load: failure screen with Retry; the clock does not start (FAIL-PREMADE) |
| Story cards | Made ahead, once per story part, from the story's facts and key moments (SHARED-STORY, CARDS-PER-PART) | If they fail to load: failure screen with Retry; the clock does not start (FAIL-PREMADE) |
| Closing line | Made ahead with the story's cards (CLOSING-AHEAD); END-TONE applies | If it fails to load: failure screen with Retry on the summary (CLOSING-FAIL) |
| His message on the rest page (snag) | Live, in two calls (C1, F1, PAUSE-3, PAUSE-TWO-CALLS), from the story's scene table (SCENE-PER-STORY) and the category and prop chosen by code; receives the pause number | Failure message with Retry |
| Return pop-up text | Live (T6, R1) | Failure message with Retry |
| Rest chat reply | Live, no message limit (R2, A3); passes the spoiler check (CHAT-SPOILER-CHECK), where a later word the user typed himself does not fail it (CHAT-USER-WORD); no label for the user's message (CHAT-NO-LABEL) | Failure message with Retry |
| Story goal, where-now | Authored from the story database | None needed |
| Safety response | Code plus a small classifier (A5b); system voice | Keyword layer alone if the classifier fails |

Disclosure that the companion is an AI appears only in the terms and the settings; the conversation never mentions it (Decided, A4). If a legal check shows some regions need a clear answer to a direct question, the fallback is one sentence in system voice.

## 7. Checks every line must pass

These apply to every line the companion shows, made ahead or live, unless a row says otherwise. A made-ahead card, background card or closing line that fails cannot be published (LEN-CARD, SHARED-STORY); the output safety check also runs on made-ahead content before publishing (SAFETY-PREMADE). A live line that fails is generated again within the time limit; after that the failure message with Retry is shown and nothing stored stands in (NO-BACKUP, FAIL-SCREEN). Rule ids are the ones used in the check script of the card stack rules.

### 7.1 Per line (failure means the line is not published or not shown)

| Check | Rule |
|---|---|
| First person | The text contains "I", "my" or "me" (rule K01). Capital "I" only; "my", "me" and "mine" are case-insensitive. Fragments without a subject fail. |
| No clock times, dates or ages | No clock times, dates, years, ages or durations (R02, R03; DATES-ADMIN-ONLY). In the goal opener also no time-of-day words. Facts and notebooks in the backend may contain them; lines may not, and dates are never passed to a card prompt. |
| No future facts | "will", "going to" and "'ll" are allowed only inside his own worry or someone else's stated prediction, marked by words such as "says", "thinks", "warned", "forecast", "can't tell", "don't know", "whether", "if", "neither/nor" (K02). "The sky will clear at dawn." fails. "Neither Fermi nor Hubbard can tell me what the sky will do." passes. |
| Leak map | A card may not use words that belong to facts of later parts (K04 for ending words; the leak map for per-fact or per-part words, rule RW8). Also no word from the story's forbid list. Every rest chat reply passes the same spoiler check, against the parts the user has not reached (CHAT-SPOILER-CHECK). |
| Something new | Every card contains something new; a card that repeats earlier information fails (CARD-NEW). |
| No step count | His lines never state the number of steps or how many are left (NO-STEP-COUNT). |
| Length | See the limits table below. |
| No question | No question marks (R01), except the one question in the goal opener and the goal conversation, and at most one question in a rest chat reply (`docs/ai/AI_04_rest-chat.md` section B). |
| Not addressed to the user | No "you" (R04), except in the goal conversation and the rest chat reply, which answers the user (`docs/ai/AI_06_check-and-fallback.md` section 4). |
| No hooks | None of: more, later, tomorrow, soon, continue, find out, next (R06; "next to" is allowed). |
| No praise, no talk about absence, no source notes, no behind-the-scenes words | R07 to R10. The return pop-up is exempt from the absence rule, because he says what he did during the time away (Decided, T6). |
| Form | No dashes, no exclamation marks or emoji, no links, ends with a full stop (a rest chat reply may end on its question instead, decision CHAT-QUESTION-END), never names himself (R11 to R15). |
| Warnings only | "we" and "us" (R05 is a warning for cards because he talks about himself and the people around him), words about other people's pronouns (R20), time-of-day words (R22). These are waived card by card in the current data. |

### 7.2 Length limits

| Line | Limit |
|---|---|
| Step story card; SIT, EVM, WRY, DOI, NTC | 1 to 3 sentences, at most 45 words; over the limit cannot be published (LEN-CARD, 2026-11-15) |
| Return pop-up text | 1 or 2 sentences, at most 30 words (LEN-RETURN) |
| Background card | At most 70 words, no sentence limit; over the limit cannot be published (LEN-CARD) |
| His message on the rest page (obstacle) | 1 or 2 sentences, at most 30 words (LEN-PAUSE, 2026-11-15) |
| Opening of the goal conversation | 2 sentences, 30 words, one question and it comes last |
| Step lines `current`, `done`, `plan` | At most 10 words, first person |
| `key_line` | At most 18 words |
| `bridge` | At most 10 words |
| End-of-story feeling line (closing line) | 1 to 3 sentences, at most 45 words, first person, no "you", no numbers or durations; over the limit cannot be published (LEN-CARD, CLOSING-AHEAD) |
| Rest chat reply | 1 to 3 sentences (deflections: 1 to 2) |

Decision LEN-PAUSE (2026-11-15) replaces the AI specification's stricter limit for model-written snags (at most 20 words and 2 sentences). Decision LEN-RETURN (2026-11-17) sets the return pop-up limit and replaces the AI specification's 14 words. When two limits apply, use the stricter one, except where a decision settles it.

### 7.3 Per row and per run (cards of one step, and neighbouring steps)

These apply to one-way lines. Rest chat replies answer the user and are not checked against the per-run list of earlier one-way lines (CHAT-NO-RUN-LIST).

| Check | Rule |
|---|---|
| Start and size (RW1) | A step opens with exactly one card and gets at least one new card; no card is ever dropped (CARDS-SPREAD). The background card is not counted. |
| Order (RW2) | Cards follow the story's order within their part. In the authored reference chains: WRY, then DOI, then NTC. |
| Connected (RW3) | Each card connects to the one before: shares a content word or uses so, because, but, which. |
| No forward reference (RW4) | A card never depends on a later card, so any prefix of the row is complete. |
| No repetition (RW6) | No two cards of a row overlap by half their words or repeat a sentence. |
| Consistency (RW7, RN1) | Optional state tags change in one direction only along a row and a run. No such tags exist now, because there are no weather or light scales (SCENE-PER-STORY); the rule applies only if one is added. |
| No spoilers by part (RW8) | A card of part p may not contain terms of later parts. |
| No echo between steps (RN2, RN3) | The same sentence never appears in two rows; the first card of the next row continues rather than repeats the last card of the previous row. |
| Self-contained | No "again", "another", "as I said", "the same" pointing at another card, because a card may be reread on its own. |
| No introduction after the background card (M2, US-FMT-11) | Only the background card introduces the people present. A story card may not carry an introduction phrase: "my name is", "I am J. Robert Oppenheimer", "I'm J. Robert Oppenheimer", "let me introduce", "allow me to introduce". The admin check lists the phrase and blocks Publish. |

### 7.4 Snag and return pop-up rules

- Use only the props listed for the scene, and every declared prop must appear in the obstacle text.
- No new named person; only names in `allowed_names`.
- ~~No move on a one-way scale (rain, wind, sky). Words like cleared, eased, died down, worse, better are blocked.~~ Withdrawn: there are no weather or light scales (SCENE-PER-STORY).
- No event verbs (arrives, comes, says, tells, asks, decides, finds, loses, breaks and similar) and no new objects.
- The resolution restores the situation as it was.
- No fact of a later part; no forbid term.
- No repetition inside one step; two snags in a row never share a family. Pauses are unlimited, so this must hold for many pauses.
- The return pop-up has no blame aimed at the user, no clock time, no hook and no news that moves the story beyond the step's parts. There is no rule about whether he waits (Decided, H8).
- From the third pause the stuck situation is much harder and he says he is worried he may fail. The message is never an instruction to the user and never asks the user to stop pausing (PAUSE-3).

### 7.5 Checks by hand

The script cannot judge cause and effect or voice. Each row needs a person to: read it forwards ("is each card the consequence of the one before?"), read it backwards, cut it after every card and see whether any card refers to something later, give it to a stranger and ask what happened and why he worries, and compare it with the previous row for echo. No row has had this reading yet. A script check passing never counts as this reading; only Yue, or a person Yue names, sets "read by a person". This reading happens after publishing and is not a gate (READ-STATUS, PUBLISH-FIRST).

### 7.6 Current check results

The Trinity chain pool (135 cards, 21 rows, 3 runs) passes the script with no failures and no warnings. The `site-search` cards (41) pass the failure rules using temporarily widened length limits. The Trinity snag sample (8 snags) passes with no failures. The card stack version 3 proposals are not adopted; pacing is decided in section 5. No made-ahead cards have been run through the script yet.

## 8. Relational schema for Supabase

The tables that exist are defined in `supabase/migrations/`; where this section and a migration differ, the migration is the source. The rest is a proposal, not a decision. It follows the entities above. Content tables are filled from the JSON files and the story database and are read-only for users. User tables hold the user's own text and are tied to the account (Decided, S3). An account is required from the first open (Decided, ACC), so there is no anonymous use: every user table carries `user_id` and uses row-level security so that a signed-in user can read and write only their own rows. Deleting the account deletes these rows (a privacy notice and account deletion are required). Types are Postgres types.

### 8.1 Content tables

Since issue #284 the story content is in the database (`supabase/migrations/20261119000000_story_content.sql`, `docs/decisions/0019`):

- `public.companions`: the Companion's display fields. Signed-in users may read them.
- `public.stories`: each story's display fields (`title`, `period`, `goal_short`, `who`, `opening`). Signed-in users may read them.
- `public.story_inputs`: the model-only inputs (facts, forbidden terms, key moments stored unconfirmed, the other stage 0 inputs) and the writers' `date` and `provenance`. No user reads it; the server reads it through `get_story_content`, which never returns `date` (DATES-ADMIN-ONLY).

Stored made-ahead cards, the background card and the closing line are issue #293 and have no table yet. There are no fallback tables (NO-FALLBACK-TABLES). The tables below are still proposals and not built:

```
leak_terms(story_id text, fact_seq integer, term text)     -- from the leak map; per fact or per part

scenes(                               -- one per story (SCENE-PER-STORY); no entry slices, no scales
  story_id text primary key,
  present text[], allowed_names text[], props text[],
  pause_prop text, later_words text[]
)

snags(                                 -- authored reference samples only; never shown (C1, NO-BACKUP)
  id text primary key, story_id text, scene_id text,
  family text, props text[], valid_from_slice text,
  obstacle text, ret_line text, ret_short text, ret_long text,
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
```

### 8.2 User tables

These tables exist (`supabase/migrations/20261106000000_create_user_data_schema.sql`, `20261106120000_save_server_progress.sql`); `safety_events` is still a proposal.

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

Story cards, the background card and the closing line are made ahead once per story part and published, then read by a person (SHARED-STORY, CARDS-PER-PART, CLOSING-AHEAD, PUBLISH-FIRST). A story therefore needs its facts, parts and key moments, then its made-ahead cards; the live parts (pause message, return pop-up, rest chat) need generator inputs. Authored cards are reference examples and evaluation material only (NO-FALLBACK-TABLES). The table shows what exists.

| Content | Chapter 8, "The Canyon and the Mesa" (`site-search`) | The Trinity night, chapter 13 (`trinity`) | Chapter 1, "The Trade of a Theorist" (`bohr-difficulties`) | Other Oppenheimer chapters |
|---|---|---|---|---|
| Story database entry (facts, goal, background) | Yes | Yes | Yes (5 database tasks; date is a placeholder) | Yes, all 26 |
| Key moments (2 to 4) and key lines | Machine-derived, unconfirmed (KEY-UNCONFIRMED); s4, s6, s8 proposed earlier | Machine-derived, unconfirmed; s4, s6 proposed earlier | Machine-derived, unconfirmed | Machine-derived, unconfirmed |
| Made-ahead cards, background card and closing line, published (and read afterwards, PUBLISH-FIRST) | None | None | None | None |
| Slices (reference only) | 8 slices | 7 slices | No | No (24 of 26 have none) |
| Authored reference cards | 41 cards, older shape | 135 cards: 21 rows of chain cards plus 30 return cards, current shape | None | None |
| Step lines and where-now | Yes, all 8 slices | The older pool has 22 such records (type HIS); not in the new shape | None | None |
| `who_i_am` | Yes | Yes | Yes | Yes, all 26 |
| Goal opener | One | Three | One | One each |
| Snags (reference samples) | None | Sample for s4 only (8); the older pool has 15 pause items | None | None |
| Closing lines (reference) | None (two drafts exist only in the AI specification) | 4 (smooth 2, rough 2) plus a hanging line; the smooth and rough moods are superseded (END-TONE) | None | None |
| Leak map | No separate file (forbid list and a checking script) | Yes (7 slices) | None | None |
| Scene table (generator input) | None | One scene (s4) in the sample | None | None |

Decision M1 (2026-11-05): new users start at chapter 1, with no designated entry story. Chapter 1 needs its made-ahead cards, background card and closing line, published (and read afterwards, PUBLISH-FIRST), its reviewed key moments, and the generator inputs for the live parts (scene table, allowed props, allowed names, rules). The authored reference cards cover chapter 8 and the Trinity night only. Any demo for the first test must say which chapter it uses.

Other missing pieces:

- The real planning prompt (open, P1). The text in `docs/ai/AI_01` is a placeholder. Yue will supply the file (2026-11-21).
- The review of the key moments and their first-person key lines for every story (KEY-REVIEW).
- The parts (2 to 5) and the made-ahead cards, background card and closing line of every story, with their read status (STORY-PARTS, READ-STATUS). Stored cards are issue #293.
- Generator inputs for all 26 stories: scene tables (drafted, one per story, in `docs/demo/*.stage0.json`, SCENE-PER-STORY; no app code reads them yet), allowed props, allowed names and rules, and the leak words per fact.
- The named periods of each Life Path (PERIOD-NAMES).
- Moriarty's data and his world record (FICTION-RULES); Yue's reading of the 31 cards of his story 1 (MORIARTY-READ). The other six characters of the older product are out of scope for Release 1 (OTHER-COMPANIONS).

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

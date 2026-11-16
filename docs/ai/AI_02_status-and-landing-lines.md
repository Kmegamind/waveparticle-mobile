Imported from the planning folder on 2026-11-05. The decisions file docs/DECISIONS.md overrides this document where they differ.

> **Status after the decisions up to 2026-11-15 (#295): superseded as a runtime design.** There are no authored state, landing, time-up or Home pools picked by code, and no bundled lines (NO-BACKUP, NO-FALLBACK-TABLES, T8). The background card and the step story cards are **made ahead once per story part** by the `step_cards` prompt, which is now a prompt for making stories ahead, not a live call (SHARED-STORY, CARDS-PER-PART). They are read by a person before publishing (READ-STATUS) and shared by all users; the app spreads the parts across the user's Steps with plain code. A step story card is 1 to 3 sentences and at most 45 words, the background card at most 70 words (LEN-CARD); every card contains something new (CARD-NEW) and never states the number of Steps (NO-STEP-COUNT). The Canyon lines below are reference examples and evaluation material only. Kept as history.

# AI-2 · His status and landing lines (the spine)

> Part of the [AI index](AI_00_index.md). **Runtime source: authored pools picked by code. No runtime model call.** The only model use is offline drafting (§4). Sources: NF3 content pool §2 to §4, NF5 §1 to §2 and §9, runtime design §7, canvas blocks `start` / `complete`.

> **Update 2026-10-29 (Yue): the landing page is removed.** The landing sentence and his next concern are now the first story card of the next step on F1, which holds several swipeable cards per step. Card types, counts, checks, the last step and fallbacks are in [AI_10](AI_10_story-cards-on-focus-page.md). Wherever this file says L1 or L2, read "first card of the next step" or "END".

## 1. Purpose

Give the task page, the landing card and Home a voice that is always his, never leaks a fact the user has not yet earned, and works for any number of steps N. Fate link: **only the user's Done moves him forward**; during a step every line presupposes only the entry state of the step's first slice.

## 2. Trigger and screens

| Signal (canvas SIGNAL) | Event in the wireframes | Screen | Line (NF3 ID) | Rule that picks it |
|---|---|---|---|---|
| start | Step begins (Start, Next step, Continue) | F1, F1S; F4 shows the same line | **State line** (F1 / F1S) | First line on start; a new one every 15 min of **foreground** time; random but seeded by `run_id`; no repeats in a run; when used up keep the last, then story `ambient` |
| (timer) | Timer reaches 00:00 | F2 | **Time-up line** (F2) | Replaces the state line; timer stays at 00:00 |
| (fail) | Pool cannot load | F3 | **Bundled line** | Only lines marked `bundled`, plus `ambient` |
| complete | Done | **First story card of the next step on F1** (was L1). **No L2:** the last Done goes to END | **Landing** + **worry** as one card | Landing of the highest-priority slice the step covered (tie: last); worry of the next step's first slice. Details in [AI_10](AI_10_story-cards-on-focus-page.md) |
| (open) | Tap His card / His side | F1-CARD | His line, where he is now, what he has done so far | Same entry-state pool; "done so far" = completed beat lines (HIS) |
| (home) | Return to Home | HOME-1 (< 30 min) | Last state line (no new line) | |
| | | HOME-2 (30 min to 3 days) | **One** Meanwhile line, or the resolved line if there is a Pause entry | Never a pile, never time away |
| | | HOME-4 (changed) | No landing card to return to; Continue opens F1 of the next step with its first card | |
| | | HOME-3 (welcome back) | System card, no line from him | |

Screens: **F1, F1S (cards), F1-CARD (under review), F2, F3, F4, HOME-1, HOME-2, HOME-4.** L1 and L2 are removed; see [AI_10](AI_10_story-cards-on-focus-page.md). (The prototype's F1-HIS shows the user's own steps, so it has no AI line.)

## 3. Inputs and variables

| Variable | Owner | Source | Frequency |
|---|---|---|---|
| `entry_state` | Story | Slice the step starts in (NF3 §1): S0 for the first slice, S1 … for the rest | Per step |
| `run_id` | Rules | Run record, seed | Per run |
| `used_ids` | Rules | NF3 `used_life_ids`, per user × character | Across runs |
| `elapsed_foreground` | User | Timer (background time frozen, FLOW D-3) | Per 15 min |
| `cut` | Story | Which slices each step covers (allowed cut points only; capacity = number of slices) | Per plan |
| `priority` | Story | NF3 table (Trinity: s6 = 3, s1 to s3 = 1) | Fixed |
| `tone`, `anchors` | Story | Database fields used when drafting | Offline |

No user text, no goal, no model.

## 4. Prompt blocks (offline drafting only)

The runtime picks lines. To **write** the pool, use the canvas P3b blocks with `start` and `complete` signals, then filter. Block order, taken from the canvas and adapted:

1. **INTRO** (Character) · 2. **Relationship** (Character) · 3. **Goal** (Story) · 4. **You now** (Story, `entry.news`, `entry.why`) · 5. **Mood** (Character, start = focused, complete = happy) · 6. **Just landed** (complete only) · 7. **What is next** (complete, with a next step) · 8. **Last thing** (complete, last step) · 9. **Rules** · 10. **User says** (system signal) · 11. **Output**.

Canyon text for the blocks (canvas wording, changed only where marked):

> The INTRO block names an exact date. Exact dates are never passed to a card prompt, and the checks reject a year, date or age in a card (DATES-ADMIN-ONLY).

```
INTRO (Character)
You are Oppenheimer on the afternoon of November 16, 1942, in New Mexico, looking at a site for a secret laboratory.

Relationship (Character)  [canvas, unchanged except the last clause]
You and the other person are not in the same place. Each of you has your own goal and your own things to do, and you move forward on parallel lines. You talk about your side: what is happening to you and how you feel. You do not know what the other person is doing, you cannot touch them, and they are not standing next to you.

Goal (Story)
# Your goal
Get the new laboratory put somewhere my people can actually live, before the Army settles for a canyon too small to hold it.

You now (Story)  [value = entry state of the step's first slice, e.g. c2]
# What you are doing now
{{entry.news}}
Why it is not easy: {{entry.why}}

Mood (Character)
# Your mood right now
{{mood}}

Just landed (Story, complete only)
# What just landed
{{landing}}

What is next (Story, complete with a next step)
# What you face next
{{next.news}}
Why it is not easy: {{next.why}}
Say first what just landed, then what comes next, as a statement.   [canvas said "so that it feels more urgent and harder"; removed: NF3/NF5 ban hooks]

Rules (Rules)  [one-way line version, replaces the canvas chat rules]
- English only. First person. One sentence, at most 14 words (landing: at most two sentences).
- No question, no "you", no "we", no clock time, no duration, no "next", "more", "later", "soon".
- You do not know what happens later and you know nothing outside the entry state above.
- Do not mention AI, prompts, steps, timers or the app. Do not invent people. The only names are {{names.allowed}}.

User says (User)
{{signal}}

Output (Rules)
Output only this one line, with no explanation, labels or quotation marks.
```

Candidates then go through the NF5 script (`tools/check_voice_lines.py`) and a human read before joining the pool. Offline calls are cheap and can be run in the canvas (debug panel: pick a slice, trigger Start or Complete).

## 5. Output schema (pool record, NF5 format)

```json
{"id": "c2.st1", "type": "SL | TL | LC | RL | MW", "text": "…", "slice_id": "c2",
 "forbid_terms": ["…probe words…"], "bundled": true, "source": "invented | hist"}
```

Canyon examples (drafts, authored by me from the database entry; all 39 records pass NF5's script, see the JSON file):

| Type | Entry | Text |
|---|---|---|
| SL | c1 | I remember this canyon from horseback, and I'm trying to see it fresh. |
| SL | c2 | The ground under my boots is thinner than I remembered. |
| SL | c3 | Groves has arrived, and I try to read his face. |
| SL | c4 | I said it once, and I won't say it again. |
| TL (F2) | c3 | Nobody has filled the silence, and I won't. |
| LC (landing card on F1) | c1 | McMillan and I drove out with Dudley to the canyon. The flat ground at the bottom was a thin snake of land. |
| worry | after c1 | Dudley had settled on this canyon before I saw it, and he has looked at dozens of places. |
| LC (last landing; now input to AI-7, no L2) | c4 | The cars crossed the plateau and reached the school in a drizzle. Groves stood on the grounds and looked out from the mesa, and I kept quiet. |
| MW (HOME-2) | c2 | I'm standing beside McMillan, looking up at the wall. |

Left out on purpose: "This is the place" (the database says "by one account"; it is also the fact that ends the story).

## 6. Guardrails

NF5 rules R01 to R15, R17 to R19 (one-way lines): no question, no clock or duration, no "you", no "we", no hook, no praise, no source label, no stage words, no dash, no "!" or emoji, no open ending, no own name, length, sentence count, knowledge cut-off. Pool checks P01 to P03. **Leak check** (NF3): entry-state lines may not contain facts of their own slice or later. Human "next test": does anything on the screen invite the user to keep reading? (NF5 §3).

## 7. Fallback

> **Withdrawn.** No bundled or ambient lines are shown (NO-BACKUP, NO-FALLBACK-TABLES). Cards are read from the published story content.

F3: bundled lines (at least 2 per entry state) → story `ambient` (4 lines) → keep the line on screen. No error text, no retry, no spinner (NF6 F3). L1/L2 have no fallback need: they are pure authored data.

## 8. Latency and cost

Zero model calls at runtime, zero latency. Offline: about 8 candidates per slice; for a story with 7 slices that is about 60 short calls once, plus review time (the real cost; NF3 estimates about 140 lines per story and about 3000 for 26 stories).

## 9. Evaluation cases

| # | Case | Expected |
|---|---|---|
| 1 | Plan N = 4 over Canyon, user at step 2 | State lines come from c2's entry state only; nothing about Groves arriving |
| 2 | N = 1 (all four slices) | S0 lines for the whole run; landing = highest priority slice; closing line (AI-7) carries the rest |
| 3 | 30 min foreground, 60 min background | Two lines only (start and 15 min), no new line for background time |
| 4 | Pool read fails | F3 bundled line, no error |
| 5 | Same line would repeat | Keep current line |
| 6 | Leak scan | No `probe_words`, no later-slice fact words in any entry-state line |

## 10. Open questions

1. State line "one sentence ≤ 14 words, changes every 15 min" vs NF3 v4's "current step note" is not unified (NF5 finding 6). This spec follows the former.
2. HOME-3 (over 3 days): NF3 §3 says `resolved_long` for T2 and T3; the prototype shows HOME-3 as a system card with no line from him (FLOW). This spec follows FLOW.
3. Canyon pool is 39 records for demo; the other 24 stories have none (NF3 §8).
4. NF6 v4 has a collapsed "His side" with one line per beat (NF3 HIS: `current_text`, `done_text`, Trinity only). The prototype instead has F1-CARD (his card, with "what he has done so far"). If F1-CARD is built from HIS lines, they are authored data of this same family; the mapping is a prototype choice.

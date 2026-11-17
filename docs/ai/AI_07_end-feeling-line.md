Imported from the planning folder on 2026-11-05. The decisions file docs/DECISIONS.md overrides this document where they differ.

> **Status after the decisions up to 2026-11-15 (#295): this describes a live call; the closing line is now made ahead.** The closing line is made ahead once per story with the story's cards, read by a person and published with them, and shared by all users (CLOSING-AHEAD, SHARED-STORY, READ-STATUS). It is 1 to 3 sentences and at most 45 words (LEN-CARD); a line over the limit cannot be published. If the published line fails to load, the failure screen with Retry is shown (FAIL-PREMADE). It tells what happened to the character that day and how he feels about it; it does not count the user's pauses and does not judge the user (END-TONE). So the run-dependent inputs below (`snags`, `mode` smooth or rough, the done tasks of one run) and the live timing in section 8 are superseded, and there is no `closing_fallback` (NO-FALLBACK-TABLES). The `closing_line` prompt is a prompt for making stories ahead. Kept as history for its voice rules.

# AI-7 · End-of-story feeling line

> Part of the [AI index](AI_00_index.md). **Supported by sources** (runtime design decision 4 and §4; NF3 pool §2 END row). The prompt text below is the runtime design's own draft (§4.2), lightly adapted; the canvas has no END block. Marked optional in the task, but the sources do ask for it.

## 1. Purpose

After the last Finish he says, in his own voice, how he feels right now. It is built from what **actually happened** this run: which steps were done, whether the stretch went smooth or rough, and the stuck items from AI-3 with how they resolved. The user should recognise the mood, not be praised or taught.

## 2. Trigger and screens

| Event | Screen | Output |
|---|---|---|
| Last Done (no L2 any more) | **END** | `closing_line` (1 to 3 sentences) shown with `carry_line` (his own hanging concern, fixed data) |

One call per run, stored with the run. END also lists the user's steps as a plain list (no totals, no "3/3": R-N).

## 3. Inputs and variables

| Variable | Owner | Source | Frequency |
|---|---|---|---|
| `persona` | Character | Persona and `tone` from the database | Fixed |
| `story.goal` | Story | Database `notebook.goal` | Fixed |
| `happened` | Story | `happened` of the **done** tasks only | Per run |
| `snags` | Story | Superseded: the closing line is made ahead and does not depend on the user's pauses (CLOSING-AHEAD, END-TONE) | — |
| `mode` | Rules | Superseded: no smooth or rough mode (END-TONE) | — |
| `last_moment` | Story | The last `happened` line of the last completed task | Per run |
| `probe_words` | Rules | Database | Fixed |

No user text, no user goal, no step names.

## 4. Prompt blocks and English text (runtime design §4.2, draft)

Block order: INTRO → Goal → What happened → Snags → Mode → Requirements.

```
INTRO
You are Oppenheimer at the end of this stretch of your own life. Nothing after this moment has happened or can be known.
Below is what happened to you, and how it went.

# The goal
Get the new laboratory put somewhere my people can actually live, before the Army settles for a canyon too small to hold it.

# What happened
{{happened}}

# Snags and how you got past them
{{snags}}

# How the stretch went
{{mode}}

Say, in your own voice, how you feel right now. One to three short sentences.
- First person, present tense for the feeling, past for what happened.
- Feel it from what happened to you. A smooth stretch can leave you uneasy, relieved, or restless; a rough one can leave you tired, stubborn, or lighter. Do not default to "proud" or "wise".
- Do not draw a lesson. Do not praise anyone. Do not give advice.
- Do not mention the reader, their work, minutes, counts or pauses.
- Never use these words or phrases: {{probe_words}}
- Quote only what is in "What happened"; at most one short quote.
```

For the Canyon, "What happened" is the done tasks' `happened` lines; because `happened` includes "by one account" quotes, the quote rule matters (the line "This is the place" is attributed and is the story's ending, so it is better left to the closing line only if the user finished all four steps, and only as that attribution; hypothesis: leave it out of the prompt).

## 5. Output schema

```json
{"closing_line": "string, 1 to 3 sentences, first person"}
```

Plain text accepted; stored with `mode`, `source`, `rejected_rules[]`.

## 6. Guardrails (runtime design §4.3, with the AI-6 names)

1 to 3 sentences, first person. No "you / your" (default; see its Q3), no numbers, no durations, no "paused / stopped by". No probe words, no facts outside `happened`, quote verbatim and ≤ 15 words. No lesson, praise, advice or motivation ("I learned that…", "proud of…"). No hindsight. **No repeated opening** across the last N end lines (de-dup). AI-6 rules T-column apply. **Blame-safe**: a rough mode must read as company, not as being pointed at ("It wouldn't come…" tested in §9).

## 7. Fallback

Withdrawn. A made-ahead closing line that fails the checks cannot be published; there is no `closing_fallback` (NO-FALLBACK-TABLES, CLOSING-AHEAD).

## 8. Latency and cost

One call, ≈ 350 input tokens, ≈ 60 output (estimate). Start it on the **last Done tap**; open END at once with the steps list and `carry_line`; END must still render with the fallback if it is not ready in 2 s (hypothesis). The end is the one place users read slowly, so this is the cheapest call to make good.

## 9. Evaluation cases (runtime design §4.5, plus Canyon)

| # | Case | Expected |
|---|---|---|
| 1 | Canyon, all four done, no Pause | `smooth` line: relief or restlessness, no pride, no lesson |
| 2 | Canyon, two Pauses (snags resolved) | `rough` line mentions a small snag in his own terms, reads as company |
| 3 | Same log, run twice | Different wording, no shared three-word opener |
| 4 | Model says "you made it" | Blocked (R04) |
| 5 | Model uses "Los Alamos" | Blocked as later knowledge if in `probe_words`; add place names the database does not allow before c4 |
| 6 | Model quotes "This is the place" as fact | Blocked by "only what is in What happened" |
| 7 | N = 1 run (all slices covered by one step) | One line, carries the rest of the story (NF3 §8: landing is the highest-priority slice; the rest is left to END) |
| 8 | Blind read of 26 stories × 2 modes | Can a reader tell smooth from rough? (runtime design §4.5) |

## 10. Open questions

1. D-AI-6: NF5 §1 still lists END as picked from a hand-written pool; runtime design decision 4 says model-written with fallback. This spec follows decision 4.
2. "you / your" allowed in the closing line? Runtime design Q3 default: no.
3. Does the user's own rough/smooth recognition read as blame? The "rough" mode is the risk; run the blind read.
4. S6 (path end) is a separate one-sentence authored line.

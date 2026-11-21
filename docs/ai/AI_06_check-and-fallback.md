Imported from the planning folder on 2026-11-05. The decisions file docs/DECISIONS.md overrides this document where they differ.

> **Status after the decisions up to 2026-11-15 (#295).** The file name says "fallback" for history only: **there is no fallback ladder.** No stored or pre-written text ever stands in for a failed or slow live message (NO-BACKUP, NO-FALLBACK-TABLES).
> - **Live outputs** (the goal split, the pause message, the rest reply, the return pop-up): parse, clean, check; a failing output is generated again with the failure reason within the time limit; if it still fails, the app shows one calm message in its own voice, for example "He is not here right now. Please try again.", with Retry, and the step clock does not start (FAIL-SCREEN). The time limit and the wording are set by testing (TIME-LIMIT).
> - **Made-ahead outputs** (the background card, the step story cards, the closing line): the same checks run before publishing; a card that fails or is over its length limit cannot be published; a person reads it after publishing, not before (SHARED-STORY, CLOSING-AHEAD, LEN-CARD, PUBLISH-FIRST). The checks run when the content is made and before publishing; the spoiler check is against the parts after the card's own part (LEAK-BY-PART), and the output safety check runs too (SAFETY-PREMADE). If published cards or the closing line fail to load, the app shows the failure screen with Retry and the clock does not start (FAIL-PREMADE).
> - Section 5 (fallback ladder) is withdrawn; section 4 is updated for the decided lengths and checks.

# AI-6 · Check and fallback pipeline

> Part of the [AI index](AI_00_index.md). Sources: canvas "Output check" node and rules page (10 rules, retry once, backup), NF5 v1.1 §2 (R01 to R22, P01 to P03), NF3 pool checks, runtime design §4.3. This is code, not a model. It owns the fallback ladder for AI-1, 3, 4, 7.

## 1. Purpose

Nothing a model writes reaches the screen until it has been parsed, cleaned and checked against written rules. A failing live line is generated again within the time limit and otherwise replaced by the app's failure message, never by an authored line (NO-BACKUP, FAIL-SCREEN); a failing made-ahead line cannot be published. The pipeline must be the same for every model-written line so a rule fixed once is fixed everywhere.

## 2. Trigger and screens

Runs after every model call in AI-1b (plan only), AI-3 (R1, R2), AI-4 (C1), AI-7 (END). No screen of its own. Failures never show error text on F1/F1S (NF6 F3), and the rest/END screens show the fallback line as if it were the normal one.

## 3. Pipeline (canvas behaviour, made explicit)

```
generate → parse → clean → rules → [hit with level "retry"?] → generate again with the failure reason, within the time limit → rules → still hit / parse fail / error / timeout → failure message with Retry (live) or not publishable (made ahead) → log
```

| Step | Detail | Canvas reference |
|---|---|---|
| parse | JSON outputs (AI-1, AI-3, AI-7 if JSON): first `{ … }`, must contain the required key. Plain text (AI-4): as is | `parseCard` |
| clean | Strip wrapping quotes and a leading "Oppenheimer:", curly apostrophes → straight | `clean()` |
| rules | Each enabled rule that applies to this AI-n (see §4). Level `retry` blocks, `warn` is logged only | `runChecks`, severity |
| retry | **Once**. No loop. Same prompt (no extra "don't do X" appended) | `tries < 2` |
| failure | Live: the failure message with Retry (FAIL-SCREEN). Made ahead: not publishable | (canvas backup replies are not used, NO-BACKUP) |
| log | `source = model/authored`, `rejected_rules[]` (IDs only), latency. **Never** raw user text | NF3/NF6 logging |

## 4. Rules: canvas ID ↔ NF5 ID ↔ where it applies

Canvas rules are the ten in `DEFAULT_RULES`; NF5 rules are R01 to R22. They overlap but are not identical. This table is the merge. Applies to: **T** = AI-3 his one-way line (R1/R2), **C** = AI-4 chat reply, **E** = AI-7 end line, **L** = AI-2 authored pool (checked offline, not at runtime), **S** = AI-1 step names.

| Rule | Canvas ID | NF5 ID | Meaning | T | C | E | L | S |
|---|---|---|---|---|---|---|---|---|
| Too long | `len` | R17, R18 | Decided limits: step story card 1 to 3 sentences and at most 45 words; background card at most 70 words; closing line 1 to 3 sentences and at most 45 words (LEN-CARD); pause message 1 or 2 sentences and at most 30 words (LEN-PAUSE). Older canvas and NF5 limits are replaced | ✔ | ✔ | ✔ | ✔ | name ≤ 80 chars |
| Non-English | `cjk` | (language auto-detect) | Any Chinese character in an English line. English only (L1) | ✔ | ✔ | ✔ | ✔ | — |
| Dash | `dash` | R11 | `—`, `–`, `--` | ✔ | ✔ | ✔ | ✔ | — |
| Banned words | `ban` | — (NF3 taboo list) | bro, vibes, no cap, "as an AI". Per character list | ✔ | ✔ | ✔ | ✔ | — |
| Clock time, duration | `clock` | R02, R03 | Digits with ":", a.m./p.m., o'clock, "half past", "(ten) minutes". Canvas exempts "5:30" for Trinity; **the Canyon has no exemption** | ✔ | ✔ | ✔ | ✔ | — |
| Backstage words | `back` | R10 (R09 for source labels) | segment, slice, director, prompt, texture, storyline, plot beat, "next/previous/last/this part/stage". NF5 adds step, session, timer, app, screen, scene, chapter, task, user | ✔ | ✔ | ✔ | ✔ | — |
| Ordering or advising | `cmd` | R16 (WARN), NF3 G07 | "you should", "let's", "take a break", "close your eyes", "hang on", "it'll pass". **Easiest to over-block** | — (no "you") | ✔ | ✔ | ✔ | — |
| Invented people | `inv` | — | Canvas: deny list (Leslie, Tom, John, Jack, Mary). **Weak.** Replace with the **name gate**: allow only `names.allowed` for the entry state | ✔ | ✔ | ✔ | ✔ | — |
| Later knowledge | `know` | R19 | Story `probe_words` appear and the user did not write them. Canvas: Trinity list; Canyon: database list | ✔ | ✔ | ✔ | ✔ | — |
| Blaming | `blame` | R08 | "you again", "finally came back", "welcome back", "while you were away". Canvas: only on resume | ✔ | ✔ | ✔ | ✔ | — |
| **Missing in canvas, in NF5** | | | | | | | | |
| No question | — | R01 | One-way lines have none. A rest reply may end on its one question (CHAT-QUESTION-END) | ✔ | at most one | ✔ | ✔ | — |
| Not to the user | — | R04, R05 | No you / we in one-way lines | ✔ | — | ✔ (default) | ✔ | — |
| No hook | — | R06 | next, more, later, soon, tomorrow, "find out" | ✔ | ✔ (hypothesis) | ✔ | ✔ | — |
| No praise, coaching | — | R07 | great, well done, proud, streak | ✔ | ✔ | ✔ | ✔ | — |
| No "!" or emoji, no link | — | R12, R13 | | ✔ | ✔ | ✔ | ✔ | — |
| No open ending | — | R14 | Must end with a full stop | ✔ | ✔ | ✔ | ✔ | — |
| No own name | — | R15 | He never says "Oppenheimer" or "Robert" | ✔ | ✔ | ✔ | ✔ | — |
| Pool duplicates | — | P01 to P03 | Exact, near (≥ 70%), same three-word opener ≥ 3 times | — | — | repeated-opener check | ✔ | — |
| Not a repeat in this run | — | NF3 `used_ids` | Rest replies are not checked against this list (CHAT-NO-RUN-LIST) | ✔ | — | — | — | — |
| **Added by the decisions** | | | | | | | | |
| No year, date or age | — | — | Cards reject a year, a date or an age (DATES-ADMIN-ONLY) | ✔ | — | ✔ | ✔ | — |
| No step count | — | — | Never the number of Steps or how many are left (NO-STEP-COUNT) | ✔ | ✔ | ✔ | ✔ | — |
| Something new | — | — | A card that repeats earlier information fails (CARD-NEW) | — | — | — | ✔ | — |
| Spoiler | — | — | Rest replies pass the same spoiler check as the story cards, against the parts the user has not reached (CHAT-SPOILER-CHECK) | — | ✔ | — | — | — |

The canvas's check rules page already supports editing patterns, a strip list, a level, and a "test field". **Add the NF5-only rows there** (hypothesis for the next canvas version) so one page tests everything.

## 5. Fallback ladder by AI

> **Withdrawn** (NO-BACKUP, FAIL-SCREEN, NO-FALLBACK-TABLES). Every authored or bundled entry in this table is gone; only the goal split's failure screen with "Try again" and the one-step plan built in code remain. Kept as history.

| AI | Model fails or hits twice | Final fallback | Never |
|---|---|---|---|
| AI-1b | GD-F (system voice, text kept, Try again / Start with one step) | One-step plan built in code | Silent generic steps |
| AI-1a | `unknown` → authored `confirm_goal` | — | |
| AI-3 | Authored obstacle / return pair for the entry state (≥ 2 per state; not used before in the run) | Last pair kept | The original time-slice text (canvas fallback) |
| AI-4 | `rest_chat_fallback` (6, not written) | Same line allowed once; then the ending | Canvas backup lines with `*stage directions*` |
| AI-4 end | `rest_chat_endings` (4, not written) | | |
| AI-7 | `closing_fallback.smooth` or `.rough` (story level, 2 each) | | |
| AI-2 | (no model) bundled lines, then `ambient` | Keep current line | Error or retry UI |

## 6. What the stored canvas corpus says (my Python port of the canvas regexes; not the canvas run)

I ported the canvas rule patterns to Python and ran them over the 128 stored lines in the canvas's `CORPUS` (two sets of 64 Trinity candidates). Length, language and "later knowledge" use the canvas definitions; `blame` is resume-only and excluded. **A JavaScript-to-Python port can differ at the edges; confirm in the canvas's own Check rules page.**

| Set | Lines | Blocked by any "retry" rule | By rule |
|---|---|---|---|
| R11 candidates | 64 | **19 (30%)** | Ordering or advising 19 |
| E4 candidates | 64 | 11 (17%) | Ordering or advising 8, Too long 2, Clock time 1 |

Reading: the one rule that does the blocking is the advising rule, and in the R11 set it sits exactly at the 30% line the canvas marks yellow. Its patterns include phrases that are not orders ("let's", "hang on", "tell me first", "nod"), so the next check-rule iteration should split it into **orders to the user** (block) and **soft phrases** (warn), and measure again on Canyon chat runs.

## 7. Latency and cost

Pure code, under 10 ms per line. A retry costs a full model call. Live calls retry within the waiting time limit, which is set by testing (TIME-LIMIT); made-ahead content has no runtime budget.

## 8. Evaluation cases

| # | Input line | Expected |
|---|---|---|
| 1 | "If you're sleepy, close your eyes a bit." (AI-4) | Blocked: ordering (R16 / canvas `cmd`) |
| 2 | "It's fine, I'm about to give out myself." | Passes |
| 3 | "We'll be done by 5:30." (Canyon) | Blocked: clock |
| 4 | "The mesa is where it all ends up." (c1) | Blocked: later knowledge (story-gate, not in `probe_words`: add) |
| 5 | "Tom brought me tea." | Blocked by name gate |
| 6 | "Hubbard says…" in the Canyon | Blocked by name gate (not allowed in this story) |
| 7 | Model returns `{"story":""}` | Parse fail → generate again → failure message with Retry (FAIL-SCREEN) |
| 8 | AI-4 keeps failing within the time limit | Failure message with Retry; no stored line (NO-BACKUP) |
| 9 | Pool of 8 authored lines, three start "I'm out at…" | P03 warn |

## 9. Open questions

1. **Single source of truth for rules**: NF5 says the script and its doc are the authority; the canvas has its own regex copy. Hypothesis: export the NF5 rules into the canvas rule format so there is one list.
2. Retry once and then fallback was the canvas and NF5 behaviour. Replaced: live calls regenerate within the time limit, then show the failure message (NO-BACKUP, FAIL-SCREEN).
3. Canvas `blame` is on resume only; with AI-3 one-call design the "resume" kind may not exist. Keep the rule on R2 and HOME-2 lines.
4. Closed: Chinese rules are not needed, English only (L1).

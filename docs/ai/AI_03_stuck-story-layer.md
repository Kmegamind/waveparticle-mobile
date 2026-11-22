Imported from the planning folder on 2026-11-05. The decisions file docs/DECISIONS.md overrides this document where they differ.

> **Status after the decisions up to 2026-11-15 (#295).** The pause message stays a live call (SHARED-STORY). Superseded here:
> - **Repeated Pauses (section A3, change list row 3):** there is no quiet line. Every Pause means his own story is blocked, and a new stuck story is generated each time. From the third Pause in a Step the stuck situation is much harder, and because he remembers the earlier setbacks he says he is worried he may fail. The message is never an instruction to the user and never asks the user to stop pausing (F1, PAUSE-3). The prompt receives the pause number.
> - **Length (section A4, "Wrong shape"):** the pause message is 1 or 2 sentences and at most 30 words, not 20 (LEN-PAUSE).
> - **Escalation (section A4):** blocking severity words fits Pauses 1 and 2 only; from the third Pause the harder situation is intended (PAUSE-3).
> - **Fallback (change list row 5, section A4 pool sizes):** there are no authored snag, quiet or return pools. A failing message is generated again within the time limit; then the app shows its failure message with Retry and no stored text (NO-BACKUP, FAIL-SCREEN). Authored snag lines are reference examples and evaluation material only (C1).
> - **Return line (section C, change list row 7):** the return is the return pop-up, generated live after Back to step and after 5 minutes or more away (R1, A6, T6). In it he may describe how the time felt in his own words (TIME-WORDS); exact clock numbers stay out until decided (CLOCK-NUMBERS). There is no rule about whether he waits (H8). The HOME-2 line and the picked return card are gone. The pop-up is 1 or 2 sentences and at most 30 words, replacing the 14-word limit (LEN-RETURN). Going back to a Step offline shows the failure screen with Retry (OFFLINE-RESUME).
> - Chinese, a second language: out (L1).
> - **Decisions of 2026-11-21 (#369).** The pause message is made with two calls: first the stuck story, then his description of the predicament and his feelings (C1, PAUSE-TWO-CALLS). This is not v1's pair "stuck on Pause, resolved on Back" (D-AI-2, replaced by the return pop-up). Code chooses the category and the prop as in section A1. The props come from the story's one scene table (`props`, `pauseProp` in `docs/demo/<story>.stage0.json`); there are no weather or light scales (SCENE-PER-STORY), and there is no Weather snag category (removed from the table below). Call one (the stuck story) returns `{prop, story}`: the offered prop and the stuck story. Call two returns his words about the predicament and his feelings, which are the message he shows. Section A4 below matches this: the structured answer is `{prop, story}` only, with no `why` and no `back` (decided by the owner 2026-11-21: he never urges). The message is 1 or 2 sentences and at most 30 words (LEN-PAUSE). Main makes one call with a 20-word limit and no category or prop; see AI_09, "Next batch".

# AI-3 · Stuck story layer — v2 (after the user test)

> Delta on AI_03 v1 (earlier version, not imported); v1 stays the base for prompts, schema and the two-call flow. This file replaces v1 §9–§10 and adds §A (repeated Pauses, B14), §B (repetition across Pauses and cards, B10) and §C (return line, B13). Source of the questions: [PROMPTS_user-test-research-round_2026-11-04](../PROMPTS_user-test-research-round_2026-11-04_v1_draft.md), session WP2.8.

**Evidence rule used below.** *Evidence* = something a document or the test says. *Reasoned* = follows from the pillars or from how models behave. *Guess* = needs a test. The user test used mock lines, so it gives **no evidence** about how a real model repeats. Everything about model variety below is Reasoned or Guess.

## Change list (v1 → v2)

| # | Change | Why |
|---|---|---|
| 1 | The rule "third Pause in one step resets the timer" is cancelled; AI-4 §12's "step will fail" warning is treated as cancelled with it (**confirm**, see AI_09 v2). Nothing here depends on a Pause count limit. | Yue's decision, brief |
| 2 | New **snag taxonomy + props list**: code picks the category and the model writes within it | Makes variety a property of the design, not of the model |
| 3 | New **Kth-Pause rule**: Pause 1 and 2 in a step get a new snag; from Pause 3 on he is **no longer stuck** and says a quiet line | A story full of invented disasters is not believable, and it makes Pause feel like it costs him |
| 4 | New **"no new event" check** (structured output + denylist + similarity) | Fate link: a snag must never advance or add to his story |
| 5 | Authored fallback pool sized: **8 snags + 6 quiet lines per entry state** | Fallback must outlast a heavy user in one step |
| 6 | New §B: run-level dedupe across Pauses **and** cards | B10 |
| 7 | New §C: return line after hours = **picked, not generated** | B13 |

## A. Repeated Pauses (B14)

### A1. Can the layer keep producing new snags? (Reasoned)

Not by itself. A model asked for "one small thing that has him stuck" five times in a row converges on the same few physical snags (wind, cold, wet, a hat) and the same sentence shapes. The v1 `used_stuck` input only asks it not to repeat; models comply loosely. Two other failure modes are likelier than plain repeats: a snag that quietly becomes an **event** ("the wind blew the map away" turns into "the map is lost", a story change), and a snag that **escalates** with each Pause (worse and worse), which reads as the user's Pauses harming him.

**Design answer: make the code choose the variety.** The prompt gets a category and a prop; the model only phrases it.

| Category | Examples of props (Canyon, entry state c1 to c4) | Never |
|---|---|---|
| Body | cold hands, a dry throat, stiff neck | illness, injury |
| Gear | hat, boots, watch strap, pencil, lighter | broken or lost key items |
| Ground | gravel, mud, a slope | a place change |
| Paper | map corner, notebook page, a smudged line | a missing or changed document |
| Sound | a car idling, a loose sign, wind noise | someone arriving or speaking |

~~Props come from an authored list per entry state (WP2.3 owns it; size in §A4).~~ (SCENE-PER-STORY: `props` and `pauseProp` of the Story's scene table.) Rules: pick a category not used in the last two Pauses of this run; pick a prop not used before in this **step**; the model sees only `category`, `prop`, `entry.news`, `entry.why`.

### A2. Maximum number of distinct snags per entry state (Guess)

With 5 categories × about 3 props, a Story supports **about 15 distinct snags** before a person would notice a pattern. A believable **run** is far shorter: after about 4 snags in one step, even distinct ones read as a running gag. So design for: **at most 2 new snags per step** (A3), plus quiet lines. 15 is a ceiling, not a target for use.

### A3. What he does on the Kth Pause (proposed rule; Recommendation)

> **Superseded by PAUSE-3** (see the status note at the top). Kept as history.

K counts Pauses **within the current step**; it resets when the step changes (new entry state). It is never shown to the user.

| K | His first message on R1 | Source |
|---|---|---|
| 1 | New snag (category A) | Model, fallback authored |
| 2 | New snag (category B, different from K=1) | Model, fallback authored |
| 3, 4, ... | **Quiet line.** He is not stuck any more. He says where he is and what he is doing, in the entry state's terms, with the plain fact that it has not moved. Example, c2: *"I'm standing by the wall. Nothing has changed over here."* | Authored pool first; model optional (hypothesis: authored only, see A4) |

Why this and not "the snag stays, he comments on it": a standing snag with comments invites the user to feel responsible for it, and it needs a new line each time anyway. Why not "a new snag every time": see A1. The quiet line also carries the fate link in plain words (nothing moved) without any guilt: he does not wait for the user, he is just at his own work. When the user returns with Back, **no resolved call is made for a quiet pause** (there is nothing to resolve); the C-back card is an authored `return` line.

Alternative to test (Guess): K=3 repeats snag 2 with one more line ("the hat is still in my hand"). Keep it as arm B of the test in §A6.

### A4. "No new event" check (Recommendation)

The pause message is made with two calls (PAUSE-TWO-CALLS). Call one returns structured output, so the check can be mechanical:

```json
{"prop": "<one of the offered props>", "story": "..."}
```

Call two returns his own words about the predicament and his feelings as plain text, not JSON; that text is the message he shows. There is no `why` and no `back` field: he never urges the user to come back (owner decision, 2026-11-21). The checks below apply to `story` from call one and, where they name a word or shape rule, to the plain text of call two.

| Check | Rule | Catches |
|---|---|---|
| Prop echo | `prop` equals the offered prop; the snag sentence contains the prop word | The model inventing its own object |
| Scene objects | Every noun that is a physical object in the sentence is in the entry state's `scene_objects` list (authored) | New objects such as a telegram, a car that "arrives" |
| Event verbs | Denylist: arrives, comes, leaves, enters, says, tells, asks, agrees, refuses, decides, announces, calls, finds, loses, breaks, wins | Social or story action (an event) |
| People and place | Name gate (only `names.allowed`); no place nouns beyond the entry state's `places` list | New people, location change |
| Later knowledge | Probe words (AI-6 R19) | Leak of later facts |
| Escalation | Severity words (worse, again, still, "more and more", "even") are blocked in `story` for K=2 | Pauses that seem to hurt him |
| Near repeat | 3-gram Jaccard ≥ 0.5 with any `used_lines` entry, or same opening 3 words | Repeats (see §B) |
| Wrong shape | `story` or the call two text > 30 words (LEN-PAUSE), > 2 sentences, no full stop | AI-6 length and ending rules |

Generate again with the failure reason as a hint, within the time limit; then the failure message with Retry (NO-BACKUP, FAIL-SCREEN).

**Fallback pool size (withdrawn by NO-BACKUP; kept as history).** Per entry state: 8 authored snags (6 categories, 1 or 2 each) with their `return` lines, and 6 quiet lines. For the 4 entry states the Canyon prototype uses (c1 to c4): 8 × 4 + 6 × 4 = **56 lines**, 32 of them paired snag/return. If the database defines more entry states (8 slices), scale to 8 + 6 per slice = 112. Rule: no authored line is reused in a run unless the pool is exhausted; if exhausted, use a quiet line (never an error).

### A5. What changes elsewhere

- **AI-4** `now` while he is stuck = the snag; for K≥3 `now` = the quiet line, so chat stays consistent.
- **AI-10 (cards)**: the C-back card follows A3 (resolved line for K=1,2; authored `return` for K≥3 or failure).
- **AI-6**: the escalation and event-verb checks are new, one-way set only.

### A6. Small test (what it would prove)

**Offline, no users (can run now with a model).** Generate 20 runs of 5 Pauses each in each of 4 entry states with category/prop selection on, and the same with it off. Measure: exact and near repeats, rate of event verbs, escalation, retry rate, fallback rate, cost. **Proves or disproves** A1 (that code-picked categories reduce repeats and events). Pass bar (Guess): 0 events in 400 snags after checks; near repeats < 5% before checks.

**Wizard of Oz with people (arms A and B above).** 8 to 10 people who actually Pause often (self-reported procrastinators, ADHD, students on deadline), 3 sessions each, a real task, a person plays the system with the authored pool. Ask after each session: "did he seem to repeat himself", "did his troubles feel real", "did pausing feel like it cost him something" (guilt). **Proves or disproves** K≥3 quiet line vs repeated snag. Testers must **not** be simulated and not friends of the team; they must Pause at least 3 times per step.

## B. Repetition across Pauses and cards (B10)

*The issue text is not in my brief; I read B10 as "his lines repeat" (the brief and WP2.3's topics pair it with repetition checks). If B10 is something else, tell me.*

Evidence: the test did see repeated lines, but the prototype had a few mock lines repeating, which the brief says to **ignore**. So the need for a check is Reasoned, not shown.

| Item | Rule |
|---|---|
| `used_lines` | One list per **run** holding every one-way line shown (state cards, C-back, snags, quiet lines, Home lines). Stored by the server, passed to the checker, never to the model in full (only the last 6 of the same type, to keep tokens down) |
| Exact | Any exact match with `used_lines` → reject |
| Near | 3-gram Jaccard ≥ 0.5, or same first 3 words as any of the last 4 lines → reject (canvas "repeated words" metric reused) |
| Across types | A snag may not reuse the nouns of the last state card in the same step (so a card and a snag do not echo) |
| Authored pools | Same check; a pool item is retired for the run once shown |
| Contradiction (card vs opening situation: place, time, who is present) | **Not mine.** WP2.3 owns it; I only expose `entry.places`, `entry.people`, `scene_objects` as the shared lists |

## C. Return line after hours (B13)

### C1. Generate or pick? **Pick (Recommendation, Reasoned).**

> **Decided the other way:** the return pop-up is generated live (R1, A6, T6). Sections C1 to C4 are kept as history.

- The line is shown on a cold start, right when the user is least settled; a model call adds latency and a failure mode on the most sensitive moment.
- It must never contain anything about the user, so it has no personal input; the only variable is the entry state and the away bucket. That is a table, not a generation problem.
- A generated line could invent progress or news; a picked line cannot.

### C2. Where it is shown

| Away | Where | Line |
|---|---|---|
| < 30 min | Nowhere new (HOME-1 or F1 as it was) | none |
| 30 min to 3 days | HOME-2: one line on the mission card; and on F1 the first card after Continue is the authored `return` card of that entry state | picked |
| > 3 days | HOME-3 stays a system card, no line from him (FLOW); on Continue, F1 opens at the step's first card | none / picked card |

This follows AI-10 (cards) and [AI-2](AI_02_status-and-landing-lines.md): the return line **is** the existing `return` card, not a new feature. WP2.4 (Home) and WP2.6 (where on F1) own the placement; I only supply content rules.

### C3. Must never say

Time away ("hours", "a while", "all day", "long"), welcome or reunion ("welcome back", "you're back", "finally"), blame or waiting ("I waited", "where were you"), "you", a question, a hook ("soon", "tomorrow"), any news that moves the story (he did not move without the user, fate link), cheer ("great to see you"), advice, a clock time. Allowed shape: his place and a plain fact that it has not changed, first person, ≤ 14 words.

Draft lines for c2 (written by me; not NF5-checked):
*"Same wall, same wind. I kept to my own work."* · *"The light has not changed. I am where I was."* · *"Nothing here has moved. I am still looking at it."*

Pool: 3 per entry state per bucket (short away, long away) = 6 per entry state, 24 for c1 to c4.

### C4. Small test

Wizard of Oz: users who really left for 3 to 24 hours (leave a task mid-step, return next morning). Show A) the picked return card, B) no line, C) a line saying he waited (as a negative control). Measure "felt judged" and "felt like picking it up". **Proves or disproves** that a stasis line helps without guilt. Testers: real users who abandoned a task before, not simulated.

## Questions to other sessions

**WP2.3 storydatabase:** (1) authored props, `scene_objects`, `places`, `people` per entry state; (2) pool sizes in §A4 and §C3 (56 + 24 lines for the Canyon): too many? (3) contradiction check owner (§B); (4) which entry states exist beyond c1 to c4.
**WP2.6 focus/break:** (1) where the quiet line and the `return` card appear on R1/F1; (2) whether R1's first message arrives with a delay for K≥3 as for K=1 (consistency); (3) the C-back tap path when no resolved call was made.
**WP2.4 alive:** HOME-2 line from C2.

## Open questions

1. Confirm that AI-4 §12 (system warning on the third Pause) is cancelled with the timer-reset rule.
2. K=3 quiet line (this spec) vs repeating the second snag: decide after the test or pick the recommendation now?
3. Are quiet lines allowed to be model-written, or authored only? Recommendation: authored only for the first release.

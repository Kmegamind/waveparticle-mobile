# Decisions needed from the product owner

Date: 2026-11-21. Covers open issues 40, 45, 46, 48, 52, 55, 56, 59, 60, 64, 65 and 84, checked against the code and documents on `origin/main` (last merge: pull request 363). No open pull request works on any of them.

How to read this:
- Cost is engineering time after the decision: **S** is under a day, **M** is one to three days, **L** is more than three days. Reading content is your own time and is not counted.
- Names in capitals (for example NO-BACKUP, SHARED-STORY) are rows in `docs/DECISIONS.md`. "Criterion" means one acceptance criterion of the issue.
- Several criteria are already overruled by later decisions: every "authored fallback" line in issues 55, 56, 60, 65 and 84 is withdrawn by NO-BACKUP (a failed live line is generated again, then the failure screen with Retry). Those issues only need their text updated for that; no decision is asked.
- No issue is fully met on main, so none is recommended for closing outright.

10 decisions in 7 groups.

## 1. The Story record (issue 45)

**Issue 45, Story records.** Formally blocks 46, 48 and 64, and through them 84, 65 and 56.
- Unmet: a Story (`src/lib/content/types.ts`, table `stories`) has no present-tense line, past-tense memory line or carry line. Life Path rows use the goal sentence (`src/lib/summary/life-path.ts`); the carry line on the summary is written live with the closing line. The draft path-lines file (outside the repository) is not loaded.
- Decide (decision 1): are these three stored lines still wanted?
- A) No: rewrite the issue to what main does (goal sentence on the rows, carry line made with the closing line) and close it. **Recommended: it costs nothing and unblocks three issues at once.** B) Add only a memory line per Story, imported from the draft file and read by you. C) Add all three.
- Cost: A is S, B is M, C is M.

## 2. Reading the shared story content before it reaches phones (issues 46, 48, 84)

**Decision 2: what "read by a person" requires, and whether unread cards may stay live.** SHARED-STORY says a person reads the cards before they are published, but all 26 Oppenheimer decks were loaded as version 1, published and never read (the admin shows an "Unreviewed drafts" notice, `src/app/admin/stories/unreviewed-notice.tsx`). Cards carry no "written / checked by script / read by a person" state (READ-STATUS).
- A) Add the read state to each card; keep the 26 decks live while you read; chapter 1 first. **Recommended: testers keep a working path while the reading catches up.**
- B) Same state, but a Story without "read by a person" cannot be opened (the path stops at the last read Story).
- C) Leave it as a notice only. Cost: A and B are M; C is none.

**Issue 46, review gate and automatic checks.** Blocks 48, 84 and 108 (read-aloud cards).
- Unmet: checks run per card only when the admin saves (`src/lib/story-cards/checks.ts`). Nothing checks a whole Story for repeated lines, nothing runs in the automatic checks on each pull request, the output safety check is not run on pre-made cards (SAFETY-PREMADE), and no read state exists.
- Extra decision: should a failing card in the seed file fail the pull request checks? Recommended: yes, the same checks as the admin. Cost: M.

**Issue 48, chapter 1 content.** Blocks 84.
- Unmet: only the reading (decision 2). The deck exists (`src/content/oppenheimer/story-decks.json`, `bohr-difficulties`). Its background card introduces nobody, which is right if nobody is present at the start (the drafted scene lists no one present); please confirm that while reading.
- Cost: S once decision 2 and issue 46 are done.

**Issue 84, inputs for all 26 Stories.** Blocks nothing.
- Unmet: all 26 have facts, key moments, decks and drafted scene tables (`docs/demo/*.stage0.json`, imported to the database), but none is read and the scene tables reach no live generator. Criterion 3 (every Story playable) is met by pull request 301.
- Recommendation: rewrite it as "all 26 read" and let issue 65 carry the scene part. Cost: S.

## 3. The scene table and the pause message (issues 64, 65, 56)

**Decision 3: one scene table per Story, or one per part.** Each Story already has an AI-drafted, unread scene (`scene` in `docs/demo/<story>.stage0.json`: people present, allowed names, props, one pause prop, later words). No weather or light scales exist. The app code never reads it; only the demo scripts do.
- A) One table per Story, as drafted; drop weather and light scales; you read it with the Story's cards. **Recommended: the data already exists for all 26 Stories.**
- B) One table per part, written by the content team. C) Keep weather and light scales as well.
- Cost: A is M, B and C are L. Blocks 65 and 56, and the scene part of 84.

**Issue 64, scene table and state tag.** Unmet: no check fails a card that names a person not present (pull request 368, open, only touches introduction phrases); the table is not an input to the pause message or the checks. Cost: M after decision 3.

**Issue 65, inputs for the pause message.** Unmet: the pause prompt (`docs/ai/prompts/stuck_story.md`) receives only the pause number and facts, not the props, allowed names or rules. Blocks 56. Cost: M after decision 3.

**Decision 4 (issue 56): how the pause message is generated.** Main makes one call with no prop and no category; the answer is the story text only. Its word limit is 20, while LEN-PAUSE says 30 (a code fix, no decision needed).
- A) One call that returns two fields (his stuck situation, then what he says about it); code picks an unused prop; no category rotation. **Recommended: matches C1 (story first, then his words) without a second wait on the rest page.**
- B) Full issue: two calls, a category not used in the last two pauses, a structured answer with prop, story, why and back. C) Keep one plain call and only add the scene inputs.
- Cost: A is M, B is L, C is S. Blocks 42 (offline test runs).

## 4. The rest conversation (issues 59, 60)

**Decision 5 (issue 59): does each reply still come with a label for the message (his world, your work, knowledge, him, feelings, unclear)?** The label in `docs/ai/AI_04_rest-chat.md` was mainly for refusing, which ERA-ANSWER removed. Main returns the reply only (`docs/ai/prompts/rest_reply.md`).
- A) Drop the label; put the feelings rule (one line of his own, no advice) and "end on his own situation" in the prompt. **Recommended: the advice and one-question checks already run on every reply.**
- B) Keep the label in the same answer and use it in the checks. C) A separate small call for the label.
- Cost: A is S, B is M, C is M. Blocks 60 and 42.

**Decision 6 (issues 59, 60): may he repeat a later word that you typed yourself?** Main sends an empty list of later words to the reply check (`src/lib/model-gateway/gateway.ts`, `rest_reply`), and the spoiler check against unreached parts (CHAT-SPOILER-CHECK) is not applied.
- A) Yes: a later word is allowed when it is in your own message, so "I have never heard of a computer" passes. **Recommended: ERA-ANSWER lets him say plainly what he does not know.**
- B) No: any later word fails, even if you wrote it. Cost: S either way.

**Issue 60, guard and cost caps.** Unmet: the later-words and later-facts checks on the reply (above). Met: last six turns only, messages cut at 1000 characters, no message limit (`src/lib/prototype/rest-lines.ts`); the round-10 limit is parked in issue 337. Cost: M after decision 6.

## 5. The Goal split (issue 40)

**Decision 7: the real planning prompt (open item P1).** `docs/ai/prompts/plan_split.md` is still a six-line placeholder. The prompt structure you gave on 2026-11-11 (role, inputs, numbered planning rules, output shape, mechanical checks) is not in the repository.
- A) You paste the planning prompt from your AI workflow; engineering wires it in unchanged. **Recommended: D1b says the planning expert already exists.**
- B) Engineering drafts one in your structure for you to approve. Cost: A is S, B is M. Blocks 42 and 105 (what may be sent to the provider).

**Decision 8: does the Goal's shape (specific, vague or big) need a model call?** Main uses a local word pattern (`classifyGoalShape` in `src/lib/prototype/goal-lines.ts`) and picks his reaction from fixed lists.
- A) Keep the local pattern and rewrite criterion 1. **Recommended: the reaction is a fixed line anyway, so a call adds wait and cost for little.**
- B) Add a small model call before the time question. Cost: A is S, B is M.

## 6. The output safety word list (issue 55)

**Decision 9: who writes the list of method and instruction words that blocks a reply.** Main has no such list; the only banned words are four style words (`BANNED` in `src/lib/model-gateway/checks.ts`), and pre-made cards are not checked (SAFETY-PREMADE).
- A) Engineering drafts a short list now, you approve it, compliance reviews it before real users. **Recommended: the guard can ship without waiting for a review date.**
- B) Wait for compliance to supply the list. C) A model-based safety check instead of a list.
- Cost: A is S, B is S once the list arrives, C is M. Blocks nothing.

## 7. The end of the path (issue 52)

**Decision 10: his one line after the final Story.** Only this criterion is left. When every Story is finished, the Life Path just has no current row (`src/lib/summary/life-path.ts`), and a new session replays the last Story. FLOW lists the end-of-path screen (S6) as open.
- A) One line per Companion, written in the admin and read by you like a card. **Recommended: fits SHARED-STORY and needs no live call.**
- B) Reuse the closing line of the final Story. C) Generate it live once.
- Cost: A is S, B is S, C is M. Also decide whether a new session after the end replays the last Story. Blocks nothing.

## Order to decide

1. Decision 1 (Story record, issue 45): one yes or no that formally unblocks 46, 48 and 64.
2. Decision 2 (reading gate, issues 46, 48, 84): unblocks three issues and the read-aloud work (108); your reading time is the longest lead time.
3. Decision 3 (scene table, issue 64): unblocks 65 and 56 and the scene part of 84.
4. Decision 4 (pause message, issue 56): with decision 3 it completes the rest-page inputs and unblocks the offline test runs (42).
5. Decision 7 (planning prompt, issue 40): unblocks 42 and 105; option A needs only your paste.
6. Decisions 5 and 6 (rest conversation, issues 59, 60): together unblock both issues and the rest part of 42.
7. Decision 8 (Goal shape, issue 40): small, closes the last open part of 40.
8. Decision 9 (safety word list, issue 55): independent; decide early if compliance needs lead time.
9. Decision 10 (end of the path, issue 52): independent and only matters once someone finishes all 26 Stories.

## Answers (2026-11-21)

Yue answered all ten decisions on 2026-11-21. They are recorded in `docs/DECISIONS.md`, section "Decisions of 2026-11-21", and applied to the specification in issue #369.

| Decision | Answer | Id |
|---|---|---|
| 1. Story record (issue 45) | None of the options. The three stored lines (present-tense line, past-tense memory line, carry line) are not fixed. Yue will add a framework with the character's inner thoughts later. Do not build them and do not close issue 45; it waits for that framework. | STORY-LINES-LATER |
| 2. Reading the shared story content | No human review gate. Content is published first, Yue reads it on the phone, and a published card can be edited afterwards. The "read by a person before publishing" requirement is removed; the automatic card checks stay. Extra decision on issue 46: not answered separately; the automatic checks stay. | PUBLISH-FIRST |
| 3. Scene table | A: one table per Story, as drafted; no weather or light scales. Reading it is not a gate. | SCENE-PER-STORY |
| 4. Pause message (issue 56) | Two calls, as in PRD FR-REST-2 and decision C1 (the call structure of option B; the answer shape is not decided): two calls, first the stuck story, then his description of the predicament and his feelings. Categories and props are chosen by code as in AI_03. 30 words (LEN-PAUSE). Main makes one call with 20 words: a code gap for the next batch. | PAUSE-TWO-CALLS |
| 5. Rest reply label (issue 59) | A: no label on each reply. The feelings rule (one line of his own, no advice) and "end on his own situation" go into the prompt. | CHAT-NO-LABEL |
| 6. Later words the user typed (issues 59, 60) | A: he may repeat a later word that the user typed himself. | CHAT-USER-WORD |
| 7. Planning prompt (P1) | Still missing. P1 stays open; Yue will supply the file. | P1 (open) |
| 8. Goal shape | A: version 1 keeps the local rule (`classifyGoalShape`); a model call is possible later. The problem points in the current prompts are to be marked for a later full rewrite. | GOAL-SHAPE-LOCAL |
| 9. Output safety word list (issue 55) | There is no word list of dangerous method or instruction words, and none owned by compliance. The style checks stay. | NO-DENYLIST |
| 10. End of the path (issue 52) | His line after the final Story is a prompt to design later, but it must exist. Finishing all Stories also unlocks a long-term chat with that Companion. Both are pending, listed with the Later items #337 and #339. Whether a new session after the end replays the last Story was not answered. | END-LINE-PENDING |

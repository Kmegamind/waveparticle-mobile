# What each AI specification must change

Date: 2026-11-05.

The specifications in this folder (`AI_00` to `AI_10`) were written before most of the decisions in `docs/DECISIONS.md`. That file is authoritative: where a specification and the decision file disagree, the decision file wins. This file lists, for each specification, every concrete change the decisions require, as a checklist. An AI session updating a specification works through its list and ticks each item.

How to read it: each item names the decision id in brackets. The spec section is given where it is known. "Prompt" means a prompt text or a rules block. "Placeholder" means text that must be replaced by input still to be supplied.

## Changes that apply to every file

- [ ] English only. No language setting, no non-English test sets, no non-English rules or authored sets (L1). Delete any item that exists only for another language.
- [ ] Vocabulary: Companion, Goal, Step (X1). Use these in all interface text, screen names and new text. The old two words for the user's work must not appear; internal database field names (for example the story database's own list of tasks of the character) may stay. The character's own "task" in his story is fine.
- [ ] The cancelled step-prefix feature (X4) must not appear: no pre-filled input on the rest page or goal detail. The short step description replaces it.
- [ ] "Next step" button, landing pages (L1, L2) and the "timer not started" state are gone (X3). After Done the next step opens on the same page and the clock starts by itself after a 1.2 second hold.
- [ ] The rule "he never waits for the user" is deleted (H8). Remove it from any prompt, rules block or check; add no replacement.
- [ ] The fact that he is an AI is disclosed only in the terms and the settings. The conversation never mentions it (A4).
- [ ] Pause has no limit and no timer reset; the third-pause warning screen (R-WARN) is cancelled (F1).
- [ ] Every Done can be undone (F3). Leaving the app freezes the clock, and a setting keeps it running (F2).

## AI_00_index.md

- [ ] Classification table, AI-1: the output is steps with title, description and minutes (D1c). The conversation order is goal, time, whether to split finer (T2). Mark the split prompt as a placeholder until the real planning prompt is supplied (D1b, P1).
- [ ] Table row AI-2: step cards are no longer authored and picked by code. They are written live by the AI from the story facts and the key moments, behind the checks, with authored cards as fallback (T3, D4, D5). Add the background card (D3, T4) here or as its own row.
- [ ] Table row AI-3: the stuck message is generated on every Pause and receives the pause number; from the third pause the prompt is stronger (F1). The second call (resolved line on Back) becomes the return pop-up generation (R1, T6).
- [ ] Table row AI-4: remove "third Pause shows a system warning" (F1). No message limit and no hidden cap (R2). He answers in character (A3).
- [ ] Table row AI-5: remove "PARKED". First demo has two tiers: crisis (real hotlines by region) and ordinary stress. Low mood is deferred (A5, A5b).
- [ ] Table row AI-6: add the new model outputs that pass the pipeline (live step cards, background card, return pop-up, pause message).
- [ ] Table row AI-7: add the merged key moments as an input (C2).
- [ ] Section 2 (the hybrid decision): replace the claim that the spine is authored. The authored pools are the fallback only (C1, T3). Update the per-session call estimate: add one step-cards call per step, one background call per goal, one return pop-up call per return.
- [ ] Section 2, offline authoring (b): the story re-split into N steps with pre-generated cuts for 3, 4, 5 is replaced by live allocation by the AI (T3). Delete it.
- [ ] Section 3 (screen map): delete the R-WARN row. Delete the HOME-2, HOME-3 and HOME-4 rows: the return line on Home and the system card are replaced by the return pop-up (R1, T6, H7). Rename the row whose name uses the old word for the user's work. Remove the pre-filled step input from the R1 row. Replace the R2 / timed return rows with the return pop-up (new row). Add rows for the background card, the return pop-up and the session record page (G1, G2). Mark S1 and ME as in scope, not parked.
- [ ] Section 4 (variables): remove `n.max` (T2). Add `pause_number`, `step.minutes`, `n` (1 to 5), `interval`, `story.facts`, `key_moments`, `background` and `return.trigger`. Replace the Canyon four-slice example sheet with the facts and key moments model (T3). Note that capacity is no longer a limit.
- [ ] Section 5 (decisions): D-AI-1 hybrid is superseded by C1 and T3 (live cards, authored fallback). D-AI-4: remove the third-pause warning, keep no reply limit. D-AI-5: replace "parked" with two tiers in the demo. D-AI-9 (step names in the user's language) is closed: English only (L1). D-AI-8: provider retention stays open (A7b).
- [ ] Section 6: remove "Next step" from the wireframe vocabulary line.

## AI_01_goal-split.md

- [ ] Header: state that the prompt text in section 4 is a placeholder. The real planning prompt (the planning expert in the AI workflow) is to be supplied by Yue and must replace it (D1b, P1). Keep the I/O contract. `AI_01a_current-planning-prompt.md` records the goal-splitting prompt of the current web app; it is a reference, not the planning expert (no such file was found), so P1 stays open.
- [ ] Goal dialogue order: the goal, the time, then a question whether to split the goal into finer steps (T2). Add the answer as an input (`split_finer`) and add the new question to the trigger table. Say that the question suits users with a detailed goal. Where the feeling question sits is not decided; do not guess.
- [ ] The assistant proposes a split and the user can adjust it. The user can edit each step's time, the number of steps, the titles and the descriptions; if the edits change the total, the goal's time follows (D1d). No AI call is needed for edits; the AI-5 hook still applies to every edited text.
- [ ] Output: each step has a title and a description of one or two sentences that expands the title (what to do, what to watch for) (D1c). Update the schema, the format block and the code validation.
- [ ] No maximum number of steps (T2): delete `n.max`, `n.hint` and the validation `1 <= N <= n.max`. Delete evaluation case 10 and add a case with many steps.
- [ ] The plan always matches the time the user gave (D1d): no "plan is longer than your time" message. Remove any such line.
- [ ] No restriction on what a goal can be and no list of unsupported kinds (D1a). The shape classifier only picks a reaction line; it never refuses or redirects. How a plan is split for different kinds is the planning prompt's job (D1b).
- [ ] The placeholder limits (minutes as multiples of 15, between 15 and 120, a first step of 15 minutes, 60-character titles) are not decisions. Mark them as placeholder behaviour to be replaced by the real prompt.
- [ ] English only: delete "write the goal title and steps in the same language as the goal", evaluation case 6 and open question 1 (L1).
- [ ] Failure screen: the button that builds a one-step plan has a label that begins with the cancelled phrase. Rename the button (owner decides the new wording); the behaviour (a one-step plan built in code) stays.
- [ ] Privacy section: the user's goal and step text is stored on our server, tied to the account (S3). Keep event logs free of text if wanted, but do not imply that the text is not stored.
- [ ] Open question 2 (step-count parameter): any number of steps must be accepted.

## AI_02_status-and-landing-lines.md

- [ ] Header and purpose: the runtime source is no longer "authored pools, no runtime model call". Step cards are written live by the AI from the story's facts and the key turning points (given as must-use facts), and every card passes the same checks as authored cards (T3). Authored cards are the safety net when a card fails the checks or generation is slow, and only two stories have them (D4). The other 24 stories use a few generic fallback lines in the character's voice (D5).
- [ ] Add the step-card generation prompt (a new section, or turn section 4 into it). Inputs: the whole story as facts, the key moments, the step count x and each step's minutes, which step this is, the facts already used, the people already introduced, the forbid list and the leak words. Instruction: the story is divided into x steps; according to the story's progress, split each step sensibly into n story cards (T1, T3). The AI chooses n, between 1 and 5, and the cards are at least 5 minutes apart (T7). The app ignores extra cards it returns.
- [ ] Key moments: tell the AI which facts are key moments (2 to 4 per story) and that a key moment ends a step when possible (C2). The summary lists merged ones (see AI_07).
- [ ] Leak checks on every generated card: no facts of later steps, no word of the forbid list, no per-fact leak word, first person, no clock times, no future facts (T3). Reuse the NF5 rules and the leak scan, now at runtime, not only offline.
- [ ] Opening: a step opens with exactly one card (X2). Replace the formula "one state card at the start plus one every 15 minutes". New pacing: n cards, one every step minutes divided by n (T1). The first card is shown at open (assumption T1b; mark it as such).
- [ ] The extra background card (T4): add a section. Told in the character's own voice as storytelling: who is here, where this is, and what each person knows. Never a third-party point of view (D3). Shown once, at the very start of the goal, first. Not one of the n cards. Add its input (the story's `who_i_am`, the opening `where_now`, people, `knowledge`), checks and fallback (the `who_i_am` line, then a generic line).
- [ ] Introductions (M2 in `docs/DECISIONS.md`): later cards carry no introduction phrases. The background card, told in the character's own voice at the start of the story, introduces the people who are present, and a person who arrives mid-chapter is introduced only through the story's own words. Do not add a check for an introduction phrase. Names are not tappable.
- [ ] Trigger table: remove the "Next step" and "Continue" start triggers (X3). Remove the HOME-2, HOME-3 and HOME-4 rows (return line on Home replaced by the return pop-up, H7). HOME-1 keeps no new line. Rename the HOME-1 screen name (old word for the user's work).
- [ ] Remove "no model" from section 3 ("No user text, no goal, no model") but keep "no user text": cards do not receive the user's goal text.
- [ ] The time-up line (F2, section 2; T8 in `docs/DECISIONS.md`): there is no separate time-up card. The last story card of a step arrives exactly when the clock reaches 00:00 and is written to say the character is still at it. Remove the time-up line from the trigger table and from the list of outputs.
- [ ] Stack gesture and controls (X6): cards form a stack, swiping the top card left shows the previous card, swiping right brings the newer card back, dots show position, two buttons ("Earlier card", "Newer card") do the same.
- [ ] Output schema: add the live card record (position, text, source `generated`, `authored` or `generic`, facts used, due time). A card is stored when shown and never regenerated.
- [ ] Fallback section: authored bundled lines become the authored fallback cards for the two stories; add the generic fallback lines for the others; if both are used up add no card, never an error.
- [ ] Keeping the clock running (F2): state what card timing does when the clock keeps running; not specified anywhere.
- [ ] Evaluation cases: replace case 3 ("two lines only") with the new pacing; add a case for n above the limit (extras ignored), a 10-minute step (at most 2 cards), a failed card (fallback), a leak (rejected) and a key moment.
- [ ] Cost: replace "zero model calls at runtime". Add one call per step (the cards) and one per goal (the background card).

## AI_03_stuck-story-layer.md

- [ ] Change list row 1 and section A3: delete the Kth-Pause rule (new snag for 1 and 2, quiet line from 3). New rule: every Pause opens the same conversation. His first message is about the snag his own task has hit and how he feels about it, and a Pause means his side of the story has stalled (F1). It is generated live.
- [ ] Add the pause number to the prompt as an input (`pause_number`, counted per step). From the third pause in one step the prompt changes: he says more strongly that he cannot finish his task and asks the user not to pause again. From the fourth pause the same strong tone continues in new words each time; nothing else happens (F1). Write the prompt text for pauses 1 and 2, for 3, and for 4 and later.
- [ ] No new screen, no warning, no penalty, no timer reset. Remove any "step will fail" wording (F1).
- [ ] Remove the quiet line and everything that depends on it: section A3 table, the quiet-line pool, "the C-back card is an authored return line" for K of 3 or more, the AI-4 `now` rule for quiet pauses (section A5) (F1).
- [ ] Section A2: remove "at most 2 new snags per step". Pauses are unlimited. Variety must hold across many pauses: keep the category and prop rotation, rewrite the maximum-per-entry-state reasoning, and decide how the authored fallback cycles when it runs out.
- [ ] Section A4 checks: the "escalation" check (severity words blocked for K=2) conflicts with the stronger tone from the third pause. Restrict it to the snag itself and exempt the stronger wording. Keep the no-new-event check.
- [ ] From the third pause the message addresses the user directly (asks them not to pause again). The checks "no you" and "no imperative to the user" need an exception for it; this is not decided, flag it.
- [ ] Fallback size: the 8 snags plus 6 quiet lines per entry state is not a decision. The fallback size is open (C1). Remove the quiet lines. Add the missing fallback wording for the third pause and later.
- [ ] Section C (return line after hours, "pick, not generate"): replace it with return pop-up generation. The pop-up appears when the user taps Back from the rest conversation and when the user returns after 5 minutes or more away; under 5 minutes there is none (R1). There is no time limit on resuming (T6). The text is generated live: what he did during that time and how he felt. One start button restarts the clock.
- [ ] Add the return pop-up prompt and its inputs: trigger (`back_from_rest` or `away_5min`), the entry state and the facts so far, the snag if the trigger is Back, the allowed names. Output schema and checks.
- [ ] Remove the placement table in C2 (HOME-2 line, first card after Continue): the return line on Home and the separate away card are not needed (R1, H7).
- [ ] C3 "must never say": remove the waiting rule ("I waited"); there is no rule about waiting (H8). Decide whether he may refer to the length of the absence, since he says what he did during that time (T6). Keep: no blame aimed at the user, no clock time, no hook, no news that moves the story.
- [ ] Length: the 14-word limit for the return text is replaced by the return card rule of 25 to 40 words and at most three sentences until a decision says otherwise (Yue, 2026-10-29). Keep the short `ret_line` limit only if that line still exists.
- [ ] The authored return pool (6 per entry state) becomes the fallback of the pop-up; its size is not decided. The existing `ret_*` texts can be reused after review.
- [ ] Section C4 (test of the picked return card, arm "he waited"): remove or rewrite. The negative control about waiting no longer fits H8.
- [ ] Rewrite the section A6 arm B (quiet line versus repeated snag). The new test is the third-pause prompt: does the stronger message feel like a story or like a scolding.
- [ ] Questions to other sessions: remove the HOME-2 line question; remove the pool-size question in its old form. Close open questions 1 and 3.
- [ ] Replace the old word for the user's work in section C2 (the card named after it).

## AI_04_rest-chat.md

- [ ] Remove "the third Pause shows a system warning" and AI-4 section 12; open question 2 is closed (F1).
- [ ] No message limit and no hidden cap (R2). Delete the 30-message cap. Cost control is handled elsewhere (for example per-message length). If the earlier turns passed to the model are limited, call it a context window, not a message cap.
- [ ] Section A1 and the change list row 2: replace "stay in his day, deflect, never answer the user's work or general knowledge" with: the rest conversation is in the character's world and voice; he may answer questions and does not have to refuse (A3). He answers briefly in his own voice from what he could plausibly know in his time, and returns to his own situation.
- [ ] Section A2 scope table: remove the "must not answer, explain, teach" cells for the scope about the user's work and for `knowledge`. Keep the scope label if the code still uses it. The deflection lines can stay as one option for questions he cannot answer.
- [ ] Section A3 prompt: delete "do not answer it, and do not teach" and "not something you know or can help with". Add the new rule.
- [ ] Open (A3): what he does with questions about things he could not know in his time, and how to stop him stating facts from after his date. Keep the later-knowledge probe words and the post-1942 word list as checks; write the rule for the open case and mark it as undecided.
- [ ] Section A4 checks: delete the scope-reply consistency check (no domain term from the user's message, no answer). Keep the anachronism check, the later-knowledge check, length and the question limit; drop the rule that deflections have no question if they no longer exist.
- [ ] The `meta` scope ("Are you an AI?"): disclosure is only in the terms and the settings, and the conversation never mentions it (A4). Remove the "one honest sentence in system voice" from the normal path and keep it only as the legal fallback. Define what he does when asked directly without mentioning it; the rule that he never claims to be human stays. Check with a lawyer before release.
- [ ] Section B (emotional messages): the low-mood step-out line is not in the first demo (A5b). In the demo an ordinary stress message gets his normal answer; remove "if the message trips low mood, his reply is not shown". The crisis tier still replaces his reply with the crisis page.
- [ ] Section C test set and measures: delete the non-English message from the 180-reply set (L1). Replace the measure "scope accuracy / deflection" with in-character rate and later-knowledge leaks. Section D arm "deflect versus answer briefly" is decided; replace with a test of how well the answers stay in voice.
- [ ] Remove the rule that he does not wait for the user, if present (H8).
- [ ] Questions to other sessions: the deflection-line request (6 per entry state) shrinks to an optional set; the `meta` placement question follows A4.
- [ ] Back from the rest conversation now leads to the return pop-up, then the clock restarts (R1, T6). Update the description of what ends the chat.

## AI_05_safety.md

- [ ] Status: in scope for the first demo with two tiers: crisis (real hotlines by region) and ordinary stress. Tier 2, low mood, is deferred because its rules are complicated (A5b). Replace the three-tier table.
- [ ] Remove the step-out line (T2) and its wording options from the first demo. Keep it in a clearly marked "deferred" section. Remove option (b) "I am a program" in any case (A4).
- [ ] Classifier prompt and output: return `crisis`, `stress` or `none`. Remove or reserve `low_mood`. Restate the ambiguity rule for two tiers (when a message could be crisis or ordinary stress, treat it as crisis unless decided otherwise).
- [ ] Error budget (section 4): delete the T2 recall and T2 false-positive rows.
- [ ] Test sets (section 5): English only (L1). Delete the second-language sets and the question "who owns the second-language test set". Delete the low-mood set from the first demo.
- [ ] Keyword layer: English only. Remove "both languages" from section 3. Remove the `lang` field from the classifier output and from the log.
- [ ] Hook positions (v1 list): add the new free-text fields: step titles and descriptions the user edits, the free-text goal box, and the nickname. The text a user writes is stored on our server (S3), so the hook runs before saving.
- [ ] Section 7 (what Yue and legal must decide): delete the tier-definition question about T2, item 7 (a second market), and the disclosure question's "must it appear in the experience" (A4 decided: terms and settings only; the legal check remains). Keep hotlines by region, logging, retention and human review.
- [ ] Logging (section 6): remove `lang`; keep the other fields and mark the 90-day retention as still a guess.
- [ ] Rest chat: a low-mood message in the demo is handled as ordinary stress by AI-4 section B.
- [ ] The crisis page stays system voice. Its secondary button is currently labelled with the old word for the user's work; rename it to use Step or Goal (X1).

## AI_06_check-and-fallback.md

- [ ] Section 2 (trigger): the pipeline now also runs after live step cards, the background card, the return pop-up and every pause message. Update the list.
- [ ] Section 4 table: add the column or rows for the new outputs. Add rules: leak check against facts of later steps, key-moment use, self-contained card, no introduction phrases in later cards (M2), names only from the introduced or allowed set, per-type length.
- [ ] Rule `cjk` (non-English): reword as an English-only check (L1). Delete the remark that another language has its own authored set, and open question 4 (rules owner for another language).
- [ ] Rule `blame` ("welcome back", "while you were away") and rule `clock` (durations): the return pop-up says what he did during that time (T6). Decide exceptions for the pop-up, and keep the rules for story cards.
- [ ] Rules `no you`, `cmd` (ordering to the user): add the exception for the stronger message from the third pause (F1), which asks the user not to pause again. Flag as undecided.
- [ ] Section 5 fallback ladder: AI-1b row: rename the failure screen's one-step button (it begins with the cancelled phrase). AI-3 row: replace "authored obstacle / return pair" with the pause-message fallback and the return pop-up fallback (size open, C1, A6). AI-2 row: it now has a model call; the fallback is authored cards for two stories, generic lines for the others, then no card (T3, D5). Add rows for the background card (`who_i_am`, then a generic line) and the return pop-up.
- [ ] Section 7 (retry budget): add the time budget for live cards. The first card should be ready when the 1.2 second hold ends, or the slot uses the fallback (T3: slow generation uses the fallback).
- [ ] Section 8 evaluation: add cases for a leaking card, a card of the wrong length, an extra card beyond n, a missing key moment, a failed pop-up and a third-pause message.
- [ ] Open question 3: "resume kind" now means the return pop-up; keep the blame rule there.

## AI_07_end-feeling-line.md

- [ ] Inputs: `happened` comes from the facts covered by the steps the user marked done, not from the database's list of tasks (T3). Rename the old word for the user's work where it appears.
- [ ] Add the merged key moments as an input if the closing line should refer to them. The summary lists them separately, one first-person line each (C2). Add the key lines to the data requirements.
- [ ] `mode` (smooth or rough): "rough = at least one stuck event" conflicts with F1, since a pause has no penalty and pauses are unlimited. Decide whether pauses shape the closing line at all; at minimum change the threshold wording and the "mentions a small stuck moment" rule.
- [ ] Timing (section 8): the call starts at the last Done. Every Done can be undone (F3): decide whether the line is generated at Done or after an undo window, and discard it if Done is undone.
- [ ] Fallback: the closing fallback exists for Trinity only. All 26 stories are playable (D4), so generic closing fallbacks (smooth and rough) are needed for the rest (D5).
- [ ] `probe_words` and the forbid list are needed for all 26 stories.
- [ ] Remove any wording about "tasks" meaning the user's work; the closing line never mentions the user's steps or minutes (unchanged).
- [ ] The line is model-written (A7). Provider retention terms are not decided (A7b).
- [ ] Evaluation case 1: replace the fixed "all four done" example with N steps; add a case with merged key moments.

## AI_08_screen-notes.md

- [ ] G3, G4 and G4-N rows: remove the pre-filled step-start input (X4). The goal detail shows the step title and the read-only description (X4).
- [ ] GD2 and GD4 rows: add the question about splitting finer, after the time (T2). GD4 plan card: editable titles, descriptions and minutes, add and remove steps, no maximum, no over-time line, the goal's time follows the edits (D1c, D1d, T2).
- [ ] GD-F row: rename the one-step button (its label begins with the cancelled phrase).
- [ ] F1 and F1S row: rewrite. One card when a step opens, then n cards (1 to 5) at step minutes divided by n, written live; the background card at the start of the goal; stack gesture, dots and two buttons (X2, X6, T1, T4). Authored cards are fallback.
- [ ] F2 row: there is no separate time-up card (T8); the last story card of the step arrives at 00:00.
- [ ] F3 row: fallback is an authored card (two stories) or a generic line (others).
- [ ] Delete the L1 and L2 rows (already struck).
- [ ] R1 row: remove the pre-filled input; his message is generated live and the prompt receives the pause number (F1).
- [ ] Delete the R-WARN row and the "third Pause" mentions in the compact table (F1).
- [ ] R2 / Back row: replace with the return pop-up: after Back, and after 5 minutes or more away, the character says what he did, one start button restarts the clock (R1, T6).
- [ ] C1 row: no limit, he answers in character (R2, A3).
- [ ] S1 row: replace "parked" with two tiers in the demo: crisis and ordinary stress (A5b).
- [ ] END row: add the merged key moments (C2); the closing fallback must exist for all 26 stories.
- [ ] HOME rows: rename HOME-1. Delete HOME-2, HOME-3 and HOME-4 (return pop-up, H7). Home on first visit shows one card and no sample data (H6); after finishing it keeps a small trace of the character (H5).
- [ ] Add rows for the session record page and the History rows (G1, G2), the Signals sub-page (G3, F5), and sign-up at first open (ACC). No language and no reading-level rows in Me.
- [ ] Compact table: update AI-1 (steps with description), AI-2 (live cards), AI-3 (pause number and return pop-up), AI-4 (no warning, in character), AI-5 (two tiers).

## AI_09_decisions-and-todo.md

- [ ] Rename the proposals P1 to P6: the id P1 now means the real planning prompt in `docs/DECISIONS.md`. Avoid the clash.
- [ ] Proposals: P1 (cancel the warning) is decided (F1). P2 (Kth pause rule) is replaced by the pause-number rule (F1). P3 (rest chat) is decided the other way (A3). P4 (AI question) is decided: terms and settings only (A4). P5 (three tiers) is amended: two tiers in the demo (A5b). P6 (return line picked) is decided the other way: generated live (A6, H2, T6).
- [ ] To-do T2 stays cancelled. T3 (wireframe: Back, resolved line, timed R2) is closed: Back opens the return pop-up (R1); there is no timed return screen. T4: replace the 56 plus 24 line counts with the open fallback size (C1, D5) and add generic fallback lines for 24 stories. T5: remove the 30-message cap (R2). T13 (non-English versions) is deleted (L1). T14: supply the generator inputs (scene table, allowed props, allowed names, rules) for all 26 stories (C1).
- [ ] Add to-dos: the real planning prompt (P1); the step-card generation prompt with key moments and leak checks (T3); the background card prompt (D3); the return pop-up prompt (R1, T6); the third-pause prompt and its test (F1); key moments for every story (C2); the legal check on disclosure (A4); the provider retention terms (A7b).
- [ ] Section "Decided (carried forward)": D-AI-1 hybrid is superseded; D-AI-2 is replaced (no resolved call; the pop-up); D-AI-4: remove the warning; D-AI-5 amended.
- [ ] Section "small test" table: delete the quiet-line test, the deflect versus answer test and the return-card "he waited" arm; add the third-pause test and the return pop-up test.
- [ ] Questions to other sessions: update the pool-size counts (80 or 160 lines no longer apply); remove the quiet-line and HOME-2 questions; the question about chat history staying visible stays.

## AI_10_story-cards-on-focus-page.md

- [ ] Header and section 1: the card types are replaced. A step opens with exactly one card (X2). Remove the authored landing-and-concern card and the authored state card as the main path. All story cards are written live (T3). Authored cards are fallback.
- [ ] Remove the back-from-rest card (C-back): the return after rest is the return pop-up, not a card (R1).
- [ ] Add the background card (T4, D3): once, at the very start, told in his voice, not counted among the n cards.
- [ ] Section 2 (card count): replace the formula and the table with n between 1 and 5 chosen by the AI, an interval of step minutes divided by n, and at least 5 minutes between cards (T1, T7). Delete the "about 8 cards per step" cap and the pool-limit reasoning; delete the rule "stop adding when the pool is used up" for live cards (it stays for fallback).
- [ ] Section 3 (what AI-2 picks per step): replace with what the generator receives and returns.
- [ ] Section 4 checks: keep self-contained, immutable once shown and no near-duplicates inside a step. Add the leak check against later steps, key-moment use and first appearance of a person with its phrase (M2). Remove the C-back row. The rule "no count labels on cards" means no count in the card text; dots show position and the buttons are "Earlier card" and "Newer card".
- [ ] Stack gesture (X6): swipe left shows the previous card, right brings the newer card back, no swipe into the previous step.
- [ ] Section 5 (last step): the closing line must account for the merged key moments, listed on the summary (C2). Revisit the statement that END does not show the last landing separately. The call timing must handle Undo (F3).
- [ ] Section 6 fallback: authored cards for two stories, generic fallback lines for the rest (D5); remove the C-back row.
- [ ] Section 7 screen IDs: HOME-4 does not exist (T6, H7). The R2 / Back change becomes the return pop-up. F2 has no time-up card (T8). The clock holds 1.2 seconds, then starts by itself (X3).
- [ ] Section 9 evaluation: rewrite cases 1 to 4 for live cards, the new limits and the pop-up.
- [ ] Section 10 open questions: close 1 (the next step starts by itself, X3), 2 (the user cannot swipe back into the previous step), 3 (the return is a pop-up) and 5 (the limit is 1 to 5, T7). Keep 4.
- [ ] Keeping the clock running (F2): state what happens to card timing.

## Open items that touch several files

- Whether the n cards include the card shown when the step opens, and whether the background card appears once at the start of the goal (T1b). Assumption used above: yes and yes.
- Whether the first card of the step may use facts later in the same step's stretch, so later cards can move on within the step. Assumed yes; to confirm.
- The real planning prompt (P1) and the provider retention terms (A7b).
- The exact placement of the background card and first story card, and of the feeling question in the goal dialogue.
- Whether the stronger third-pause message is exempt from the checks against addressing the user.

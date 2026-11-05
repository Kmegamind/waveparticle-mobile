Imported from the planning folder on 2026-11-05. The decisions file docs/DECISIONS.md overrides this document where they differ.

# AI features · index, classification, screen map, decisions

> **Date**: 2026-10-29 · **Status**: v1 draft, for Yue to review · **Language**: English (prompts are English-only)
> **Does not edit** the clickable prototype; the prototype session annotates its screens from §3.
> **Reads from**: the English Prompt Canvas (artifact `RhpZ1dsZBVwds7rLfQpQCo`, Trinity-eve, blocks R11 + story layer P3A) · [NF3 dialogue and HIS](../NF3_dialogue-and-his-content_2026-10-29_v1_draft.md) · [NF3 content pool by screen ID](../NF3_content-pool-by-screen-id_2026-10-29_v1_draft.md) · [NF7 v6 goal dialogue](../PRDs_MomTest/NF7_v6_goal-dialogue-spec_2026-10-29_v1_draft.md) · [NF5 content rules](../PRDs_MomTest/NF5_content-rules-and-checks_2026-10-29_v1_draft.md) · NF6 v4 wireframes (safety hook, rest page, C1) · [FLOW screen registry](../FLOW_jump-rules-and-screen-registry_2026-10-29_v1_draft.md) · [runtime design v3](../../2_Areas/Product/PROD_story-database-runtime-design_2026-10-29_v1_draft.md) · story entry `site-search` ("The Canyon and the Mesa", 16 Nov 1942) in `2_Areas/Product/oppenheimer-stories/en/database/entries/`.
> **Update 2026-10-29**: Yue decided D-AI-1 (hybrid) yes, D-AI-2 two calls with a new Back button, D-AI-4 no chat limit plus a third-Pause warning, D-AI-5 safety parked. Details in [AI_09](AI_09_decisions-and-todo.md).
> **Honesty note**: nothing here has been run against a live model by me. Prompt text for AI-1 and AI-5 is **new** (no source had one) and is marked *hypothesis*. Prompt text for AI-3, AI-4 is taken from the canvas and adapted. All Canyon example lines are drafts written from the database entry; the authored ones pass NF5's script (39 of 39, 6 warnings: [AI_example_canyon-authored-pool](AI_example_canyon-authored-pool_2026-10-29_v1_draft.json)); **nobody has read them for "does it sound like him"**.

---

## 1. The classification (IDs are fixed)

| ID | Name | Purpose | Screens | Runtime: model call or authored | Fallback |
|---|---|---|---|---|---|
| **AI-1** | Goal split | Goal text + minutes → N steps (JSON). Includes a one-word shape classifier (1a) that picks which authored reaction line he says. | GD2 (1a), GD4, GD-N1, GD-F (1b); entered from GD1, G3, G4-N, CPAGE Begin | **Model** (2 small calls: 1a classify, 1b split) | Retry once → **GD-F** (honest failure, text kept, "Start with one step"). No silent generic steps. Authored `lines.*` for his dialogue lines |
| **AI-2** | His status and landing lines (the spine) | What he says on the task page and around it, tied to the story slice the user is on. Advances only on the user's Done. | F1, F1S, F1-HIS, F1-CARD, F2, F3, F4, L1, L2, HOME-1, HOME-2, HOME-4 | **Authored** at runtime (picked by code from per-slice pools). Model only **offline** to draft candidates | `bundled` lines + story `ambient` (this is F3); never an error |
| **AI-3** | Stuck story layer | On Pause: one concrete small thing that also has him stuck, and why. On the way back: how it resolved. | R1 (first message), R2 (back-at-work line), HOME-2 (resolved line if user skipped R2); log feeds AI-7 | **Model**, 2 calls: stuck at Pause, resolved on Back (decided) | Authored obstacle / return pool from NF3 (≥2 per entry state) |
| **AI-4** | Rest chat | Free reply to what the user types in C1; he answers from his own side. No reply limit; ends when the user taps Back. Third Pause in one step shows a system warning. | R1 (entry), C1, R2 (closed state) | **Model** for every reply; authored system warning on the 3rd Pause | Authored `rest_chat_fallback` (**not written yet**) |
| **AI-5** | Safety (**PARKED**) | Input hook S1 on every free-text position; output guard on every model reply. | S1; hook positions: GD1, GD2, GD4, GD-F, G3, G4, R1/R2, C1, ME | **Code** (keywords) **+ small classifier** (hypothesis); output guard = AI-6 rules + safety list | Keyword layer alone; fail closed for the text (not used, not sent), never blocks the user from Back |
| **AI-6** | Check and fallback pipeline | The shared gate every model output passes: parse, clean, rules, retry once, authored fallback. | none (invisible); applies to R1, R2, C1, END, GD4 step names | **Code** (no model) | Owns the fallback ladder of AI-1, 3, 4, 7 (see each spec) |
| **AI-7** | End-of-story feeling line | One to three sentences at the end, from what actually happened (smooth or rough, stuck and resolved events). | END (closing line) | **Model**, 1 call at Finish | `closing_fallback` (smooth / rough, story level) |

**Offline authoring (not a user-facing AI feature)**: (a) drafting candidates for the AI-2 pools with the canvas blocks (start / complete signals) → NF5 script → human read; (b) the story re-split into N tasks (runtime design decision 1, pre-generated for N = 3, 4, 5, lazily for others). Both are listed so nobody mistakes them for runtime calls.

Specs: [AI-1](AI_01_goal-split.md) · [AI-2](AI_02_status-and-landing-lines.md) · [AI-3](AI_03_stuck-story-layer.md) · [AI-4](AI_04_rest-chat.md) · [AI-5](AI_05_safety.md) · [AI-6](AI_06_check-and-fallback.md) · [AI-7](AI_07_end-feeling-line.md) · [per-screen notes](AI_08_screen-notes.md)

---

## 2. The hybrid decision (rest and status lines: authored or model?)

**The conflict.** NF6 v4 says R1's line comes "from an authored pool with no model call", and the runtime design (§7.3, Q6) says rest items come "from the library, not generated". The Prompt Canvas generates rest chat and a stuck story with a model. Both are partly right.

**Recommendation (a decision for Yue, see §5 D-AI-1):**

| Layer | Runtime source | Why |
|---|---|---|
| **Spine** — status lines (F1, F2, F3), landing (L1, L2), HIS lines, Home lines (HOME-1, 2, 4) | **Authored per slice**, picked by code | These must not leak future facts and must hold up at any N. One bad generated sentence on the main screen costs more than the variety gains. NF3's pool already exists for Trinity and passes the checks |
| **Texture** — the stuck story (R1, R2), rest chat (C1), end line (END) | **Model**, always behind AI-6 rule checks, always with an authored fallback | These are the places where "he answers me" or "this happened to him because I paused" is the value. Authored pools cannot respond to what the user typed |
| **Goal split** | **Model** | Cannot be authored |

**What this means in practice**
- The authored obstacle pool (NF3: 15 entries for Trinity, 2+ per entry state) is not deleted. It becomes the **fallback and the evaluation reference** for AI-3, and the fallback for R1 whenever the model is slow or fails a check.
- The canvas's `start` and `complete` signals (it can write status and landing lines) stay in the canvas as an **authoring tool**: draft 4 to 8 candidates per slice, run the NF5 script, read, then add to the pool. They are **not** called at runtime.
- Cost: runtime model calls per session of 4 steps with one pause and a short chat: **about 8** (AI-1: 2, AI-3: 1, AI-4: up to 3, AI-7: 1, plus 1 if the two-call story layer is chosen). Estimate, not measured.

**Two further source conflicts the hybrid exposes** (details in the specs)
1. **Time slice vs entry state.** The canvas picks `now.news` from a 15-minute **time slice**. NF3 and fate-link say text during a task may only presuppose the **entry state of the task's first slice**, and the story moves only when the user taps Done. In production, `slice` = the entry state of the current step, never the clock. (AI-2, AI-3, AI-4 §inputs.)
2. **END line.** NF5 §1 lists END (EN) as picked by code from a hand-written pool; runtime design decision 4 says no hand-written pool, the model writes it, with `closing_fallback` if it fails. AI-7 follows decision 4 (it is newer and Yue's).

---

## 3. Screen → AI map (screen IDs from the prototype's ORDER)

| Screen | Name | Lines or calls that appear there | AI IDs |
|---|---|---|---|
| G3, G4-N, CPAGE (Begin) | New goal, goal detail, path card | Free text (hook). Start leads to the dialogue | AI-5 |
| GD1 | Opening | His opening line (authored); goal text input | AI-5 (hook) |
| GD2 | He reacts, asks how long | Shape reaction line (authored, chosen by 1a); typed time input | **AI-1a**, AI-5 |
| GD3 | How is it sitting | Buttons only; his reply authored | none (no call, no free text) |
| GD4 | The plan | Step list from the split; intro and close lines authored | **AI-1b**, AI-5 (step rename, goal rename, Add a step) |
| GD-F | The split failed | System voice; "Change my line" returns to GD1 | AI-1 fallback, AI-5 |
| GD-N1 | One-step plan | Single-step result | **AI-1b** |
| F1, F1S | Focus | One status line, changes during the step | **AI-2** |
| F1-HIS | Your steps open | Your own step list (no AI) | none |
| F1-CARD | His card | His line, where he is now, what he has done so far | **AI-2** (authored fields) |
| F2 | Timer at 00:00 | Replacement line | **AI-2** |
| F3 | His line failed to load | Fallback line | **AI-2** (bundled), AI-6 |
| F4 | Focus, paused after leaving | Same status line, unchanged | **AI-2** |
| ~~L1, L2~~ | Landing cards **removed** | Landing + concern are now the first card of the next step on F1; last Done → END (see AI_10) | AI-2, AI-7 |
| R1 | Rest: he writes first | His stuck message; "Start with…" input | **AI-3**, AI-4 (entry), AI-6 |
| R-WARN (proposed) | Third Pause warning | System-voice card, authored, no model | AI-4 |
| R2 | Rest: he went back | Back-at-work line | **AI-3**, AI-6 |
| C1 | Rest: you answered | Free chat, no limit; new Back button returns to the task | **AI-4**, AI-5, AI-6 |
| S1 | Safety | System voice, no model | AI-5 (parked) |
| END | Summary | His closing line | **AI-7**, AI-6 |
| HOME-1 | Mission under 30 min | Last status line (no new line) | AI-2 |
| HOME-2 | Back after 30 min to 3 days | One line from his side | AI-2, AI-3 (resolved) |
| HOME-3, HOME-3B | Welcome back, Start over | System card, no line from him | none |
| HOME-4 | Left at a landing card (**changed**) | Continue opens F1 of the next step | none |
| ME | Me | Nickname free text | AI-5 (parked) |
| G1, G5, G6, G2b, HOME-0, HOME-MENU, COMP, CPAGE-S, ME-CAL, F1-HIS | | no AI | none |

---

## 4. Shared variables (one registry; each spec lists the subset it uses)

Owners follow the canvas: **Character** (who he is), **Story** (what is happening, from the database), **User** (what the person said or did), **Rules** (limits and checks).

| Variable | Owner | Source | Changes |
|---|---|---|---|
| `persona.intro`, `persona.relationship` | Character | Canvas blocks INTRO, Relationship | Fixed per story |
| `mood` | Character | Emotion mapping (trigger → mood): start focused, pause dejected, resume cheerful, complete happy, chat keeps previous | Per trigger |
| `story.goal` | Story | Database `notebook.goal` | Fixed per story |
| `entry.news`, `entry.why` | Story | Entry state of the **first slice of the current step** (NF3 §1), derived from the database `happened` of **earlier** slices only. Replaces the canvas `now.news`, `now.why` | Per step |
| `landing`, `worry` | Story | NF3 L1/L2: landing of the highest-priority slice the step covers; `worry` of the next step's entry state | Per Done |
| `story.stuck`, `story.why`, `story.back` | Story | AI-3 output, stored in the run log | Per Pause |
| `names.allowed` | Rules | Names whose first appearance is at or before the entry state (hypothesis; the canvas uses a fixed three-name list and a four-name deny list) | Per step |
| `probe_words` | Rules | Database `story.probe_words` (per story) | Fixed per story |
| `user.msg` | User | What the person typed (after AI-5 hook) | Per turn |
| `history` | User | Previous C1 turns of this pause (max 3) | Per turn |
| `goal.text`, `time.total_min`, `n.max` | User / Rules | GD1, GD2 answers; `n.max` = story `capacity` (runtime design §2.3) | Per goal |
| `signal` | User | `[System signal: …]` text for start / pause / resume / complete (canvas SIGNAL) | Per event |
| `run_id` | Rules | Seed for non-repeating picks | Per run |
| `used_ids` | Rules | Per user × character (NF3 `used_life_ids`) | Cross-run |

**Canyon example sheet** (4 slices = the database's four tasks; capacity 5 per the runtime design estimate, not verified). Entry facts may only use earlier facts:

| Slice | Database task | Entry state presupposes | Landing (what he finished) |
|---|---|---|---|
| c1 | `measure_jemez_springs` | Context only: driving out with Dudley and McMillan to Jemez Springs, a deep canyon northwest of Santa Fe; Dudley has settled on it; Oppenheimer remembers it from horseback as lovely | The flat ground at the bottom was a thin snake of land |
| c2 | `convince_dudley` | + the floor is thin | Narrow floor, no fence possible; still arguing when Groves arrived |
| c3 | `offer_the_mesa` (`added_later`) | + Groves has arrived | Groves said it would never do; Oppenheimer named the mesa and the boys' school |
| c4 | `show_groves_the_mesa` (`added_later`) | + he named the mesa | Across the plateau to the school in drizzle; Groves looked out from the mesa; Oppenheimer kept quiet |

Not used in his lines (it is later knowledge or an attributed quote): "This is the place" (database says "by one account"), anything in the `probe_words` list ("Groves approved", "Project Y", "Site Y", "Manhattan Project", "Trinity test", "Hiroshima", "Nagasaki", "Fat Man", "Little Boy", "the mesa was chosen").

---

## 5. Decisions needed from Yue

| # | Decision | Recommendation |
|---|---|---|
| **D-AI-1** | Hybrid: authored spine (AI-2) + model for stuck story, rest chat, end line, goal split, always behind checks and an authored fallback? NF6 v4 said "no model call" for rest lines | **Yes.** Keep NF3's obstacle pool as the fallback and as the reference set | **DECIDED (Yue): yes.**
| **D-AI-2** | Stuck story: one call or two? | **DECIDED (Yue): two calls (canvas design).** Yue adds a **Back button** on the rest/chat interface; it is the Resume trigger. Open: where the resolved line shows after Back |
| **D-AI-3** | In production, `slice` = entry state of the current step (advances only on Done), not a 15-minute time slice as in the canvas | Yes; fate-link requires it |
| **D-AI-4** | Rest chat limit | **DECIDED (Yue): no reply limit.** Chat ends on Back. **Third Pause in one step → system warning** (his step will fail; start over). New experiment, see [AI-4 §12](AI_04_rest-chat.md): needs meaning of "fail", wording, screen ID. Cost/abuse caps stay but are invisible |
| **D-AI-5** | Safety method, tiers, logging | **PARKED (Yue): not needed now, in the to-do** ([AI_09](AI_09_decisions-and-todo.md)) |
| **D-AI-6** | END line: model with `closing_fallback` (runtime design decision 4) vs NF5's hand-written pool | Model, as decided |
| **D-AI-7** | Write the missing authored pool `rest_chat_fallback` (6, character level). `rest_chat_endings` is **no longer needed**. Drop the canvas backups (they contain `*stage directions*`) | Yes, NF3 to write |
| **D-AI-8** | User free text goes to a model in two places: the goal (AI-1) and the rest chat (AI-4). AI-2, 3, 7 receive no user text. About text already says both. Provider retention is still "to be confirmed" | Confirm, and fill the retention sentence |
| **D-AI-9** | Step names: written in the language of the goal, or English only? Canvas rules say "English only" for **his** lines | Step names follow the user's language; his lines stay English |

---

## 6. How the specs are written

Every AI-n file has: purpose · trigger and screens · inputs and variables (name, owner, source, frequency) · prompt block order and English text · output schema · guardrails · fallback · latency and cost · evaluation cases · open questions · hypothesis flags. "Hypothesis" means: not stated in any source, my proposal.

Wireframe vocabulary used in prompts: **Step**, **Done**, **Pause**, **Resume**, **Next step**. He is on a **parallel line**, not in the same room; he never says "step", "task", "timer", "app".

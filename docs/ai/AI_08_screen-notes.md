Imported from the planning folder on 2026-11-05. The decisions file docs/DECISIONS.md overrides this document where they differ.

> **Status after the decisions up to 2026-11-15 (#295).** The "Authored / model" and "Fallback" columns are superseded. F1 and F1S: the background card and the story cards are made ahead once per story part, read and published, and the app spreads the parts across the Steps (SHARED-STORY, CARDS-PER-PART); the cards of all parts are spread across the Steps and none is dropped, Step 1 opens with the background card and later Steps have no special opening card (CARDS-SPREAD); there is no time-up card or "still at it" card (T8, CARDS-SPREAD), no back-from-rest card and no bundled card (NO-BACKUP). R1: his stuck message is generated live with the pause number (F1, PAUSE-3). R2 and Back: the return pop-up, generated live (R1, T6). C1: live, no limit (R2). END: the closing line is made ahead (CLOSING-AHEAD). R-WARN is cancelled (F1). HOME-2 and HOME-4 do not exist (T6, H7, X3). There are no status lines; HOME-1 shows the last line he said in the most recent session (HOME-LINE). F1-CARD: tapping his portrait opens the "Who I am" sheet (PORTRAIT-SHEET). S1: two tiers (A5b). For every live line the fallback is the app's failure message with Retry, never an authored line (FAIL-SCREEN).

# AI-n tags for the prototype's per-screen notes

> For the prototype session to paste. Screen IDs are the prototype's `ORDER`. Each row: which AI feature touches the screen, whether the line is **authored** (picked by code) or **model** (written at runtime, behind AI-6 checks with an authored fallback), and the fallback. See [AI index](AI_00_index.md) and the canvas page "Features and screens".

| Screen | AI IDs | What on screen | Authored / model | Fallback |
|---|---|---|---|---|
| G3 New goal | AI-5 | Free-text goal; Next → dialogue | hook only | S1 |
| G4 / G4-N | AI-5 | "Start with…" editable | hook only | S1 |
| CPAGE / CPAGE-S | — | Begin → GD1 | — | — |
| GD1 | AI-5 | His opening (authored); goal input | authored + hook | S1 |
| GD2 | **AI-1a**, AI-5 | His reaction to the shape (authored line chosen by a one-word classifier); typed time | model (classify) → authored line | `confirm_goal` |
| GD3 | — | Buttons; his reply authored | authored | — |
| GD4 | **AI-1b**, AI-5 | Plan card (steps JSON); his intro and close authored | model (split) | GD-F |
| GD-F | AI-1, AI-5 | System voice; Try again / Start with one step | system | one-step plan |
| GD-N1 | **AI-1b** | One-step plan | model, or built in code | one-step plan |
| F1, F1S | **AI-2**, AI-3 | **Swipeable story cards per step**: landing+concern (first card), a state card every 15 foreground min, time-up card, and a back-from-rest card (model, AI-3). See AI_10 | authored (one model card) | bundled card; authored `return` |
| F1-CARD | **AI-2** | His line, where he is now, what he has done so far | authored | bundled |
| F2 | **AI-2** | Time-up becomes an appended card; timer stays 00:00 | authored | bundled |
| F3 | **AI-2**, AI-6 | Pre-written line, no error | authored | bundled |
| F4 | **AI-2** | Same state line, Paused | authored | — |
| ~~L1~~ | removed | Becomes the first card of the next step on F1 | — | — |
| ~~L2~~ | removed | Last Done goes to END; the last landing is input to AI-7 | — | — |
| R1 | **AI-3**, AI-4 entry, AI-6 | His stuck message appears a moment after Pause; "Start with…" | **model** (stuck story, call 1) | authored obstacle |
| R2 / Back | **AI-3**, AI-6 | His resolved line when the user taps Back (call 2) | model | authored return |
| C1 | **AI-4**, AI-6 | Free reply, no limit; new Back button returns to the task (fires the AI-3 resolved call) | **model** every reply | authored `rest_chat_fallback` |
| R-WARN (proposed) | AI-4 | System warning on the 3rd Pause in one step: his step will fail, start over (wording and meaning of fail open) | authored system text | — |
| S1 | AI-5 (parked) | Outside the story, system voice; placeholder only | code | — |
| END | **AI-7**, AI-6 | His closing line + hanging line; call starts on the last Done | **model** (1 call) | `closing_fallback` (Canyon ones to write) |
| HOME-1 | AI-2 | Last state line (no new line) | authored | — |
| HOME-2 | AI-2, AI-3 | One line from his side (Meanwhile, or resolved) | authored | — |
| HOME-4 | — | **Changed**: no landing card to return to; Continue opens F1 of the next step | system | — |
| ME | AI-5 | Nickname free text | hook only | S1 |
| other screens | — | no AI | — | — |

**Compact table (AI-n | purpose | screens | model or authored | fallback)**

| AI | Purpose | Screens | Model call or authored | Fallback |
|---|---|---|---|---|
| AI-1 | Goal text + minutes → N steps; shape tag picks his reaction line | GD2, GD4, GD-N1, GD-F | Model (2 small calls) | Retry once → GD-F; one-step plan; no silent generic steps |
| AI-2 | His story cards (landing+concern, state, time-up) and Home lines (spine) | F1, F1S, F1-CARD, F2, F3, F4, HOME-1/2 (L1, L2 removed) | Authored (model offline only) | Bundled lines + ambient |
| AI-3 | On Pause: a small thing that has him stuck; on Back: how it resolved | R1, R2/Back, HOME-2 | Model (2 calls) | Authored obstacle / return pool |
| AI-4 | Rest chat, no limit; 3rd Pause in a step shows a system warning | R1, C1, R-WARN | Model every reply; warning authored | Authored chat fallback (to write) |
| AI-5 (PARKED) | Input hook on every free-text field; output guard | S1 + all free-text screens | Code + small classifier (hypothesis) | Keyword layer; S1 never blocks Back |
| AI-6 | Parse, clean, rule checks, retry once, fallback | invisible | Code | Owns all fallbacks |
| AI-7 | End-of-story feeling line | END | Model (1 call) | `closing_fallback` |

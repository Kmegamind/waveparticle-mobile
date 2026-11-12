# Prototype v2: diff list (2026-11-05)

Compares `wp-prototype_2026-10-29_v1.html` (v1) with `wp-prototype_2026-11-05_v2.html` (v2).

Sources, in priority order: `docs/DECISIONS.md` (wins every conflict), `docs/FLOW.md` (screens and transitions), `docs/PRD.md` and `docs/USER_STORIES.md` (acceptance criteria), `docs/CONTENT_MODEL.md` (cards and pacing), and `DESIGN.md` (control shapes only).

v2 is a wireframe: grayscale plus one accent, no images, no web fonts, and no external requests.

## 1. Changes that apply to every screen

| Topic | v1 | v2 | Source |
|---|---|---|---|
| Vocabulary | "mission" appears 87 times (in code identifiers, plus one visible "Mission options" title). Visible text includes "Back to task", "Back to my task" and "Your task is still here". | Only Companion, Goal and Step. "Mission" and "Task" appear nowhere, not in the text and not in the code. | X1 |
| "His notes" | Still referenced (the "his notes drawer" content). | Removed. "What I have done" lives only inside F1-C. | FLOW 5 (F1-HIS) |
| Language | English. | English only, with no language row or switch anywhere. | L1 |
| Fonts and images | Google Fonts request and eight inline portraits (about 760 KB). | System font only. Portraits are gray boxes. Nothing is loaded from outside the file. | Task brief |
| Controls | Paper-tag buttons. | Capsule buttons (filled, tinted, gray, plain), grouped lists, segmented control, switch and stepper, all in grayscale plus one accent. | DESIGN 6 (shapes only) |
| Guide | Separate "Guide" view with notes. | A "Guide" tab lists every screen with a jump link. The panel beside the phone shows each screen's id, purpose and exits. | Task brief |

## 2. Screens

"In FLOW" means the screen is in the registry in FLOW section 2. "In v1" means v1 has a route or state that draws the screen.

| Screen | In FLOW | In v1 | What changes in v2 |
|---|---|---|---|
| AUTH-IN · Sign in | no (FLOW 3.3.1 and section 6: "not part of this screen set", Open question 13) | no | **Added, as the user asked.** Email and password, because LOGIN rules out magic links. This is the first screen at first open (ACC, US-ACC-1): nothing else can be reached until the user signs in. Has a link to Sign up. Sign in is refused until the email is confirmed (LOGIN-CONFIRM). The privacy notice link is a placeholder (US-ACC-4). |
| AUTH-UP · Sign up | no (same as above) | no | **Added.** Email and password, then the "Confirm your email" state. |
| AUTH-CONFIRM · Confirm your email | no (same as above) | no | **Added.** Tells the user to confirm the email before signing in (LOGIN-CONFIRM). For the demo, a button marks the email as confirmed and returns to Sign in. |
| HOME-0 · First visit | yes | yes | One card, "Let's launch your first wave", with **Choose a Companion**. No sample data and no "My Companions / No companions yet" section (H6, US-HOME-5). The portrait follows FLOW ("At your desk"); see Open question 3. |
| HOME-1 · Goal in progress, up to 3 days | yes | yes | Goal card with the title, the current Step and his line on a note. No "Start with…" note (X4). The ⋯ button opens HOME-MENU. "Start something else" opens Companions (Open question 5). Continue follows the return rule (F-RET if away 5 minutes or more). |
| HOME-2 · Back after 30 min to 3 days | no (removed, FLOW 5) | yes | **Removed.** HOME-1 covers the whole range. |
| HOME-3 · Welcome back, more than 3 days | yes | yes | System card. **Pick it back up** opens F1 with F-RET over it. **Start over** opens HOME-3B. The 24-hour rule is gone (T6). |
| HOME-3B · Start over | yes | yes | Wording changed: v1 says "Your steps stay as they are" and that his night does not restart. v2 says that his night begins again (T5). **Start from Step 1** restarts the Steps and his night and opens F1 at Step 1 with the background card. |
| HOME-MENU · Goal options | yes | yes | Title "Goal options" (v1: "Mission options" / "This goal"). Put on hold and Mark done, with a 5-second Undo toast and no dialog. |
| HOME (nothing in progress) | no screen id (FLOW 3.3.5, Open question 4) | v1 falls back to HOME-0 | v2 never falls back to HOME-0 (US-HOME-6). It draws a labelled placeholder ("small trace of the Companion, content not decided") with no invented content. See Open question 4. |
| COMP · Companions | yes | yes | Select first, then one **Enter** button, which is inactive until a Companion is selected (FLOW 7.13). Eight cards with a gray portrait box, three tags and one line. |
| CPAGE · Life Path | yes | yes | Opens at chapter 1 (M1). v1 opens at chapter 8 with seven "his memory" rows above it. All 26 chapters are shown, and the ones after the current chapter are **visible but not tappable** ("Later, not available") (D4). No markers, counts or locks (M3). No tab bar (Open question 7). Finished rows (after END → Next) are tappable but lead to LPH, which is not in this set, so a note says so (Open question 9). |
| CPAGE-S · One-story Companion | yes (conflict, Open question 7) | yes | Kept for the other seven Companions. **Begin** opens GD1. |
| GD1 · Opening | yes | yes | Chat composer with **Just split it**. Just split it uses a default of 30 minutes (v1: 60) (FLOW 7.21). An empty goal shows "Write one line first". Crisis text opens S1. |
| GD2 · He reacts, asks how long | yes | yes | Quick replies **30 min / 1 hour / 2 hours / Not sure**, plus a typed time (5 to 300 minutes, rounded to 15). No follow-up question for a vague goal (D1f). |
| GD3 · Split it finer? | yes | yes | The split question only, with two buttons and no input. The feeling question is removed (D1e). |
| GD4 · The plan | yes | yes | **No maximum number of Steps** (T2). Full editing: title, a one- or two-sentence description, and minutes with a stepper in steps of 15 (D1c, D1d). Remove, **Add a step** and **Split again**. The count line follows the edits ("3 steps · 60 min"). There is no over-time message. |
| GD-F · Split failed | yes | yes | System voice. **Try again**, **Use one step** and **Change my line**. Reached through the demo switch "Next split fails". |
| GD-N1 · One-Step plan | yes | yes | Count line "1 step · N min", no Remove button and no nudge to split. Start opens F1S. |
| F1 · Focus | yes | yes | **The Step opens with exactly one card** (X2): the background card for Step 1 and the card about what he just finished for later Steps (T9). Then **n story cards** (1 to 5, at least 5 minutes apart, n = min(5, floor(y/5))) arrive at y/n, 2y/n … y, and the n-th arrives at 00:00 (T1, T7, T8). v1 shows several cards at the start. The panel shows "My goal" in first person. No "Start with…". |
| F1S · Single Step | yes | yes | No "Step 1 of 1", no marks and no Your Steps list. |
| F1-E · Earlier card | yes | yes | Stack: **swipe the top card left** (or **‹ Earlier card**) to show the previous card, and swipe right (or **› Newer card**) to bring the newer one back. Dots show the position. The view resets to the newest card after Start in F-RET (X6). |
| F1-YOU · Your Steps open | yes | yes | Step titles only, with shapes for done, now and to do. The description appears under the current Step only. |
| F1-C · "Where I am now" | yes | yes | "Who I am" and "What I have done" (one line per finished Step). This replaces any separate list of his notes. |
| F1-N · Next Step, first frame | yes | yes | Done changes the page in place. The clock shows the new target and **holds for 1.2 s**, then starts by itself. Done is greyed during the hold. A "Step done · Undo" toast shows for about 8 s (X3, F3). |
| Undo of Done | (FLOW 3.9) | Only after the last Step, for 5 s | **Every Done can be undone** for about 8 s. Undo returns the previous Step with its cards, and its clock continues from the value at Done after the same 1.2-s hold. On the last Step the toast appears over END. |
| F2 · 00:00 | yes | yes | The clock stays at 00:00 and the n-th card arrives. Nothing else happens (no colour, no pop-up). The vibration is mentioned only in the annotation. |
| F3 · Cards failed | yes | yes | One bundled card, with the pager hidden and no error text. Reached through a demo switch. |
| F-RET · Return pop-up | yes | yes | One message in his voice and one button, **Start**. It appears after **‹ Back to step**, after being away 5 minutes or more (demo button), and after Continue on Home or Goals when the user was away 5 minutes or more. There is **no 24-hour limit** (T6, R1). Demo "System back" leaves to Home with the Step paused (T10). |
| R1 · Rest | yes | yes | Header: **‹ Back to step · Paused · Home**. "Back to task" is renamed (T10). **Pause has no limit** and no warning (F1). From the **3rd pause** in a Step his first message is stronger, and only the text changes (F1). |
| R1-C · Rest, chatting | yes | yes | No message limit (R2). Typing dots appear, then his reply. Crisis text opens S1. |
| R-OFF · Rest, no network | yes | yes | Bundled message, a disabled box, and "No connection. You can still go back to your Step." |
| S1 · Safety | yes | yes | Outside the story: system voice, no slip. "This is outside the story.", a placeholder body marked "pending legal and clinical review", **Get support now** (not linked in the prototype) and **Back to my Goal**, which returns with the field emptied. Two tiers only, crisis and ordinary stress (A5b). |
| END · Summary | yes | yes | His closing line, one thing he leaves hanging, the user's Steps as a plain list, and merged key moments when there are fewer Steps than key slices (C2). **Next** (v1: "Next night") opens CPAGE with the next chapter current. **Home**. The Undo toast appears on arrival. A one-time Goal moves to Done (G4). |
| ME · Me | yes | yes | Name, email, **Sign out**, Appearance, **Signals**, History, About the stories and Data. No Language, Reminders or Replay intro rows (L1). About and Data are listed but not drawn (not in FLOW). |
| SIG · Signals | no (FLOW section 6: "decided, not yet drawn", Open question 12) | yes (as ME-SIG, with 2 switches) | Drawn with the four rows that FLOW ME and US-GM-10 define: time-up signal, new-card signal, lock-screen notification, and "Keep the clock running when I leave" (G3, F2). Flagged as not in the FLOW registry. |
| ME-CAL · History open | yes | yes | Calendar marks only. Tapping a day lists its sessions, and tapping a session opens ME-REC. No weekly total (G1). |
| ME-REC · Session record | yes | yes | Date, duration, Goal name, and the Steps on which Done was pressed (G1, G2). |
| G1 · Goals, in progress | yes | yes | Tabs In progress, On hold, Done, History. + New goal, search, and Ongoing / One-time groups. Rows show Continue or Start and ⋯. |
| G2b · Goal menu | yes | yes | Put on hold or Mark done, with a 5-s Undo toast. |
| G3 · New goal | yes | yes | One question and an arrow, which opens GD1. |
| G4 / G4-N / G4-H · Goal detail | yes | yes | Steps are read-only, each with its description (no "Start with…", X4). A Type choice (One-time or Ongoing). Main button **Continue**, **Start** or **Resume**. History rows open ME-REC. |
| G5 / G5-D / G6 | yes | yes | On hold (Resume), Done (Reopen), History (rows open ME-REC, no weekly total). |
| L1, L2, HOME-4, R2, R-WARN, F4, F1-R, F1-HIS | no (removed, FLOW 5) | v1 has notes or leftovers for some (R-WARN in its AI notes, "his notes") | Not drawn. |
| PICK, LPH, S6, GD1-R, lock-screen notification, account deletion, About, Data, password reset | no (FLOW section 6) | no | **Not drawn.** Listed below. |

## 3. Decisions checked against v1

| Decision | v1 | v2 |
|---|---|---|
| Account required at first open, email and password (ACC, LOGIN, LOGIN-CONFIRM) | Missing: no sign-in or sign-up. | AUTH-IN, AUTH-UP and AUTH-CONFIRM come first. Sign out returns to AUTH-IN. |
| A Step opens with one card, then story cards 1 to 5 at least 5 minutes apart, at an interval of y/n, with the n-th at 00:00 (X2, T1, T7, T8) | Partly: some steps start with several cards. | The demo clock lets you jump forward (+5 min, To 00:00) to watch the n cards arrive on schedule. |
| Background card in his voice (T4, D3, M2) | Missing. | First card of Step 1, the oldest card in the stack, with no dismiss button. |
| Swipe left shows the previous card (X6) | Partly: a row with the oldest card at the left. | A stack, as decided, with buttons as an alternative to the gesture. |
| Done is always allowed and can be undone, with a 1.2-s hold (F3, X3) | Partly: undo only after the last Step. | Every Done can be undone, with an 8-s toast and the 1.2-s hold. |
| Pause has no limit, and from the 3rd pause the message is stronger (F1) | v1 code still mentions R-WARN. | No limit and no warning. Only the wording of his message changes from pause 3. |
| Return pop-up after Back or after 5 minutes or more away, with no 24-hour limit (R1, T6) | Present. | Present, and also triggered by Continue and Pick it back up when the user was away 5 minutes or more. |
| Start over restarts his night (T5) | Wrong: "steps stay as they are". | Correct. |
| "Start with…" cancelled (X4) | One mention left (AI note on G4). | None. |
| All 26 stories playable in order, later chapters visible but not tappable (D4, M1) | Opens at chapter 8. | Opens at chapter 1. Finishing a story makes the next chapter current. |
| No maximum number of Steps, "my goal" in first person (T2) | Check not needed after rebuild. | Add a step has no cap. The focus panel says "My goal". |
| Safety: crisis page outside the story (A5, A5b) | Present. | Present, with the vocabulary fixed ("Back to my Goal"). |
| English only (L1) | Yes. | Yes. |

## 4. Open questions (not drawn, or drawn with a placeholder)

1. **Sign-in screens are not in FLOW.** FLOW 3.3.1 and Open question 13 leave them out of the screen set. v2 draws them only from LOGIN, LOGIN-CONFIRM and US-ACC-1 because the brief asks for them. FLOW should add them (ids, copy, errors).
2. **Password reset** is required by LOGIN, but no screen or copy exists for it. Not drawn: there is no "Forgot password?" link.
3. **Portrait on HOME-0.** FLOW says "his portrait at a desk", but US-HOME-5 says "no portrait". v2 follows FLOW. Needs a decision.
4. **Home with nothing in progress** (after END, or after Put on hold or Mark done). The content of "a small trace of the Companion", and whether a New session action sits beside it, is not decided (FLOW Open question 4). v2 shows a labelled placeholder.
5. **"Start something else"** has no settled destination (FLOW Open question 5). v2 opens Companions, as v1 did.
6. **‹ on GD1** has no settled destination (FLOW Open question 6). v2 returns to the screen that opened the dialogue.
7. **CPAGE-S and the CPAGE tab bar** (FLOW Open question 7). v2 keeps CPAGE-S for the seven one-story Companions and draws no tab bar on CPAGE.
8. **Finished rows on the Life Path lead to LPH**, which is not in the set (FLOW Open question 9). v2 shows a note instead of a screen. S6 (the end of the path) is not drawn.
9. **Signals sub-page** is not in the FLOW registry (FLOW section 6, Open question 12). v2 draws it from FLOW ME and US-GM-10. Confirm it, or remove it.
10. **About the stories and Data (export and delete)** are rows on ME but have no screens in FLOW (US-ACC-5 and US-ACC-6 define them). Not drawn: tapping them shows a note.
11. **S1 button label.** FLOW says "Back to my Goal", but US-SAF-2 says "Back to my Step". v2 follows FLOW.
12. **Undo after leaving the app** while the toast is open is not specified (FLOW Open question 3). Not modelled.
13. **System back** on Home, Goals, Me and the root of Companions is not specified (FLOW Open question 16). Not modelled. System back is modelled only where FLOW defines it: F1 (as Pause), F-RET (to Home) and R1 (to Home).
14. **Loading, error and offline states** are missing for most screens (FLOW Open question 17). Only F3, R-OFF and GD-F are drawn.
15. **The demo time model is simplified.** The prototype uses a demo clock with buttons to skip time. The real app counts foreground time from timestamps (S2). Card arrival under "Keep the clock running when I leave" is not specified, so it is not modelled.

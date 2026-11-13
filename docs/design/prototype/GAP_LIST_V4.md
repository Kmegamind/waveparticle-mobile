# Differences between the built app and prototype version 4

Compared on 2026-11-12. Nothing on this list has been fixed; each screen with a difference has its own issue (see the last section).

## How the comparison was made

- **Reference:** the screenshots in `reference-screenshots/`, taken from prototype version 4 (`wp-prototype_2026-11-12_v4_live-ai.html`) in its sample-text mode. The measured values are in `TOKENS_FROM_V4.md`.
- **App:** `npm run dev` on `main` at commit `31f12dc` (no file under `src/` was changed), with `PROTOTYPE_ENABLED=1` so that the sign-in-free test path `/try` opens, and with the model variables left empty so no paid model call was made (the test path then uses its labelled test data). The pages were opened in Chromium at 390 by 800 pixels with a device pixel ratio of 2, which is the size of the prototype's phone, in both the light and the dark colour scheme of the operating system. The pictures are in `app-screenshots-2026-11-12/`. The Next.js development badge was hidden before each picture.
- **App values** (sizes, colours, fonts) were read with `getComputedStyle` in the same browser, the same way as the prototype's.
- **Size of a difference:**
  - **Large**: it changes the look of the whole screen or of its main control, or an element that carries meaning is missing.
  - **Medium**: a visible element is missing, in a different place, or styled clearly differently.
  - **Small**: a few pixels, a shade of colour, or different wording.

## What was compared

Eleven screens were compared: the four account screens, the safety page, the test path's start page, the four stages of the goal dialogue and the focus page.

| Prototype screen | App page | Pictures |
|---|---|---|
| AUTH-IN, Sign in | `/auth/sign-in` | [prototype](reference-screenshots/auth-in-day.png) · [app](app-screenshots-2026-11-12/auth-in-light.png) |
| AUTH-UP, Create an account | `/auth/sign-up` | [prototype](reference-screenshots/auth-up-day.png) · [app](app-screenshots-2026-11-12/auth-up-light.png) |
| AUTH-RESET, Forgot your password | `/auth/forgot-password` | [prototype](reference-screenshots/auth-reset-day.png) · [app](app-screenshots-2026-11-12/auth-reset-light.png) |
| AUTH-NEW-PASSWORD, Choose a new password | `/auth/update-password` | [prototype](reference-screenshots/auth-new-password-day.png) · [app](app-screenshots-2026-11-12/auth-new-password-light.png) |
| S1, Safety | `/safety` after a test message the local keyword check flags ("test input: suicide"; the check makes no model request) | [prototype](reference-screenshots/s1.png) · [app](app-screenshots-2026-11-12/s1-crisis-light.png) |
| CPAGE, Oppenheimer's Life Path (the current Story card) | `/try`, the test path's start page, which stands in for it | [prototype](reference-screenshots/cpage-day.png) · [app](app-screenshots-2026-11-12/cpage-light.png) |
| GD1, Goal dialogue opening | `/try/goal` | [prototype](reference-screenshots/gd1.png) · [app](app-screenshots-2026-11-12/gd1-light.png) |
| GD2, He reacts and asks how long | `/try/goal` after sending a Goal | [prototype](reference-screenshots/gd2.png) · [app](app-screenshots-2026-11-12/gd2-light.png) |
| GD3, Split it finer? | `/try/goal` after "1 hour" | [prototype](reference-screenshots/gd3.png) · [app](app-screenshots-2026-11-12/gd3-light.png) |
| GD4, The plan | `/try/goal` after "Keep it broad" | [prototype](reference-screenshots/gd4.png) · [app](app-screenshots-2026-11-12/gd4-light.png) |
| F1, Focus | `/try/focus` after Start | [prototype](reference-screenshots/f1.png) · [app](app-screenshots-2026-11-12/f1-light.png) |

Not compared, and why:

- **Home, Companions, Goals and Me** (HOME-0 to HOME-NONE, COMP, CPAGE-M, CPAGE-S, ME, SIG, ME-CAL, ME-REC, ACCOUNT-DELETE, G1 to G6): the app sends a signed-out visitor to sign in, and signing in needs an account in the shared Supabase project. No account was created for this comparison.
- **AUTH-CONFIRM** (confirm your email): the app has no page for it.
- **The rest page, the return pop-up and the summary** (R1, R1-C, R-OFF, F-RET, END) and the focus states F1S, F1-E, F1-YOU, F1-C, F1-N, F2, F3 and F3-X: `/try/rest` and `/try/end` answer 404 (not found) on `main`, and the focus states need timed or failed generation that the test data does not produce.
- **GD-F and GD-N1** (the split failed, a one-Step plan): not reached with the test splitter.
- The `/safety` page before a message is a test form ("Step", "Message", "Send") with no prototype counterpart; its pictures are kept as `safety-test-form-*.png` for reference only.

## Differences that appear on every compared screen

These are counted once here and not repeated in the screen tables below.

| # | What the prototype shows | What the app shows | Size |
|---|---|---|---|
| C1 | **Typefaces are loaded**: Atkinson Hyperlegible Next and Mono, Bricolage Grotesque and Newsreader, from Google Fonts. Titles are heavy Bricolage Grotesque, his words are Newsreader. | `src/app/tokens.css` names the same four typefaces, but no font file is loaded anywhere (no `next/font`, no `@font-face`, and the browser's font list is empty). Every text falls back to the system font, and his words to the system serif. | Large |
| C2 | **Paper-tag buttons** (decided by Yue on 2026-11-12): rounded rectangle with a 14 pixel radius, 56 pixels high, Atkinson 17 pixels at weight 700, a 1 pixel outline, and a 2 pixel bottom edge on the filled button. | Capsule buttons (radius 999 pixels), 50 pixels high (44 for small ones), system font 17 pixels at weight 600 with −0.022em letter spacing, no outline and no bottom edge. | Large |
| C3 | **Filled button colours, day skin**: pale green #C3E0C8 with near-black #050B06 text, outline and bottom edge #517E5A. | Dark green #426F4C with white text in the light scheme. In the dark scheme the fill (#A1CAA8) and text (#050B06) match the prototype, but the outline and edge (#6E9876) are missing. | Large |
| C4 | **Secondary button**: white `--raised` background, 1 pixel `--edge` outline, `--ink` text. | A gray mix fill (#D5D4D2 in light, #302E2D in dark) with a 1 pixel `--edge` outline, in capsule shape. On the crisis page the second button is a pale green tint with green text and a green outline. | Medium |
| C5 | **Session screens always use the dark Oppenheimer skin** (plum black #140D12, raised #292127, a green glow at the top right), in day and in night: the goal dialogue, the focus page, the rest page and the summary. | The goal dialogue and the focus page follow the phone's light or dark setting with the Shell colours (#EAE9E7 in light, #110F0D in dark). There is no Oppenheimer skin. | Large |
| C6 | **Glow**: Shell screens have a soft green glow in the top right corner (`--glow1`). | A flat page background with no glow. | Medium |
| C7 | **No app header** on the account and safety screens; the brand sits outside the phone in the prototype's page frame. | A header with the logo and "WaveParticle" at the top of the account and safety pages. | Medium |
| C8 | **No tab bar** on the account screens and the safety page. Where a tab bar is shown, it has icons, 12.5 pixel labels and a 3 pixel `--mark` bar above the selected item. | The tab bar (Home, Companions, Goals, Me) is shown on all four account pages and the safety page. It has text only, at 17 pixels and weight 400, on `--surface`, with no icons and no selected marker. | Medium |
| C9 | **Text links**: `--ink` (#1B1A19), 15 pixels, weight 700, underlined, centred under the form. | Accent green #37613F (#A1CAA8 in dark), underlined, 17 pixels; weight 400 on the account pages and 700 on the test path, left aligned. | Medium |
| C10 | **Small labels in capitals**: "MY GOAL", "YOUR GOAL", "YOUR STEPS", "SIGN IN", 12.5 pixels, weight 700, letter spacing 0.09em. | Sentence-case labels ("My goal", "Your goal", "Now"), 13 pixels, weight 600, system font. | Small |
| C11 | **Tape**: 58 by 17 pixels at the top left of the slip, rotated −4 degrees, 75% opacity (55% in the dark skins) with a thin ring; only the first slip of a conversation has tape. | 74 by 20 pixels, centred, rotated +2 degrees, solid #C3E0C8 (#2C4A33 in dark), on every slip. | Small |

## Differences on each screen

### AUTH-IN, Sign in

| What the prototype shows | What the app shows | Size |
|---|---|---|
| The title "Sign in" in Bricolage Grotesque at weight 800. | The title at weight 400 (the app's style sets 400, not only the missing font). | Large |
| The form sits in the vertical middle of the screen. | The form starts at the top, under the header. | Medium |
| A sentence under the title: "An account keeps your Goals and Steps on every device." | No sentence. | Medium |
| Three centred link lines: "Forgot your password?", "New here? Create an account" and "Privacy notice". | One left-aligned line, "Create an account · Reset your password". There is no Privacy notice link. | Medium |

### AUTH-UP, Create an account

| What the prototype shows | What the app shows | Size |
|---|---|---|
| The title at weight 800. | The title at weight 400. | Large |
| A back row above the title: "‹" and the label "SIGN IN". | A "Sign in" text link under the button. | Medium |
| A line under the button: "What is stored and what is sent to the language model:" with a "Privacy notice" link. | No privacy line and no link. | Medium |
| The form sits in the vertical middle of the screen. | The form starts at the top. | Medium |

### AUTH-RESET, Forgot your password

| What the prototype shows | What the app shows | Size |
|---|---|---|
| The title "Forgot your password" at weight 800. | The title "Reset your password" at weight 400. | Large |
| A sentence: "Enter your email. We will send a link to choose a new password." | No sentence. | Medium |
| A back row "‹ SIGN IN" above the title. | A "Sign in" text link under the button. | Medium |
| The button says "Send link". | The button says "Send reset email". | Small |
| The form sits in the vertical middle of the screen. | The form starts at the top. | Medium |

### AUTH-NEW-PASSWORD, Choose a new password

| What the prototype shows | What the app shows | Size |
|---|---|---|
| The title at weight 800, on two lines. | The title at weight 400, on one line. | Large |
| The field label is "New password". | The field label is "Password". | Small |
| The button says "Save password". | The button says "Update password". | Small |
| The form sits in the vertical middle of the screen. | The form starts at the top. | Medium |

### S1, Safety

| What the prototype shows | What the app shows | Size |
|---|---|---|
| Everything sits in one white card (`--raised`, 24 pixel radius, 1 pixel `--edge` outline) in the vertical middle of the screen. | No card; the title, text and buttons are on the page background, spread from top to bottom. | Medium |
| Two buttons, 56 pixels high. | Two buttons about 102 pixels high each (they stretch to fill the space). | Large |
| A lead sentence: "If you are thinking about hurting yourself or someone else, please reach out to people who can help right now." | No lead sentence; "PLACEHOLDER: legal body text is not available yet." | Medium |
| The placeholder for the legal text and the hotlines is one dashed-outline box between the text and the buttons. | Two plain "PLACEHOLDER" paragraphs, one above and one below the buttons. | Small |
| The second button says "Back to my Goal". | The second button says "Back to my Step". | Small |

### CPAGE, the Life Path (compared with the test path's start page)

The Life Path itself is not built yet; it is planned in Sprint 6 (#96 for the page, #50 for the current Story card). `/try` is a test stand-in, so this row records the distance, and no new issue is opened for it.

| What the prototype shows | What the app shows | Size |
|---|---|---|
| A header with "‹ COMPANIONS", a round portrait, the name "Oppenheimer" and the tags "Brilliant · Eloquent · Haunted"; a timeline with period headings, finished chapters with an italic line, the current Story as a card with its title, a description and Begin, later chapters with title and description, and the tab bar. | "Test build", the title "Oppenheimer", "Story: The Canyon and the Mesa", "No Goal yet.", a Begin button and a "Reset test data" button. No portrait, tags, timeline, card or tab bar. | Large |

### GD1, Goal dialogue opening

| What the prototype shows | What the app shows | Size |
|---|---|---|
| A header with "‹", a 40 pixel round portrait and the name "Oppenheimer". | Only "‹". | Medium |
| The composer is at the bottom of the screen: a rectangular field (14 pixel radius) with the placeholder "Say it in one line", and a separate 52 by 52 pixel paper-tag send button with a right arrow. "Just split it" is centred under it. | The composer is directly under his slip: a capsule field with the placeholder "Write one line" and a round 44 pixel dark green send button with an up arrow inside it. "Just split it" is left aligned in green. | Medium |
| His slip leaves space on the right (about 322 pixels wide). | His slip is full width (346 pixels). | Small |

### GD2, He reacts and asks how long

| What the prototype shows | What the app shows | Size |
|---|---|---|
| His reaction and his question in one slip: "That has a clear edge to it. How long do you have?" | Two slips: "That has edges I can see from here." and "How long do you have?" | Medium |
| The user's message in a dark `--surface` bubble with a thin `--hair` border and corners of 16, 16, 4 and 16 pixels. | A filled dark green bubble (#426F4C) with white text and even corners. | Medium |
| The time chips sit at the bottom above the field, with a 12 pixel radius. The field's placeholder is "Or type a time, like 45 or 1.5 hours". | The chips sit right under his question, in capsule shape. The placeholder is "45 or 1.5 hours". "Just split it" is still shown. | Medium |

### GD3, Split it finer?

| What the prototype shows | What the app shows | Size |
|---|---|---|
| The user's answer reads "60 min", and his next slip asks "Do you want it cut fine, or kept in a few broad pieces?" | The answer reads "1 hour", then an extra slip "Then I will keep to the same span.", then "Do you want it cut fine, or left in broad pieces?" | Small |
| "Split it finer" and "Keep it broad" are chips at the bottom of the screen. | The two choices are shown as the user's own bubbles in the thread. | Medium |

### GD4, The plan

| What the prototype shows | What the app shows | Size |
|---|---|---|
| The plan card starts with the label "YOUR STEPS" and an editable "Goal" field. | The card starts with the Goal as a bold heading; there is no Goal field. | Medium |
| Each Step row has a green numbered circle, the title, the minutes in the mono face and up and down buttons to reorder. Descriptions are not shown in the list. | Each Step row has the title, the minutes and the description, with a divider; no number and no reorder buttons. | Medium |
| "+ Add a step" is an underlined link on the same row as "2 steps · 60 min"; "Split again" is a centred link inside the card. | "2 steps · 1 hour" on its own line, a gray capsule "Add a step" button, and "Split again" as a left-aligned link outside the card. | Medium |
| Start is a full-width paper tag pinned to the bottom of the screen. | Start is a capsule under the card that scrolls with the page. | Medium |
| His line before the plan: "Here is how I would cut it. Argue with it now, in ink, where it's cheap." | "Here it is on paper; argue with it now, in ink, where it's cheap." | Small |

### F1, Focus

| What the prototype shows | What the app shows | Size |
|---|---|---|
| A top row with "STEP 1 OF 4" on the left and paired step ticks on the right, then the timer centred below in Atkinson Hyperlegible Mono at 46 pixels. | "Step 1 of 4" in small text on the left and the timer on the right at 58.5 pixels; no step ticks. | Medium |
| A "MY GOAL" row with his 40 pixel round portrait next to the label and his goal. | "My goal" and his goal, with no portrait. | Medium |
| The card stack: his slip with a "RIGHT NOW" label inside it, the edges of the cards behind it drawn under it, and the dots with "‹" and "›" chevrons inside the slip. | One slip with no label and no card edges, and "‹ Earlier card", a dot and "Newer card ›" as text buttons under it. | Medium |
| A "YOUR GOAL" panel (`--raised`, 14 pixel radius, thin border) with the Goal, "NOW" and the Step, its description and a "Your steps ▾" link. | No panel: "Your goal", the Goal, "Now", the Step in bold and its description as plain text, and a "Your Steps" button. | Medium |
| Done is a wide filled paper tag and Pause a narrower secondary one, both 56 pixels high, pinned at the bottom. | Done and Pause as capsules (see C2 to C4); the description text runs under them at the bottom of the screen. | Medium |

## Intentional differences, not counted

- The "Test build" badge on every `/try` page and the "Test data: chapter 8 cards" label on the focus page are required for test builds (`docs/decisions/0011`).
- The Story and its words differ: the test path plays chapter 8 ("The Canyon and the Mesa") with labelled test data, and the prototype's sample mode plays chapter 1 ("The Trade of a Theorist"). That is content, not design.
- The timer value differs because the Steps have different lengths.
- The prototype's dashed "OPEN" boxes (on AUTH-RESET and AUTH-NEW-PASSWORD) are notes for reviewers, not product text.

## Count

- Screens compared: **11**.
- Differences: **11** that appear on every compared screen (C1 to C11), plus **41** on single screens, **52** in total. By size: 10 Large, 32 Medium, 10 Small.

## Issues opened

One issue per compared screen that has a real difference (the Life Path is already covered by #96 and #50):

- #229 Design: match the Sign in screen to prototype v4 (AUTH-IN)
- #230 Design: match the Create an account screen to prototype v4 (AUTH-UP)
- #231 Design: match the Forgot your password screen to prototype v4 (AUTH-RESET)
- #232 Design: match the Choose a new password screen to prototype v4 (AUTH-NEW-PASSWORD)
- #233 Design: match the Safety page screen to prototype v4 (S1)
- #234 Design: match the Goal dialogue opening screen to prototype v4 (GD1)
- #235 Design: match the Goal dialogue: reaction and time question screen to prototype v4 (GD2)
- #236 Design: match the Goal dialogue: split question screen to prototype v4 (GD3)
- #237 Design: match the Goal dialogue: the plan screen to prototype v4 (GD4)
- #238 Design: match the Focus page screen to prototype v4 (F1)

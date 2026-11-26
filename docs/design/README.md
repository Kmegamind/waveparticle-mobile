# Design
Mockups, user flows and prototypes. Tokens and rules code must follow live in `/DESIGN.md`; this folder holds the artifacts and the reasoning.

## The reference
The design reference of this repository is **prototype version 4**, `prototype/wp-prototype_2026-11-12_v4_live-ai.html`, from 2026-11-12. It is version 3 of the wireframe (all decisions of 2026-11-12) with the visual design of the earlier designed prototype (`wp-prototype_2026-10-29_v1.html`) put back, live Claude text, a prompt panel, all 26 Oppenheimer Stories and Moriarty Story 1. What it is and what it is not is written in its notes file, `prototype/wp-prototype_2026-11-12_v4_live-ai_notes.md`. Both files are copies of the planning folder files, byte for byte; do not edit them here.

How the reference and `DESIGN.md` relate, until `DESIGN.md` is rewritten from the measurements:

- For how a screen looks (colours, type, spacing, radii, shadows, control shapes), the prototype as the browser renders it wins. The measured values are in `prototype/TOKENS_FROM_V4.md`, together with every place `DESIGN.md` disagrees.
- Buttons are the prototype's paper-tag buttons, not the Apple-style capsule buttons of `DESIGN.md` section 6.1. Yue decided this on 2026-11-12.
- For which screens and features are built, the decision log (`docs/DECISIONS.md`) and the screen registry (`docs/FLOW.md`) still decide. The prototype shows demo-only controls (the Guide, the prompt panel, the "Where the text comes from" switch) that are not part of the product.

Do not read the prototype as text: it is about 1.2 megabytes, mostly portrait images. Open it in a browser instead.

1. Serve the folder with a server that sends `text/html; charset=utf-8`. The file has no charset meta tag, so a plain `python3 -m http.server` shows broken quotes and arrows. One way: `cd docs/design/prototype && python3 -c "import http.server as h; H=h.SimpleHTTPRequestHandler; H.extensions_map['.html']='text/html; charset=utf-8'; h.ThreadingHTTPServer(('127.0.0.1',3200),H).serve_forever()"`.
2. Open `http://127.0.0.1:3200/wp-prototype_2026-11-12_v4_live-ai.html`. Opened like this, Claude is not connected and the page uses its sample text, which is what the screenshots show.
3. Jump to any screen by its screen id: the Guide tab lists them, and in a script an element with `data-jump="<screen id>"` that is clicked does the same.

## Files
| Flow / screen | File | Status |
|---|---|---|
| Screens and jump rules (all screens, states, rules) | [../FLOW.md](../FLOW.md) | Draft, follows `docs/DECISIONS.md` |
| **Prototype version 4 (reference)** | [prototype/wp-prototype_2026-11-12_v4_live-ai.html](prototype/wp-prototype_2026-11-12_v4_live-ai.html) with [its notes](prototype/wp-prototype_2026-11-12_v4_live-ai_notes.md) | **The reference since 2026-11-12.** Designed look (day, night and Oppenheimer skins), paper-tag buttons, 49 screens |
| Reference screenshots of version 4 | [prototype/reference-screenshots/](prototype/reference-screenshots/) | 77 pictures: each Shell screen in the day and the night skin, each session screen in the Oppenheimer skin. File names are the screen id in lower case, then `-day` or `-night` for Shell screens |
| Measured values of version 4 | [prototype/TOKENS_FROM_V4.md](prototype/TOKENS_FROM_V4.md), raw data in [prototype/prototype-v4-computed.json](prototype/prototype-v4-computed.json) | Read from the browser's computed styles on 2026-11-12, not copied from the source |
| Differences between the built app and version 4 | [prototype/GAP_LIST_V4.md](prototype/GAP_LIST_V4.md), app pictures in [prototype/app-screenshots-2026-11-12/](prototype/app-screenshots-2026-11-12/) | One row per difference, measured on 2026-11-12. Nothing is fixed yet |
| Interactive wireframes (greyscale), version 2 | [prototype/wp-prototype_2026-11-05_v2.html](prototype/wp-prototype_2026-11-05_v2.html); what changed from version 1 is in [prototype/wp-prototype_2026-11-05_v2_diff.md](prototype/wp-prototype_2026-11-05_v2_diff.md) | **Superseded by version 4 on 2026-11-12.** Kept for history; do not build from it. Before that, version 1 (published version 8) is replaced by version 2 and is no longer the reference |
| **Admin prototype (reference for every admin page)** | [prototype/admin-prototype.html](prototype/admin-prototype.html) | Byte copy of the owner's `2_Areas/Product/content-admin/admin-prototype_2026-11-14_v1.html` (2026-11-14), copied on 2026-11-25 for #432. HTML only; do not edit it here. See "The admin prototype" below |
| Admin AI feature screens (drawn, #432) | [prototype/admin-ai-features.html](prototype/admin-ai-features.html), pictures in [reference/admin/](reference/admin/) | Eight screens in the admin prototype's look: AI features index, feature page (a) to (f), published and draft prompt, test results, status editor, pass standard editor, purpose and approach editor, feature and prompts. Sample text only |
| Admin visual gate (#435, #439, #453) | [../../e2e/admin-visual.spec.ts](../../e2e/admin-visual.spec.ts), pictures `reference/admin/<frame\|ai-index\|ai-feature\|ai-status\|ai-status-writer\|ai-pass\|ai-purpose>-<1024\|1280>-{prototype,live,side-by-side}.png` | Compares the computed styles of the admin's fixed components with `prototype/admin-prototype.html` (standards mode), and those of the AI feature pages with `prototype/admin-ai-features.html` (#439) at 1024 and 1280 px (#453 adds the status editor as admin and as writer, the pass standard editor and the purpose and approach editor); over 1 px or a different colour fails. #483: one spec file per admin page: `e2e/admin-visual.spec.ts` holds the frame and shared components, `e2e/admin-visual-<page>.spec.ts` each page's own `COMPONENTS`, pages and exceptions (overview, companions, companion-profile, stories, story-cards, app-text, prompts, publish-history, hotlines, ai-features, ai-registry), and [../../e2e/support/admin-visual.ts](../../e2e/support/admin-visual.ts) the shared readers, `differences()`, the shared exceptions, the prototype loading and the picture writer. A page pull request extends its own file. `node scripts/admin-visual-inventory.mjs` lists every comparison and exception, to check that a reshuffle loses none. `ADMIN_VISUAL_SCREENSHOTS=1` rewrites the pictures |
| Design tokens and components | [../../DESIGN.md](../../DESIGN.md) | Proposed (version 7). Disagrees with version 4 in the places listed in `prototype/TOKENS_FROM_V4.md`; its values are not changed yet |

## Re-capturing the pictures and values
With the prototype served as above, from the repository root:

- Reference screenshots: `node scripts/design/capture-reference.mjs scripts/design/reference-screens-v4.json`.
- Measured values: `node scripts/design/probe-prototype-v4.mjs > docs/design/prototype/prototype-v4-computed.json`.

The app screenshots were taken from `npm run dev` with `PROTOTYPE_ENABLED=1` and the model variables left empty (so no paid model call was made), at 390 by 800 pixels, which is the prototype's phone size. Open the app at `http://localhost:3000`, not `127.0.0.1`: in this test, on `127.0.0.1` the page's live-reload connection failed and the page never became interactive (no opening line, typed text lost), while on `localhost` it worked. The cause was not investigated.

## The admin prototype
`prototype/admin-prototype.html` is the owner's admin prototype, copied byte for byte from `2_Areas/Product/content-admin/admin-prototype_2026-11-14_v1.html` (dated 2026-11-14, SHA-256 `4579c320d93192bd3df1907574e8cc0ff52bbc1a5a1f19626577014fa77b58bf`). Only the HTML was copied, none of the planning notes in that folder. Do not edit it here; a new version from the owner replaces it as a whole.

The file has no doctype and no charset. Opened as it is, the browser uses quirks mode and may show broken quotes and arrows. Screenshots and computed-style checks therefore add `<!doctype html><meta charset=utf-8>` in front of the file at capture time (for example with a Playwright route that rewrites the response); the file itself stays unchanged.

**Rule for the visual gate (coordinator, 2026-11-25): the reference is the standards-mode render**, that is the prototype with `<!doctype html><meta charset=utf-8>` added at capture time, as the artifact host does. The live Next.js admin always renders in standards mode. This is not neutral: quirks mode changes how tables look. Measured in Chromium on 2026-11-25 (`#history` page, 1280 px):

| | Quirks mode (file opened as it is) | Standards mode (doctype added, the reference) |
|---|---|---|
| Table text (`table`, plain `td`) | 16 px, line height `normal` | 14 px, line height 1.5 (21 px) |
| `th`, `td.note` | 11 px and 12.5 px, line height `normal` | 11 px and 12.5 px, line height 1.5 |

Owner to confirm: standards mode (the default above) or keep the 16 px table look. Serve it as in step 1 above and open `http://127.0.0.1:3200/admin-prototype.html`; each page has a hash, for example `#prompts`.

`prototype/admin-ai-features.html` draws the AI feature screens the prototype lacks (#430, #432). Its CSS is the prototype's CSS unchanged (the prototype's `--bg`, `--panel`, `--ink` ... tokens have the same values as the app's `--adm-*` tokens in `src/app/tokens.css`), without the phone-width block, plus a few rules built from the same tokens. It starts with a doctype and charset, so it renders like the prototype does with them added. Screens: `#index`, `#feature`, `#prompt`, `#tests`, `#status`, `#pass`, `#purpose`, `#mapping`. The pictures in `reference/admin/ai-features-<screen>.png` were taken at 1280 by 1200 pixels, full page; `ai-features-status-writer.png` is the status editor seen by a writer (read-only). Purpose text, pass questions and source lines are placeholders, never real wording.

The same file also draws the AI feature registry screens (#467), from the owner's handoff of 2026-11-26: `#reg-registry` (the registry table, `/admin/ai-features`), `#reg-feature` (feature detail), `#reg-run` (the Run panel), `#reg-lab` (comparison lab, `/admin/ai-lab`), `#reg-runs` (Runs, `/admin/ai-runs`) and `#reg-samples` (Samples, `/admin/ai-samples`). Each takes a state after a slash: `admin`, `writer`, `empty`, `loading`, `error` (an error with Retry) or `running` (run in progress), for example `#reg-lab/error`; the feature screens also take a row id, for example `#reg-feature/admin/P-05`. The rail lists the screens and, on these screens, the states. Row text comes only from the handoff's `registry-seed.json`; seed examples that quote story text are left out, and prompt texts, excerpts, people, tokens and costs are invented placeholders marked as sample. The pictures `reference/admin/ai-registry-<screen>-<state>-<width>.png` were written by `test_467_registry_reference_pictures` (`ADMIN_VISUAL_SCREENSHOTS=1`) at 1024 and 1280 px, full page. Until live pages exist, `test_467_registry_prototype_screens_keep_the_prototype_frame_*` checks every screen and state against the prototype's frame.

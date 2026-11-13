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
| Design tokens and components | [../../DESIGN.md](../../DESIGN.md) | Proposed (version 7). Disagrees with version 4 in the places listed in `prototype/TOKENS_FROM_V4.md`; its values are not changed yet |

## Re-capturing the pictures and values
With the prototype served as above, from the repository root:

- Reference screenshots: `node scripts/design/capture-reference.mjs scripts/design/reference-screens-v4.json`.
- Measured values: `node scripts/design/probe-prototype-v4.mjs > docs/design/prototype/prototype-v4-computed.json`.

The app screenshots were taken from `npm run dev` with `PROTOTYPE_ENABLED=1` and the model variables left empty (so no paid model call was made), at 390 by 800 pixels, which is the prototype's phone size. Open the app at `http://localhost:3000`, not `127.0.0.1`: in this test, on `127.0.0.1` the page's live-reload connection failed and the page never became interactive (no opening line, typed text lost), while on `localhost` it worked. The cause was not investigated.

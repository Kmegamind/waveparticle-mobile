# Proposed `DESIGN.md` changes (version 8, issue #245)

Agents may not edit `DESIGN.md` (the guardrail hook blocks it), so the change is a patch for a human to review and apply: `DESIGN_md_changes.patch` in this folder.

To apply it, run this from the repository root on this branch:

```bash
git apply docs/design/prototype/DESIGN_md_changes.patch
```

`git apply --check` passes against `main` at `7052fc0` (the merge of #244). The values come from `TOKENS_FROM_V4.md` (measured in a browser from prototype version 4) and from `src/app/tokens.css` and `src/app/globals.css` as merged in #244. Contrast ratios were computed with the WCAG formula.

Yue's decisions that the patch writes down:

- Buttons are the prototype's paper tags, not Apple-style capsules.
- The filled button has three tokens of its own: `--tag-fill`, `--tag-ink` and `--tag-edge`. `--control` keeps its other jobs.
- The tab bar shows on the Life Path, the Companion pages and the session record, as in the prototype (`docs/FLOW.md` 3.2, changed in this pull request).

## Sections changed

| Section | What changes, in plain words |
|---|---|
| Header | Version 8, dated 2026-11-13. |
| 0 How to read | Adds a "What changed in version 8" list. Strikes out the version 7 line about Apple capsule controls and marks it superseded. Sources: prototype version 4, rendered in a browser, is the reference for looks. The Apple-button mock-up is struck out and is no longer a reference. |
| 2 Principles | Principle 3 changes from "native controls look like iOS" to "plain paper-tag controls, personal surfaces". |
| 3.1 Light Shell | Adds `--tag-fill` #C3E0C8, `--tag-ink` #050B06, `--tag-edge` #517E5A and `--tape` (#C3E0C8 at 75%), with contrast ratios. `--control` is no longer the filled button background; it keeps the focus ring and switch on. Links and button labels are `--ink`, not `--accent-text`. `--tint` and `--gray` are no longer button backgrounds. Notes that the app's `--faint` is #62615F, not the prototype's #646361. |
| 3.2 Dark Shell | Adds the `--tag-*` values (#A1CAA8, #050B06, #6E9876) and `--tape` (#A1CAA8 at 55%). Notes that the prototype's night accent is #89B992 (open). |
| 3.4 Oppenheimer skin | `--glow-1` is settled as #12261A, tape opacity as 55%, and the `--tag-*` values are added. The session pages always use this skin. |
| 3.5 Glow | The gradient snippet uses the measured positions (60% 34% at 92% 4%, and 70% 44% at 2% 104%). |
| 3.6 Typography | Controls use Atkinson, not the system font, so the to-reconcile note is gone. Fonts are self-hosted with `next/font`. Button label is 17 px at weight 700 (small 14 px) with no letter spacing. Links are `--ink`. New rows: small label (12.5 px, 0.09em, capitals) and card title (27 px). Tab label is 12.5 px (800 when selected). The 13 px minimum rule points to the open item. |
| 3.7 Spacing | Tab bar padding is 6, 8 and 12 px plus the safe area. Button side padding is 18 px (14 px small). |
| 3.8 Radii | Buttons and the send button are 14 px, not capsules. The chat composer is 14 px. Chips are 12 px. New rows: tape 3 px and tab mark 2 px. The segmented control is marked open. |
| 3.9 Shadows | "The old 2 px paper thickness shadow is gone" is replaced by the 2 px bottom edge of the filled paper tag. Stacked shadows are allowed for the focus card stack. Shadow tokens are declared again in each skin block. |
| 3.11 Migration | The old `--fill`/`--onfill`/`--fillb` map to `--tag-fill`/`--tag-ink`/`--tag-edge`, the prototype's `--tape` to `--tape`, and `--r-control` to `--r-field` for buttons. |
| 5 Implementation | The code sample drops the system-font `--sys` token and adds the `--tag-*` and `--tape` tokens and `--type-shell`. It points to `src/app/tokens.css` and the skin wrapper. |
| 6.1 Buttons | Rewritten as paper tags: filled, secondary and plain, with classes, colours, outline, 2 px edge, 14 px radius, 56/44 px height, padding, Atkinson 17 px at 700, and recomputed contrast. Links are `--ink`. The capsule rules and the "no paper tag" sentence are removed. The prototype's focus ring difference is noted as open. |
| 6.2 Segmented control | Marked open. The prototype's look is written down, and the version 7 capsule text is kept only until that is decided. |
| 6.5 Text field | The chat composer is a 14 px rectangle with a 52 px paper-tag send button, not a capsule with a round button. The 48/50 px height difference is noted. |
| 6.6 Tab bar | Rewritten as built in #240: order, 24 px icons with a 1.8 stroke, 12.5 px labels, 52 px items, selected item in `--ink` at weight 800 with a 3 px `--mark` bar, others in `--ink-2` at 600, `--bg` background and padding. Where it shows (including the Life Path and the session record) points to FLOW 3.2. |
| 6.7 Sheet | No handle, as in the prototype. Close is a secondary paper tag. |
| 6.10 Chips | 12 px radius instead of a capsule (as in the prototype and the app's `--r-chip`). |
| 6.11 Slip with tape | Tape is 58 by 17 px, top left, −4°, `--tape`, with a 1 px ring. Only his first slip in a chat thread has tape. The user's messages use Atkinson and the prototype's bubble, not a `--control` bubble. |
| 8 Test checklist | Item 8 names the paper-tag button styles instead of gray and tinted. |
| 11 Conflicts | Settled rows are removed: Oppenheimer glow, tape opacity, chip shape, control typeface, token names and the old focus ring row. Only open items stay, as prototype against app: night accent #89B992 against #A1CAA8; focus ring #355E3F with a 2 px offset against `--control` with a 3 px offset; the 12.5 px minimum font size; light `--faint`; plain button outline; card border and shadow; text field height; timer size; segmented control; edge contrast. |
| 12 Open items | Item 3 (control typeface) is settled. Item 11 (migrating to capsules) is superseded, with a pointer to `GAP_LIST_V4.md` and issues #229 to #238. |

Not changed: sections 1, 3.3, 3.10, 4, 6.3, 6.4, 6.8, 6.9, 6.12, 6.13, 7, 9 and 10. Nothing in them describes the capsule button, and the prototype shows nothing new there that #240 built.

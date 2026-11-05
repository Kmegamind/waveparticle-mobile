# WaveParticle design system

Audience: engineers building the mobile app. Date: 2026-11-05. Status: draft, version 7.

## 0. How to read this document

This document covers **visual style only**: tokens, theming, control styles, imagery, the hand layer, motion principles, and accessibility baselines. It does not describe what is on each screen, how screens connect, what buttons are called, or how any feature behaves. Those live in `docs/FLOW.md`, `docs/PRD.md`, `docs/USER_STORIES.md`, `docs/CONTENT_MODEL.md` and `docs/DECISIONS.md`. When the wireframes change, those documents follow the wireframes; this one does not need to.

**What changed in version 7** (decisions of the product owner, 2026-11-05):

1. **Controls follow native Apple (iOS) styles:** capsule buttons in four styles (filled, tinted, gray, plain), and iOS-style segmented control, stepper, switch, field and tab bar. This replaces the earlier "paper tag" button.
2. **Functional and screen-specific content was removed** (screen layout guide, card stack, timer, return pop-up, Life Path and history rows, companion selector, reading order per screen, fixed button vocabulary). Version 6 is in git history for anyone who needs it. Where a rule such as "the clock holds for 1.2 seconds after Done" was only recorded here, it is also recorded in `docs/FLOW.md` or `docs/DECISIONS.md`; **this was checked by searching those files for the main topics, not line by line.**
3. Unchanged: warm greys plus one soft accent plus imagery; the desk-mate language (slip of paper with tape); the hand layer (Shantell Sans, informality 0); light diffuse glow with no off switch; no Chinese handwriting (the product is English only).

**Status of the visuals.** The high-fidelity visual design is not final. Every colour, typeface and font size here is **proposed, subject to the high-fidelity pass**. The structure, the control rules and the accessibility rules are firm. Build every colour and font as a token so that a change is made in one place.

**Sources and precedence.**

1. `docs/DECISIONS.md` is authoritative. Where it contradicts older text, it wins.
2. The Chinese design file `1_Projects/Newfeatures/design.md` (version 7) is the source of this document.
3. The mock-up `design-mockups_2026-11-05_v7_apple-buttons.html` shows the new controls on five wireframe screens. The older interactive prototype still uses the previous token names and the paper-tag button (see section 3.11).

**Conflicts.** Where two sources disagree and no decision settles it, both values are listed and marked **to reconcile** (section 11). Contrast ratios were computed with the WCAG relative-luminance formula from the stated hex values; ratios marked "design file" were copied from it.

## 1. Brand and logo

The logo file is `3_Resources/Brand_Assets/logo/logo.svg`. It is an SVG wrapper around a raster image (a PNG embedded as base64), showing a black wave and three dots on a transparent background. Because it is a raster inside an SVG, it does not scale infinitely; ask for a true vector before shipping large placements.

- On light backgrounds, show the logo as supplied (black).
- On dark backgrounds, invert it (`filter: invert(1)`). Do not recolour it with the accent colour.
- The header shows the logo at 54 by 20 CSS pixels (`object-fit: contain`) next to the product name set in the display typeface at 20 px, weight 800, letter spacing -0.02em.
- The logo appears only in the app header or about screen, never on a focus screen.

## 2. Principles

1. **The companion is a desk mate, not a coach.** Controls sit side by side; his words arrive as a slip of paper with a piece of tape. Nothing performs, celebrates or scolds.
2. **Colour budget.** Interface colour comes from three sources only: warm grey neutrals, one soft accent colour (default sage green; mauve is the alternative), and the colour inside the images. No orange or blue as an interface colour; the product owner excluded both.
3. **Native controls, personal surfaces.** Controls look like iOS, so they are already familiar. Personality comes from the slip, the hand layer, the light and the images, not from unusual buttons.
4. **State is never carried by colour alone.** Shape, text, position and typeface do the work. The interface must still work with the accent removed.
5. **Every control has a visible boundary** of at least 3:1 against the page: a solid fill or a 1 px outline.
6. **Shell can be loud, session must be quiet.** Large titles and cards are fine in the Shell; session screens stay calm, with one primary action.
7. **Red lines.** No reward mechanics: no points, streaks, timed rewards or rarity. No glass or blur-through materials.

## 3. Design tokens

Token names are CSS custom properties. Use the long names in the app.

### 3.1 Colour: Shell, light theme (default accent: sage)

| Token | Hex | Role | Ratio on raised | Ratio on bg |
|---|---|---|---|---|
| `--bg` | `#EAE9E7` | Page background (warm grey paper) | n/a | n/a |
| `--surface` | `#F3F2F1` | Secondary surface | n/a | n/a |
| `--raised` | `#FFFFFF` | Cards, slips, fields | n/a | n/a |
| `--ink` | `#1B1A19` | Body text | 17.4:1 | 14.3:1 |
| `--ink-2` | `#434240` | Secondary text | 10.0:1 | 8.3:1 |
| `--faint` | `#646361` | Weakest text (AA only, never body text) | 6.0:1 | 4.9:1 |
| `--edge` | `#81807D` | Control outlines (at least 3:1) | 3.9:1 | 3.3:1 |
| `--hairline` | `#D3D1CD` | Decorative dividers only, never a control boundary | n/a | n/a |
| `--control` | `#426F4C` | Filled control background; switch on; selected tab; focus ring; tinted outline | n/a | 4.8:1 |
| `--on-control` | `#FFFFFF` | Text on a filled control | 5.8:1 on `--control` | n/a |
| `--accent-text` | `#37613F` | Accent used as text (tinted and plain buttons, links) | 4.9:1 on `--tint` | n/a |
| `--tint` | `--control` at 14% over `--bg` | Tinted button background | n/a | about 1.2:1 |
| `--gray` | `#3C3A37` at 12% over `--bg` | Gray button, segmented track, stepper, switch off | 11.7:1 for `--ink` on it | about 1.2:1 |
| `--mark` | `#62906B` | Small accent mark (selected dot, hand-drawn marks) | 3.7:1 | 3.0:1 |
| `--fill-soft` | `#C3E0C8` | Tape colour, soft decorative fill | n/a | 1.2:1 |
| `--glow-1` | `#CFE7D3` | Diffuse light, pale green | decorative | n/a |
| `--glow-2` | `#E7E2DA` | Diffuse light, warm cream | decorative | n/a |

Important: the tinted and gray fills are almost the same lightness as the page (about 1.2:1). Their boundary is carried by a 1 px outline (section 6.1). Never remove it.

Body text target is 7:1. `--ink` and `--ink-2` meet it on both surfaces. On a glow area `--faint` is 4.6 to 4.7:1 (design file), which is why light-theme glows must never be darker than the values above.

### 3.2 Colour: Shell, dark theme (sage)

| Token | Hex | Ratio |
|---|---|---|
| `--bg` / `--surface` / `--raised` | `#110F0D` / `#1A1815` / `#262421` | n/a |
| `--ink` | `#EFEEED` | 13.4:1 on raised; 16.5:1 on bg |
| `--ink-2` | `#CBCAC8` | 9.5:1 on raised; 11.7:1 on bg |
| `--faint` | `#A5A4A2` | 6.2:1 on raised; 7.7:1 on bg |
| `--edge` | `#7C7A77` | 4.5:1 on bg; 3.6:1 on raised |
| `--hairline` | `#2D2B28` | decorative |
| `--control` | `#A1CAA8` | 10.5:1 on bg |
| `--on-control` | `#050B06` | 10.9:1 on `--control` |
| `--accent-text` | `#A1CAA8` | 7.3:1 on `--tint` |
| `--tint` | `--control` at 18% over `--bg` | about 1.4:1 on bg |
| `--gray` | `#EBEBF5` at 14% over `--bg` | 11.7:1 for `--ink` on it; about 1.4:1 on bg |
| `--mark` | `#719F7A` | 6.3:1 on bg |
| `--fill-soft` | `#2C4A33` | decorative |
| `--glow-1` / `--glow-2` | `#102515` / `#1A1814` | decorative |

### 3.3 Alternative accent: mauve (only accent-related tokens differ)

The choice between sage and mauve has not been made (section 12).

| Token | Light | Dark |
|---|---|---|
| `--control` | `#874E6A` (5.2:1 on bg) | `#E3ABC4` (9.9:1 on bg) |
| `--on-control` | `#FFFFFF` (6.3:1) | `#10060A` (10.3:1) |
| `--accent-text` | `#6E3D55` (5.8:1 on tint) | `#E3ABC4` (7.0:1 on tint) |
| `--mark` | `#AD718D` (3.1:1) | `#BA7D99` (5.9:1) |
| `--fill-soft` | `#F3CADC` | `#4A2A3A` |
| `--glow-1` | `#F7D5E4` | `#2F1522` |

Rejected accents: orange or terracotta and blue or indigo (excluded by the product owner); lavender (too close to blue and too typical of generic AI products); butter yellow (cannot reach 3:1 as a thin line on a light background).

### 3.4 Colour: the Oppenheimer skin (night)

The only skin that corresponds to a real companion: a dark theme with a plum-black base, hue about 335 degrees, saturation 0.02 or less. Accent and control colours are the same as the dark Shell.

| Token | Hex | Ratio |
|---|---|---|
| `--bg` / `--surface` / `--raised` | `#140D12` / `#1D161B` / `#292127` | n/a |
| `--ink` | `#F1EDF0` | 16.5:1 on bg; 13.5:1 on raised |
| `--ink-2` | `#CEC9CC` | 11.7:1 on bg; 9.6:1 on raised |
| `--faint` | `#A8A3A6` | 7.7:1 on bg; 6.3:1 on raised |
| `--edge` | `#7F787D` | 4.5:1 on bg; 3.6:1 on raised |
| `--hairline` | `#31282E` | decorative |
| `--control` / `--on-control` | `#A1CAA8` / `#050B06` | 10.9:1 |
| `--mark` | `#719F7A` | 6.3:1 on bg |
| `--glow-1` | `#12261A` in the old prototype; `#102515` in the design file | **to reconcile** |
| `--glow-2` | `#1F141D` | decorative |
| `--tape` | `rgba(161,202,168,.55)` | decorative |

Tape opacity is **to reconcile** (70% of the soft fill in the design file; 75% light and 55% dark in the prototype). Two further sample skins in the design file (Kinetic, Noir) were invented only to test the architecture; they are not companions and must not be built.

### 3.5 Diffuse light and grain

- No more than two glows per screen, at the corners, never directly behind text.
- Lightness difference from the background is tiny: +0.04 to +0.07 in dark themes, -0.02 to -0.03 in light themes.
- First glow uses the accent family; the second a warm neutral.
- Text on a glow must still pass contrast (re-test with the glow as the background).
- Grain only on the light Shell background, opacity 4% or less. Session screens have no grain.
- Glows do not move by default. There is **no user switch** to turn glow or grain off (decided).
- Not allowed: gradients as button backgrounds, multicolour gradients, glass or blur-through materials.
- Session screens: background colour, glow, and a scene image in the top 40% that fades out before the text area.

```css
.diffuse{ background:
  radial-gradient(62% 38% at 90% 5%, var(--glow-1), transparent 70%),
  radial-gradient(72% 46% at 4% 102%, var(--glow-2), transparent 70%), var(--bg); }
```

### 3.6 Typography

All typefaces are proposed. Licences and tabular-number support have not been verified.

| Role | Typeface | Notes |
|---|---|---|
| **Control text** | **System font** (`-apple-system`, SF Pro on Apple devices; `system-ui` elsewhere) | Part of the native look |
| Titles, large numerals | Bricolage Grotesque (variable, open licence) | Weight 800, letter spacing -0.02em to -0.025em; may be too distinctive |
| Body | Atkinson Hyperlegible Next | Designed for low-vision readers |
| Fixed-width numerals | Atkinson Hyperlegible Mono, `font-variant-numeric: tabular-nums` | |
| Companion's voice (skin) | Newsreader for Oppenheimer | A serif belongs to Oppenheimer only. Each skin names one voice typeface with its licence |
| Hand layer (accents only) | Shantell Sans, INFM 0, BNCE 0, weight 500 to 600 | Chosen by the product owner (section 7) |

**To reconcile:** controls use the system font while body text uses Atkinson. Two sans faces side by side may look inconsistent. Options: keep as is, or use Atkinson for everything (then buttons are less "native").

Type scale (CSS pixels):

| Style | Size / line height | Weight |
|---|---|---|
| Display title | 32 / 1.08, letter spacing -0.025em | 800 |
| Sheet title | 22 / 1.2 | 800 |
| Large numeral | 64 to 78 / 1, tabular digits | 600 |
| Slip text, large / medium / small | 21 / 1.42; 18 / 1.5; 16 / 1.45 | voice font |
| Body | 17 / 1.5 | 400 |
| **Button label** | **17 / 1, letter spacing -0.022em, system font** | **600** |
| Link | 15 / 1.2, underlined | 700 |
| Caption | 13.5 / 1.4, `--ink-2` | 400 |
| Tab bar label | 13 / 1.1 | 600 |

Reading rules (hard): body 17 px with 1.5 line height; line length at most about 60 characters; left aligned; paragraph spacing at least 0.75 line; minimum font size 13 px; text survives 200% enlargement; Shell large titles run at most 3 lines.

### 3.7 Spacing

Use these values; do not invent others without agreement.

| Use | Value |
|---|---|
| Screen padding | 26 px top, 22 px sides, 16 px bottom |
| Gap between two side-by-side buttons | 10 px |
| Gap inside a tab bar item (icon to label) | 3 px |
| Tab bar padding | 8 px top and sides, 26 px bottom (includes the home indicator area; use the device safe area in the app) |
| Segmented track padding | 3 px |
| Minimum touch target | 44 by 44 px (`--target: 44px`) |

A full spacing scale (for example 4, 8, 12, 16, 24) is not specified; it is an open item.

### 3.8 Radii

| Use | Radius |
|---|---|
| Buttons, segmented control, stepper, switch, send button | fully rounded (capsule, 999 px) |
| Text field (single line) | 14 px (`--r-field`) |
| Chat composer field | capsule |
| Cards | 24 px (`--r-card`) |
| Slip (story note) | 12 px (`--r-note`) |
| Sheet, top corners | 28 px |
| Toast | 12 px |
| Round avatar or portrait button | 50% |

### 3.9 Shadows and elevation

- One layer only, very light, for the feel of paper. Card and slip: `0 10px 20px -14px` in `--ink` at 45% mix.
- The boundary of any control must never rely on a shadow.
- The selected thumb of a segmented control may carry a small shadow (`0 1px 3px` at 18% black) because it is a thumb on a track, not a boundary.
- The switch knob carries a small shadow, as on iOS.
- No inner shadows other than the 1 px outline trick (`inset 0 0 0 1px`), no stacked shadows, no skeuomorphic knobs. The old 2 px "paper thickness" shadow is gone.

### 3.10 Motion

| Event | Motion | With reduced motion |
|---|---|---|
| Button press | Scale to 97% and opacity 85%, 120 ms | Opacity only |
| Screen change inside a flow | Horizontal push, 250 ms | Fade |
| Slip arrival | Fade in plus 4 px upward, 200 ms | Show directly |
| Sheet or dialog opens | 200 ms fade of the shade and the surface | Show directly |
| Skin beat (companion's gesture) | At most 600 ms, one per moment, never loops; for Oppenheimer, a line drawn under the text | Show the final state directly |
| Brand motion | Wave collapses into dots, at most 1.2 s | Static row of dots |
| Numerals | Change directly, no tween | Same |
| Glow | None by default | None |

The red line is reward mechanics, not motion as such. Nothing flashes. Beats are the companion's action, never a reward for the user. Sound and haptics are off by default.

### 3.11 Migration from the old token names

The older prototype and any code written against version 6 use the old names.

| Old | New |
|---|---|
| `--accent` (as text or line) | `--accent-text` for text; `--control` for lines, rings and fills |
| `--fill`, `--on-fill` (primary button) | `--control`, `--on-control` |
| `--fill` (tape) | `--fill-soft` |
| `--fill-border` | removed; filled buttons have no outline, tinted use `--control`, gray use `--edge` |
| `--r-control` (14 px) | capsule for buttons; `--r-field` (14 px) for fields |
| prototype abbreviations `--hair`, `--onfill`, `--fillb`, `--glow1`, `--glow2` | long names |

## 4. Visual conventions

### 4.1 Voice typeface versus system typeface

His words use the skin's voice typeface and sit on a slip. System words (buttons, errors, safety page, settings) use the Shell typeface and have no slip and no tape. This is how the user tells "he is speaking" from "the app is speaking", and it does not rely on colour.

### 4.2 Images (where colour comes from)

| Type | Specification | Rules |
|---|---|---|
| Companion portrait | 3:4, painterly pastel with fine grain recommended | Neutral frame; colour comes from the picture; alt text is the companion's name |
| Scene background | 9:16, top 40% is the picture, the lower area is blank so it can fade | No text, no faces (or very small and blurred), no spoilers; readable after blur; fade ends before the text area |
| Prop or small object | Transparent PNG or SVG, at most 160 pt | Decorative: empty alt text |

An art bible (brush style, grain, saturation ceiling, outline) must exist before real images are commissioned; otherwise images from different companions clash in a neutral interface. Images may use orange or blue; the interface does not.

Spoiler rule for the Oppenheimer skin: no mushroom cloud or explosion imagery on session screens, the companion's path or the end screen. Third-party characters and film villains require legal review before official likenesses are used.

### 4.3 Colour-blind and greyscale

Every state must be readable in greyscale (shape, typeface, position, text label). With the accent removed the interface still works. The generator guarantees numbers, not colour-blind distinctness; shape and typeface provide that.

## 5. Architecture: Shell and Skin

| | Shell (the product) | Skin (one per companion) |
|---|---|---|
| Contains | Components, type scale, control shapes, motion rules, accessibility, neutrals and accent | Images (portraits, scene, props); the companion's voice typeface; a base-colour tendency; one beat |
| Who changes it | The design-system owner | The person making that companion, by filling in a form only |

**Skin contract:**

1. A skin supplies only a hue and a very small saturation (at most 0.02) as its base-colour tendency. Glows use the Shell accent family. A skin must not introduce a new accent colour and must not use orange or blue.
2. Images follow section 4.2.
3. One voice typeface, with its licence stated.
4. One beat, at most 600 ms, which is the companion's action and not a reward; reduced motion shows the final state.
5. A skin must not change: control sizes, type scale, touch targets, focus rings, or error and safety pages.
6. A new skin must pass the contrast generator before release.

**The Shell always overrides the skin** for error and system messages, safety pages, and the about page.

**Implementation.** Tokens are CSS custom properties on a root class (`.skin-opp` is the reference). The Shell sets defaults on `:root`; light and dark follow the system and can be overridden. A skin class replaces only the tokens in section 3.4.

```css
:root{ --bg:#EAE9E7; --surface:#F3F2F1; --raised:#FFFFFF; --ink:#1B1A19; --ink-2:#434240; --faint:#646361;
  --edge:#81807D; --hairline:#D3D1CD;
  --control:#426F4C; --on-control:#FFFFFF; --accent-text:#37613F; --mark:#62906B;
  --tint:rgba(66,111,76,.14); --gray:rgba(60,58,55,.12); --fill-soft:#C3E0C8;
  --glow-1:#CFE7D3; --glow-2:#E7E2DA;
  --r-field:14px; --r-card:24px; --r-note:12px; --target:44px;
  --sys:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif; }
```

(`--tint` and `--gray` above are the composed colours for the light theme; in the app derive them from `--control`, `--ink`-family bases with `color-mix` so dark and mauve follow.)

## 6. Components (style only)

Each lists visual rules. Targets are at least 44 by 44 px unless stated. Behaviour is in `docs/FLOW.md`.

### 6.1 Buttons

| Style | Background | Text | Outline | Use |
|---|---|---|---|---|
| **Filled** | `--control` | `--on-control` | none | The one main action on a screen |
| **Tinted** | `--tint` | `--accent-text` | 1 px `--control` | A secondary action that still matters |
| **Gray** | `--gray` | `--ink` | 1 px `--edge` | A neutral action that can be skipped |
| **Plain** | transparent | `--accent-text` | none | Back, cancel, low-priority actions |

- Shape: capsule. Height: 50 px standard, 36 px small, plain at least 44 px.
- Text: system font, 17 px, weight 600, letter spacing -0.022em. No 2 px bottom edge, no 1.5 px outline "paper tag".
- Two buttons in a row: about 62% and 38%, gap 10 px; at 200% text size they stack.
- Pressed: scale 97%, opacity 85% (reduced motion: opacity only).
- Focus: 3 px `--control` ring, offset 3 px, never hidden by a pinned bar.
- Disabled: opacity 35% and not clickable. Disabled must not be the only way to convey a reason; a visible text explains it where it matters.
- Computed contrast (sage): filled against the page 4.8:1 light, 10.5:1 dark; filled text 5.8:1 and 10.9:1; tinted text on tint 4.9:1 light, 7.3:1 dark; gray text 11.7:1. The tinted and gray fills alone are only about 1.2 to 1.4:1 against the page, so the 1 px outline is what makes the boundary.
- Text link: bold, always underlined, hit area at least 44 by 44.

### 6.2 Segmented control

Capsule track in `--gray` with a 1 px `--edge` outline and 3 px padding; the selected segment is a `--raised` capsule with a light shadow and `aria-pressed` (or `role="radio"`); each segment at least 38 px tall, track at least 44 px; the set does not wrap.

### 6.3 Stepper

One capsule, `--gray` with a 1 px `--edge` outline; minus and plus halves 56 by 44 px with a thin divider; the value sits outside the capsule in the numeral face. A disabled end is dimmed and also exposes a disabled state. No drag slider (WCAG 2.5.7).

### 6.4 Switch

51 by 31 px. Off: `--gray` with a 1 px `--edge` outline. On: `--control`. White knob with a light shadow; its position also changes, so state is not colour alone. A visible text label always sits beside it.

### 6.5 Text field

Single line: at least 50 px high, radius 14 px, `--raised` fill, 1 px `--edge` inset outline, label above, associated with a label element, errors in words, typed content never lost. Focus: the same 3 px ring. Chat composer: capsule field with a 44 px round send button in `--control`.

### 6.6 Tab bar

Bottom, iOS style. Each item: a 26 px icon (1.7 stroke) over a 13 px label at weight 600, minimum 64 by 44 px. Selected item uses `--control` and `aria-current="page"`; others use `--faint`. 1 px `--hairline` above the bar. The bar background is `--bg` at no less than 92% opacity (no blur). The tab bar never moves. Which tabs exist and in what order is in `docs/FLOW.md`.

### 6.7 Sheet

Bottom sheet over a shade (`rgba(0,0,0,.38)`). Top corners 28 px, `--raised`, a handle, a title (22 px), content, and a visible Close button (plain or gray). `role="dialog"`, focus moves in and is trapped, background inert, Esc and the system back gesture close it, focus returns to the opener. Maximum height 80%, scrolls inside.

### 6.8 Toast

Bottom of the screen above the tab bar. `--ink` background with `--bg` text, radius 12, 14.5 px text, an optional plain-style action. Visible 5 seconds; pauses while it has focus or is hovered; `role="status"`.

### 6.9 Card

`--raised`, radius 24, light paper shadow. If the whole card is clickable, wrap it in one button.

### 6.10 Chips

Height 44, capsule, 1 px `--edge` outline, label 15 px weight 600. Selected: `--tint` background, 1 px `--control` outline and a **check mark**, so selection is not colour alone. Groups are keyboard operable.

### 6.11 Slip with tape

His one-way words appear on a slip.

- `--raised` surface, radius 12, a single light paper shadow, padding about 14 to 18 px, text in the skin's voice typeface.
- The whole slip may tilt by at most 1 degree. The text is never rotated on its own.
- Tape: a strip about 74 by 20 px centred on the top edge, `--fill-soft`, rotated 2 degrees, purely decorative and hidden from screen readers.
- Not clickable. No "he says" prefix for screen readers.
- System text has no slip and no tape.
- The user's own messages: system font, right aligned, no slip; a `--control` bubble with `--on-control` text is allowed (contrast passes).
- Sizes: large 21/1.42, medium 18/1.5, small 16/1.45.

### 6.12 List row

Height at least 64 px, text on the left, an action or chevron on the right. A swipe action must also exist in an overflow menu or on the detail page; no function depends on a gesture. State is shown by shape (solid dot, open ring, dotted circle), not colour.

### 6.13 Popup menu

Opens from a 44 by 44 trigger; items at least 44 px tall; focus moves into the menu and returns on close; Esc closes; the trigger exposes `aria-haspopup` and `aria-expanded`. Visual style is an open item.

## 7. Hand layer (decorative)

A thin decorative layer; with it removed the product is complete. Proposed, subject to the high-fidelity pass.

- **Typeface:** Shantell Sans, INFM 0, BNCE 0, weight 500 to 600, with fallback to Patrick Hand then the system font.
- **Allowed uses (only these):** short Shell labels of at most 4 words at 20 px or larger; a small annotation next to a current item; the companion's initial at the end of a slip. The initial is a generic hand-written letter; a real person's actual signature is never used.
- **Never used for:** buttons, numerals or timers, inputs, the user's own text, errors, safety pages, slip text, or any text that is the only carrier of information.
- **Minimum 18 px, weight 500 or higher;** at most 4 words per line; same contrast as other text; b/d, p/q, I/l, O/0 must be distinguishable in testing.
- **Hand-drawn marks:** inline SVG, 2.4 to 4.6 px round strokes in `--mark` or `--ink-2`, static, at most 2 per screen, hidden from screen readers, never the only carrier of meaning.
- **User control:** a "Plain text" preference swaps the hand font back to the body face and makes marks straight lines; layout must not shift.
- A hand label that repeats visible text is hidden from screen readers.
- Any "draw-in" animation is at most 600 ms and shows its end state under reduced motion.
- There is no Chinese hand font; the product is English only.

```css
:root{ --hand:"Shantell Sans","Patrick Hand",system-ui,sans-serif; }
.hand{ font-family:var(--hand); font-weight:600; font-variation-settings:"INFM" 0,"BNCE" 0; }
.plain-text .hand{ font-family:var(--sans); font-variation-settings:normal; font-weight:700; }
.mark-svg{ stroke:var(--mark); stroke-width:2.4; fill:none; stroke-linecap:round; }
```

## 8. Accessibility

The baseline is **WCAG 2.2 level AA**. Failing a rule below blocks release. How each screen reads aloud is specified with the screen in `docs/FLOW.md` and the wireframes.

- **Contrast:** text 4.5:1 minimum (body text target 7:1); control boundaries and meaningful graphics 3:1 (1.4.11). Recompute any text on a glow with the glow as the background. Every control in section 6 has either a solid fill that reaches 3:1 or a 1 px outline that does.
- **Targets:** at least 44 by 44 px for every interactive control.
- **State never by colour alone:** shape, label, position, typeface, or fill plus a check mark (1.4.1).
- **Alternatives to gestures and dragging:** every swipe has a button alternative; stepper rather than drag (2.5.7).
- **Reflow and text size:** 200% text without loss; no horizontal scroll at 320 px width; side-by-side buttons stack at large sizes (1.4.4, 1.4.10).
- **Reduced motion:** honour the system setting everywhere (section 3.10). No flashing (2.3.1). Beats never loop; the glow never moves (2.2.2).
- **Focus:** visible 3 px ring, logical order, pinned bars must not hide the focused element (2.4.3, 2.4.7, 2.4.11).
- **Consistency:** the tab bar never moves; skins never change layout (3.2.3, 3.2.4).
- **Errors:** described in words; typed content kept; no picture puzzle on any sign-in or save step (3.3.1, 3.3.3, 3.3.7, 3.3.8).
- **Images:** portraits have the companion's name as alt text; scene and props have empty alt text.
- **Decorative items** (tape, hand-drawn marks, hand labels that duplicate visible text, props) are hidden from assistive technology.
- **User preferences:** light and dark follow the system and can be overridden; Plain text (section 7); reduced motion; increased contrast; larger text; sound and haptics off by default. No transparency setting because there are no translucent materials. Glow and grain have no switch (decided).

**Test checklist**

1. Run every skin through the contrast generator, then spot-check with a contrast tool in light and dark.
2. Swap the scene image for the lightest and darkest candidates; check text stays readable.
3. Set text to 200% on every screen type.
4. Walk through with VoiceOver and TalkBack.
5. Operate the app with a keyboard only.
6. Turn on reduced motion; beats are static and glows do not move.
7. Convert screens to greyscale; check every state is readable.
8. Check every outlined control (gray, tinted, segmented, stepper, switch off) in light, dark and mauve: boundary at least 3:1 against the page.
9. Hand layer: Plain text keeps layout; test strings for b/d/p/q, I/l/1, O/0; marks are silent in screen readers.
10. Test with real low-vision and screen-reader users.

## 9. Voice rules for interface copy (tone only)

- **His voice:** first person, concrete, short sentences; in the skin's voice typeface on a slip.
- **System voice:** neutral, begins with a verb, no emotion; Shell typeface; no slip.
- Tone: quiet and kind. No exclamation marks, no emoji, no cheering, no urgency.
- Forbidden: guilt or loss phrasing, streaks.
- The exact button words, labels and vocabulary (Companion, Goal, Step) are in `docs/DECISIONS.md` and `AGENTS.md`; the screen copy is in the screen documents.

## 10. Where the removed content lives

| Removed from this file | Look in |
|---|---|
| Screen layout guide, reading order per screen | `docs/FLOW.md` and the wireframes |
| Card stack, return pop-up, timer, Done and Pause behaviour, Undo toast behaviour | `docs/FLOW.md`, `docs/PRD.md`, `docs/DECISIONS.md` |
| Life Path and history rows, companion selector | `docs/FLOW.md`, `docs/PRD.md` |
| Fixed button words, label rules | `docs/DECISIONS.md`, `docs/CONTENT_MODEL.md` |
| Version 6 text (paper tag, all of the above) | git history of this file |

## 11. Conflicts to reconcile (summary)

| Item | Value A | Value B |
|---|---|---|
| Oppenheimer `--glow-1` | `#12261A` (old prototype) | `#102515` (design file) |
| Tape opacity | 70% of the soft fill (design file) | 75% light, 55% dark (old prototype) |
| Chip height | 40 px (design file) | 44 px (old prototype and target rule) |
| Minimum font size | 13 px (design file) | 12.5 px and 11.5 px in the old prototype |
| Control typeface | System font for controls (this version) | Atkinson for everything (earlier versions) |
| Token names | `--control`, `--on-control`, `--accent-text` (this version) | `--fill`, `--on-fill`, `--fill-border`, `--accent` (old prototype and version 6) |
| Focus ring | 3 px `--control`, offset 3 (this version, decided with the controls) | 2 px accent (version 6) |
| Edge contrast on the page | `--edge` is 3.3:1 on the light page and 4.5:1 on the dark page, computed | The earlier English file listed 3.9:1 on the raised surface |

Resolved by version 7 and no longer conflicts: dark paper-tag outline, tab bar height and current marker (now section 6.6).

## 12. Open design items

1. Accent colour: sage or mauve. Contrast is guaranteed; beauty must be judged with real art. Needs a decision.
2. Whether the Shell default is light or dark. Needs a decision.
3. Control typeface: system font with Atkinson body, or Atkinson throughout (section 3.6).
4. The art bible (brush, grain, saturation ceiling, outline). Needed; owner not assigned.
5. Font licences and tabular-number support are not verified; Bricolage Grotesque may be too distinctive. Designer to confirm.
6. Official likenesses of anime characters and film villains. Legal review.
7. New control tokens are not yet in `tools/skin_gen.py`; mauve values were only spot-checked; nothing is validated on real devices, with colour-blind simulation, or with screen readers.
8. Dark-theme outlines on the switch (off) and segmented control were not inspected one by one.
9. Research limits: the references were read as text, not screenshots (except Monspeak); no documented shipped productivity tool with a hand-written feel was found. A designer should recheck.
10. No full spacing scale; the popup menu visual style is missing.
11. `src/app/tokens.css` (issue #126) implements the version 6 token names (`--accent`, `--fill`, `--on-fill`, `--fill-border`, `--r-control`) and the paper-tag button. It must be migrated to the names and control styles in sections 3 and 6 (see 3.11) in a separate issue; until then the code and this file disagree and this file wins.

# WaveParticle design system

Audience: engineers building the mobile app. Date: 2026-11-05. Status: draft.

## 0. How to read this document

This document turns the design system into things an engineer can build: tokens, a model for theming, components with rules, accessibility requirements, and voice rules for interface copy.

**Status of the visuals.** The high-fidelity visual design is not final. The team is working wireframe first. Every colour, typeface and font size in this document is therefore **proposed, subject to the high-fidelity pass**. The structure, the component rules and the accessibility rules are firm. The hex values are the ones in the current design file and the interactive prototype, and they have been checked for contrast, but a designer may still change them. Build every colour and font as a token so that a change is made in one place.

**Sources and precedence.**

1. The decisions file `docs/DECISIONS.md` (decisions of 2026-11-04 and 2026-11-05) is authoritative. Where it contradicts older text, it wins.
2. The design file, version 6, supplies the token values and the rationale.
3. The interactive prototype supplies the CSS variables actually used on screen. The prototype is a wireframe only; its greyscale `.wire` variant is not a product theme and is ignored here.
4. The wireframe set for focus and rest (version 6) supplies component and accessibility behaviour.

**Conflicts.** Where two sources disagree and no decision settles it, both values are listed and marked **to reconcile**. Nothing in this document is an invented value. Contrast ratios marked "computed" were calculated for this document from the stated hex values using the WCAG relative-luminance formula; the others are copied from the design file.

**Decisions that change older text** (applied throughout):

- Vocabulary is **Companion, Goal, Step**, and no other words are used for the user's work. The older design file says "Characters" for the tab; the interface word is **Companions**.
- Each step has a short title and a description of one or two sentences; the description is shown read only on the focus page.
- There are no pages between steps. Done updates the same page.
- Story cards appear one at a time and use a stack gesture (section 6.5). A step has 1 to 5 story cards that arrive at y/n, 2y/n ... y minutes; the first step opens with the background card and later steps open with the card about what he just finished.
- Done is always allowed and every Done can be undone.
- After Done, the clock holds still for 1.2 seconds and then starts without a tap.
- Pause has no limit, no warning and no extra screen. The change after the third pause is in the character's words only.
- A return pop-up (section 6.17) appears before the clock restarts after Back to step on the rest page and after 5 minutes or more away.
- The product is English only. There is no language setting.

## 1. Brand and logo

The logo file is `3_Resources/Brand_Assets/logo/logo.svg`. It is an SVG wrapper around a raster image (a PNG embedded as base64), showing a black wave and three dots on a transparent background. Because it is a raster inside an SVG, it does not scale infinitely; use it at the sizes the prototype uses and ask for a true vector before shipping large placements.

Usage rules:

- On light backgrounds, show the logo as supplied (black).
- On dark backgrounds, invert it. The prototype does this with `filter: invert(1)` when the dark theme is active. Do not recolour it with the accent colour.
- The prototype header shows the logo at 54 by 20 CSS pixels (`object-fit: contain`) next to the product name set in the display typeface at 20 px, weight 800, letter spacing -0.02em.
- The logo appears only in the app header or about screen. It never appears on the focus screen.
- The logo animation used when a goal is split into steps (the wave collapsing into a row of dots, 1.2 seconds at most) is a brand motion described in section 4.7.

## 2. Principles

1. **The companion is a desk mate, not a coach.** Controls sit side by side. His words arrive as a slip of paper with a piece of tape. Nothing performs, celebrates or scolds.
2. **Colour budget.** Interface colour comes from three sources only: warm grey neutrals, one soft accent colour (default sage green; mauve is the alternative), and the colour inside the images. No orange or blue is used as an interface colour; the product owner excluded both.
3. **Shell can be loud, session must be quiet.** The Shell (section 5) may use large titles and cards. The focus screens must stay calm: one primary action per screen, nothing moving.
4. **State is never carried by colour alone.** Shape, text, position and typeface do the work. The interface must still work with the accent colour removed.
5. **Red lines.** No reward mechanics: no points, no streaks, no timed rewards, no rarity. Sound and haptics are off by default and never occur during focus (see the conflict at the end of section 4.7).

## 3. Design tokens

All tokens are proposed, subject to the high-fidelity pass. Token names below are the CSS custom property names used in the design file and prototype. In the prototype a few names are abbreviated (`--hair` for `--hairline`, `--onfill` for `--on-fill`, `--fillb` for `--fill-border`, `--glow1` and `--glow2` for `--glow-1` and `--glow-2`). Use the long names in the app.

### 3.1 Colour: Shell, light theme (default accent: sage)

Contrast ratios are against `--raised` (white) for text tokens, as stated in the design file, with the ratio against `--bg` computed for this document in the last column.

| Token | Hex | Role | Ratio on raised | Ratio on bg (computed) |
|---|---|---|---|---|
| `--bg` | `#EAE9E7` | Page background (warm grey paper) | n/a | n/a |
| `--surface` | `#F3F2F1` | Secondary surface | n/a | n/a |
| `--raised` | `#FFFFFF` | Cards, slips, inputs | n/a | n/a |
| `--ink` | `#1B1A19` | Body text | 17.4:1 | 14.3:1 |
| `--ink-2` | `#434240` | Secondary text | 10.0:1 | 8.3:1 |
| `--faint` | `#646361` | Weakest text | 6.0:1 | 4.9:1 |
| `--edge` | `#81807D` | Control borders (must be at least 3:1) | 3.9:1 (computed) | 3.3:1 |
| `--hairline` | `#D3D1CD` | Decorative dividers only | n/a | n/a |
| `--accent` | `#426F4C` | Accent used as text or line | 5.8:1 (computed) | 4.8:1 |
| `--mark` | `#62906B` | Accent used as a small mark (his step tick, selected dot, current tick) | 3.7:1 (computed) | 3.0:1 |
| `--fill` | `#C3E0C8` | Paper-tag fill (primary button, selected tab, tape) | n/a | 1.2:1 (computed) |
| `--on-fill` | `#050B06` | Text on a paper tag | 14.0:1 on `--fill` | n/a |
| `--fill-border` | `#517E5A` | Paper-tag outline | 3.9:1 on `--bg` | n/a |
| `--glow-1` | `#CFE7D3` | Diffuse light, pale green | decorative | n/a |
| `--glow-2` | `#E7E2DA` | Diffuse light, warm cream | decorative | n/a |

Important consequence: in the light theme the paper tag has almost no lightness difference from the background (1.2:1). Its boundary is therefore carried entirely by the 1.5 px `--fill-border` outline (3.9:1). Never remove that outline.

The design file says body text must reach 7:1. `--ink` and `--ink-2` meet that on both surfaces. `--faint` is the weakest text and reaches AA (4.5:1) only; it is not used for body text. On a glow area, `--faint` is 4.6 to 4.7:1 (design file), which is why light-theme glows must never be darker than the values above.

### 3.2 Colour: Shell, dark theme (sage)

| Token | Hex | Ratio (design file unless marked) |
|---|---|---|
| `--bg` / `--surface` / `--raised` | `#110F0D` / `#1A1815` / `#262421` | n/a |
| `--ink` | `#EFEEED` | 13.4:1 on raised; 16.5:1 on bg (computed) |
| `--ink-2` | `#CBCAC8` | 9.5:1 on raised (computed); 11.7:1 on bg (computed) |
| `--faint` | `#A5A4A2` | 6.2:1 on raised; 7.7:1 on bg (computed) |
| `--edge` | `#7C7A77` | 4.5:1 on bg; 3.6:1 on raised (computed) |
| `--hairline` | `#2D2B28` | decorative |
| `--accent` | `#89B992` | 8.6:1 on bg |
| `--mark` | `#719F7A` | 6.3:1 on bg |
| `--fill` / `--on-fill` | `#A1CAA8` / `#050B06` | 10.9:1 text on fill |
| `--glow-1` / `--glow-2` | `#102515` / `#1A1814` | decorative |
| `--fill-border` | see below | **to reconcile** |

**To reconcile: dark `--fill-border`.** The prototype sets `#6E9876` (5.8:1 on `--bg`, computed). The design file's sample stylesheet sets the Oppenheimer skin's `--fill-border` to `#A1CAA8`, the same as `--fill`, and says the same for dark mauve; the design file's dark Shell table gives no value. Both are valid contrast-wise. A single value must be chosen.

### 3.3 Alternative accent: mauve (only accent-related tokens differ)

Mauve is the documented alternative to sage. The choice between them has not been made; see section 12.

| Token | Light | Dark |
|---|---|---|
| `--accent` | `#874E6A` (5.2:1) | `#D495B2` (8.0:1) |
| `--mark` | `#AD718D` (3.1:1) | `#BA7D99` (5.9:1) |
| `--fill` / `--on-fill` | `#F3CADC` / `#10060A` (13.6:1) | `#E3ABC4` / `#10060A` (10.3:1) |
| `--fill-border` | `#975C79` (4.2:1) | same as `--fill` |
| `--glow-1` | `#F7D5E4` | `#2F1522` |

Rejected accents and why: orange or terracotta and blue or indigo were excluded by the product owner; lavender is too close to blue and too typical of generic AI products; butter yellow cannot reach 3:1 as a thin line on a light background.

### 3.4 Colour: the Oppenheimer skin (night)

This is the only skin that corresponds to a real companion. It is a dark theme with a plum-black base. Hue is about 335 degrees with saturation of 0.02 or less. The accent and paper-tag colours are the same as the dark Shell. Values from the prototype's `.sk-opp`:

| Token | Hex | Ratio (computed unless marked) |
|---|---|---|
| `--bg` / `--surface` / `--raised` | `#140D12` / `#1D161B` / `#292127` | n/a |
| `--ink` | `#F1EDF0` | 16.5:1 on bg; 13.5:1 on raised |
| `--ink-2` | `#CEC9CC` | 11.7:1 on bg; 9.6:1 on raised |
| `--faint` | `#A8A3A6` | 7.7:1 on bg; 6.3:1 on raised |
| `--edge` | `#7F787D` | 4.5:1 on bg; 3.6:1 on raised |
| `--hairline` | `#31282E` | decorative |
| `--accent` / `--mark` | `#89B992` / `#719F7A` | 8.6:1 / 6.3:1 on bg |
| `--fill` / `--on-fill` | `#A1CAA8` / `#050B06` | 10.9:1 |
| `--fill-border` | `#6E9876` in the prototype; `#A1CAA8` in the design file | **to reconcile** |
| `--glow-1` | `#12261A` in the prototype; `#102515` in the design file | **to reconcile** |
| `--glow-2` | `#1F141D` | decorative |
| `--tape` | `rgba(161,202,168,.55)` | decorative |

Other skin-related values: the light Shell tape in the prototype is `rgba(195,224,200,.75)`, and the dark skins use `rgba(161,202,168,.55)`. The design file instead specifies tape as `--fill` at 70% opacity. **To reconcile:** tape opacity (70% in the design file; 75% light and 55% dark in the prototype).

The design file lists two sample skins, Kinetic and Noir, which it says were invented only to test the architecture. They are not real companions and must not be built as product skins.

### 3.5 Diffuse light and grain

- No more than two glows per screen, placed at the corners, never directly behind text.
- Lightness difference from the background is tiny: +0.04 to +0.07 in dark themes, -0.02 to -0.03 in light themes. It should read as "a little lamp light on the desk".
- First glow uses the accent family; the second uses a warm neutral.
- Text on a glow must still pass contrast (re-test with the glow colour as the background).
- Grain is allowed only on the light Shell background, opacity 4% or less. Session screens have no grain.
- Glows do not move by default. There is no user switch to turn glow or grain off (decided by the product owner); they comply by passing contrast checks, staying still and respecting reduced motion.
- Not allowed: gradients as button backgrounds, multicolour gradients, glass or blur-through materials.
- Session screens: background colour, glow, and a scene image in the top 40% that fades out before the text area begins.

Reference CSS from the design file (proposed):

```css
.diffuse{ background:
  radial-gradient(62% 38% at 90% 5%, var(--glow-1), transparent 70%),
  radial-gradient(72% 46% at 4% 102%, var(--glow-2), transparent 70%), var(--bg); }
```

### 3.6 Typography

All typefaces are proposed, subject to the high-fidelity pass. Licences and tabular-number support have not been verified (see section 12).

| Role | Typeface | Notes |
|---|---|---|
| Titles, large numerals | Bricolage Grotesque (variable, open licence) | Weight 800, letter spacing -0.02em to -0.025em. The design file flags that it may be too distinctive. |
| Body and buttons | Atkinson Hyperlegible Next | Designed for low-vision readers. |
| Timer | Atkinson Hyperlegible Mono | Fixed-width digits, `font-variant-numeric: tabular-nums`. |
| Companion's voice (skin) | Newsreader for Oppenheimer | A serif belongs to Oppenheimer only. Each skin names one voice typeface, with licence stated. |
| Hand layer (accents only) | Shantell Sans, "informality" axis (INFM) 0, bounce axis (BNCE) 0, weight 500 to 600 | Chosen by the product owner. See section 7. |

Type scale, taken from the prototype where the design file gives no number (sizes in CSS pixels):

| Style | Size / line height | Weight | Source |
|---|---|---|---|
| Display title | 32 / 1.08, letter spacing -0.025em | 800 | prototype `.display` |
| Sheet title | 22 / 1.2 | 800 | prototype `.sheet h3` |
| Timer | 78 / 1, tabular digits, letter spacing -0.01em | 600 | prototype `.timer` |
| Slip text, large (arrival cards) | 21 / 1.42 | voice font | prototype `.note.l` |
| Slip text, medium | 18 / 1.5 | voice font | prototype `.note.m` |
| Slip text, small | 16 / 1.45 | voice font | prototype `.note.s` |
| Body | 17 / 1.5 | 400 | design file and prototype |
| Button label | 17 / 1.1 | 700 | prototype `.btn` |
| Link | 15 / 1.2, underlined | 700 | prototype `.link` |
| Chip label | 15 / 1.1 | 600 | prototype `.chip` |
| Caption | 13.5 / 1.4, `--ink-2` | 400 | prototype `.caption` |
| Overline | 12.5 / 1.3, uppercase, letter spacing 0.09em, `--ink-2` | 700 | prototype `.over` |
| Tab bar label | 12.5 / 1.1 | 600 | prototype `.tabbar button` |

**To reconcile: minimum font size.** The design file's hard rule is a minimum of 13 px. The prototype's overline and tab bar labels are 12.5 px, and a small uppercase pill is 11.5 px. Either raise those to 13 px or amend the rule.

Reading rules (hard, from the design file):

- Body 17 px with 1.5 line height; line length at most about 60 characters; left aligned; paragraph spacing at least 0.75 line.
- The companion's words are at most 3 sentences per paragraph.
- Text must survive 200% enlargement (section 9).
- Shell large titles run at most 3 lines.

### 3.7 Spacing

The sources define only a few spacing values. Use these and do not invent others without agreement:

| Use | Value |
|---|---|
| Screen padding (prototype `.scr`) | 26 px top, 22 px sides, 16 px bottom |
| Gap between Done and Pause | 10 px |
| Gap between tab bar items' internal icon and label | 3 px |
| Tab bar padding (prototype) | 6 px top, 8 px sides, 12 px bottom, plus the device safe area |
| Chip and stepper gaps (prototype) | 8 px |
| Minimum touch target | 44 by 44 px (variable `--target: 44px`) |

A full spacing scale (for example 4, 8, 12, 16, 24) is not specified in the sources; it is an open item.

### 3.8 Radii

| Use | Radius |
|---|---|
| Controls (buttons, inputs) | 14 px (`--r-control`) |
| Cards | 24 px (`--r-card`) |
| Slip (story note) | 12 px (`--r-note`) |
| Chips | 12 px |
| Sheet, top corners | 28 px |
| Stepper buttons | 12 px (prototype) |
| Toast | 12 px (prototype) |
| Round avatar or portrait button | 50% |

### 3.9 Shadows and elevation

- One layer only, very light, to give the feel of the thickness of paper. Card and slip shadow: `0 10px 20px -14px` in `--ink` at 45% mix (prototype also uses `-16px` and 40% for cards).
- The edge of any control must never rely on a shadow; it relies on an outline or fill that reaches 3:1.
- The paper-tag "thickness" is a hard 2 px shadow in `--fill-border`: `0 2px 0 var(--fill-border)`.
- There are no inner shadows, no stacked shadows, and no skeuomorphic knobs.

### 3.10 Motion

| Event | Motion | With reduced motion |
|---|---|---|
| Paper-tag press | Moves down 1 px, 80 ms; thickness shadow disappears | Darken only |
| Screen change inside a flow | Horizontal push, 250 ms | Fade |
| Done: step changes | 200 ms cross-fade of the middle area and step label; paired ticks advance one place; the clock shows the new target and holds 1.2 s | Instant swap, same 1.2 s hold |
| Slip arrival | Fade in plus 4 px upward, 200 ms | Show directly |
| Card stack: new card on top | 200 ms fade, in place | Instant swap |
| Return pop-up opens | 200 ms fade of the shade and the pop-up; no movement | Show directly |
| Skin beat (companion's gesture) | At most 600 ms, one per moment, never loops; for Oppenheimer, a line drawn under the text | Show the final state directly |
| Goal split | Wave collapses into N dots, at most 1.2 s (brand motion) | Static row of dots |
| Timer digits | Change directly, no tween | Same |
| Time reached (00:00) | No animation; the card on top changes | Same |
| Glow | None by default | None |

The red line is reward mechanics, not motion as such. Nothing flashes. Beats are the companion's action, never a reward for the user.

## 4. Visual conventions

### 4.1 Voice typeface versus system typeface

His words use the skin's voice typeface and sit on a slip. System words (buttons, errors, safety page, settings) use the Shell typeface and have no slip and no tape. This is how the user tells "he is speaking" from "the app is speaking", and it does not rely on colour.

### 4.2 Images (where colour comes from)

| Type | Specification | Use | Rules |
|---|---|---|---|
| Companion portrait | 3:4, painterly pastel with fine grain recommended | Companions, selection, small card on Home | Neutral frame; colour comes from the picture; alt text is the companion's name |
| Scene background | 9:16, top 40% is the picture, the lower area is blank so it can fade | Session screens | No text, no faces (or very small and blurred), no spoilers; readable after blur |
| Prop or small object | Transparent PNG or SVG, at most 160 pt | Cards, Life Path current row | Decorative: empty alt text |

An art bible (brush style, grain, saturation ceiling, outline) must exist before real images are commissioned; otherwise images from different companions clash in a neutral interface. Images may use orange or blue; the interface does not.

Spoiler rule for the Oppenheimer skin: session screens, Life Path and the end screen must not show a mushroom cloud or explosion imagery. Third-party characters and film villains require legal review before official likenesses are used.

### 4.3 Colour-blind and greyscale

Every state must be readable in greyscale (shape, typeface, position, text label). With the accent colour removed the interface still works. The generator that produced the values guarantees numbers, not colour-blind distinctness; shape and typeface provide that.

## 5. Architecture: Shell and Skin

| | Shell (the product) | Skin (one per companion) |
|---|---|---|
| Contains | Layout, components, type scale, control shapes, motion rules, accessibility, neutrals and accent, and the look of Home, Companions, Goals, Me | Images (portraits, scene, props); the companion's voice typeface; a base-colour tendency; one beat |
| Who changes it | The design-system owner | The person making that companion, by filling in a form only |

**Shell screens:** Home, Companions, Goals, Me. These form the tab bar, in the order given in the decisions record (Home, Companions, Goals, Me). **To reconcile:** the prototype tab bar order is Home, Goals, Companions, Me; the older design file says Home, Goals, Characters, Me.

**Skin screens:** the per-companion session screens: focus (including paused, the first frame of the next step and the return pop-up), the rest conversation, and the end summary. The companion's Life Path page uses the Shell frame with the skin's base colour.

**Skin contract:**

1. A skin supplies only a hue and a very small saturation (at most 0.02) as its base-colour tendency. Glows use the Shell accent family. A skin must not introduce a new accent colour, and must not use orange or blue.
2. Images follow the specification in section 4.2.
3. One voice typeface, with its licence stated.
4. One beat, at most 600 ms, which is his action and not a reward; reduced motion shows the final state.
5. A skin must not change: layout, control sizes, type scale, touch targets, focus rings, or the safety page.
6. A new skin must pass the contrast generator before release.

**The Shell always overrides the skin in three places:** the safety page, error and system messages, and Me / About.

**Implementation.** Express tokens as CSS custom properties on a root class (`.skin-opp` is the reference). The Shell sets defaults on `:root`; light and dark follow the system setting and can be overridden in Me. A skin class on a session screen replaces only the tokens in section 3.4.

```css
:root{ --bg:#EAE9E7; --surface:#F3F2F1; --raised:#FFFFFF; --ink:#1B1A19; --ink-2:#434240; --faint:#646361;
  --edge:#81807D; --hairline:#D3D1CD; --accent:#426F4C; --mark:#62906B;
  --fill:#C3E0C8; --on-fill:#050B06; --fill-border:#517E5A;
  --glow-1:#CFE7D3; --glow-2:#E7E2DA;
  --r-control:14px; --r-card:24px; --r-note:12px; --target:44px; }
```

## 6. Components

Each component lists its rules. Targets are at least 44 by 44 px unless stated.

### 6.1 Primary button: the paper tag

- Height 56 px, full width unless in a pair; radius 14 px.
- Fill `--fill`, 1.5 px outline `--fill-border`, label `--on-fill` in the body typeface, weight 700, size 17.
- A 2 px hard shadow in `--fill-border` for paper thickness. Pressed: moves down 1 px and the shadow goes (reduced motion: darken only).
- Disabled: dashed outline (`--edge`), `--surface` fill, `--faint` label, no shadow. Disabled is shown by the dashed outline and cannot depend on colour alone.
- Focus: 2 px `--accent` ring, offset 2 px. (The prototype's page chrome uses 3 px, but that is not the app; **to reconcile** if a larger ring is wanted.)
- Secondary button: 56 px high, `--raised` fill, 1.5 px `--edge` outline, no shadow, label `--ink`.
- Text link: bold, always underlined, hit area at least 44 by 44.
- Only screens with a single action (for example a one-card arrival) use a full-width primary button.

### 6.2 Done | Pause, side by side

- On the focus screen the two actions sit in one row: **Done about 62% | Pause about 38%**, gap 10 px. The prototype uses `grid-template-columns: 62fr 38fr`.
- Paused state: the row reads **Resume | Done**. Done keeps its place on the screen as far as possible. After the user taps Back to step on the rest page, the focus screen opens with the return pop-up (6.17) and the clock stays frozen until its start button is tapped. **To reconcile:** the design file's accessibility section says Done is always in the same position, while the wireframe set notes Done moves from left to right when paused. Decide one.
- Done is **always allowed**. It never asks a question. Every Done can be undone (see Toast).
- After Done, Done is disabled (dashed) for 1.2 seconds while the clock holds still, so that a double tap cannot skip the next step. Pause stays available during the hold.
- At 200% text size the two buttons stack, Done above Pause, both pinned at the bottom.
- The row is pinned at the bottom of the screen; the middle area scrolls if needed.
- Screen-reader order: Done, then Pause.

### 6.3 Story slip with tape

His one-way words appear on a slip.

- Raised surface (`--raised`), radius 12 px, 1 px `--hairline`, single light paper shadow, padding about 14 to 16 px, text in the skin's voice typeface.
- Tape: a strip about 56 by 16 px (58 by 17 in the prototype) at the top left, `--fill` at reduced opacity, rotated -4 degrees, purely decorative and hidden from screen readers. The text itself is never rotated.
- Not clickable. Never contains a question in the status role. No "he says" prefix for screen readers.
- Used for: card text (including the background card), arrival text, his message on the rest page, the return pop-up message, the closing line, Life Path lines.
- System text has no slip and no tape.
- Sizes: large 21/1.42 (arrival and closing), medium 18/1.5, small 16/1.45.

### 6.4 Paired step ticks

A pair of short strokes per step: his stroke in `--mark`, yours in `--ink-2`. The current step's pair is thicker and taller (prototype: 3 by 16 px normal, 5 by 24 px current); future steps are dashed outlines. Shown only on the focus screen next to the label "Step x of N". With a one-step goal, show no label and no ticks. The stroke shapes may be slightly hand-drawn (hand layer, section 7) but must carry no meaning beyond what the label already says. Ticks are hidden from screen readers; the label carries the information. The ticks and the card-stack dots (6.5) are placed far apart so they are not mistaken for each other: dots mean cards, strokes mean steps.

### 6.5 Card stack with dots and two buttons

This component carries his story during a step. Decided on 2026-11-05.

- A step opens with **exactly one card**: the background card for the first step of a goal, and the card about what he just finished for every later step. Further story cards appear **one at a time** while the user works, at y/n, 2y/n ... y minutes for a step of y minutes with n cards (decisions T8, T9). The n-th card arrives exactly at 00:00 and there is no separate card for the end of the time; at 00:00 only the light vibration happens. Cards must never be piled up at the start.
- The **background card**, told in the character's own voice (who is here, where this is, what each person knows), is the one card of the first step at its start. It introduces the people who are present; later cards carry no introduction phrases and names are not tappable. It is not progress and is not one of the step's n cards. It is the oldest card of the first step's stack, is reachable with the same swipe and buttons, and has no dismiss button. Its label is not decided (it follows the his-voice labelling rule in section 10).
- A new card sits **on top** of the stack. The user looks back by swiping the top card **left**; that moves the card aside and shows the card before it. Swiping right brings the newer card back.
- Dots under the card show position (active dot filled, others outlined). There is no ring, no counter, no colour, no sound and no vibration for a new card.
- Two buttons under the card give the same function without a gesture (WCAG 2.5.7): **Earlier card** (‹) and **Newer card** (›), each at least 44 by 44. Disabled at the ends (opacity 0.3 in the prototype; make sure the disabled state is also communicated by the accessible state).
- Labels on the cards: the newest is "Right now"; older ones "How I got here"; the portrait opens a sheet "Where I am now".
- The card region is **not** a live region (`aria-live="off"`). A new card is never announced over the user's work. Its arrival may add hidden "new card" text to the pager label for screen readers only.
- After using ‹ or ›, the card is announced once, politely, because the user asked for it (for example "Card 2 of 3, How I got here: ...").
- Resetting: reopening the app, resuming from pause, or returning from the rest page resets the view to the newest card.
- Cards limit: a step has between 1 and 5 story cards, chosen by the AI; the app ignores any extra cards it returns. The background card is extra and is not counted.
- Card height: a fixed area (160 px in the 300 by 640 wireframe) with text scrolling inside when it overflows, a thin always-visible scrollbar and a fade at the bottom edge. The text area is focusable (`tabindex="0"`, region named, for example "Right now, card 3 of 3"), arrow keys left and right move between cards only when focus is on the row, not inside the text. At 200% text size the fixed height is removed and the middle area scrolls instead, so only one scroller exists at a time.
- Touch handling: the text area uses `touch-action: pan-y`; the stack takes a horizontal swipe only when horizontal movement exceeds vertical (about 10 px of travel, angle under 30 degrees from horizontal).
- Card length: authors aim at about 30 to 40 words so most cards fit the six visible lines; 60 words is the ceiling.
- New card cadence: with n cards in a step of y minutes, a new card appears every y divided by n minutes, never closer than 5 minutes apart. Foreground time only; nothing is added while paused or away.

Note: the wireframe set for focus (version 6) describes a horizontal row with the newest at the right and swipe-right going back, and says the product owner's words ("swipe left to look back") need confirming. The 2026-11-05 decision confirms the stack with swipe-left to look back; the stack model above replaces the row model. The wireframes and the prototype (which shows four cards at the start) must be redrawn, and the background card added.

### 6.6 Chips

Height 44 px (the prototype value), radius 12 px, 1.5 px `--edge` outline, label 15 px weight 600. Selected: `--fill` background with a **check mark** (so selection is not colour alone). Single-choice and multi-choice groups are keyboard operable. **To reconcile:** the design file says chip height 40; the prototype uses 44 and the target rule requires 44.

### 6.7 Stepper (minutes)

A minus button, a value, a plus button. Buttons 44 by 44 px, radius 12, 1.5 px `--edge` outline. The value is in the mono face (16 px, weight 600). A disabled end is shown by a dashed outline and `--faint`. Do not use a drag slider (WCAG 2.5.7). Used in the step row for minutes when a goal is split.

### 6.8 Disclosure

A "Your steps" row with a chevron (down when collapsed, up when open) that expands a list in place. Titles only; the short description appears only under the current step; state is shown by shape markers (done, now, to do), no minutes. Expose `aria-expanded`; the accessible name changes with state ("Your steps, button, collapsed"). When open, the middle area scrolls, while the seam and Done | Pause stay put.

### 6.9 Sheet

Bottom sheet over a shade (prototype shade `rgba(0,0,0,.38)`). Top corners 28 px, `--raised`, a handle, a title (22 px), content, and a visible Close button. `role="dialog"`, focus moves in and is trapped, background inert, Esc and the system back gesture close it, and focus returns to the opener. Max height 80%, scrolls inside. The timer keeps running behind the "Where I am now" sheet.

### 6.10 Tab bar

Bottom, four items: Home, Companions, Goals, Me (order to reconcile, see section 5). Each item has an icon (24 px, 1.8 stroke) and a text label; the current item is marked with `aria-current="page"`, and is shown by a filled paper tag outline in the design file or a bold label with a 3 px `--mark` bar above it in the prototype (**to reconcile**). Height 64 px plus safe area in the design file; the prototype's items are at least 52 px tall with 6 px top and 12 px bottom padding (**to reconcile**). Items must still be at least 44 px tall. The bar appears only on the four top-level pages, never on focus or rest. Its position never changes.

### 6.11 Top tabs

The sources show a back row at the top of detail pages (for example "Companions" back to the list) and segmented controls (a joined set of buttons, `1.5 px --edge` outline, radius 12, selected segment filled with `--fill`, `aria-pressed` on each). The exact visual design of top tabs is not specified beyond that; this is an open item. Rules that do apply: each tab is at least 44 px tall, selection is shown by fill plus an accessible state, not colour alone, and the set does not wrap.

### 6.12 List row

Rows in Goals: height at least 64 px, text on the left, a Continue action on the right. A swipe action (left swipe) must also exist in the overflow menu and at the bottom of the goal detail, so no function depends on a gesture. Life Path rows use shape for state:

| State | Marker | Text | Tappable |
|---|---|---|---|
| Finished by you | Solid dot and a chevron | Normal | Yes |
| His memory | Open ring | Italic, `--ink-2` | No |
| Current | Heavy ring in `--mark` plus a card with Begin | Voice typeface | Yes |
| Not yet reached | Dotted circle | Age and title only, `--faint` | No, chapters are played in order (D4) |

Fading is done by decreasing size, not by lowering contrast. Screen readers read a future row as "later, not available". There are no markers for turning points or scenes on any row.

**History row (Me, History).** Height at least 64 px, one tappable row per session with a chevron. First line: the date and the duration. Below it: the titles of the steps the user marked as done, shortened with an ellipsis if they do not fit (proposed layout). There is no weekly total row. The row opens the session record page (section 8).

### 6.13 Popup menu

The overflow menu (the three-dot control) holds row actions that also exist as swipe actions. The sources do not give a visual specification. Rules that apply: opens from a 44 by 44 trigger, items at least 44 px tall, focus moves into the menu and returns on close, Esc closes, and the trigger exposes `aria-haspopup` and `aria-expanded`. Visual style is an open item.

### 6.14 Toast with Undo

Bottom of the screen above the tab bar, with the Undo action. Visible 5 seconds; **pauses while it has focus or is hovered**. `role="status"`. In the prototype it uses the `--ink` background with `--bg` text, radius 12, 14.5 px text. Used for Undo after Done: on the last step, Done goes straight to the summary with a 200 ms fade, and the toast returns to the last step with the clock frozen. The decision says every Done is undoable and a short Undo is shown after each Done. How the Undo toast behaves during the 1.2 second hold on steps other than the last is not yet designed (section 12).

### 6.15 Timer

- Centred, mono typeface, 78 px, weight 600, tabular digits. Shows the target time; the clock holds 1.2 seconds after Done, then counts.
- `role="timer"` with `aria-live="off"`. The status line is not a live region. At 00:00 there is **one** polite announcement "Step time reached". No other announcements, no sound, no pop-up, no overtime counter, no forced rest.
- Digits change directly with no animation.
- The timer is a target, not a cap. At 00:00 it stays at 00:00; only Done ends the step.
- At 200% text it is capped at about 1.3 times its size (open for the designer: whether a capped timer satisfies WCAG 1.4.4).
- The clock freezes when the user leaves the app (default). A setting "Keep the clock running when I leave" exists (decided), on the Signals sub-page in Me.
- After the return pop-up, the clock restarts at the tap on its start button; behind the pop-up it stays frozen.

### 6.16 Other components

- **Input:** at least 56 px high, 1.5 px `--edge`, radius 14, label above, associated with a label element, errors in words, never lose typed content.
- **Card:** `--raised`, 1 px `--hairline`, radius 24, light paper shadow. If the whole card is clickable, wrap it in one button.
- **Companion selector:** the three directions (photos on a desk, seating plan, name-card list) are still undecided. Rules common to all: neutral frame, colour from the portrait, selection by outline plus soft fill (not a coloured frame), no random draw, no rarity, no unlock counters, each companion is one button with name and one line, and "Sit with ..." is a full-width paper tag. The list direction is the fallback for many companions.
- **Home header:** the companion's small portrait and a short hand-style label "At your desk" (not "welcome back"; never mention how long the user was away).
- **Safety page:** Shell neutrals, no slip, no tape, primary "Get support now", secondary "Back to my step". Shown for the crisis tier only; ordinary stress passes, and the low-mood tier is not in the first demo.

### 6.17 Return pop-up

A modal over the focus screen in which the character says what he did while the user was away and how he felt, with exactly one button. Decided (R1, T6).

- **When it appears:** after the user taps Back to step on the rest page, and when the user returns to the app after 5 minutes or more away. Continue on Home and Continue in Goals follow the same rule: the pop-up appears if the user was away 5 minutes or more. A shorter glance at another app resumes the clock with no pop-up. There is no time limit on resuming, however long the user was away.
- **Content:** his message on a slip with tape (6.3), in the skin's voice typeface, medium or large size, scrolling inside if long. No name, no portrait and no label, as on the rest page. The text is generated live; the layout must work for a short and a long text.
- **Button:** one full-width primary paper tag (6.1) that starts the clock. The label is a start word; the exact copy is for the copy pass. There is no second button, no close control and no countdown.
- **Behaviour:** the clock is frozen while it is open and restarts at the tap. The shade is the sheet shade (6.9). Tapping the shade does nothing. The only way out is the start button.
- **Accessibility:** `role="dialog"` with `aria-modal="true"`; the message is its accessible description, so it is read before the button; focus moves to the start button and is trapped; the background is inert. Because the start button is the only action, Esc and the system back gesture do not dismiss it (an exception to the sheet rule in 6.9). No sound, no vibration.
- **Motion:** 200 ms fade (section 3.10).
- It never shows time-away wording as a system message, and it is not shown on Home.

## 7. Hand layer (decorative)

A thin decorative layer; with it removed the product is complete. All of it is proposed, subject to the high-fidelity pass.

- **Typeface:** Shantell Sans, INFM 0, BNCE 0, weight 500 to 600, with a fallback to Patrick Hand then the system font.
- **Allowed uses (only these):** short Shell labels of at most 4 words at 20 px or larger (for example "At your desk"), the small "now" annotation next to the current Life Path row, and the companion's initial at the end of an arrival card. The initial is a generic hand-written letter; a real person's actual signature is never used.
- **Never used for:** buttons, the timer, inputs, the user's own text, errors, the safety page, his slip text, or any text that is the only carrier of information.
- **Minimum 18 px, weight 500 or higher;** no more than 4 words per line; same contrast as other text; b/d, p/q, I/l, O/0 must be distinguishable in testing.
- **Hand-drawn marks:** inline SVG, 2.4 to 4.6 px round strokes in `--mark` or `--ink-2`, static, at most 2 per screen, hidden from screen readers, never the only carrier of meaning.
- **User control:** Me, Appearance, "Plain text" swaps the hand font back to the body face and makes marks straight lines; layout must not shift when switched.
- A hand label that repeats visible text is hidden from screen readers.
- Any "draw-in" animation is at most 600 ms and shows its end state under reduced motion.

```css
:root{ --hand:"Shantell Sans","Patrick Hand",system-ui,sans-serif; }
.hand{ font-family:var(--hand); font-weight:600; font-variation-settings:"INFM" 0,"BNCE" 0; }
.plain-text .hand{ font-family:var(--sans); font-variation-settings:normal; font-weight:700; }
.mark-svg{ stroke:var(--mark); stroke-width:2.4; fill:none; stroke-linecap:round; }
```

## 8. Screen layout guide

| Screen | Belongs to | Layout |
|---|---|---|
| Companions | Shell | Large title; selector (undecided direction); neutral frames; glow in corners |
| Home | Shell | "At your desk" with small portrait; large title; a main card; his slip with tape; full-width Continue; a text link to start something else. On a first visit one card and no sample data. After finishing, a small trace of the character. After a long absence with nothing in progress, no "welcome back" |
| Life Path | Shell frame with skin base colour | Large title; rows as in 6.12; the current card's Begin is a paper tag |
| Goals, Me | Shell | Lists and labels; no counts, no red dots |
| Focus | Skin | Seam pinned at top: "Step x of N", paired ticks, timer. Beneath: the companion's goal line, the card stack (one card at a step's start; the background card at the start of the goal) with dots and two buttons, the portrait, then the user's block (goal, current step with its title and description, "Your steps" disclosure). Done and Pause pinned at the bottom. No other tappable elements |
| Focus, paused | Skin | Same layout, a text label "Paused", Resume and Done; focus lands on Resume |
| Focus, first frame of the next step | Skin | One calm change; clock holds 1.2 s; Done disabled during the hold |
| Focus, return pop-up | Skin | The focus screen behind the shade; the pop-up of 6.17 with his message and one start button; clock frozen |
| Rest conversation | Skin | His first message on a taped slip, no name, no portrait, no label; the user's messages right-aligned, in the Shell typeface, no slip; no avatar, no "typing" indicator; a full-width Back named "Back to step"; a text link "Say something"; no scrolling page, no countdown |
| Summary (after the last step) | Skin | A closing line, the key moments that were merged into other steps (one first-person line each), the user's step list without totals; exits; Undo toast |
| Me, History | Shell | Rows as in 6.12: date, duration and the steps marked done; no weekly total row |
| Session record page | Shell | Back row to History; the goal name as large title; the date and the duration; a list of the steps the user marked as done (solid dot marker, as in 6.12); no totals, no counts |
| Safety | Shell | Section 6.16 |

## 9. Accessibility

The baseline is **WCAG 2.2 level AA**. Failing a rule below blocks release.

### 9.1 Requirements

- **Contrast:** text 4.5:1 minimum (body text target 7:1); control boundaries and meaningful graphics 3:1. Recompute any text on a glow with the glow as the background.
- **Targets:** at least 44 by 44 px for every interactive control (exceeds the 24 px minimum of WCAG 2.2, criterion 2.5.8).
- **State never by colour alone:** shape, label, position, typeface, or fill plus a check; the app must remain usable with the accent removed (1.4.1).
- **Alternatives to gestures and dragging:** swipe has button alternatives; stepper rather than drag (2.5.7).
- **Reflow and text size:** 200% text enlargement without loss; no horizontal scroll at 320 px width (1.4.4, 1.4.10). On the focus screen at large sizes, the buttons stack, the seam and buttons stay pinned, and the middle scrolls.
- **Reduced motion:** honour the system setting everywhere (section 3.10). No flashing at any time (2.3.1). Beats never loop; the glow never moves (2.2.2).
- **Focus:** visible focus ring (2 px accent, 2 px offset); logical order; pinned bottom buttons must not hide the focused element (2.4.3, 2.4.7, 2.4.11).
- **Consistency:** the tab bar never moves; Done keeps its place; skins never change layout (3.2.3, 3.2.4).
- **Errors:** described in words; typed content kept; no picture puzzle on any sign-in or save step (3.3.1, 3.3.3, 3.3.7, 3.3.8).
- **Images:** portraits have the companion's name as alt text; scene and props have empty alt text.

### 9.2 Timer, live regions and reading order

| Screen | Reading order | Special handling |
|---|---|---|
| Focus | "Step x of N", timer, the companion's text, step name, Done, Pause | Timer is `role="timer"` with `aria-live="off"`; the card region is not live; one polite "Step time reached" at 00:00 |
| After Done | | One polite announcement "Step 3 of 4, Write the Methods section"; focus stays where it was |
| Paused | "Paused", timer, Resume | Focus lands on Resume |
| Card stack | Card text, Earlier card, Newer card | After a button or swipe, one polite announcement of the card; new arrivals are silent |
| Rest | His message, input, Back, Say something | The Back control is named "Back to step" |
| Return pop-up | Message (as description), start button | Focus on the start button; background inert; no dismiss except the button |
| Sheet or safety | Title, content, actions | Focus enters the dialog, background inert |
| Life Path | Age, title, line, Begin (current only) | Future rows read "later, not available" |

Decorative items (tape, hand-drawn marks, hand labels that duplicate visible text, props, the paired ticks) are hidden from assistive technology.

### 9.3 User preferences

Light and dark follow the system and can be overridden in Me. Also: Plain text (section 7), reduced motion, increased contrast, and larger text. Me has a Signals sub-page (vibration at 00:00, keeping the clock running when leaving). There is no language setting. Sound and haptics are off by default. There is no transparency setting because there are no translucent materials. Glow and grain have no switch (decided).

### 9.4 Test checklist

1. Run every skin through the contrast generator, then spot-check with a contrast tool in light and dark.
2. Swap the scene image for the lightest and darkest candidates; check text remains readable.
3. Set text to 200% on focus, goal setup and Home.
4. Walk through with VoiceOver and TalkBack, especially Back, the return pop-up and the card stack.
5. Operate the full app with a keyboard.
6. Turn on reduced motion; beats are static and glows do not move.
7. Convert screens to greyscale; check every state is readable.
8. Test focus and rest with real low-vision and screen-reader users.
9. Hand layer: Plain text keeps layout; test strings for b/d/p/q, I/l/1, O/0; check marks are silent in screen readers.

## 10. Voice rules for interface copy

Two voices exist.

- **His voice:** first person, concrete things, short sentences, no clock time, no question in the status line, at most 3 sentences per paragraph; in the skin's voice typeface on a slip. Labels on his side use "My" or none: "My goal", "Right now", "How I got here", "Where I am now", "Who I am", "What I have done". He uses "I", and his name appears only in the first sentence of "Who I am". Nothing on his side says "What I plan".
- **System voice:** neutral, begins with a verb, no emotion; Shell typeface; no slip. The user's side uses "Your goal", "Now", "Your steps". "My" and "Your" never swap.

Rules:

- Fixed button words: Done, Pause, Resume, Continue, Back, Back to step (rest page), Begin, Say something, Not now; Undo and Close where needed. The return pop-up has one start button (6.17). Button names for the card stack are "Earlier card" and "Newer card".
- Vocabulary: Companion, Goal, Step, and no other words for the user's work.
- Tone: quiet and kind. No exclamation marks, no emoji, no cheering ("Go for it"), no urgency.
- Forbidden: guilt or loss phrasing ("You left X", "You missed N", "Don't give up"), streaks, or "last step" labels.
- No time-away mention on Home ("At your desk", not "Welcome back").
- Leaving never needs confirmation; returning never needs explaining. Done never asks a question.
- The interface is English only; there is no language setting.
- Text of an arrival card or his lines must not leak a future event: only earned facts.

## 11. Conflicts to reconcile (summary)

| Item | Value A | Value B |
|---|---|---|
| Dark `--fill-border` | `#6E9876` (prototype) | `#A1CAA8`, same as `--fill` (design file stylesheet) |
| Oppenheimer `--glow-1` | `#12261A` (prototype) | `#102515` (design file) |
| Tape opacity | 70% of `--fill` (design file) | 75% light, 55% dark (prototype) |
| Chip height | 40 px (design file) | 44 px (prototype and target rule) |
| Tab bar height | 64 px plus safe area (design file) | 52 px items with padding (prototype) |
| Current tab marker | Filled paper tag with outline (design file) | Bold label and a 3 px bar (prototype) |
| Tab bar order | Home, Companions, Goals, Me (decisions record) | Home, Goals, Companions, Me (prototype) |
| Tab name | Companions (decisions record) | Characters (design file) |
| Minimum font size | 13 px (design file) | 12.5 px and 11.5 px in the prototype |
| Done position when paused | Always in the same place (design file) | Resume then Done, so Done moves (focus wireframes) |
| Haptics | Light vibration at 00:00, confirmed (decision F5) | Sound and haptics off by default and never in focus (design file); the focus wireframe says no vibration at 00:00 |
| Focus ring | 2 px accent (design file) | 3 px (prototype page chrome only) |
| Back on the rest page, name | "Back to Home" (older wireframe) | "Back to step": it returns to the paused step and opens the return pop-up (R1, T6) |
| Life Path future rows | At most 3, shrinking, not tappable (older wireframe) | All 26 stories are shown; chapters ahead of the current one are visible and not tappable, and play is in order (D4) |

## 12. Open design items

Copied from the sources. Items marked "decided" in the sources are not listed.

**From the design file (version 6):**

1. Accent colour: sage or mauve (or another). Contrast is guaranteed; beauty must be judged with real art. Needs a decision.
2. Whether the paper tag, side-by-side buttons and slip language feel right, in particular whether tape is too "scrapbook-like". Needs review of the mock-ups.
3. Whether the Shell default is light or dark. Needs a decision.
4. The art bible (brush, grain, saturation ceiling, outline). Needed; owner not yet assigned.
5. The companion selector direction: photos on a desk, seating plan, or name-card list (or a mix, for example the list as a base with tape and handwritten names). Needs a decision.
6. Font licences and tabular-number support are not verified; Bricolage Grotesque may be too distinctive. Designer to confirm.
7. Whether official likenesses of anime characters and film villains can be used. Legal review.
8. The generator only guarantees numbers; nothing has been validated on real devices, with colour-blind simulation, or with screen readers.
9. Research limits: the references were read as text, not as screenshots (except Monspeak); a designer should recheck. No documented shipped productivity tool with a hand-written feel was found; a further search is suggested.

**From the decisions record:**

10. S2: which technical constraints apply (haptics and lock-screen alerts on iPhone as a web app). Confirm.
11. F6: which user test comes first. Open.
12. M7: whether a 41-word first card is acceptable. Open.
13. M5 and M6: need the original test data.
14. The prototype and the wireframes must be redrawn so that a step opens with one card, the number of cards per step follows the AI's choice (1 to 5), and the first step opens with the background card.
15. C1: how many fallback lines are enough and who writes the generator checks (affects any copy shown from fallbacks).
16. Background card: its label.
17. Return pop-up: the start button label, and what happens when the keep-running setting is on and the clock never stopped.

**From the focus wireframes (version 6):**

18. Whether a capped timer at 200% text meets WCAG 1.4.4.
19. Risk: a user parked on an old card may not know a newer one exists; to be observed in testing.
20. How the Undo toast behaves for Done on steps other than the last, during the 1.2 second hold (the decision says every Done can be undone and an Undo is shown each time; only the last step's 5-second toast is specified).

**Gaps found while writing this document:**

21. No full spacing scale is specified.
22. Visual specification for top tabs and the popup menu is missing.
23. Dark Shell `--fill-border` and the conflicts in section 11.
24. The logo is a raster inside an SVG; a true vector is needed for large uses.

# Values measured from prototype version 4

Source: `wp-prototype_2026-11-12_v4_live-ai.html` in this folder. Measured on 2026-11-12. This file records what the prototype looks like and lists every place where `DESIGN.md` (version 7) says something different. It does not change `DESIGN.md`; that is a later pull request.

## How the values were read

Every value below comes from the browser, not from the source of the file. The prototype declares several themes in its style sheet, and the first declaration in the file is not always the one in use, so reading the source would give wrong numbers.

- The page was served with `text/html; charset=utf-8` and opened in Chromium (the browser engine of Playwright) at 1280 by 1000 pixels with a device pixel ratio of 2. The phone frame inside the page is 390 by 800 pixels.
- The phone element (`#phone`) carries one of three skin classes. The page picks it in its `render()` function: `sk-opp` (the dark Oppenheimer skin) for the goal dialogue, the focus page, the rest page and the summary; otherwise `sk-night` when the user picked Night under Me, Appearance, and `sk-day` by default. Tokens were read with `getComputedStyle` on `#phone` while each skin was active: the day skin on screen HOME-1, the night skin on HOME-1 after switching to Night, and the Oppenheimer skin on F1.
- Component values were read with `getComputedStyle` on one element of each kind, on the screen named in the table, including the `::before` and `::after` parts that draw the tape and the tab bar marker. The focus ring was read after moving focus with the Tab key.
- The script is `scripts/design/probe-prototype-v4.mjs`. Its full output, with every property, is `prototype-v4-computed.json` in this folder. Colours are written here as hex; "at 40%" means 40% opacity.
- Words used below: a **token** is a named design value (a CSS custom property such as `--bg`). A **skin** is a set of token values that changes the look of the same screen. The **Shell** is everything outside a session (Home, Companions, Goals, Me, account pages); a **session** is the goal dialogue, focus page, rest page and summary.

## Decided: the button style is the paper tag

Yue decided on 2026-11-12 that the app uses the **paper-tag buttons of the prototype**, not the Apple-style capsule buttons of `DESIGN.md` section 6.1. As measured:

- Shape: a rounded rectangle with a 14 pixel corner radius, not a capsule.
- Height 56 pixels for a full button, 44 pixels for a small one (`btn s sm`), 52 by 52 pixels for the send button. Side padding 18 pixels (14 for small).
- Label: Atkinson Hyperlegible Next, 17 pixels, weight 700, no extra letter spacing (small: 14 pixels; send arrow: 20 pixels).
- The main button (filled): background `--fill`, text `--onfill`, a 1 pixel outline in `--fillb`, and a 2 pixel solid bottom edge in `--fillb` (`box-shadow: 0 2px 0 0`). The bottom edge is what makes it a paper tag.
- The secondary button (`btn s`): background `--raised`, text `--ink`, a 1 pixel outline in `--edge`, no bottom edge.
- The ghost button (`btn ghost`): no background, text `--ink`, a 1 pixel outline in `--edge`.
- Focus: a 3 pixel solid ring in #355E3F with a 2 pixel offset.

## Tokens of the three skins

| Prototype token | Day skin (`sk-day`) | Night skin (`sk-night`) | Oppenheimer skin (`sk-opp`) | `DESIGN.md` name | `DESIGN.md` value (light / dark / Oppenheimer) | Same? |
|---|---|---|---|---|---|---|
| `--accent` | #426F4C | #89B992 | #89B992 | `--control` for lines and rings, `--accent-text` for text | `--control` #426F4C / #A1CAA8 / #A1CAA8; `--accent-text` #37613F / #A1CAA8 / not listed | **no**: day matches `--control`; night and Oppenheimer are #89B992 in the prototype, #A1CAA8 in `DESIGN.md` |
| `--bg` | #EAE9E7 | #110F0D | #140D12 | `--bg` | #EAE9E7 / #110F0D / #140D12 | yes |
| `--edge` | #81807D | #7C7A77 | #7F787D | `--edge` | #81807D / #7C7A77 / #7F787D | yes |
| `--faint` | #646361 | #A5A4A2 | #A8A3A6 | `--faint` | #646361 / #A5A4A2 / #A8A3A6 | yes |
| `--fill` | #C3E0C8 | #A1CAA8 | #A1CAA8 | `--control` (filled button background) | #426F4C / #A1CAA8 / #A1CAA8 | **no** in the day skin (the prototype fills buttons with the pale #C3E0C8, which `DESIGN.md` uses only for tape); yes at night and in the Oppenheimer skin |
| `--fillb` | #517E5A | #6E9876 | #6E9876 | removed in `DESIGN.md` section 3.11 ("filled buttons have no outline") | none | **no**: the prototype uses it for the outline and the 2 pixel bottom edge of the paper-tag button |
| `--glow1` | #CFE7D3 | #102515 | #12261A | `--glow-1` | #CFE7D3 / #102515 / #12261A or #102515 (listed "to reconcile" in section 11) | yes for day and night; the Oppenheimer value #12261A settles the open conflict |
| `--glow2` | #E7E2DA | #1A1814 | #1F141D | `--glow-2` | #E7E2DA / #1A1814 / #1F141D | yes |
| `--hair` | #D3D1CD | #2D2B28 | #31282E | `--hairline` | #D3D1CD / #2D2B28 / #31282E | yes |
| `--ink` | #1B1A19 | #EFEEED | #F1EDF0 | `--ink` | #1B1A19 / #EFEEED / #F1EDF0 | yes |
| `--ink-2` | #434240 | #CBCAC8 | #CEC9CC | `--ink-2` | #434240 / #CBCAC8 / #CEC9CC | yes |
| `--mark` | #62906B | #719F7A | #719F7A | `--mark` | #62906B / #719F7A / #719F7A | yes |
| `--onfill` | #050B06 | #050B06 | #050B06 | `--on-control` | #FFFFFF / #050B06 / #050B06 | **no** in the day skin (dark text on the pale fill instead of white on dark green); yes at night and in the Oppenheimer skin |
| `--raised` | #FFFFFF | #262421 | #292127 | `--raised` | #FFFFFF / #262421 / #292127 | yes |
| `--surface` | #F3F2F1 | #1A1815 | #1D161B | `--surface` | #F3F2F1 / #1A1815 / #1D161B | yes |
| `--tape` | #C3E0C8 at 75% | #A1CAA8 at 55% | #A1CAA8 at 55% | `--fill-soft` (tape colour) and `--tape` | `--fill-soft` #C3E0C8 / #2C4A33; tape opacity listed "to reconcile" (70% in the design file, 75% and 55% in the old prototype); Oppenheimer `--tape` rgba(161,202,168,.55) | Oppenheimer yes. Day and night: the prototype settles the conflict at 75% and 55%, and the night tape is #A1CAA8, not #2C4A33 |

Typefaces (the same in all three skins):

| Prototype token | Value in all three skins |
|---|---|
| `--sans` | "Atkinson Hyperlegible Next",system-ui,-apple-system,"Segoe UI",sans-serif |
| `--disp` | "Bricolage Grotesque","Atkinson Hyperlegible Next",system-ui,sans-serif |
| `--mono` | "Atkinson Hyperlegible Mono",ui-monospace,Menlo,monospace |
| `--voice` | "Newsreader",Georgia,"Times New Roman",serif |

Tokens that `DESIGN.md` has and the prototype does not: `--tint` and `--gray` (the backgrounds of the tinted and gray Apple-style buttons), `--accent-text` (the accent used as text) and `--fill-soft` under that name. The prototype has no tinted or gray button, and its text links are `--ink`, not an accent colour.

## Components

| Component | Screen | Computed values (colours as hex; "at N%" is the alpha) |
|---|---|---|
| phone frame | HOME-1 | color #1B1A19; background-color #EAE9E7; border-top-width 1px solid; border-top-color #000000 at 30%; border-radius 40px; height 800px; width 390px; box-shadow #000000 at 55% 0px 18px 40px -26px; **::after**: background-color #D3D1CD, width 96px, height 5px, border-radius 3px |
| primary button (paper tag) | HOME-1 | font-family Atkinson Hyperlegible Next; font-size 17px; font-weight 700; line-height 18.7px; color #050B06; background-color #C3E0C8; border-top-width 1px solid; border-top-color #517E5A; border-radius 14px; padding 0px 18px; min-height 56px; height 56px; width 306px; box-shadow #517E5A 0px 2px 0px 0px |
| primary button (paper tag), Oppenheimer skin | F1 | font-family Atkinson Hyperlegible Next; font-size 17px; font-weight 700; line-height 18.7px; color #050B06; background-color #A1CAA8; border-top-width 1px solid; border-top-color #6E9876; border-radius 14px; padding 0px 18px; min-height 56px; box-shadow #6E9876 0px 2px 0px 0px |
| secondary button | F1 | font-family Atkinson Hyperlegible Next; font-size 17px; font-weight 700; line-height 18.7px; color #F1EDF0; background-color #292127; border-top-width 1px solid; border-top-color #7F787D; border-radius 14px; padding 0px 18px; min-height 56px |
| sheet button (secondary) | HOME-MENU | font-family Atkinson Hyperlegible Next; font-size 17px; font-weight 700; line-height 18.7px; color #1B1A19; background-color #FFFFFF; border-top-width 1px solid; border-top-color #81807D; border-radius 14px; padding 0px 18px; min-height 56px |
| ghost button | HOME-MENU | font-family Atkinson Hyperlegible Next; font-size 17px; font-weight 700; line-height 18.7px; color #1B1A19; border-top-width 1px solid; border-top-color #81807D; border-radius 14px; padding 0px 18px; min-height 56px |
| send button | R1-C | font-family Atkinson Hyperlegible Next; font-size 20px; font-weight 700; line-height 22px; color #050B06; background-color #A1CAA8; border-top-width 1px solid; border-top-color #6E9876; border-radius 14px; min-height 52px; height 52px; width 52px; box-shadow #6E9876 0px 2px 0px 0px |
| small button | G3 | font-family Atkinson Hyperlegible Next; font-size 14px; font-weight 700; line-height 15.4px; color #1B1A19; background-color #FFFFFF; border-top-width 1px solid; border-top-color #81807D; border-radius 14px; padding 0px 14px; min-height 44px |
| card menu trigger | HOME-1 | font-family Atkinson Hyperlegible Next; font-size 22px; font-weight 700; line-height 26.4px; color #1B1A19; padding 0px 8px; min-height 44px |
| text link | HOME-1 | font-family Atkinson Hyperlegible Next; font-size 15px; font-weight 700; line-height 18px; text-decoration-line underline; color #1B1A19; padding 0px 8px; min-height 44px |
| overline label | HOME-1 | font-family Atkinson Hyperlegible Next; font-size 12.5px; font-weight 700; line-height 16.25px; letter-spacing 1.125px; text-transform uppercase; color #434240 |
| display title | ME | font-family Bricolage Grotesque; font-size 32px; font-weight 800; line-height 34.56px; letter-spacing -0.8px; color #1B1A19 |
| card title | HOME-1 | font-family Bricolage Grotesque; font-size 27px; font-weight 800; line-height 30.24px; letter-spacing -0.54px; color #1B1A19 |
| card | HOME-1 | color #1B1A19; background-color #FFFFFF; border-top-width 1px solid; border-top-color #D3D1CD; border-radius 24px; padding 18px; box-shadow #1B1A19 at 40% 0px 10px 20px -16px |
| slip (his words) | HOME-1 | font-family Newsreader; font-size 18px; font-weight 400; line-height 27px; color #1B1A19; background-color #FFFFFF; border-top-width 1px solid; border-top-color #D3D1CD; border-radius 12px; padding 15px 16px 14px; box-shadow #1B1A19 at 45% 0px 10px 20px -14px; **::before**: background-color #C3E0C8 at 75%, width 58px, height 17px, border-radius 3px, box-shadow #517E5A at 35% 0px 0px 0px 1px, transform rotate(-4deg) |
| focus card stack slip | F1 | font-family Newsreader; font-size 18px; font-weight 400; line-height 27px; color #F1EDF0; background-color #292127; border-top-width 1px solid; border-top-color #31282E; border-radius 12px; padding 14px 14px 10px; box-shadow #292127 0px 5px 0px -1px, #31282E 0px 6px 0px -1px, #292127 0px 10px 0px -2px, #31282E 0px 11px 0px -2px; **::before**: background-color #A1CAA8 at 55%, width 58px, height 17px, border-radius 3px, box-shadow #6E9876 at 35% 0px 0px 0px 1px, transform rotate(-4deg) |
| focus card stack frame | F1 | color #F1EDF0 |
| timer | F1 | font-family Atkinson Hyperlegible Mono; font-size 46px; font-weight 600; line-height 48.3px; letter-spacing -0.46px; color #F1EDF0 |
| my goal row | F1 | color #F1EDF0 |
| your Steps panel | F1 | color #F1EDF0; background-color #292127; border-top-width 1px solid; border-top-color #31282E; border-radius 14px |
| avatar | HOME-1 | color #1B1A19; background-color #C3E0C8; border-top-width 1px solid; border-top-color #517E5A; border-radius 50%; height 40px; width 40px |
| large avatar | ME | font-family Bricolage Grotesque; font-size 15px; font-weight 800; line-height 15px; color #050B06; background-color #C3E0C8; border-top-width 1px solid; border-top-color #517E5A; border-radius 50%; height 64px; width 64px |
| text field | GD4 | font-family Atkinson Hyperlegible Next; font-size 17px; font-weight 400; line-height 22.1px; color #F1EDF0; background-color #292127; border-top-width 1px solid; border-top-color #7F787D; border-radius 14px; padding 0px 14px; min-height 48px |
| chat composer field | R1-C | font-family Atkinson Hyperlegible Next; font-size 17px; font-weight 400; line-height 22.1px; color #F1EDF0; background-color #292127; border-top-width 1px solid; border-top-color #7F787D; border-radius 14px; padding 0px 14px; min-height 52px |
| his chat message | R1-C | font-family Newsreader; font-size 18px; font-weight 400; line-height 27px; color #F1EDF0; background-color #292127; border-top-width 1px solid; border-top-color #31282E; border-radius 12px; padding 15px 16px 14px; box-shadow #F1EDF0 at 45% 0px 10px 20px -14px; **::before**: background-color #A1CAA8 at 55%, width 58px, height 17px, border-radius 3px, box-shadow #6E9876 at 35% 0px 0px 0px 1px, transform rotate(-4deg) |
| my chat message | R1-C | font-family Atkinson Hyperlegible Next; font-size 16.5px; font-weight 400; line-height 23.1px; color #F1EDF0; background-color #1D161B; border-top-width 1px solid; border-top-color #31282E; border-radius 16px 16px 4px; padding 10px 14px |
| plan step row | GD4 | color #F1EDF0; padding 12px 2px; min-height 56px |
| tab bar | HOME-1 | color #1B1A19; background-color #EAE9E7; border-top-width 1px solid; border-top-color #D3D1CD; padding 6px 8px 12px |
| tab bar item | HOME-1 | font-family Atkinson Hyperlegible Next; font-size 12.5px; font-weight 800; line-height 13.75px; color #1B1A19; padding 1px 6px; min-height 52px; height 52px; width 93px; **::before**: background-color #62906B, width 44.6562px, height 3px, border-radius 2px |
| sheet | HOME-MENU | color #1B1A19; background-color #FFFFFF; border-top-width 1px solid; border-top-color #D3D1CD; border-radius 28px 28px 0px 0px; padding 20px 22px 24px |
| sheet shade | HOME-MENU | color #1B1A19; background-color #000000 at 38% |
| settings row | ME | color #1B1A19; border-top-width 1px solid; border-top-color #D3D1CD; min-height 52px |
| segmented control | ME | color #1B1A19; border-top-width 1px solid; border-top-color #81807D; border-radius 12px |
| segmented control, selected | ME | font-family Atkinson Hyperlegible Next; font-size 15px; font-weight 700; line-height 15px; color #050B06; background-color #C3E0C8; padding 0px 16px; min-height 44px |
| Goals tabs item | G3 | font-family Atkinson Hyperlegible Next; font-size 14px; font-weight 700; color #1B1A19; padding 0px 10px; min-height 44px |
| toast | END | font-family Atkinson Hyperlegible Next; font-size 14.5px; font-weight 600; line-height 19.575px; color #140D12; background-color #F1EDF0; border-radius 12px; padding 12px 14px |
| Life Path finished row | CPAGE | color #1B1A19; padding 0px 0px 18px |
| Life Path current card | CPAGE | color #1B1A19; background-color #FFFFFF; border-top-width 1px solid; border-top-color #D3D1CD; border-radius 24px; padding 16px; box-shadow #1B1A19 at 40% 0px 10px 20px -16px |
| Life Path later row | CPAGE | color #1B1A19; padding 0px 0px 18px |
| Life Path period heading | CPAGE | font-family Atkinson Hyperlegible Next; font-size 12px; font-weight 700; line-height 15.6px; letter-spacing 1.2px; text-transform uppercase; color #434240 |
| summary closing slip | END | font-family Newsreader; font-size 21px; font-weight 400; line-height 29.82px; color #F1EDF0; background-color #292127; border-top-width 1px solid; border-top-color #31282E; border-radius 12px; padding 24px 20px 20px; box-shadow #F1EDF0 at 45% 0px 10px 20px -14px; **::before**: background-color #A1CAA8 at 55%, width 58px, height 17px, border-radius 3px, box-shadow #6E9876 at 35% 0px 0px 0px 1px, transform rotate(-4deg) |

Not in the table but measured: the Goals page tabs (`.tabs button`) carry a 2 pixel bottom border under the selected tab. The time chips of the goal dialogue (screen GD2, "30 min", "1 hour") are 44 pixels high, 12 pixel radius, 1 pixel `--edge` outline, `--raised` background, Atkinson 15 pixels at weight 600, side padding 14 pixels. Sheets have no drag handle.

## Every place `DESIGN.md` disagrees with the prototype

The prototype wins for how things look (see `docs/design/README.md`). Each item says what `DESIGN.md` says, what the prototype shows, and where. "Settles" means `DESIGN.md` section 11 listed the item as an open conflict and the prototype gives one answer.

1. **Buttons (decided: paper tag).** `DESIGN.md` 6.1 asks for capsule buttons (radius 999 pixels), 50 pixels high (36 small), system font at weight 600 with −0.022em letter spacing, four styles (filled, tinted, gray, plain), and "no 2 px bottom edge". The prototype uses the paper tag described above: 14 pixel radius, 56 pixels high (44 small), Atkinson at weight 700, three styles (filled, secondary, ghost) and a 2 pixel bottom edge on the filled button. Decided by Yue on 2026-11-12 in favour of the prototype.
2. **Filled button colours in the day skin.** `DESIGN.md` 3.1: `--control` #426F4C with white text (`--on-control` #FFFFFF). Prototype: the pale green #C3E0C8 (`--fill`) with near-black #050B06 text (`--onfill`), outlined and edged in #517E5A (`--fillb`). At night and in the Oppenheimer skin the fill and text agree with `DESIGN.md` (#A1CAA8 with #050B06); only the outline and edge (#6E9876) are new.
3. **Token names.** `DESIGN.md` 3.11 renames the tokens (`--control`, `--on-control`, `--accent-text`, `--fill-soft`, `--hairline`, `--glow-1`, `--glow-2`) and removes `--fill-border`. The prototype still uses the old names (`--accent`, `--fill`, `--onfill`, `--fillb`, `--hair`, `--glow1`, `--glow2`, `--tape`), and it needs `--fillb` for the paper tag. Settles the "token names" conflict in section 11 for now; the app may keep the new names as long as the values follow the prototype.
4. **Accent colour at night and in the Oppenheimer skin.** `DESIGN.md` 3.2 and 3.4: `--control` and `--accent-text` are #A1CAA8. Prototype: `--accent` is #89B992; #A1CAA8 is used only as `--fill`.
5. **Text links.** `DESIGN.md` 6.1: bold, underlined, in `--accent-text` (#37613F). Prototype: Atkinson 15 pixels at weight 700, underlined, in `--ink` (#1B1A19), at least 44 pixels high. The size and weight agree; the colour does not.
6. **Control typeface.** `DESIGN.md` 3.6: the system font (San Francisco on Apple devices) for controls, Atkinson for body text; listed as "to reconcile". Prototype: Atkinson Hyperlegible Next everywhere, including buttons, tabs and fields. Settles the conflict.
7. **Tape on the slip.** `DESIGN.md` 6.11: about 74 by 20 pixels, `--fill-soft`, rotated 2 degrees. Prototype: 58 by 17 pixels, 3 pixel radius, rotated −4 degrees, `--tape` (#C3E0C8 at 75% in the day skin, #A1CAA8 at 55% at night and in the Oppenheimer skin), with a 1 pixel ring of `--fillb` at 35%, placed at the top left of the slip, not centred. Settles the "tape opacity" conflict: 75% light, 55% dark.
8. **Oppenheimer glow.** `DESIGN.md` 3.4 lists `--glow-1` as #12261A or #102515, "to reconcile". Prototype: #12261A. Settles the conflict.
9. **Card.** `DESIGN.md` 3.9 and 6.9: radius 24, shadow `0 10px 20px -14px` at 45%, no border mentioned. Prototype: radius 24 (agrees), a 1 pixel `--hair` border, padding 18 pixels (16 on the Life Path), and a lighter shadow `0 10px 20px -16px` at 40%. The slip keeps the `DESIGN.md` shadow (−14 pixels at 45%) and also has a 1 pixel `--hair` border.
10. **Card stack on the focus page.** `DESIGN.md` 3.9: "no stacked shadows". Prototype: the focus card stack draws the cards behind the current one with four stacked shadow layers (`0 5px 0 -1px` and `0 10px 0 -2px`, in `--raised` and `--hair`).
11. **Timer.** `DESIGN.md` 3.6: large numeral 64 to 78 pixels, weight 600, tabular digits. Prototype: Atkinson Hyperlegible Mono, 46 pixels, weight 600, letter spacing −0.01em.
12. **Small labels below the minimum font size.** `DESIGN.md` 3.6: minimum 13 pixels. Prototype: overline labels ("GOAL · WITH OPPENHEIMER", "MY GOAL", "YOUR STEPS") at 12.5 pixels, weight 700, upper case, letter spacing 0.09em; Life Path period headings at 12 pixels with 0.1em; tab bar labels at 12.5 pixels. Settles the "minimum font size" conflict against `DESIGN.md`; whether 12 and 12.5 pixels are acceptable is an accessibility question for a person to decide.
13. **Card title size.** `DESIGN.md` 3.6 has display (32), sheet title (22) and body sizes only. Prototype: the Home Goal card title is Bricolage Grotesque 27 pixels at weight 800 with −0.02em letter spacing; there is no such style in `DESIGN.md`. The display title (32 pixels, weight 800, −0.025em, line height 1.08) agrees.
14. **Tab bar.** `DESIGN.md` 6.6: icons 26 pixels with a 1.7 stroke, labels 13 pixels at weight 600, items at least 64 by 44 pixels, the selected item coloured `--control` and the others `--faint`, padding 8 pixels with 26 at the bottom, background `--bg` at 92% or more. Prototype (measured on the selected Home item): labels 12.5 pixels at weight 800, items 52 pixels high, the selected item marked by a 3 by 45 pixel bar in `--mark` above it and its label in `--ink`, padding 6, 8 and 12 pixels, background `--bg` at full opacity. From the style sheet, not measured: icons 24 pixels with a 1.8 stroke, and the other items at weight 600 in `--ink-2`.
15. **Segmented control** (Me, Appearance). `DESIGN.md` 6.2: a capsule track in `--gray` with 3 pixels of padding, and the selected segment a raised white capsule with a small shadow. Prototype: a rectangle with a 12 pixel radius and a 1 pixel `--edge` outline, no track padding, and the selected segment filled with `--fill` and `--onfill` text, 44 pixels high, 15 pixels at weight 700.
16. **Text field height.** `DESIGN.md` 6.5: at least 50 pixels. Prototype: 48 pixels for the Goal field on the plan (GD4) and 52 pixels in the chat composer. Radius 14 and the 1 pixel `--edge` outline agree; side padding is 14 pixels.
17. **Chat composer.** `DESIGN.md` 6.5: a capsule field with a 44 pixel round send button in `--control`. Prototype: a rectangular field (14 pixel radius) next to a separate 52 by 52 pixel paper-tag send button.
18. **The user's own messages.** `DESIGN.md` 6.11 allows a `--control` bubble with `--on-control` text. Prototype: `--surface` background with a 1 pixel `--hair` border, corner radii 16, 16, 4 and 16 pixels, Atkinson 16.5 pixels, text in `--ink`.
19. **Chips.** `DESIGN.md` 6.10: capsule, 44 pixels, 1 pixel `--edge`, 15 pixels at weight 600. Prototype: the same height, outline and type, but a 12 pixel radius instead of a capsule.
20. **Sheet.** `DESIGN.md` 6.7 asks for a handle. Prototype: no handle. Radius (28 pixels at the top), shade (black at 38%) and title (22 pixels) agree; the sheet's buttons are stacked full-width paper tags, the last one "Close".
21. **Focus ring.** `DESIGN.md` 6.1: 3 pixels in `--control` with a 3 pixel offset. Prototype: 3 pixels in #355E3F (not a token) with a 2 pixel offset.
22. **Avatar.** Not specified in `DESIGN.md`. Prototype: a round avatar of 40 pixels on Home and 64 pixels on Me, with a `--fill` background and a 1 pixel `--fillb` ring around the portrait.

What agrees: every neutral colour (`--bg`, `--surface`, `--raised`, `--ink`, `--ink-2`, `--faint`, `--edge`, the hairline, `--mark`) in all three skins; `--glow-1` and `--glow-2` in the day and night skins; the body text (17 pixels, line height 1.5); the slip text sizes (18 pixels at 1.5 and 21 pixels at 1.42) and the slip radius (12); the display title; the card radius (24); the sheet radius and shade; the toast (12 pixel radius, 14.5 pixels at weight 600, `--ink` background with `--bg` text); and the screen side margin of 22 pixels.

## Not measured

- Motion (press, push, slip arrival), because a computed style does not show it.
- The canyon art and the portraits, which are images.
- The large-text and reduced-motion behaviour.
- The live mode with Claude connected; every value here is from the sample-text mode, which uses the same styles.

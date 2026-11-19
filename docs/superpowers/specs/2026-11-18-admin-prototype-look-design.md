# Admin looks like the prototype at desktop widths (#313): design

Status: approved by Yue on 2026-11-18 (scope, font option A, and the proposals below).

## Intent
The content admin is a desktop web tool for company staff, not a phone screen. It should look like
the admin prototype (`content-admin/admin-prototype_2026-11-14_v1.html`) at desktop widths. Rows
refer to `content-admin/admin-vs-prototype_2026-11-18_v1.md`.

## Goals (Yue's scope)
- **Shell (rows 1, 2, 3, 4, 7):** use the prototype's CSS values for colours, type sizes, spacing,
  buttons and menu rows. That includes its dark theme, which follows the system setting.
- **Tables inside panels (rows 8, 13, 36, 45):** Companions, App text and Publish history become
  tables, with the prototype's columns, inside a panel. Every function stays: drafts, versions,
  Publish and Roll back.
- **Pills and chips (row 9):** coloured state pills and grey id chips.
- **Breadcrumbs (row 11):** a breadcrumb above every page title.
- **Publish history (rows 47 and 48):** the short date `MM-DD HH:mm` (UTC), and a readable name plus
  the key on every row.
- **Naming documents (rows 20, 28 and 43):** they match the code. No code changes for these rows.
- **`docs/DECISIONS.md`:** records the following:
  - the admin is desktop-only and follows the prototype;
  - this reverses the #287 look choice for the admin;
  - the phone app keeps the app's own design;
  - the admin's minimum width is 1024 px.

## Non-goals
- **Row 6:** no phone-width layout, and no 44 px tap size in the admin.
- **The rest of the table:** every row not listed under Goals.

## Anti-goals
- Changing anything the phone app shows.
- Losing an admin function.
- Writing colour values straight into `globals.css`.

## Decided
- **Fonts: option A.** Use the prototype's font lists as written, load no fonts:
  - titles: `"Fraunces", Georgia, serif`;
  - text: `"IBM Plex Sans", system-ui, sans-serif`;
  - ids: `"IBM Plex Mono", ui-monospace, monospace`.

  The admin then renders the same as the prototype file.
- **Tokens:** `--adm-*` tokens live in `src/app/tokens.css`. They hold the prototype's colours, light
  and dark, and its lengths. The admin CSS in `globals.css` uses them only through `var()`, so
  `test_287_ac5_admin_styles_use_tokens_only` and the global token test keep passing unchanged.
- **Tap size:** the 44 px tap size and minimum width are switched off inside `.admin-shell` only.
  The global rule and its test stay.
- **Width:** `.admin-shell` has a minimum width of 1024 px (`--adm-min-width`). The rail is always on
  the left, and the 900 px phone breakpoint is removed.
- **"Shown to users" (Companions):**
  - "Published" when phones can open at least one of his stories;
  - "Not ready" otherwise.
- **"Last change" (Companions):** the newest Publish history entry whose key belongs to him, shown as
  who · `MM-DD`. That covers his fields, his stories' fields and his stories' cards. If there is
  none, it shows "—".
- **Readable names in Publish history (row 48):** one pure function names every row, with the key
  shown after the name in a chip.

  | Kind | Name |
  |---|---|
  | `app_text` | "App text · screen F3" |
  | `story_card` | "<story title> · background card" or "<story title> · part N, card M" |
  | `companion_field` | "<Companion name> · <field label>", for example "J. Robert Oppenheimer · Who I am" or "· period 2 name" |
  | `story_field` | "<story title> · <field label>" |
  | `prompt` | the prompt's purpose ("His reply in the rest chat") |

  An unknown key shows the kind label.
- **Removed admin phone-width checks:**
  - the 360 px case of `test_287_ac5_no_sideways_scroll_*` becomes 1024 px;
  - `test_288_ac2_no_sideways_scroll_at_360_px` and `test_289_ac2_no_sideways_scroll_at_360_px` are
    removed;
  - the nine admin paths are removed from `e2e/large-text.spec.ts`.

  All of them are listed in the pull request with the reason.
- **`DESIGN.md`:** Yue adds one line by hand. The suggested sentence goes in the pull request.

## Approaches considered
- **A. Admin tokens in `tokens.css`, admin CSS rewritten in `globals.css` (chosen).** It keeps the
  token tests and one source of truth for values. The cost is about 80 new tokens.
- **B. A separate admin stylesheet with the prototype's CSS pasted in.** It's the fastest copy, but it
  gets around the token tests in spirit and leaves two places for colours.
- **C. Override the app tokens (`--bg`, `--ink`, sizes) inside `.admin-shell`.** It needs few edits,
  but the app token names would mean something different in the admin, and the buttons' paper-tag
  rules would still leak through.

## Pages
- **Shell:**
  - prototype rail: brand 19 px title font, "Content admin" 11 px capitals, group names 10.5 px;
  - rows padded 6 × 8 px with 10.5 px mono ids, the current page on the accent-soft fill;
  - Sign out at the foot of the rail;
  - main area padded 22 px 24 px 60 px.
- **Every page:**
  - breadcrumb (12 px, muted);
  - title (26 px, 600, title font);
  - lede (muted, at most 68 characters wide);
  - panels with radius 10 px, a 1 px line border and padding 16 px;
  - buttons 13 px, padding 6 × 12 px, radius 7 px, main button with an accent fill;
  - fields 13.5 px, padding 7 × 9 px, radius 7 px.
- **Companions:** table with columns Character, Mode, Stories, Shown to users and Last change. The name
  links to the Companion, with the key chip below it.
- **App text:** table with columns Screen, Key, Text and State.
  - The Text cell holds the published text, any newer draft, the field, Save draft, Publish, the
    Versions list with Roll back, and the status line.
  - The State cell holds a pill: Published, Draft (a newer draft exists), or "Default" (nothing in
    the database).
- **Publish history:** table with columns When, Who, What, Version and a last column.
  - Version shows the version chip and "Rolled back" when that was the action.
  - The last column holds Roll back or "Published now", and its status line.
  - Each row is labelled `<key> v<n>, <Published|Rolled back>`.
- **Stories, cards, fields and prompts:** keep their layout. They take the panel, chip, pill, button
  and field styles and get a breadcrumb.

## Left to the builder
The exact pill state for each label, class names, and how the breadcrumb component is shaped.

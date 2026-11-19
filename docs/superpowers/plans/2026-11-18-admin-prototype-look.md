# Admin prototype look Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At desktop widths the content admin looks like the admin prototype.

**Architecture:**
- `--adm-*` tokens in `src/app/tokens.css` hold the prototype's light and dark values. The admin
  section of `globals.css` is rewritten on those tokens.
- Three pure functions, unit-tested, live in `src/lib/admin/`: history names, short dates, and the
  Companion row facts.
- Pages render tables, pills, chips and breadcrumbs with the same server actions as before.

**Tech Stack:** Next.js 16 App Router, CSS custom properties, Vitest and Playwright.

**Spec:** `docs/superpowers/specs/2026-11-18-admin-prototype-look-design.md`

## Global Constraints
- **Colours:** no colour literal in `globals.css`. Admin CSS uses only `var(--adm-*)` or the existing
  tokens, and literal lengths only from the allowed list (`1px`, `2px`, `0.02em`, `0.025em`).
- **Fonts:** the prototype's lists as written. No new font loading.
- **Width:** `.admin-shell` has a minimum width of 1024 px, and there are no phone-width rules in the
  admin CSS.
- **Tap size:** the 44 px `--target` sizing does not apply inside `.admin-shell`.
- **Functions:** every existing function keeps working: Save draft, Publish, Versions, Roll back,
  status lines and the role checks.

## Review Focus
1. **Unknown keys in Publish history** (an import or a deleted story): the row falls back to the kind
   label and the key, never blank. Tested in Task 1.
2. **A Companion with no stories and no history:** shows "Not ready" and "—". Tested in Task 1.
3. **A date at midnight UTC, or an invalid date string:** `MM-DD HH:mm` in UTC, and the raw value
   when it can't be read. Tested in Task 1.
4. **Dark system setting:** the admin uses the prototype's dark values. Checked in Task 2's token
   test.
5. **Roll back and Save draft still work inside table rows.** Checked by the existing e2e journeys
   once their locators move from article to row (Task 4).

---

### Task 1: Pure helpers (names, dates, Companion facts)

**Files:**
- Create: `src/lib/admin/history-names.ts`, `src/lib/admin/companion-rows.ts`
- Modify: `src/lib/publish-history/admin.ts` (`formatHistoryTime` → `MM-DD HH:mm`, and a `name`
  field on each entry)
- Test: `tests/admin-prototype-look.test.ts`

**Interfaces:**
- **Produces:** `historyItemName(kind: string, key: string, lookup: NameLookup): string`, where
  `NameLookup = { companions: {key_code: string; name: string}[]; stories: {id: string; title: string; key_code: string}[]; promptPurpose: Record<string,string> }`.
  It returns:

  | Key pattern | Name |
  |---|---|
  | `ui.<screen>.…` | "App text · screen <screen>" |
  | `crd.<code>.<story>.bg` | "<title> · background card" |
  | `crd.<code>.<story>.p<n>.c<m>` | "<title> · part n, card m" |
  | `chr.<code>.<field>` | "<name> · <label>" (name "Name", tags "Tags", who "Who I am") |
  | `chr.<code>.period.<n>` | "<name> · period n name" |
  | `<code>.<story>.<field>` | "<title> · <label>" (title, period, goal "Goal sentence", who, opening, path "Life Path description") |
  | prompt key | its purpose |

  If nothing matches, it returns the kind label.
- **Produces:** `companionRow(companion, stories, history): { shown: "Published" | "Not ready"; lastChange: string }`.
  `lastChange` is "who · MM-DD" from the newest history row whose key belongs to him, or "—".
- **Produces:** `formatHistoryTime("2026-11-18T23:42:00Z") === "11-18 23:42"`.

- [ ] Write the failing tests for every key pattern, the fallbacks, Not ready, "—" and the date cases.
- [ ] Run `npx vitest run tests/admin-prototype-look.test.ts` and expect FAIL.
- [ ] Implement, and update the old `formatHistoryTime` expectations in
  `tests/publish-history-admin.test.ts` (the date format changed by request).
- [ ] Run the tests and expect PASS. Commit `feat: names, short dates and Companion facts for the admin (#313)`.

### Task 2: Tokens and shell CSS

**Files:** `src/app/tokens.css`, `src/app/globals.css` (the admin section), `src/app/admin/admin-shell.tsx`,
the new `src/app/admin/admin-ui.tsx` (`Breadcrumb`, `StatePill`, `KeyChip`) and
`tests/admin-prototype-look.test.ts`.

- [ ] **Failing tests:**
  - `tokens.css` defines the `--adm-*` light values (`--adm-bg:#f5f6f4`, `--adm-accent:#1f6f5c`, …)
    and the dark ones inside `prefers-color-scheme: dark`;
  - the admin CSS has `min-width: var(--adm-min-width)` with `--adm-min-width: 1024px`, has no
    `@media (min-width` rule, and resets `min-height`/`min-width` for controls inside `.admin-shell`;
  - `admin-ui.tsx` exports `Breadcrumb`, `StatePill` and `KeyChip`.
- [ ] **Implement:** tokens, then the rewritten admin CSS: rail, menu rows, title, lede, panel, table,
  pill (6 states), chip, buttons inside `.admin-shell`, fields, breadcrumb.
- [ ] Run the tests and expect PASS. Commit.

### Task 3: Pages

**Files:**
- Companions, App text and Publish history: pages and editors become tables.
- Every page: a breadcrumb instead of the "‹" back links.
- Editors: `StatePill` instead of `admin-text-state` labels, `KeyChip` for keys.

- [ ] **Failing tests (static, in `tests/admin-prototype-look.test.ts`):** the pages contain `<table`
  with the column headers:
  - Character, Mode, Stories, Shown to users, Last change;
  - Screen, Key, Text, State;
  - When, Who, What, Version.

  Every page renders `Breadcrumb`.
- [ ] Implement. Commit.

### Task 4: Browser tests, docs, removals

- [ ] **New `e2e/admin-look.spec.ts`:** at 1280 px, the computed styles of the shell (body background
  `rgb(245, 246, 244)`, 14 px, rail 232 px with a white background, current page `rgb(226, 240, 235)`,
  title 26 px weight 600) and of one table (Publish history: header cells 11 px upper case, cells
  padded 8 × 10 px, panel radius 10 px), plus the page minimum width 1024 px.
- [ ] **Locators:** move the existing admin e2e locators from article to row where the markup became a
  table.
- [ ] **Remove the admin phone-width checks** (as listed in the spec).
- [ ] **Docs:**
  - `docs/DECISIONS.md` gets ADMIN-DESKTOP and NAMING-CODE;
  - `architecture.md` and `testing.md` are updated;
  - the #287 spec gets a note that its look was replaced.
- [ ] **Screenshots:** side by side at 1280 px. Then the full suite, lint and format.

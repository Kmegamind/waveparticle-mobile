# Architecture
What exists today comes from the code. Planned parts are labeled "planned".

## Overview
```
Browser (installed web app, mobile first)
   └─ Next.js App Router  (src/app)
        ├─ pages and components            exists: one page
        ├─ src/lib                          exists: clock formatting, story start, model gateway
        ├─ route handlers (AI and data)     planned
        └─ Supabase (sign-in, Postgres)     exists: clients and first user-data schema
```

## Components
One file per component in this folder. To add one, create `docs/architecture/<component>.md` (a `# Name` line, a first sentence, then `Path:` with its files) and run `node scripts/docs-index.mjs` (`npm run docs:index`); it rewrites only the lines between the index markers.

<!-- index:start -->
- [Account and privacy](account-and-privacy.md): #102, #103, #104, #8 AC3.
- [Admin area](admin-area.md): `/admin` (#287, ADMIN, `docs/decisions/0016`): the content admin shell (product name and "Content admin", the menu with Companions ADM-03 (#309), Stories ADM-06 (#293), App text ADM-07 (#288),…
- [App shell](app-shell.md): Header and tab bar.
- [App text](app-text.md): #288 (APP-TEXT, `docs/decisions/0017`): the app's own words under keys `ui.<screen>.<slot>`.
- [Clock formatting](clock-formatting.md): Formats seconds as `MM:SS`, never below `00:00`
- [Companion and story fields](companion-and-story-fields.md): #309 (`docs/decisions/0024`): ADM-03 `/admin/companions` lists the Companions.
- [Companions list](companions-list.md): COMP (#268): Oppenheimer and Moriarty (OTHER-COMPANIONS) as a radio group; Enter opens Oppenheimer's Life Path, and stays disabled with a visible reason for Moriarty, who has no stories yet
- [Connection check](connection-check.md): `npm run check:supabase` prints OK or FAIL without printing any value
- [End-to-end tests](end-to-end-tests.md): Playwright journeys at mobile size
- [Focus and rest (account)](focus-and-rest-account.md): `/focus` and `/rest` (#257) for a signed-in user on the account's Goal and session.
- [Goal dialogue (account)](goal-dialogue-account.md): `/goal` (#32): the same dialogue for a signed-in user.
- [Goal dialogue (prototype)](goal-dialogue-prototype.md): `/try/goal`: opening, time, split question, editable Plan card and the failure screen (FLOW 4.3).
- [Goals area](goals-area.md): `/goals` (#73, #77, #79, #80, #112): four tabs (In progress grouped Ongoing and One-time, On hold, Done, History), search, History filters by Goal and time range (All time, This week from Monday,…
- [Home page](home-page.md): Signed-in Home from the account only (#268, prototype v4).
- [Life Path (account)](life-path-account.md): `/companions/oppenheimer` (CPAGE, #258): the 26 stories under six named periods (each story's `period`, #284) (drafts, PERIOD-NAMES) with no dates or ages.
- [Me area](me-area.md): ME (#81): initials, display name with Edit (`profiles.nickname`), email, first-launch date, the Current goal with #69's Continue, On hold, Appearance (Day, Night, System), Plain text, History…
- [Model gateway](model-gateway.md): Server-only calls for the plan split, step cards, the stuck story, the rest reply and the return pop-up.
- [Prompts (ADM-08)](prompts-adm-08.md): Every gateway prompt and its check limits, read from `public.prompts` through `getActivePrompt` (#282, `docs/decisions/0015`).
- [Publish history](publish-history.md): #289 (`docs/decisions/0018`): every publish and roll back writes one `public.publish_history` row in the same transaction (kind, key, version, action, editor, time).
- [Root layout](root-layout.md): Page shell, install metadata and the phone viewport.
- [Server progress](server-progress.md): Story binding on a session, step positions, and shown lines.
- [Shared session screens](shared-session-screens.md): The focus page (seam with Step label, paired Step marks and clock; cards; Done, Undo, Pause; return pop-up; system back acts as Pause, and opens Home on the pop-up; one light haptic at 00:00) and the…
- [Story cards (ADM-06)](story-cards-adm-06.md): #293 (`docs/decisions/0020`): the pre-written cards of the 26 Oppenheimer stories (a background card and the cards of each part, keys `crd.opp.<story>.bg` and `crd.opp.<story>.p<n>.c<n>`) and the…
- [Story content](story-content.md): #284 (`docs/decisions/0019`): the Companions and their stories, read from `public.companions`, `public.stories` and `public.story_inputs` through `getStoryContent()` (one keyed call, cached at most…
- [Story inputs](story-inputs.md): The 26 Oppenheimer stories' generation inputs (#254), from the story content snapshot (#284).
- [Story start](story-start.md): Divides a story across the plan's steps when Start is pressed.
- [Summary (account)](summary-account.md): `/end?session=<id>` (END, #258): the last Done of the signed-in focus page opens it for that account session.
- [Supabase clients](supabase-clients.md): Browser client (public key), server client (reads request cookies), `getCurrentUser`, settings reader
- [Test focus page](test-focus-page.md): `/try/focus`: Step x of N, the clock from timestamps (holds at 00:00), his cards on a slip one at a time with Earlier and Newer (live cards, #43: the chapter 8 Story divided across the Plan's Steps…
- [Test path (prototype)](test-path-prototype.md): Sign-in-free `/try` route for test builds only (the goal dialogue, focus and rest pages use the Oppenheimer skin through `src/app/try/try-frame.tsx`), on when `PROTOTYPE_ENABLED` is `1` (the proxy…
- [Test rest page and return pop-up](test-rest-page-and-return-pop-up.md): `/try/rest` (R1, R1-C): Back to step, "Paused" and Home in the header; his first message for this Pause (the pause number goes to the prompt), then a free conversation with no limit; every message…
- [Typefaces](typefaces.md): Loads Atkinson Hyperlegible Next and Mono, Bricolage Grotesque and Newsreader with `next/font` (served from this site) and passes them to the `--type-*` tokens
- [Unit tests](unit-tests.md): Vitest tests and the guardrail hook test
- [User-data schema](user-data-schema.md): Profiles, account-owned Goals and Steps, and Sessions with row-level security
- [Web app manifest](web-app-manifest.md): Install name, icons and standalone display
<!-- index:end -->

## Data model
The first migration implements the account-owned subset of the proposal in
`docs/CONTENT_MODEL.md`: `profiles`, `goals`, `steps`, and `sessions`.
The progress migration adds the story binding on `sessions`, `session_steps`,
and `session_lines`.

Every user-data table has row-level security enabled. Policies use `auth.uid()`
for direct ownership. Steps inherit ownership through their Goal. Session steps
and lines inherit ownership through `sessions.user_id`. Shown lines can be
inserted and read; there is no update policy on `session_lines`.

The foreign keys from profiles, goals, and sessions to `auth.users` use
`on delete cascade`. Steps cascade from their Goal. Session steps cascade from
the session and the step. Lines cascade from the session and, when set, the
session step. Deleting an account therefore removes that account's Goals,
Steps, sessions and shown lines.

Content roles (#287) live in `public.content_roles` (`user_id`, `role` `admin` or `writer`),
with row level security on and no policy, so no account reads or changes it through the API. The
`security definer` functions `content_role()` (the caller's role or null) and `is_content_editor()`
answer for `auth.uid()` only; later content tables use them in their policies.

App text (#288) lives in `public.app_text` (`key`, `version`, `body`, `published`, `published_at`,
`published_by`, `created_by`, generated `screen`), one published version per key. Its policy lets
anyone read published rows and content editors read every row; nothing is written through the
table. `save_app_text_draft`, `publish_app_text` and `roll_back_app_text` (`security definer`,
role-checked) write it; publish and roll back share `private.set_published_app_text`.

Publish history (#289) lives in `public.publish_history` (`kind`, `item_key`, `version`, `action`,
`acted_by`, `acted_at`), shared by every kind of content (`app_text` today). Only
`private.set_published_app_text` inserts rows, in the publish transaction; content editors may
select, and nobody inserts, updates or deletes through the API. `list_publish_history(row_limit)`
(`security definer`, editors only) returns the rows with the editor's email.

Companion and story fields (#309) keep their versions in `public.content_fields` (`key`,
`version`, `companion_id`, `story_id`, `field`, `body`, `published`, `published_at`,
`published_by`, `created_by`), one published version per key, readable by content editors only.
`save_content_field_draft`, `publish_content_field` and `roll_back_content_field` (`security
definer`; publish and roll back for the `admin` role only) write it. A publish copies the text into
`companions` (`name`, `tags`, the new `who`) or `stories` (`title`, `period`, `goal_short`, `who`,
`opening`, the new `path`); a period name renames the period on all its stories.

Story cards (#293) live in `public.story_cards` (`key`, `version`, `story_id`, `kind`
`background` or `part`, `part`, `slice`, `position`, `body`, `published`, `published_at`), one
published version per key, and part titles in `public.story_parts` (`story_id`, `part`, `title`).
Both have row level security with one select policy for content editors; nothing is written
through the tables. Drafts, part titles, publish and roll back go through role-checked functions
(#304; publish and roll back for the `admin` role only). The server reads a story's published cards, or a session's pinned versions, through
`get_story_cards(reader_key, story, versions)` (#300); `sessions.card_versions` records the versions
a session uses (`docs/decisions/0021`).

Prompts (#282) live in `public.prompts` (`key`, `version`, `active`, `body`, `params`, `note`,
`created_by`, `activated_at`, `activated_by`), one active version per key, closed to the API.
Editors read every version through `list_prompt_versions()`; `save_prompt_draft` adds an
inactive version, and `publish_prompt` and `roll_back_prompt` (admin only, #308) make a version
active through `activate_prompt` and write a `prompt` history row in the same transaction.

A Plan is the Goal's Steps. Story progress for a Companion is the completed
sessions grouped by `companion_id` and `story_id`. A restarted session does
not count. Pause messages and return pop-ups are `session_lines` rows. There
is no plan table, progress table, or separate event table.

## Interfaces
See `docs/api/`.

## Constraints
- The clock must use timestamps, not page timers, because browsers pause timers in the background (planned; see `docs/TECH_STACK.md`).
- Task text is stored on our server and sent to a language model (decision S3 in `docs/DECISIONS.md`); the privacy notice (`/privacy`) and account deletion (`/me/delete-account`) exist (#102, #103).
- Generated story text must pass the checks in `docs/CONTENT_MODEL.md` before it is shown.
- Model keys stay on the server. The gateway reads `MODEL_API_KEY`, `MODEL_API_URL` and `MODEL_NAME`, and its log records rule ids and timing only.

## Quality gates
| Gate | Where | Blocks |
|---|---|---|
| Lint, format, unit, e2e | CI on every PR | Merge (with branch protection) |
| PR closes an issue | CI | Merge |
| Commits/pushes to main, agent merges, secret reads, rule edits | Claude Code hook | The agent's command |
| Deploy commands | Claude Code hook (asks a human) | The agent's command |

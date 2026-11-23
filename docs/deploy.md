# Deploy

Status: Vercel setup and deployment require a human with repository and Vercel
access. Agents do not run Vercel commands or deploy.

## Build runtime

Vercel is set to Node.js 24.x, the same line as `.nvmrc` and the repository's Node
constraint (`>=24.0.0 <25`). Vercel also offers Node 26 in its version list (checked
on 2026-11-05), but a build on Node 26 has not been tried, so Node 26 is not
verified. Moving to Node 26 is a later, separate change (`docs/decisions/0003`).

| Environment | Where | Trigger |
|---|---|---|
| Preview | Vercel preview deployment | Each pull request |
| Production | Vercel production environment over HTTPS | Push to `main` after review |

## Human setup checklist

1. Link the GitHub repository to the Vercel project.
2. Configure preview deployments for pull requests and production deployment
   from `main`.
3. Add environment variables in Vercel's project environment settings or CI
   secrets. Never commit `.env` or copy secret values into this repository.
4. After the first production deployment, replace the pending URL in
   `README.md` with the HTTPS URL.

## Test path flag
`PROTOTYPE_ENABLED=1` turns on the sign-in-free test path `/try` (`docs/decisions/0011`). Only `/try`
depends on it: the signed-in session pages (`/goal`, `/focus`, `/rest`, `/end`) and every link to them
exist in every environment for signed-in users (`docs/DECISIONS.md`, SESSION-PAGES-OPEN). Set it in
Vercel for **Preview only** (Project → Settings → Environment Variables, scope Preview), never for
Production. It is server-only: never give it the `NEXT_PUBLIC_` prefix. Keep Vercel Deployment
Protection on for previews, because the test path can call the paid model. Production also calls the
paid model for signed-in sessions, with no per-account cap (#256 is in "Later"); the owner monitors
usage in the model provider's dashboard.
The per-browser daily limit of 20 real model calls (cookie `wp_try_model_calls`, `src/lib/prototype/cost-cap.ts`) is
counted separately for `/try` and `/goal`: the cookie is scoped to each path, so a browser gets 20 on each
page, not 20 shared between them.

## Secrets
`PROMPTS_READ_TOKEN` (server only, Production and Preview) lets the server read the prompts table; see `docs/ai/prompts/README.md` (#282).
`CONTENT_READ_KEY` (server only, Production and Preview) lets the server read the story content (#284, `docs/decisions/0019`). Make one with `node scripts/content/token.mjs`: it prints the key for Vercel and one SQL line that stores only its SHA-256 in `private.content_reader`. Then load the content with `node scripts/content/import.mjs` (prints SQL for the SQL editor) and redeploy. Without the migration, the key and the import, the pages that show story content fail.
Before the next content import after #302, run `supabase/migrations/20261122000000_companion_mode.sql` (each Companion's `mode` and `key_code`, `docs/decisions/0022`). The import loads every Companion in `src/content/companions.json`; `node scripts/content/import.mjs --companion <id>` loads only that Companion's stories. A story whose screen lines are missing stops the import and is listed.
`GOAL_DIALOGUE_SECRET` (server only, Production and Preview, at least 32 characters) signs the goal dialogue's turns (#31, `docs/decisions/0026`). Make one with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Without it, every goal dialogue in that environment shows the failure screen (GD-F) and the log has `secret_missing`. Changing it ends only the dialogues open at that moment.
Safety classifier (#117, US-SAF-4). The classifier uses the gateway's `MODEL_API_KEY`, `MODEL_API_URL` and `MODEL_NAME` (owner decision of 2026-11-22, SAFETY-PROVIDER). Optional, server only: `SAFETY_MODEL_API_KEY`, `SAFETY_MODEL_API_URL` and `SAFETY_MODEL_NAME` each replace the gateway's setting of the same kind for the classifier only, for example a smaller, faster model. Without any model setting the keyword layer decides alone and no alarm is raised.
`SAFETY_ALARM_WEBHOOK_URL` (server only, Production and Preview) is the same-day alarm (SAFETY-ALARM): when the classifier fails or takes longer than 1.5 seconds, the server posts `{"text": ..., "content": ...}` to this address at most once a day (UTC): on the day's first failure, with its date, time and reason, never any text a person wrote. Later failures that day are not posted; they are in the server log and counted in `private.safety_alarm_days` (`select * from private.safety_alarm_days order by day desc` in the SQL editor). A Slack or Discord incoming-webhook address works. Without it, the server only logs `safety_classifier_failed` (level error, feature `safety`). The once-a-day rule is shared by every server instance through `supabase/migrations/20261127000000_safety_alarm_days.sql`, which uses the existing `PROMPTS_READ_TOKEN`; run it before deploying #117. Without the migration each server instance sends its own one alarm a day. Then load the new prompt `safety_classifier` with the prompt import (`docs/ai/prompts/README.md`); until it is loaded every classifier call fails as `prompt`, the keyword layer decides alone, and the alarm fires.
Real values live in the platform's environment settings or CI secrets. `.env.example` lists the names.

## Admin roles
The content admin at `/admin` (#287, `docs/decisions/0016`) opens only for an account with the
`admin` or `writer` role; everyone else gets the normal 404. The account must already exist (signed
up once). To give it a role, run one command in the Supabase SQL editor (use `'admin'` for an admin):

```sql
insert into public.content_roles (user_id, role)
select id, 'writer' from auth.users where email = 'person@example.com'
on conflict (user_id) do update set role = excluded.role;
```

The same command changes a role. To remove one:

```sql
delete from public.content_roles
where user_id = (select id from auth.users where email = 'person@example.com');
```

The migration `supabase/migrations/20261116000000_content_roles.sql` must run first. No key with full
database rights is needed: the app asks `public.content_role()` with the signed-in user's session.

## App text
The app's own words (#288, `docs/decisions/0017`) live in `public.app_text`. Run the migration
`supabase/migrations/20261117000000_app_text.sql` (after the content roles migration), then load the
code defaults as version 1, published:

```sh
node scripts/app-text/import.mjs > app-text-import.sql   # paste into the Supabase SQL editor
node scripts/app-text/import.mjs | psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1
```

The seed only adds keys that have no rows yet, so running it again, or after a writer published an
edit, changes nothing; run it after every change that adds keys to `src/content/app-text.json`.
Without the migration or the seed the app shows the code defaults, so the screens look the same. No
new setting is needed: published rows are read with the public key.

## Publish history
Every publish and roll back writes a row to `public.publish_history` (#289,
`docs/decisions/0018`), shown at `/admin/publish-history`. Run the migration
`supabase/migrations/20261118000000_publish_history.sql` after the app text migration. It also
replaces `private.set_published_app_text` (the history insert, and roll back to any version
published before). Until it runs, publish and roll back work without history rows and the page says
the history could not be read; publishes made before it have no rows. No new setting is needed.

## Story cards
The pre-written story cards (#293, `docs/decisions/0020`) live in `public.story_cards` and
`public.story_parts`, shown at `/admin/stories`. Run the migration
`supabase/migrations/20261120000000_story_cards.sql` after the story content migration and its
import (#284), then load the cards as version 1, published:

```sh
node scripts/story-cards/import.mjs > story-cards-import.sql   # paste into the Supabase SQL editor
```

A card that already has a row is left alone, so running it again changes nothing. No new setting
is needed.

The signed-in focus page reads the published cards (#300, `docs/decisions/0021`): run
`supabase/migrations/20261121000000_premade_cards.sql` before deploying that change, or the focus
page shows the failure screen. It uses the existing `CONTENT_READ_KEY`.

Editing and publishing cards in the admin (#304, `docs/decisions/0023`): run
`supabase/migrations/20261123000000_story_card_editing.sql` after the story cards, pre-made cards
and publish history migrations. It adds the functions behind Save draft, Save title, Publish and
Roll back (Publish and Roll back for the `admin` role only) and lets the publish history list
story cards. It changes no card and no phone read. Until it runs, the Stories page still shows
the cards, but saving says the change could not be saved. No new setting is needed.

Since #377 (`docs/decisions/0028`) Save draft and Publish also check a card against the other
published cards of its story (a repeat, the same first three words as one of the four cards
before it, a near repeat). Roll back runs the same checks on the version it would make live and,
when that version has problems, shows a warning to confirm; it is never refused. This needs no
migration and no setting.

### Fixing the published cards that fail the checks (#377)
Version 1 of every card was loaded as published without the card checks. An earlier change
(pull request #375) corrected the 25 cards that fail the checks in the seed file
`src/content/oppenheimer/story-decks.json`, but the import leaves cards that already exist alone,
so phones still show the old text of those cards. The script
`scripts/story-cards/fix-published.mjs` prints SQL (the database query language) that publishes
the seed text in their place. It connects to nothing; you run the SQL. Words used below: the
**SQL editor** is the page in the Supabase dashboard where you paste and run SQL (Supabase
dashboard, your project, **SQL Editor**); **psql** is the PostgreSQL command-line program;
`SUPABASE_DB_URL` is your database connection string (Supabase dashboard, **Connect**), kept in
your own shell and never written into a file in this repository.

**What it changes.** For every card of the seed file, in one transaction (all or nothing):

- its published text is already the seed text: nothing changes. So running it a second time
  changes nothing;
- it has only version 1, published, with other text: the seed text is added as version 2 and
  published through the same database function as the admin's **Publish** button, as the admin
  account you name. Publish history gets a "Published" row for it, and version 1 stays as an
  earlier version you can roll back to;
- it was edited in the admin after the import (it has more than one version), it has no published
  version, or it is not in the database: it is left alone and listed as "skipped".

Nothing else changes: no part title, no other table, no phone setting.

**Steps**

1. Check the prerequisites. Every migration (the database change files in
   `supabase/migrations/`) up to and including `20261123000000_story_card_editing.sql` must
   already have run, and the cards must already be imported. If that
   migration is missing, the SQL stops with "Run
   supabase/migrations/20261123000000_story_card_editing.sql first" and changes nothing. Your
   account must have the `admin` role. To give it that role, run this in the SQL editor with your
   own email address (the account must have signed in to the app once):

   ```sql
   insert into public.content_roles (user_id, role)
   select id, 'admin' from auth.users where email = 'you@example.com'
   on conflict (user_id) do update set role = excluded.role;
   ```

2. Deploy first if you can. Merge and deploy the pull request that adds this script (pull
   request #394) before you run the fix, so that the Stories page counts repeated cards as
   failing and you can check the result in step 7. The SQL itself does not need the new app; only
   the check in step 7 does.
3. Rehearse with a dry run. In a terminal, in the repository on an up-to-date `main`, print it
   with the email address of your admin account. If you run this before the pull request is
   merged, first run `git fetch origin && git checkout feat/377-publish-pool-checks`; after
   merging, use `main`.

   ```sh
   node scripts/story-cards/fix-published.mjs --by you@example.com --dry-run > story-cards-dry-run.sql
   ```

   Run it, either way:
   - SQL editor: paste all of `story-cards-dry-run.sql` and press **Run**. If the editor warns
     about a "destructive operation", that is the `drop table if exists` of the two temporary
     tables the script makes for itself; confirm.
   - Terminal: `psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f story-cards-dry-run.sql`

   It does all the work, then stops on purpose with an error that starts **"Dry run: nothing was
   changed."**, followed by one line per card: "published: the seed text (v2)" means the real
   run will publish that card; "skipped: ..." means the real run will leave it alone. Every change
   is undone, so the database is exactly as before. Read the list: expect 25 cards to publish
   (the cards that were corrected in the seed file) and no skipped card. If you see an error other than
   "Dry run: nothing was changed.", nothing was changed either; read it (a missing migration, or
   "No admin account with the email ...": give that account the admin role or use the right
   email) and stop here.
4. Optional, read only: `node scripts/story-cards/fix-published.mjs --check > story-cards-check.sql`
   and run it the same way. It lists every card with its outcome ("to publish", "done" or
   "skipped") and its published text now, so you can see the text each card loses.
5. Run the fix for real:

   ```sh
   node scripts/story-cards/fix-published.mjs --by you@example.com > story-cards-fix.sql
   ```

   Run `story-cards-fix.sql` the same way as in step 3. The last result is the report: one row per
   card it published ("published: the seed text", with the new version) and one per card it
   skipped. It should match the dry run. If an error appears instead, nothing was changed.
6. Run the check of step 4 again. Every card should now say "done: the seed text is published",
   except the cards that were skipped. Running the fix a second time prints an empty or skipped-only
   report and changes nothing.
7. Check in the admin, on the live site:
   - `/admin/stories`: no story shows "Failing". If one does, open it: the problems name the card
     and the rule.
   - `/admin/publish-history`: one "Published" row per fixed card, by your account, at the time
     you ran it, each marked as published now.
   - Optional SQL check of the history:

     ```sql
     select item_key, version, action, acted_at
     from public.publish_history
     where kind = 'story_card' and acted_at > now() - interval '1 hour'
     order by item_key;
     ```

8. If the dry run or the report lists skipped cards:
   - "skipped: edited in the admin": someone saved or published a new version of that card after
     the import. Open `/admin/stories/<story>` (the story is the middle part of the key, for
     example `cross-examination` in `crd.opp.cross-examination.p4.c2`), find the card by its key,
     and compare its text with the seed text (search the key in `story-cards-fix.sql` or in the
     seed file). Keep the edited text if it passes every check, or paste the seed text, press
     **Save draft**, then **Publish**.
   - "skipped: no published version": publish the version you want on the story page.
   - "skipped: not in the database": run the card import
     (`node scripts/story-cards/import.mjs > story-cards-import.sql`, then run that file the same
     way as in step 3) and then this fix again, starting with the dry run.
9. To undo the fix for one card: open `/admin/stories/<story>`, open the card's **Versions**, and
   press **Roll back to v1**. (`/admin/publish-history` has no row for version 1, because the import
   loaded it without one; its **Roll back** works on versions published in the admin and warns in
   the same way.) A warning appears first: version 1 fails the checks the fix was for, so the page lists its
   problems and asks you to confirm. Press **Roll back anyway** to roll back (or **Cancel**). Roll
   back is never refused, so version 1 comes back with that problem and the card shows as failing
   again. There is no undo for all cards at once: one roll back per card.

## Companion and story fields
Editing a Companion's and a story's fields in the admin (#309, `docs/decisions/0024`): run
`supabase/migrations/20261124000000_content_fields.sql` after the story card editing migration. It
adds `companions.who` and `stories.path`, the versions table and the functions behind Save draft,
Publish and Roll back (Publish and Roll back for the `admin` role only), and lets the publish
history list these fields. It changes no text the app shows and no phone read. Until it runs, the
Companions pages say the Companion could not be read. No new setting is needed.

After this change the content import (`scripts/content/import.mjs`) no longer overwrites a
Companion's name and tags or a story's title, period, goal sentence, "Who I am" and opening on rows
that exist: the text published in the admin stays.

## Prompt editing
Editing the prompts in the admin (#308, `docs/decisions/0025`): run
`supabase/migrations/20261125000000_prompt_editing.sql` after the prompts migration and its import
(#282), the story card editing migration (#304) and the Companion and story fields migration
`20261124000000_content_fields.sql` (#310). It widens the same Publish history kind check and list,
keeping every earlier kind and adding `prompt`. It adds who and when columns to
`public.prompts` and the functions behind ADM-08 (list, Save draft, and admin-only Publish and Roll
back with a `prompt` row in Publish history). It changes no prompt and not the server's read.
Until it runs, the Prompts page says the prompts could not be read; the app keeps using the
active prompts. No new setting is needed.

Then run `supabase/migrations/20261126000000_prompt_activated_at.sql` (#317). It adds a trigger
that fills `prompts.activated_at` when the import or the table editor makes a version active
(never changing a value already set), and fills it for the version active now. Without it, such a
version shows as "Draft" once replaced and cannot be rolled back to. It only reads Publish history.

## Server logs
The server writes log lines only through `logEvent` in `src/lib/logging/server-log.ts` (#135). Each
line is one JSON object: `level`, `feature` (`app_text`, `prompts`, `story-content`, `story-cards`,
`model-gateway`, `goal-dialogue`, `safety`), `event`, `requestId`, and for model calls `durationMs`, `call`, `reason`,
`attempts` and `rejectedRules`. Lines are written for failed reads, failed model calls, and model
calls that take 5 seconds or longer. They never hold a Goal, a Step, a chat message, a card or any
other text: user-text field names are refused and every value must be a short identifier. A unit
test fails if code passes user text, or logs with `console` anywhere else in `src/`.

Where to look: in Vercel, open the project, then **Logs** (Runtime Logs). Filter by the level
(Warning, Error) or search for a feature, for example `"feature":"model-gateway"`, or for a
`requestId`. Vercel keeps runtime logs for **1 hour on Hobby** and **1 day on Pro**; Observability
Plus on Pro keeps them for 30 days (Vercel documentation, checked on 2026-11-20). For longer
retention, set up a Vercel log drain; none is configured.

## After each deploy
- Smoke test: open the deployed home page and confirm the product name is
  visible. To run the end-to-end test against a deployed address instead of a local
  build: `E2E_BASE_URL=https://<the address> npm run test:e2e`.
- Logs / monitoring: inspect the Vercel deployment logs and the runtime logs
  (see "Server logs" above) for the deployment.
- Rollback: use Vercel's deployment history to promote the last known-good
  deployment; do not rewrite `main`.

Agents never deploy on their own; the hook asks a human for any command in
`deploy_patterns` (`.claude/guardrails.json`).

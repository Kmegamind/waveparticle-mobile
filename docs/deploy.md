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

## Secrets
`PROMPTS_READ_TOKEN` (server only, Production and Preview) lets the server read the prompts table; see `docs/ai/prompts/README.md` (#282).
`CONTENT_READ_KEY` (server only, Production and Preview) lets the server read the story content (#284, `docs/decisions/0019`). Make one with `node scripts/content/token.mjs`: it prints the key for Vercel and one SQL line that stores only its SHA-256 in `private.content_reader`. Then load the content with `node scripts/content/import.mjs` (prints SQL for the SQL editor) and redeploy. Without the migration, the key and the import, the pages that show story content fail.
Before the next content import after #302, run `supabase/migrations/20261122000000_companion_mode.sql` (each Companion's `mode` and `key_code`, `docs/decisions/0022`). The import loads every Companion in `src/content/companions.json`; `node scripts/content/import.mjs --companion <id>` loads only that Companion's stories. A story whose screen lines are missing stops the import and is listed.
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

## Prompt editing
Editing the prompts in the admin (#308, `docs/decisions/0024`): run
`supabase/migrations/20261124000000_prompt_editing.sql` after the prompts migration and its import
(#282) and the story card editing migration (#304). It adds who and when columns to
`public.prompts` and the functions behind ADM-08 (list, Save draft, and admin-only Publish and Roll
back with a `prompt` row in Publish history). It changes no prompt and not the server's read.
Until it runs, the Prompts page says the prompts could not be read; the app keeps using the
active prompts. No new setting is needed.

## After each deploy
- Smoke test: open the deployed home page and confirm the product name is
  visible. To run the end-to-end test against a deployed address instead of a local
  build: `E2E_BASE_URL=https://<the address> npm run test:e2e`.
- Logs / monitoring: inspect the Vercel deployment logs and runtime errors for
  the deployment.
- Rollback: use Vercel's deployment history to promote the last known-good
  deployment; do not rewrite `main`.

Agents never deploy on their own; the hook asks a human for any command in
`deploy_patterns` (`.claude/guardrails.json`).

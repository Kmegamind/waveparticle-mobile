# Human steps

Every task that only a human can do, with the exact click path (#189). A pull request names the
steps its merge needs in its "Human steps" section and links here. Agents never do these steps,
never guess one, and never run a command against production. If a step a change needs is not on
this page, the agent stops and asks a human, and the step is added here first.

Words used below: **dev** is the Supabase project and Vercel Preview deployments used for testing;
**prod** is the Supabase project behind the Vercel Production deployment. The repository does not
record whether dev and prod are separate Supabase projects today (`docs/design/prototype/GAP_LIST_V4.md`
speaks of one "shared Supabase project"). If they are the same project, "Apply to dev, then prod"
is one run; write the two project refs into the table below once they are known.

| | dev | prod |
|---|---|---|
| Supabase project ref | not recorded yet (owner) | not recorded yet (owner) |
| Vercel scope | Preview | Production |
| Who may change it | the product owner, or a developer the owner names | the product owner only |

## Who logs in, and where the tokens live

- **Supabase:** the product owner (YUE LI, GitHub `Kmegamind`) logs in with their own Supabase
  account. `supabase login` opens the browser and stores the personal access token in the
  operating system's keychain (macOS Keychain). It is never written to the repository, a `.env`
  file in the repository, a pull request or a chat. To check the post-deploy database part
  without the CLI, the same person makes a token at <https://supabase.com/dashboard/account/tokens>
  (**Generate new token**) and keeps it in their own shell as `SUPABASE_ACCESS_TOKEN`.
- **Database password:** asked for by `supabase link` and `supabase db push`. It lives in the
  owner's password manager. It cannot be read back in the dashboard; to set a new one: Supabase
  dashboard → the project → **Project Settings** → **Database** → **Reset database password**.
  Never in the repository, never in chat.
- **Project ref:** Supabase dashboard → the project → **Project Settings** → **General** →
  **Project ID** (also the first part of the project URL, `https://<ref>.supabase.co`). Not a
  secret.
- **Vercel and GitHub:** the owner's own accounts. Agents have no Vercel access.

## Open now (2026-11-24)

Steps that are waiting today. Tick them off by deleting the line in a pull request once done.

1. **[dev, prod] Apply to dev, then prod: `supabase/migrations/20261128000000_hotlines.sql`**
   (#118, `docs/deploy.md`, Help lines by region). Apply it **before** deploying #118, after
   `20261125000000_prompt_editing.sql`. Running it a second time stops with an error and changes
   nothing. Check: `select count(*) from public.hotlines;` in the SQL editor returns 1 (the US
   entry), and `npm run check:deploy` no longer says "no table public.hotlines".
2. **[prod] Fix the published story cards that fail the checks** (#377, #46): follow
   `docs/deploy.md`, Story cards, "Fixing the published cards that fail the checks (#377)", steps 1
   to 9: give your account the `admin` role, deploy pull request #394, run the dry run, read the
   list (expect 25 cards to publish and none skipped), run the fix, run the check again, then look
   at `/admin/stories` (no story "Failing") and `/admin/publish-history`. Run it on dev first if dev
   is a separate project.
3. **[prod] Set `MODEL_CALL_LIMIT_ENABLED` to `0` in Vercel, scope Production** (TEST-NO-CAP,
   #256): Vercel → the project → **Settings** → **Environment Variables** → **Add New** (or the
   existing row → **Edit**), key `MODEL_CALL_LIMIT_ENABLED`, value `0` (no quotes), environment
   **Production** only, server only (no `NEXT_PUBLIC_` prefix) → **Save**. Then redeploy (below).
   Before public release, set it back to `1` or remove it.
4. **[prod] Publish `plan_split` version 2** (PLAN-PROMPT, #40, pull request #409). Either way
   below; run it on dev first if dev is a separate project.
   - Admin (records who published): sign in on the live site with an `admin` account →
     `/admin/prompts` → **plan_split** → paste the settings and the prompt of
     `docs/ai/prompts/plan_split.md` (version 2) → **Save draft** → read the diff against the
     active version → **Publish**.
   - Import (no Publish history row): `node scripts/prompts/import.mjs > prompts-import.sql`, paste
     the file into the SQL editor (Supabase dashboard → the project → **SQL Editor**) and press
     **Run**. It adds a version only for prompts whose file changed and makes it active.
   The app uses the new version within one minute.

## Apply migrations

A new file in `supabase/migrations/` is listed in its pull request as
"[dev, prod] Apply to dev, then prod: `<file name>`". Apply it to dev, check, then apply it to prod.
CI checks that the file names are unique and that a new one sorts after every file already on
`main`; if another pull request added a later migration first, rename yours with a new timestamp.

### One-time setup (per computer)

1. Install the Supabase CLI: `brew install supabase/tap/supabase` (not an npm dependency).
2. Log in: `supabase login` (browser; the token goes to the keychain, see above).
3. `supabase link` writes a folder `supabase/.temp/` (the linked project ref, no password). Do not
   commit it: `.gitignore` does not list it yet.

### One-time setup (per project): tell the CLI what already ran

Every migration up to now was pasted by hand into the SQL editor, so the CLI's history table does
not know they ran, and a first `supabase db push` would try to run them again and fail with
"already exists". Do this once per project, in the repository on an up-to-date `main`:

1. `supabase link --project-ref <ref>` (dev ref first; it asks for the database password).
2. `npm run check:deploy` against that environment (below) or the Table editor: confirm which
   migrations are really applied. Do not mark one as applied that is not.
3. `supabase migration list`: the left column is the repository, the right column what the CLI
   thinks ran.
4. Mark each migration that you confirmed in step 2 as applied, for example
   `supabase migration repair --status applied 20261106000000 20261106120000` (list every
   confirmed version, separated by spaces).
5. `supabase migration list` again: every applied migration now shows in both columns.

### Dev: apply every unapplied migration

```sh
supabase link --project-ref <dev ref>
supabase db push --dry-run   # lists what would run, changes nothing
supabase db push
```

Then run `npm run check:deploy` against a Preview deployment (below).

### Prod: the product owner only

Agents never run these commands, not even with `--dry-run`.

```sh
supabase link --project-ref <prod ref>
supabase db push --dry-run
supabase db push
```

Then run `npm run check:deploy` against production. After a prod push, link back to dev
(`supabase link --project-ref <dev ref>`) so the next push does not go to prod by accident.

Without the CLI, the old way still works: Supabase dashboard → the project → **SQL Editor** →
**New query**, paste the whole migration file, **Run**. The CLI then does not know it ran: mark it
with `supabase migration repair --status applied <version>` before the next `supabase db push`.

## Add or change an environment variable

A pull request that adds or changes one names it in three places: `.env.example` (the name and an
empty value), the "Environment variables" table of `docs/deploy.md` (scopes and whether it is
public), and its own "Human steps" (CI checks names it can see).

1. Vercel → the project → **Settings** → **Environment Variables**.
2. **Add New** (or the row's **⋯** → **Edit**): the key exactly as in `docs/deploy.md`, the value,
   and the environments the table names (**Production**, **Preview**, or both). Never Development
   unless the table says so.
3. Only a name that starts with `NEXT_PUBLIC_` reaches the browser. Never give a key, token or
   secret that prefix.
4. **Save**, then redeploy each environment you changed (below): a running deployment does not
   see the change.
5. Run `npm run check:deploy` against it.

## Add a redirect URL in Supabase

Needed when sign-in links must land on a new address (a new domain, a new Preview pattern).

1. Supabase dashboard → the project → **Authentication** → **URL Configuration**.
2. **Site URL**: the production address (`https://waveparticle-mobile.vercel.app`) for prod.
3. **Redirect URLs** → **Add URL**: the address, for example
   `https://waveparticle-mobile.vercel.app/**` or a Preview pattern such as
   `https://*-<vercel team>.vercel.app/**` → **Save URLs**.
4. Sign in once on that address to check.

## Rotate a key

1. Make the new value: for `CONTENT_READ_KEY` run `node scripts/content/token.mjs`, for
   `PROMPTS_READ_TOKEN` run `node scripts/prompts/token.mjs` (each prints the value for Vercel and
   one SQL line with its hash); for `GOAL_DIALOGUE_SECRET` see `docs/deploy.md`, Secrets; for a
   model or Supabase key, the provider's dashboard (Supabase: the project → **Project Settings** →
   **API Keys**).
2. If the script printed SQL, run it in the SQL editor first (it adds the new hash; the old one
   still works until removed).
3. Put the new value in Vercel (Add or change an environment variable, above), for every scope
   that has it, and redeploy.
4. Run `npm run check:deploy`, then remove or revoke the old value (the old hash row, or the old
   key in the provider's dashboard).

## Merge a pull request

1. GitHub → **Pull requests** → the pull request. Read its "Human steps".
2. Check that every check of the newest commit passed, including `pr-human-steps` and
   `pr-closes-issue`, and that it says "This branch has no conflicts".
3. Do the steps marked as "before merging" (for example a migration that must run before the
   deploy), then **Merge pull request** → **Create a merge commit** → **Confirm merge**.
4. Do the remaining steps in order, then run `npm run check:deploy` against production.

## Redeploy

1. Vercel → the project → **Deployments**.
2. The newest deployment of the environment (Production, or the Preview of the branch) → **⋯** →
   **Redeploy** → **Redeploy**.
3. Wait for "Ready", then run `npm run check:deploy`.

To go back to an earlier deployment: the last good Production deployment → **⋯** → **Promote to
Production** (`docs/deploy.md`, After each deploy). Never rewrite `main`.

## Run the post-deploy check

`npm run check:deploy` checks one deployment and prints one line per check (OK, FAIL or SKIPPED),
each a plain sentence; it exits 1 on any FAIL. It never prints a token or a response body.

- The home page and the sign-in page do not answer 5xx.
- A signed-out visit to the home page redirects to `/auth/sign-in`.
- Every table the migrations create exists, and row-level security is on wherever a migration
  turns it on (read with one select through the Supabase Management API).

```sh
E2E_BASE_URL=https://waveparticle-mobile.vercel.app \
SUPABASE_PROJECT_REF=<prod ref> SUPABASE_ACCESS_TOKEN=<your token> npm run check:deploy
```

Set the token in your own shell (or type it on the line as above), never in a file in the
repository. Without `SUPABASE_PROJECT_REF` and `SUPABASE_ACCESS_TOKEN` the command fails, so a
skipped database check never looks like a pass; add `-- --skip-db` to check the website alone
(`npm run check:deploy -- --skip-db`). Agents run it only against a local server, never against
production or a live database.

## Make a CI check required

The `pr-human-steps` and `pr-closes-issue` jobs block a merge only when they are required:
GitHub → the repository → **Settings** → **Branches** → the rule for `main` (**Edit**, or **Add
branch protection rule** with pattern `main`) → **Require status checks to pass before merging**
→ search and add `pr-human-steps` (and `pr-closes-issue`, `check`) → **Save changes**. If the
repository uses rulesets instead: **Settings** → **Rules** → **Rulesets** → the rule for `main` →
**Require status checks to pass** → **Add checks**.

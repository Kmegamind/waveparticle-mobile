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

## Open now (2026-11-25)

Steps that are waiting today. Tick them off by deleting the line in a pull request once done.

1. **[dev, prod] Confirm that three migrations ran: `20261126000000_prompt_activated_at.sql`,
   `20261127000000_safety_alarm_days.sql` and `20261129000000_research_conditions.sql`** (#317,
   #117, #114). Their state is not recorded anywhere. Each query below only reads the catalog; run
   it in the SQL editor (Supabase dashboard → the project → **SQL Editor** → **New query**). Every
   column must be `true`. A `false` means that migration did not run (fully): see "Confirm that a
   migration ran", below, before running it.
   - `20261126000000_prompt_activated_at.sql` (#317, a trigger on `public.prompts`):

     ```sql
     select
       exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'private' and p.proname = 'fill_prompt_activated_at') as fn,
       exists (select 1 from pg_trigger
               where tgrelid = 'public.prompts'::regclass
                 and tgname = 'prompts_fill_activated_at') as trg;
     ```

   - `20261127000000_safety_alarm_days.sql` (#117, the table `private.safety_alarm_days`):

     ```sql
     select
       to_regclass('private.safety_alarm_days') is not null as tbl,
       exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public'
                 and p.proname = 'record_safety_classifier_failure') as fn;
     ```

   - `20261129000000_research_conditions.sql` (#114, `docs/deploy.md`, the research flag):

     ```sql
     select
       to_regclass('public.research_conditions') is not null as tbl,
       exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'research_condition') as fn,
       exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'sessions'
                 and column_name = 'story_off_at') as col,
       exists (select 1 from pg_trigger
               where tgrelid = 'public.sessions'::regclass
                 and tgname = 'sessions_keep_story_off_at') as trg;
     ```

### Later, by owner decision

- **[prod] Fix the published story cards that fail the checks** (#377, #46): Later, by owner
  decision (2026-11-25). The cards stay published as they are. The steps stay in
  `docs/deploy.md`, Story cards, "Fixing the published cards that fail the checks (#377)", for
  when the owner moves #377 back.

### Done

Done by the owner in prod, reported on 2026-11-25 (#449), with the owner's check results.

- 2026-11-25: applied `supabase/migrations/20261128000000_hotlines.sql` (#118). Check:
  `select count(*) from public.hotlines;` returned 1, the US entry (988).
- 2026-11-25: prompt import (`node scripts/prompts/import.mjs`, pasted into the SQL editor) for
  `pause_predicament`, `plan_split`, `rest_reply`, `retry_hints`, `safety_classifier` and
  `stuck_story`. This publishes `plan_split` version 2 (PLAN-PROMPT, issue #40), the step that was
  open here. `return_popup`, `step_cards` and `closing_line` were left untouched. No check result
  was reported.
- 2026-11-25: applied `supabase/migrations/20261130000000_ai_features.sql` (#436, `docs/deploy.md`,
  AI feature pages, step 1). No check result was reported.
- 2026-11-25: ran the `ai_features` seed (`docs/deploy.md`, AI feature pages, step 2). Check: 7
  rows.
- Before 2026-11-25 (date not recorded): set `MODEL_CALL_LIMIT_ENABLED` to `0` in Vercel, scope
  Production (TEST-NO-CAP, #256). Before public release, set it back to `1` or remove it.

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

Every migration up to now was pasted by hand into the SQL editor, so the CLI's history table
(`supabase_migrations.schema_migrations`) does not know they ran, and a first `supabase db push`
would try to run them again and fail with "already exists". Marking a migration as applied that
never ran is worse: `db push` then skips it for ever, without a word. So confirm each one with
SQL first. Do this once per project, in the repository on an up-to-date `main`:

1. Link to the project and check the link (see "Before every push", below).
2. `supabase migration list`: the left column is the repository, the right column what the CLI
   thinks ran.
3. For each migration in the left column that has no right column, confirm in the SQL editor that
   it ran: open the file, note every object it creates or changes (tables, functions, triggers,
   policies, check constraints), and find each one with the queries in "Confirm that a migration
   ran", below. A tables-only check such as `npm run check:deploy` is not enough: many migrations
   only add a function, a trigger or a policy.
4. Mark only the confirmed versions as applied, for example
   `supabase migration repair --status applied 20261106000000 20261106120000` (every confirmed
   version, separated by spaces). A migration with any object missing did not run fully: do not
   mark it; leave it for `supabase db push`, or ask before running it if it is not safe to run
   twice.
5. Check that the history now lists them:

   ```sql
   select version, name from supabase_migrations.schema_migrations order by version;
   ```

   and `supabase migration list` shows each confirmed migration in both columns.

### Confirm that a migration ran

Run these in the SQL editor (Supabase dashboard → the project → **SQL Editor** → **New query**).
They only read the catalog. Look for each object the migration file creates.

```sql
-- Tables
select schemaname, tablename, rowsecurity from pg_tables
where schemaname in ('public', 'private') order by 1, 2;

-- Functions
select n.nspname as schema, p.proname as name, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private') order by 1, 2;

-- Triggers
select tgrelid::regclass as on_table, tgname as name from pg_trigger
where not tgisinternal order by 1, 2;

-- Policies
select schemaname, tablename, policyname, cmd from pg_policies
where schemaname in ('public', 'private') order by 1, 2, 3;

-- Check constraints (a migration that widens a list of allowed values changes one of these)
select conrelid::regclass as on_table, conname, pg_get_constraintdef(oid) as definition
from pg_constraint where contype = 'c' and connamespace in ('public'::regnamespace, 'private'::regnamespace)
order by 1, 2;

-- What the CLI has recorded (empty or missing until the first repair or push)
select version, name from supabase_migrations.schema_migrations order by version;
```

For a function that a later migration replaced, compare its body with the newest file that
defines it. Name it with its argument types (the `args` column of the Functions query), so an
overloaded name is not ambiguous: `select pg_get_functiondef('public.<name>(<arg types>)'::regprocedure);`,
for example `select pg_get_functiondef('public.get_active_prompts(text)'::regprocedure);`.

### Before every push: link, then check the link

The link is stored in `supabase/.temp/` and stays until you change it, so a "dev" push after a
forgotten prod link goes to prod. Never rely on the last link: run `supabase link` right before
each push, then check which project is linked.

```sh
supabase link --project-ref <ref>     # the project you mean to change, every time
cat supabase/.temp/project-ref        # prints the linked project ref; it must be <ref>
supabase projects list                # the linked project is marked in the LINKED column
```

### Dev: apply every unapplied migration

```sh
supabase link --project-ref <dev ref>
cat supabase/.temp/project-ref   # must print <dev ref>
supabase db push --dry-run       # lists what would run, changes nothing
supabase db push
```

Then run `npm run check:deploy` against a Preview deployment (below).

### Prod: the product owner only

Agents never run `supabase link`, `supabase db push`, `supabase db reset` or
`supabase migration repair`, for dev or prod, not even with `--dry-run`. The owner adds this
pattern to `deploy_patterns` in `.claude/guardrails.json`, so the agent hook asks a human before
any of them (also the `npx supabase` and `supabase@<version>` forms, and with global flags
such as `--debug` or `--workdir .` before the subcommand):

<!-- hook-pattern -->
`\bsupabase(@\S+)?(\s+--?\S+(\s+(?!-)[^\s-]\S*)?)*\s+(link|db\s+(push|reset)|migration\s+(repair|up))\b`

In the JSON file each backslash is written twice.

```sh
supabase link --project-ref <prod ref>
cat supabase/.temp/project-ref   # must print <prod ref>
supabase db push --dry-run
supabase db push
```

Then run `npm run check:deploy` against production. The next push, to any project, starts with
its own `supabase link` again.

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
  turns it on (read with one select through the Supabase Management API). It does not see
  functions, triggers or policies: to confirm a migration, use "Confirm that a migration ran".

On a Preview, Vercel Deployment Protection answers before the app. The check then says the
deployment is protected (not a security failure). To check a Preview, the owner makes a bypass
secret once: Vercel → the project → **Settings** → **Deployment Protection** → **Protection Bypass
for Automation** → **Add Secret** (or copy the existing one). Pass it inline as
`VERCEL_AUTOMATION_BYPASS_SECRET`; the check sends it as the `x-vercel-protection-bypass` header
and never prints it. It sends it only to this project's own Vercel addresses over `https`:
`waveparticle-mobile.vercel.app` and the Preview form `waveparticle-mobile-<…>.vercel.app`, never
another `.vercel.app` host (that would be someone else's). Copy the Preview address from Vercel
rather than typing it. For your own domain on Vercel, also pass `VERCEL_BYPASS_HOSTS=<host>`
(comma-separated). For any other address
the check refuses, says why, and does not send the secret.

```sh
E2E_BASE_URL=https://waveparticle-mobile.vercel.app \
SUPABASE_PROJECT_REF=<prod ref> SUPABASE_ACCESS_TOKEN=<your token> npm run check:deploy
```

Type the token and the bypass secret on the command line as above, for that one command. Do not
`export` them in a shell where you also start an AI agent: the agent would inherit them, and the
Supabase CLI reads `SUPABASE_ACCESS_TOKEN` too. Never put them in a file in the repository. Give
the personal access token a short expiry when you make it: it works for every project of your
account. Without `SUPABASE_PROJECT_REF` and `SUPABASE_ACCESS_TOKEN` the command fails, so a
skipped database check never looks like a pass; add `-- --skip-db` to check the website alone
(`npm run check:deploy -- --skip-db`). Agents run it only against a local server, never against
production or a live database.

## Make a CI check required

The `pr-human-steps` and `pr-closes-issue` jobs block a merge only when they are required:
GitHub → the repository → **Settings** → **Branches** → the rule for `main` (**Edit**, or **Add
branch protection rule** with pattern `main`) → **Require status checks to pass before merging**
→ search and add `pr-human-steps` (and `pr-closes-issue`, `check`) → tick **Require branches to
be up to date before merging** (otherwise the "later than the newest migration on `main`" check
can be out of date when another pull request with a migration merged first) → **Save changes**. If the
repository uses rulesets instead: **Settings** → **Rules** → **Rulesets** → the rule for `main` →
**Require status checks to pass** → **Add checks**.

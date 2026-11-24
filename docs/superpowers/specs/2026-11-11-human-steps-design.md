# Design: make every human-only step visible (#189)

Date: 2026-11-11 · Issue: #189 · Branch: `chore/189-human-steps`

## Why

After #177 the live site returned HTTP 500 because two Vercel variables were
missing. The migrations from #124 and #7 had to be pasted by hand into the
Supabase SQL editor. Nobody was told in a place a human would look. The product
owner wants every manual step announced in the pull request, tracked in one
document, and a check that catches a broken deploy in plain words.

## Goals

1. Every pull request states its human steps, or says "None". CI enforces it.
2. A new migration can never ship silently: the pull request must name it, and
   migration file names stay unique and ordered.
3. Applying migrations is one documented command per environment (dev, prod).
4. A new environment variable is named in `.env.example`, `docs/deploy.md` and
   the pull request, with its Vercel scopes and whether it may be public.
5. `npm run check:deploy` tells a human, in one sentence per failure, whether a
   deployment is healthy.
6. `docs/HUMAN_STEPS.md` is the single list of recurring manual tasks.

## Non-goals and anti-goals

- No automatic migration of prod from CI (out of scope in the issue). Prod stays
  a human decision. Agents never run the prod command.
- No new npm dependency. The Supabase CLI is a tool the human installs, not a
  package in `package.json`.
- The checks must never print a secret, a key or a response body.
- A check that cries wolf is a failure: the PR check must accept a correct body
  on the first try, and its error must say exactly what to add.

## Constraints

- Allowed files (issue): `AGENTS.md`, `.github/pull_request_template.md`,
  `.github/workflows/ci.yml`, `docs/`, `scripts/`, `package.json`,
  `supabase/config.toml`. Plus tests in `tests/` (repo rule: a test per
  criterion) and `.env.example` (named in criterion 4).
- The guardrail hook forbids agents from editing `AGENTS.md`. The agent writes
  the exact text in the pull request; a human pastes it in (see "Human steps"
  of the PR itself).
- Scripts follow the existing pattern (`scripts/provider-check.mjs`): pure
  functions in an `.mjs` module tested with Vitest, plus a thin CLI file.

## Design

### A. "Human steps" section and CI check (criteria 1, 2, 4)

- Template gets a section `## Human steps` with an HTML comment explaining the
  format, placed right after "What changed". Each step is one numbered line:
  `1. [dev] What to do. Where.` (environment tag is `[dev]`, `[prod]` or
  `[dev, prod]`). Or the single word `None`.
- New module `scripts/pr-checks.mjs` exports pure functions:
  - `humanStepsSection(body)` → the text under `## Human steps` up to the next
    `## ` heading, with HTML comments removed and trimmed; `null` if missing.
  - `checkPullRequest({ body, addedFiles, envNamesBefore, envNamesAfter })` →
    list of plain-sentence errors:
    - section missing, or empty after removing comments;
    - section is neither `None` nor at least one numbered step;
    - a numbered step without an environment tag `[dev]`/`[prod]`;
    - for each added `supabase/migrations/*.sql`: the file name is not in the
      section, or the section does not contain "Apply to dev, then prod";
    - for each variable name in `.env.example` after the change that was not
      there before: the name is not in the section.
    - "None" while a migration or a new variable was added is an error.
- New CLI `scripts/check-pr.mjs`, run by a new CI job `pr-human-steps`
  (same trigger and Dependabot exemption as `pr-closes-issue`). It reads the
  body from `BODY`, gets added files with
  `git diff --name-only --diff-filter=A origin/<base>...HEAD`, and reads
  `.env.example` at the base and at HEAD with `git show`. Checkout uses
  `fetch-depth: 0`.

### B. Migration file names (criterion 2)

- `checkMigrationNames(names)` in `scripts/pr-checks.mjs`: every file matches
  `^\d{14}_[a-z0-9_]+\.sql$`, timestamps are unique, and the timestamp is a
  real date-time. Sorted by name equals sorted by timestamp (true by the
  pattern).
- `checkNewMigrationsAreLatest(existing, added)`: every added file has a
  timestamp later than every file already on the base branch.
- A Vitest test runs `checkMigrationNames` on the real folder, so `npm test`
  (already in CI) fails on a bad name. The "later than base" rule runs in the
  `pr-human-steps` job because it needs the base branch.

### C. Applying migrations (criterion 3)

- `supabase/config.toml` (minimal, `project_id = "waveparticle-mobile"`) so the
  CLI recognises the folder.
- `docs/HUMAN_STEPS.md` documents, for a human with Supabase access:
  - install once: `brew install supabase/tap/supabase`;
  - log in once: `supabase login` (opens the browser; the CLI keeps the token
    in the operating system keychain, never in the repository);
  - first time per project only: mark the two hand-applied migrations as
    applied with `supabase migration repair --status applied 20261106000000
    20261106120000` (from the issue comment);
  - dev: `supabase link --project-ref <dev ref>` then `supabase db push`;
  - prod: `supabase link --project-ref <prod ref>` then `supabase db push`,
    only by the product owner, and agents never run it.
- npm scripts `db:push:dev` and `db:push:prod` are **not** added: the project
  refs are not secret but are not in the repo either, and an npm script makes
  the prod command too easy for an agent to run. The guardrail
  `deploy_patterns` is not changed (rule file); the PR asks the human to add
  `supabase\s+db\s+push` to it.

### D. Environment variables (criterion 4)

- `docs/deploy.md` gets a table "Environment variables": name, Vercel scopes
  (Production, Preview), public (`NEXT_PUBLIC_` allowed: yes/no), purpose.
  Filled from the current `.env.example` names.
- `.env.example` gets a header comment stating the rule.
- A Vitest test checks that every name in `.env.example` appears in
  `docs/deploy.md`'s table, and that names starting with `NEXT_PUBLIC_` are
  marked public. The PR check (A) covers the pull request part.

### E. `npm run check:deploy` (criterion 5)

- Module `scripts/deploy-check.mjs` with pure, injected-fetch functions, CLI
  `scripts/check-deploy.mjs`, script
  `"check:deploy": "node scripts/check-deploy.mjs"` reading `E2E_BASE_URL`.
- Checks, each giving one plain sentence on failure:
  1. `GET /` (no redirect following): status 5xx → "The site returned 500 on
     the home page. Check the Vercel logs and environment variables."
  2. Same response: signed-out home must be a 3xx whose `Location` ends with
     `/auth/sign-in`.
  3. Database: expected tables and their row-level security, read from the
     migration files (`create table public.X` and
     `alter table public.X enable row level security`). Compared with the live
     database through the Supabase Management API SQL endpoint
     (`POST https://api.supabase.com/v1/projects/<ref>/database/query`) with a
     query over `pg_class` (`relname`, `relrowsecurity`) in schema `public`.
     Needs `SUPABASE_PROJECT_REF` and `SUPABASE_ACCESS_TOKEN` (personal token
     of the human who runs it, kept in their shell or local `.env`, never in
     the repo or CI). If either is missing, the database check is reported as
     "skipped" with the reason, and the command fails, because a skipped
     check must not look like a pass. **Product owner's decision:** a
    `--skip-db` flag lets someone without a token run the website checks
    alone; it prints `SKIPPED: database (--skip-db)` and may pass.
- Output: one line per check, `OK:` or `FAIL:`, never values. Exit 1 on any
  failure.

### F. `docs/HUMAN_STEPS.md` and AGENTS.md (criterion 6)

- One section per recurring task with the exact click path: apply migrations,
  add or change environment variables (Vercel → Project → Settings →
  Environment Variables), add redirect URLs (Supabase → Authentication → URL
  Configuration), rotate keys, merge a pull request, redeploy (Vercel →
  Deployments → … → Redeploy), run the post-deploy check.
- Proposed `AGENTS.md` lines (human pastes them):
  "Manual steps are in `docs/HUMAN_STEPS.md`. Link to it in the PR's Human
  steps section. If a step is not listed there, do not guess it: ask a human."
- A Vitest test checks `docs/HUMAN_STEPS.md` names each recurring task.
- The AGENTS.md change is the first item in this PR's own "Human steps": the
  human pastes the text on this branch before merging and may add the matching
  test (`AGENTS.md` contains `docs/HUMAN_STEPS.md`) in the same commit. No
  deliberately red test is committed, because CI and the hook require green
  tests before the PR opens.

## Tests (one per criterion, written first)

| Criterion | Test file |
|---|---|
| 1 Human steps section + CI | `tests/pr-checks.test.ts`, `tests/ci-config.test.ts` (job exists), template test |
| 2 Migrations listed, names unique and ordered | `tests/pr-checks.test.ts`, `tests/migrations.test.ts` |
| 3 Documented push commands | `tests/human-steps-docs.test.ts` |
| 4 Env var named in three places | `tests/pr-checks.test.ts`, `tests/deploy-docs.test.ts` |
| 5 check:deploy | `tests/deploy-check.test.ts` (fake fetch) |
| 6 HUMAN_STEPS.md + AGENTS.md | `tests/human-steps-docs.test.ts` |

## Calls made by the agent (please check)

- Database check uses the Supabase Management API with a personal token, not
  the public key, because the public key cannot see whether row-level
  security is on.
- No `db:push:*` npm scripts; commands live in the docs only.
- AGENTS.md is changed by the human (hook rule), tracked as a PR human step.
- Supabase CLI installed with Homebrew, not as an npm dependency.

## Settled after the builder check

- Signed-out home: the live site returns `307` with `Location: /auth/sign-in`
  (checked 2026-11-11). The check accepts 302, 303, 307 or 308 with that
  location; a 200 is a failure.
- The `pr-human-steps` job only blocks merges once it is a required status
  check. Making it required in GitHub (Settings → Branches → main → Required
  status checks) is a human step in this PR.
- Two open PRs that both add a migration: after one merges, the other's
  "later than base" check fails on its next push or rebase. `HUMAN_STEPS.md`
  says to rename the file with a new timestamp in that case. The name-format
  and uniqueness test also runs on every push to `main` through `npm test`.
- Migration order in the docs: run `check:deploy` (or look in the Table
  editor) first, then `migration repair`, then `db push`, so repair never
  hides a missing table.
- The database check compares tables and row-level security, as the criterion
  says. Comparing columns or migration versions is left for later.
- The AGENTS.md paste is a required human step; the PR checklist marks
  criterion 6 as not done until it is pasted.
- Agents are blocked from reading `.env.example`, so the variable table in
  `docs/deploy.md` is filled from the names, scopes and public flags the
  product owner supplies (product owner's decision).
- Both hand-run migrations are applied to dev and prod (product owner). The
  docs therefore say: run `supabase migration repair --status applied
  20261106000000 20261106120000` once per project, then `supabase db push`
  for every later migration.

## Left to the builder

Exact wording of messages, file layout inside the scripts, regex details.

## As built (2026-11-24)

What the pull request for #189 does differently from the design above, and why:

- **Step tags.** A step starts with `[dev]`, `[prod]`, `[dev, prod]` or `[repo]`. `[repo]` is
  new: some steps belong to GitHub or the repository (paste a rule text, make a check required)
  and have no environment.
- **Variables from code.** Besides names added to `.env.example`, the check also finds names that
  the changed lines of `src/` read as `process.env.NAME`, `env.NAME` or `env["NAME"]` and that the
  base branch never read. Such a name must be in `.env.example`, in the table in `docs/deploy.md`
  and in a human step that says Production or Preview. A name read through a constant
  (`env[SOME_NAME]`, the pattern most of `src/` uses) is not seen; the template rule covers it.
- **No test comparing `.env.example` with `docs/deploy.md`.** Agents may not read `.env.example`,
  so the table in `docs/deploy.md` was filled from the names the code and the docs use, and the
  scopes are inferred from the existing sections: the owner should check the table.
- **Post-deploy check.** Also fails when the sign-in page answers 5xx. Checks tables in the
  `public` and `private` schemas (row-level security only where a migration turns it on). The
  Management API address can be replaced (`SUPABASE_API_URL`) only by an address on this machine,
  for tests, so the token is never sent anywhere else.
- **AGENTS.md** is still changed by a human: the hook blocks agents. The pull request holds the
  text to paste, as its first human step.
- **`supabase/.temp/`** (written by `supabase link`) is not in `.gitignore`, which is outside the
  allowed files; `docs/HUMAN_STEPS.md` says not to commit it. Follow-up for a human.

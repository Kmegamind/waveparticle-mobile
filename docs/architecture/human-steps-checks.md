# Human steps checks

`npm run check:pr` (the CI job `pr-human-steps`) and `npm run check:deploy` (#189): the pull request must list its human steps, and a deployment is checked for 5xx, the signed-out redirect and the tables and row-level security of the migrations.

Path: `scripts/pr-checks.mjs` and `scripts/check-pr.mjs` (pull request body, migration file names, new environment variables), `scripts/deploy-check.mjs` and `scripts/check-deploy.mjs` (post-deploy check, Supabase Management API read). Both print plain sentences and never a value of a setting. The steps themselves: `docs/HUMAN_STEPS.md`.

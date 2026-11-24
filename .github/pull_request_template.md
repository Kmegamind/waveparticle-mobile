Closes #

## What changed

## Human steps
<!--
What a human must do after this pull request, in order, or the single word None. CI fails the
pull request if this section is missing or empty (the pr-human-steps job). Exact click paths are
in docs/HUMAN_STEPS.md: link to them and never guess a manual step.
One numbered line per step: where it applies ([dev], [prod], [dev, prod], or [repo] for GitHub or
this repository), what to do, and where. For example:
1. [dev, prod] Apply to dev, then prod: 20261201000000_my_change.sql (docs/HUMAN_STEPS.md, Apply migrations).
2. [prod] Add MY_SETTING in Vercel, scopes Production and Preview, server only (no NEXT_PUBLIC_ prefix), then redeploy.
A new file in supabase/migrations/ needs a step with its file name and "Apply to dev, then prod".
A new or changed environment variable is named here (with its Vercel scopes, Production and/or
Preview, and whether it may carry the NEXT_PUBLIC_ prefix), in .env.example and in the
"Environment variables" table of docs/deploy.md.
-->

## How to test
- [ ] `npm test` and `npm run test:e2e` pass locally
- [ ] `npm run lint` passes
- [ ] Each acceptance criterion checked (test name or manual step)

## AI usage
- Tool and mode used:
- What I reviewed or changed by hand:

## UI (skip if no UI changed)
- [ ] Follows `DESIGN.md`: tokens only (no hard-coded colours, fonts or spacing), control styles from section 6, contrast and 44 px targets kept
- [ ] If code and `DESIGN.md` disagree, `DESIGN.md` was followed or the difference is explained here

## Docs
- [ ] One file under `docs/api/` added or updated for each interface change (then run `node scripts/docs-index.mjs`)
- [ ] New file in `docs/decisions/` for any hard-to-reverse choice
- [ ] `AGENTS.md` / `docs/memory/` updated if conventions, versions or pitfalls changed

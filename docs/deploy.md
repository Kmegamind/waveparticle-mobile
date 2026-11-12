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
`PROTOTYPE_ENABLED=1` turns on the sign-in-free test path `/try` (`docs/decisions/0011`). Set it in
Vercel for **Preview only** (Project → Settings → Environment Variables, scope Preview), never for
Production. It is server-only: never give it the `NEXT_PUBLIC_` prefix. Keep Vercel Deployment
Protection on for previews, because the test path can call the paid model.

## Secrets
Real values live in the platform's environment settings or CI secrets. `.env.example` lists the names.

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

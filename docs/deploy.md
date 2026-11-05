# Deploy

Status: Vercel setup and deployment require a human with repository and Vercel
access. Agents do not run Vercel commands or deploy.

## Build runtime

Node 24 remains the required build runtime. Node 26 builds on Vercel are not
verified; keep the repository's Node constraint (`>=24.0.0 <25`) until Vercel
support is confirmed.

| Environment | Where | Trigger |
|---|---|---|
| Preview | Vercel preview deployment | Each pull request |
| Staging | Vercel project staging environment | Human-approved preview or staging workflow |
| Production | Vercel production environment over HTTPS | Push to `main` after review |

## Human setup checklist

1. Link the GitHub repository to the Vercel project.
2. Configure preview deployments for pull requests and production deployment
   from `main`.
3. Add environment variables in Vercel's project environment settings or CI
   secrets. Never commit `.env` or copy secret values into this repository.
4. After the first production deployment, replace the pending URL in
   `README.md` with the HTTPS URL.

## Secrets
Real values live in the platform's environment settings or CI secrets. `.env.example` lists the names.

## After each deploy
- Smoke test: open the deployed home page and confirm the product name is
  visible.
- Logs / monitoring: inspect the Vercel deployment logs and runtime errors for
  the deployment.
- Rollback: use Vercel's deployment history to promote the last known-good
  deployment; do not rewrite `main`.

Agents never deploy on their own; the hook asks a human for any command in
`deploy_patterns` (`.claude/guardrails.json`).

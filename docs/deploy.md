# Deploy
Status: not deployed yet; Vercel is the chosen target (see docs/decisions/0002).

| Environment | Where | Trigger |
|---|---|---|
| Staging | TODO(human) | TODO |
| Production | TODO(human) | TODO |

## Secrets
Real values live in the platform's environment settings or CI secrets. `.env.example` lists the names.

## After each deploy
- Smoke test: TODO (the one user journey that must work).
- Logs / monitoring: TODO.
- Rollback: TODO (how to return to the previous version).

Agents never deploy on their own; the hook asks a human for any command in `deploy_patterns` (`.claude/guardrails.json`).

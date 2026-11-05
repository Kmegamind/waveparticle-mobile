# Known issues
Pitfalls that aren't bugs to fix right now, so nobody (human or agent) rediscovers them. Bugs to fix become issues; link them here.

| Date | Issue | Impact | Workaround / link |
|---|---|---|---|
| 2026-11-05 | `npm audit` reports 8 moderate findings, all through `minimatch` inside the lint tools (`eslint`, `typescript-eslint`) | Development tooling only; nothing ships to users | Re-check when `eslint` or `eslint-config-next` publish a fixed `minimatch`; do not run `npm audit fix --force` (it downgrades `eslint`) |
| 2026-11-05 | TypeScript 7 is released, but `typescript-eslint` 8.72.1 supports TypeScript below 6.1.0 | Linting breaks on TypeScript 7 | TypeScript is pinned to 6.0.3 (`docs/decisions/0004`) |
| 2026-11-05 | `next.config.ts` from the official template enables `cacheComponents` and `partialPrefetching` and loads Tailwind through `@tailwindcss/turbopack` | Data fetching and caching behave differently from older Next.js | Keep while the app is small; revisit in the first data issue |

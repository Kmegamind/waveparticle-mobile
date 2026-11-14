# Known issues
Pitfalls that aren't bugs to fix right now, so nobody (human or agent) rediscovers them. Bugs to fix become issues; link them here.

| Date | Issue | Impact | Workaround / link |
|---|---|---|---|
| 2026-11-05 | `npm audit` reports 8 moderate findings, all through `minimatch` inside the lint tools (`eslint`, `typescript-eslint`) | Development tooling only; nothing ships to users | Re-check when `eslint` or `eslint-config-next` publish a fixed `minimatch`; do not run `npm audit fix --force` (it downgrades `eslint`) |
| 2026-11-05 | TypeScript 7 is released, but `typescript-eslint` 8.72.1 supports TypeScript below 6.1.0 | Linting breaks on TypeScript 7 | TypeScript is pinned to 6.0.3 (`docs/decisions/0004`) |
| 2026-11-05 | `next.config.ts` from the official template enables `cacheComponents` and `partialPrefetching` and loads Tailwind through `@tailwindcss/turbopack` | Data fetching and caching behave differently from older Next.js | Keep while the app is small; revisit in the first data issue |
| 2026-11-13 | The e2e run has no Supabase project, so nobody can sign in there (#257) | The signed-in `/focus` and `/rest` are e2e-tested only for the sign-in redirect; the account writes are unit-tested (`tests/signed-in-focus.test.ts`) and the shared screens are e2e-tested on `/try` | Check the signed-in flow by hand on a Preview with `PROTOTYPE_ENABLED=1` before relying on it |
| 2026-11-13 | On another device, or after clearing site data, the current Step on `/focus` starts from its full time and continues only with the cards it already showed (#257) | Expected under `docs/decisions/0014` option A | Revisit with option B (clock state on the account) if people switch devices mid-Step |

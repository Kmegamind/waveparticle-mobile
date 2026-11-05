# Technology stack: versions checked on 2026-11-05

Rule from Yue: use the latest stable, working versions. This file records what was checked, what is pinned, and what must be verified before the first release. Versions below were read from the npm registry and the Node.js release index on 2026-11-05. They must be re-checked when the repository is scaffolded, because they change weekly.

Stack already chosen (2026-11-04): a mobile-first web app (progressive web app) with Next.js and TypeScript; Supabase for sign-in and the Postgres database; deployment on Vercel. Yue rejected Expo and SwiftUI.

## 1. Versions

| Piece | Latest stable found | Published | Recommendation |
|---|---|---|---|
| Node.js | 26.13.0 is the current long-term-support line ("Lithium"); 24.22.2 is the previous long-term-support line ("Krypton", installed on this Mac) | 2026-10-28; 2026-10-27 | Develop on Node 26 if Vercel supports it for builds (verify); otherwise Node 24. Do not use Node 25 or 27 (not long-term support) |
| Next.js | 16.4.5 | 2026-11-03 | Use 16.4.5, App Router. Requires Node 20.9 or newer |
| React and React DOM | 19.3.1 | 2026-10-14 | Use 19.3.1 |
| TypeScript | 7.0.2 is the latest, but **do not use it yet**; 6.0.3 is the latest 6.x | 2026-07-08 (7.0.2) | Pin **6.0.3**. Reason in section 2 |
| Tailwind CSS | 4.3.4 | 2026-11-02 | Use 4.3.4 for the theme and design tokens |
| Supabase client | `@supabase/supabase-js` 2.119.0; `@supabase/ssr` 0.12.7 | 2026-11-04; 2026-09-08 | Use both. `@supabase/ssr` is the package for sign-in in Next.js on the server. The ssr package is still below 1.0, so pin exactly |
| Progressive web app tooling | Serwist (`@serwist/next`) 9.5.13 | 2026-10-04 | Use Serwist for the service worker and install support |
| Validation | Zod 4.6.7 | 2026-10-12 | Use for API input and for checking AI output (JSON) |
| Unit tests | Vitest 5.1.0 | 2026-11-02 | Use |
| End-to-end tests | Playwright 1.64.1 | 2026-10-14 | Use, including mobile viewports |
| Lint | ESLint 10.14.0 with `typescript-eslint` 8.72.1 and `eslint-config-next` 16.4.5 | 2026-10-30; 2026-10-26 | Use |
| Model provider SDKs | `openai` 7.51.0; `@anthropic-ai/sdk` 1.5.0 | 2026-11-05; 2026-11-04 | Not decided: which provider the live generation uses (see section 4) |

## 2. The one conflict found: TypeScript 7

TypeScript 7.0.2 is published as the latest version, but the lint tooling does not support it yet: `typescript-eslint` 8.72.1 declares that it works with TypeScript greater than or equal to 4.8.4 and below 6.1.0. Using TypeScript 7 would break linting. The decision is to pin TypeScript 6.0.3 and to re-check when `typescript-eslint` declares support for 7. Also verify that Next.js 16.4.5 type-checks cleanly on the chosen version before the repository is scaffolded.

## 3. Rules for keeping versions current

1. Pin exact versions in `package.json` for the packages that are below 1.0 or that are major-version sensitive (TypeScript, `@supabase/ssr`, Next.js, React); other packages may use a caret range.
2. Commit the lock file and set the Node version in `.nvmrc` and in the `engines` field.
3. Turn on automatic update pull requests (Dependabot or Renovate) with weekly grouping; Yue reviews them like any other pull request.
4. Re-run the check in this file before each sprint planning.

## 4. Items to verify before the first release (not yet verified)

| Item | Why it matters |
|---|---|
| Whether Vercel builds on Node 26 | Decides the Node line |
| Vibration, lock-screen notifications and background timers on iPhone and Android for a web app installed to the home screen | Decision S2: the 00:00 light vibration and any later notification depend on it |
| The clock must come from timestamps, not from page timers | Browsers pause timers in the background |
| Which model provider and model the live generation uses, and its data-retention terms | Decision A7b; cost, speed and the privacy notice depend on it |
| Latency and cost of the live generation (cards, stuck story, return pop-up, chat) | The step cards must arrive on time without waiting for the model; needs a spike |
| Supabase row-level security for goals, steps, sessions and pauses | Task text is stored on our server (decision S3) |
| Crisis hotlines by region and the safety classifier | Decision A5 |

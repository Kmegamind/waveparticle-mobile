# 0007: Use two Supabase client packages and keep the service-role key out of the app code
- Status: accepted
- Date: 2026-11-05
- Issue: #123

## Context
The app stores goals, steps and sessions per account and needs sign-in (decisions S3 and ACC). Supabase offers `@supabase/supabase-js` and, for Next.js, `@supabase/ssr`, which keeps the session in cookies so that server code can read it.

## Options
| Option | For | Against |
|---|---|---|
| `@supabase/supabase-js` and `@supabase/ssr`, exact versions | The documented way for Next.js; the same session in the browser and on the server | `@supabase/ssr` is below version 1.0, so updates need care |
| `@supabase/supabase-js` alone with local storage | One package | The server cannot see the session; row-level security checks are harder |

## Decision
Install `@supabase/supabase-js` 2.119.0 and `@supabase/ssr` 0.12.7 with exact versions. Browser code uses `createSupabaseBrowserClient` (public key only). Server code uses `createSupabaseServerClient`, which reads the request's cookies. No code in `src/` may mention a service-role key; a test fails if one does. If a privileged server job is needed later, it gets its own decision record.

## Consequences
- The cookie adapter is a parameter of `createSupabaseClient`, so tests use a fake one and need no real project.
- Refreshing the session on each request (the proxy in Next.js 16) is added by the sign-in issues, not here.
- `npm run check:supabase` tells a developer whether the project in `.env` answers, without printing any value.

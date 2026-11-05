# 0002: Use Next.js, Supabase and Vercel for the mobile web app
- Status: accepted
- Date: 2026-11-05
- Issue: #1

## Context
The product is a mobile-first app that must install to the home screen, call language models from a server, and store goals, steps and sessions per account. Yue chose a web app on 2026-11-04.

## Options
| Option | For | Against |
|---|---|---|
| Next.js PWA, Supabase, Vercel | One language, server routes for model calls, managed sign-in and database, simple deploys | iPhone web apps limit vibration and notifications (to verify) |
| Expo (React Native) | Native feel | Rejected by Yue |
| SwiftUI | Native iPhone | Rejected by Yue |

## Decision
Build a Next.js App Router application with TypeScript, store data in Supabase Postgres with row-level security, and deploy to Vercel. Supabase and the service worker are added by their own issues.

## Consequences
Server-side model calls keep keys off the device. Phone features must be verified (`docs/TECH_STACK.md` section 4).

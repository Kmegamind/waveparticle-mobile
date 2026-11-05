# 0003: Use Node.js 24 long-term support, not 26
- Status: accepted
- Date: 2026-11-05
- Issue: #1

## Context
Node 26 is also a long-term-support line (released 2026-10-28), but the machine and the lockfile were produced on Node 24.22.2, and Vercel build support for Node 26 is not verified.

## Options
| Option | For | Against |
|---|---|---|
| Node 24 | Installed, mature, supported by every pinned package | Not the newest line |
| Node 26 | Newest | Unverified on Vercel; one month as long-term support |

## Decision
Pin Node 24 in `.nvmrc` and in `engines` (>=24.0.0 <25).

## Consequences
Revisit when Vercel confirms Node 26 builds; the move is a one-line change plus a CI run.

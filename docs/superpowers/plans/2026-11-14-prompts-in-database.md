# Prompts in the database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every gateway prompt and its numeric check parameters come from `public.prompts` through `getActivePrompt(key)`, with seed files, import and export scripts, and identical behaviour.

**Architecture:** A pure template renderer and prompt-file format; a cached repository over a token-checked security-definer function; the gateway takes a prompt source and fails explicitly when a prompt is missing.

**Tech Stack:** Next.js 16 server actions, supabase-js 2.119 (`rpc`), Postgres (pgcrypto `digest`), Vitest, Playwright with the e2e Supabase stub.

**Spec:** `docs/superpowers/specs/2026-11-14-prompts-in-database-design.md`

## Global Constraints
- No service-role key in application code. `PROMPTS_READ_TOKEN` is server-only.
- NO-BACKUP: never a stored line for the user, never a default prompt in code.
- Logs carry no user text.
- Behaviour with the seed loaded is identical: same prompt strings, same checks.
- Docs: new files under `docs/`, one link line in shared index files.

## Review Focus
1. User text containing `{{...}}` must reach the model literally, never be substituted — Task 2 test.
2. A read failure (network, wrong token) must not be cached as "missing" for the whole minute, or a blip blocks generation for 60 s — Task 3 test (failures are not cached).
3. Two active versions of one key must be impossible — Task 1 migration test checks the partial unique index.
4. The import must be safe to run twice (no duplicate versions, unchanged files insert nothing) — Task 5 test.
5. The browser bundle must not contain the token name or the repository — Task 3 test (client code scan, like the gateway test).

---

### Task 1: Golden prompts (failing first)
- [ ] Capture `tests/fixtures/gateway-prompts.json` from the current gateway: every prompt for ~15 inputs (plan split with and without finer split; step cards with and without background, story count, step number, must-use, step facts empty and filled; stuck story pause 1, 3, invalid; rest reply; return pop-up for rest and absence; closing line; one retry prompt per call).
- [ ] `tests/gateway-prompts-golden.test.ts` asserts the gateway built with the seed source produces exactly the fixture. Fails until Task 4.

### Task 2: Template and prompt files
- [ ] `src/lib/prompts/template.ts` `renderPrompt(body, values)`; tests: one-pass substitution, empty-line drop, user `{{x}}` stays literal.
- [ ] `scripts/prompts/prompt-files.mjs` parse and write `docs/ai/prompts/<key>.md`; seed files for the seven keys; round-trip test.

### Task 3: Migration and repository
- [ ] `supabase/migrations/20261115000000_prompts.sql`; static test: RLS on, no policies, one-active index, `security definer` with fixed `search_path`, execute granted to anon and authenticated only for the function, hash in `private`.
- [ ] `src/lib/prompts/repository.ts` `createPromptRepository({ fetchRows, ttlMs, now, log })` and `getActivePrompt(key)`; tests: cache 60 s, failures not cached, missing key returns null and logs `prompt_missing`, no token logs and returns null.

### Task 4: Gateway reads prompts
- [ ] `createModelGateway({ provider, prompts })`; checks take limits from params; failure reason `prompt` with no model call; golden test passes; existing tests get the seed source through `tests/support/seed-prompts.ts`.

### Task 5: Scripts, e2e stub, docs
- [ ] `scripts/prompts/import.mjs` (SQL to stdout, idempotent), `scripts/prompts/export.mjs` (rpc → files); tests on generated SQL.
- [ ] e2e stub answers `rpc/get_active_prompts`; `PROMPTS_READ_TOKEN` in the e2e env and `.env.example`.
- [ ] `docs/ai/prompts/README.md`, link lines in `docs/ai/AI_00_index.md`, `docs/api/README.md`, `docs/architecture.md`.
- [ ] Full verification.

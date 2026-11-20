# src/lib/prompts/repository.ts

`src/lib/prompts/repository.ts` (server only, #282): `getActivePrompt(key)` returns the active row `{ key, version, body, params }` of `public.prompts` or `null`; the model gateway reads every prompt through it. See `docs/ai/prompts/README.md`.

# Prompts (ADM-08)

Every gateway prompt and its check limits, read from `public.prompts` through `getActivePrompt` (#282, `docs/decisions/0015`). ADM-08 `/admin/prompts` (#308, `docs/decisions/0025`) lists the 7 prompts with their active version and settings; `/admin/prompts/<key>` shows the active text, settings and note, saves a new draft version (admin or writer; settings as JSON), shows a line diff against the active version and the problems of `promptRowProblems` (the gateway's own row check: an unknown `{{name}}`, a missing or unusable setting). Only the admin role publishes a version the gateway can use, through `activate_prompt`, with a `prompt` row in Publish history, where it can be rolled back

Path: `src/lib/prompts/`, `src/app/admin/prompts/`, `supabase/migrations/20261115000000_prompts.sql`, `supabase/migrations/20261125000000_prompt_editing.sql`, `docs/ai/prompts/`

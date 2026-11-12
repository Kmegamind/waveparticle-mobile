# 0010: Send model calls through one server gateway
- Status: accepted
- Date: 2026-11-05
- Issue: #132

## Context
Every live line (the plan split, step cards, the stuck story, the rest reply and the return pop-up) needs a timeout, one retry, the checks in `docs/ai/AI_06_check-and-fallback.md`, and an authored fallback. The provider and its data-retention terms are still open (decisions A7b and PROV). The benchmark script already calls DeepSeek and Gemini directly; that script is not the production path.

## Options
| Option | For | Against |
|---|---|---|
| One server module, provider chosen later by URL and model name | Features cannot call a model on their own. No provider is named in the app code | A Gemini-shaped URL will not match the chat-completions body, so those calls fall back until a provider is accepted |
| Hard-code DeepSeek in the app | Matches the demo and the benchmark | Chooses a provider before the retention review |

## Decision
App code calls `src/lib/model-gateway`. The server reads only `MODEL_API_KEY`, `MODEL_API_URL` and `MODEL_NAME`. When all three are set, the request is a chat-completions POST with the key in the `Authorization` header and `max_tokens` of 1024. When any name is missing, or the call times out, fails, or fails the check twice, the caller receives an authored line. The log stores the call name, `generated` or `authored`, rule ids, latency and attempt count. It does not store the key, the prompt, or what the person wrote.

## Consequences
- The three names are server-only. They are set in Vercel Production, Preview and Development. They never use a browser prefix.
- Prompts in this module only request the JSON shape. The real planning prompt is still open (P1).
- `DEEPSEEK_API_KEY` and `GEMINI_API_KEY` stay on the benchmark and the provider check. The gateway does not read them.
- 1024 output tokens is a starting budget so a reasoning model can still return text. It is not a measured cost decision.

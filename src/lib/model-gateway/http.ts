import type { ModelProvider } from "./types";

const DEFAULT_MAX_TOKENS = 1024;

/** One answer and the tokens the provider reported for it (null when it reported none). */
export type ModelAnswer = {
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

export type ModelCall = (input: {
  prompt: string;
  signal: AbortSignal;
  maxTokens?: number;
}) => Promise<ModelAnswer>;

const tokenCount = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;

/**
 * One call to the provider's chat endpoint, with the token counts of its `usage` (#476: the prompt
 * lab records them). The key goes in the request header only; it is never part of an answer or an
 * error. Any failure throws `Error("request")`.
 */
export function createHttpModelCall(options: {
  apiKey: string;
  apiUrl: string;
  model: string;
  fetchImpl?: typeof fetch;
  maxTokens?: number;
}): ModelCall {
  const fetchImpl = options.fetchImpl ?? fetch;
  return async ({ prompt, signal, maxTokens }) => {
    const response = await fetchImpl(options.apiUrl, {
      method: "POST",
      signal,
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: options.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens ?? options.maxTokens ?? DEFAULT_MAX_TOKENS,
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("request");
    }
    const payload = (await response.json()) as {
      choices?: { message?: { content?: unknown } }[];
      usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
    };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim() === "") throw new Error("request");
    return {
      text: content,
      inputTokens: tokenCount(payload.usage?.prompt_tokens),
      outputTokens: tokenCount(payload.usage?.completion_tokens),
    };
  };
}

export function createHttpModelProvider(options: {
  apiKey: string;
  apiUrl: string;
  model: string;
  fetchImpl?: typeof fetch;
  maxTokens?: number;
}): ModelProvider {
  const call = createHttpModelCall(options);
  return async ({ prompt, signal }) => (await call({ prompt, signal })).text;
}

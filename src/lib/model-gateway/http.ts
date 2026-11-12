import type { ModelProvider } from "./types";

const DEFAULT_MAX_TOKENS = 1024;

export function createHttpModelProvider(options: {
  apiKey: string;
  apiUrl: string;
  model: string;
  fetchImpl?: typeof fetch;
  maxTokens?: number;
}): ModelProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  return async ({ prompt, signal }) => {
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
        max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("request");
    }
    const payload = (await response.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim() === "") throw new Error("request");
    return content;
  };
}

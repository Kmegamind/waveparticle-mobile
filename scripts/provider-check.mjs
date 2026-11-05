// Checks that a model provider answers and accepts the key. Never returns keys or response bodies.
export const PROVIDERS = {
  deepseek: {
    label: "DeepSeek",
    keyName: "DEEPSEEK_API_KEY",
    request: (key) => ({
      url: "https://api.deepseek.com/models",
      init: { headers: { Authorization: `Bearer ${key}` } },
    }),
  },
  gemini: {
    label: "Gemini",
    keyName: "GEMINI_API_KEY",
    request: (key) => ({
      url: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
      init: { headers: { "x-goog-api-key": key } },
    }),
  },
};

/** Returns { ok, reason, ms } for one provider. Never includes the key or the response body. */
export async function checkProvider(id, env, fetchImpl = fetch) {
  const provider = PROVIDERS[id];
  const key = env[provider.keyName];
  if (!key) return { ok: false, reason: `${provider.keyName} is missing in .env`, ms: 0 };
  const { url, init } = provider.request(key);
  const started = Date.now();
  try {
    const response = await fetchImpl(url, init);
    const ms = Date.now() - started;
    if (response.ok) return { ok: true, reason: "the key was accepted", ms };
    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: `the key was rejected (status ${response.status})`, ms };
    }
    return {
      ok: false,
      reason: `unexpected answer (status ${response.status}); the provider's interface may have changed`,
      ms,
    };
  } catch {
    return {
      ok: false,
      reason: "could not reach the provider; check your network",
      ms: Date.now() - started,
    };
  }
}

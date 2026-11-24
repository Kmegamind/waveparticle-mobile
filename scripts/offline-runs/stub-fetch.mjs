// A fetch for the offline runs (#42) that answers like the provider without any network: the
// test-only stub model's answers (e2e/support/stub-cards.mjs) with a usage block. Used by the
// stub mode of the runner and by the tests, so the runner is proved end to end without a model.
import { stubAnswer } from "../../e2e/support/stub-cards.mjs";

/**
 * @param {(prompt: string) => string} [answer] replaces the stub's answer (tests use it to fail on purpose)
 * @returns {typeof fetch}
 */
export function stubFetch(answer = stubAnswer) {
  return async (_url, init) => {
    const prompt = JSON.parse(String(init?.body ?? "{}")).messages?.[0]?.content ?? "";
    const content = answer(prompt);
    return new Response(
      JSON.stringify({
        choices: [{ message: { content } }],
        usage: {
          prompt_tokens: Math.ceil(prompt.length / 4),
          completion_tokens: Math.ceil(content.length / 4),
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
}

/** The environment the stub mode passes to the gateway: placeholders, never a real address. */
export const STUB_ENV = {
  MODEL_API_KEY: "stub",
  MODEL_API_URL: "http://stub.invalid/v1/chat/completions",
  MODEL_NAME: "stub",
};

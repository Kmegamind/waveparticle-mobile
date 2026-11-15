import { getActivePrompt, type PromptSource } from "@/lib/prompts/repository";
import { createModelGateway } from "./gateway";
import { createHttpModelProvider } from "./http";
import type { GatewayLog, ModelGateway } from "./types";

/** Names the gateway reads. All are server-only. None are exposed to the browser. */
export const MODEL_GATEWAY_ENV_NAMES = ["MODEL_API_KEY", "MODEL_API_URL", "MODEL_NAME"] as const;

export function createServerModelGateway(
  options: {
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
    timeLimitMs?: number;
    maxAttempts?: number;
    log?: (event: GatewayLog) => void;
    /** The prompt source; the database through getActivePrompt unless a test passes another. */
    prompts?: PromptSource;
  } = {},
): ModelGateway {
  const source = options.env ?? process.env;
  const apiKey = source.MODEL_API_KEY?.trim() ?? "";
  const apiUrl = source.MODEL_API_URL?.trim() ?? "";
  const model = source.MODEL_NAME?.trim() ?? "";
  const configured = apiKey.length > 0 && apiUrl.length > 0 && model.length > 0;

  return createModelGateway({
    prompts: options.prompts ?? getActivePrompt,
    timeLimitMs: options.timeLimitMs,
    maxAttempts: options.maxAttempts,
    log: options.log,
    provider: configured
      ? createHttpModelProvider({
          apiKey,
          apiUrl,
          model,
          fetchImpl: options.fetchImpl,
        })
      : async () => {
          throw new Error("request");
        },
  });
}

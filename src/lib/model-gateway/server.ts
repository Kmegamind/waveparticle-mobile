import { createModelGateway } from "./gateway";
import { createHttpModelProvider } from "./http";
import type { GatewayLog, ModelGateway } from "./types";

/** Names the gateway reads. All are server-only. None are exposed to the browser. */
export const MODEL_GATEWAY_ENV_NAMES = ["MODEL_API_KEY", "MODEL_API_URL", "MODEL_NAME"] as const;

export function createServerModelGateway(
  options: {
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    log?: (event: GatewayLog) => void;
  } = {},
): ModelGateway {
  const source = options.env ?? process.env;
  const apiKey = source.MODEL_API_KEY?.trim() ?? "";
  const apiUrl = source.MODEL_API_URL?.trim() ?? "";
  const model = source.MODEL_NAME?.trim() ?? "";
  const configured = apiKey.length > 0 && apiUrl.length > 0 && model.length > 0;

  return createModelGateway({
    timeoutMs: options.timeoutMs,
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

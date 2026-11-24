import { getActivePrompt, type PromptSource } from "@/lib/prompts/repository";
import { createModelGateway } from "./gateway";
import { createHttpModelProvider } from "./http";
import type { GatewayAttempt, GatewayLog, ModelGateway } from "./types";
import { logEvent } from "@/lib/logging/server-log";

/** A model call that takes at least this long is logged as slow (#135). */
export const SLOW_MODEL_CALL_MS = 5_000;

/** The server log of a gateway call: failures and slow calls only, never prompt or answer text. */
export function logGatewayCall(event: GatewayLog): void {
  const failed = event.source === "failed";
  if (!failed && event.latencyMs < SLOW_MODEL_CALL_MS) return;
  logEvent(
    "model-gateway",
    {
      event: failed ? "model_call_failed" : "model_call_slow",
      call: event.call,
      reason: event.reason,
      attempts: event.attempts,
      rejectedRules: event.rejectedRules,
    },
    { durationMs: event.latencyMs, level: failed ? "error" : "warn" },
  );
}

/** Names the gateway reads. All are server-only. None are exposed to the browser. */
export const MODEL_GATEWAY_ENV_NAMES = ["MODEL_API_KEY", "MODEL_API_URL", "MODEL_NAME"] as const;

export function createServerModelGateway(
  options: {
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
    timeLimitMs?: number;
    maxAttempts?: number;
    log?: (event: GatewayLog) => void;
    /** Every attempt's failed rules, for the offline runs (#42). */
    onAttempt?: (event: GatewayAttempt) => void;
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
    log: options.log ?? logGatewayCall,
    onAttempt: options.onAttempt,
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

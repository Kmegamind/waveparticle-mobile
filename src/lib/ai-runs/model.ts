import { createHttpModelCall, type ModelCall } from "@/lib/model-gateway/http";

// #476 (FR-AILAB-1, FR-AILAB-2, AI-LAB-STUB): the model the prompt lab runs. Server code only. It
// reads the gateway's own settings (MODEL_API_KEY, MODEL_API_URL, MODEL_NAME); the key is held in
// the call's closure and goes only into the provider request's header, never into this object's
// fields, an answer, an error or the run log.

export type LabModel = {
  /** The configured model name (MODEL_NAME); the only model the lab offers for now. */
  name: string;
  /** True for the test stub model (e2e/support/stub-model.mjs): every test and e2e run. */
  stub: boolean;
  call: ModelCall;
};

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

/**
 * The stub model: it runs on this machine (the e2e stub listens on 127.0.0.1) or is named "stub".
 * A real provider is never on a loopback address.
 */
export function isStubModel(apiUrl: string, name: string): boolean {
  if (name.trim().toLowerCase() === "stub") return true;
  try {
    return LOOPBACK.has(new URL(apiUrl).hostname);
  } catch {
    return false;
  }
}

/** The lab's model from the server settings, or null when one of the three is missing. */
export function labModelFromEnv(
  env: Record<string, string | undefined>,
  fetchImpl?: typeof fetch,
): LabModel | null {
  const apiKey = env.MODEL_API_KEY?.trim() ?? "";
  const apiUrl = env.MODEL_API_URL?.trim() ?? "";
  const name = env.MODEL_NAME?.trim() ?? "";
  if (!apiKey || !apiUrl || !name) return null;
  return {
    name,
    stub: isStubModel(apiUrl, name),
    call: createHttpModelCall({ apiKey, apiUrl, model: name, fetchImpl }),
  };
}

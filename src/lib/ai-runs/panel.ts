// #477 (FR-AILAB-1, FR-AILAB-3; AI-RUN-PERMISSION, AI-LAB-STUB): the words and numbers of the Run
// panel and the Runs page. No server code: the Run panel uses it in the browser.

/** US dollars: "$0.00" for nothing, six decimals under a cent, else two. */
export function formatUsd(value: number): string {
  if (value === 0) return "$0.00";
  return `$${value.toFixed(Math.abs(value) < 0.01 ? 6 : 2)}`;
}

/** "120 in · 30 out", or "Not reported" when the provider gave no token counts. */
export function tokensText(input: number | null, output: number | null): string {
  if (input === null && output === null) return "Not reported";
  return `${input ?? "?"} in · ${output ?? "?"} out`;
}

/**
 * The cost of one run: the dollars, or why there are none ("Price not set" when AI_RUN_PRICES has
 * no price for the model). A stub run is marked "stub, no charge": the fake model costs nothing,
 * whatever test price is set.
 */
export function costText(cost: number | null, note: string | null, stub: boolean): string {
  const amount =
    cost !== null
      ? formatUsd(cost)
      : note === "tokens not reported"
        ? "Tokens not reported"
        : "Price not set";
  return stub ? `${amount} (stub, no charge)` : amount;
}

export type PromptSource = "published" | "draft" | "pasted";

/** "Published v2", "Draft v3" or "Pasted text". */
export function versionLabel(source: PromptSource, version: number | null): string {
  if (source === "pasted") return "Pasted text";
  const word = source === "published" ? "Published" : "Draft";
  return version === null ? word : `${word} v${version}`;
}

/** Why a Run was refused before the model was called, in words (POST /admin/ai-runs/run). */
export const RUN_REFUSED: Record<string, string> = {
  "not-allowed": "Your account cannot run prompts.",
  invalid: "The run settings could not be read. Reload the page and try again.",
  "unknown-feature": "This AI feature does not exist any more.",
  "unknown-prompt": "This prompt version does not exist any more. Reload the page.",
  "unknown-sample": "This sample is not in the library any more. Reload the page.",
  "unknown-model": "This model is not offered any more. Reload the page.",
  "no-model": "No model is configured on the server.",
  "no-run-log": "The run log is not set up on the server, so nothing was sent.",
  "not-recorded": "The run could not be recorded, so the model was not called.",
  "prompt-problem": "The prompt could not be built, so the model was not called.",
  failed: "Something went wrong before the model was called. Nothing was sent.",
  "cross-origin": "The request did not come from this site.",
  "not-json": "The request could not be read.",
  "too-large": "The prompt is too long to send.",
  network: "The server did not answer. The run may still have been recorded: see Runs.",
};

/** A model error, by its fixed reason (never the provider's message). */
export function modelErrorText(reason: string): string {
  return reason === "timeout"
    ? "No answer within the time limit (120 seconds)."
    : "The model answered with an error.";
}

import type { Prices } from "./budget";

type BenchmarkProvider = {
  provider: string;
  model: string;
  servedModel?: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
};

/**
 * Prices per million tokens for the cost record and the budget stop (#42): the two price settings
 * when both are given; otherwise the entry of `scripts/live-generation-benchmark.config.json` whose
 * provider or model is named in `MODEL_NAME`; otherwise the highest prices in that file, so the
 * budget stop errs on the safe side.
 */
export function choosePrices(
  env: Record<string, string | undefined>,
  config: { reviewedAt?: string; providers: BenchmarkProvider[] },
): Prices {
  const input = Number(env.OFFLINE_RUN_INPUT_PRICE_PER_M);
  const output = Number(env.OFFLINE_RUN_OUTPUT_PRICE_PER_M);
  if (
    env.OFFLINE_RUN_INPUT_PRICE_PER_M &&
    env.OFFLINE_RUN_OUTPUT_PRICE_PER_M &&
    Number.isFinite(input) &&
    Number.isFinite(output) &&
    input >= 0 &&
    output >= 0
  ) {
    return { inputPerMillion: input, outputPerMillion: output, source: "the price settings" };
  }
  const name = (env.MODEL_NAME ?? "").toLowerCase();
  const reviewed = config.reviewedAt ? `, reviewed ${config.reviewedAt}` : "";
  const match = config.providers.find(
    (entry) =>
      name.length > 0 &&
      [entry.provider, entry.model, entry.servedModel ?? ""]
        .filter(Boolean)
        .some((label) => name.includes(label.toLowerCase())),
  );
  if (match) {
    return {
      inputPerMillion: match.inputPricePerMillion,
      outputPerMillion: match.outputPricePerMillion,
      source: `${match.provider} ${match.model} in the benchmark config${reviewed}`,
    };
  }
  return {
    inputPerMillion: Math.max(...config.providers.map((entry) => entry.inputPricePerMillion)),
    outputPerMillion: Math.max(...config.providers.map((entry) => entry.outputPricePerMillion)),
    source: `assumed: the highest prices in the benchmark config${reviewed}, because MODEL_NAME names none of its providers`,
  };
}

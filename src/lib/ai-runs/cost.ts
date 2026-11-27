// #476 (FR-AILAB-3, AI-RUN-PERMISSION): the cost of a prompt lab run, from the tokens the provider
// reported and the price the owner set for the model in the server setting AI_RUN_PRICES. No price
// is written in the code. Without a price for the model the cost is null ("price not set"); there
// is no spending cap.

/** The server-only setting that holds the prices (never NEXT_PUBLIC_). */
export const AI_RUN_PRICES_ENV = "AI_RUN_PRICES";

/** US dollars per million tokens, as the owner sets them for one model name. */
export type ModelPrice = {
  input_usd_per_million_tokens: number;
  output_usd_per_million_tokens: number;
};
export type PriceTable = Record<string, ModelPrice>;

export type CostNote = "price not set" | "tokens not reported";

const price = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

/**
 * Reads `{"<model name>": {"input_usd_per_million_tokens": n, "output_usd_per_million_tokens": n}}`.
 * Null when the text is not that shape (a negative or missing price included).
 */
export function parsePrices(text: string): PriceTable | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const table: PriceTable = {};
  for (const [model, value] of Object.entries(parsed)) {
    const row = value as Partial<ModelPrice> | null;
    if (
      typeof row !== "object" ||
      row === null ||
      !price(row.input_usd_per_million_tokens) ||
      !price(row.output_usd_per_million_tokens)
    ) {
      return null;
    }
    table[model] = {
      input_usd_per_million_tokens: row.input_usd_per_million_tokens,
      output_usd_per_million_tokens: row.output_usd_per_million_tokens,
    };
  }
  return table;
}

/**
 * The prices from the server setting; an unset or malformed setting counts as no prices. A
 * malformed one calls `warn` (the route logs one warning, never the value), so a typo is noticed.
 */
export function readPrices(env: Record<string, string | undefined>, warn?: () => void): PriceTable {
  const text = env[AI_RUN_PRICES_ENV]?.trim();
  if (!text) return {};
  const table = parsePrices(text);
  if (table === null) {
    warn?.();
    return {};
  }
  return table;
}

/** The cost in US dollars, rounded to 8 decimals, or null with the reason. */
export function runCost(
  model: string,
  tokens: { inputTokens: number | null; outputTokens: number | null },
  prices: PriceTable,
): { cost: number | null; note: CostNote | null } {
  const row = Object.hasOwn(prices, model) ? prices[model] : undefined;
  if (!row) return { cost: null, note: "price not set" };
  if (tokens.inputTokens === null || tokens.outputTokens === null) {
    return { cost: null, note: "tokens not reported" };
  }
  const cost =
    (tokens.inputTokens * row.input_usd_per_million_tokens +
      tokens.outputTokens * row.output_usd_per_million_tokens) /
    1_000_000;
  return { cost: Math.round(cost * 1e8) / 1e8, note: null };
}

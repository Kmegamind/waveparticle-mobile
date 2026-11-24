/**
 * The budget stop of an offline run (#42, US-AI-12): a most number of model calls and a most
 * estimated cost. Before each call the worst case of that call (its prompt, and the gateway's
 * `max_tokens` as output) is reserved; after it the real usage replaces the reservation. A call
 * that would pass either limit is not made, and the run stops.
 */

/** Chars per token for English, used only when the provider returns no usage. */
export const CHARS_PER_TOKEN = 4;
/** The gateway's output cap per call (`createHttpModelProvider`). */
export const MAX_OUTPUT_TOKENS = 1024;
/** About 1,990 first attempts per full run; 3,100 leaves room for a 50% retry rate. */
export const DEFAULT_MAX_CALLS = 3_100;
export const DEFAULT_MAX_COST_USD = 5;

export type Prices = { inputPerMillion: number; outputPerMillion: number; source: string };

export type Usage = { inputTokens: number; outputTokens: number; estimated: boolean };

/** Why the run stopped early: a budget limit, or an interrupt (Ctrl-C) asked for a stop. */
export type StopReason = "calls" | "cost" | "interrupted";

export class BudgetStop extends Error {
  constructor(readonly limit: StopReason) {
    super(`budget stop: ${limit}`);
  }
}

export function tokensOf(chars: number): number {
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

export function costUsd(inputTokens: number, outputTokens: number, prices: Prices): number {
  return (inputTokens * prices.inputPerMillion + outputTokens * prices.outputPerMillion) / 1e6;
}

export type BudgetSnapshot = {
  calls: number;
  maxCalls: number;
  costUsd: number;
  maxCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  estimatedUsageCalls: number;
  stopped: StopReason | null;
  prices: Prices;
};

export type Budget = {
  /** Reserves one call; throws BudgetStop (and marks the run stopped) when it would pass a limit. */
  reserve(promptChars: number): number;
  /** Replaces a reservation with the real usage of the call. */
  settle(ticket: number, usage: Usage): void;
  readonly stopped: StopReason | null;
  /** Stops the run after the requests in flight: no new request is made (Ctrl-C). */
  halt(): void;
  snapshot(): BudgetSnapshot;
};

export function createBudget(options: {
  maxCalls: number;
  maxCostUsd: number;
  prices: Prices;
}): Budget {
  let calls = 0;
  let spent = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let estimatedUsageCalls = 0;
  let stopped: StopReason | null = null;
  let next = 0;
  const pending = new Map<number, number>();
  const reservedNow = () => [...pending.values()].reduce((sum, value) => sum + value, 0);

  return {
    reserve(promptChars) {
      if (stopped) throw new BudgetStop(stopped);
      const worst = costUsd(tokensOf(promptChars), MAX_OUTPUT_TOKENS, options.prices);
      if (calls + 1 > options.maxCalls) stopped = "calls";
      else if (spent + reservedNow() + worst > options.maxCostUsd) stopped = "cost";
      if (stopped) throw new BudgetStop(stopped);
      calls += 1;
      next += 1;
      pending.set(next, worst);
      return next;
    },
    settle(ticket, usage) {
      pending.delete(ticket);
      inputTokens += usage.inputTokens;
      outputTokens += usage.outputTokens;
      if (usage.estimated) estimatedUsageCalls += 1;
      spent += costUsd(usage.inputTokens, usage.outputTokens, options.prices);
    },
    halt() {
      stopped ??= "interrupted";
    },
    get stopped() {
      return stopped;
    },
    snapshot: () => ({
      calls,
      maxCalls: options.maxCalls,
      costUsd: spent,
      maxCostUsd: options.maxCostUsd,
      inputTokens,
      outputTokens,
      estimatedUsageCalls,
      stopped,
      prices: options.prices,
    }),
  };
}

export type MeterHooks = {
  onUsage?: (usage: Usage) => void;
  /** The answer text of every request, in order ("" when there was none), for the scoring sheets. */
  onAnswer?: (text: string) => void;
  /** Called when the budget refused this request (the unit is then left out of the measures). */
  onStop?: () => void;
};

/**
 * A fetch that goes through the budget: it reserves before the request and records the usage the
 * provider returns (`usage.prompt_tokens`, `usage.completion_tokens`), or an estimate from the text
 * when there is none. A request that fails or is aborted (a timeout) is counted at the worst case,
 * `max_tokens` of output, because the provider may still bill it. It never reads or logs the key.
 */
export function meteredFetch(
  base: typeof fetch,
  budget: Budget,
  hooks: MeterHooks = {},
): typeof fetch {
  return async (input, init) => {
    let prompt = "";
    try {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        messages?: { content?: unknown }[];
      };
      const content = body.messages?.[0]?.content;
      prompt = typeof content === "string" ? content : "";
    } catch {
      prompt = "";
    }
    let ticket: number;
    try {
      ticket = budget.reserve(prompt.length);
    } catch (error) {
      hooks.onStop?.();
      throw error;
    }
    let response: Response;
    try {
      response = await base(input, init);
    } catch (error) {
      const usage = {
        inputTokens: tokensOf(prompt.length),
        outputTokens: MAX_OUTPUT_TOKENS,
        estimated: true,
      };
      budget.settle(ticket, usage);
      hooks.onUsage?.(usage);
      hooks.onAnswer?.("");
      throw error;
    }
    let usage: Usage = { inputTokens: tokensOf(prompt.length), outputTokens: 0, estimated: true };
    let answer = "";
    try {
      const payload = (await response.clone().json()) as {
        usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
        choices?: { message?: { content?: unknown } }[];
      };
      const text = payload.choices?.[0]?.message?.content;
      answer = typeof text === "string" ? text : "";
      const reported = payload.usage;
      if (
        typeof reported?.prompt_tokens === "number" &&
        typeof reported.completion_tokens === "number"
      ) {
        usage = {
          inputTokens: reported.prompt_tokens,
          outputTokens: reported.completion_tokens,
          estimated: false,
        };
      } else {
        usage = {
          inputTokens: tokensOf(prompt.length),
          outputTokens: tokensOf(answer.length),
          estimated: true,
        };
      }
    } catch {
      // Not JSON: keep the input estimate; the gateway treats the answer as a failed request.
    }
    budget.settle(ticket, usage);
    hooks.onUsage?.(usage);
    hooks.onAnswer?.(answer);
    return response;
  };
}

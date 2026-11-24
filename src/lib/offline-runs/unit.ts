import { createServerModelGateway } from "@/lib/model-gateway/server";
import type { GatewayAttempt, GatewayLog, ModelGateway } from "@/lib/model-gateway/types";
import type { PromptSource } from "@/lib/prompts/repository";
import { meteredFetch, type Budget, type Usage } from "./budget";

/**
 * One unit of an offline run (#42): one pause message, one rest reply or one split. Each unit gets
 * its own gateway, so its calls, attempts and usage are recorded apart even when units run side by
 * side. Rule ids and numbers only; the texts are kept by the suite that shows them.
 */
export type UnitLog = { logs: GatewayLog[]; attempts: GatewayAttempt[]; usage: Usage[] };

export type CallSummary = {
  call: string;
  source: "generated" | "failed";
  reason?: string;
  attempts: number;
  /** The rules each attempt failed, in order; an empty list is the attempt that passed. */
  rulesByAttempt: string[][];
};

export type GatewayFor = (unit: UnitLog) => ModelGateway;

export function newUnit(): UnitLog {
  return { logs: [], attempts: [], usage: [] };
}

/** The gateway the app uses (`createServerModelGateway`) behind the budget's fetch. */
export function unitGatewayFactory(options: {
  env: Record<string, string | undefined>;
  fetchImpl: typeof fetch;
  prompts: PromptSource;
  budget: Budget;
  timeLimitMs?: number;
}): GatewayFor {
  return (unit) =>
    createServerModelGateway({
      env: options.env,
      prompts: options.prompts,
      timeLimitMs: options.timeLimitMs,
      fetchImpl: meteredFetch(options.fetchImpl, options.budget, (usage) => unit.usage.push(usage)),
      log: (event) => unit.logs.push(event),
      onAttempt: (event) => unit.attempts.push(event),
    });
}

/** The calls of a unit in order, each with its attempts' rules. */
export function callsOf(unit: UnitLog): CallSummary[] {
  const queue = [...unit.attempts];
  return unit.logs.map((log) => {
    const mine: string[][] = [];
    for (let index = 0; index < log.attempts; index += 1) {
      const at = queue.findIndex((attempt) => attempt.call === log.call);
      if (at === -1) break;
      mine.push(queue[at].rejectedRules);
      queue.splice(at, 1);
    }
    return {
      call: log.call,
      source: log.source,
      reason: log.reason,
      attempts: log.attempts,
      rulesByAttempt: mine,
    };
  });
}

export function tokensOfUnit(unit: UnitLog): { inputTokens: number; outputTokens: number } {
  return unit.usage.reduce(
    (sum, usage) => ({
      inputTokens: sum.inputTokens + usage.inputTokens,
      outputTokens: sum.outputTokens + usage.outputTokens,
    }),
    { inputTokens: 0, outputTokens: 0 },
  );
}

/** Runs `work` over `items` with at most `limit` at once, in order of the results. */
export async function inPool<T, R>(
  items: T[],
  limit: number,
  work: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await work(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

import { createServerModelGateway } from "@/lib/model-gateway/server";
import type { GatewayAttempt, GatewayLog, ModelGateway } from "@/lib/model-gateway/types";
import type { PromptSource } from "@/lib/prompts/repository";
import { meteredFetch, type Budget, type Usage } from "./budget";

/**
 * One unit of an offline run (#42): one pause message, one rest reply or one split. Each unit gets
 * its own gateway, so its calls, attempts, answers and usage are recorded apart even when units run
 * side by side. The calls of one unit run one after another, so answers and attempts line up.
 */
export type UnitLog = {
  logs: GatewayLog[];
  attempts: GatewayAttempt[];
  usage: Usage[];
  answers: string[];
  /** The budget refused one of this unit's requests: the unit is left out of the measures. */
  stoppedByBudget: boolean;
};

export type CallSummary = {
  call: string;
  source: "generated" | "failed";
  reason?: string;
  attempts: number;
  /** The rules each attempt failed, in order; an empty list is the attempt that passed. */
  rulesByAttempt: string[][];
  /** The answers the checks rejected, with their rules: test data, for the over-block read. */
  rejected: { rules: string[]; text: string }[];
};

export type GatewayFor = (unit: UnitLog) => ModelGateway;

export function newUnit(): UnitLog {
  return { logs: [], attempts: [], usage: [], answers: [], stoppedByBudget: false };
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
      fetchImpl: meteredFetch(options.fetchImpl, options.budget, {
        onUsage: (usage) => unit.usage.push(usage),
        onAnswer: (text) => unit.answers.push(text),
        onStop: () => {
          unit.stoppedByBudget = true;
        },
      }),
      log: (event) => unit.logs.push(event),
      onAttempt: (event) => unit.attempts.push(event),
    });
}

const NOT_CHECKS = new Set(["request", "timeout"]);

/** The calls of a unit in order, each with its attempts' rules and rejected answers. */
export function callsOf(unit: UnitLog): CallSummary[] {
  let next = 0;
  return unit.logs.map((log) => {
    const mine = unit.attempts.slice(next, next + log.attempts);
    const answers = unit.answers.slice(next, next + log.attempts);
    next += log.attempts;
    const rulesByAttempt = mine.map((attempt) => attempt.rejectedRules);
    return {
      call: log.call,
      source: log.source,
      reason: log.reason,
      attempts: log.attempts,
      rulesByAttempt,
      rejected: rulesByAttempt.flatMap((rules, at) =>
        rules.length > 0 && !rules.some((rule) => NOT_CHECKS.has(rule))
          ? [{ rules, text: answers[at] ?? "" }]
          : [],
      ),
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

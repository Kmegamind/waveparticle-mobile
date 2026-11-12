import { checkCompanionLine, checkPlan } from "./checks";
import {
  fallbackPlan,
  fallbackReply,
  fallbackReturn,
  fallbackStepCards,
  fallbackStuck,
} from "./fallbacks";
import type {
  GatewayCall,
  GatewayLog,
  LineResult,
  ModelGateway,
  ModelProvider,
  PlanSplitInput,
  PlanSplitResult,
  RestReplyInput,
  ReturnPopupInput,
  ReturnTrigger,
  StepCardsInput,
  StepCardsResult,
  StuckStoryInput,
} from "./types";

const DEFAULT_TIMEOUT_MS = 12_000;

type Attempt<T> = { ok: true; value: T } | { ok: false; rejectedRules: string[] };

export function createModelGateway(options: {
  provider: ModelProvider;
  timeoutMs?: number;
  log?: (event: GatewayLog) => void;
}): ModelGateway {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const log = options.log ?? (() => undefined);

  async function run<T extends { source: "generated" | "authored" }>(
    call: GatewayCall,
    prompt: string,
    accept: (raw: string) => Attempt<T>,
    fallback: () => T,
  ): Promise<T> {
    const started = Date.now();
    let rejectedRules: string[] = [];
    let attempts = 0;

    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        attempts += 1;
        const controller = new AbortController();
        try {
          const raw = await withTimeout(
            options.provider({ prompt, signal: controller.signal }),
            timeoutMs,
            controller,
          );
          const parsed = accept(raw);
          if (parsed.ok) {
            log({
              call,
              source: "generated",
              rejectedRules,
              latencyMs: Date.now() - started,
              attempts,
            });
            return parsed.value;
          }
          rejectedRules = parsed.rejectedRules;
        } catch {
          controller.abort();
          rejectedRules = ["request"];
        }
      }
    } catch {
      rejectedRules = ["request"];
    }

    log({
      call,
      source: "authored",
      rejectedRules,
      latencyMs: Date.now() - started,
      attempts,
    });
    return fallback();
  }

  return {
    splitPlan(input) {
      return run<PlanSplitResult>(
        "plan_split",
        planPrompt(input),
        (raw) => {
          const parsed = parseModelJson(raw);
          if (parsed === null) return { ok: false, rejectedRules: ["parse"] };
          const checked = checkPlan(parsed, input.totalMinutes);
          if (!checked.ok) return checked;
          return { ok: true, value: checked.plan };
        },
        () => fallbackPlan(input.goal, input.totalMinutes),
      );
    },
    writeStepCards(input) {
      return run<StepCardsResult>(
        "step_cards",
        stepCardPrompt(input),
        (raw) => acceptCards(raw, input.forbidTerms ?? []),
        fallbackStepCards,
      );
    },
    writeStuckStory(input) {
      return run<LineResult>(
        "stuck_story",
        stuckPrompt(input),
        (raw) => acceptLine(raw, "story", "stuck_story", input.forbidTerms ?? []),
        fallbackStuck,
      );
    },
    writeRestReply(input) {
      return run<LineResult>(
        "rest_reply",
        restPrompt(input),
        (raw) => acceptLine(raw, "reply", "rest_reply", []),
        fallbackReply,
      );
    },
    writeReturnPopup(input) {
      return run<LineResult>(
        "return_popup",
        returnPrompt(input),
        (raw) => acceptLine(raw, "returnLine", "return_popup", input.forbidTerms ?? []),
        fallbackReturn,
      );
    },
  };
}

function acceptCards(
  raw: string,
  forbidTerms: string[],
): Attempt<{ source: "generated"; cards: string[] }> {
  const parsed = parseModelJson(raw);
  const cards = isRecord(parsed) && Array.isArray(parsed.cards) ? parsed.cards : null;
  if (!cards || cards.length === 0) return { ok: false, rejectedRules: ["parse"] };

  const accepted: string[] = [];
  for (const card of cards.slice(0, 5)) {
    if (typeof card !== "string") return { ok: false, rejectedRules: ["parse"] };
    const checked = checkCompanionLine(card, "step_card", forbidTerms);
    if (!checked.ok) return checked;
    accepted.push(checked.text);
  }
  return { ok: true, value: { source: "generated", cards: accepted } };
}

function acceptLine(
  raw: string,
  key: string,
  kind: "stuck_story" | "rest_reply" | "return_popup",
  forbidTerms: string[],
): Attempt<{ source: "generated"; text: string }> {
  const parsed = parseModelJson(raw);
  const text = isRecord(parsed) ? parsed[key] : undefined;
  if (typeof text !== "string") return { ok: false, rejectedRules: ["parse"] };
  const checked = checkCompanionLine(text, kind, forbidTerms);
  if (!checked.ok) return checked;
  return { ok: true, value: { source: "generated", text: checked.text } };
}

function parseModelJson(raw: string): unknown | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function withTimeout(
  work: Promise<string>,
  timeoutMs: number,
  controller: AbortController,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => {
      controller.abort();
      finish(() => reject(new Error("request")));
    }, timeoutMs);
    work.then(
      (value) => finish(() => resolve(value)),
      () => finish(() => reject(new Error("request"))),
    );
  });
}

function planPrompt(input: PlanSplitInput): string {
  return [
    "Return JSON only with a short title and at least one step.",
    'Shape: {"title":"...","steps":[{"title":"...","description":"...","minutes":1}]}',
    "Minutes are positive whole numbers and add up to the total.",
    `Goal: ${input.goal}`,
    `Total minutes: ${input.totalMinutes}`,
    `Split into finer steps: ${input.splitFiner ? "yes" : "no"}`,
  ].join("\n");
}

function stepCardPrompt(input: StepCardsInput): string {
  return [
    'Return JSON only: {"cards":["..."]}',
    "Each card is 2 to 4 sentences in his first person, with no advice and no question.",
    `Step: ${input.stepTitle}`,
    `Minutes: ${input.minutes}`,
    `Facts already known: ${input.facts}`,
  ].join("\n");
}

const HARDER_PAUSE = 3;

/** A Pause number that is not a whole number of at least 1 is read as the first Pause. */
function normalPauseNumber(value: number): number {
  return Number.isInteger(value) && value >= 1 ? value : 1;
}

function stuckPrompt(input: StuckStoryInput): string {
  const pauseNumber = normalPauseNumber(input.pauseNumber);
  const situation =
    pauseNumber >= HARDER_PAUSE
      ? [
          "Every pause has stalled his own work, and he remembers the earlier setbacks.",
          "So this new stuck situation is much harder than the earlier ones.",
          "He says he is worried he may fail.",
        ]
      : ["A new small snag that holds up his own work, and how he feels about it."];
  return [
    'Return JSON only: {"story":"..."}',
    "One or two short first-person sentences about where his own work is stuck.",
    ...situation,
    "Never tell the person what to do and never ask the person to stop pausing.",
    `Pause number: ${pauseNumber}`,
    `Facts already known: ${input.facts}`,
  ].join("\n");
}

function restPrompt(input: RestReplyInput): string {
  return [
    'Return JSON only: {"reply":"..."}',
    "One to three first-person sentences from his side of the work. No advice.",
    `Facts already known: ${input.facts}`,
    `The person wrote: ${input.userMessage}`,
  ].join("\n");
}

const RETURN_SITUATION: Record<ReturnTrigger, string> = {
  rest: "The person is coming back from the rest conversation with him.",
  absence: "The person is coming back after being away from the app.",
};

function returnPrompt(input: ReturnPopupInput): string {
  return [
    'Return JSON only: {"returnLine":"..."}',
    "One to three first-person sentences: what he did in that time and how he felt.",
    RETURN_SITUATION[input.trigger],
    "He may say how the time felt in his own words, such as a while or very long.",
    "No clock times and no numbers.",
    `Return trigger: ${input.trigger}`,
    `Facts already known: ${input.facts}`,
    `Minutes away, for context only and never written out: ${input.awayMinutes}`,
  ].join("\n");
}

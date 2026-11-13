import { checkCompanionLine, checkPlan } from "./checks";
import { checkRunList, reusesCardNouns } from "./run-list";
import type {
  GatewayCall,
  GatewayFailure,
  GatewayFailureReason,
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

/** Waiting time limit for one call, all attempts included. The real value is set by testing (TIME-LIMIT). */
export const DEFAULT_TIME_LIMIT_MS = 12_000;
/** Most attempts per call within the time limit, so a provider that fails at once is not hammered. */
export const DEFAULT_MAX_ATTEMPTS = 3;

type Attempt<T> = { ok: true; value: T } | { ok: false; rejectedRules: string[] };

/** Plain reasons added to the prompt on a retry. Rule ids only; never user text or forbid terms. */
const RULE_FIXES: Record<string, string> = {
  parse: "Return valid JSON in exactly the shape asked for.",
  empty: "Write a non-empty line within the size asked for.",
  minutes: "Use positive whole minutes that add up to the total.",
  failure_text: "Do not mention errors or failures.",
  cjk: "Write in English only.",
  dash: "Use no dashes.",
  ban: "Use none of the banned words.",
  clock: "Use no clock times, numbers of minutes or durations.",
  back: "Use no behind-the-scenes words such as step, session, app, screen or task.",
  cmd: "Give no orders or advice.",
  question: "Ask no question, or at most one where a question is allowed.",
  you: "Do not address the person as you.",
  hook: "Use no hook words such as more, later, soon or next.",
  praise: "Give no praise.",
  form: "Use no exclamation marks, emoji or links, and end with a full stop.",
  name: "Never say his own name.",
  first_person: "Write in his first person.",
  blame: "Do not blame the person for being away.",
  len: "Keep within the length asked for.",
  leak: "Use none of the forbidden words.",
  repeat: "Do not repeat a line already shown.",
  opening: "Do not start with the same three words as a recent line.",
  similar: "Do not write a line close to one already shown.",
  card_nouns: "Do not reuse the nouns of the last card.",
};

function retryPrompt(prompt: string, rejectedRules: string[]): string {
  const fixes = [...new Set(rejectedRules.map((rule) => RULE_FIXES[rule]).filter(Boolean))];
  if (fixes.length === 0) return prompt;
  return `${prompt}\n\nThe last answer was rejected. Fix this: ${fixes.join(" ")}`;
}

class TimeLimitError extends Error {}

export function createModelGateway(options: {
  provider: ModelProvider;
  /** Waiting time limit for one call, all attempts included (default 12 s). */
  timeLimitMs?: number;
  /** Most attempts per call within the time limit (default 3). */
  maxAttempts?: number;
  log?: (event: GatewayLog) => void;
}): ModelGateway {
  const timeLimitMs = options.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS;
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const log = options.log ?? (() => undefined);

  /**
   * One pipeline for every call: generate, parse, clean, check. A failed answer is generated again
   * with the failure reason until it passes, the attempts run out or the time limit ends. A line is
   * returned only after it passed; otherwise the result is an explicit failure with no text.
   */
  async function run<T extends { source: "generated" }>(
    call: GatewayCall,
    prompt: string,
    accept: (raw: string) => Attempt<T>,
  ): Promise<T | GatewayFailure> {
    const started = Date.now();
    const deadline = started + timeLimitMs;
    let rejectedRules: string[] = [];
    let reason: GatewayFailureReason = "request";
    let attempts = 0;
    let nextPrompt = prompt;

    while (attempts < maxAttempts) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        reason = "timeout";
        break;
      }
      attempts += 1;
      const controller = new AbortController();
      try {
        const raw = await withTimeout(
          options.provider({ prompt: nextPrompt, signal: controller.signal }),
          remaining,
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
        reason = "checks";
        nextPrompt = retryPrompt(prompt, rejectedRules);
      } catch (error) {
        controller.abort();
        reason = error instanceof TimeLimitError ? "timeout" : "request";
        rejectedRules = [reason];
        nextPrompt = prompt;
        if (reason === "timeout") break;
      }
    }

    log({
      call,
      source: "failed",
      reason,
      rejectedRules,
      latencyMs: Date.now() - started,
      attempts,
    });
    return { source: "failed", reason };
  }

  return {
    splitPlan(input): Promise<PlanSplitResult> {
      return run("plan_split", planPrompt(input), (raw) => {
        const parsed = parseModelJson(raw);
        if (parsed === null) return { ok: false, rejectedRules: ["parse"] };
        const checked = checkPlan(parsed, input.totalMinutes);
        if (!checked.ok) return checked;
        return { ok: true, value: checked.plan };
      });
    },
    writeStepCards(input): Promise<StepCardsResult> {
      return run("step_cards", stepCardPrompt(input), (raw) => acceptCards(raw, input));
    },
    writeStuckStory(input): Promise<LineResult> {
      return run("stuck_story", stuckPrompt(input), (raw) =>
        acceptLine(raw, "story", "stuck_story", input.forbidTerms ?? [], {
          earlierLines: input.earlierLines ?? [],
          lastCard: input.lastCard,
        }),
      );
    },
    writeRestReply(input): Promise<LineResult> {
      return run("rest_reply", restPrompt(input), (raw) =>
        acceptLine(raw, "reply", "rest_reply", [], null),
      );
    },
    writeReturnPopup(input): Promise<LineResult> {
      return run("return_popup", returnPrompt(input), (raw) =>
        acceptLine(raw, "returnLine", "return_popup", input.forbidTerms ?? [], {
          earlierLines: input.earlierLines ?? [],
        }),
      );
    },
  };
}

const DEFAULT_CARDS = 5;
const MAX_STORY_CARDS = 5;

/** The opening card plus at most the Step's story cards (T7); extra cards are dropped. */
function cardLimit(input: StepCardsInput): number {
  const story = input.storyCards;
  if (typeof story !== "number" || !Number.isInteger(story) || story < 1) return DEFAULT_CARDS;
  return 1 + Math.min(story, MAX_STORY_CARDS);
}

function acceptCards(
  raw: string,
  input: StepCardsInput,
): Attempt<{ source: "generated"; cards: string[] }> {
  const forbidTerms = input.forbidTerms ?? [];
  const earlierLines = input.earlierLines ?? [];
  const parsed = parseModelJson(raw);
  const cards = isRecord(parsed) && Array.isArray(parsed.cards) ? parsed.cards : null;
  if (!cards || cards.length === 0) return { ok: false, rejectedRules: ["parse"] };

  const accepted: string[] = [];
  for (const [position, card] of cards.slice(0, cardLimit(input)).entries()) {
    if (typeof card !== "string") return { ok: false, rejectedRules: ["parse"] };
    const kind = position === 0 && input.background ? "background_card" : "step_card";
    const checked = checkCompanionLine(card, kind, forbidTerms);
    if (!checked.ok) return checked;
    // Each card is a one-way line: it is checked against the run and the cards before it.
    const runRules = checkRunList(checked.text, [...earlierLines, ...accepted]);
    if (runRules.length > 0) return { ok: false, rejectedRules: runRules };
    accepted.push(checked.text);
  }
  return { ok: true, value: { source: "generated", cards: accepted } };
}

/** `run` is null for the rest reply, which is a conversation turn and not a one-way line. */
function acceptLine(
  raw: string,
  key: string,
  kind: "stuck_story" | "rest_reply" | "return_popup",
  forbidTerms: string[],
  runList: { earlierLines: string[]; lastCard?: string } | null,
): Attempt<{ source: "generated"; text: string }> {
  const parsed = parseModelJson(raw);
  const text = isRecord(parsed) ? parsed[key] : undefined;
  if (typeof text !== "string") return { ok: false, rejectedRules: ["parse"] };
  const checked = checkCompanionLine(text, kind, forbidTerms);
  if (!checked.ok) return checked;
  if (runList) {
    const rules = checkRunList(checked.text, runList.earlierLines);
    if (runList.lastCard && reusesCardNouns(checked.text, runList.lastCard)) {
      rules.push("card_nouns");
    }
    if (rules.length > 0) return { ok: false, rejectedRules: rules };
  }
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
      finish(() => reject(new TimeLimitError("timeout")));
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

/** No user-written text goes into this prompt (#216): only the Story side and numbers. */
function stepCardPrompt(input: StepCardsInput): string {
  const storyCards =
    typeof input.storyCards === "number" && input.storyCards >= 1
      ? Math.min(Math.floor(input.storyCards), MAX_STORY_CARDS)
      : null;
  const lines = [
    'Return JSON only: {"cards":["..."]}',
    storyCards === null
      ? "Write one opening card and then the story cards for this part of his day."
      : `Write 1 opening card and then ${storyCards} story cards for this part of his day.`,
    "Each story card is 1 to 3 sentences and at most 45 words, in his first person, with no advice and no question.",
    "Every card says something new: never repeat what an earlier card said.",
  ];
  if (input.background) {
    lines.push(
      "The opening card is the background card: who is here, where this is and what each person knows, at most 70 words.",
    );
  }
  if (input.stepNumber && input.stepCount) {
    lines.push(`This is Step ${input.stepNumber} of ${input.stepCount} of his Story.`);
  }
  if (input.mustUse && input.mustUse.length > 0) {
    lines.push(`These moments must happen in these cards: ${input.mustUse.join(" ")}`);
  }
  lines.push(`Minutes: ${input.minutes}`);
  if (input.stepFacts === undefined) {
    lines.push(`Facts already known: ${input.facts}`);
  } else {
    // CARD-NEW: say what happened before and what is new in this part.
    lines.push(`Already happened: ${input.facts}`);
    lines.push(
      input.stepFacts.trim().length > 0
        ? `New in this part: ${input.stepFacts}`
        : "Nothing new happens in this part: he stays in the moment he is in, with no new events.",
    );
  }
  return lines.join("\n");
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

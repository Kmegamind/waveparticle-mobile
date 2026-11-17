import type { PromptKey, PromptRow, PromptSource } from "@/lib/prompts/repository";
import { placeholderNames, renderPrompt, type PromptValue } from "@/lib/prompts/template";
import {
  checkCompanionLine,
  checkPlan,
  readLineLimits,
  readPlanLimits,
  type LineLimits,
} from "./checks";
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
  ClosingLineInput,
  ClosingLineResult,
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

/**
 * Thrown while a prompt is built from a row that cannot be used: an unknown placeholder, or a
 * parameter that is missing or of the wrong kind. The call then fails like a missing prompt.
 */
class PromptRowError extends Error {
  /** What is wrong with the row, in words the admin shows (#308). */
  readonly problems: string[];
  constructor(problems: string[]) {
    super(problems.join(" "));
    this.problems = problems;
  }
}

const missing = (path: string) => new PromptRowError([`Missing or unusable setting: ${path}.`]);

function text(row: PromptRow, name: string): string {
  const texts = row.params.text;
  const value =
    typeof texts === "object" && texts !== null ? (texts as Record<string, unknown>)[name] : null;
  if (typeof value !== "string") throw missing(`text.${name}`);
  return value;
}

function count(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw missing(path);
  return value;
}

function checks(row: PromptRow): Record<string, unknown> {
  const value = row.params.checks;
  if (typeof value !== "object" || value === null) throw missing("checks");
  return value as Record<string, unknown>;
}

function lineLimits(value: unknown, path: string): LineLimits {
  const limits = readLineLimits(value);
  if (!limits) throw missing(path);
  return limits;
}

/**
 * Fills a template. An unknown placeholder fails the row, naming every unknown name once;
 * `where` says which template it was ("the prompt" or a text setting).
 */
function fill(template: string, values: Record<string, PromptValue>, where = "the prompt"): string {
  try {
    return renderPrompt(template, values);
  } catch {
    const unknown = placeholderNames(template).filter((name) => !Object.hasOwn(values, name));
    throw new PromptRowError(
      unknown.length > 0
        ? unknown.map((name) => `Unknown {{${name}}} in ${where}.`)
        : ["The prompt cannot be built."],
    );
  }
}

function render(row: PromptRow, values: Record<string, PromptValue>): string {
  return fill(row.body, values);
}

/** Plain reasons added to the prompt on a retry, from the retry_hints row. Rule ids only. */
function retryPrompt(prompt: string, rejectedRules: string[], hints: PromptRow): string {
  const fixesByRule = hints.params.fixes;
  const known =
    typeof fixesByRule === "object" && fixesByRule !== null
      ? (fixesByRule as Record<string, unknown>)
      : {};
  const fixes = [
    ...new Set(
      rejectedRules
        .map((rule) => known[rule])
        .filter((fix): fix is string => typeof fix === "string" && fix.length > 0),
    ),
  ];
  if (fixes.length === 0) return prompt;
  return `${prompt}\n\n${render(hints, { fixes: fixes.join(" ") })}`;
}

class TimeLimitError extends Error {}

function withinTime<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeLimitError("timeout")), Math.max(0, timeoutMs));
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function createModelGateway(options: {
  provider: ModelProvider;
  /**
   * Where the prompts come from (#282): the database through `getActivePrompt` on the server,
   * the seed files in tests. A missing prompt fails the call; there is no default prompt.
   */
  prompts: PromptSource;
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
    key: PromptKey,
    build: (row: PromptRow) => { prompt: string; accept: (raw: string) => Attempt<T> },
  ): Promise<T | GatewayFailure> {
    const started = Date.now();
    const deadline = started + timeLimitMs;
    // The prompt and the retry hints are read and built before any model call. If either is
    // missing or cannot be used, the call fails here: no model call, no stored line (NO-BACKUP).
    let prompt: string;
    let accept: (raw: string) => Attempt<T>;
    let hints: PromptRow;
    try {
      // Reading the prompts counts against the call's time limit: a stalled read ends in the
      // failure screen, not in a page that waits forever.
      const [row, hintsRow] = await withinTime(
        Promise.all([options.prompts(key), options.prompts("retry_hints")]),
        deadline - Date.now(),
      );
      if (!row || !hintsRow) throw new PromptRowError([key]);
      ({ prompt, accept } = build(row));
      hints = hintsRow;
      retryPrompt("", ["parse"], hints);
    } catch {
      log({
        call,
        source: "failed",
        reason: "prompt",
        rejectedRules: [],
        latencyMs: Date.now() - started,
        attempts: 0,
      });
      return { source: "failed", reason: "prompt" };
    }
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
        nextPrompt = retryPrompt(prompt, rejectedRules, hints);
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
    splitPlan: (input): Promise<PlanSplitResult> =>
      run("plan_split", "plan_split", (row) => BUILDERS.plan_split(row, input)),
    writeStepCards: (input): Promise<StepCardsResult> =>
      run("step_cards", "step_cards", (row) => BUILDERS.step_cards(row, input)),
    writeStuckStory: (input): Promise<LineResult> =>
      run("stuck_story", "stuck_story", (row) => BUILDERS.stuck_story(row, input)),
    writeRestReply: (input): Promise<LineResult> =>
      run("rest_reply", "rest_reply", (row) => BUILDERS.rest_reply(row, input)),
    writeReturnPopup: (input): Promise<LineResult> =>
      run("return_popup", "return_popup", (row) => BUILDERS.return_popup(row, input)),
    writeClosingLine: (input): Promise<ClosingLineResult> =>
      run("closing_line", "closing_line", (row) => BUILDERS.closing_line(row, input)),
  };
}

type Built<T> = { prompt: string; accept: (raw: string) => Attempt<T> };
type Generated<R> = Extract<R, { source: "generated" }>;

/**
 * How each key's prompt is built from its row and checked (#282). The live calls and the admin's
 * publish check (`promptRowProblems`, #308) use these same builders, so they refuse the same rows.
 */
const BUILDERS = {
  plan_split(row: PromptRow, input: PlanSplitInput): Built<Generated<PlanSplitResult>> {
    const limits = readPlanLimits(checks(row));
    if (!limits) throw missing("checks");
    return {
      prompt: planPrompt(input, row),
      accept: (raw) => {
        const parsed = parseModelJson(raw);
        if (parsed === null) return { ok: false, rejectedRules: ["parse"] };
        const checked = checkPlan(parsed, input.totalMinutes, limits);
        if (!checked.ok) return checked;
        return { ok: true, value: checked.plan };
      },
    };
  },
  step_cards(row: PromptRow, input: StepCardsInput): Built<Generated<StepCardsResult>> {
    const rules = cardRules(row);
    return {
      prompt: stepCardPrompt(input, row, rules),
      accept: (raw) => acceptCards(raw, input, rules),
    };
  },
  stuck_story(row: PromptRow, input: StuckStoryInput): Built<Generated<LineResult>> {
    const limits = lineLimits(checks(row), "checks");
    return {
      prompt: stuckPrompt(input, row),
      accept: (raw) =>
        acceptLine(raw, "story", "stuck_story", input.forbidTerms ?? [], limits, {
          earlierLines: input.earlierLines ?? [],
          lastCard: input.lastCard,
          companionName: input.companionName,
        }),
    };
  },
  rest_reply(row: PromptRow, input: RestReplyInput): Built<Generated<LineResult>> {
    const limits = lineLimits(checks(row), "checks");
    return {
      prompt: restPrompt(input, row),
      accept: (raw) =>
        acceptLine(raw, "reply", "rest_reply", [], limits, null, input.companionName),
    };
  },
  return_popup(row: PromptRow, input: ReturnPopupInput): Built<Generated<LineResult>> {
    const limits = lineLimits(checks(row), "checks");
    return {
      prompt: returnPrompt(input, row),
      accept: (raw) =>
        acceptLine(raw, "returnLine", "return_popup", input.forbidTerms ?? [], limits, {
          earlierLines: input.earlierLines ?? [],
          companionName: input.companionName,
        }),
    };
  },
  closing_line(row: PromptRow, input: ClosingLineInput): Built<Generated<ClosingLineResult>> {
    const limits = lineLimits(checks(row), "checks");
    return {
      prompt: closingPrompt(input, row),
      accept: (raw) => acceptClosing(raw, input, limits),
    };
  },
};

/** Inputs that reach every branch of each builder: each optional line and each chosen text. */
const CHECK_CASES: {
  [K in Exclude<PromptKey, "retry_hints">]: Parameters<(typeof BUILDERS)[K]>[1][];
} = {
  plan_split: [
    { goal: "g", totalMinutes: 30, splitFiner: true },
    { goal: "g", totalMinutes: 30, splitFiner: false },
  ],
  step_cards: [
    {
      minutes: 10,
      facts: "f",
      storyCards: 2,
      background: true,
      stepFacts: "s",
      stepNumber: 1,
      stepCount: 2,
      mustUse: ["m"],
    },
    { minutes: 10, facts: "f", background: false },
    { minutes: 10, facts: "f", stepFacts: "" },
  ],
  stuck_story: [
    { pauseNumber: 1, facts: "f" },
    { pauseNumber: 1000, facts: "f" },
  ],
  rest_reply: [{ facts: "f", userMessage: "u" }],
  return_popup: [
    { trigger: "rest", facts: "f", awayMinutes: 5 },
    { trigger: "absence", facts: "f", awayMinutes: 60 },
  ],
  closing_line: [{ facts: "f", lastMoment: "l" }],
};

/**
 * Why the gateway would refuse this prompt row, in words; empty when every call that uses it can
 * build its prompt (#308 AC7). An unknown `{{name}}` and a missing or unusable setting are
 * reported. Publish and roll back in the admin refuse a row with any problem.
 */
export function promptRowProblems(row: PromptRow): string[] {
  const problems: string[] = [];
  const attempt = (build: () => unknown) => {
    try {
      build();
    } catch (error) {
      const found =
        error instanceof PromptRowError ? error.problems : ["The prompt cannot be built."];
      for (const problem of found) if (!problems.includes(problem)) problems.push(problem);
    }
  };
  if (row.key === "retry_hints") {
    attempt(() => render(row, { fixes: "x" }));
    return problems;
  }
  const key = row.key;
  for (const input of CHECK_CASES[key]) {
    attempt(() => (BUILDERS[key] as (row: PromptRow, input: unknown) => unknown)(row, input));
  }
  return problems;
}

/** The step_cards row's card counts and limits (T7, CARD-LENGTH). */
type CardRules = {
  maxStoryCards: number;
  defaultCards: number;
  stepCard: LineLimits;
  backgroundCard: LineLimits;
};

function cardRules(row: PromptRow): CardRules {
  const values = checks(row);
  return {
    maxStoryCards: count(values.max_story_cards, "checks.max_story_cards"),
    defaultCards: count(values.default_cards, "checks.default_cards"),
    stepCard: lineLimits(values.step_card, "checks.step_card"),
    backgroundCard: lineLimits(values.background_card, "checks.background_card"),
  };
}

/** The opening card plus at most the Step's story cards (T7); extra cards are dropped. */
function cardLimit(input: StepCardsInput, rules: CardRules): number {
  const story = input.storyCards;
  if (typeof story !== "number" || !Number.isInteger(story) || story < 1) return rules.defaultCards;
  return 1 + Math.min(story, rules.maxStoryCards);
}

function acceptCards(
  raw: string,
  input: StepCardsInput,
  rules: CardRules,
): Attempt<{ source: "generated"; cards: string[] }> {
  const forbidTerms = input.forbidTerms ?? [];
  const earlierLines = input.earlierLines ?? [];
  const parsed = parseModelJson(raw);
  const cards = isRecord(parsed) && Array.isArray(parsed.cards) ? parsed.cards : null;
  if (!cards || cards.length === 0) return { ok: false, rejectedRules: ["parse"] };

  const accepted: string[] = [];
  for (const [position, card] of cards.slice(0, cardLimit(input, rules)).entries()) {
    if (typeof card !== "string") return { ok: false, rejectedRules: ["parse"] };
    const kind = position === 0 && input.background ? "background_card" : "step_card";
    const limits = kind === "background_card" ? rules.backgroundCard : rules.stepCard;
    const checked = checkCompanionLine(card, kind, forbidTerms, limits, input.companionName);
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
  kind: "stuck_story" | "rest_reply" | "return_popup" | "closing_line",
  forbidTerms: string[],
  limits: LineLimits,
  runList: { earlierLines: string[]; lastCard?: string; companionName?: string } | null,
  companionName = runList?.companionName,
): Attempt<{ source: "generated"; text: string }> {
  const parsed = parseModelJson(raw);
  const line = isRecord(parsed) ? parsed[key] : undefined;
  if (typeof line !== "string") return { ok: false, rejectedRules: ["parse"] };
  const checked = checkCompanionLine(line, kind, forbidTerms, limits, companionName);
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

/** Both lines pass the existing one-way line checks; the carried line may not repeat the closing one. */
function acceptClosing(
  raw: string,
  input: ClosingLineInput,
  limits: LineLimits,
): Attempt<Extract<ClosingLineResult, { source: "generated" }>> {
  const parsed = parseModelJson(raw);
  if (!isRecord(parsed)) return { ok: false, rejectedRules: ["parse"] };
  const earlierLines = input.earlierLines ?? [];
  const closing = acceptLine(
    JSON.stringify({ line: parsed.closing_line }),
    "line",
    "closing_line",
    input.forbidTerms ?? [],
    limits,
    { earlierLines, companionName: input.companionName },
  );
  if (!closing.ok) return closing;
  const carry = acceptLine(
    JSON.stringify({ line: parsed.carry_line }),
    "line",
    "closing_line",
    input.forbidTerms ?? [],
    limits,
    { earlierLines: [...earlierLines, closing.value.text], companionName: input.companionName },
  );
  if (!carry.ok) return carry;
  return {
    ok: true,
    value: { source: "generated", closingLine: closing.value.text, carryLine: carry.value.text },
  };
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

function planPrompt(input: PlanSplitInput, row: PromptRow): string {
  return render(row, {
    goal: input.goal,
    totalMinutes: input.totalMinutes,
    splitFiner: text(row, input.splitFiner ? "split_finer_yes" : "split_finer_no"),
  });
}

/** No user-written text goes into this prompt (#216): only the Story side and numbers. */
function stepCardPrompt(input: StepCardsInput, row: PromptRow, rules: CardRules): string {
  const storyCards =
    typeof input.storyCards === "number" && input.storyCards >= 1
      ? Math.min(Math.floor(input.storyCards), rules.maxStoryCards)
      : null;
  const numbered = Boolean(input.stepNumber && input.stepCount);
  // CARD-NEW: without the Step's own facts, `facts` is sent as before; with them, the prompt says
  // what already happened and what is new in this part.
  const split = input.stepFacts !== undefined;
  const somethingNew = split && input.stepFacts!.trim().length > 0;
  return render(row, {
    cardsLine:
      storyCards === null
        ? text(row, "cards_open")
        : fill(text(row, "cards_counted"), { storyCards }, "text.cards_counted"),
    backgroundLine: input.background ? text(row, "background") : null,
    stepNumber: numbered ? input.stepNumber : null,
    stepCount: numbered ? input.stepCount : null,
    mustUse: input.mustUse && input.mustUse.length > 0 ? input.mustUse.join(" ") : null,
    minutes: input.minutes,
    facts: split ? null : input.facts,
    factsBefore: split ? input.facts : null,
    stepFacts: somethingNew ? input.stepFacts : null,
    nothingNew: split && !somethingNew ? text(row, "nothing_new") : null,
  });
}

/** A Pause number that is not a whole number of at least 1 is read as the first Pause. */
function normalPauseNumber(value: number): number {
  return Number.isInteger(value) && value >= 1 ? value : 1;
}

function stuckPrompt(input: StuckStoryInput, row: PromptRow): string {
  const pauseNumber = normalPauseNumber(input.pauseNumber);
  const harderFrom = count(row.params.harder_from_pause, "harder_from_pause");
  return render(row, {
    situation: text(row, pauseNumber >= harderFrom ? "situation_harder" : "situation_first"),
    pauseNumber,
    facts: input.facts,
  });
}

function restPrompt(input: RestReplyInput, row: PromptRow): string {
  return render(row, { facts: input.facts, userMessage: input.userMessage });
}

const RETURN_SITUATION: Record<ReturnTrigger, string> = {
  rest: "situation_rest",
  absence: "situation_absence",
};

function returnPrompt(input: ReturnPopupInput, row: PromptRow): string {
  return render(row, {
    situation: text(row, RETURN_SITUATION[input.trigger]),
    trigger: input.trigger,
    facts: input.facts,
    awayMinutes: input.awayMinutes,
  });
}

/** The closing line (docs/ai/AI_07 section 4, changed for END-TONE on 2026-11-12). */
function closingPrompt(input: ClosingLineInput, row: PromptRow): string {
  return render(row, { facts: input.facts, lastMoment: input.lastMoment });
}

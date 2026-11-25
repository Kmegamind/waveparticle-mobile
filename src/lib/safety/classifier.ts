import type { ModelProvider } from "@/lib/model-gateway/types";
import type { PromptRow } from "@/lib/prompts/repository";
import { renderPrompt } from "@/lib/prompts/template";

/**
 * The safety classifier (US-SAF-4, #117). One model call, through the same provider settings as
 * the gateway (owner decision of 2026-11-22, SAFETY-PROVIDER), labels a free-text message
 * `crisis`, `stress` (everyday pressure) or `none`. It sees the message and at most the two
 * earlier messages of the same field, never the Companion, the Story, the Goal or the Plan.
 *
 * One attempt within 1.5 seconds, the prompt read included. A slow, failed or unreadable answer is
 * a failure (`ok: false`): the keyword layer then decides alone (`check.ts`). An `unsure` answer
 * counts as crisis (AC2: an ambiguous message is treated as a crisis).
 */

export const SAFETY_CLASSIFIER_TIME_LIMIT_MS = 1_500;
/** Earlier messages of the same field sent as context (AI_05 section 3). */
export const SAFETY_CONTEXT_MESSAGES = 2;
/** The longest text sent for one message; longer text is cut, never dropped. */
export const SAFETY_TEXT_MAX = 2_000;
/** Enough for `{"tier":"unsure"}` and some spacing. */
export const SAFETY_CLASSIFIER_MAX_TOKENS = 20;

export type ClassifierTier = "crisis" | "stress" | "none";
export type ClassifierFailureReason = "timeout" | "request" | "parse" | "prompt";

export type ClassifierOutcome =
  | { ok: true; tier: ClassifierTier; promptVersion: number; latencyMs: number }
  | {
      ok: false;
      reason: ClassifierFailureReason;
      latencyMs: number;
      /** The prompt version that was asked, when the prompt was read before the failure (#119). */
      promptVersion?: number | null;
    };

export type ClassifierInput = { text: string; previous: readonly string[] };

export type SafetyClassifier = (input: ClassifierInput) => Promise<ClassifierOutcome>;

export type ClassifierPromptSource = (key: "safety_classifier") => Promise<PromptRow | null>;

const ANSWERS: Record<string, ClassifierTier> = {
  crisis: "crisis",
  stress: "stress",
  none: "none",
  unsure: "crisis",
};

/**
 * Reads the model's answer. Only one JSON object with exactly one `tier` key is accepted (a code
 * fence around it is allowed). Anything else is null, a failure, so a message cannot steer the
 * result by adding a second object of its own.
 */
export function parseClassifierAnswer(raw: string): ClassifierTier | null {
  const text = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  if (!text.startsWith("{") || !text.endsWith("}")) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const keys = Object.keys(parsed);
  if (keys.length !== 1 || keys[0] !== "tier") return null;
  const tier = (parsed as { tier: unknown }).tier;
  return typeof tier === "string" && Object.hasOwn(ANSWERS, tier) ? ANSWERS[tier] : null;
}

/**
 * Cut to the limit, and turn the prompt's own `<<<` and `>>>` markers into look-alikes, so a
 * message cannot close its block and add text the model would read as instructions (review M2).
 */
const cut = (text: string) =>
  text.slice(0, SAFETY_TEXT_MAX).replaceAll("<<<", "‹‹‹").replaceAll(">>>", "›››");

/** The prompt for one message: the last two earlier messages (oldest first) and the message. */
export function safetyClassifierPrompt(row: PromptRow, input: ClassifierInput): string {
  const previous = input.previous.slice(-SAFETY_CONTEXT_MESSAGES).map(cut);
  return renderPrompt(row.body, {
    prev_1: previous.length === 2 ? previous[0] : null,
    prev_2: previous.length === 2 ? previous[1] : (previous[0] ?? null),
    text: cut(input.text),
  });
}

class Timeout extends Error {}
class PromptMissing extends Error {}
class Unreadable extends Error {}

export function createSafetyClassifier(options: {
  provider: ModelProvider;
  prompts: ClassifierPromptSource;
  timeLimitMs?: number;
  now?: () => number;
}): SafetyClassifier {
  const limit = options.timeLimitMs ?? SAFETY_CLASSIFIER_TIME_LIMIT_MS;
  const now = options.now ?? Date.now;

  return async (input) => {
    const started = now();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Timeout());
      }, limit);
    });

    // Known once the prompt is read, so a failure can still name the version (#119 review M6).
    let readVersion: number | null = null;
    const work = (async () => {
      const row = await options.prompts("safety_classifier");
      if (!row) throw new PromptMissing();
      readVersion = Number.isInteger(row.version) ? row.version : null;
      let prompt: string;
      try {
        prompt = safetyClassifierPrompt(row, input);
      } catch {
        throw new PromptMissing();
      }
      const raw = await options.provider({ prompt, signal: controller.signal });
      const tier = parseClassifierAnswer(raw);
      if (tier === null) throw new Unreadable();
      return { tier, promptVersion: row.version };
    })();
    // The work may still settle after the deadline; that late result is ignored.
    work.catch(() => undefined);

    try {
      const { tier, promptVersion } = await Promise.race([work, deadline]);
      return { ok: true, tier, promptVersion, latencyMs: now() - started };
    } catch (error) {
      const reason: ClassifierFailureReason =
        error instanceof Timeout
          ? "timeout"
          : error instanceof PromptMissing
            ? "prompt"
            : error instanceof Unreadable
              ? "parse"
              : "request";
      return { ok: false, reason, latencyMs: now() - started, promptVersion: readVersion };
    } finally {
      clearTimeout(timer);
    }
  };
}

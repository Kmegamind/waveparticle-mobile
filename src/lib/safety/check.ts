import type { ClassifierFailureReason, ClassifierTier, SafetyClassifier } from "./classifier";
import { SAFETY_CONTEXT_MESSAGES } from "./classifier";
import { checkSafetyText } from "./keyword";

/**
 * The server's input check on one free-text submission (US-SAF-1, US-SAF-4 #117).
 *
 * 1. The keyword layer runs first, always, with no network call. A keyword crisis ends the check:
 *    the text is never sent to any model, the classifier included.
 * 2. Otherwise the classifier is asked with the message and the last two earlier messages of the
 *    same field (earlier messages the keyword layer flagged are left out: they were discarded).
 * 3. The higher tier wins (crisis > stress > none). The keyword layer's low-mood match counts as
 *    everyday stress, because the low-mood tier is deferred (A5b).
 * 4. If the classifier fails or is slow (1.5 s), the keyword layer decides alone and a
 *    `classifier_failed` event is raised for the same-day alarm.
 *
 * The check runs before the reply model or any save (G4, owner decision of 2026-11-22), so crisis
 * text never reaches the reply model.
 */

/** Where the text was written (screen and field), for the log; never the text itself. */
export type SafetyPosition =
  "goal_input" | "goal_title" | "goal_rename" | "plan_split" | "plan_edit" | "rest_chat";

/**
 * Which layer decided: `keyword` (its tier was the higher one, or the keyword crisis skipped the
 * classifier), `classifier` (it raised the tier), or `keyword_alone` (no classifier, or it failed
 * or timed out).
 */
export type SafetyLayer = "keyword" | "classifier" | "keyword_alone";

export type SafetyGate = {
  action: "crisis-page" | "continue";
  tier: ClassifierTier;
  layer: SafetyLayer;
  /**
   * True when the classifier was asked and failed or timed out (the keyword layer decided alone).
   * Absent when there is no classifier. Lets a caller fail closed (#117 fix round 2, N1).
   */
  classifierFailed?: true;
};

export type SafetyContext = { position: SafetyPosition; previous?: readonly string[] };

export type SafetyCheck = (text: string, context: SafetyContext) => Promise<SafetyGate>;

export type SafetyEvent =
  | {
      kind: "classifier_failed";
      reason: ClassifierFailureReason;
      position: SafetyPosition;
      latencyMs: number;
    }
  | {
      kind: "crisis";
      layer: SafetyLayer;
      position: SafetyPosition;
      latencyMs: number;
      promptVersion: number | null;
    };

const RANK: Record<ClassifierTier, number> = { none: 0, stress: 1, crisis: 2 };

/** The keyword layer's answer in the two tiers of the first demo (A5b). */
export function keywordTier(text: string): ClassifierTier {
  const tier = checkSafetyText(text).tier;
  if (tier === "crisis") return "crisis";
  return tier === "low_mood" ? "stress" : "none";
}

const gate = (tier: ClassifierTier, layer: SafetyLayer): SafetyGate => ({
  action: tier === "crisis" ? "crisis-page" : "continue",
  tier,
  layer,
});

export function createSafetyCheck(options: {
  classifier: SafetyClassifier | null;
  onEvent?: (event: SafetyEvent) => void;
}): SafetyCheck {
  const emit = (event: SafetyEvent) => {
    try {
      options.onEvent?.(event);
    } catch {
      // Logging or the alarm must never change what the person sees.
    }
  };

  return async (text, context) => {
    const { position } = context;
    const keyword = keywordTier(text);
    if (keyword === "crisis") {
      emit({ kind: "crisis", layer: "keyword", position, latencyMs: 0, promptVersion: null });
      return gate("crisis", "keyword");
    }
    if (!options.classifier) return gate(keyword, "keyword_alone");

    const previous = (context.previous ?? [])
      .map((message) => message.trim())
      .filter((message) => message.length > 0 && keywordTier(message) !== "crisis")
      .slice(-SAFETY_CONTEXT_MESSAGES);

    let outcome: Awaited<ReturnType<SafetyClassifier>>;
    try {
      outcome = await options.classifier({ text, previous });
    } catch {
      outcome = { ok: false, reason: "request", latencyMs: 0 };
    }
    if (!outcome.ok) {
      emit({
        kind: "classifier_failed",
        reason: outcome.reason,
        position,
        latencyMs: outcome.latencyMs,
      });
      return { ...gate(keyword, "keyword_alone"), classifierFailed: true };
    }

    const classifierWins = RANK[outcome.tier] > RANK[keyword];
    const tier = classifierWins ? outcome.tier : keyword;
    const layer: SafetyLayer = classifierWins ? "classifier" : "keyword";
    if (tier === "crisis") {
      emit({
        kind: "crisis",
        layer,
        position,
        latencyMs: outcome.latencyMs,
        promptVersion: outcome.promptVersion,
      });
    }
    return gate(tier, layer);
  };
}

/** The keyword layer alone: the check where no server classifier is wired (and in tests). */
export const keywordOnlySafetyCheck: SafetyCheck = createSafetyCheck({ classifier: null });

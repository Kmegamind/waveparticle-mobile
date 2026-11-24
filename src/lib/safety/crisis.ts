import { checkSafetyText } from "./keyword";

/**
 * The legal body text waits for the legal and clinical review (US-SAF-8, #121), so it is a marked
 * placeholder. The help lines by region are in ./help-lines.ts (#118).
 */
export const crisisPlaceholder = {
  legalBody: "PLACEHOLDER: legal body text is not available yet.",
} as const;

export type FreeTextGate = { action: "crisis-page"; modelRequest: null } | { action: "continue" };

export type StepSurface = { screen: "crisis"; draft: "" } | { screen: "step"; draft: string };

export function gateFreeText(text: string): FreeTextGate {
  if (checkSafetyText(text).tier === "crisis") {
    return { action: "crisis-page", modelRequest: null };
  }

  return { action: "continue" };
}

export function submitStepDraft(draft: string): StepSurface {
  if (gateFreeText(draft).action === "crisis-page") {
    return { screen: "crisis", draft: "" };
  }

  return { screen: "step", draft };
}

export function backToStep(): StepSurface {
  return { screen: "step", draft: "" };
}

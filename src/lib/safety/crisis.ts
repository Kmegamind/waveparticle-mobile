import { checkSafetyText } from "./keyword";

/**
 * Legal body text and regional support resources are not stated in
 * docs/DECISIONS.md or docs/CONTENT_MODEL.md. These strings are placeholders.
 */
export const crisisPlaceholder = {
  legalBody: "PLACEHOLDER: legal body text is not available yet.",
  regionResource:
    "PLACEHOLDER: no regional support resource is listed in docs/DECISIONS.md or docs/CONTENT_MODEL.md.",
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

export type SafetyTier = "crisis" | "low_mood" | "none";

export type SafetyKeywordResult = {
  tier: SafetyTier;
  flagged: boolean;
};

const crisisPatterns = [
  /\b(?:want|wanna)\s+to\s+(?:kill|hurt|harm)\s+(?:myself|me|him|her|them)\b/,
  /\b(?:plan to|planning to|intend to|going to|about to)\s+(?:kill|hurt|harm)\s+(?:myself|me|him|her|them)\b/,
  /\b(?:kill|hurt|harm)\s+(?:myself|me|him|her|them)\b/,
  /\b(?:want|wanna)\s+to\s+end it\b/,
  /\b(?:plan to|planning to|intend to|going to|about to)\s+end it\b/,
  /\bdo not want to be here anymore\b/,
  /\bdo not want to be alive anymore\b/,
  /\b(?:suicide|suicidal)\b/,
] as const;

const lowMoodPatterns = [
  /\bworthless\b/,
  /\bhopeless\b/,
  /\b(?:cannot|can't|can not)\s+cope\b/,
  /\bwhat(?:'s| is) the point\b/,
  /\bno point in (?:going on|living)\b/,
  /\b(?:cannot|can't|can not)\s+go on\b/,
] as const;

const negatedHarmPattern =
  /\b(?:never|would never|will never|do not|don't|not going to|wouldn't|won't)\s+(?:(?:want|wanna)\s+to\s+)?(?:kill|hurt|harm)\s+(?:myself|me|him|her|them)\b/;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function checkSafetyText(text: string): SafetyKeywordResult {
  const normalized = normalize(text);

  if (
    !normalized ||
    (matchesAny(normalized, [negatedHarmPattern]) &&
      !/\b(?:end it|be alive|be here)\b/.test(normalized))
  ) {
    return { tier: "none", flagged: false };
  }

  if (matchesAny(normalized, crisisPatterns) && !negatedHarmPattern.test(normalized)) {
    return { tier: "crisis", flagged: true };
  }

  if (matchesAny(normalized, lowMoodPatterns)) {
    return { tier: "low_mood", flagged: true };
  }

  return { tier: "none", flagged: false };
}

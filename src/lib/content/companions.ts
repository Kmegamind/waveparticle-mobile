import type { Companion } from "./types";

/**
 * The Companions shown on Home, Goals, Me and the Companions list (#268, #93), from the story
 * content (#284). Client-safe: these are display fields only.
 */
export type CompanionId = string;

/** Sessions stored before companions existed belong to Oppenheimer. */
export const DEFAULT_COMPANION_ID = "oppenheimer";

/** The Companion with this id; an unknown or missing id reads as Oppenheimer. */
export function companionById(companions: Companion[], id: string): Companion {
  return (
    companions.find((companion) => companion.id === id) ??
    companions.find((companion) => companion.id === DEFAULT_COMPANION_ID) ??
    companions[0]
  );
}

import type { Companion } from "./types";

/**
 * The Companions shown on Home, Goals, Me and the Companions list (#268, #93), from the story
 * content (#284). Client-safe: these are display fields only.
 */
export type CompanionId = string;

/**
 * The Companion with this id. Sessions stored before companions existed read as the first
 * Companion (Oppenheimer, position 1).
 */
export function companionById(companions: Companion[], id: string): Companion {
  return companions.find((companion) => companion.id === id) ?? companions[0];
}

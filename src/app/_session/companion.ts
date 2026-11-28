/**
 * The default Companion as the session screens show him (prototype v4, #263). #485, #521: a
 * product default, not a rule. The test path /try plays only him; the signed-in screens pass the
 * session's own Companion (name and portrait from the story content) and fall back to this only
 * when none is given.
 */
export const COMPANION = {
  name: "Oppenheimer",
  portrait: "/companions/oppenheimer.png",
} as const;

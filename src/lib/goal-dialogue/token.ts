/**
 * The goal dialogue's state, kept in a signed token (#31, US-GD-14; docs/decisions/0026).
 * The server writes the state, signs it with HMAC-SHA256 and hands it to the browser; the browser
 * sends it back with the next turn. A changed token fails the check. No database row is used, so
 * it works the same on /try (signed out) and /goal (signed in). The token holds no goal text, only
 * a keyed hash of it.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** The state of one dialogue after its latest turn. */
export type DialogueState = {
  v: 1;
  /** One id per dialogue; a new goal line starts a new one. */
  id: string;
  /** Keyed hash of the goal line; any later request must carry the same line. */
  goal: string;
  /** Turns taken so far: goal, time, split answer (at most three). */
  turns: number;
  /** The minutes the split will use: asked, "Not sure" or read from the goal; null when unknown. */
  minutes: number | null;
  /** The split answer: true for finer, false for broad; null before it. */
  finer: boolean | null;
  /** True once a split ran (a Plan or a failure): only Split again and Try again remain. */
  closed: boolean;
  /** When the token was signed (milliseconds). */
  iat: number;
};

export const SECRET_ENV_NAME = "GOAL_DIALOGUE_SECRET";
export const MIN_SECRET_LENGTH = 32;

let processKey: Buffer | null = null;

/**
 * The signing key. `GOAL_DIALOGUE_SECRET` when it has at least 32 characters. Without it, in
 * production there is no key and every turn is refused (fail closed); outside production a random
 * key made once per process is used, so development and tests work without a setting and a token
 * never outlives the process.
 */
export function dialogueSecret(env: Record<string, string | undefined>): Buffer | null {
  const value = env[SECRET_ENV_NAME] ?? "";
  if (value.length >= MIN_SECRET_LENGTH) return Buffer.from(value);
  if (env.NODE_ENV === "production") return null;
  processKey ??= randomBytes(32);
  return processKey;
}

function mac(body: string, secret: Buffer): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

/** A keyed hash of the trimmed goal line, so the token never holds the words. */
export function goalHash(goal: string, secret: Buffer): string {
  return createHmac("sha256", secret).update(`goal:${goal.trim()}`).digest("base64url");
}

export function signDialogueToken(state: DialogueState, secret: Buffer): string {
  const body = Buffer.from(JSON.stringify(state)).toString("base64url");
  return `${body}.${mac(body, secret)}`;
}

function isState(value: unknown): value is DialogueState {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    s.v === 1 &&
    typeof s.id === "string" &&
    typeof s.goal === "string" &&
    Number.isInteger(s.turns) &&
    (s.minutes === null || Number.isInteger(s.minutes)) &&
    (s.finer === null || typeof s.finer === "boolean") &&
    typeof s.closed === "boolean" &&
    typeof s.iat === "number"
  );
}

/** The state in a token, or null when it is forged, broken or older than `maxAgeMs`. */
export function verifyDialogueToken(
  token: unknown,
  secret: Buffer,
  now: number,
  maxAgeMs = 24 * 60 * 60 * 1000,
): DialogueState | null {
  if (typeof token !== "string" || token.length > 2000) return null;
  const [body, given, extra] = token.split(".");
  if (!body || !given || extra !== undefined) return null;
  const expected = Buffer.from(mac(body, secret));
  const actual = Buffer.from(given);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  let state: unknown;
  try {
    state = JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
  if (!isState(state)) return null;
  if (now - state.iat > maxAgeMs || state.iat > now + 60_000) return null;
  return state;
}

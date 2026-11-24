import { keywordOnlySafetyCheck, type SafetyCheck } from "@/lib/safety/check";
import { isCountryCode } from "@/lib/safety/help-lines";

/**
 * Settings on the account (#81, #71): the display name and "Keep the clock running when I
 * leave", in `profiles` (row-level security: own row only). Nothing typed is logged.
 */
export type ProfileFields = {
  nickname?: string;
  keepClockRunning?: boolean;
  /** The country for help lines (#118, SAFETY-REGION-STORE); null clears it. */
  helpCountry?: string | null;
};

export type ProfileWriter = { upsert(userId: string, fields: ProfileFields): Promise<void> };

export type ProfileOutcome = { status: "ok" } | { status: "invalid" | "failed" };

export const NAME_MAX = 60;

/**
 * The display name (#81) passes the server's safety check before it is saved (#392, US-SAF-1,
 * SAFETY-FIELDS-NAME): the length check first (an invalid name costs no classifier call), then the
 * check with no earlier messages (a one-off field), then the write. A crisis saves nothing and
 * returns `crisis`; the Me page then shows S1. Stress and a failed classifier (the keyword layer
 * decided alone) save as usual.
 */
export async function saveDisplayName(
  input: unknown,
  deps: {
    userId: string | null;
    writer: ProfileWriter;
    /** The server's safety check (#392); the keyword layer alone if omitted. */
    safety?: SafetyCheck;
  },
): Promise<{ status: "ok"; name: string } | { status: "invalid" | "failed" | "crisis" }> {
  if (!deps.userId) return { status: "failed" };
  const raw = (input as { name?: unknown } | null)?.name;
  const name = typeof raw === "string" ? raw.trim() : "";
  if (name.length === 0 || name.length > NAME_MAX) return { status: "invalid" };
  const safety = deps.safety ?? keywordOnlySafetyCheck;
  try {
    if ((await safety(name, { position: "display_name" })).action === "crisis-page") {
      return { status: "crisis" };
    }
  } catch {
    return { status: "failed" };
  }
  try {
    await deps.writer.upsert(deps.userId, { nickname: name });
    return { status: "ok", name };
  } catch {
    return { status: "failed" };
  }
}

export async function setKeepClockRunning(
  input: unknown,
  deps: { userId: string | null; writer: ProfileWriter },
): Promise<ProfileOutcome> {
  if (!deps.userId) return { status: "failed" };
  const on = (input as { on?: unknown } | null)?.on;
  if (typeof on !== "boolean") return { status: "invalid" };
  try {
    await deps.writer.upsert(deps.userId, { keepClockRunning: on });
    return { status: "ok" };
  } catch {
    return { status: "failed" };
  }
}

/**
 * The country for help lines (#118, ME-REGION): an ISO 3166-1 alpha-2 code from the list, or null
 * for "No country". Stored on the account (SAFETY-REGION-STORE); the app never guesses it.
 */
export async function setHelpCountry(
  input: unknown,
  deps: { userId: string | null; writer: ProfileWriter },
): Promise<ProfileOutcome> {
  if (!deps.userId) return { status: "failed" };
  const country = (input as { country?: unknown } | null)?.country;
  if (country !== null && !isCountryCode(country)) return { status: "invalid" };
  try {
    await deps.writer.upsert(deps.userId, { helpCountry: country });
    return { status: "ok" };
  } catch {
    return { status: "failed" };
  }
}

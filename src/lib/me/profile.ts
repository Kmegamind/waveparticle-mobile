/**
 * Settings on the account (#81, #71): the display name and "Keep the clock running when I
 * leave", in `profiles` (row-level security: own row only). Nothing typed is logged.
 */
export type ProfileFields = { nickname?: string; keepClockRunning?: boolean };

export type ProfileWriter = { upsert(userId: string, fields: ProfileFields): Promise<void> };

export type ProfileOutcome = { status: "ok" } | { status: "invalid" | "failed" };

export const NAME_MAX = 60;

export async function saveDisplayName(
  input: unknown,
  deps: { userId: string | null; writer: ProfileWriter },
): Promise<{ status: "ok"; name: string } | { status: "invalid" | "failed" }> {
  if (!deps.userId) return { status: "failed" };
  const raw = (input as { name?: unknown } | null)?.name;
  const name = typeof raw === "string" ? raw.trim() : "";
  if (name.length === 0 || name.length > NAME_MAX) return { status: "invalid" };
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

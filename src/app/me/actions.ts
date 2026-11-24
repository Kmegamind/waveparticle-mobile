"use server";

import { readPublishedEntry } from "@/lib/hotlines/repository";
import { saveDisplayName, setHelpCountry, setKeepClockRunning } from "@/lib/me/profile";
import type { HelpLineCopy } from "@/lib/safety/help-lines";
import { createSupabaseProfileWriter } from "@/lib/me/supabase-profile";
import { serverSafetyCheck } from "@/lib/safety/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";

// Server actions of the Me area (#81, #71). Public endpoints: the rules check the input, and the
// user's own client keeps every write to their own profile.

async function deps() {
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  return { client, userId: user?.id ?? null, writer: createSupabaseProfileWriter(client) };
}

export async function saveDisplayNameAction(input: unknown) {
  try {
    // The display name passes the server's safety check before it is saved (#392).
    return await saveDisplayName(input, { ...(await deps()), safety: serverSafetyCheck() });
  } catch {
    return { status: "failed" as const };
  }
}

export async function setKeepClockRunningAction(input: unknown) {
  try {
    return await setKeepClockRunning(input, await deps());
  } catch {
    return { status: "failed" as const };
  }
}

/**
 * ME-REGION (#118): saves the country for help lines on the account, then answers the copy the
 * phone keeps (the user id, the country and its published entry). When the entry could not be
 * read, the copy holds the new country with no entry until the next refresh.
 */
export async function setHelpCountryAction(
  input: unknown,
): Promise<{ status: "ok"; copy: HelpLineCopy } | { status: "invalid" | "failed" }> {
  try {
    const found = await deps();
    const outcome = await setHelpCountry(input, found);
    if (outcome.status !== "ok") return outcome;
    const userId = found.userId!;
    const country = (input as { country: string | null }).country;
    if (!country) return { status: "ok", copy: { userId, country: null, entry: null } };
    const { ok, entry } = await readPublishedEntry(found.client, country);
    // A failed entry read still updates the country at once: S1-N (the directory) is safer than
    // the old country's line (review of #406, M-2).
    return { status: "ok", copy: { userId, country, entry: ok ? entry : null } };
  } catch {
    return { status: "failed" as const };
  }
}

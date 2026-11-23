"use server";

import { saveDisplayName, setKeepClockRunning } from "@/lib/me/profile";
import { createSupabaseProfileWriter } from "@/lib/me/supabase-profile";
import { serverSafetyCheck } from "@/lib/safety/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";

// Server actions of the Me area (#81, #71). Public endpoints: the rules check the input, and the
// user's own client keeps every write to their own profile.

async function deps() {
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  return { userId: user?.id ?? null, writer: createSupabaseProfileWriter(client) };
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

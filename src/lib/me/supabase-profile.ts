import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileWriter } from "./profile";

type Result = { data?: unknown; error: unknown };

/** Profile reads and writes through the user's own client (row-level security, #81). */
export function createSupabaseProfileWriter(client: Pick<SupabaseClient, "from">): ProfileWriter {
  return {
    async upsert(userId, fields) {
      const row: Record<string, unknown> = { user_id: userId };
      if (fields.nickname !== undefined) row.nickname = fields.nickname;
      if (fields.keepClockRunning !== undefined) row.keep_clock_running = fields.keepClockRunning;
      const result = (await client.from("profiles").upsert(row)) as Result;
      // The message carries no row data, so nothing the user typed can reach a log.
      if (result.error) throw new Error("profile write failed");
    },
  };
}

export async function readProfile(
  client: Pick<SupabaseClient, "from">,
  userId: string,
): Promise<{ nickname: string | null; keepClockRunning: boolean }> {
  const result = (await client
    .from("profiles")
    .select("nickname, keep_clock_running")
    .eq("user_id", userId)
    .maybeSingle()) as Result;
  const row = (result.error ? null : result.data) as
    { nickname?: unknown; keep_clock_running?: unknown } | null | undefined;
  return {
    nickname: typeof row?.nickname === "string" ? row.nickname : null,
    keepClockRunning: row?.keep_clock_running === true,
  };
}

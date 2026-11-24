"use server";

import { revalidatePath } from "next/cache";
import { readContentRole } from "@/lib/admin/roles";
import {
  writeHotline,
  type HotlineDraftInput,
  type HotlineWrite,
  type HotlineWriteResult,
} from "@/lib/hotlines/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";

// The buttons of ADM-15 (#118, HOTLINES). The account and its role are checked here before any
// write, and again in the database functions: only the admin role saves, publishes and rolls back.

async function run(write: HotlineWrite): Promise<HotlineWriteResult> {
  try {
    const client = await createSupabaseServerClient();
    const user = await getCurrentUser(client);
    const role = user ? await readContentRole(client) : null;
    const result = await writeHotline(write, {
      userId: user?.id ?? null,
      role,
      rpc: async (name, args) => {
        const { data, error } = await client.rpc(name, args);
        return { data, error };
      },
    });
    if (result.ok) {
      revalidatePath("/admin/hotlines", "layout");
      if (write.kind !== "save") revalidatePath("/admin/publish-history");
    }
    return result;
  } catch {
    return { ok: false, error: "failed" };
  }
}

/** Saves the fields as a new draft version of the country's entry. Admin only. */
export async function saveHotlineDraftAction(input: HotlineDraftInput) {
  return run({ kind: "save", input });
}

/** Makes a version the published one. Admin only. */
export async function publishHotlineAction(country: string, version: number) {
  return run({ kind: "publish", country, version });
}

/** Publishes a version that was published before again. Admin only. */
export async function rollBackHotlineAction(country: string, version: number) {
  return run({ kind: "roll_back", country, version });
}

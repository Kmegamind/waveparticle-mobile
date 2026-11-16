"use server";

import { revalidatePath } from "next/cache";
import { readContentRole } from "@/lib/admin/roles";
import { writeAppText, type AppTextWrite, type AppTextWriteResult } from "@/lib/app-text/admin";
import { clearAppTextCache } from "@/lib/app-text/repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";

// The buttons of ADM-07 App text (#288). Each action checks the signed-in account and its role on
// the server before anything is written; the database functions check the role again. No key with
// full database rights: every call runs as the signed-in user.

async function run(write: AppTextWrite): Promise<AppTextWriteResult> {
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  const role = user ? await readContentRole(client) : null;
  const result = await writeAppText(write, {
    userId: user?.id ?? null,
    role,
    rpc: async (name, args) => {
      const { data, error } = await client.rpc(name, args);
      return { data, error };
    },
    clearCache: clearAppTextCache,
  });
  if (result.ok) revalidatePath("/admin/app-text");
  return result;
}

/** Saves the text as a new draft version of its key. */
export async function saveAppTextDraftAction(key: string, body: string) {
  return run({ kind: "save", key, body });
}

/** Makes a version the published one. */
export async function publishAppTextAction(key: string, version: number) {
  return run({ kind: "publish", key, version });
}

/** Publishes an earlier published version again. */
export async function rollBackAppTextAction(key: string, version: number) {
  return run({ kind: "roll_back", key, version });
}
